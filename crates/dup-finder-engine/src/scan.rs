use crate::error::EngineError;
use crate::filters::{path_under_or_eq, ScanFilters};
use crate::hash::{blake3_file, partial_fingerprint};
use crate::index::ScanIndex;
use crate::mime::sniff_mime;
use crate::model::{DuplicateGroup, FileRecord, ScanResult, SkipEvent};
use crate::path_safe::realpath;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use walkdir::WalkDir;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScanPhase {
    Walk,
    Hash,
    Done,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScanProgress {
    pub phase: ScanPhase,
    pub files_seen: usize,
    pub files_hashed: usize,
    pub bytes_hashed: u64,
}

pub type ProgressCallback = Arc<dyn Fn(ScanProgress) + Send + Sync>;

#[derive(Clone)]
pub struct ScanOptions {
    pub roots: Vec<PathBuf>,
    /// Optional SQLite cache for resumable / incremental hashing.
    pub index_path: Option<PathBuf>,
    pub filters: ScanFilters,
    pub on_progress: Option<ProgressCallback>,
    /// When set and true, scan stops and returns `EngineError::Message("cancelled")`.
    pub cancel_flag: Option<Arc<AtomicBool>>,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            roots: Vec::new(),
            index_path: None,
            filters: ScanFilters::sensible_defaults(),
            on_progress: None,
            cancel_flag: None,
        }
    }
}

// Manual Debug — callbacks are not Debug.
impl std::fmt::Debug for ScanOptions {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ScanOptions")
            .field("roots", &self.roots)
            .field("index_path", &self.index_path)
            .field("filters", &self.filters)
            .field("on_progress", &self.on_progress.as_ref().map(|_| "Some(..)"))
            .field(
                "cancel_flag",
                &self.cancel_flag.as_ref().map(|f| f.load(Ordering::Relaxed)),
            )
            .finish()
    }
}

fn is_cancelled(flag: &Option<Arc<AtomicBool>>) -> bool {
    flag.as_ref()
        .map(|f| f.load(Ordering::Relaxed))
        .unwrap_or(false)
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
        filters: ScanFilters::empty(),
        on_progress: None,
        cancel_flag: None,
    })
    .map(|(r, _)| r)
}

fn emit(cb: &Option<ProgressCallback>, progress: ScanProgress) {
    if let Some(f) = cb {
        f(progress);
    }
}

