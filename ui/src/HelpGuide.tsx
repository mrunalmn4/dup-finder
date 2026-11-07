import { ConfirmDemo, FoldersDemo, ReviewDemo } from "./HelpVisuals";

type Props = {
  desktop: boolean;
  onClose: () => void;
  onStartTour: () => void;
};

export default function HelpGuide({ desktop, onClose, onStartTour }: Props) {
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

        <p className="help-p" style={{ marginTop: 0 }}>
          Picture guides below animate like a short GIF. For a live walkthrough that
          highlights each part of the screen, start the tour.
        </p>
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className="primary"
            onClick={() => {
              onClose();
              onStartTour();
            }}
          >
            Start highlighted tour
          </button>
        </div>

        <h3>1. Choose folders &amp; drives</h3>
        <FoldersDemo desktop={desktop} />
        <p className="help-p">
          Tap tiles under Drives &amp; disks or Folders — you can select several.
          Use presets (Common folders, Disks only), exclude subfolders, set max
          depth, or include hidden files. Browse for more in the desktop app.
        </p>

        <h3>What to scan</h3>
        <p className="help-p">
          Under “What should we look for?” toggle Photos / Videos / Documents /
          Audio / Archives, set min/max size, and edit skip names (node_modules,
          .git, …). Your last choices are remembered on this device.
        </p>

        <h3>2. Review duplicates</h3>
        <ReviewDemo />
        <p className="help-p">
          Critical or caution badges mean the path looks like system files, an
          app, or keys (.ssh). Prefer leaving those unchecked.
        </p>

        <h3>3. Confirm remove</h3>
        <ConfirmDemo />
        <p className="help-p">
          Trash uses the OS Trash / Recycle Bin when available; otherwise files
          go to <code>.dup-finder-trash</code>. Permanent delete needs a second
          confirmation (type DELETE). Contents and hashes never leave this machine.
        </p>
      </div>
    </div>
  );
}
