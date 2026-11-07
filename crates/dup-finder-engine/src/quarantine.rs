//! List / restore files in `.dup-finder-trash` quarantine folders.

use crate::error::EngineError;
use crate::path_safe::{realpath, under_any_root};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QuarantinedFile {
    pub path: PathBuf,
    pub original_parent: PathBuf,
    pub name: String,
    pub size: u64,
}

/// Find quarantined files under each root's `.dup-finder-trash` trees.
pub fn list_quarantine(roots: &[PathBuf]) -> Result<Vec<QuarantinedFile>, EngineError> {
    let mut out = Vec::new();
    for root in roots {
        let root = realpath(root)?;
        for entry in WalkDir::new(&root).follow_links(false).into_iter().flatten() {
            if !entry.file_type().is_dir() {
                continue;
            }
            if entry.file_name() != ".dup-finder-trash" {
                continue;
            }
            let trash_dir = entry.path();
            let original_parent = trash_dir
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| root.clone());
            for file in WalkDir::new(trash_dir)
                .follow_links(false)
                .max_depth(1)
                .into_iter()
                .flatten()
            {
                if !file.file_type().is_file() {
                    continue;
                }
                let meta = match fs::metadata(file.path()) {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                let name = file.file_name().to_string_lossy().to_string();
                out.push(QuarantinedFile {
                    path: file.path().to_path_buf(),
                    original_parent: original_parent.clone(),
                    name,
                    size: meta.len(),
                });
            }
        }
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

/// Restore a quarantined file next to its trash folder. Fail closed unless the
/// path is under `.dup-finder-trash` and that trash is under an approved root.
pub fn restore_quarantined(path: &Path, roots: &[PathBuf]) -> Result<PathBuf, EngineError> {
    let real = realpath(path)?;
    let mut canonical_roots = Vec::new();
    for r in roots {
        canonical_roots.push(realpath(r)?);
    }
    if !under_any_root(&real, &canonical_roots) {
        return Err(EngineError::Message(
            "restore path outside approved roots".into(),
        ));
    }
    let trash_dir = real
        .parent()
        .ok_or_else(|| EngineError::Message("restore path has no parent".into()))?;
    if trash_dir.file_name().and_then(|n| n.to_str()) != Some(".dup-finder-trash") {
        return Err(EngineError::Message(
            "restore path is not inside .dup-finder-trash".into(),
        ));
    }
    let dest_parent = trash_dir
        .parent()
        .ok_or_else(|| EngineError::Message("trash has no parent".into()))?;
    if !under_any_root(dest_parent, &canonical_roots) {
        return Err(EngineError::Message(
            "restore destination outside approved roots".into(),
        ));
    }
    let name = real
        .file_name()
        .ok_or_else(|| EngineError::Message("no file name".into()))?;
    // Strip collision suffixes like name__1 when restoring if base is free.
    let base_name = strip_collision_suffix(name.to_string_lossy().as_ref());
    let mut dest = dest_parent.join(&base_name);
    let mut i = 0u32;
    while dest.exists() {
        i += 1;
        dest = dest_parent.join(format!("{base_name}__restored_{i}"));
    }
    fs::rename(&real, &dest).map_err(|e| EngineError::Io {
        path: real.clone(),
        source: e,
    })?;
    Ok(dest)
}

fn strip_collision_suffix(name: &str) -> String {
    // foo__12 → foo when suffix is numeric collision marker from quarantine.
    if let Some((base, rest)) = name.rsplit_once("__") {
        if !base.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
            return base.to_string();
        }
    }
    name.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn list_and_restore_roundtrip() {
        let dir = tempdir().unwrap();
        let trash = dir.path().join(".dup-finder-trash");
        fs::create_dir_all(&trash).unwrap();
        let q = trash.join("note.txt");
        fs::write(&q, b"hello").unwrap();
        let listed = list_quarantine(&[dir.path().to_path_buf()]).unwrap();
        assert_eq!(listed.len(), 1);
        let dest = restore_quarantined(&q, &[dir.path().to_path_buf()]).unwrap();
        assert!(dest.exists());
        assert!(!q.exists());
        assert_eq!(fs::read(&dest).unwrap(), b"hello");
    }

    #[test]
    fn restore_rejects_non_trash() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("x.txt");
        fs::write(&f, b"x").unwrap();
        let err = restore_quarantined(&f, &[dir.path().to_path_buf()]).unwrap_err();
        assert!(err.to_string().contains(".dup-finder-trash"));
    }
}
