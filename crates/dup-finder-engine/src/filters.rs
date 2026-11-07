//! Scan Where/What filters: categories, size, extensions, exclude names/paths.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileCategory {
    Photos,
    Videos,
    Documents,
    Audio,
    Archives,
    Other,
}

impl FileCategory {
    pub fn all() -> &'static [FileCategory] {
        &[
            FileCategory::Photos,
            FileCategory::Videos,
            FileCategory::Documents,
            FileCategory::Audio,
            FileCategory::Archives,
            FileCategory::Other,
        ]
    }

    pub fn extensions(self) -> &'static [&'static str] {
        match self {
            FileCategory::Photos => &[
                "jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "tif", "tiff", "raw",
                "cr2", "nef", "arw", "dng", "svg",
            ],
            FileCategory::Videos => &[
                "mp4", "mov", "mkv", "avi", "webm", "m4v", "wmv", "flv", "mpeg", "mpg", "3gp",
            ],
            FileCategory::Documents => &[
                "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "odt", "ods",
                "odp", "csv", "md", "pages", "numbers", "key",
            ],
            FileCategory::Audio => &["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma", "aiff", "opus"],
            FileCategory::Archives => &[
                "zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "dmg", "iso", "cab",
            ],
            FileCategory::Other => &[],
        }
    }

    pub fn from_extension(ext: &str) -> FileCategory {
        let e = ext.trim_start_matches('.').to_ascii_lowercase();
        for cat in [
            FileCategory::Photos,
            FileCategory::Videos,
            FileCategory::Documents,
            FileCategory::Audio,
            FileCategory::Archives,
        ] {
            if cat.extensions().iter().any(|x| *x == e) {
                return cat;
            }
        }
        FileCategory::Other
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScanFilters {
    #[serde(default)]
    pub exclude_paths: Vec<PathBuf>,
    #[serde(default)]
    pub max_depth: Option<usize>,
    #[serde(default)]
    pub include_hidden: bool,
    #[serde(default)]
    pub min_size: Option<u64>,
    #[serde(default)]
    pub max_size: Option<u64>,
    /// Empty = all categories.
    #[serde(default)]
    pub categories: Vec<FileCategory>,
    /// Empty = no include-restrict.
    #[serde(default)]
    pub include_extensions: Vec<String>,
    #[serde(default)]
    pub exclude_extensions: Vec<String>,
    #[serde(default)]
    pub exclude_names: Vec<String>,
}

impl Default for ScanFilters {
    fn default() -> Self {
        Self::sensible_defaults()
    }
}

impl ScanFilters {
    pub fn sensible_defaults() -> Self {
        Self {
            exclude_paths: Vec::new(),
            max_depth: None,
            include_hidden: false,
            min_size: None,
            max_size: None,
            categories: Vec::new(),
            include_extensions: Vec::new(),
            exclude_extensions: Vec::new(),
            exclude_names: default_exclude_names(),
        }
    }

    /// Empty filters with no exclude names (tests / explicit “scan everything”).
    pub fn empty() -> Self {
        Self {
            exclude_paths: Vec::new(),
            max_depth: None,
            include_hidden: true,
            min_size: None,
            max_size: None,
            categories: Vec::new(),
            include_extensions: Vec::new(),
            exclude_extensions: Vec::new(),
            exclude_names: Vec::new(),
        }
    }

    fn normalized_exts(list: &[String]) -> Vec<String> {
        list.iter()
            .map(|e| e.trim().trim_start_matches('.').to_ascii_lowercase())
            .filter(|e| !e.is_empty())
            .collect()
    }

    pub fn file_allowed(&self, path: &Path, size: u64) -> Result<(), &'static str> {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        if !self.include_hidden && is_hidden_name(name) {
            return Err("filtered:hidden");
        }

        if name_excluded(name, &self.exclude_names) {
            return Err("filtered:exclude_name");
        }

        if let Some(min) = self.min_size {
            if size < min {
                return Err("filtered:size");
            }
        }
        if let Some(max) = self.max_size {
            if size > max {
                return Err("filtered:size");
            }
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();

        let include = Self::normalized_exts(&self.include_extensions);
        if !include.is_empty() && !include.iter().any(|e| e == &ext) {
            return Err("filtered:extension");
        }

        let exclude = Self::normalized_exts(&self.exclude_extensions);
        if exclude.iter().any(|e| e == &ext) {
            return Err("filtered:extension");
        }

        if !self.categories.is_empty() {
            let cat = FileCategory::from_extension(&ext);
            if !self.categories.contains(&cat) {
                return Err("filtered:category");
            }
        }

        Ok(())
    }

    pub fn should_skip_dir_entry(&self, path: &Path, exclude_prefixes: &[PathBuf]) -> bool {
        if is_builtin_skip_dir(path) {
            return true;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        if !self.include_hidden && is_hidden_name(name) {
            return true;
        }
        if name_excluded(name, &self.exclude_names) {
            return true;
        }
        for ex in exclude_prefixes {
            if path_under_or_eq(path, ex) {
                return true;
            }
        }
        false
    }
}

pub fn default_exclude_names() -> Vec<String> {
    [
        "node_modules",
        ".git",
        ".svn",
        "__pycache__",
        ".cache",
        "Caches",
        ".Trash",
        "$RECYCLE.BIN",
        "System Volume Information",
    ]
    .into_iter()
    .map(str::to_string)
    .collect()
}

pub fn is_builtin_skip_dir(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|n| n == ".dup-finder-trash" || n == ".dup-finder-index")
}

fn is_hidden_name(name: &str) -> bool {
    name.starts_with('.') && name != "." && name != ".."
}

fn name_excluded(name: &str, exclude_names: &[String]) -> bool {
    let lower = name.to_ascii_lowercase();
    exclude_names
        .iter()
        .any(|n| n.eq_ignore_ascii_case(name) || n.to_ascii_lowercase() == lower)
}

pub fn path_under_or_eq(path: &Path, prefix: &Path) -> bool {
    path == prefix || path.starts_with(prefix)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn category_from_ext() {
        assert_eq!(FileCategory::from_extension("JPG"), FileCategory::Photos);
        assert_eq!(FileCategory::from_extension("mp4"), FileCategory::Videos);
        assert_eq!(FileCategory::from_extension("xyz"), FileCategory::Other);
    }

    #[test]
    fn size_and_ext_filters() {
        let mut f = ScanFilters::empty();
        f.min_size = Some(10);
        assert!(f.file_allowed(Path::new("a.txt"), 5).is_err());
        assert!(f.file_allowed(Path::new("a.txt"), 10).is_ok());
        f.include_extensions = vec!["png".into()];
        assert!(f.file_allowed(Path::new("a.txt"), 10).is_err());
        assert!(f.file_allowed(Path::new("a.png"), 10).is_ok());
    }
}
