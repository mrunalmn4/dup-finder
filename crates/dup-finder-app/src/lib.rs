pub mod jobs;

pub use jobs::{CreateJobRequest, JobStatus, JobStore, ScheduledJob};

use dup_finder_engine::{
    find_similar_images, list_quarantine, restore_quarantined, safe_delete, scan_with_options,
    suggest_from_scan, verify_paths_against_hash, DeleteMode, DeleteReport, DeleteRequest,
    FsDeleteBackend, QuarantinedFile, ScanFilters, ScanOptions, ScanPhase, ScanProgress,
    ScanResult, ScanStats, SimilarImageGroup, SuggestReport, VerifyReport,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResponse {
    pub scan_id: String,
    pub stats: ScanStats,
    pub result: ScanResult,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ScanRequest {
    pub roots: Vec<PathBuf>,
    pub index_path: Option<PathBuf>,
    #[serde(default)]
    pub filters: ScanFilters,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct DeleteRequestDto {
    pub scan_id: String,
    pub paths: Vec<PathBuf>,
    #[serde(default)]
    pub keep: Vec<PathBuf>,
    pub mode: String,
    #[serde(default)]
    pub confirm: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ScanJobStatus {
    Running,
    Ok,
    Error,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanJobState {
    pub job_id: String,
    pub status: ScanJobStatus,
    pub progress: ScanProgress,
    pub scan_id: Option<String>,
    pub error: Option<String>,
    pub stats: Option<ScanStats>,
}

#[derive(Default)]
pub struct AppSession {
    scans: Mutex<HashMap<String, ScanResult>>,
    scan_jobs: Mutex<HashMap<String, ScanJobState>>,
    scan_cancel: Mutex<HashMap<String, Arc<std::sync::atomic::AtomicBool>>>,
    /// Roots from the most recent completed scan (for preview allowlist).
    last_roots: Mutex<Vec<PathBuf>>,
}

impl AppSession {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn scan(&self, req: ScanRequest) -> Result<ScanResponse, String> {
        if req.roots.is_empty() {
            return Err("roots required".into());
        }
        let (result, stats) = scan_with_options(ScanOptions {
            roots: req.roots.clone(),
            index_path: req.index_path,
            filters: req.filters,
            on_progress: None,
            cancel_flag: None,
        })
        .map_err(|e| e.to_string())?;
        let scan_id = Uuid::new_v4().to_string();
        self.scans
            .lock()
            .map_err(|_| "lock poisoned".to_string())?
            .insert(scan_id.clone(), result.clone());
        *self
            .last_roots
            .lock()
            .map_err(|_| "lock poisoned".to_string())? = result.roots.clone();
        Ok(ScanResponse {
            scan_id,
            stats,
            result,
        })
    }

    /// Start a background scan; poll with `scan_job`.
    pub fn scan_start(self: &Arc<Self>, req: ScanRequest) -> Result<String, String> {
        if req.roots.is_empty() {
            return Err("roots required".into());
        }
        let job_id = Uuid::new_v4().to_string();
        let state = ScanJobState {
            job_id: job_id.clone(),
            status: ScanJobStatus::Running,
            progress: ScanProgress {
                phase: ScanPhase::Walk,
                files_seen: 0,
                files_hashed: 0,
                bytes_hashed: 0,
            },
            scan_id: None,
            error: None,
            stats: None,
        };
        self.scan_jobs
            .lock()
            .map_err(|_| "lock poisoned".to_string())?
            .insert(job_id.clone(), state);

        let cancel = Arc::new(std::sync::atomic::AtomicBool::new(false));
        self.scan_cancel
            .lock()
            .map_err(|_| "lock poisoned".to_string())?
            .insert(job_id.clone(), Arc::clone(&cancel));

        let session = Arc::clone(self);
        let jid = job_id.clone();
        thread::spawn(move || {
            let progress_jobs = Arc::clone(&session);
            let progress_id = jid.clone();
            let on_progress: dup_finder_engine::ProgressCallback = Arc::new(move |p| {
                if let Ok(mut map) = progress_jobs.scan_jobs.lock() {
                    if let Some(st) = map.get_mut(&progress_id) {
                        st.progress = p;
                    }
                }
            });
            let result = scan_with_options(ScanOptions {
                roots: req.roots.clone(),
                index_path: req.index_path.clone(),
                filters: req.filters.clone(),
                on_progress: Some(on_progress),
                cancel_flag: Some(cancel),
            });
            let mut map = match session.scan_jobs.lock() {
                Ok(m) => m,
                Err(_) => return,
            };
            let Some(st) = map.get_mut(&jid) else {
                return;
            };
            match result {
                Ok((scan_result, stats)) => {
                    let scan_id = Uuid::new_v4().to_string();
                    if let Ok(mut scans) = session.scans.lock() {
                        scans.insert(scan_id.clone(), scan_result.clone());
                    }
                    if let Ok(mut roots) = session.last_roots.lock() {
                        *roots = scan_result.roots.clone();
                    }
                    st.status = ScanJobStatus::Ok;
                    st.scan_id = Some(scan_id);
                    st.stats = Some(stats);
                    st.progress.phase = ScanPhase::Done;
                }
                Err(e) => {
                    let msg = e.to_string();
                    if msg.contains("cancelled") {
                        st.status = ScanJobStatus::Cancelled;
                        st.error = Some("cancelled".into());
                    } else {
                        st.status = ScanJobStatus::Error;
                        st.error = Some(msg);
                    }
                }
            }
            if let Ok(mut flags) = session.scan_cancel.lock() {
                flags.remove(&jid);
            }
        });
        Ok(job_id)
    }

    pub fn scan_cancel(&self, job_id: &str) -> Result<(), String> {
        let flag = self
            .scan_cancel
            .lock()
            .map_err(|_| "lock poisoned".to_string())?
            .get(job_id)
            .cloned()
            .ok_or_else(|| "scan job not running".to_string())?;
        flag.store(true, std::sync::atomic::Ordering::Relaxed);
        Ok(())
    }

    pub fn scan_job(&self, job_id: &str) -> Result<ScanJobState, String> {
        self.scan_jobs
            .lock()
            .map_err(|_| "lock poisoned".to_string())?
            .get(job_id)
            .cloned()
            .ok_or_else(|| "scan job not found".into())
    }

    pub fn get_scan(&self, scan_id: &str) -> Result<ScanResult, String> {
        self.scans
            .lock()
            .map_err(|_| "lock poisoned".to_string())?
            .get(scan_id)
            .cloned()
            .ok_or_else(|| "scan not found".into())
    }

    pub fn suggest(&self, scan_id: &str) -> Result<SuggestReport, String> {
        let scan = self.get_scan(scan_id)?;
        Ok(suggest_from_scan(&scan))
    }

    /// Live re-hash every path in a BLAKE3 group from the stored scan.
    pub fn verify_group(&self, scan_id: &str, hash: &str) -> Result<VerifyReport, String> {
        let scan = self.get_scan(scan_id)?;
        let group = scan
            .groups
            .iter()
            .find(|g| g.hash == hash)
            .ok_or_else(|| "group not found".to_string())?;
        let paths: Vec<PathBuf> = group.files.iter().map(|f| f.path.clone()).collect();
        verify_paths_against_hash(&paths, hash).map_err(|e| e.to_string())
    }

    /// Experimental: similar images among scan records (not exact BLAKE3 dups).
    pub fn similar_images(
        &self,
        scan_id: &str,
        threshold: u32,
    ) -> Result<Vec<SimilarImageGroup>, String> {
        let scan = self.get_scan(scan_id)?;
        let mut paths: Vec<PathBuf> = scan.records.iter().map(|r| r.path.clone()).collect();
        paths.sort();
        paths.dedup();
        find_similar_images(&paths, threshold).map_err(|e| e.to_string())
    }

    pub fn delete(&self, req: DeleteRequestDto) -> Result<DeleteReport, String> {
        let mode = parse_mode(&req.mode)?;
        let scan = self.get_scan(&req.scan_id)?;
        let keep_paths = if req.keep.is_empty() {
            suggest_from_scan(&scan)
                .groups
                .into_iter()
                .map(|g| g.keep.path)
                .collect()
        } else {
            req.keep
        };
        let engine_req = DeleteRequest {
            roots: scan.roots.clone(),
            records: scan.records.clone(),
            delete_paths: req.paths,
            keep_paths,
            mode,
            confirm: req.confirm,
        };
        let (report, _) = safe_delete(&engine_req, &FsDeleteBackend);
        Ok(report)
    }

    pub fn quarantine_list(&self, roots: &[PathBuf]) -> Result<Vec<QuarantinedFile>, String> {
        list_quarantine(roots).map_err(|e| e.to_string())
    }

    pub fn quarantine_restore(
        &self,
        path: PathBuf,
        roots: Vec<PathBuf>,
    ) -> Result<PathBuf, String> {
        restore_quarantined(&path, &roots).map_err(|e| e.to_string())
    }

    /// Preview bytes for an image under last scan roots (5 MiB cap).
    /// MIME is sniffed from content (extension ignored) — spoofed `.jpg` text fails closed.
    pub fn preview_image(&self, path: &Path) -> Result<(String, Vec<u8>), String> {
        const MAX: u64 = 5 * 1024 * 1024;
        let roots = self
            .last_roots
            .lock()
            .map_err(|_| "lock poisoned".to_string())?
            .clone();
        if roots.is_empty() {
            return Err("no scan roots; run a scan first".into());
        }
        let real = dup_finder_engine::path_safe::realpath(path).map_err(|e| e.to_string())?;
        if !dup_finder_engine::path_safe::under_any_root(&real, &roots) {
            return Err("path outside scan roots".into());
        }
        let meta = std::fs::metadata(&real).map_err(|e| e.to_string())?;
        if meta.len() > MAX {
            return Err("preview too large".into());
        }
        let mime = dup_finder_engine::mime::sniff_mime(&real);
        if !mime.starts_with("image/") {
            return Err("not a previewable image (content is not an image)".into());
        }
        let bytes = std::fs::read(&real).map_err(|e| e.to_string())?;
        Ok((mime, bytes))
    }
}

fn parse_mode(mode: &str) -> Result<DeleteMode, String> {
    match mode {
        "dry_run" => Ok(DeleteMode::DryRun),
        "trash" => Ok(DeleteMode::Trash),
        "permanent" => Ok(DeleteMode::Permanent),
        _ => Err("mode must be dry_run|trash|permanent".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn session_scan_suggest_dry_run() {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../docker/fixtures")
            .canonicalize()
            .unwrap();
        let app = AppSession::new();
        let scan = app
            .scan(ScanRequest {
                roots: vec![fixtures.clone()],
                index_path: None,
                filters: ScanFilters::sensible_defaults(),
            })
            .unwrap();
        assert!(!scan.result.groups.is_empty());
        let sug = app.suggest(&scan.scan_id).unwrap();
        assert!(!sug.groups.is_empty());
        let scan_id = scan.scan_id.clone();
        let drop = sug.groups[0].delete_candidates[0].path.clone();
        let keep = sug.groups[0].keep.path.clone();
        let report = app
            .delete(DeleteRequestDto {
                scan_id: scan_id.clone(),
                paths: vec![drop.clone()],
                keep: vec![keep.clone()],
                mode: "dry_run".into(),
                confirm: false,
            })
            .unwrap();
        assert_eq!(
            report.outcomes[0].kind,
            dup_finder_engine::DeleteOutcomeKind::WouldDelete
        );

        let report_keep = app
            .delete(DeleteRequestDto {
                scan_id: scan_id.clone(),
                paths: vec![keep.clone()],
                keep: vec![],
                mode: "dry_run".into(),
                confirm: false,
            })
            .unwrap();
        assert_eq!(
            report_keep.outcomes[0].kind,
            dup_finder_engine::DeleteOutcomeKind::Skipped
        );
        assert_eq!(report_keep.outcomes[0].reason, "IS_KEEP");

        let report_trash = app
            .delete(DeleteRequestDto {
                scan_id,
                paths: vec![drop],
                keep: vec![keep],
                mode: "trash".into(),
                confirm: false,
            })
            .unwrap();
        assert!(report_trash.refused);
        let _ = tempdir;
    }

    #[test]
    fn async_scan_job_completes() {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../docker/fixtures")
            .canonicalize()
            .unwrap();
        let app = Arc::new(AppSession::new());
        let job_id = app
            .scan_start(ScanRequest {
                roots: vec![fixtures],
                index_path: None,
                filters: ScanFilters::sensible_defaults(),
            })
            .unwrap();
        for _ in 0..200 {
            let st = app.scan_job(&job_id).unwrap();
            if st.status != ScanJobStatus::Running {
                assert_eq!(st.status, ScanJobStatus::Ok);
                assert!(st.scan_id.is_some());
                return;
            }
            thread::sleep(std::time::Duration::from_millis(20));
        }
        panic!("scan job did not finish");
    }

    #[test]
    fn preview_rejects_extension_spoof_accepts_real_png() {
        let dir = tempdir().unwrap();
        let spoof = dir.path().join("fake.jpg");
        std::fs::write(&spoof, b"not a jpeg at all\n").unwrap();
        // 1x1 PNG
        let png_bytes = [
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
            0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d,
            0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
        ];
        let real = dir.path().join("real.png");
        std::fs::write(&real, png_bytes).unwrap();

        let app = AppSession::new();
        app.scan(ScanRequest {
            roots: vec![dir.path().to_path_buf()],
            index_path: None,
            filters: ScanFilters::sensible_defaults(),
        })
        .unwrap();

        let err = app.preview_image(&spoof).unwrap_err();
        assert!(
            err.contains("not a previewable image"),
            "spoofed jpg must fail: {err}"
        );

        let (mime, bytes) = app.preview_image(&real).unwrap();
        assert_eq!(mime, "image/png");
        assert_eq!(bytes, png_bytes);
    }
}
