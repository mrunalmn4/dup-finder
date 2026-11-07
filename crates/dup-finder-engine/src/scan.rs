use crate::error::EngineError;
use crate::hash::{blake3_file, partial_fingerprint};
use crate::index::ScanIndex;
use crate::mime::sniff_mime;
use crate::model::{DuplicateGroup, FileRecord, ScanResult, SkipEvent};
use crate::path_safe::realpath;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Default)]
pub struct ScanOptions {
    pub roots: Vec<PathBuf>,
    /// Optional SQLite cache for resumable / incremental hashing.
    pub index_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ScanStats {
    pub hashes_computed: usize,
    pub hashes_reused: usize,
}

#[cfg(unix)]
fn device_inode(meta: &fs::Metadata) -> (Option<u64>, Option<u64>) {
    use std::os::unix::fs::MetadataExt;
    (Some(meta.dev()), Some(meta.ino()))
}

#[cfg(not(unix))]
fn device_inode(_meta: &fs::Metadata) -> (Option<u64>, Option<u64>) {
    (None, None)
}

fn mtime_secs(meta: &fs::Metadata) -> Option<i64> {
    meta.modified().ok().and_then(|t| {
        t.duration_since(std::time::UNIX_EPOCH)
            .ok()
            .map(|d| d.as_secs() as i64)
    })
}

/// Scan roots and return duplicate groups (2+ files sharing full content hash).
pub fn scan_roots(roots: &[PathBuf]) -> Result<ScanResult, EngineError> {
    scan_with_options(ScanOptions {
        roots: roots.to_vec(),
        index_path: None,
    })
    .map(|(r, _)| r)
}

pub fn scan_with_options(opts: ScanOptions) -> Result<(ScanResult, ScanStats), EngineError> {
    let mut canonical_roots = Vec::new();
    for r in &opts.roots {
        canonical_roots.push(realpath(r)?);
    }

    let index_path = opts
        .index_path
        .as_ref()
        .and_then(|p| realpath(p).ok().or_else(|| Some(p.clone())));
    let index = match &opts.index_path {
        Some(p) => Some(ScanIndex::open(p)?),
        None => None,
    };
    let mut stats = ScanStats::default();

    let mut skip_reasons = Vec::new();
    let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();
    let mut files_scanned = 0usize;
    let mut pending: Vec<(PathBuf, u64, fs::Metadata)> = Vec::new();

    for root in &canonical_roots {
        for entry in WalkDir::new(root)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| !should_skip_dir(e.path()))
        {
            let entry = match entry {
                Ok(e) => e,
                Err(err) => {
                    skip_reasons.push(SkipEvent {
                        path: err
                            .path()
                            .map(|p| p.to_path_buf())
                            .unwrap_or_else(|| root.clone()),
                        reason: format!("walk_error:{err}"),
                    });
                    continue;
                }
            };
            if !entry.file_type().is_file() {
                continue;
            }
            let path = entry.path().to_path_buf();
            if is_index_sidecar(&path, index_path.as_deref()) {
                continue;
            }
            let meta = match fs::metadata(&path) {
                Ok(m) => m,
                Err(e) => {
                    skip_reasons.push(SkipEvent {
                        path: path.clone(),
                        reason: format!("stat:{e}"),
                    });
                    continue;
                }
            };
            files_scanned += 1;
            let size = meta.len();
            by_size.entry(size).or_default().push(path.clone());
            pending.push((path, size, meta));
        }
    }

    let mut all_records: HashMap<PathBuf, FileRecord> = HashMap::new();
    for (path, size, meta) in &pending {
        match build_record_cached(path, *size, meta, index.as_ref(), &mut stats) {
            Ok(rec) => {
                if let Some(idx) = index.as_ref() {
                    let _ = idx.upsert(&rec);
                }
                all_records.insert(path.clone(), rec);
            }
            Err(e) => skip_reasons.push(SkipEvent {
                path: path.clone(),
                reason: format!("index:{e}"),
            }),
        }
    }

    // Partial fingerprints retained for future candidate pruning hooks.
    let mut partial_buckets: HashMap<(u64, String), Vec<PathBuf>> = HashMap::new();
    for (size, paths) in &by_size {
        if paths.len() < 2 {
            continue;
        }
        for path in paths {
            match partial_fingerprint(path, *size) {
                Ok(fp) => partial_buckets
                    .entry((*size, fp))
                    .or_default()
                    .push(path.clone()),
                Err(e) => skip_reasons.push(SkipEvent {
                    path: path.clone(),
                    reason: format!("partial_hash:{e}"),
                }),
            }
        }
    }
    let _ = partial_buckets;

