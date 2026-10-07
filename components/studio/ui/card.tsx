import type { CSSProperties, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** `lg` per le card che contengono altre card: raggio 18 invece di 14. */
  size?: "md" | "lg";
  /** Senza riempimento interno, per chi impagina da solo. */
  flush?: boolean;
  /** La card vino scura: scadenze, libreria Figma. */
  tone?: "paper" | "wine" | "night";
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "article" | "li";
  "aria-labelledby"?: string;
  id?: string;
}

const TONES: Record<NonNullable<Props["tone"]>, CSSProperties> = {
  paper: {},
  wine: { background: "var(--color-wine)", color: "#ffffff", borderColor: "transparent" },
  night: { background: "var(--color-night-glass)", color: "#ffffff", borderColor: "transparent" },
};

/** La card del sistema: bianco, bordo linea, raggio 14 o 18, ombra vino. */
export function Card({ children, size = "md", flush = false, tone = "paper", className = "", style, as: Tag = "div", id, ...rest }: Props) {
  return (
    <Tag
      id={id}
      aria-labelledby={rest["aria-labelledby"]}
      className={`tv-card ${size === "lg" ? "rounded-card-lg" : ""} ${flush ? "" : "p-5"} ${className}`}
      style={{ ...TONES[tone], ...style }}
    >
      {children}
    </Tag>
  );
}
