"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Download, PencilRuler, RotateCcw } from "lucide-react";
import { FORMATS, UNVERIFIED, type FormatId } from "@/lib/brand";
import { overallStatus } from "@/lib/brand-guard";
import { durationLabel, timeAgo } from "@/lib/format";
import { archetypeFromLabel, encodeLayout, templateLayout, updateBlock, updateStyle, type AssetLayout, type BlockKind, type BlockText, type LayoutStyle } from "@/lib/layout-model";
import type { ChannelStatus } from "@/lib/publish";
import type { Asset, Campaign, Run, ScheduledPost, Template, Tool, VariantCopy } from "@/lib/types";
import type { StudioUser } from "@/auth";
import { ApprovalBanner } from "./approval-banner";
import { ApprovalStep, latestFor, useApprovals } from "./approval-step";
import { AssetPreview } from "./asset-preview";
import { AssetWorkbench } from "./asset-workbench";
import { PdfDownload } from "./pdf-download";
import { GuardStep } from "./publish-flow";
import { ScheduleCard } from "./schedule-card";
import { Card, PageHeader, SegmentedTabs, StatusChip, type ChipStatus } from "./ui";

interface Props {
  run: Run;
  selected: number;
  onSelect: (index: number) => void;
  onEdit: (index: number, patch: Partial<VariantCopy>) => void;
  onPhoto: (url: string) => void;
  onReset: () => void;
  user: StudioUser;
  channels: ChannelStatus;
  onAssets: (assets: Asset[]) => void;
  tools: Tool[];
  campaigns: Campaign[];
  templates: Template[];
  /**
   * Le impaginazioni toccate, per chiave `variante:formato`. Vivono nella
   * console e non qui, perche' anche l'editor deve conoscerle: il
   * brand-guard controlla quello che si vede, non il template.
   */
  layouts: Record<string, AssetLayout>;
  onLayouts: Dispatch<SetStateAction<Record<string, AssetLayout>>>;
}

type Tab = "testo" | "fonti";

/** Larghezza dell'anteprima grande, per formato: il landscape ha bisogno di respiro. */
const PREVIEW_WIDTH: Record<FormatId, number> = {
  linkedin: 560,
  "ig-feed": 380,
  "poster-a4": 320,
  "ig-story": 240,
};

const THUMB_WIDTH: Record<FormatId, number> = { linkedin: 150, "ig-feed": 96, "poster-a4": 72, "ig-story": 56 };

/**
 * Il risultato: la variante scelta in grande, il controllo del brand sotto,
 * e a destra l'export e la pubblicazione. Sopra, se c'e' una richiesta in
 * attesa, il riquadro per chi approva. Il ritocco serio apre l'editor a
 * tutto schermo.
 */
