type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  /** Accessible name when the control isn’t wrapped by a visible label. */
  "aria-label"?: string;
};

/** Theme-matched checkbox used everywhere (Review, Folders, quarantine). */
export default function Checkbox({
  checked,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <span className={`check${className ? ` ${className}` : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="check-ui" aria-hidden />
    </span>
  );
}
