use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileRecord {
    pub path: PathBuf,
    pub size: u64,
    pub hash: String,
    pub mime: String,
    pub mtime_secs: Option<i64>,
    pub device: Option<u64>,
    pub inode: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DuplicateGroup {
    pub hash: String,
    pub size: u64,
    pub files: Vec<FileRecord>,
}

impl DuplicateGroup {
    /// Bytes reclaimable if all but one copy are removed.
    pub fn reclaimable_bytes(&self) -> u64 {
        let n = self.files.len() as u64;
        if n < 2 {
            0
        } else {
            self.size.saturating_mul(n - 1)
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ScanResult {
    pub roots: Vec<PathBuf>,
    pub files_scanned: usize,
    pub files_skipped: usize,
    pub groups: Vec<DuplicateGroup>,
    pub records: Vec<FileRecord>,
    pub skip_reasons: Vec<SkipEvent>,
}

impl ScanResult {
    pub fn duplicate_file_count(&self) -> usize {
        self.groups.iter().map(|g| g.files.len()).sum()
    }

    pub fn reclaimable_bytes(&self) -> u64 {
        self.groups.iter().map(|g| g.reclaimable_bytes()).sum()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GroupSuggestion {
    pub hash: String,
    pub keep: FileRecord,
    pub keep_reason: String,
    pub delete_candidates: Vec<FileRecord>,
    pub reclaimable_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SuggestReport {
    pub groups: Vec<GroupSuggestion>,
    pub total_reclaimable_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SkipEvent {
    pub path: PathBuf,
    pub reason: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeleteMode {
    DryRun,
    Trash,
    Permanent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeleteOutcomeKind {
    Deleted,
    WouldDelete,
    Skipped,
    Refused,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DeleteOutcome {
    pub path: PathBuf,
    pub kind: DeleteOutcomeKind,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DeleteReport {
    pub outcomes: Vec<DeleteOutcome>,
    pub refused: bool,
    pub refuse_reason: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DeleteRequest {
    pub roots: Vec<PathBuf>,
    pub records: Vec<FileRecord>,
    pub delete_paths: Vec<PathBuf>,
    pub keep_paths: Vec<PathBuf>,
    pub mode: DeleteMode,
    /// Required for Permanent mode.
    pub confirm: bool,
}
