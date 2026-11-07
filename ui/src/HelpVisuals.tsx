/** Animated mini-UI demos used as screenshot / GIF stand-ins in Help. */

export function FoldersDemo({ desktop }: { desktop: boolean }) {
  return (
    <figure className="help-figure">
      <div className="demo-frame demo-folders" aria-hidden>
        <div className="demo-chrome">
          <span />
          <span />
          <span />
        </div>
        <div className="demo-body">
          <div className="demo-title">Where should we look?</div>
          <div className="demo-tiles">
            <div className={`demo-tile${desktop ? " on pulse" : ""}`}>
              <em>Drive</em>
              <strong>{desktop ? "D:" : "—"}</strong>
            </div>
            <div className="demo-tile on pulse">
              <em>Folder</em>
              <strong>{desktop ? "Pictures" : "Sample"}</strong>
            </div>
          </div>
          <div className="demo-card slide-in">
            <strong>{desktop ? "Pictures + D:" : "fixtures"}</strong>
            <span>{desktop ? "2 places selected" : "/app/docker/fixtures"}</span>
          </div>
          <div className="demo-cursor" />
        </div>
      </div>
      <figcaption>
        Pick folders with the big button (desktop) or add a path the app can see.
      </figcaption>
    </figure>
  );
}

export function ReviewDemo() {
  return (
    <figure className="help-figure">
      <div className="demo-frame demo-review" aria-hidden>
        <div className="demo-chrome">
          <span />
          <span />
          <span />
        </div>
        <div className="demo-body">
          <div className="demo-group">
            <div className="demo-keep">
              vacation.jpg <span className="demo-badge keep">Keep</span>
            </div>
            <label className="demo-cand">
              <span className="demo-check tick" />
              vacation copy.jpg <span className="demo-badge drop">Suggested</span>
            </label>
            <label className="demo-cand faint">
              <span className="demo-check" />
              IMG_1042.jpg
            </label>
          </div>
        </div>
      </div>
      <figcaption>
        Keep is protected. Tick copies to remove, or use Accept suggestion.
      </figcaption>
    </figure>
  );
}

export function ConfirmDemo() {
  return (
    <figure className="help-figure">
      <div className="demo-frame demo-confirm" aria-hidden>
        <div className="demo-chrome">
          <span />
          <span />
          <span />
        </div>
        <div className="demo-body">
          <div className="demo-preview">
            <div className="demo-path strike">…/vacation copy.jpg</div>
            <div className="demo-path strike delay">…/IMG_1042.jpg</div>
          </div>
          <div className="demo-btn danger pulse-slow">Confirm trash</div>
          <div className="demo-ok fade-in">Moved to OS Trash</div>
        </div>
      </div>
      <figcaption>
        Preview exact paths, then trash (OS Trash when available) or permanently
        delete with a second confirmation.
      </figcaption>
    </figure>
  );
}
