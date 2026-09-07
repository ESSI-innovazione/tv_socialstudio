"use client";

import { useCallback, useState } from "react";
import { Check, ChevronDown, CircleAlert, PencilRuler, RotateCcw, TriangleAlert } from "lucide-react";
import { FORMATS, UNVERIFIED, type FormatId } from "@/lib/brand";
import { durationLabel } from "@/lib/format";
import { archetypeFromLabel, templateLayout, type AssetLayout, type BlockText } from "@/lib/layout-model";
import type { GuardCheck, Run, VariantCopy } from "@/lib/types";
import type { StudioUser } from "@/auth";
import { AssetPreview } from "./asset-preview";
import { AssetWorkbench } from "./asset-workbench";

interface Props {
  run: Run;
  selected: number;
  onSelect: (index: number) => void;
  onEdit: (index: number, patch: Partial<VariantCopy>) => void;
  onPhoto: (url: string) => void;
  onReset: () => void;
  user: StudioUser;
  channelsLive: boolean;
}

type Tab = "testo" | "fonti";

/** Larghezza dell'anteprima grande, per formato: il landscape ha bisogno di respiro. */
const PREVIEW_WIDTH: Record<FormatId, number> = {
  linkedin: 620,
  "ig-feed": 400,
  "poster-a4": 330,
  "ig-story": 250,
};

/**
 * Il risultato: scegli una variante, guardala grande, e fai una cosa sola.
 *
 * Il ritocco leggero — il testo — sta sotto, in una scheda. Quello serio
 * apre l'editor a tutto schermo, dove stanno anche export e pubblicazione.
 */
