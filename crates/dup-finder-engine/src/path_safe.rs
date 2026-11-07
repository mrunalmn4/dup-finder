use crate::error::EngineError;
use std::path::{Component, Path, PathBuf};

/// Resolve to canonical path. Fails closed if missing or unresolvable.
pub fn realpath(path: &Path) -> Result<PathBuf, EngineError> {
    path.canonicalize().map_err(|e| EngineError::Io {
        path: path.to_path_buf(),
        source: e,
    })
}

/// True if `candidate` is equal to or under `root` (both should be canonical).
pub fn is_under_root(candidate: &Path, root: &Path) -> bool {
    candidate == root || candidate.starts_with(root)
}

pub fn under_any_root(candidate: &Path, roots: &[PathBuf]) -> bool {
    roots.iter().any(|r| is_under_root(candidate, r))
}

/// Reject path strings that contain parent components before resolve (defense in depth).
pub fn contains_parent_component(path: &Path) -> bool {
    path.components().any(|c| matches!(c, Component::ParentDir))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn under_root_accepts_child() {
        let dir = tempdir().unwrap();
        let child = dir.path().join("a.txt");
        fs::write(&child, b"x").unwrap();
        let root = realpath(dir.path()).unwrap();
        let real = realpath(&child).unwrap();
        assert!(is_under_root(&real, &root));
    }

    #[test]
    fn parent_component_detected() {
        assert!(contains_parent_component(Path::new("foo/../etc/passwd")));
    }
}