    let records: Vec<FileRecord> = all_records.values().cloned().collect();
    let mut grouped: HashMap<String, Vec<FileRecord>> = HashMap::new();
    for rec in &records {
        grouped.entry(rec.hash.clone()).or_default().push(rec.clone());
    }

    let mut groups: Vec<DuplicateGroup> = Vec::new();
    for (hash, files) in grouped {
        if files.len() >= 2 {
            let size = files[0].size;
            groups.push(DuplicateGroup { hash, size, files });
        }
    }
    groups.sort_by(|a, b| b.size.cmp(&a.size).then(a.hash.cmp(&b.hash)));

    Ok((
        ScanResult {
            roots: canonical_roots,
            files_scanned,
            files_skipped: skip_reasons.len(),
            groups,
            records,
            skip_reasons,
        },
        stats,
    ))
}

fn should_skip_dir(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|n| n == ".dup-finder-trash" || n == ".dup-finder-index")
}

fn is_index_sidecar(path: &Path, index: Option<&Path>) -> bool {
    let Some(index) = index else {
        return false;
    };
    if path == index {
        return true;
    }
    // SQLite WAL/SHM companions
    let p = path.to_string_lossy();
    let i = index.to_string_lossy();
    p == format!("{i}-wal") || p == format!("{i}-shm") || p == format!("{i}-journal")
}

