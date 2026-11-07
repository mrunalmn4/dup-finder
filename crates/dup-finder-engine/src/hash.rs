use crate::error::EngineError;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const PARTIAL_CHUNK: u64 = 64 * 1024;

/// Full-file BLAKE3 hex digest.
pub fn blake3_file(path: &Path) -> Result<String, EngineError> {
    let mut file = File::open(path).map_err(|e| EngineError::Io {
        path: path.to_path_buf(),
        source: e,
    })?;
    let mut hasher = blake3::Hasher::new();
    let mut buf = [0u8; 1024 * 64];
    loop {
        let n = file.read(&mut buf).map_err(|e| EngineError::Io {
            path: path.to_path_buf(),
            source: e,
        })?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

/// Fast reject key: size + first/last chunks (still content-based).
pub fn partial_fingerprint(path: &Path, size: u64) -> Result<String, EngineError> {
    let mut file = File::open(path).map_err(|e| EngineError::Io {
        path: path.to_path_buf(),
        source: e,
    })?;
    let mut hasher = blake3::Hasher::new();
    hasher.update(&size.to_le_bytes());

    let first_len = PARTIAL_CHUNK.min(size) as usize;
    let mut first = vec![0u8; first_len];
    file.read_exact(&mut first).map_err(|e| EngineError::Io {
        path: path.to_path_buf(),
        source: e,
    })?;
    hasher.update(&first);

    if size > PARTIAL_CHUNK {
        let back = PARTIAL_CHUNK.min(size - PARTIAL_CHUNK);
        file.seek(SeekFrom::End(-(back as i64)))
            .map_err(|e| EngineError::Io {
                path: path.to_path_buf(),
                source: e,
            })?;
        let mut last = vec![0u8; back as usize];
        file.read_exact(&mut last).map_err(|e| EngineError::Io {
            path: path.to_path_buf(),
            source: e,
        })?;
        hasher.update(&last);
    }

    Ok(hasher.finalize().to_hex().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn identical_bytes_same_hash() {
        let mut a = NamedTempFile::new().unwrap();
        let mut b = NamedTempFile::new().unwrap();
        a.write_all(b"same-bytes").unwrap();
        b.write_all(b"same-bytes").unwrap();
        assert_eq!(blake3_file(a.path()).unwrap(), blake3_file(b.path()).unwrap());
    }

    #[test]
    fn different_bytes_different_hash() {
        let mut a = NamedTempFile::new().unwrap();
        let mut b = NamedTempFile::new().unwrap();
        a.write_all(b"aaa").unwrap();
        b.write_all(b"bbb").unwrap();
        assert_ne!(blake3_file(a.path()).unwrap(), blake3_file(b.path()).unwrap());
    }
}
