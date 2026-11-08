import type { FileRecord } from "./api";
import FileMeta, { shortHash } from "./FileMeta";
import Thumb from "./Thumb";
import { keepReasonDetail, keepReasonLabel } from "./suggestLabels";

type Props = {
  keep: FileRecord;
  other: FileRecord;
  keepReason: string;
  onClose: () => void;
  onKeepOther: () => void;
};

export default function CompareModal({
  keep,
  other,
  keepReason,
  onClose,
  onKeepOther,
}: Props) {
  const sameHash = keep.hash === other.hash;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal panel compare-modal"
        role="dialog"
        aria-labelledby="compare-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2 id="compare-title">Compare copies</h2>
          <button type="button" className="ghost compact" onClick={onClose}>
            Close
          </button>
        </div>
        <p className={`compare-verify${sameHash ? " ok" : " error"}`}>
          {sameHash
            ? `Identical content verified — same BLAKE3 (${shortHash(keep.hash)})`
            : "Hashes differ — these are not the same file content."}
        </p>
        <p className="meta">{keepReasonDetail(keepReason)}</p>
        <div className="compare-grid">
          <article className="compare-card keep-card">
            <header>
              <span className="badge">keep</span>
              <span className="badge reason">{keepReasonLabel(keepReason)}</span>
            </header>
            <Thumb path={keep.path} mime={keep.mime} />
            <p className="path" title={keep.path}>
              {keep.path}
            </p>
            <FileMeta file={keep} showHash />
          </article>
          <article className="compare-card">
            <header>
              <span className="badge drop">candidate</span>
            </header>
            <Thumb path={other.path} mime={other.mime} />
            <p className="path" title={other.path}>
              {other.path}
            </p>
            <FileMeta file={other} showHash />
            <button type="button" className="primary" onClick={onKeepOther}>
              Keep this instead
            </button>
          </article>
        </div>
      </div>
    </div>
  );
}
