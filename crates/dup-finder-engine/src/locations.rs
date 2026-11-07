//! Discover drives / volumes / common folders the user can pick as scan roots.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LocationKind {
    Drive,
    Volume,
    Folder,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SuggestedLocation {
    pub path: String,
    pub label: String,
    pub kind: LocationKind,
}

/// List pickable scan roots on this machine (drives, volumes, common user folders).
/// Never auto-selects; empty when nothing is readable (e.g. locked-down containers).
pub fn list_suggested_locations() -> Vec<SuggestedLocation> {
    let mut out = Vec::new();
    push_drives(&mut out);
    push_volumes(&mut out);
    push_user_folders(&mut out);
    push_demo_fixtures(&mut out);
    dedupe_keep_order(&mut out);
    out
}

fn push_unique(out: &mut Vec<SuggestedLocation>, loc: SuggestedLocation) {
    if out.iter().any(|x| paths_equal(&x.path, &loc.path)) {
        return;
    }
    if Path::new(&loc.path).is_dir() {
        out.push(loc);
    }
}

fn paths_equal(a: &str, b: &str) -> bool {
    let na = normalize_key(a);
    let nb = normalize_key(b);
    na == nb
}

fn normalize_key(p: &str) -> String {
    let mut s = p.replace('\\', "/");
    while s.ends_with('/') && s.len() > 1 {
        s.pop();
    }
    #[cfg(windows)]
    {
        s = s.to_lowercase();
    }
    s
}

fn push_drives(out: &mut Vec<SuggestedLocation>) {
    #[cfg(windows)]
    {
        for letter in b'A'..=b'Z' {
            let drive = format!("{}:\\", letter as char);
            if Path::new(&drive).is_dir() {
                push_unique(
                    out,
                    SuggestedLocation {
                        path: drive.clone(),
                        label: format!("Drive {}:", letter as char),
                        kind: LocationKind::Drive,
                    },
                );
            }
        }
    }
    #[cfg(not(windows))]
    {
        // Root filesystem as an explicit “drive-like” choice on Unix.
        if Path::new("/").is_dir() {
            // Skip listing `/` itself — too broad / system. Prefer volumes + home.
        }
        let _ = out;
    }
}

fn push_volumes(out: &mut Vec<SuggestedLocation>) {
    #[cfg(target_os = "macos")]
    {
        if let Ok(entries) = fs::read_dir("/Volumes") {
            for ent in entries.flatten() {
                let path = ent.path();
                if !path.is_dir() {
                    continue;
                }
                let name = ent.file_name().to_string_lossy().to_string();
                // Skip the boot volume alias often named after the disk
                push_unique(
                    out,
                    SuggestedLocation {
                        path: path.to_string_lossy().to_string(),
                        label: name,
                        kind: LocationKind::Volume,
                    },
                );
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        for base in ["/media", "/mnt", "/run/media"] {
            push_mount_children(out, Path::new(base));
        }
    }
}

#[cfg(target_os = "linux")]
fn push_mount_children(out: &mut Vec<SuggestedLocation>, base: &Path) {
    let Ok(entries) = fs::read_dir(base) else {
        return;
    };
    for ent in entries.flatten() {
        let path = ent.path();
        if !path.is_dir() {
            continue;
        }
        // /media/user/... → list user then children; /mnt/foo → list foo
        if base == Path::new("/media") || base == Path::new("/run/media") {
            if let Ok(inner) = fs::read_dir(&path) {
                for child in inner.flatten() {
                    let cp = child.path();
                    if cp.is_dir() {
                        let label = child.file_name().to_string_lossy().to_string();
                        push_unique(
                            out,
                            SuggestedLocation {
                                path: cp.to_string_lossy().to_string(),
                                label,
                                kind: LocationKind::Volume,
                            },
                        );
                    }
                }
            }
        } else {
            let label = ent.file_name().to_string_lossy().to_string();
            push_unique(
                out,
                SuggestedLocation {
                    path: path.to_string_lossy().to_string(),
                    label,
                    kind: LocationKind::Volume,
                },
            );
        }
    }
}

fn home_dir() -> Option<PathBuf> {
    if let Ok(h) = std::env::var("HOME") {
        if !h.is_empty() {
            return Some(PathBuf::from(h));
        }
    }
    if let Ok(h) = std::env::var("USERPROFILE") {
        if !h.is_empty() {
            return Some(PathBuf::from(h));
        }
    }
    None
}

fn push_user_folders(out: &mut Vec<SuggestedLocation>) {
    let Some(home) = home_dir() else {
        return;
    };
    push_unique(
        out,
        SuggestedLocation {
            path: home.to_string_lossy().to_string(),
            label: "Home".into(),
            kind: LocationKind::Folder,
        },
    );
    for (name, label) in [
        ("Desktop", "Desktop"),
        ("Documents", "Documents"),
        ("Downloads", "Downloads"),
        ("Pictures", "Pictures"),
        ("Music", "Music"),
        ("Videos", "Videos"),
        // Windows localized fallbacks still use English folder names on many installs
        ("OneDrive", "OneDrive"),
    ] {
        let p = home.join(name);
        push_unique(
            out,
            SuggestedLocation {
                path: p.to_string_lossy().to_string(),
                label: label.into(),
                kind: LocationKind::Folder,
            },
        );
    }
}

fn push_demo_fixtures(out: &mut Vec<SuggestedLocation>) {
    for candidate in [
        "/app/docker/fixtures",
        "./docker/fixtures",
        "docker/fixtures",
    ] {
        let p = Path::new(candidate);
        if p.is_dir() {
            push_unique(
                out,
                SuggestedLocation {
                    path: p
                        .canonicalize()
                        .unwrap_or_else(|_| p.to_path_buf())
                        .to_string_lossy()
                        .to_string(),
                    label: "Sample files (demo)".into(),
                    kind: LocationKind::Folder,
                },
            );
            break;
        }
    }
}

fn dedupe_keep_order(out: &mut Vec<SuggestedLocation>) {
    let mut seen = Vec::new();
    out.retain(|loc| {
        let key = normalize_key(&loc.path);
        if seen.iter().any(|s| s == &key) {
            false
        } else {
            seen.push(key);
            true
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn lists_home_when_set() {
        let _g = ENV_LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let pics = dir.path().join("Pictures");
        fs::create_dir_all(&pics).unwrap();
        std::env::set_var("HOME", dir.path());
        std::env::remove_var("USERPROFILE");
        let locs = list_suggested_locations();
        assert!(
            locs.iter().any(|l| l.label == "Home"),
            "expected Home in {locs:?}"
        );
        assert!(
            locs.iter().any(|l| l.label == "Pictures"),
            "expected Pictures in {locs:?}"
        );
        std::env::remove_var("HOME");
    }

    #[test]
    fn no_duplicates() {
        let locs = list_suggested_locations();
        let mut keys: Vec<_> = locs.iter().map(|l| normalize_key(&l.path)).collect();
        let before = keys.len();
        keys.sort();
        keys.dedup();
        assert_eq!(before, keys.len());
    }
}
