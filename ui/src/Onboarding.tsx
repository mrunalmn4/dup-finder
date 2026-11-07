import { useState } from "react";

type Props = {
  desktop: boolean;
  onDone: () => void;
};

export default function Onboarding({ desktop, onDone }: Props) {
  const [i, setI] = useState(0);
  const titles = [
    "Welcome to Dup Finder",
    "Choose folders to scan",
    "Review before anything is removed",
    "Safe trash",
  ];
  const bodies = [
    "Find duplicate files by what is inside them — even if the name or extension changed. Everything stays on your computer.",
    desktop
      ? "Tap “Choose folders” and pick places like Pictures or Downloads. You can add several folders or whole drives. We only look where you choose."
      : "In the desktop app you pick folders with a file chooser. In this browser demo, use the sample folder button or a path the API can see (Docker: /app/docker/fixtures).",
    "We suggest what to keep and what looks like a copy. Nothing is deleted until you preview and confirm. System and app folders get an extra warning.",
    "Confirmed copies go to a .dup-finder-trash folder next to the original (not a permanent wipe). Open Help anytime from the top of the screen.",
  ];
  const last = i === titles.length - 1;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboard-title"
    >
      <div className="modal panel">
        <p className="meta">
          Step {i + 1} of {titles.length}
        </p>
        <h2 id="onboard-title">{titles[i]}</h2>
        <p className="onboard-body">{bodies[i]}</p>
        <div className="row" style={{ marginTop: "1.25rem" }}>
          {i > 0 && (
            <button type="button" className="ghost" onClick={() => setI((x) => x - 1)}>
              Back
            </button>
          )}
          <button type="button" className="ghost" onClick={onDone}>
            Skip
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => (last ? onDone() : setI((x) => x + 1))}
          >
            {last ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
