import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { currentUser } from "@/auth";
import { PageFrame } from "@/components/studio/page-frame";
import { FORMATS } from "@/lib/brand";
import { getCampaigns, getTools, listRuns } from "@/lib/db";
import { durationLabel } from "@/lib/format";
import type { RunState } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<RunState, { label: string; bg: string; fg: string }> = {
  composing: { label: "bozza", bg: "var(--color-line-soft)", fg: "var(--color-ink-faint)" },
  running: { label: "in corso", bg: "var(--color-warm-tint)", fg: "var(--color-warning)" },
  results: { label: "pronto", bg: "var(--color-success-bg)", fg: "var(--color-success)" },
  failed: { label: "fallito", bg: "#fdecea", fg: "#8c1d18" },
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * I lavori della persona: ogni esecuzione sua, dalla piu' recente, con un
 * link che la riapre nella console cosi' com'era.
 */
export default async function StoricoPage() {
  const user = await currentUser();
  if (!user) redirect("/");

  const [runs, campaigns, tools] = await Promise.all([listRuns(user.email, 100), getCampaigns(), getTools()]);
  const campaignName = (id: string | null) => campaigns.find((c) => c.id === id)?.name ?? "—";
  const toolName = (slug: string) => tools.find((t) => t.slug === slug)?.title ?? (slug === "libero" ? "Brief libero" : slug);

  return (
    <PageFrame
      user={user}
      title="I miei lavori"
      description={`${runs.length} ${runs.length === 1 ? "esecuzione" : "esecuzioni"} · solo le tue, dalla più recente`}
      action={
        <Link
          href="/studio"
          className="tv-pill h-[38px] gap-2 px-4 text-[13px]"
          style={{ background: "var(--color-coral)", color: "#ffffff", boxShadow: "var(--shadow-coral)" }}
        >
          <Plus size={15} strokeWidth={2.2} />
          Nuova creazione
        </Link>
      }
    >
      {runs.length === 0 ? (
        <p className="tv-card px-5 py-6 text-[14px]" style={{ color: "var(--color-ink-soft)" }}>
          Non hai ancora creato niente. Apri lo Studio e lancia la prima esecuzione: la ritroverai qui.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.map((run) => {
            const state = STATE_LABEL[run.state];
            return (
              <li key={run.id} className="tv-card flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
                    {run.instruction}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>
                    <span suppressHydrationWarning>{dateLabel(run.created_at)}</span>
                    <span>·</span>
                    <span>{campaignName(run.campaign_id)}</span>
                    <span>·</span>
                    <span>{toolName(run.tool_slug)}</span>
                    {run.duration_ms ? (
                      <>
                        <span>·</span>
                        <span>{durationLabel(run.duration_ms)}</span>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {run.formats.map((f) => (
                      <span
                        key={f}
                        className="tv-pill h-[22px] px-2.5 text-[11px]"
                        style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}
                      >
                        {FORMATS[f]?.label ?? f}
                      </span>
                    ))}
                    <span className="tv-pill h-[22px] px-2.5 text-[11px]" style={{ background: "var(--color-line-soft)", color: "var(--color-ink-soft)", fontWeight: 500 }}>
                      {run.variant_count} {run.variant_count === 1 ? "variante" : "varianti"}
                    </span>
                  </p>
                </div>
                <span className="tv-pill h-[26px] shrink-0 px-3 text-[11.5px]" style={{ background: state.bg, color: state.fg }}>
                  {state.label}
                </span>
                {run.state === "results" ? (
                  <Link
                    href={`/studio?run=${run.id}`}
                    className="tv-pill h-[36px] shrink-0 gap-1.5 px-4 text-[13px] transition-colors hover:bg-line-soft"
                    style={{ border: "1px solid var(--color-line)", color: "var(--color-wine)" }}
                  >
                    Apri
                    <ArrowRight size={14} strokeWidth={2.2} />
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}
