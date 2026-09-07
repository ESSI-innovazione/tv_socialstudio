"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  number: number;
  title: string;
  /** Una riga che riassume la scelta fatta, mostrata quando il passo e' chiuso. */
  summary: string | null;
  done: boolean;
  open: boolean;
  onOpen: () => void;
  children: ReactNode;
}

/**
 * Un passo della composizione. Aperto mostra i controlli; chiuso si riduce a
 * una riga con il numero, il titolo e cosa e' stato scelto.
 *
 * I numeri non sono decorazione: l'ordine conta davvero, perche' lo strumento
 * scelto al passo 1 decide i formati del passo 3.
 */
export function StepCard({ number, title, summary, done, open, onOpen, children }: Props) {
  const headingId = `step-${number}-title`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-card-lg bg-paper transition-[border-color,box-shadow]"
      style={{
        border: `1.5px solid ${open ? "var(--color-rose)" : "var(--color-line)"}`,
        boxShadow: open ? "var(--shadow-card)" : "none",
      }}
    >
      {open ? (
        <div className="flex items-center gap-3.5 px-5 pt-5 pb-1">
          <StepBadge number={number} done={done} active />
          <h2 id={headingId} className="text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>
            {title}
          </h2>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={false}
          className="flex w-full cursor-pointer items-center gap-3.5 rounded-card-lg px-5 py-4 text-left transition-colors hover:bg-line-soft"
        >
          <StepBadge number={number} done={done} active={false} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              id={headingId}
              className="text-[15px] font-semibold"
              style={{ color: done ? "var(--color-ink)" : "var(--color-ink-soft)" }}
            >
              {title}
            </span>
            {summary ? (
              <span className="truncate text-[13px]" style={{ color: "var(--color-ink-faint)" }}>
                {summary}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-[13px] font-semibold" style={{ color: "var(--color-rose)" }}>
            {done ? "Modifica" : "Apri"}
          </span>
        </button>
      )}

      {open ? <div className="tv-anim-rise px-5 pt-3 pb-5">{children}</div> : null}
    </section>
  );
}

function StepBadge({ number, done, active }: { number: number; done: boolean; active: boolean }) {
  const filled = done && !active;
  return (
    <span
      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums"
      style={{
        background: filled ? "var(--color-success-bg)" : active ? "var(--color-wine)" : "var(--color-line-soft)",
        color: filled ? "var(--color-success)" : active ? "#ffffff" : "var(--color-ink-faint)",
      }}
      aria-hidden
    >
      {filled ? <Check size={15} strokeWidth={2.8} /> : number}
    </span>
  );
}
