import { MODE_CARDS, type SetupMode } from "./setupMode";

type Props = {
  onPick: (mode: SetupMode) => void;
};

export default function ModeChooser({ onPick }: Props) {
  return (
    <section className="panel mode-chooser" aria-labelledby="mode-chooser-title">
      <h2 id="mode-chooser-title">How do you want to set up your scan?</h2>
      <p className="meta" style={{ marginBottom: "1.1rem" }}>
        Pick a style that fits you. You can change this later anytime you’re on
        Folders and not mid-scan.
      </p>
      <div className="mode-grid" role="list">
        {MODE_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            className="mode-card"
            role="listitem"
            onClick={() => onPick(card.id)}
          >
            <strong className="mode-card-title">{card.title}</strong>
            <span className="mode-card-blurb">{card.blurb}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
