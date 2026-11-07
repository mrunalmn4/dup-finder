//! Dup Finder engine: content-duplicate scan and fail-closed safe delete.

pub mod audit;
pub mod delete;
pub mod error;
pub mod filters;
pub mod hash;
pub mod index;
pub mod locations;
pub mod mime;
pub mod model;
pub mod path_caution;
pub mod path_safe;
pub mod quarantine;
pub mod scan;
pub mod suggest;

pub use delete::{safe_delete, DeleteBackend, FsDeleteBackend, QuarantineBackend};
pub use error::EngineError;
pub use filters::{default_exclude_names, FileCategory, ScanFilters};
pub use index::ScanIndex;
pub use locations::{list_suggested_locations, LocationKind, SuggestedLocation};
pub use model::*;
pub use path_caution::{assess_path, CautionLevel, PathCaution};
pub use quarantine::{list_quarantine, restore_quarantined, QuarantinedFile};
pub use scan::{
    scan_roots, scan_with_options, ProgressCallback, ScanOptions, ScanPhase, ScanProgress,
    ScanStats,
};
pub use suggest::{pick_keep, suggest_from_scan};
