//! Warn before suggesting deletion of system / application-critical paths.
//! Advisory only — never auto-deletes; UI/CLI should surface these clearly.

use serde::{Deserialize, Serialize};
use std::path::{Component, Path};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CautionLevel {
    None,
    Elevated,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PathCaution {
    pub level: CautionLevel,
    pub reason: String,
}

impl PathCaution {
    pub fn none() -> Self {
        Self {
            level: CautionLevel::None,
            reason: String::new(),
        }
    }

    pub fn is_risky(&self) -> bool {
        !matches!(self.level, CautionLevel::None)
    }
}

/// Classify a path for delete-suggestion caution (OS-aware prefixes + well-known dirs).
pub fn assess_path(path: &Path) -> PathCaution {
    let raw = path.to_string_lossy();
    let lower = raw.to_ascii_lowercase();

    // Credential / key material
    if lower.contains("/.ssh/")
        || lower.contains("\\.ssh\\")
        || lower.contains("/.gnupg/")
        || lower.contains("\\.gnupg\\")
        || lower.ends_with("/.ssh")
        || lower.ends_with("\\.ssh")
    {
        return PathCaution {
            level: CautionLevel::Critical,
            reason: "credential_or_key_material".into(),
        };
    }

    // Bundled app payloads before broader /Applications elevated rule
    if lower.contains(".app/contents/") || lower.contains(".app\\contents\\") {
        return PathCaution {
            level: CautionLevel::Critical,
            reason: "application_bundle".into(),
        };
    }

    #[cfg(windows)]
    {
        if let Some(c) = windows_caution(&lower) {
            return c;
        }
    }

    #[cfg(not(windows))]
    {
        if let Some(c) = unix_caution(path, &lower) {
            return c;
        }
    }

    PathCaution::none()
}

#[cfg(not(windows))]
fn unix_caution(path: &Path, lower: &str) -> Option<PathCaution> {
    let critical_prefixes = [
        "/system/",
        "/usr/",
        "/bin/",
        "/sbin/",
        "/etc/",
        "/boot/",
        "/lib/",
        "/lib64/",
        "/dev/",
        "/proc/",
        "/sys/",
        "/private/var/db/",
        "/library/apple/",
        "/library/systemoverview/",
    ];
    for p in critical_prefixes {
        if lower.starts_with(p) || lower == p.trim_end_matches('/') {
            return Some(PathCaution {
                level: CautionLevel::Critical,
                reason: "system_path".into(),
            });
        }
    }

    // Exact roots like /bin
    if matches!(
        path.components().next(),
        Some(Component::RootDir)
    ) {
        let comps: Vec<_> = path
            .components()
            .filter_map(|c| match c {
                Component::Normal(s) => Some(s.to_string_lossy().to_ascii_lowercase()),
                _ => None,
            })
            .collect();
        if let Some(first) = comps.first() {
            if matches!(
                first.as_str(),
                "system" | "usr" | "bin" | "sbin" | "etc" | "boot" | "lib" | "lib64" | "dev" | "proc" | "sys"
            ) {
                return Some(PathCaution {
                    level: CautionLevel::Critical,
                    reason: "system_path".into(),
                });
            }
        }
    }

    if lower.starts_with("/applications/") || lower == "/applications" {
        return Some(PathCaution {
            level: CautionLevel::Elevated,
            reason: "applications_folder".into(),
        });
    }
    if lower.starts_with("/library/") {
        return Some(PathCaution {
            level: CautionLevel::Elevated,
            reason: "library_folder".into(),
        });
    }
    None
}

#[cfg(windows)]
fn windows_caution(lower: &str) -> Option<PathCaution> {
    let critical = [
        "\\windows\\",
        "/windows/",
        "\\program files\\",
        "/program files/",
        "\\program files (x86)\\",
        "\\programdata\\",
    ];
    for p in critical {
        if lower.contains(p) {
            return Some(PathCaution {
                level: CautionLevel::Critical,
                reason: "system_or_program_files".into(),
            });
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn user_doc_is_none() {
        let p = PathBuf::from("/Users/me/Documents/photo.jpg");
        assert_eq!(assess_path(&p).level, CautionLevel::None);
    }

    #[test]
    fn system_bin_critical() {
        let p = PathBuf::from("/usr/bin/ls");
        let c = assess_path(&p);
        assert_eq!(c.level, CautionLevel::Critical);
    }

    #[test]
    fn ssh_key_critical() {
        let p = PathBuf::from("/Users/me/.ssh/id_rsa");
        assert_eq!(assess_path(&p).level, CautionLevel::Critical);
    }

    #[test]
    fn app_bundle_critical() {
        let p = PathBuf::from("/Applications/Foo.app/Contents/MacOS/Foo");
        assert_eq!(assess_path(&p).level, CautionLevel::Critical);
    }
}