pub fn scan_with_options(opts: ScanOptions) -> Result<(ScanResult, ScanStats), EngineError> {
    let filters = opts.filters;
    let on_progress = opts.on_progress.clone();
    let cancel_flag = opts.cancel_flag.clone();
    let mut canonical_roots = Vec::new();
    for r in &opts.roots {
        canonical_roots.push(realpath(r)?);
    }

    let mut exclude_prefixes = Vec::new();
    for p in &filters.exclude_paths {
        match realpath(p) {
            Ok(c) => {
                if !canonical_roots.iter().any(|root| path_under_or_eq(&c, root)) {
                    return Err(EngineError::Message(format!(
                        "exclude path not under a scan root: {}",
                        p.display()
                    )));
                }
                exclude_prefixes.push(c);
            }
            Err(_) => {}
        }
    }

    let index_path = opts
        .index_path
        .as_ref()
        .and_then(|p| realpath(p).ok().or_else(|| Some(p.clone())));
    let index = match &opts.index_path {
        Some(p) => Some(Mutex::new(ScanIndex::open(p)?)),
        None => None,
    };

    let mut skip_reasons = Vec::new();
    let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();
    let mut meta_by_path: HashMap<PathBuf, fs::Metadata> = HashMap::new();
    let mut files_scanned = 0usize;

    emit(
        &on_progress,
        ScanProgress {
            phase: ScanPhase::Walk,
            files_seen: 0,
            files_hashed: 0,
            bytes_hashed: 0,
        },
    );

    for root in &canonical_roots {
        let mut walker = WalkDir::new(root).follow_links(false);
        if let Some(d) = filters.max_depth {
            walker = walker.max_depth(d);
        }
        for entry in walker.into_iter().filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            if e.file_type().is_dir() {
                !filters.should_skip_dir_entry(e.path(), &exclude_prefixes)
            } else {
                true
            }
        }) {
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
            if is_cancelled(&cancel_flag) {
                return Err(EngineError::Message("cancelled".into()));
            }
            let path = entry.path().to_path_buf();
            if is_index_sidecar(&path, index_path.as_deref()) {
                continue;
            }
            if exclude_prefixes.iter().any(|ex| path_under_or_eq(&path, ex)) {
                skip_reasons.push(SkipEvent {
                    path: path.clone(),
                    reason: "filtered:exclude_path".into(),
                });
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
            let size = meta.len();
            if let Err(reason) = filters.file_allowed(&path, size) {
                skip_reasons.push(SkipEvent {
                    path: path.clone(),
                    reason: reason.into(),
                });
                continue;
            }
            files_scanned += 1;
            if files_scanned % 250 == 0 {
                emit(
                    &on_progress,
                    ScanProgress {
                        phase: ScanPhase::Walk,
                        files_seen: files_scanned,
                        files_hashed: 0,
                        bytes_hashed: 0,
                    },
                );
            }
            by_size.entry(size).or_default().push(path.clone());
            meta_by_path.insert(path, meta);
        }
    }

    emit(
        &on_progress,
        ScanProgress {
            phase: ScanPhase::Hash,
            files_seen: files_scanned,
            files_hashed: 0,
            bytes_hashed: 0,
        },
    );

    let skip_mu = Mutex::new(skip_reasons);
    let files_hashed = AtomicUsize::new(0);
    let bytes_hashed = AtomicU64::new(0);
    let computed = AtomicUsize::new(0);
    let reused = AtomicUsize::new(0);

    // Collect (size, paths) buckets that need hashing.
    let size_buckets: Vec<(u64, Vec<PathBuf>)> = by_size
        .into_iter()
        .filter(|(_, paths)| paths.len() >= 2)
        .collect();

    let all_records: Mutex<HashMap<PathBuf, FileRecord>> = Mutex::new(HashMap::new());

    size_buckets.par_iter().for_each(|(size, paths)| {
        if is_cancelled(&cancel_flag) {
            return;
        }
        let partial_results: Vec<(PathBuf, Result<String, String>)> = paths
            .par_iter()
            .map(|path| {
                if is_cancelled(&cancel_flag) {
                    return (path.clone(), Err("cancelled".into()));
                }
                (
                    path.clone(),
                    partial_fingerprint(path, *size).map_err(|e| e.to_string()),
                )
            })
            .collect();

        let mut partial_buckets: HashMap<String, Vec<PathBuf>> = HashMap::new();
        for (path, res) in partial_results {
            match res {
                Ok(fp) => partial_buckets.entry(fp).or_default().push(path),
                Err(e) => {
                    if let Ok(mut g) = skip_mu.lock() {
                        g.push(SkipEvent {
                            path,
                            reason: format!("partial_hash:{e}"),
                        });
                    }
                }
            }
        }

        for (_fp, candidates) in partial_buckets {
            if candidates.len() < 2 {
                continue;
            }
            let full: Vec<(PathBuf, Result<FileRecord, String>)> = candidates
                .par_iter()
                .map(|path| {
                    let Some(meta) = meta_by_path.get(path) else {
                        return (path.clone(), Err("missing_meta".into()));
                    };
                    let mut local_stats = ScanStats::default();
                    let idx_guard = index.as_ref().and_then(|m| m.lock().ok());
                    let idx_ref = idx_guard.as_deref();
                    let res =
                        build_record_cached(path, *size, meta, idx_ref, &mut local_stats)
                            .map_err(|e| e.to_string());
                    if let Ok(ref rec) = res {
                        if let Some(ref g) = idx_guard {
                            let _ = g.upsert(rec);
                        }
                        computed.fetch_add(local_stats.hashes_computed, Ordering::Relaxed);
                        reused.fetch_add(local_stats.hashes_reused, Ordering::Relaxed);
                        files_hashed.fetch_add(1, Ordering::Relaxed);
                        bytes_hashed.fetch_add(*size, Ordering::Relaxed);
                        let n = files_hashed.load(Ordering::Relaxed);
                        if n % 50 == 0 {
                            emit(
                                &on_progress,
                                ScanProgress {
                                    phase: ScanPhase::Hash,
                                    files_seen: files_scanned,
                                    files_hashed: n,
                                    bytes_hashed: bytes_hashed.load(Ordering::Relaxed),
                                },
                            );
                        }
                    }
                    (path.clone(), res)
                })
                .collect();

            for (path, res) in full {
                match res {
                    Ok(rec) => {
                        if let Ok(mut map) = all_records.lock() {
                            map.insert(path, rec);
                        }
                    }
                    Err(e) => {
                        if e != "missing_meta" {
                            if let Ok(mut g) = skip_mu.lock() {
                                g.push(SkipEvent {
                                    path,
                                    reason: format!("hash:{e}"),
                                });
                            }
                        }
                    }
                }
            }
        }
    });

    if is_cancelled(&cancel_flag) {
        return Err(EngineError::Message("cancelled".into()));
    }

    let skip_reasons = skip_mu.into_inner().unwrap_or_default();
    let all_records = all_records.into_inner().unwrap_or_default();
    let stats = ScanStats {
        hashes_computed: computed.load(Ordering::Relaxed),
        hashes_reused: reused.load(Ordering::Relaxed),
    };

    emit(
        &on_progress,
        ScanProgress {
            phase: ScanPhase::Done,
            files_seen: files_scanned,
            files_hashed: files_hashed.load(Ordering::Relaxed),
            bytes_hashed: bytes_hashed.load(Ordering::Relaxed),
        },
    );

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
    use crate::filters::FileCategory;
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
        // Same size so the hash stage runs (unique sizes never open content).
        fs::write(&ok, b"same-len").unwrap();
        fs::write(&bad, b"same-len").unwrap();
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
        // Pairs share size+content so they enter the full-hash stage (unique sizes skip hashing).
        for i in 0..25 {
            let body = format!("payload-{i}-xxxxx");
            fs::write(dir.path().join(format!("a{i}.bin")), &body).unwrap();
            fs::write(dir.path().join(format!("b{i}.bin")), &body).unwrap();
        }
        let index = idx_dir.path().join("cache.sqlite");
        let opts = ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: Some(index.clone()),
            filters: ScanFilters::empty(),
                    on_progress: None,
                    cancel_flag: None,
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
        let other = dir.path().join("y.txt");
        // Identical twins so they stay in the full-hash stage after edits (same size).
        fs::write(&f, b"v1xxxxxx").unwrap();
        fs::write(&other, b"v1xxxxxx").unwrap();
        let index = idx_dir.path().join("cache.sqlite");
        let opts = ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: Some(index),
            filters: ScanFilters::empty(),
                    on_progress: None,
                    cancel_flag: None,
        };
        let (r1, _) = scan_with_options(opts.clone()).unwrap();
        let h1 = r1
            .records
            .iter()
            .find(|r| r.path.ends_with("x.txt"))
            .unwrap()
            .hash
            .clone();
        std::thread::sleep(std::time::Duration::from_millis(1100));
        fs::write(&f, b"v2xxxxxx").unwrap();
        fs::write(&other, b"v2xxxxxx").unwrap();
        let (r2, s2) = scan_with_options(opts).unwrap();
        assert!(
            s2.hashes_computed >= 1,
            "expected rehash after content change; computed={} reused={}",
            s2.hashes_computed,
            s2.hashes_reused
        );
        let h2 = r2
            .records
            .iter()
            .find(|r| r.path.ends_with("x.txt"))
            .unwrap()
            .hash
            .clone();
        assert_ne!(h2, h1);
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
            filters: ScanFilters::empty(),
                    on_progress: None,
                    cancel_flag: None,
        };
        let (r1, s1) = scan_with_options(opts.clone()).unwrap();
        assert_eq!(r1.files_scanned, 10_000);
        assert_eq!(r1.groups.len(), 1000);
        // Unique-size files skip full BLAKE3; only the 2000 dup-pair members are hashed.
        assert_eq!(s1.hashes_computed, 2_000);

        let (r2, s2) = scan_with_options(opts).unwrap();
        assert_eq!(r2.groups.len(), 1000);
        assert_eq!(s2.hashes_reused, 2_000);
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
            filters: ScanFilters::empty(),
                    on_progress: None,
                    cancel_flag: None,
        };
        let (r1, s1) = scan_with_options(opts.clone()).unwrap();
        assert_eq!(r1.files_scanned, 100_000);
        assert_eq!(r1.groups.len(), 1);
        assert_eq!(s1.hashes_computed, 100_000);

        let (_r2, s2) = scan_with_options(opts).unwrap();
        assert_eq!(s2.hashes_reused, 100_000);
        assert_eq!(s2.hashes_computed, 0);
    }

    #[test]
    fn filter_category_photos_only() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.jpg"), b"img-aaaa").unwrap();
        fs::write(dir.path().join("b.jpg"), b"img-aaaa").unwrap();
        fs::write(dir.path().join("c.txt"), b"img-aaaa").unwrap();
        fs::write(dir.path().join("d.txt"), b"img-aaaa").unwrap();
        let mut filters = ScanFilters::empty();
        filters.categories = vec![FileCategory::Photos];
        let (r, _) = scan_with_options(ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: None,
            filters,
                    on_progress: None,
                    cancel_flag: None,
        })
        .unwrap();
        assert_eq!(r.files_scanned, 2);
        assert_eq!(r.groups.len(), 1);
        assert!(r.skip_reasons.iter().any(|s| s.reason == "filtered:category"));
    }

    #[test]
    fn filter_min_size_skips_small() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.bin"), b"tiny").unwrap();
        fs::write(dir.path().join("b.bin"), b"tiny").unwrap();
        fs::write(dir.path().join("c.bin"), vec![0u8; 100]).unwrap();
        fs::write(dir.path().join("d.bin"), vec![0u8; 100]).unwrap();
        let mut filters = ScanFilters::empty();
        filters.min_size = Some(50);
        let (r, _) = scan_with_options(ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: None,
            filters,
                    on_progress: None,
                    cancel_flag: None,
        })
        .unwrap();
        assert_eq!(r.files_scanned, 2);
        assert!(r.skip_reasons.iter().any(|s| s.reason == "filtered:size"));
    }

    #[test]
    fn filter_exclude_name_skips_node_modules() {
        let dir = tempdir().unwrap();
        let nm = dir.path().join("node_modules");
        fs::create_dir_all(&nm).unwrap();
        fs::write(nm.join("a.js"), b"dupxxxx").unwrap();
        fs::write(nm.join("b.js"), b"dupxxxx").unwrap();
        fs::write(dir.path().join("keep.js"), b"dupxxxx").unwrap();
        fs::write(dir.path().join("keep2.js"), b"dupxxxx").unwrap();
        let mut filters = ScanFilters::empty();
        filters.exclude_names = vec!["node_modules".into()];
        let (r, _) = scan_with_options(ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: None,
            filters,
                    on_progress: None,
                    cancel_flag: None,
        })
        .unwrap();
        assert_eq!(r.files_scanned, 2);
        assert!(!r.records.iter().any(|rec| rec.path.to_string_lossy().contains("node_modules")));
    }

    #[test]
    fn filter_max_depth() {
        let dir = tempdir().unwrap();
        let deep = dir.path().join("sub");
        fs::create_dir_all(&deep).unwrap();
        fs::write(dir.path().join("top-a.txt"), b"samebody").unwrap();
        fs::write(dir.path().join("top-b.txt"), b"samebody").unwrap();
        fs::write(deep.join("deep-a.txt"), b"samebody").unwrap();
        fs::write(deep.join("deep-b.txt"), b"samebody").unwrap();
        let mut filters = ScanFilters::empty();
        filters.max_depth = Some(1); // root files only (depth 0 = root dir, depth 1 = files in root)
        let (r, _) = scan_with_options(ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: None,
            filters,
                    on_progress: None,
                    cancel_flag: None,
        })
        .unwrap();
        assert_eq!(r.files_scanned, 2);
        assert!(!r.records.iter().any(|rec| rec.path.to_string_lossy().contains("deep-")));
    }

    #[test]
    fn filter_hidden_off_skips_dotfiles() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("vis-a.txt"), b"hiddenxx").unwrap();
        fs::write(dir.path().join("vis-b.txt"), b"hiddenxx").unwrap();
        fs::write(dir.path().join(".secret-a"), b"hiddenxx").unwrap();
        fs::write(dir.path().join(".secret-b"), b"hiddenxx").unwrap();
        let mut filters = ScanFilters::empty();
        filters.include_hidden = false;
        let (r, _) = scan_with_options(ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: None,
            filters,
                    on_progress: None,
                    cancel_flag: None,
        })
        .unwrap();
        assert_eq!(r.files_scanned, 2);
        assert!(r.skip_reasons.iter().any(|s| s.reason == "filtered:hidden"));
    }

    #[test]
    fn filter_exclude_path_under_root() {
        let dir = tempdir().unwrap();
        let skip = dir.path().join("skipme");
        fs::create_dir_all(&skip).unwrap();
        fs::write(skip.join("a.txt"), b"expathxx").unwrap();
        fs::write(skip.join("b.txt"), b"expathxx").unwrap();
        fs::write(dir.path().join("ok-a.txt"), b"expathxx").unwrap();
        fs::write(dir.path().join("ok-b.txt"), b"expathxx").unwrap();
        let mut filters = ScanFilters::empty();
        filters.exclude_paths = vec![skip];
        let (r, _) = scan_with_options(ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: None,
            filters,
            on_progress: None,
            cancel_flag: None,
        })
        .unwrap();
        assert_eq!(r.files_scanned, 2);
    }

    #[test]
    fn cancel_flag_stops_scan() {
        let dir = tempdir().unwrap();
        for i in 0..200 {
            fs::write(dir.path().join(format!("f{i}.txt")), format!("body-{i}")).unwrap();
        }
        let flag = Arc::new(AtomicBool::new(true));
        let err = scan_with_options(ScanOptions {
            roots: vec![dir.path().to_path_buf()],
            index_path: None,
            filters: ScanFilters::empty(),
            on_progress: None,
            cancel_flag: Some(flag),
        })
        .unwrap_err();
        assert!(err.to_string().contains("cancelled"), "{err}");
    }
}
