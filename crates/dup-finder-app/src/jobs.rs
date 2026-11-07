use crate::{AppSession, ScanRequest};
use dup_finder_engine::ScanFilters;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Idle,
    Running,
    Ok,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledJob {
    pub id: String,
    pub roots: Vec<PathBuf>,
    pub index_path: Option<PathBuf>,
    pub filters: ScanFilters,
    pub interval_secs: u64,
    pub enabled: bool,
    pub status: JobStatus,
    pub last_run_unix: Option<u64>,
    pub last_scan_id: Option<String>,
    pub last_error: Option<String>,
    pub last_groups: Option<usize>,
    pub last_reclaimable_bytes: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateJobRequest {
    pub roots: Vec<PathBuf>,
    pub index_path: Option<PathBuf>,
    #[serde(default)]
    pub filters: ScanFilters,
    /// Minimum seconds between automatic runs (0 = manual only).
    pub interval_secs: u64,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub struct JobStore {
    conn: Mutex<Connection>,
}

impl JobStore {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             CREATE TABLE IF NOT EXISTS jobs (
               id TEXT PRIMARY KEY NOT NULL,
               roots_json TEXT NOT NULL,
               index_path TEXT,
               interval_secs INTEGER NOT NULL,
               enabled INTEGER NOT NULL,
               status TEXT NOT NULL,
               last_run_unix INTEGER,
               last_scan_id TEXT,
               last_error TEXT,
               last_groups INTEGER,
               last_reclaimable_bytes INTEGER
             );",
        )
        .map_err(|e| e.to_string())?;
        // Migration: filters_json (null → sensible defaults on read)
        let _ = conn.execute(
            "ALTER TABLE jobs ADD COLUMN filters_json TEXT",
            [],
        );
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn create(&self, req: CreateJobRequest) -> Result<ScheduledJob, String> {
        if req.roots.is_empty() {
            return Err("roots required".into());
        }
        let job = ScheduledJob {
            id: Uuid::new_v4().to_string(),
            roots: req.roots,
            index_path: req.index_path,
            filters: req.filters,
            interval_secs: req.interval_secs,
            enabled: req.enabled,
            status: JobStatus::Idle,
            last_run_unix: None,
            last_scan_id: None,
            last_error: None,
            last_groups: None,
            last_reclaimable_bytes: None,
        };
        self.upsert(&job)?;
        Ok(job)
    }

    pub fn list(&self) -> Result<Vec<ScheduledJob>, String> {
        let conn = self.conn.lock().map_err(|_| "lock poisoned".to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, roots_json, index_path, interval_secs, enabled, status,
                        last_run_unix, last_scan_id, last_error, last_groups, last_reclaimable_bytes,
                        filters_json
                 FROM jobs ORDER BY id",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], row_to_job)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    pub fn get(&self, id: &str) -> Result<ScheduledJob, String> {
        let conn = self.conn.lock().map_err(|_| "lock poisoned".to_string())?;
        conn.query_row(
            "SELECT id, roots_json, index_path, interval_secs, enabled, status,
                    last_run_unix, last_scan_id, last_error, last_groups, last_reclaimable_bytes,
                    filters_json
             FROM jobs WHERE id = ?1",
            params![id],
            row_to_job,
        )
        .map_err(|_| "job not found".into())
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "lock poisoned".to_string())?;
        let n = conn
            .execute("DELETE FROM jobs WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("job not found".into());
        }
        Ok(())
    }

    pub fn upsert(&self, job: &ScheduledJob) -> Result<(), String> {
        let roots_json = serde_json::to_string(&job.roots).map_err(|e| e.to_string())?;
        let filters_json = serde_json::to_string(&job.filters).map_err(|e| e.to_string())?;
        let status = match job.status {
            JobStatus::Idle => "idle",
            JobStatus::Running => "running",
            JobStatus::Ok => "ok",
            JobStatus::Error => "error",
        };
        let conn = self.conn.lock().map_err(|_| "lock poisoned".to_string())?;
        conn.execute(
            "INSERT INTO jobs(id, roots_json, index_path, interval_secs, enabled, status,
                              last_run_unix, last_scan_id, last_error, last_groups, last_reclaimable_bytes,
                              filters_json)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
             ON CONFLICT(id) DO UPDATE SET
               roots_json=excluded.roots_json,
               index_path=excluded.index_path,
               interval_secs=excluded.interval_secs,
               enabled=excluded.enabled,
               status=excluded.status,
               last_run_unix=excluded.last_run_unix,
               last_scan_id=excluded.last_scan_id,
               last_error=excluded.last_error,
               last_groups=excluded.last_groups,
               last_reclaimable_bytes=excluded.last_reclaimable_bytes,
               filters_json=excluded.filters_json",
            params![
                job.id,
                roots_json,
                job.index_path
                    .as_ref()
                    .map(|p| p.to_string_lossy().to_string()),
                job.interval_secs as i64,
                job.enabled as i64,
                status,
                job.last_run_unix.map(|v| v as i64),
                job.last_scan_id,
                job.last_error,
                job.last_groups.map(|v| v as i64),
                job.last_reclaimable_bytes.map(|v| v as i64),
                filters_json,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Run a job now via the shared session (stores scan for suggest/delete).
    pub fn run_now(&self, session: &AppSession, id: &str) -> Result<ScheduledJob, String> {
        let mut job = self.get(id)?;
        job.status = JobStatus::Running;
        job.last_error = None;
        self.upsert(&job)?;

        let result = session.scan(ScanRequest {
            roots: job.roots.clone(),
            index_path: job.index_path.clone(),
            filters: job.filters.clone(),
        });

        match result {
            Ok(scan) => {
                job.status = JobStatus::Ok;
                job.last_run_unix = Some(now_unix());
                job.last_scan_id = Some(scan.scan_id);
                job.last_groups = Some(scan.result.groups.len());
                job.last_reclaimable_bytes = Some(scan.result.reclaimable_bytes());
                job.last_error = None;
            }
            Err(e) => {
                job.status = JobStatus::Error;
                job.last_run_unix = Some(now_unix());
                job.last_error = Some(e);
            }
        }
        self.upsert(&job)?;
        Ok(job)
    }

    /// Jobs that are due for scheduled execution.
    pub fn due_jobs(&self) -> Result<Vec<ScheduledJob>, String> {
        let now = now_unix();
        Ok(self
            .list()?
            .into_iter()
            .filter(|j| {
                j.enabled
                    && j.interval_secs > 0
                    && j.status != JobStatus::Running
                    && j.last_run_unix
                        .map(|t| now.saturating_sub(t) >= j.interval_secs)
                        .unwrap_or(true)
            })
            .collect())
    }
}

fn row_to_job(row: &rusqlite::Row<'_>) -> rusqlite::Result<ScheduledJob> {
    let roots_json: String = row.get(1)?;
    let roots: Vec<PathBuf> = serde_json::from_str(&roots_json).unwrap_or_default();
    let index: Option<String> = row.get(2)?;
    let status_s: String = row.get(5)?;
    let status = match status_s.as_str() {
        "running" => JobStatus::Running,
        "ok" => JobStatus::Ok,
        "error" => JobStatus::Error,
        _ => JobStatus::Idle,
    };
    let filters_json: Option<String> = row.get(11)?;
    let filters = filters_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_else(ScanFilters::sensible_defaults);
    Ok(ScheduledJob {
        id: row.get(0)?,
        roots,
        index_path: index.map(PathBuf::from),
        filters,
        interval_secs: row.get::<_, i64>(3)? as u64,
        enabled: row.get::<_, i64>(4)? != 0,
        status,
        last_run_unix: row.get::<_, Option<i64>>(6)?.map(|v| v as u64),
        last_scan_id: row.get(7)?,
        last_error: row.get(8)?,
        last_groups: row.get::<_, Option<i64>>(9)?.map(|v| v as usize),
        last_reclaimable_bytes: row.get::<_, Option<i64>>(10)?.map(|v| v as u64),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::AppSession;
    use tempfile::tempdir;

    #[test]
    fn create_run_list_job() {
        let dir = tempdir().unwrap();
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../docker/fixtures")
            .canonicalize()
            .unwrap();
        let store = JobStore::open(&dir.path().join("jobs.sqlite")).unwrap();
        let session = AppSession::new();
        let job = store
            .create(CreateJobRequest {
                roots: vec![fixtures],
                index_path: None,
                filters: ScanFilters::sensible_defaults(),
                interval_secs: 3600,
                enabled: true,
            })
            .unwrap();
        let ran = store.run_now(&session, &job.id).unwrap();
        assert_eq!(ran.status, JobStatus::Ok);
        assert!(ran.last_scan_id.is_some());
        assert!(ran.last_groups.unwrap_or(0) >= 1);
        assert_eq!(store.list().unwrap().len(), 1);
    }
}
