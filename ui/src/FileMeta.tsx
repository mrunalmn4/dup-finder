import { formatBytes, type FileRecord } from "./api";

function formatMtime(secs: number | null): string {
  if (secs == null) return "Unknown date";
  try {
    return new Date(secs * 1000).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "Unknown date";
  }
}

export function shortHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

/** Compact metadata strip for keep/candidate rows. */
export default function FileMeta({
  file,
  showHash,
}: {
  file: FileRecord;
  showHash?: boolean;
}) {
  return (
    <dl className="file-meta">
      <div>
        <dt>Size</dt>
        <dd>{formatBytes(file.size)}</dd>
      </div>
      <div>
        <dt>Modified</dt>
        <dd>{formatMtime(file.mtime_secs)}</dd>
      </div>
      <div>
        <dt>Type</dt>
        <dd title={file.mime}>{file.mime.split("/").pop() || file.mime}</dd>
      </div>
      {showHash && (
        <div className="file-meta-hash">
          <dt>BLAKE3</dt>
          <dd title={file.hash}>
            <code>{shortHash(file.hash)}</code>
          </dd>
        </div>
      )}
    </dl>
  );
}