export function Results({ run, selected, onSelect, onEdit, onPhoto, onReset, user, channelsLive }: Props) {
  const variant = run.variants.find((v) => v.index === selected) ?? run.variants[0];
  const blocking = run.guard.some((c) => c.status === "fail");

  const [format, setFormat] = useState<FormatId>(run.formats[0] ?? "linkedin");
  const [tab, setTab] = useState<Tab>("testo");
  const [editing, setEditing] = useState(false);
  const [layouts, setLayouts] = useState<Record<string, AssetLayout>>({});

  const archetype = archetypeFromLabel(variant?.layout);
  const layoutKey = `${variant?.index ?? 0}:${format}`;

  const text: BlockText = {
    eyebrow: variant?.eyebrow ?? "",
    headline: variant?.headline ?? "",
    subhead: variant?.subhead ?? "",
    body: variant?.body ?? "",
    badge: variant?.badge ?? null,
    disclaimer: variant?.disclaimer ?? null,
  };
  const layout = layouts[layoutKey] ?? templateLayout(format, archetype, text);
  const onLayoutChange = useCallback(
    (next: AssetLayout) => setLayouts((current) => ({ ...current, [layoutKey]: next })),
    [layoutKey],
  );
  const modified = Boolean(layouts[layoutKey]);

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-8 py-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]" style={{ color: "var(--color-ink)" }}>
            Asset pronti
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--color-ink-soft)" }}>
            {run.variants.length} varianti · {run.assets.length} asset · {durationLabel(run.duration_ms)}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="tv-pill h-[38px] cursor-pointer gap-2 px-4 text-[13px] transition-colors hover:bg-line-soft"
          style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
        >
          <RotateCcw size={15} strokeWidth={1.9} />
          Nuova creazione
        </button>
      </header>

      <GuardSummary checks={run.guard} blocking={blocking} />

      {/* ---------------- varianti ---------------- */}
      <section>
        <p className="tv-label pb-2.5">SCEGLI LA VARIANTE</p>
        <div className="grid grid-cols-3 gap-3">
          {run.variants.map((v) => {
            const on = v.index === selected;
            return (
              <button
                key={v.index}
                type="button"
                onClick={() => onSelect(v.index)}
                aria-pressed={on}
                className="flex cursor-pointer flex-col gap-2 rounded-card bg-paper p-2 text-left transition-[border-color,box-shadow]"
                style={{
                  border: `1.5px solid ${on ? "var(--color-rose)" : "var(--color-line)"}`,
                  boxShadow: on ? "0 0 0 3px rgb(206 66 87 / 0.12)" : "none",
                }}
              >
                <div className="flex justify-center">
                  <AssetPreview variant={v} format={run.formats[0] ?? "linkedin"} photo={run.brief?.photo} displayWidth={228} />
                </div>
                <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
                  <span className="truncate text-[13px]" style={{ color: on ? "var(--color-wine)" : "var(--color-ink-soft)", fontWeight: on ? 600 : 400 }}>
                    {v.layout}
                  </span>
                  {on ? <Check size={15} strokeWidth={2.6} className="shrink-0" style={{ color: "var(--color-rose)" }} /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------------- anteprima grande ---------------- */}
      {variant ? (
        <section className="tv-card p-5">
          <div className="flex flex-wrap items-center gap-2 pb-4">
            {run.formats.map((f) => {
              const on = f === format;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  aria-pressed={on}
                  className="tv-pill h-[34px] cursor-pointer px-3.5 text-[13px] transition-colors"
                  style={{ background: on ? "var(--color-wine)" : "var(--color-line-soft)", color: on ? "#ffffff" : "var(--color-ink-soft)" }}
                >
                  {FORMATS[f].label}
                </button>
              );
            })}
            <span className="ml-auto text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
              {FORMATS[format].exportNote}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="tv-pill h-[34px] cursor-pointer gap-2 px-3.5 text-[13px] transition-colors"
              style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}
            >
              <PencilRuler size={14} strokeWidth={2} />
              Modifica
              {modified ? <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--color-coral)" }} aria-label="impaginazione modificata" /> : null}
            </button>
          </div>

          <div className="flex justify-center rounded-[12px] py-5" style={{ background: "var(--color-line-soft)" }}>
            <AssetPreview variant={variant} format={format} photo={run.brief?.photo} displayWidth={PREVIEW_WIDTH[format]} />
          </div>

          <Tabs tab={tab} onTab={setTab} facts={run.brief?.facts.length ?? 0} />

          <div className="tv-anim-rise pt-4" key={tab}>
            {tab === "testo" ? (
              <div className="flex flex-col gap-3">
                <p className="text-[12.5px]" style={{ color: "var(--color-ink-faint)" }}>
                  Una modifica qui vale per tutti i formati. Per tutto il resto, apri l&apos;editor.
                </p>
                <Field label="Occhiello" value={variant.eyebrow} onChange={(eyebrow) => onEdit(variant.index, { eyebrow })} />
                <Field label="Titolo" value={variant.headline} size="lg" onChange={(headline) => onEdit(variant.index, { headline })} />
                <Field label="Sottotitolo" value={variant.subhead} onChange={(subhead) => onEdit(variant.index, { subhead })} />
                <Field label="Banda" value={variant.badge ?? ""} onChange={(badge) => onEdit(variant.index, { badge: badge || null })} />
              </div>
            ) : null}

            {tab === "fonti" && run.brief ? (
              <ul className="flex flex-col gap-2">
                {run.brief.facts.map((fact) => (
                  <li
                    key={fact.claim}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[10px] px-3 py-2"
                    style={{ background: fact.verified ? "var(--color-line-soft)" : "var(--color-warm-tint)" }}
                  >
                    <span className="min-w-[168px] text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                      {fact.claim}
                    </span>
                    <span className="text-[13px]" style={{ color: fact.verified ? "var(--color-ink-soft)" : "var(--color-warning)", fontWeight: fact.verified ? 400 : 600 }}>
                      {fact.value}
                    </span>
                    <span className="ml-auto text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
                      {fact.source}
                    </span>
                  </li>
                ))}
                <li className="pt-1 text-[12px] leading-[1.5]" style={{ color: "var(--color-ink-faint)" }}>
                  I dati segnati {UNVERIFIED} non compaiono sugli asset finché una fonte non li conferma.
                </li>
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      {editing && variant ? (
        <AssetWorkbench
          run={run}
          variant={variant}
          format={format}
          onFormat={setFormat}
          layout={layout}
          archetype={archetype}
          onLayoutChange={onLayoutChange}
          onEdit={(patch) => onEdit(variant.index, patch)}
          onPhoto={onPhoto}
          user={user}
          channelsLive={channelsLive}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Tabs({ tab, onTab, facts }: { tab: Tab; onTab: (t: Tab) => void; facts: number }) {
  const items: { key: Tab; label: string; badge?: string }[] = [
    { key: "testo", label: "Testo" },
    { key: "fonti", label: "Dati e fonti", badge: facts > 0 ? String(facts) : undefined },
  ];
  return (
    <div role="tablist" className="mt-4 flex gap-1" style={{ borderBottom: "1px solid var(--color-line)" }}>
      {items.map((item) => {
        const on = item.key === tab;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onTab(item.key)}
            className="-mb-px flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-[13.5px] transition-colors"
            style={{ color: on ? "var(--color-wine)" : "var(--color-ink-soft)", fontWeight: on ? 600 : 500, borderBottom: `2px solid ${on ? "var(--color-wine)" : "transparent"}` }}
          >
            {item.label}
            {item.badge ? (
              <span className="tv-pill h-[18px] px-1.5 text-[10.5px]" style={{ background: on ? "var(--color-wine-tint)" : "var(--color-line-soft)", color: on ? "var(--color-wine)" : "var(--color-ink-faint)" }}>
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, size = "sm" }: { label: string; value: string; onChange: (v: string) => void; size?: "sm" | "lg" }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="tv-label">{label.toUpperCase()}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] px-3 py-2.5 outline-none transition-[border-color,box-shadow] focus:shadow-focus"
        style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)", fontSize: size === "lg" ? 17 : 14, fontWeight: size === "lg" ? 600 : 400 }}
      />
    </label>
  );
}

/** Il controllo del brand in una riga. Le singole verifiche si aprono solo se servono. */
function GuardSummary({ checks, blocking }: { checks: GuardCheck[]; blocking: boolean }) {
  const [open, setOpen] = useState(blocking);
  const passed = checks.filter((c) => c.status === "pass").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const failed = checks.filter((c) => c.status === "fail").length;

  const tone = failed > 0
    ? { bg: "#fdecea", fg: "#8c1d18", Icon: CircleAlert }
    : warned > 0
      ? { bg: "var(--color-warm-tint)", fg: "var(--color-warning)", Icon: TriangleAlert }
      : { bg: "var(--color-success-bg)", fg: "var(--color-success)", Icon: Check };
  const { Icon } = tone;

  const line = failed > 0
    ? `Controllo del brand: ${failed} ${failed === 1 ? "verifica fallita" : "verifiche fallite"}. La pubblicazione è bloccata.`
    : warned > 0
      ? `Controllo del brand: ${passed} ok, ${warned} ${warned === 1 ? "avviso" : "avvisi"}.`
      : `Controllo del brand: tutte le ${passed} verifiche superate.`;

  return (
    <section className="rounded-card px-4 py-3" style={{ background: tone.bg }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full cursor-pointer items-center gap-2.5 text-left text-[13.5px] font-semibold" style={{ color: tone.fg }}>
        <Icon size={16} strokeWidth={2.4} className="shrink-0" />
        <span className="flex-1">{line}</span>
        <ChevronDown size={16} strokeWidth={2.2} className="shrink-0 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open ? (
        <ul className="tv-anim-rise mt-2.5 flex flex-col gap-1 pl-[26px]">
          {checks.map((check) => (
            <li key={check.key} className="flex flex-wrap gap-x-2 text-[13px]" style={{ color: "var(--color-ink)" }}>
              <span className="font-semibold">{check.label}</span>
              {check.detail ? <span style={{ color: "var(--color-ink-soft)" }}>{check.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
