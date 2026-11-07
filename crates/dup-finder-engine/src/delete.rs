use crate::audit::{from_outcome, AuditEvent};
use crate::hash::blake3_file;
use crate::model::{
    DeleteMode, DeleteOutcome, DeleteOutcomeKind, DeleteReport, DeleteRequest, FileRecord,
};
use crate::path_safe::{contains_parent_component, realpath, under_any_root};
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Pluggable delete backend so tests never depend on OS trash.
pub trait DeleteBackend {
    fn trash(&self, path: &Path) -> io::Result<()>;
    fn permanent(&self, path: &Path) -> io::Result<()>;
}

/// Production backend: prefer OS Trash/Recycle (via `trash` crate); on failure
/// (headless Docker, missing desktop trash) fall back to `.dup-finder-trash`
/// beside the file. Permanent uses `remove_file`.
pub struct FsDeleteBackend;

impl DeleteBackend for FsDeleteBackend {
    fn trash(&self, path: &Path) -> io::Result<()> {
        match trash::delete(path) {
            Ok(()) => Ok(()),
            Err(_os_err) => quarantine_beside(path),
        }
    }

    fn permanent(&self, path: &Path) -> io::Result<()> {
        fs::remove_file(path)
    }
}

/// Local quarantine folder next to the file (not OS Trash).
fn quarantine_beside(path: &Path) -> io::Result<()> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let trash_dir = parent.join(".dup-finder-trash");
    fs::create_dir_all(&trash_dir)?;
    let name = path
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "no file name"))?;
    let mut dest = trash_dir.join(name);
    let mut i = 0u32;
    while dest.exists() {
        i += 1;
        dest = trash_dir.join(format!("{}__{}", name.to_string_lossy(), i));
    }
    fs::rename(path, &dest)
}

/// Test backend: moves into a quarantine directory (never OS trash).
pub struct QuarantineBackend {
    pub dir: PathBuf,
}

impl DeleteBackend for QuarantineBackend {
    fn trash(&self, path: &Path) -> io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        let name = path
            .file_name()
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "no file name"))?;
        let mut dest = self.dir.join(name);
        let mut i = 0u32;
        while dest.exists() {
            i += 1;
            dest = self.dir.join(format!("{}__{}", name.to_string_lossy(), i));
        }
        fs::rename(path, dest)
    }

    fn permanent(&self, path: &Path) -> io::Result<()> {
        fs::remove_file(path)
    }
}

pub fn safe_delete<B: DeleteBackend>(
    req: &DeleteRequest,
    backend: &B,
) -> (DeleteReport, Vec<AuditEvent>) {
    // Two-phase UX: any mutating mode requires an explicit confirm (dry_run never mutates).
    if matches!(req.mode, DeleteMode::Trash | DeleteMode::Permanent) && !req.confirm {
        let reason = match req.mode {
            DeleteMode::Trash => "trash_requires_confirm",
            DeleteMode::Permanent => "permanent_requires_confirm",
            DeleteMode::DryRun => unreachable!(),
        };
        let report = DeleteReport {
            outcomes: vec![],
            refused: true,
            refuse_reason: Some(reason.into()),
        };
        return (report, vec![]);
    }

    if req.delete_paths.is_empty() {
        return (
            DeleteReport {
                outcomes: vec![],
                refused: false,
                refuse_reason: None,
            },
            vec![],
        );
    }

    let mut by_path: HashMap<PathBuf, &FileRecord> = HashMap::new();
    for rec in &req.records {
        by_path.insert(rec.path.clone(), rec);
        if let Ok(real) = realpath(&rec.path) {
            by_path.insert(real, rec);
        }
    }

    let mut root_reals = Vec::new();
    for r in &req.roots {
        match realpath(r) {
            Ok(p) => root_reals.push(p),
            Err(_) => {
                // Keep raw root if it vanished mid-flight; under check will fail closed.
                root_reals.push(r.clone());
            }
        }
    }

    let mut keep_reals = Vec::new();
    for k in &req.keep_paths {
        if let Ok(p) = realpath(k) {
            keep_reals.push(p);
        } else {
            keep_reals.push(k.clone());
        }
    }

    // Disjointness: any delete path that resolves to a keep realpath → skip IS_KEEP
    let mut outcomes = Vec::new();
    let mut audits = Vec::new();

    for path in &req.delete_paths {
        let outcome = delete_one(
            path,
            &by_path,
            &root_reals,
            &keep_reals,
            req.mode,
            backend,
        );
        audits.push(from_outcome(&outcome));
        outcomes.push(outcome);
    }

    (
        DeleteReport {
            outcomes,
            refused: false,
            refuse_reason: None,
        },
        audits,
    )
}

