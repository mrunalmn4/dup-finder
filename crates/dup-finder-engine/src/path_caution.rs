//! Warn before suggesting deletion of system / application-critical paths.
//! Advisory only — never auto-deletes; UI/CLI should surface these clearly.
//!
//! Windows and Unix rules both run on every platform so path strings from any OS
//! are classified consistently (and unit-tested on Linux/macOS CI).

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

    // Credential / key material (POSIX home or Windows profile)
    if lower.contains("/.ssh/")
        || lower.contains("\\.ssh\\")
        || lower.contains("/.gnupg/")
        || lower.contains("\\.gnupg\\")
        || lower.ends_with("/.ssh")
        || lower.ends_with("\\.ssh")
        || lower.contains("\\application data\\microsoft\\crypto\\")
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

    // Windows drive / UNC style first (C:\…, \\server\share\…)
    if let Some(c) = windows_caution(&lower) {
        return c;
    }

    if let Some(c) = unix_caution(path, &lower) {
        return c;
    }

    PathCaution::none()
}

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

    if matches!(path.components().next(), Some(Component::RootDir)) {
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
                "system"
                    | "usr"
                    | "bin"
                    | "sbin"
                    | "etc"
                    | "boot"
                    | "lib"
                    | "lib64"
                    | "dev"
                    | "proc"
                    | "sys"
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

/// Windows roots are **drive letters** (`C:\`, `D:\`) or UNC (`\\server\share`), not Unix mounts.
fn windows_caution(lower: &str) -> Option<PathCaution> {
    // Normalize to backslashes for matching; strip extended-length prefix.
    let mut n = lower.replace('/', "\\");
    if let Some(rest) = n.strip_prefix("\\\\?\\") {
        n = rest.to_string();
    }
    // UNC: \\server\share\...
    if n.starts_with("\\\\") {
        // Still flag well-known system folders if present in the share path
    }

    let critical = [
        "\\windows\\",
        "\\windows\\system32\\",
        "\\windows\\syswow64\\",
        "\\program files\\",
        "\\program files (x86)\\",
        "\\programdata\\",
    ];
    for p in critical {
        if n.contains(p) {
            return Some(PathCaution {
                level: CautionLevel::Critical,
                reason: "system_or_program_files".into(),
            });
        }
    }

    // Bare system roots: c:\windows, d:\program files
    for drive in b'a'..=b'z' {
        let d = drive as char;
        let win = format!("{d}:\\windows");
        let pf = format!("{d}:\\program files");
        let pfx = format!("{d}:\\program files (x86)");
        let pd = format!("{d}:\\programdata");
        if n == win
            || n.starts_with(&(win.clone() + "\\"))
            || n == pf
            || n.starts_with(&(pf + "\\"))
            || n == pfx
            || n.starts_with(&(pfx + "\\"))
            || n == pd
            || n.starts_with(&(pd + "\\"))
        {
            return Some(PathCaution {
                level: CautionLevel::Critical,
                reason: "system_or_program_files".into(),
            });
        }
    }

    // Installed apps under user profile
    if n.contains("\\appdata\\local\\programs\\") || n.contains("\\appdata\\roaming\\") {
        return Some(PathCaution {
            level: CautionLevel::Elevated,
            reason: "windows_appdata".into(),
        });
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

    #[test]
    fn windows_system32_critical() {
        let p = PathBuf::from(r"C:\Windows\System32\cmd.exe");
        assert_eq!(assess_path(&p).level, CautionLevel::Critical);
    }

    #[test]
    fn windows_user_photos_ok() {
        let p = PathBuf::from(r"D:\Photos\vacation.jpg");
        assert_eq!(assess_path(&p).level, CautionLevel::None);
    }

    #[test]
    fn windows_program_files_critical() {
        let p = PathBuf::from(r"C:\Program Files\Foo\app.exe");
        assert_eq!(assess_path(&p).level, CautionLevel::Critical);
    }
}
