use std::fs::File;
use std::io::Read;
use std::path::Path;

/// Sniff MIME from content; never trust the file extension.
pub fn sniff_mime(path: &Path) -> String {
    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return "application/octet-stream".into(),
    };
    let mut buf = [0u8; 8192];
    let n = file.read(&mut buf).unwrap_or(0);
    if n == 0 {
        return "application/x-empty".into();
    }
    infer::get(&buf[..n])
        .map(|t| t.mime_type().to_string())
        .unwrap_or_else(|| {
            if buf[..n].iter().all(|b| b.is_ascii() && (!b.is_ascii_control() || matches!(b, b'\n' | b'\r' | b'\t'))) {
                "text/plain".into()
            } else {
                "application/octet-stream".into()
            }
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn plain_text_not_jpeg_by_extension() {
        let mut f = NamedTempFile::with_suffix(".jpg").unwrap();
        f.write_all(b"not a jpeg at all\n").unwrap();
        let mime = sniff_mime(f.path());
        assert_ne!(mime, "image/jpeg");
        assert!(mime == "text/plain" || mime.starts_with("text/") || mime == "application/octet-stream");
    }
}
