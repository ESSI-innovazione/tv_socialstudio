"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { assetFileName, assetFileUrl } from "@/lib/asset-url";
import { FORMATS, type FormatId } from "@/lib/brand";
import { archetypeFromLabel, templateLayout } from "@/lib/layout-model";
import type { Asset, VariantCopy } from "@/lib/types";
import { AssetPreview } from "./asset-preview";

export interface ArchiveCard {
  asset: Asset;
  variant: VariantCopy;
  runId: string;
  instruction: string;
  photo: string | null;
  campaignId: string | null;
  campaign: string;
  author: string;
  captions: string[];
}

interface Props {
  cards: ArchiveCard[];
  /** Vero quando l'archivio e' vuoto del tutto, non solo per i filtri. */
  empty: boolean;
}

const PREVIEW_WIDTH: Record<FormatId, number> = { linkedin: 268, "ig-feed": 200, "poster-a4": 150, "ig-story": 118 };

function when(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Un asset per card: anteprima com'e' stato approvato, provenienza, azioni. */
export function ArchiveGrid({ cards, empty }: Props) {
  if (cards.length === 0) {
    return (
      <p className="tv-card px-5 py-6 text-[14px]" style={{ color: "var(--color-ink-soft)" }}>
        {empty ? "L'archivio e' ancora vuoto: qui compare ogni asset che un approvatore ha approvato." : "Nessun asset con questi filtri."}
      </p>
    );
  }

  return (
    <ul className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
      {cards.map((card) => (
        <Card key={card.asset.id} card={card} />
      ))}
    </ul>
  );
}

function Card({ card }: { card: ArchiveCard }) {
  const { asset, variant } = card;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const format = asset.format as FormatId;
  const archetype = archetypeFromLabel(variant.layout);
  const layout =
    asset.layout ??
    templateLayout(format, archetype, {
      eyebrow: variant.eyebrow,
      headline: variant.headline,
      subhead: variant.subhead,
      body: variant.body,
      badge: variant.badge,
      disclaimer: variant.disclaimer,
    });

  const duplicate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${card.runId}/duplicate`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { run?: { id: string }; error?: string };
      if (!res.ok || !data.run) throw new Error(data.error ?? "Non sono riuscito a duplicare.");
      router.push(`/studio?run=${data.run.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <li className="tv-card flex flex-col gap-3 p-4">
      <div className="flex justify-center rounded-[10px] py-3" style={{ background: "var(--color-line-soft)" }}>
        <AssetPreview variant={variant} format={format} photo={card.photo ?? undefined} displayWidth={PREVIEW_WIDTH[format] ?? 200} layout={layout} archetype={archetype} />
      </div>

      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--color-rose)" }}>
          <span className="truncate">{card.campaign}</span>
          <span className="tv-pill ml-auto h-[22px] shrink-0 px-2.5 text-[11px]" style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}>
            {FORMATS[format]?.label ?? format}
          </span>
        </p>
        <h2 className="mt-1 truncate text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
          {variant.headline}
        </h2>
        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-[1.45]" style={{ color: "var(--color-ink-soft)" }}>
          {variant.subhead}
        </p>
      </div>

      <dl className="flex flex-col gap-1 text-[12px]" style={{ color: "var(--color-ink-soft)" }}>
        <div className="flex gap-2">
          <dt className="w-[76px] shrink-0" style={{ color: "var(--color-ink-faint)" }}>
            Autore
          </dt>
          <dd className="truncate">{card.author}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-[76px] shrink-0" style={{ color: "var(--color-ink-faint)" }}>
            Approvato
          </dt>
          <dd className="flex min-w-0 items-center gap-1.5">
            <ShieldCheck size={13} strokeWidth={2.2} className="shrink-0" style={{ color: "var(--color-success)" }} />
            <span className="truncate" suppressHydrationWarning>
              {asset.approved_by ?? "—"} · {when(asset.approved_at)}
            </span>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-[76px] shrink-0" style={{ color: "var(--color-ink-faint)" }}>
            Variante
          </dt>
          <dd>
            {asset.variant_index + 1} · {variant.layout}
          </dd>
        </div>
      </dl>

      {error ? (
        <p className="text-[12px]" style={{ color: "var(--color-warning)" }}>
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        <a
          href={assetFileUrl(asset, "png")}
          download={assetFileName(asset, "png")}
          className="tv-pill h-[36px] gap-1.5 px-3.5 text-[12.5px] transition-colors hover:bg-line-soft"
          style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
        >
          <Download size={14} strokeWidth={2} style={{ color: "var(--color-rose)" }} />
          Scarica
        </a>
        <button
          type="button"
          onClick={duplicate}
          disabled={busy}
          className="tv-pill h-[36px] cursor-pointer gap-1.5 px-3.5 text-[12.5px] transition-colors hover:bg-line-soft"
          style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)", cursor: busy ? "wait" : "pointer" }}
        >
          {busy ? <LoaderCircle size={14} strokeWidth={2.2} className="tv-anim-spin" /> : <Copy size={14} strokeWidth={2} />}
          Duplica
        </button>
        <Link
          href={`/studio?run=${card.runId}`}
          className="tv-pill ml-auto h-[36px] gap-1.5 px-3 text-[12.5px] transition-colors hover:bg-line-soft"
          style={{ color: "var(--color-wine)" }}
        >
          Apri
          <ExternalLink size={13} strokeWidth={2} />
        </Link>
      </div>
    </li>
  );
}
