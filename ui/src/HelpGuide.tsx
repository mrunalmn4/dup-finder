import {
  ConfirmDemo,
  FoldersDemo,
  ModesDemo,
  ReviewDemo,
} from "./HelpVisuals";

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
          Picture guides below animate like a short GIF. For a live walkthrough
          that highlights each part of the screen, start the tour.
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

        <h3>Setup style</h3>
        <ModesDemo />
        <p className="help-p">
          First time (or after <strong>Change mode</strong>), pick Simple, Smart,
          Guided, or Advanced. Simple hides extras; Advanced shows filters,
          profiles, restore, and index options. If you already have a Review or
          Confirm in progress, that resume screen appears first — mode chooser
          waits until you finish or go back to Folders.
        </p>

        <h3>1. Choose folders &amp; drives</h3>
        <FoldersDemo desktop={desktop} />
        <p className="help-p">
          Tap tiles under Drives &amp; disks or Folders — you can select several.
          Use presets (Common folders, Disks only, Sample demo), exclude
          subfolders, set max depth, or include hidden files. Browse for more in
          the desktop app. Under “What should we look for?” toggle file types,
          set min/max size, and edit skip names (node_modules, .git, …). Advanced
          mode also saves profiles and can restore files from{" "}
          <code>.dup-finder-trash</code>.
        </p>

        <h3>Scan</h3>
        <p className="help-p">
          Tap Scan when at least one place is selected. Progress shows files
          seen; you can Cancel a running scan. Refreshing mid-Review usually
          restores the last session on this device (the API scan must still
          exist).
        </p>

        <h3>2. Review duplicates</h3>
        <ReviewDemo />
        <p className="help-p">
          The suggested keep stays protected — tick only copies you want
          removed, or use <strong>Accept suggestion</strong>. A short keep
          reason explains why that path was chosen;{" "}
          <strong>Keep this instead</strong> or <strong>Compare</strong> lets
          you change it. Use <strong>Keep rule</strong> (Newest / Shortest path
          / Prefer folder) and <strong>Apply to all groups</strong> to re-pick
          keeps in bulk. <strong>Re-verify now</strong> re-checks BLAKE3 hashes
          live. Sort and filter by space, caution, or same/across folders.
          Export JSON/CSV/HTML anytime. Keyboard: j/k groups, ↑/↓ candidates, Space
          select, Enter Compare. Critical or caution badges mean the path looks
          like system files, an app, or keys (.ssh) — leave those unchecked
          unless you are sure.
        </p>
        <p className="help-p">
          <strong>Similar images</strong> finds near-duplicate photos by visual
          fingerprint (dHash), with a confidence label. Tick copies and{" "}
          <strong>Add ticked similar to delete selection</strong> — that is not
          the same as exact byte matches above; review carefully.
        </p>

        <h3>3. Confirm remove</h3>
        <ConfirmDemo />
        <p className="help-p">
          Preview lists exact paths. Trash uses the OS Trash / Recycle Bin when
          available; otherwise files go to <code>.dup-finder-trash</code>. After
          trash, a summary shows about how much space you freed, and Undo can
          restore from quarantine when that fallback was used. Permanent delete
          needs a second confirmation (type <strong>DELETE</strong>). Each file
          is re-hashed immediately before remove. Contents and hashes never leave
          this machine.
        </p>

        <h3>Settings</h3>
        <p className="help-p">
          Connect to the local API, switch Light / Dark / System theme, Comfortable
          or Compact density, set a reclaimable-space notification threshold, and
          manage scheduled jobs when the API supports them.
        </p>
      </div>
    </div>
  );
}