fn build_record_cached(
    path: &Path,
    size: u64,
    meta: &fs::Metadata,
    index: Option<&ScanIndex>,
    stats: &mut ScanStats,
) -> Result<FileRecord, EngineError> {
    let (device, inode) = device_inode(meta);
    let mtime = mtime_secs(meta);

    if let Some(idx) = index {
        if let Some(cached) = idx.lookup_fresh(path, size, mtime, device, inode)? {
            stats.hashes_reused += 1;
            return Ok(cached);
        }
    }

    let hash = blake3_file(path)?;
    let mime = sniff_mime(path);
    stats.hashes_computed += 1;
    Ok(FileRecord {
        path: path.to_path_buf(),
        size,
        hash,
        mime,
        mtime_secs: mtime,
        device,
        inode,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn fixtures_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../docker/fixtures")
            .canonicalize()
            .expect("fixtures present")
    }

    #[test]
    fn identical_and_extension_spoof_group() {
        let root = fixtures_root();
        let result = scan_roots(&[root.clone()]).unwrap();
        assert!(!result.groups.is_empty());

        let group = result
            .groups
            .iter()
            .find(|g| g.files.iter().any(|f| f.path.ends_with("report.txt")))
            .expect("identical group");

        assert!(group
            .files
            .iter()
            .any(|f| f.path.ends_with("report_backup.txt")));
        assert!(
            group.files.iter().any(|f| f.path.ends_with("photo.jpg"))
                || result.groups.iter().any(|g| {
                    g.files.iter().any(|f| f.path.ends_with("photo.jpg"))
                        && g.files.iter().any(|f| f.path.ends_with("photo.bin"))
                })
        );

        assert!(result
            .groups
            .iter()
            .all(|g| !g.files.iter().any(|f| f.path.ends_with("only_once.dat"))));
        assert!(fs::metadata(root.join("unique/only_once.dat")).is_ok());
        assert!(result.reclaimable_bytes() > 0);
    }

    #[test]
    #[cfg(unix)]
    fn unreadable_file_skipped_scan_completes() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempdir().unwrap();
        let ok = dir.path().join("ok.txt");
        let bad = dir.path().join("bad.txt");
        fs::write(&ok, b"readable").unwrap();
        fs::write(&bad, b"secret").unwrap();
        let mut perms = fs::metadata(&bad).unwrap().permissions();
        perms.set_mode(0o000);
        fs::set_permissions(&bad, perms).unwrap();

        let blocked = fs::read(&bad).is_err();
        let result = scan_roots(&[dir.path().to_path_buf()]);

        let mut perms = fs::metadata(&bad).unwrap().permissions();
        perms.set_mode(0o644);
        fs::set_permissions(&bad, perms).unwrap();

        let result = result.expect("scan should not abort");
        assert!(result.files_scanned >= 1);
        if blocked {
            assert!(
                result
                    .skip_reasons
                    .iter()
                    .any(|s| s.path.ends_with("bad.txt")),
                "unreadable file must be reported in skip_reasons"
            );
            assert!(!result.records.iter().any(|r| r.path.ends_with("bad.txt")));
        }
    }

    #[test]
    fn scale_a_thousand_files_with_dups() {
        let dir = tempdir().unwrap();
        for i in 0..500 {
            fs::write(dir.path().join(format!("u{i}.txt")), format!("unique-{i}")).unwrap();
        }
        for i in 0..250 {
            let body = format!("dup-body-{i}");
            fs::write(dir.path().join(format!("a{i}.txt")), &body).unwrap();
            fs::write(dir.path().join(format!("b{i}.txt")), &body).unwrap();
        }
        let result = scan_roots(&[dir.path().to_path_buf()]).unwrap();
        assert_eq!(result.files_scanned, 1000);
        assert_eq!(result.groups.len(), 250);
        assert!(result.reclaimable_bytes() > 0);
    }

    #[test]
    fn resumable_index_reuses_hashes() {
        let dir = tempdir().unwrap();
        let idx_dir = tempdir().unwrap();
        for i in 0..50 {
            fs::write(dir.path().join(format!("f{i}.bin")), format!("payload-{i}-xxxxx")).unwrap();
        }
        let index = idx_dir.path().join("cache.sqlite");
        let opts = ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: Some(index.clone()),
        };
        let (_r1, s1) = scan_with_options(opts.clone()).unwrap();
        assert_eq!(s1.hashes_computed, 50);
        assert_eq!(s1.hashes_reused, 0);

        let (_r2, s2) = scan_with_options(opts).unwrap();
        assert_eq!(s2.hashes_reused, 50);
        assert_eq!(s2.hashes_computed, 0);
        assert!(index.exists());
    }

    #[test]
    fn index_invalidates_on_content_change() {
        let dir = tempdir().unwrap();
        let idx_dir = tempdir().unwrap();
        let f = dir.path().join("x.txt");
        fs::write(&f, b"v1").unwrap();
        let index = idx_dir.path().join("cache.sqlite");
        let opts = ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: Some(index),
        };
        let (r1, _) = scan_with_options(opts.clone()).unwrap();
        let h1 = r1.records[0].hash.clone();
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(&f, b"v2-changed").unwrap();
        let (r2, s2) = scan_with_options(opts).unwrap();
        assert_eq!(s2.hashes_computed, 1);
        assert_ne!(r2.records[0].hash, h1);
    }

    #[test]
    fn scale_b_ten_thousand_files() {
        let dir = tempdir().unwrap();
        let idx_dir = tempdir().unwrap();
        for i in 0..8000 {
            fs::write(dir.path().join(format!("u{i}.txt")), format!("unique-{i}")).unwrap();
        }
        for i in 0..1000 {
            let body = format!("dup-{i}");
            fs::write(dir.path().join(format!("a{i}.txt")), &body).unwrap();
            fs::write(dir.path().join(format!("b{i}.txt")), &body).unwrap();
        }
        let index = idx_dir.path().join("b.sqlite");
        let opts = ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: Some(index),
        };
        let (r1, s1) = scan_with_options(opts.clone()).unwrap();
        assert_eq!(r1.files_scanned, 10_000);
        assert_eq!(r1.groups.len(), 1000);
        assert_eq!(s1.hashes_computed, 10_000);

        let (r2, s2) = scan_with_options(opts).unwrap();
        assert_eq!(r2.groups.len(), 1000);
        assert_eq!(s2.hashes_reused, 10_000);
        assert_eq!(s2.hashes_computed, 0);
    }

    #[test]
    fn scale_c_smoke_hundred_thousand_meta_with_resume() {
        let dir = tempdir().unwrap();
        let idx_dir = tempdir().unwrap();
        // 100k tiny files — walk+index resume at large cardinality without multi-hour CI.
        for i in 0..100_000 {
            fs::write(dir.path().join(format!("{i}.t")), b"x").unwrap();
        }
        let index = idx_dir.path().join("c.sqlite");
        let opts = ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: Some(index),
        };
        let (r1, s1) = scan_with_options(opts.clone()).unwrap();
        assert_eq!(r1.files_scanned, 100_000);
        assert_eq!(r1.groups.len(), 1);
        assert_eq!(s1.hashes_computed, 100_000);

        let (_r2, s2) = scan_with_options(opts).unwrap();
        assert_eq!(s2.hashes_reused, 100_000);
        assert_eq!(s2.hashes_computed, 0);
    }
}
