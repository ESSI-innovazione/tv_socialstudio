"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Frame, LoaderCircle, RefreshCw, X } from "lucide-react";
import { FORMATS, type FormatId } from "@/lib/brand";
import { timeAgo } from "@/lib/format";
import { MOCK_VARIANTS } from "@/lib/mock-run";
import type { Template, TemplateChange, TemplateSync } from "@/lib/types";
import { AssetPreview } from "./asset-preview";
import { Card, EmptyState, StatusChip } from "./ui";

export interface LibraryTemplate {
  template: Template;
  state: "in-use" | "new" | "available";
  runs: number;
  usedBy: string[];
}

interface Props {
  items: LibraryTemplate[];
  history: TemplateSync[];
  canSync: boolean;
  configured: boolean;
  figmaUrl: string | null;
}

interface Diff {
  source: { name: string; url: string | null; mock: boolean; lastModified: string | null };
  changes: TemplateChange[];
  at: string;
}

const KIND: Record<TemplateChange["kind"], { label: string; status: "published" | "pending_approval" | "failed" }> = {
  new: { label: "Nuovo", status: "published" },
  modified: { label: "Modificato", status: "pending_approval" },
  removed: { label: "Tolto", status: "failed" },
};

/** Le tre miniature di ogni template: poster, LinkedIn, story. */
const THUMBS: FormatId[] = ["poster-a4", "linkedin", "ig-story"];
const THUMB_WIDTH: Record<FormatId, number> = { "poster-a4": 64, linkedin: 128, "ig-feed": 72, "ig-story": 48 };

