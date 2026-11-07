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
          <div className="demo-btn pulse">{desktop ? "Choose folders…" : "Add sample folder"}</div>
          <div className="demo-card slide-in">
            <strong>{desktop ? "Pictures" : "fixtures"}</strong>
            <span>{desktop ? "C:\\Users\\You\\Pictures" : "/app/docker/fixtures"}</span>
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
          <div className="demo-ok fade-in">Moved to .dup-finder-trash</div>
        </div>
      </div>
      <figcaption>
        Preview the exact paths, then confirm. Files go to a local trash folder first.
      </figcaption>
    </figure>
  );
}
