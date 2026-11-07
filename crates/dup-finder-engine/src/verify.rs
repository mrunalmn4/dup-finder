//! Live re-hash to confirm scan records still match on disk.

use crate::error::EngineError;
use crate::hash::blake3_file;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VerifyPathOutcome {
    pub path: PathBuf,
    pub expected_hash: String,
    pub live_hash: Option<String>,
    pub matched: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VerifyReport {
    pub expected_hash: String,
    pub all_matched: bool,
    pub outcomes: Vec<VerifyPathOutcome>,
}

/// Re-hash each path and compare to `expected_hash` (group content id).
pub fn verify_paths_against_hash(
    paths: &[PathBuf],
    expected_hash: &str,
) -> Result<VerifyReport, EngineError> {
    if paths.is_empty() {
        return Err(EngineError::Message("paths required".into()));
    }
    let mut outcomes = Vec::with_capacity(paths.len());
    for path in paths {
        match blake3_file(Path::new(path)) {
            Ok(live) => {
                let matched = live == expected_hash;
                outcomes.push(VerifyPathOutcome {
                    path: path.clone(),
                    expected_hash: expected_hash.to_string(),
                    live_hash: Some(live),
                    matched,
                    error: None,
                });
            }
            Err(e) => {
                outcomes.push(VerifyPathOutcome {
                    path: path.clone(),
                    expected_hash: expected_hash.to_string(),
                    live_hash: None,
                    matched: false,
                    error: Some(e.to_string()),
                });
            }
        }
    }
    let all_matched = outcomes.iter().all(|o| o.matched);
    Ok(VerifyReport {
        expected_hash: expected_hash.to_string(),
        all_matched,
        outcomes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn verify_matches_identical_files() {
        let dir = tempdir().unwrap();
        let a = dir.path().join("a.txt");
        let b = dir.path().join("b.txt");
        fs::write(&a, b"same-bytes").unwrap();
        fs::write(&b, b"same-bytes").unwrap();
        let h = blake3_file(&a).unwrap();
        let report = verify_paths_against_hash(&[a, b], &h).unwrap();
        assert!(report.all_matched);
        assert_eq!(report.outcomes.len(), 2);
    }

    #[test]
    fn verify_detects_changed_file() {
        let dir = tempdir().unwrap();
        let a = dir.path().join("a.txt");
        fs::write(&a, b"v1").unwrap();
        let h = blake3_file(&a).unwrap();
        fs::write(&a, b"v2-changed").unwrap();
        let report = verify_paths_against_hash(&[a], &h).unwrap();
        assert!(!report.all_matched);
        assert!(!report.outcomes[0].matched);
    }
}
