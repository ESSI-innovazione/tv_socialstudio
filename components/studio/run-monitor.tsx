"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Circle, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { FORMATS } from "@/lib/brand";
import { clock, durationLabel } from "@/lib/format";
import { activeStep, progressOf } from "@/lib/run-events";
import type { Run, RunStep } from "@/lib/types";
import { AssetPreview } from "./asset-preview";

interface Props {
  run: Run;
  onCancel: () => void;
}

/**
 * L'esecuzione, vista da chi aspetta: cosa sta succedendo adesso, quanto
 * manca, e gli asset che arrivano. Il log tecnico c'e' ma sta chiuso.
 */
export function RunMonitor({ run, onCancel }: Props) {
  const started = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - started.current), 200);
    return () => clearInterval(t);
  }, []);

  const progress = progressOf(run);
  const current = activeStep(run);

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-5 px-8 py-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]" style={{ color: "var(--color-ink)" }}>
            {current ? current.label : "Quasi pronto"}
          </h1>
          <p className="mt-1 line-clamp-1 text-[13.5px]" style={{ color: "var(--color-ink-soft)" }}>
            {run.instruction}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="tv-pill h-[34px] px-3.5 text-[13px] tabular-nums" style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }}>
            {durationLabel(elapsed)}
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="tv-pill h-[34px] cursor-pointer gap-1.5 px-3.5 text-[13px] transition-colors hover:bg-line-soft"
            style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
          >
            <X size={14} strokeWidth={2.2} />
            Interrompi
          </button>
        </div>
      </header>

      <div
        className="h-[6px] w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-line-soft)" }}
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avanzamento"
      >
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(3, progress * 100)}%`, background: "var(--color-coral)" }} />
      </div>

      <section className="tv-card p-5">
        <ol className="flex flex-col gap-0.5">
          {run.steps.map((step) => (
            <StepRow key={step.key} step={step} />
          ))}
        </ol>
      </section>

      {run.assets.length > 0 ? (
        <section>
          <div className="flex items-baseline justify-between pb-2.5">
            <p className="tv-label">ASSET PRONTI</p>
            <span className="text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
              {run.assets.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {run.assets.slice(-8).map((asset) => {
              const variant = run.variants.find((v) => v.index === asset.variant_index);
              if (!variant) return null;
              return (
                <figure key={asset.id} className="tv-anim-rise overflow-hidden rounded-card bg-paper p-2" style={{ border: "1px solid var(--color-line)" }}>
                  <AssetPreview variant={variant} format={asset.format} photo={run.brief?.photo} displayWidth={132} />
                  <figcaption className="pt-1.5 text-center text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
                    {FORMATS[asset.format].label}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ) : null}

      <LogStream logs={run.logs} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StepRow({ step }: { step: RunStep }) {
  const tone =
    step.status === "done"
      ? { fg: "var(--color-ink)", weight: 500 }
      : step.status === "active"
        ? { fg: "var(--color-warning)", weight: 600 }
        : step.status === "failed"
          ? { fg: "#8c1d18", weight: 600 }
          : { fg: "var(--color-ink-faint)", weight: 400 };

  return (
    <li className="flex items-center gap-3 rounded-[10px] px-2.5 py-2.5" style={{ background: step.status === "active" ? "var(--color-warm-tint)" : "transparent" }}>
      <StepIcon status={step.status} />
      <span className="text-[14px]" style={{ color: tone.fg, fontWeight: tone.weight }}>
        {step.label}
      </span>
      {step.detail ? (
        <span className="text-[12.5px]" style={{ color: "var(--color-ink-faint)" }}>
          {step.detail}
        </span>
      ) : null}
      {step.duration_ms ? (
        <span className="ml-auto text-[12px] tabular-nums" style={{ color: "var(--color-ink-faint)" }}>
          {durationLabel(step.duration_ms)}
        </span>
      ) : null}
    </li>
  );
}

function StepIcon({ status }: { status: RunStep["status"] }) {
  if (status === "done") {
    return (
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
        <Check size={13} strokeWidth={2.6} />
      </span>
    );
  }
  if (status === "active") {
    return <LoaderCircle size={22} strokeWidth={2.2} className="tv-anim-spin shrink-0" style={{ color: "var(--color-coral)" }} />;
  }
  if (status === "failed") {
    return <TriangleAlert size={22} strokeWidth={2} className="shrink-0" style={{ color: "#8c1d18" }} />;
  }
  return <Circle size={22} strokeWidth={1.6} className="shrink-0" style={{ color: "var(--color-mute)" }} />;
}

/** Il log tecnico. Chiuso di default: serve a chi cerca un guasto, non a chi aspetta. */
function LogStream({ logs }: { logs: Run["logs"] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [logs.length, open]);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold"
        style={{ color: "var(--color-ink-faint)" }}
      >
        <ChevronDown size={15} strokeWidth={2.2} className="transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
        {open ? "Nascondi dettagli" : "Mostra dettagli"} ({logs.length})
      </button>

      {open ? (
        <div className="tv-anim-rise mt-2.5 overflow-hidden rounded-card" style={{ background: "var(--color-wine)" }}>
          <div ref={box} className="tv-scroll max-h-[200px] overflow-y-auto px-4 py-3">
            {logs.length === 0 ? (
              <p className="tv-mono text-[12px]" style={{ color: "var(--color-on-wine-faint)" }}>
                in attesa del primo evento…
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {logs.map((line, i) => (
                  <li key={`${line.at}-${i}`} className="tv-mono flex gap-2.5 text-[11.5px] leading-[1.5]">
                    <span className="shrink-0 tabular-nums" style={{ color: "var(--color-on-wine-faint)" }}>
                      {clock(line.at)}
                    </span>
                    <span className="shrink-0 font-semibold" style={{ color: "var(--color-apricot)" }}>
                      {line.source}
                    </span>
                    <span style={{ color: "var(--color-on-wine)" }}>{line.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
