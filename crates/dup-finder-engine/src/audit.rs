use crate::model::DeleteOutcome;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AuditEvent {
    pub action: String,
    pub path: PathBuf,
    pub result: String,
    pub reason: String,
}

pub fn from_outcome(outcome: &DeleteOutcome) -> AuditEvent {
    AuditEvent {
        action: "delete".into(),
        path: outcome.path.clone(),
        result: format!("{:?}", outcome.kind).to_lowercase(),
        reason: outcome.reason.clone(),
    }
}
