import type { PostStatus } from "@/lib/types";

/**
 * Lo stato di un post, di una richiesta, di un'esecuzione: una mappa sola
 * per tutte le pagine, cosi' «Programmato» ha lo stesso colore nel
 * calendario, nella home e nei risultati.
 */
export type ChipStatus = PostStatus | "running";

interface Spec {
  label: string;
  bg: string;
  fg: string;
  border?: string;
}

export const STATUS_CHIP: Record<ChipStatus, Spec> = {
  draft: { label: "Bozza", bg: "var(--color-paper)", fg: "var(--color-ink)", border: "var(--color-line)" },
  pending_approval: { label: "In approvazione", bg: "var(--color-warm-tint)", fg: "var(--color-warning)" },
  approved: { label: "Approvato", bg: "var(--color-success-bg)", fg: "var(--color-success)" },
  scheduled: { label: "Programmato", bg: "var(--color-wine-tint)", fg: "var(--color-wine)" },
  published: { label: "Pubblicato", bg: "var(--color-success-bg)", fg: "var(--color-success)" },
  failed: { label: "Non riuscito", bg: "var(--color-danger-bg)", fg: "var(--color-danger)" },
  running: { label: "In corso", bg: "var(--color-warm-tint)", fg: "var(--color-warning)" },
};

interface Props {
  status: ChipStatus;
  /** Per dire qualcosa di piu' preciso della mappa, con gli stessi colori. */
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function StatusChip({ status, label, size = "md", className = "" }: Props) {
  const spec = STATUS_CHIP[status];
  return (
    <span
      className={`tv-pill ${size === "sm" ? "h-[22px] px-2.5 text-[11px]" : "h-[26px] px-3 text-[11.5px]"} ${className}`}
      style={{ background: spec.bg, color: spec.fg, border: spec.border ? `1px solid ${spec.border}` : "none" }}
    >
      {label ?? spec.label}
    </span>
  );
}
