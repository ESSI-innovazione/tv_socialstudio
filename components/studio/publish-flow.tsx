"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleAlert, LoaderCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { FORMATS } from "@/lib/brand";
import { overallStatus } from "@/lib/brand-guard";
import type { AssetLayout } from "@/lib/layout-model";
import type { Asset, GuardCheck, GuardStatus, Run } from "@/lib/types";
import type { StudioUser } from "@/auth";
import { ApprovalStep } from "./approval-step";

interface Props {
  run: Run;
  selected: number;
  layouts: Record<string, AssetLayout>;
  user: StudioUser;
  channelsLive: boolean;
  /** Gli asset aggiornati dal server, da fondere nell'esecuzione. */
  onAssets: (assets: Asset[]) => void;
}

/**
 * Dalla variante scelta alla pubblicazione, in ordine: il controllo del
 * brand, l'approvazione, il canale. Ogni passo si sblocca col precedente,
 * e ogni verdetto arriva dal server: il client qui chiede, non decide.
 */
export function PublishFlow({ run, selected, layouts, user, onAssets }: Props) {
  const assets = run.assets.filter((a) => a.variant_index === selected);
  const saved = assets.length > 0;
  const guard = overallStatus(assets.map((a) => a.guard_status));
  const guardOk = guard === "pass" || guard === "warn";

  return (
    <div className="mt-auto flex flex-col gap-3 pt-2">
      <GuardStep run={run} selected={selected} assets={assets} layouts={layouts} status={guard} saved={saved} onAssets={onAssets} />
      <ApprovalStep run={run} selected={selected} guardOk={guardOk} user={user} onAssets={onAssets} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Brand guard                                                          */
/* ------------------------------------------------------------------ */

const TONE: Record<GuardStatus, { bg: string; fg: string; Icon: typeof Check; label: string }> = {
  pass: { bg: "var(--color-success-bg)", fg: "var(--color-success)", Icon: Check, label: "Brand ok" },
  warn: { bg: "var(--color-warm-tint)", fg: "var(--color-warning)", Icon: TriangleAlert, label: "Brand ok, con avvisi" },
  fail: { bg: "#fdecea", fg: "#8c1d18", Icon: CircleAlert, label: "Bloccato dal brand guard" },
};

/** Le verifiche di tutti i formati in un elenco solo: per chiave, il peggiore vince. */
function mergeChecks(assets: Asset[]): GuardCheck[] {
  const order: GuardStatus[] = ["pass", "warn", "fail"];
  const out = new Map<string, GuardCheck & { formats: string[] }>();
  for (const asset of assets) {
    for (const c of asset.guard ?? []) {
      const prev = out.get(c.key);
      const label = FORMATS[asset.format]?.label ?? asset.format;
      if (!prev) {
        out.set(c.key, { ...c, formats: c.status === "pass" ? [] : [label] });
      } else {
        const worse = order.indexOf(c.status) > order.indexOf(prev.status);
        out.set(c.key, {
          ...prev,
          status: worse ? c.status : prev.status,
          detail: worse ? c.detail : prev.detail,
          formats: c.status === "pass" ? prev.formats : [...prev.formats, label],
        });
      }
    }
  }
  return [...out.values()].map(({ formats, ...c }) => ({
    ...c,
    detail: c.status !== "pass" && formats.length > 0 && formats.length < assets.length ? `${c.detail} (${formats.join(", ")})` : c.detail,
  }));
}

export function GuardStep({
  run,
  selected,
  assets,
  layouts,
  status,
  saved,
  onAssets,
}: {
  run: Run;
  selected: number;
  assets: Asset[];
  layouts: Record<string, AssetLayout>;
  status: GuardStatus | null;
  saved: boolean;
  onAssets: (assets: Asset[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // L'impaginazione nell'editor e' cambiata dopo l'ultimo controllo?
  const stale = assets.some((a) => {
    const current = layouts[`${a.variant_index}:${a.format}`];
    return current && a.layout && JSON.stringify(current) !== JSON.stringify(a.layout);
  });

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const given: Record<string, AssetLayout> = {};
      for (const a of assets) {
        const l = layouts[`${a.variant_index}:${a.format}`];
        if (l) given[a.format] = l;
      }
      const res = await fetch("/api/brand-guard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id, variantIndex: selected, layouts: given }),
      });
      const data = (await res.json().catch(() => ({}))) as { assets?: Asset[]; error?: string };
      if (!res.ok || !data.assets) throw new Error(data.error ?? "Il controllo non e' riuscito.");
      onAssets(data.assets);
      setOpen(data.assets.some((a) => a.guard_status !== "pass"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const checks = mergeChecks(assets);
  const tone = status ? TONE[status] : null;

  return (
    <section className="rounded-card" style={{ background: tone ? tone.bg : "var(--color-line-soft)" }}>
      <div className="flex items-center gap-2.5 px-3.5 py-3 text-[13px] leading-[1.45]">
        {tone ? <tone.Icon size={16} strokeWidth={2.2} className="shrink-0" style={{ color: tone.fg }} /> : <ShieldCheck size={16} strokeWidth={2} className="shrink-0" style={{ color: "var(--color-ink-faint)" }} />}
        <span className="flex-1 font-semibold" style={{ color: tone ? tone.fg : "var(--color-ink-soft)" }}>
          {tone ? tone.label : saved ? "Controllo del brand da fare" : "Salvataggio in corso…"}
          {stale && tone ? <span className="block text-[11.5px] font-normal">L&apos;impaginazione e&apos; cambiata: ricontrolla.</span> : null}
        </span>
        <button
          type="button"
          onClick={verify}
          disabled={busy || !saved}
          className="tv-pill h-[30px] shrink-0 gap-1.5 px-3 text-[12px] transition-colors"
          style={{
            background: "var(--color-paper)",
            border: "1px solid var(--color-line)",
            color: "var(--color-wine)",
            cursor: busy || !saved ? "wait" : "pointer",
          }}
        >
          {busy ? <LoaderCircle size={13} strokeWidth={2.2} className="tv-anim-spin" /> : <ShieldCheck size={13} strokeWidth={2.2} />}
          {tone ? "Ricontrolla" : "Verifica brand"}
        </button>
      </div>

      {error ? (
        <p className="px-3.5 pb-3 text-[12px]" style={{ color: "var(--color-warning)" }}>
          {error}
        </p>
      ) : null}

      {checks.length > 0 ? (
        <div className="px-3.5 pb-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold"
            style={{ color: tone?.fg ?? "var(--color-ink-soft)" }}
          >
            <ChevronDown size={14} strokeWidth={2.2} className="transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
            {checks.length} verifiche su {assets.length} {assets.length === 1 ? "formato" : "formati"}
          </button>
          {open ? (
            <ul className="tv-anim-rise mt-2 flex flex-col gap-1.5">
              {checks.map((c) => {
                const t = TONE[c.status];
                return (
                  <li key={c.key} className="flex gap-2 text-[12.5px] leading-[1.45]" style={{ color: "var(--color-ink)" }}>
                    <t.Icon size={14} strokeWidth={2.4} className="mt-[2px] shrink-0" style={{ color: t.fg }} />
                    <span>
                      <span className="font-semibold">{c.label}</span>
                      {c.detail ? <span style={{ color: "var(--color-ink-soft)" }}> · {c.detail}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
