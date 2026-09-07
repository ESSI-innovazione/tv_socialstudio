"use client";

import { Play, ShieldCheck } from "lucide-react";

interface Props {
  ready: boolean;
  /** Cosa manca, oppure cosa sta per succedere. */
  hint: string;
  onRun: () => void;
}

/**
 * La barra fissa in fondo alla colonna. Il bottone non scorre mai via: e'
 * l'unica azione primaria della composizione, e sta sempre nello stesso posto.
 *
 * E' `sticky` dentro la colonna che scorre, e in fondo al flusso: non copre
 * mai il contenuto, ci si appoggia sotto.
 */
export function RunBar({ ready, hint, onRun }: Props) {
  return (
    <div
      className="sticky bottom-0 z-20 -mx-8 mt-2 flex items-center justify-between gap-4 px-8 py-3.5"
      style={{
        background: "rgb(251 247 245 / 0.92)",
        backdropFilter: "blur(8px)",
        borderTop: "1px solid var(--color-line)",
      }}
    >
      <p className="flex min-w-0 items-center gap-2 text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
        {ready ? (
          <ShieldCheck size={15} strokeWidth={2} className="shrink-0" style={{ color: "var(--color-success)" }} />
        ) : null}
        <span className="truncate">{hint}</span>
      </p>

      <button
        type="button"
        onClick={onRun}
        disabled={!ready}
        className="tv-pill h-[50px] shrink-0 gap-2.5 px-7 text-[15px] transition-all"
        style={{
          background: ready ? "var(--color-coral)" : "var(--color-mute)",
          color: "#ffffff",
          boxShadow: ready ? "var(--shadow-coral)" : "none",
          cursor: ready ? "pointer" : "not-allowed",
        }}
      >
        <Play size={17} strokeWidth={2.4} fill="currentColor" />
        Crea gli asset
      </button>
    </div>
  );
}
