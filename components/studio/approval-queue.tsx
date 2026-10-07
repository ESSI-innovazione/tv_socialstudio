"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, ExternalLink, LoaderCircle, TriangleAlert, Undo2 } from "lucide-react";
import { FORMATS, type FormatId } from "@/lib/brand";
import { timeAgo } from "@/lib/format";
import { archetypeFromLabel, templateLayout } from "@/lib/layout-model";
import type { Approval, Asset, Run, VariantCopy } from "@/lib/types";
import { AssetPreview } from "./asset-preview";

export interface QueueItem {
  approval: Approval;
  run: Run;
  variant: VariantCopy;
  assets: Asset[];
  campaign: string;
}

interface Props {
  pending: QueueItem[];
  decided: QueueItem[];
}

const PREVIEW_WIDTH: Record<FormatId, number> = { linkedin: 360, "ig-feed": 260, "poster-a4": 200, "ig-story": 150 };

/**
 * La coda, una richiesta per riga: l'anteprima com'e' stata controllata,
 * chi chiede e perche', il verdetto del brand-guard, e i due pulsanti.
 */
export function ApprovalQueue({ pending, decided }: Props) {
  return (
    <>
      {pending.length === 0 ? (
        <p className="tv-card px-5 py-6 text-[14px]" style={{ color: "var(--color-ink-soft)" }}>
          Tutto approvato o rimandato. Le nuove richieste compariranno qui, e arriveranno anche via email.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {pending.map((item) => (
            <PendingCard key={item.approval.id} item={item} />
          ))}
        </ul>
      )}

      {decided.length > 0 ? (
        <section className="pt-4">
          <p className="tv-label pb-3">ULTIME DECISIONI</p>
          <ul className="flex flex-col gap-1.5">
            {decided.map(({ approval, run, campaign }) => {
              const ok = approval.status === "approved";
              return (
                <li key={approval.id} className="tv-card flex items-center gap-3 px-4 py-3 text-[13px]">
                  <span className="tv-pill h-[24px] shrink-0 px-2.5 text-[11px]" style={{ background: ok ? "var(--color-success-bg)" : "#fdecea", color: ok ? "var(--color-success)" : "#8c1d18" }}>
                    {ok ? "approvata" : "rimandata"}
                  </span>
                  <span className="min-w-0 flex-1 truncate" style={{ color: "var(--color-ink)" }}>
                    <span className="font-semibold">{campaign}</span> · variante {approval.variant_index + 1} · {run.instruction}
                  </span>
                  <span className="shrink-0 text-[12px]" style={{ color: "var(--color-ink-faint)" }} suppressHydrationWarning>
                    {approval.approver_name}
                    {approval.decided_at ? ` · ${timeAgo(approval.decided_at)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function PendingCard({ item }: { item: QueueItem }) {
  const { approval, run, variant, assets, campaign } = item;
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<FormatId>(assets[0]?.format ?? run.formats[0] ?? "linkedin");

  const asset = assets.find((a) => a.format === format) ?? assets[0];
  const archetype = archetypeFromLabel(variant.layout);
  const layout =
    asset?.layout ??
    templateLayout(format, archetype, {
      eyebrow: variant.eyebrow,
      headline: variant.headline,
      subhead: variant.subhead,
      body: variant.body,
      badge: variant.badge,
      disclaimer: variant.disclaimer,
    });

  const warnings = assets.flatMap((a) => (a.guard ?? []).filter((c) => c.status !== "pass").map((c) => `${FORMATS[a.format]?.label ?? a.format}: ${c.label} · ${c.detail ?? ""}`));

  const decide = async (decision: "approved" | "rejected") => {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${approval.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "La decisione non e' stata registrata.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return (
    <li className="tv-card flex gap-5 p-5">
      <div className="flex shrink-0 flex-col gap-2">
        <AssetPreview variant={variant} format={format} photo={run.brief?.photo} displayWidth={PREVIEW_WIDTH[format]} layout={layout} archetype={archetype} />
        {assets.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setFormat(a.format)}
                aria-pressed={a.format === format}
                className="tv-pill h-[26px] cursor-pointer px-2.5 text-[11px]"
                style={{ background: a.format === format ? "var(--color-wine)" : "var(--color-line-soft)", color: a.format === format ? "#ffffff" : "var(--color-ink-soft)" }}
              >
                {FORMATS[a.format]?.label ?? a.format}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <p className="text-[12px] font-semibold" style={{ color: "var(--color-rose)" }}>
            {campaign} · variante {approval.variant_index + 1}
          </p>
          <h2 className="mt-0.5 text-[17px] font-semibold leading-[1.3]" style={{ color: "var(--color-ink)" }}>
            {variant.headline}
          </h2>
          <p className="mt-1 text-[13px] leading-[1.5]" style={{ color: "var(--color-ink-soft)" }}>
            {variant.subhead}
          </p>
        </div>

        <p className="text-[12.5px]" style={{ color: "var(--color-ink-faint)" }} suppressHydrationWarning>
          Chiesta da <span style={{ color: "var(--color-ink)" }}>{approval.requested_by ?? "—"}</span> · {timeAgo(approval.created_at)} ·{" "}
          {assets.map((a) => FORMATS[a.format]?.label ?? a.format).join(", ")}
        </p>
        {approval.note ? (
          <p className="rounded-[10px] px-3 py-2 text-[13px] leading-[1.5]" style={{ background: "var(--color-line-soft)", color: "var(--color-ink)" }}>
            «{approval.note}»
          </p>
        ) : null}

        <div className="flex items-start gap-2 text-[12.5px] leading-[1.45]" style={{ color: warnings.length ? "var(--color-warning)" : "var(--color-success)" }}>
          {warnings.length ? <TriangleAlert size={15} strokeWidth={2.2} className="mt-[1px] shrink-0" /> : <Check size={15} strokeWidth={2.4} className="mt-[1px] shrink-0" />}
          <span>
            {warnings.length === 0 ? "Controllo del brand superato su tutti i formati." : (
              <>
                <span className="font-semibold">Controllo del brand con avvisi:</span>
                <ul className="mt-1 flex flex-col gap-0.5" style={{ color: "var(--color-ink-soft)" }}>
                  {warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </>
            )}
          </span>
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Commento per chi ha chiesto (obbligatorio se rimandi indietro)"
          className="tv-scroll w-full resize-none rounded-[10px] px-3 py-2.5 text-[13px] leading-[1.5] outline-none focus:shadow-focus"
          style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }}
        />

        {error ? (
          <p className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--color-warning)" }}>
            <CircleAlert size={14} strokeWidth={2.2} />
            {error}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => decide("approved")}
            disabled={busy !== null}
            className="tv-pill h-[40px] gap-2 px-5 text-[13.5px]"
            style={{ background: "var(--color-wine)", color: "#ffffff", cursor: busy ? "wait" : "pointer" }}
          >
            {busy === "approved" ? <LoaderCircle size={15} strokeWidth={2.2} className="tv-anim-spin" /> : <Check size={15} strokeWidth={2.4} />}
            Approva
          </button>
          <button
            type="button"
            onClick={() => decide("rejected")}
            disabled={busy !== null}
            className="tv-pill h-[40px] gap-2 px-5 text-[13.5px] transition-colors hover:bg-line-soft"
            style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)", cursor: busy ? "wait" : "pointer" }}
          >
            {busy === "rejected" ? <LoaderCircle size={15} strokeWidth={2.2} className="tv-anim-spin" /> : <Undo2 size={15} strokeWidth={2.2} />}
            Rimanda indietro
          </button>
          <Link
            href={`/studio?run=${run.id}`}
            className="tv-pill ml-auto h-[40px] gap-1.5 px-4 text-[13px] transition-colors hover:bg-line-soft"
            style={{ color: "var(--color-wine)" }}
          >
            Apri nell&apos;editor
            <ExternalLink size={14} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </li>
  );
}