export function Results({ run, selected, onSelect, onEdit, onPhoto, onReset, user, channels, onAssets, tools, campaigns, templates, layouts, onLayouts: setLayouts }: Props) {
  const variant = run.variants.find((v) => v.index === selected) ?? run.variants[0];

  const [format, setFormat] = useState<FormatId>(run.formats[0] ?? "linkedin");
  const [tab, setTab] = useState<Tab>("testo");
  const [editing, setEditing] = useState(false);
  const [approvals, setApprovals] = useApprovals(run.id);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);

  // I post gia' programmati per questa esecuzione: servono allo stato in testa.
  useEffect(() => {
    let alive = true;
    const from = new Date(Date.now() - 365 * 86_400_000).toISOString();
    const to = new Date(Date.now() + 365 * 86_400_000).toISOString();
    fetch(`/api/publish?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { posts: ScheduledPost[] } | null) => {
        if (alive && data) setPosts(data.posts.filter((p) => p.run_id === run.id));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [run.id]);

  const archetype = archetypeFromLabel(variant?.layout);
  const layoutKey = `${variant?.index ?? 0}:${format}`;

  const text = blockTextOf(variant);
  const layout = layouts[layoutKey] ?? templateLayout(format, archetype, text);
  const onLayoutChange = useCallback(
    (next: AssetLayout) => setLayouts((current) => ({ ...current, [layoutKey]: next })),
    [layoutKey, setLayouts],
  );

  /**
   * Carattere e fondo valgono per tutti i formati della variante: chi sceglie
   * il blu per il poster lo vuole anche sulla story. Ogni formato che non era
   * ancora stato toccato parte dal suo template, con quella scelta sopra.
   */
  const onStyleChange = useCallback(
    (patch: Partial<LayoutStyle>) => {
      if (!variant) return;
      setLayouts((current) => {
        const next = { ...current };
        for (const f of run.formats) {
          const key = `${variant.index}:${f}`;
          next[key] = updateStyle(current[key] ?? templateLayout(f, archetype, text), patch);
        }
        return next;
      });
    },
    [variant, run.formats, archetype, text, setLayouts],
  );

  /** Il colore di un testo, su tutti i formati in cui quel blocco esiste. */
  const onColorChange = useCallback(
    (kind: BlockKind, color: string | undefined) => {
      if (!variant) return;
      setLayouts((current) => {
        const next = { ...current };
        for (const f of run.formats) {
          const key = `${variant.index}:${f}`;
          const base = current[key] ?? templateLayout(f, archetype, text);
          const target = base.blocks.find((b) => b.kind === kind);
          if (!target) continue;
          const patched = updateBlock(base, target.id, { color });
          next[key] = color === undefined
            ? { ...patched, blocks: patched.blocks.map((b) => (b.id === target.id ? stripColor(b) : b)) }
            : patched;
        }
        return next;
      });
    },
    [variant, run.formats, archetype, text, setLayouts],
  );

  if (!variant) return null;

  const assets = run.assets.filter((a) => a.variant_index === variant.index);
  const saved = assets.length > 0;
  const guard = overallStatus(assets.map((a) => a.guard_status));
  const guardOk = guard === "pass" || guard === "warn";
  const latest = latestFor(approvals, variant.index);
  const approved = latest?.status === "approved" || (saved && assets.every((a) => a.approved_at));
  const variantPosts = posts.filter((p) => assets.some((a) => a.id === p.asset_id));

  const tool = tools.find((t) => t.slug === run.tool_slug);
  const campaign = campaigns.find((c) => c.id === run.campaign_id)?.name ?? run.brief?.campaign_name ?? "Senza campagna";
  const template = templates.find((t) => t.id === run.template_id)?.name ?? null;
  const status = statusOf(latest?.status ?? null, approved, variantPosts);
  const modified = Boolean(layouts[layoutKey]);
  const posterLayout = layouts[`${variant.index}:poster-a4`] ?? assets.find((a) => a.format === "poster-a4")?.layout ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-6 md:px-8 md:py-7">
      <PageHeader
        breadcrumb={[{ label: "Strumenti", href: "/studio" }, { label: tool?.title ?? (run.tool_slug === "libero" ? "Brief libero" : run.tool_slug) }]}
        title={`${tool?.title ?? "Brief libero"} · ${campaign}`}
        aside={<StatusChip status={status.chip} label={status.label} />}
        subtitle={
          <span suppressHydrationWarning>
            {run.created_by?.split("@")[0] ?? "—"} · {timeAgo(run.created_at)} · {run.variants.length} {run.variants.length === 1 ? "variante" : "varianti"} in {run.formats.length}{" "}
            {run.formats.length === 1 ? "formato" : "formati"} · {durationLabel(run.duration_ms)}
            {template ? ` · template ${template}` : ""}
          </span>
        }
        actions={
          <button
            type="button"
            onClick={onReset}
            className="tv-pill h-[44px] cursor-pointer gap-2 px-4 text-[13px] transition-colors hover:bg-line-soft"
            style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
          >
            <RotateCcw size={15} strokeWidth={1.9} />
            Nuova creazione
          </button>
        }
      />

      <ApprovalBanner
        approval={latest}
        variantIndex={variant.index}
        user={user}
        onApproval={(a) => setApprovals(approvals.some((x) => x.id === a.id) ? approvals.map((x) => (x.id === a.id ? a : x)) : [...approvals, a])}
        onAssets={onAssets}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------------- sinistra: il lavoro ---------------- */}
        <div className="flex min-w-0 flex-col gap-4">
          <SegmentedTabs<string>
            aria-label="Varianti"
            variant="line"
            value={String(variant.index)}
            onChange={(key) => onSelect(Number(key))}
            items={run.variants.map((v) => ({ key: String(v.index), label: `Variante ${v.index + 1} · ${v.layout}` }))}
          />

          <Card>
            <div className="flex flex-wrap items-center gap-2 pb-4">
              {run.formats.map((f) => {
                const on = f === format;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    aria-pressed={on}
                    className="tv-pill h-[36px] cursor-pointer px-3.5 text-[13px] transition-colors"
                    style={{ background: on ? "var(--color-wine)" : "var(--color-line-soft)", color: on ? "#ffffff" : "var(--color-ink-soft)" }}
                  >
                    {FORMATS[f].label}
                  </button>
                );
              })}
              <span className="ml-auto text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
                {FORMATS[format].exportNote}
              </span>
            </div>

            <div className="flex justify-center rounded-[12px] py-5" style={{ background: "var(--color-line-soft)" }}>
              <AssetPreview variant={variant} format={format} photo={run.brief?.photo} displayWidth={PREVIEW_WIDTH[format]} layout={layout} archetype={archetype} />
            </div>

            {run.formats.length > 1 ? (
              <div className="pt-4">
                <p className="tv-label pb-2">STESSO IMPIANTO, ALTRI FORMATI</p>
                <div className="flex flex-wrap items-end gap-3">
                  {run.formats
                    .filter((f) => f !== format)
                    .map((f) => (
                      <button key={f} type="button" onClick={() => setFormat(f)} className="flex cursor-pointer flex-col items-center gap-1 rounded-[10px] p-1.5 transition-colors hover:bg-line-soft" aria-label={`Mostra ${FORMATS[f].label}`}>
                        <AssetPreview
                          variant={variant}
                          format={f}
                          photo={run.brief?.photo}
                          displayWidth={THUMB_WIDTH[f]}
                          layout={layouts[`${variant.index}:${f}`] ?? templateLayout(f, archetype, text)}
                          archetype={archetype}
                        />
                        <span className="text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
                          {FORMATS[f].label}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-4">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="tv-pill h-[40px] cursor-pointer gap-2 px-4 text-[13px] transition-colors"
                style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}
              >
                <PencilRuler size={14} strokeWidth={2} />
                Ritocca testi e foto nell&apos;editor
                {modified ? <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--color-coral)" }} aria-label="impaginazione modificata" /> : null}
              </button>
            </div>
          </Card>

          <GuardStep run={run} selected={variant.index} assets={assets} layouts={layouts} status={guard} saved={saved} onAssets={onAssets} expanded />

          <Card>
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
          </Card>
        </div>

        {/* ---------------- destra: esporta e pubblica ---------------- */}
        <aside className="flex flex-col gap-4" aria-label="Esporta e pubblica">
          <Card as="section" aria-labelledby="results-export">
            <h2 id="results-export" className="pb-3 text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
              Esporta
            </h2>
            <div className="flex flex-col gap-4">
              {run.formats.includes("poster-a4") ? <PdfDownload runId={run.id} variantIndex={variant.index} variantCount={run.variants.length} layout={posterLayout} /> : null}
              <div className="flex flex-col gap-1.5">
                <p className="tv-label">PNG · VARIANTE {variant.index + 1}</p>
                {run.formats.map((f) => {
                  const custom = layouts[`${variant.index}:${f}`] ?? assets.find((a) => a.format === f)?.layout ?? null;
                  const href = `/api/render/${run.id}/${variant.index}/${f}.png${custom ? `?layout=${encodeLayout(custom)}` : ""}`;
                  return (
                    <a
                      key={f}
                      href={href}
                      download={`timevision-v${variant.index + 1}-${f}.png`}
                      className="tv-pill h-[40px] gap-2 px-3.5 text-[13px] transition-colors hover:bg-line-soft"
                      style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
                    >
                      <Download size={14} strokeWidth={2} style={{ color: "var(--color-rose-ink)" }} />
                      {FORMATS[f].label}
                      <span className="ml-auto text-[11.5px] font-normal" style={{ color: "var(--color-ink-faint)" }}>
                        {FORMATS[f].width}×{FORMATS[f].height}
                      </span>
                    </a>
                  );
                })}
              </div>
              <button type="button" onClick={() => setEditing(true)} className="cursor-pointer self-start text-[12.5px] font-semibold underline-offset-2 hover:underline" style={{ color: "var(--color-rose-ink)" }}>
                MP4 e altri export nell&apos;editor
              </button>
            </div>
          </Card>

          <Card as="section" aria-labelledby="results-approval">
            <h2 id="results-approval" className="pb-3 text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
              Approvazione
            </h2>
            <ApprovalStep run={run} selected={variant.index} guardOk={guardOk} user={user} approvals={approvals} onApprovals={setApprovals} onAssets={onAssets} />
          </Card>

          <Card as="section" aria-labelledby="results-schedule">
            <h2 id="results-schedule" className="pb-3 text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
              Programma la pubblicazione
            </h2>
            <ScheduleCard run={run} assets={assets} approved={approved && guardOk} user={user} channels={channels} posts={posts} onPosts={setPosts} />
          </Card>
        </aside>
      </div>

      {editing ? (
        <AssetWorkbench
          run={run}
          variant={variant}
          format={format}
          onFormat={setFormat}
          layout={layout}
          layouts={layouts}
          archetype={archetype}
          onLayoutChange={onLayoutChange}
          onStyleChange={onStyleChange}
          onColorChange={onColorChange}
          onEdit={(patch) => onEdit(variant.index, patch)}
          onPhoto={onPhoto}
          user={user}
          channels={channels}
          onAssets={onAssets}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Lo stato in testa: il piu' avanzato fra approvazione e pubblicazione. */
function statusOf(approval: "pending" | "approved" | "rejected" | null, approved: boolean, posts: ScheduledPost[]): { chip: ChipStatus; label?: string } {
  if (posts.some((p) => p.status === "published")) return { chip: "published" };
  if (posts.some((p) => p.status === "failed")) return { chip: "failed" };
  if (posts.some((p) => p.status === "scheduled")) return { chip: "scheduled" };
  if (approved) return { chip: "approved" };
  if (approval === "pending") return { chip: "pending_approval" };
  if (approval === "rejected") return { chip: "draft", label: "Da rivedere" };
  return { chip: "draft" };
}

/** Il testo della variante nella forma che il modello di impaginazione legge. */
function blockTextOf(variant: VariantCopy | undefined): BlockText {
  return {
    eyebrow: variant?.eyebrow ?? "",
    headline: variant?.headline ?? "",
    subhead: variant?.subhead ?? "",
    body: variant?.body ?? "",
    badge: variant?.badge ?? null,
    disclaimer: variant?.disclaimer ?? null,
  };
}

/** Un blocco senza la chiave `color`, non con `color: undefined`: il confronto col template lo pretende. */
function stripColor<T extends { color?: string }>(block: T): T {
  const rest = { ...block };
  delete rest.color;
  return rest;
}

function Tabs({ tab, onTab, facts }: { tab: Tab; onTab: (t: Tab) => void; facts: number }) {
  return (
    <SegmentedTabs<Tab>
      aria-label="Testo e fonti"
      variant="line"
      value={tab}
      onChange={onTab}
      items={[
        { key: "testo", label: "Testo" },
        { key: "fonti", label: "Dati e fonti", count: facts > 0 ? facts : undefined },
      ]}
    />
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
        style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)", fontSize: size === "lg" ? 17 : 14, fontWeight: size === "lg" ? 600 : 400, minHeight: 44 }}
      />
    </label>
  );
}
