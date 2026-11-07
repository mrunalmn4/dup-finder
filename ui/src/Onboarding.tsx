import { useEffect, useLayoutEffect, useState } from "react";

type Props = {
  desktop: boolean;
  onDone: () => void;
  /** Ensure Folders step is visible so tour targets exist. */
  onPrepare: () => void;
};

type Rect = { top: number; left: number; width: number; height: number };

type Step = {
  target: string | null;
  title: string;
  body: string;
};

const PAD = 8;

export default function Onboarding({ desktop, onDone, onPrepare }: Props) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const steps: Step[] = [
    {
      target: "tour-brand",
      title: "Welcome to Dup Finder",
      body: "Find duplicate files by what is inside them — even if the name changed. Everything stays on your computer.",
    },
    {
      target: "tour-folders",
      title: "Choose folders to scan",
      body: desktop
        ? "Tap drive and folder tiles to select them (several at once). Browse for more if you need another path."
        : "Tap the tiles listed from the API machine. Connect in Settings first. Your real Mac/Windows drives need the desktop app.",
    },
    {
      target: "tour-scan",
      title: "Scan when you are ready",
      body: "After at least one folder is listed, tap Scan. You will see how many files were checked and how much space duplicates use.",
    },
    {
      target: "tour-stepper",
      title: "Review, then confirm",
      body: "Progress moves Folders → Review → Confirm. Nothing is removed on Review — you tick copies, preview exact paths, then Trash (OS Trash when available) or permanently delete with a second confirmation.",
    },
    {
      target: "tour-help",
      title: "Help anytime",
      body: "Open Help for picture guides of each step. You can replay this highlighted tour with Show tour.",
    },
  ];

  const step = steps[i]!;
  const last = i === steps.length - 1;

  useEffect(() => {
    onPrepare();
  }, [onPrepare]);

  useLayoutEffect(() => {
    function measure() {
      if (!step.target) {
        setRect(null);
        return;
      }
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      setRect({
        top: Math.max(0, r.top - PAD),
        left: Math.max(0, r.left - PAD),
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      });
    }

    measure();
    const t = window.setTimeout(measure, 280);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [i, step.target]);

  const tooltipStyle = (() => {
    if (!rect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      } as const;
    }
    const below = rect.top + rect.height + 16;
    const spaceBelow = window.innerHeight - below;
    const preferBelow = spaceBelow > 200 || rect.top < 180;
    if (preferBelow) {
      return {
        top: Math.min(below, window.innerHeight - 16),
        left: Math.min(
          Math.max(16, rect.left),
          window.innerWidth - 336,
        ),
      } as const;
    }
    return {
      bottom: window.innerHeight - rect.top + 16,
      left: Math.min(
        Math.max(16, rect.left),
        window.innerWidth - 336,
      ),
    } as const;
  })();

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
      <div className="tour-dim" aria-hidden />
      {rect && (
        <div
          className="tour-hole"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
          aria-hidden
        />
      )}
      <div className="tour-card panel" style={tooltipStyle}>
        <p className="meta">
          Step {i + 1} of {steps.length}
        </p>
        <h2 id="onboard-title">{step.title}</h2>
        <p className="onboard-body">{step.body}</p>
        <div className="row" style={{ marginTop: "1.1rem" }}>
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
