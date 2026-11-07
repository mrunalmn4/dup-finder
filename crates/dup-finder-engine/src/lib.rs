//! Dup Finder engine: content-duplicate scan and fail-closed safe delete.

pub mod audit;
pub mod delete;
pub mod error;
pub mod hash;
pub mod index;
pub mod mime;
pub mod model;
pub mod path_safe;
pub mod scan;
pub mod suggest;

pub use delete::{safe_delete, DeleteBackend, FsDeleteBackend, QuarantineBackend};
pub use error::EngineError;
pub use index::ScanIndex;
pub use model::*;
pub use scan::{scan_roots, scan_with_options, ScanOptions, ScanStats};
pub use suggest::{pick_keep, suggest_from_scan};
