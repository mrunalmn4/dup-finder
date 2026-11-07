use crate::model::{
    DuplicateGroup, FileCaution, FileRecord, GroupSuggestion, ScanResult, SuggestReport,
};
use crate::path_caution::{assess_path, CautionLevel};
use std::cmp::Ordering;

/// Prefer newest mtime, then shortest path string, then lexicographic path.
/// Reasons are stable and explainable in UI/CLI — never auto-delete.
pub fn pick_keep(files: &[FileRecord]) -> (FileRecord, String) {
    let mut ranked: Vec<&FileRecord> = files.iter().collect();
    ranked.sort_by(|a, b| {
        let mt = b.mtime_secs.cmp(&a.mtime_secs);
        if mt != Ordering::Equal {
            return mt;
        }
        let al = a.path.as_os_str().len();
        let bl = b.path.as_os_str().len();
        al.cmp(&bl).then_with(|| a.path.cmp(&b.path))
    });
    let keep = ranked[0].clone();
    let reason = if files.iter().any(|f| f.mtime_secs != keep.mtime_secs) {
        "newest_mtime".into()
    } else if files
        .iter()
        .any(|f| f.path.as_os_str().len() != keep.path.as_os_str().len())
    {
        "shortest_path".into()
    } else {
        "lexicographic_path".into()
    };
    (keep, reason)
}

pub fn suggest_from_scan(scan: &ScanResult) -> SuggestReport {
    let mut groups = Vec::new();
    for g in &scan.groups {
        groups.push(suggest_group(g));
    }
    let total_reclaimable_bytes = groups.iter().map(|g| g.reclaimable_bytes).sum();
    SuggestReport {
        groups,
        total_reclaimable_bytes,
    }
}

fn caution_note(path: &std::path::Path) -> Option<FileCaution> {
    let c = assess_path(path);
    match c.level {
        CautionLevel::None => None,
        CautionLevel::Elevated => Some(FileCaution {
            path: path.to_path_buf(),
            level: "elevated".into(),
            reason: c.reason,
        }),
        CautionLevel::Critical => Some(FileCaution {
            path: path.to_path_buf(),
            level: "critical".into(),
            reason: c.reason,
        }),
    }
}

fn suggest_group(group: &DuplicateGroup) -> GroupSuggestion {
    let (keep, keep_reason) = pick_keep(&group.files);
    let delete_candidates: Vec<FileRecord> = group
        .files
        .iter()
        .filter(|f| f.path != keep.path)
        .cloned()
        .collect();
    let mut cautions = Vec::new();
    if let Some(c) = caution_note(&keep.path) {
        cautions.push(c);
    }
    for f in &delete_candidates {
        if let Some(c) = caution_note(&f.path) {
            cautions.push(c);
        }
    }
    GroupSuggestion {
        hash: group.hash.clone(),
        keep,
        keep_reason,
        reclaimable_bytes: group.reclaimable_bytes(),
        delete_candidates,
        cautions,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn rec(path: &str, mtime: Option<i64>) -> FileRecord {
        FileRecord {
            path: PathBuf::from(path),
            size: 10,
            hash: "h".into(),
            mime: "text/plain".into(),
            mtime_secs: mtime,
            device: None,
            inode: None,
        }
    }

    #[test]
    fn prefers_newest_mtime() {
        let files = vec![rec("/a/old.txt", Some(1)), rec("/b/new.txt", Some(99))];
        let (keep, reason) = pick_keep(&files);
        assert_eq!(keep.path, PathBuf::from("/b/new.txt"));
        assert_eq!(reason, "newest_mtime");
    }

    #[test]
    fn prefers_shorter_path_when_mtime_tied() {
        let files = vec![
            rec("/long/nested/copy.txt", Some(5)),
            rec("/short.txt", Some(5)),
        ];
        let (keep, reason) = pick_keep(&files);
        assert_eq!(keep.path, PathBuf::from("/short.txt"));
        assert_eq!(reason, "shortest_path");
    }
}