fn delete_one<B: DeleteBackend>(
    path: &Path,
    by_path: &HashMap<PathBuf, &FileRecord>,
    roots: &[PathBuf],
    keep_reals: &[PathBuf],
    mode: DeleteMode,
    backend: &B,
) -> DeleteOutcome {
    if contains_parent_component(path) {
        // Still try resolve, but flag; absolute with .. should canonicalize.
    }

    let record = match by_path.get(path).copied().or_else(|| {
        realpath(path)
            .ok()
            .and_then(|r| by_path.get(&r).copied())
    }) {
        Some(r) => r,
        None => {
            return skip(path, "NOT_IN_SCAN");
        }
    };

    let real = match realpath(path) {
        Ok(p) => p,
        Err(_) => return skip(path, "MISSING"),
    };

    if contains_parent_component(path) && !under_any_root(&real, roots) {
        return skip(path, "OUTSIDE_ROOT");
    }

    if !under_any_root(&real, roots) {
        return skip(path, "OUTSIDE_ROOT");
    }

    if keep_reals.iter().any(|k| k == &real) {
        return skip(path, "IS_KEEP");
    }

    let meta = match fs::metadata(&real) {
        Ok(m) => m,
        Err(_) => return skip(path, "MISSING"),
    };

    if meta.len() != record.size {
        return skip(path, "SIZE_MISMATCH");
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if let (Some(dev), Some(ino)) = (record.device, record.inode) {
            if meta.dev() != dev || meta.ino() != ino {
                return skip(path, "INODE_MISMATCH");
            }
        }
    }

    let hash = match blake3_file(&real) {
        Ok(h) => h,
        Err(_) => return skip(path, "HASH_ERROR"),
    };
    if hash != record.hash {
        return skip(path, "HASH_MISMATCH");
    }

    match mode {
        DeleteMode::DryRun => DeleteOutcome {
            path: real,
            kind: DeleteOutcomeKind::WouldDelete,
            reason: "DRY_RUN".into(),
        },
        DeleteMode::Trash => match backend.trash(&real) {
            Ok(()) => DeleteOutcome {
                path: real,
                kind: DeleteOutcomeKind::Deleted,
                reason: "TRASHED".into(),
            },
            Err(e) => skip(path, &format!("TRASH_FAIL:{e}")),
        },
        DeleteMode::Permanent => match backend.permanent(&real) {
            Ok(()) => DeleteOutcome {
                path: real,
                kind: DeleteOutcomeKind::Deleted,
                reason: "PERMANENT".into(),
            },
            Err(e) => skip(path, &format!("UNLINK_FAIL:{e}")),
        },
    }
}

