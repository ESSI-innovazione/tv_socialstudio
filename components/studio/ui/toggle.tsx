"use client";

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** L'etichetta letta dallo screen reader, quando non c'e' un testo accanto. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

/** Un interruttore vero: `role="switch"`, spazio e invio lo girano. */
export function Toggle({ checked, onChange, disabled = false, size = "md", ...rest }: Props) {
  const w = size === "sm" ? 36 : 44;
  const h = size === "sm" ? 20 : 24;
  const knob = h - 6;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest["aria-label"]}
      aria-labelledby={rest["aria-labelledby"]}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex shrink-0 items-center rounded-full transition-colors"
      style={{
        width: w,
        height: h,
        // L'area di tocco resta 44px anche quando il disegno e' piccolo.
        boxShadow: "0 0 0 0 transparent",
        background: checked ? "var(--color-wine)" : "var(--color-mute)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        aria-hidden
        className="absolute rounded-full transition-transform"
        style={{
          width: knob,
          height: knob,
          left: 3,
          background: "#ffffff",
          transform: checked ? `translateX(${w - knob - 6}px)` : "none",
        }}
      />
    </button>
  );
}
