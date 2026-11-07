use crate::error::EngineError;
use crate::model::FileRecord;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::{Path, PathBuf};

/// On-disk content-hash cache for resumable scans (SQLite).
pub struct ScanIndex {
    conn: Connection,
    path: PathBuf,
}

impl ScanIndex {
    pub fn open(path: &Path) -> Result<Self, EngineError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| EngineError::Io {
                path: parent.to_path_buf(),
                source: e,
            })?;
        }
        let conn = Connection::open(path).map_err(|e| EngineError::Message(format!("index open: {e}")))?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             CREATE TABLE IF NOT EXISTS files (
               path TEXT PRIMARY KEY NOT NULL,
               size INTEGER NOT NULL,
               mtime_secs INTEGER,
               device INTEGER,
               inode INTEGER,
               hash TEXT NOT NULL,
               mime TEXT NOT NULL
             );",
        )
        .map_err(|e| EngineError::Message(format!("index schema: {e}")))?;
        Ok(Self {
            conn,
            path: path.to_path_buf(),
        })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Return cached record only if identity fingerprint still matches.
    pub fn lookup_fresh(
        &self,
        path: &Path,
        size: u64,
        mtime_secs: Option<i64>,
        device: Option<u64>,
        inode: Option<u64>,
    ) -> Result<Option<FileRecord>, EngineError> {
        let path_s = path.to_string_lossy().to_string();
        let row = self
            .conn
            .query_row(
                "SELECT size, mtime_secs, device, inode, hash, mime FROM files WHERE path = ?1",
                params![path_s],
                |r| {
                    Ok((
                        r.get::<_, i64>(0)? as u64,
                        r.get::<_, Option<i64>>(1)?,
                        r.get::<_, Option<i64>>(2)?.map(|v| v as u64),
                        r.get::<_, Option<i64>>(3)?.map(|v| v as u64),
                        r.get::<_, String>(4)?,
                        r.get::<_, String>(5)?,
                    ))
                },
            )
            .optional()
            .map_err(|e| EngineError::Message(format!("index lookup: {e}")))?;

        let Some((c_size, c_mtime, c_dev, c_ino, hash, mime)) = row else {
            return Ok(None);
        };
        if c_size != size || c_mtime != mtime_secs || c_dev != device || c_ino != inode {
            return Ok(None);
        }
        Ok(Some(FileRecord {
            path: path.to_path_buf(),
            size,
            hash,
            mime,
            mtime_secs,
            device,
            inode,
        }))
    }

    pub fn upsert(&self, rec: &FileRecord) -> Result<(), EngineError> {
        let path_s = rec.path.to_string_lossy().to_string();
        self.conn
            .execute(
                "INSERT INTO files(path, size, mtime_secs, device, inode, hash, mime)
                 VALUES(?1,?2,?3,?4,?5,?6,?7)
                 ON CONFLICT(path) DO UPDATE SET
                   size=excluded.size,
                   mtime_secs=excluded.mtime_secs,
                   device=excluded.device,
                   inode=excluded.inode,
                   hash=excluded.hash,
                   mime=excluded.mime",
                params![
                    path_s,
                    rec.size as i64,
                    rec.mtime_secs,
                    rec.device.map(|v| v as i64),
                    rec.inode.map(|v| v as i64),
                    rec.hash,
                    rec.mime,
                ],
            )
            .map_err(|e| EngineError::Message(format!("index upsert: {e}")))?;
        Ok(())
    }

    pub fn len(&self) -> Result<usize, EngineError> {
        let n: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM files", [], |r| r.get(0))
            .map_err(|e| EngineError::Message(format!("index count: {e}")))?;
        Ok(n as usize)
    }
}
