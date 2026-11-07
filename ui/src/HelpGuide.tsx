type Props = {
  desktop: boolean;
  onClose: () => void;
};

export default function HelpGuide({ desktop, onClose }: Props) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal panel help-modal">
        <div className="panel-head">
          <h2 id="help-title">Help & guides</h2>
          <button type="button" className="ghost compact" onClick={onClose}>
            Close
          </button>
        </div>

        <h3>Quick start</h3>
        <ol className="help-list">
          <li>
            {desktop
              ? "Choose folders with the big button (Pictures, Downloads, or a whole drive like D:\\)."
              : "Add a folder the API can see, or use the sample folder in Docker."}
          </li>
          <li>Tap Scan and wait for results.</li>
          <li>
            Review each group. Keep is protected. Tick copies you want to remove, or
            use Accept suggestion.
          </li>
          <li>Preview delete, then confirm Trash — files move to .dup-finder-trash.</li>
        </ol>

        <h3>Choosing folders</h3>
        <p className="help-p">
          We never scan your whole computer unless you pick those locations. On
          Windows use drive letters (D:\Photos). On Mac/Linux use folders or
          volumes (/Volumes/Backup).
        </p>

        <h3>Warnings you may see</h3>
        <p className="help-p">
          Critical or caution badges mean the path looks like system files, an
          app, or keys (.ssh). Prefer leaving those unchecked.
        </p>

        <h3>Privacy</h3>
        <p className="help-p">
          File contents and hashes stay on this machine. There is no cloud upload.
        </p>

        <h3>Need the tour again?</h3>
        <p className="help-p">
          Close this panel and use <strong>Show tour</strong> in the header.
        </p>
      </div>
    </div>
  );
}