fn skip(path: &Path, reason: &str) -> DeleteOutcome {
    DeleteOutcome {
        path: path.to_path_buf(),
        kind: DeleteOutcomeKind::Skipped,
        reason: reason.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::FileRecord;
    use crate::scan::scan_roots;
    use tempfile::tempdir;

    fn record_for(path: &Path) -> FileRecord {
        let meta = fs::metadata(path).unwrap();
        #[cfg(unix)]
        let (device, inode) = {
            use std::os::unix::fs::MetadataExt;
            (Some(meta.dev()), Some(meta.ino()))
        };
        #[cfg(not(unix))]
        let (device, inode) = (None, None);
        FileRecord {
            path: path.canonicalize().unwrap(),
            size: meta.len(),
            hash: blake3_file(path).unwrap(),
            mime: "text/plain".into(),
            mtime_secs: None,
            device,
            inode,
        }
    }

    #[test]
    fn t1_deletes_only_selected() {
        let dir = tempdir().unwrap();
        let keep = dir.path().join("keep_me.txt");
        let drop = dir.path().join("drop_me.txt");
        fs::write(&keep, b"same").unwrap();
        fs::write(&drop, b"same").unwrap();
        let q = dir.path().join("quarantine");
        let backend = QuarantineBackend { dir: q.clone() };
        let root = dir.path().canonicalize().unwrap();
        let keep_r = record_for(&keep);
        let drop_r = record_for(&drop);
        let req = DeleteRequest {
            roots: vec![root],
            records: vec![keep_r.clone(), drop_r.clone()],
            delete_paths: vec![drop_r.path.clone()],
            keep_paths: vec![keep_r.path.clone()],
            mode: DeleteMode::Trash,
            confirm: true,
        };
        let (report, _) = safe_delete(&req, &backend);
        assert!(keep.exists());
        assert!(!drop.exists());
        assert!(q.read_dir().unwrap().next().is_some());
        assert_eq!(report.outcomes[0].kind, DeleteOutcomeKind::Deleted);
    }

    #[test]
    fn t2_refuses_keep_path() {
        let dir = tempdir().unwrap();
        let keep = dir.path().join("keep_me.txt");
        fs::write(&keep, b"x").unwrap();
        let backend = QuarantineBackend {
            dir: dir.path().join("q"),
        };
        let rec = record_for(&keep);
        let req = DeleteRequest {
            roots: vec![dir.path().canonicalize().unwrap()],
            records: vec![rec.clone()],
            delete_paths: vec![rec.path.clone()],
            keep_paths: vec![rec.path.clone()],
            mode: DeleteMode::Trash,
            confirm: true,
        };
        let (report, _) = safe_delete(&req, &backend);
        assert!(keep.exists());
        assert_eq!(report.outcomes[0].reason, "IS_KEEP");
    }

    #[test]
    fn t3_hash_mismatch_skips() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("f.txt");
        fs::write(&f, b"v1").unwrap();
        let rec = record_for(&f);
        fs::write(&f, b"v2-changed").unwrap();
        // size may change — either SIZE or HASH mismatch is fail-closed
        let backend = QuarantineBackend {
            dir: dir.path().join("q"),
        };
        let req = DeleteRequest {
            roots: vec![dir.path().canonicalize().unwrap()],
            records: vec![rec.clone()],
            delete_paths: vec![rec.path.clone()],
            keep_paths: vec![],
            mode: DeleteMode::Trash,
            confirm: true,
        };
        let (report, _) = safe_delete(&req, &backend);
        assert!(f.exists());
        assert_eq!(report.outcomes[0].kind, DeleteOutcomeKind::Skipped);
    }

    #[test]
    fn t5_outside_root_rejected() {
        let dir = tempdir().unwrap();
        let other = tempdir().unwrap();
        let f = other.path().join("secret.txt");
        fs::write(&f, b"nope").unwrap();
        let rec = record_for(&f);
        let backend = QuarantineBackend {
            dir: dir.path().join("q"),
        };
        let req = DeleteRequest {
            roots: vec![dir.path().canonicalize().unwrap()],
            records: vec![rec.clone()],
            delete_paths: vec![rec.path.clone()],
            keep_paths: vec![],
            mode: DeleteMode::Trash,
            confirm: true,
        };
        let (report, _) = safe_delete(&req, &backend);
        assert!(f.exists());
        assert_eq!(report.outcomes[0].reason, "OUTSIDE_ROOT");
    }

    #[test]
    fn t6_dry_run_no_mutation() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("f.txt");
        fs::write(&f, b"x").unwrap();
        let rec = record_for(&f);
        let backend = QuarantineBackend {
            dir: dir.path().join("q"),
        };
        let req = DeleteRequest {
            roots: vec![dir.path().canonicalize().unwrap()],
            records: vec![rec.clone()],
            delete_paths: vec![rec.path.clone()],
            keep_paths: vec![],
            mode: DeleteMode::DryRun,
            confirm: false,
        };
        let (report, _) = safe_delete(&req, &backend);
        assert!(f.exists());
        assert_eq!(report.outcomes[0].kind, DeleteOutcomeKind::WouldDelete);
    }

    #[test]
    fn t8_empty_selection_noop() {
        let backend = QuarantineBackend {
            dir: PathBuf::from("/tmp/unused-q"),
        };
        let req = DeleteRequest {
            roots: vec![],
            records: vec![],
            delete_paths: vec![],
            keep_paths: vec![],
            mode: DeleteMode::Trash,
            confirm: true,
        };
        let (report, _) = safe_delete(&req, &backend);
        assert!(report.outcomes.is_empty());
        assert!(!report.refused);
    }

    #[test]
    fn t9_missing_file_skips() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("gone.txt");
        fs::write(&f, b"x").unwrap();
        let rec = record_for(&f);
        fs::remove_file(&f).unwrap();
        let backend = QuarantineBackend {
            dir: dir.path().join("q"),
        };
        let req = DeleteRequest {
            roots: vec![dir.path().canonicalize().unwrap()],
            records: vec![rec.clone()],
            delete_paths: vec![rec.path.clone()],
            keep_paths: vec![],
            mode: DeleteMode::Trash,
            confirm: true,
        };
        let (report, _) = safe_delete(&req, &backend);
        assert_eq!(report.outcomes[0].reason, "MISSING");
    }

    #[test]
    fn t10b_trash_without_confirm_refused() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("f.txt");
        fs::write(&f, b"x").unwrap();
        let rec = record_for(&f);
        let backend = QuarantineBackend {
            dir: dir.path().join("q"),
        };
        let req = DeleteRequest {
            roots: vec![dir.path().canonicalize().unwrap()],
            records: vec![rec.clone()],
            delete_paths: vec![rec.path.clone()],
            keep_paths: vec![],
            mode: DeleteMode::Trash,
            confirm: false,
        };
        let (report, _) = safe_delete(&req, &backend);
        assert!(report.refused);
        assert_eq!(
            report.refuse_reason.as_deref(),
            Some("trash_requires_confirm")
        );
        assert!(f.exists());
    }

    #[test]
    fn t10_permanent_without_confirm_refused() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("f.txt");
        fs::write(&f, b"x").unwrap();
        let rec = record_for(&f);
        let backend = QuarantineBackend {
            dir: dir.path().join("q"),
        };
        let req = DeleteRequest {
            roots: vec![dir.path().canonicalize().unwrap()],
            records: vec![rec.clone()],
            delete_paths: vec![rec.path.clone()],
            keep_paths: vec![],
            mode: DeleteMode::Permanent,
            confirm: false,
        };
        let (report, _) = safe_delete(&req, &backend);
        assert!(report.refused);
        assert!(f.exists());
    }

    #[test]
    fn fixtures_scan_then_dry_run_drop_me() {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../docker/fixtures/delete_safety")
            .canonicalize()
            .unwrap();
        let scan = scan_roots(&[fixtures.clone()]).unwrap();
        let drop = fixtures.join("drop_me.txt");
        let keep = fixtures.join("keep_me.txt");
        let req = DeleteRequest {
            roots: scan.roots.clone(),
            records: scan.records.clone(),
            delete_paths: vec![drop.canonicalize().unwrap()],
            keep_paths: vec![keep.canonicalize().unwrap()],
            mode: DeleteMode::DryRun,
            confirm: false,
        };
        let backend = QuarantineBackend {
            dir: fixtures.join(".q-should-not-create"),
        };
        let (report, _) = safe_delete(&req, &backend);
        assert_eq!(report.outcomes[0].kind, DeleteOutcomeKind::WouldDelete);
        assert!(drop.exists());
        assert!(keep.exists());
    }

    #[test]
    #[cfg(unix)]
    fn t4_symlink_swap_skips() {
        let dir = tempdir().unwrap();
        let original = dir.path().join("target.txt");
        let decoy = dir.path().join("other.txt");
        fs::write(&original, b"original-bytes").unwrap();
        fs::write(&decoy, b"different-bytes").unwrap();
        let rec = record_for(&original);
        fs::remove_file(&original).unwrap();
        std::os::unix::fs::symlink(&decoy, &original).unwrap();
        let backend = QuarantineBackend {
            dir: dir.path().join("q"),
        };
        let req = DeleteRequest {
            roots: vec![dir.path().canonicalize().unwrap()],
            records: vec![rec.clone()],
            delete_paths: vec![rec.path.clone()],
            keep_paths: vec![],
            mode: DeleteMode::Trash,
            confirm: true,
        };
        let (report, _) = safe_delete(&req, &backend);
        assert!(decoy.exists());
        assert_eq!(report.outcomes[0].kind, DeleteOutcomeKind::Skipped);
        assert!(
            report.outcomes[0].reason == "HASH_MISMATCH"
                || report.outcomes[0].reason == "SIZE_MISMATCH"
                || report.outcomes[0].reason == "INODE_MISMATCH"
        );
    }

    #[test]
    fn t7_mixed_batch_partial_success() {
        let dir = tempdir().unwrap();
        let good = dir.path().join("good.txt");
        let bad = dir.path().join("bad.txt");
        fs::write(&good, b"ok").unwrap();
        fs::write(&bad, b"v1").unwrap();
        let good_r = record_for(&good);
        let bad_r = record_for(&bad);
        fs::write(&bad, b"changed").unwrap();
        let backend = QuarantineBackend {
            dir: dir.path().join("q"),
        };
        let req = DeleteRequest {
            roots: vec![dir.path().canonicalize().unwrap()],
            records: vec![good_r.clone(), bad_r.clone()],
            delete_paths: vec![good_r.path.clone(), bad_r.path.clone()],
            keep_paths: vec![],
            mode: DeleteMode::Trash,
            confirm: true,
        };
        let (report, _) = safe_delete(&req, &backend);
        assert_eq!(report.outcomes.len(), 2);
        let good_out = report
            .outcomes
            .iter()
            .find(|o| o.path.ends_with("good.txt"))
            .unwrap();
        let bad_out = report
            .outcomes
            .iter()
            .find(|o| o.path.ends_with("bad.txt"))
            .unwrap();
        assert_eq!(good_out.kind, DeleteOutcomeKind::Deleted);
        assert_eq!(bad_out.kind, DeleteOutcomeKind::Skipped);
        assert!(!good.exists());
        assert!(bad.exists());
    }

    #[test]
    fn fs_backend_trash_removes_original_os_or_quarantine() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("gone.txt");
        fs::write(&f, b"bye-bytes").unwrap();
        let rec = record_for(&f);
        let req = DeleteRequest {
            roots: vec![dir.path().canonicalize().unwrap()],
            records: vec![rec.clone()],
            delete_paths: vec![rec.path.clone()],
            keep_paths: vec![],
            mode: DeleteMode::Trash,
            confirm: true,
        };
        let (report, _) = safe_delete(&req, &FsDeleteBackend);
        assert_eq!(report.outcomes.len(), 1);
        assert_eq!(report.outcomes[0].kind, DeleteOutcomeKind::Deleted);
        assert!(!f.exists(), "original must be gone (OS trash or quarantine)");
        // Headless fallback leaves a quarantine dir; OS trash may not.
        let q = dir.path().join(".dup-finder-trash");
        if q.is_dir() {
            assert!(
                q.read_dir().unwrap().next().is_some(),
                "quarantine fallback should contain the file"
            );
        }
    }
}