function when(iso: string | null): string {
  if (!iso) return "mai";
  return new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/**
 * La libreria dei template e la sincronizzazione in due passi: prima il
 * confronto con quello che c'e', poi la scelta di cosa rendere disponibile.
 * Gli errori di Figma si leggono qui, in italiano, con il rimando a
 * TEMPLATES.md.
 */
export function TemplateLibrary({ items, history, canSync, configured, figmaUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"diff" | "apply" | null>(null);
  const [diff, setDiff] = useState<Diff | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const last = history[0] ?? null;
  const sample = MOCK_VARIANTS[0];

  const check = async () => {
    setBusy("diff");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/templates/sync?dry=1", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as Diff & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Lettura della libreria non riuscita.");
      setDiff(data);
      setAccepted(data.changes.map((c) => c.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    setBusy("apply");
    setError(null);
    try {
      const res = await fetch("/api/templates/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept: accepted }),
      });
      const data = (await res.json().catch(() => ({}))) as { sync?: TemplateSync; written?: number; error?: string };
      if (!res.ok || !data.sync) throw new Error(data.error ?? "Scrittura non riuscita.");
      setNotice(`Fatto: ${data.sync.summary} Il team li vede da adesso; le esecuzioni gia' fatte tengono il template com'era.`);
      setDiff(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ---------------- la libreria ---------------- */}
      <Card tone="night" size="lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px]" style={{ background: "rgba(255,255,255,.10)" }}>
              <Frame size={20} strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: "var(--color-on-wine-faint)" }}>
                Libreria Figma
              </p>
              <h2 className="text-[18px] font-semibold">{diff?.source.name ?? (configured ? "Time Vision Brand 2026" : "Time Vision Brand 2026 (libreria di prova)")}</h2>
              <p className="mt-1 text-[13px]" style={{ color: "var(--color-on-wine)" }} suppressHydrationWarning>
                {last ? `Ultima sincronizzazione ${timeAgo(last.at)}${last.by ? ` · ${last.by.split("@")[0]}` : ""} · ${last.summary}` : "Mai sincronizzata da qui: la libreria in uso e' quella del seme."}
                {!configured ? " · Figma non e' collegato (FIGMA_TOKEN, FIGMA_FILE_KEY): si legge la libreria di prova." : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {figmaUrl ? (
              <a href={figmaUrl} target="_blank" rel="noreferrer" className="tv-pill h-[44px] gap-2 px-4 text-[13px]" style={{ border: "1px solid rgba(255,255,255,.25)", color: "#ffffff" }}>
                Apri in Figma
                <ExternalLink size={14} strokeWidth={2} />
              </a>
            ) : null}
            {canSync ? (
              <button type="button" onClick={check} disabled={busy !== null} className="tv-pill h-[44px] cursor-pointer gap-2 px-5 text-[13.5px]" style={{ background: "var(--color-apricot)", color: "var(--color-ink)" }}>
                {busy === "diff" ? <LoaderCircle size={15} strokeWidth={2.2} className="tv-anim-spin" /> : <RefreshCw size={15} strokeWidth={2.2} />}
                Sincronizza ora
              </button>
            ) : (
              <span className="text-[12.5px]" style={{ color: "var(--color-on-wine)" }}>
                La sincronizzazione la fanno designer e approvatori.
              </span>
            )}
          </div>
        </div>
      </Card>

      {error ? (
        <p role="alert" className="rounded-card px-4 py-3 text-[13px] leading-[1.5]" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-card px-4 py-3 text-[13px] leading-[1.5]" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
          {notice}
        </p>
      ) : null}

      {/* ---------------- il confronto ---------------- */}
      {diff ? (
        <Card as="section" size="lg" aria-labelledby="sync-diff-title" style={{ border: "1.5px solid var(--color-rose)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="sync-diff-title" className="text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>
                Cosa e&apos; cambiato in Figma
              </h2>
              <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>
                Letto {when(diff.at)}. Niente e&apos; stato scritto: scegli cosa rendere disponibile.
              </p>
            </div>
            <button type="button" onClick={() => setDiff(null)} aria-label="Chiudi il confronto" className="flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-[12px] hover:bg-line-soft" style={{ color: "var(--color-ink-soft)" }}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {diff.changes.length === 0 ? (
            <p className="mt-4 rounded-[10px] px-3.5 py-3 text-[13px]" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
              La libreria e&apos; uguale a quella in uso: niente da aggiornare.
            </p>
          ) : (
            <>
              <ul className="mt-4 flex flex-col gap-2">
                {diff.changes.map((c) => {
                  const on = accepted.includes(c.id);
                  return (
                    <li key={c.id}>
                      <label className="flex min-h-[56px] cursor-pointer items-center gap-3.5 rounded-[12px] px-3.5 py-2.5" style={{ background: on ? "var(--color-wine-tint)" : "var(--color-line-soft)" }}>
                        <input type="checkbox" checked={on} onChange={() => setAccepted((prev) => (on ? prev.filter((x) => x !== c.id) : [...prev, c.id]))} className="h-4 w-4 accent-[#720026]" />
                        <span className="shrink-0 overflow-hidden rounded-[6px]" style={{ border: "1px solid var(--color-line)" }}>
                          <AssetPreview variant={sample} format={c.formats[0] ?? "poster-a4"} displayWidth={c.formats[0] === "linkedin" ? 72 : 40} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>
                            {c.name}
                            <StatusChip status={KIND[c.kind].status} label={KIND[c.kind].label} size="sm" />
                          </span>
                          <span className="block text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>
                            {c.description}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button type="button" onClick={() => setDiff(null)} className="tv-pill h-[44px] cursor-pointer px-5 text-[13.5px] hover:bg-line-soft" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}>
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={apply}
                  disabled={busy !== null || accepted.length === 0}
                  className="tv-pill h-[44px] gap-2 px-5 text-[13.5px]"
                  style={{ background: accepted.length > 0 ? "var(--color-wine)" : "var(--color-mute)", color: accepted.length > 0 ? "#ffffff" : "var(--color-ink-soft)", cursor: accepted.length > 0 ? "pointer" : "not-allowed" }}
                >
                  {busy === "apply" ? <LoaderCircle size={15} strokeWidth={2.2} className="tv-anim-spin" /> : <Check size={15} strokeWidth={2.4} />}
                  Rendi disponibili al team ({accepted.length})
                </button>
              </div>
            </>
          )}
        </Card>
      ) : null}

      {/* ---------------- la griglia ---------------- */}
      <section aria-labelledby="library-title">
        <h2 id="library-title" className="pb-3 text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>
          In libreria
        </h2>
        {items.length === 0 ? (
          <EmptyState icon={Frame} title="Nessun template" text="Sincronizza la libreria Figma: i template nelle pagine «TPL/…» compariranno qui." />
        ) : (
          <ul className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {items.map(({ template: t, state, runs, usedBy }) => (
              <li key={t.id}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="flex items-end justify-center gap-3 rounded-[12px] py-3" style={{ background: "var(--color-line-soft)" }}>
                    {THUMBS.filter((f) => t.formats.includes(f)).map((f) => (
                      <span key={f} className="overflow-hidden rounded-[6px]" style={{ border: "1px solid var(--color-line)" }} title={FORMATS[f].label}>
                        <AssetPreview variant={sample} format={f} displayWidth={THUMB_WIDTH[f]} />
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
                      {t.name}
                    </h3>
                    {state === "in-use" ? <StatusChip status="published" label="In uso" size="sm" /> : state === "new" ? <StatusChip status="scheduled" label="Nuovo" size="sm" /> : <StatusChip status="draft" label="Disponibile" size="sm" />}
                  </div>
                  {t.description ? (
                    <p className="text-[12.5px] leading-[1.5]" style={{ color: "var(--color-ink-soft)" }}>
                      {t.description}
                    </p>
                  ) : null}
                  <p className="text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
                    {t.frame_count} {t.frame_count === 1 ? "frame" : "frame"} · {t.formats.map((f) => FORMATS[f]?.label ?? f).join(", ")}
                    {runs > 0 ? ` · ${runs} ${runs === 1 ? "esecuzione" : "esecuzioni"}` : ""}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
                    {usedBy.length > 0 ? `Proposto da: ${usedBy.join(", ")}` : "Nessuno strumento lo propone di default."}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }} suppressHydrationWarning>
                      {t.synced_at ? `sincronizzato ${timeAgo(t.synced_at)}` : "dal seme iniziale"}
                    </span>
                    {figmaUrl && t.figma_node_id ? (
                      <a href={`${figmaUrl}?node-id=${encodeURIComponent(t.figma_node_id)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: "var(--color-rose-ink)" }}>
                        Apri in Figma
                        <ExternalLink size={12} strokeWidth={2} />
                      </a>
                    ) : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- lo storico ---------------- */}
      <section aria-labelledby="sync-history-title">
        <h2 id="sync-history-title" className="pb-3 text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>
          Storico delle sincronizzazioni
        </h2>
        {history.length === 0 ? (
          <p className="tv-card px-5 py-4 text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
            Nessuna sincronizzazione registrata. La prima comparira&apos; qui, con chi l&apos;ha fatta e cosa ha cambiato.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {history.map((s) => (
              <li key={s.id} className="tv-card flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[13px]">
                <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
                  {s.summary}
                </span>
                {s.changes.length > 0 ? (
                  <span style={{ color: "var(--color-ink-soft)" }}>
                    {s.changes.map((c) => `${c.name} (${KIND[c.kind].label.toLowerCase()})`).join(", ")}
                  </span>
                ) : null}
                <span className="ml-auto text-[12px]" style={{ color: "var(--color-ink-faint)" }} suppressHydrationWarning>
                  {s.by?.split("@")[0] ?? "—"} · {when(s.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
