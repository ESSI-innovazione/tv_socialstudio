"use client";

import { useCallback, useState } from "react";
import { Check, CircleAlert, FileDown, RotateCcw, TriangleAlert } from "lucide-react";
import { FORMATS, type FormatId } from "@/lib/brand";
import { UNVERIFIED } from "@/lib/brand";
import { durationLabel } from "@/lib/format";
import {
  archetypeFromLabel,
  defaultLayout,
  type AssetLayout,
} from "@/lib/layout-model";
import type { GuardCheck, Run, VariantCopy } from "@/lib/types";
import { AssetPreview } from "./asset-preview";
import { AssetEditor } from "./asset-editor";

interface Props {
  run: Run;
  selected: number;
  onSelect: (index: number) => void;
  onEdit: (index: number, patch: Partial<VariantCopy>) => void;
  onReset: () => void;
}

export function Results({ run, selected, onSelect, onEdit, onReset }: Props) {
  const variant = run.variants.find((v) => v.index === selected) ?? run.variants[0];
  const blocking = run.guard.some((c) => c.status === "fail");

  // Il formato che si sta impaginando. Gli altri si allineano da soli.
  const [editFormat, setEditFormat] = useState<FormatId>(run.formats[0] ?? "linkedin");

  /**
   * Un layout per coppia variante-formato. Finche' non e' stato toccato, la
   * chiave non esiste e vale quello del template.
   */
  const [layouts, setLayouts] = useState<Record<string, AssetLayout>>({});

  const archetype = archetypeFromLabel(variant?.layout);
  const layoutKey = `${variant?.index ?? 0}:${editFormat}`;
  const layout = layouts[layoutKey] ?? defaultLayout(editFormat, archetype);

  const onLayoutChange = useCallback(
    (next: AssetLayout) => setLayouts((current) => ({ ...current, [layoutKey]: next })),
    [layoutKey],
  );

  return (
    <div className="flex flex-col gap-6 px-8 py-7">
      <header className="tv-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="flex h-[20px] w-[20px] items-center justify-center rounded-full"
                style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
              >
                <Check size={13} strokeWidth={2.6} />
              </span>
              <p className="tv-label" style={{ color: "var(--color-success)" }}>
                ESECUZIONE CONCLUSA
              </p>
            </div>
            <p
              className="mt-2 line-clamp-2 max-w-[52ch] text-[14px] leading-[1.5]"
              style={{ color: "var(--color-ink)" }}
            >
              {run.instruction}
            </p>
            <p className="mt-2 text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
              {run.variants.length} varianti · {run.assets.length} asset ·{" "}
              {durationLabel(run.duration_ms)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="tv-pill h-[38px] gap-2 px-4 text-[13px] transition-colors"
              style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
            >
              <FileDown size={15} strokeWidth={1.9} />
              Scarica tutto
            </button>
            <button
              type="button"
              onClick={onReset}
              className="tv-pill h-[38px] gap-2 px-4 text-[13px] transition-colors"
              style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}
            >
              <RotateCcw size={15} strokeWidth={1.9} />
              Nuova istruzione
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {run.guard.map((check) => (
            <GuardChip key={check.key} check={check} />
          ))}
        </div>

        {blocking ? (
          <p
            className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px]"
            style={{ background: "#fdecea", color: "#8c1d18" }}
          >
            Brand guard ha bloccato la pubblicazione. Correggi le verifiche fallite per procedere.
          </p>
        ) : null}
      </header>

      {/* ---------------- varianti ---------------- */}
      <section>
        <div className="flex items-baseline justify-between pb-2.5">
          <p className="tv-label">VARIANTI</p>
          <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
            seleziona quella da declinare e pubblicare
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {run.variants.map((v) => {
            const on = v.index === selected;
            const primary = run.formats[0] ?? "linkedin";
            return (
              <button
                key={v.index}
                type="button"
                onClick={() => onSelect(v.index)}
                aria-pressed={on}
                className="flex flex-col gap-2.5 rounded-card bg-paper p-2.5 text-left transition-all"
                style={{
                  border: `1.5px solid ${on ? "var(--color-rose)" : "var(--color-line)"}`,
                  boxShadow: on ? "var(--shadow-card)" : "var(--shadow-card-soft)",
                }}
              >
                <div className="flex justify-center">
                  <AssetPreview
                    variant={v}
                    format={primary}
                    photo={run.brief?.photo}
                    displayWidth={196}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
                  <span
                    className="truncate text-[12.5px]"
                    style={{
                      color: on ? "var(--color-wine)" : "var(--color-ink-soft)",
                      fontWeight: on ? 600 : 400,
                    }}
                  >
                    {v.layout}
                  </span>
                  <span
                    className="tv-pill h-[20px] shrink-0 px-2 text-[10.5px]"
                    style={{
                      background: on ? "var(--color-wine-tint)" : "var(--color-line-soft)",
                      color: on ? "var(--color-wine)" : "var(--color-ink-faint)",
                    }}
                  >
                    V{v.index + 1}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------------- testo condiviso ---------------- */}
      {variant ? (
        <section className="tv-card p-5">
          <div className="flex items-baseline justify-between pb-3">
            <p className="tv-label">TESTO DELLA VARIANTE {variant.index + 1}</p>
            <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
              una modifica qui si propaga a tutti i formati
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <Field
              label="Occhiello"
              value={variant.eyebrow}
              onChange={(eyebrow) => onEdit(variant.index, { eyebrow })}
            />
            <Field
              label="Titolo"
              value={variant.headline}
              size="lg"
              onChange={(headline) => onEdit(variant.index, { headline })}
            />
            <Field
              label="Sottotitolo"
              value={variant.subhead}
              onChange={(subhead) => onEdit(variant.index, { subhead })}
            />
            <Field
              label="Banda"
              value={variant.badge ?? ""}
              onChange={(badge) => onEdit(variant.index, { badge: badge || null })}
            />
          </div>
        </section>
      ) : null}

      {/* ---------------- impaginazione ---------------- */}
      {variant ? (
        <section className="tv-card p-5">
          <div className="flex flex-wrap items-center gap-2 pb-3">
            {run.formats.map((format) => {
              const on = format === editFormat;
              return (
                <button
                  key={format}
                  type="button"
                  onClick={() => setEditFormat(format)}
                  aria-pressed={on}
                  className="tv-pill h-[32px] px-3.5 text-[12.5px] transition-colors"
                  style={{
                    background: on ? "var(--color-wine)" : "var(--color-line-soft)",
                    color: on ? "#ffffff" : "var(--color-ink-soft)",
                  }}
                >
                  {FORMATS[format].label}
                </button>
              );
            })}
            <div className="flex-1" />
            {layouts[layoutKey] ? (
              <span
                className="tv-pill h-[26px] px-2.5 text-[11px]"
                style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }}
              >
                impaginazione modificata
              </span>
            ) : null}
          </div>

          <AssetEditor
            copy={variant}
            layout={layout}
            archetype={archetype}
            photo={run.brief?.photo ?? "tv-digitale.jpg"}
            onChange={onLayoutChange}
            width={editFormat === "linkedin" ? 420 : editFormat === "ig-story" ? 220 : 300}
          />
        </section>
      ) : null}

      {/* ---------------- declinazioni ---------------- */}
      {variant ? (
        <section>
          <div className="flex items-baseline justify-between pb-2.5">
            <p className="tv-label">DECLINAZIONI</p>
            <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
              ogni formato mantiene la propria griglia
            </span>
          </div>
          <div className="flex flex-wrap items-start gap-4">
            {run.formats.map((format) => {
              const spec = FORMATS[format];
              const asset = run.assets.find(
                (a) => a.format === format && a.variant_index === variant.index,
              );
              return (
                <figure
                  key={format}
                  className="rounded-card bg-paper p-2.5"
                  style={{ border: "1px solid var(--color-line)" }}
                >
                  <AssetPreview
                    variant={variant}
                    format={format}
                    photo={run.brief?.photo}
                    displayWidth={format === "linkedin" ? 260 : 168}
                  />
                  <figcaption className="pt-2">
                    <p className="text-[12px] font-semibold" style={{ color: "var(--color-ink)" }}>
                      {spec.label}
                    </p>
                    <p className="text-[10.5px]" style={{ color: "var(--color-ink-faint)" }}>
                      {spec.exportNote}
                    </p>
                    {asset ? (
                      <p
                        className="tv-mono pt-1 text-[9.5px]"
                        style={{ color: "var(--color-ink-faint)" }}
                        title={`Fonti: ${asset.source_documents.join(", ")}`}
                      >
                        {asset.source_documents.length} fonti registrate
                      </p>
                    ) : null}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ---------------- provenienza ---------------- */}
      {run.brief ? (
        <section className="tv-card p-5">
          <p className="tv-label pb-3">DATI E FONTI</p>
          <ul className="flex flex-col gap-2">
            {run.brief.facts.map((fact) => (
              <li
                key={fact.claim}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[10px] px-3 py-2"
                style={{
                  background: fact.verified ? "var(--color-line-soft)" : "var(--color-warm-tint)",
                }}
              >
                <span
                  className="min-w-[168px] text-[12.5px] font-semibold"
                  style={{ color: "var(--color-ink)" }}
                >
                  {fact.claim}
                </span>
                <span
                  className="text-[12.5px]"
                  style={{
                    color: fact.verified ? "var(--color-ink-soft)" : "var(--color-warning)",
                    fontWeight: fact.verified ? 400 : 600,
                  }}
                >
                  {fact.value}
                </span>
                <span
                  className="tv-mono ml-auto text-[10.5px]"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  {fact.source}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] leading-[1.5]" style={{ color: "var(--color-ink-faint)" }}>
            I dati marcati {UNVERIFIED} non compaiono sugli asset finché non vengono confermati da
            una fonte.
          </p>
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Field({
  label,
  value,
  onChange,
  size = "sm",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "lg";
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="tv-label">{label.toUpperCase()}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] px-3 py-2.5 outline-none transition-colors focus:border-rose"
        style={{
          border: "1px solid var(--color-line)",
          background: "var(--color-paper)",
          color: "var(--color-ink)",
          fontSize: size === "lg" ? 17 : 13.5,
          fontWeight: size === "lg" ? 600 : 400,
        }}
      />
    </label>
  );
}

function GuardChip({ check }: { check: GuardCheck }) {
  const tone =
    check.status === "pass"
      ? { bg: "var(--color-success-bg)", fg: "var(--color-success)", Icon: Check }
      : check.status === "warn"
        ? { bg: "var(--color-warm-tint)", fg: "var(--color-warning)", Icon: TriangleAlert }
        : { bg: "#fdecea", fg: "#8c1d18", Icon: CircleAlert };
  const { Icon } = tone;
  return (
    <span
      className="tv-pill h-[28px] gap-1.5 px-3 text-[11.5px]"
      style={{ background: tone.bg, color: tone.fg }}
      title={check.detail ?? undefined}
    >
      <Icon size={13} strokeWidth={2.2} />
      {check.label}
    </span>
  );
}
