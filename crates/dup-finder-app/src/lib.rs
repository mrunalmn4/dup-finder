pub mod jobs;

pub use jobs::{CreateJobRequest, JobStatus, JobStore, ScheduledJob};

use dup_finder_engine::{
    safe_delete, scan_with_options, suggest_from_scan, DeleteMode, DeleteReport, DeleteRequest,
    FsDeleteBackend, ScanFilters, ScanOptions, ScanResult, ScanStats, SuggestReport,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResponse {
    pub scan_id: String,
    pub stats: ScanStats,
    pub result: ScanResult,
}

#[derive(Debug, Deserialize, Serialize)]
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

#[derive(Default)]
pub struct AppSession {
    scans: Mutex<HashMap<String, ScanResult>>,
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
            roots: req.roots,
            index_path: req.index_path,
            filters: req.filters,
        })
        .map_err(|e| e.to_string())?;
        let scan_id = Uuid::new_v4().to_string();
        self.scans
            .lock()
            .map_err(|_| "lock poisoned".to_string())?
            .insert(scan_id.clone(), result.clone());
        Ok(ScanResponse {
            scan_id,
            stats,
            result,
        })
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

    pub fn delete(&self, req: DeleteRequestDto) -> Result<DeleteReport, String> {
        let mode = parse_mode(&req.mode)?;
        let scan = self.get_scan(&req.scan_id)?;
        // Empty keep → derive from suggest (fail closed for raw API clients).
        // Non-empty keep → trust authenticated client (UI may override via "Keep this instead").
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

        // Empty client keep still protects suggested keep (server-side union).
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

        // Mutating trash without confirm is refused.
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
}
