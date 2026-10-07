"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, CalendarDays, PenLine, Search, ShieldCheck } from "lucide-react";
import { ShaderCard, shaderConfigFor } from "@/components/ui/feature-shader-cards";
import { FORMATS } from "@/lib/brand";
import { deadlineLabel, timeAgo } from "@/lib/format";
import type { HomeData } from "@/lib/home-data";
import { can } from "@/lib/permissions";
import type { Run, Tool, ToolCategory } from "@/lib/types";
import type { StudioUser } from "@/auth";
import { AssetPreview } from "./asset-preview";
import { toolIcon } from "./tool-icons";
import { Card, ChannelBadge, EmptyState, SegmentedTabs, StatusChip, type ChipStatus } from "./ui";

interface Props {
  user: StudioUser;
  tools: Tool[];
  home: HomeData;
  /** Apre il brief libero, sul posto: e' la stessa macchina a stati. */
  onFreeBrief: () => void;
}

type Filter = "tutti" | ToolCategory;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buonanotte";
  if (h < 13) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function today(): string {
  return new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * La home: gli strumenti prima di tutto, poi quello che aspetta la persona.
 * E' lo stato «composing» della console, non una pagina a parte: scegliere
 * uno strumento porta al suo modulo, e il brief libero resta a un clic.
 */
export function ToolsHome({ user, tools, home, onFreeBrief }: Props) {
  const [filter, setFilter] = useState<Filter>("tutti");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const launchable = useMemo(() => tools.filter((t) => !t.automatic), [tools]);
  const shown = launchable.filter((t) => {
    if (filter !== "tutti" && t.category !== filter) return false;
    if (needle && !`${t.title} ${t.description}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const recent = home.recent.filter((r) => !needle || r.instruction.toLowerCase().includes(needle));
  const approver = can(user, "approve");
  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-4 py-6 md:px-8 md:py-7">
      {/* ---------------- testata ---------------- */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold" style={{ color: "var(--color-ink-faint)" }} suppressHydrationWarning>
            {today()} · {home.campaignName}
          </p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.01em]" style={{ color: "var(--color-ink)" }} suppressHydrationWarning>
            {greeting()} {firstName}, cosa creiamo oggi?
          </h1>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <label className="relative min-w-0 flex-1 md:w-[320px]">
            <span className="sr-only">Cerca</span>
            <Search size={16} strokeWidth={1.9} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" style={{ color: "var(--color-ink-faint)" }} aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca strumenti, creazioni, bandi…"
              className="h-[44px] w-full rounded-full pr-4 pl-10 text-[13.5px] outline-none transition-[box-shadow,border-color] focus:shadow-focus"
              style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }}
            />
          </label>
          <Link
            href={approver ? "/studio/approvazioni" : "/studio/storico"}
            aria-label={home.approvals.length > 0 ? `Notifiche: ${home.approvals.length} in attesa` : "Notifiche"}
            className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full transition-colors hover:bg-line-soft"
            style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink-soft)" }}
          >
            <Bell size={17} strokeWidth={1.9} />
            {home.approvals.length > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold" style={{ background: "var(--color-apricot)", color: "var(--color-ink)" }}>
                {home.approvals.length}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      {/* ---------------- strumenti ---------------- */}
      <section aria-labelledby="home-tools">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <h2 id="home-tools" className="text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>
            Scegli uno strumento
          </h2>
          <SegmentedTabs<Filter>
            aria-label="Filtra gli strumenti"
            size="sm"
            value={filter}
            onChange={setFilter}
            items={[
              { key: "tutti", label: "Tutti" },
              { key: "social", label: "Social" },
              { key: "stampa", label: "Stampa" },
            ]}
          />
        </div>
        {shown.length === 0 ? (
          <EmptyState title="Nessuno strumento con questo nome" text="Prova un'altra parola, oppure parti da un brief libero." dashed />
        ) : (
          <ul className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
            {shown.map((tool) => (
              <ToolCard key={tool.id} tool={tool} index={launchable.indexOf(tool)} />
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onFreeBrief}
          className="mt-4 flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-3 rounded-card px-5 text-left text-[13.5px] transition-colors hover:bg-line-soft"
          style={{ border: "1.5px dashed var(--color-line)", color: "var(--color-ink-soft)" }}
        >
          <span className="flex items-center gap-3">
            <PenLine size={17} strokeWidth={1.9} style={{ color: "var(--color-rose-ink)" }} />
            <span>
              Nessuno strumento fa al caso tuo? <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Scrivi un brief libero</span>
            </span>
          </span>
          <ArrowRight size={16} strokeWidth={2} />
        </button>
      </section>

      {/* ---------------- i tre pannelli ---------------- */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {approver ? <ApprovalsPanel items={home.approvals} /> : null}
        <WeekPanel items={home.posts} />
        <DeadlinesPanel items={home.deadlines} />
      </div>

      {/* ---------------- riprendi ---------------- */}
      {recent.length > 0 ? (
        <section aria-labelledby="home-recent">
          <div className="flex items-baseline justify-between pb-3">
            <h2 id="home-recent" className="text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>
              Riprendi da dove eri
            </h2>
            <Link href="/studio/storico" className="text-[12.5px] font-semibold" style={{ color: "var(--color-rose-ink)" }}>
              Tutte le creazioni
            </Link>
          </div>
          <ul className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
            {recent.map((run) => (
              <RecentCard key={run.id} run={run} tools={tools} />
            ))}
          </ul>
        </section>
      ) : null}

      <p className="flex items-center gap-2 pb-2 text-[12.5px]" style={{ color: "var(--color-ink-faint)" }}>
        <ShieldCheck size={14} strokeWidth={2} style={{ color: "var(--color-success)" }} />
        Il brand-guard controlla palette, font, marchio e fonti a ogni esecuzione: niente si pubblica senza il suo via libera e un approvatore.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * La card di uno strumento: il fondo shader del Brand Kit, l'icona, il tempo
 * stimato, i formati, e in calce il pulsante di avvio con quanti campi ha
 * e quante volte e' stato usato. Tutta la card porta al modulo.
 */
function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  const router = useRouter();
  const Icon = toolIcon(tool.slug);
  const formats = tool.default_formats.map((f) => FORMATS[f]?.label ?? f).join(" · ");
  return (
    <li>
      <ShaderCard
        title={tool.title}
        description={`${tool.description}${formats ? ` · ${formats}` : ""}`}
        icon={<Icon size={19} strokeWidth={1.9} />}
        config={shaderConfigFor(index)}
        badge={tool.estimated_minutes ? `${tool.estimated_minutes} min` : undefined}
        className="h-[236px]"
        onClick={() => router.push(`/studio/strumenti/${tool.slug}`)}
        footer={
          <>
            <span className="flex items-center gap-1.5">
              {tool.cta_label ?? "Apri"}
              <ArrowRight size={14} strokeWidth={2.2} />
            </span>
            <span className="ml-auto text-[11.5px] font-normal" style={{ color: "var(--color-on-wine)" }}>
              {tool.fields.length} {tool.fields.length === 1 ? "campo" : "campi"} · usato {tool.run_count} volte
            </span>
          </>
        }
      />
    </li>
  );
}

function PanelTitle({ children, href, action }: { children: string; href?: string; action?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pb-3">
      <h2 className="text-[15px] font-semibold" style={{ color: "inherit" }}>
        {children}
      </h2>
      {href && action ? (
        <Link href={href} className="text-[12.5px] font-semibold" style={{ color: "inherit", opacity: 0.85 }}>
          {action}
        </Link>
      ) : null}
    </div>
  );
}

function ApprovalsPanel({ items }: { items: HomeData["approvals"] }) {
  return (
    <Card as="section" style={{ color: "var(--color-ink)" }}>
      <PanelTitle href="/studio/approvazioni" action="Tutte">
        Da approvare
      </PanelTitle>
      {items.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
          Niente in attesa. Le richieste nuove compariranno qui.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3">
              <span className="shrink-0 overflow-hidden rounded-[8px]" style={{ border: "1px solid var(--color-line)" }}>
                {a.variant ? <AssetPreview variant={a.variant} format={a.formats[0] ?? "linkedin"} photo={a.photo ?? undefined} displayWidth={a.formats[0] === "poster-a4" || a.formats[0] === "ig-story" ? 44 : 72} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{a.title}</span>
                <span className="block truncate text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
                  {a.requester.split("@")[0]} · {a.formats.map((f) => FORMATS[f]?.label ?? f).join(", ")}
                </span>
              </span>
              <Link
                href={`/studio?run=${a.runId}`}
                className="tv-pill h-[36px] shrink-0 px-3.5 text-[12.5px] transition-colors hover:bg-line-soft"
                style={{ border: "1px solid var(--color-line)", color: "var(--color-wine)" }}
              >
                Rivedi
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function WeekPanel({ items }: { items: HomeData["posts"] }) {
  return (
    <Card as="section" style={{ color: "var(--color-ink)" }}>
      <PanelTitle href="/studio/calendario" action="Calendario">
        In programma questa settimana
      </PanelTitle>
      {items.length === 0 ? (
        <p className="flex items-start gap-2 text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
          <CalendarDays size={15} strokeWidth={1.9} className="mt-[2px] shrink-0" />
          Nessun post programmato nei prossimi sette giorni.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <ChannelBadge channel={p.channel} surface={p.surface} iconOnly />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{p.title}</span>
                <span className="block text-[12px]" style={{ color: "var(--color-ink-faint)" }} suppressHydrationWarning>
                  {new Date(p.scheduledFor).toLocaleString("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
              <StatusChip status={p.status as ChipStatus} size="sm" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DeadlinesPanel({ items }: { items: HomeData["deadlines"] }) {
  return (
    <Card as="section" tone="wine">
      <PanelTitle>Scadenze dei bandi</PanelTitle>
      {items.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--color-on-wine)" }}>
          Nessuna scadenza letta dalle fonti delle campagne attive. Le date compaiono qui solo quando un&apos;esecuzione le ha trovate in un documento.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((d) => {
            const params = new URLSearchParams({ bando: d.bando, scadenza: d.deadline.slice(0, 16) });
            return (
              <li key={`${d.runId}`} className="flex items-center gap-3">
                <span className="flex h-[48px] w-[48px] shrink-0 flex-col items-center justify-center rounded-[12px]" style={{ background: "rgba(255,255,255,.12)" }}>
                  <span className="text-[18px] leading-none font-bold tabular-nums">{d.daysLeft}</span>
                  <span className="text-[9.5px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--color-on-wine)" }}>
                    giorni
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{d.bando}</span>
                  <span className="block truncate text-[12px]" style={{ color: "var(--color-on-wine)" }}>
                    {deadlineLabel(d.deadline)}
                  </span>
                </span>
                <Link
                  href={`/studio/strumenti/poster-bando?${params.toString()}`}
                  className="tv-pill h-[36px] shrink-0 px-3.5 text-[12.5px]"
                  style={{ background: "var(--color-apricot)", color: "var(--color-ink)" }}
                >
                  Crea poster
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const RUN_STATUS: Record<Run["state"], { status: ChipStatus; label?: string }> = {
  composing: { status: "draft" },
  running: { status: "running" },
  results: { status: "draft", label: "Pronto" },
  failed: { status: "failed" },
};

function RecentCard({ run, tools }: { run: Run; tools: Tool[] }) {
  const tool = tools.find((t) => t.slug === run.tool_slug);
  const chip = RUN_STATUS[run.state];
  return (
    <li>
      <Link href={`/studio?run=${run.id}`} className="tv-card flex h-full flex-col gap-2 p-4 transition-[transform] hover:-translate-y-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-semibold" style={{ color: "var(--color-rose-ink)" }}>
            {tool?.title ?? (run.tool_slug === "libero" ? "Brief libero" : run.tool_slug)}
          </span>
          <StatusChip status={chip.status} label={chip.label} size="sm" />
        </span>
        <span className="line-clamp-2 text-[13.5px] leading-[1.4] font-semibold" style={{ color: "var(--color-ink)" }}>
          {run.instruction}
        </span>
        <span className="mt-auto text-[12px]" style={{ color: "var(--color-ink-faint)" }} suppressHydrationWarning>
          {timeAgo(run.created_at)} · {run.formats.map((f) => FORMATS[f]?.label ?? f).join(", ")}
        </span>
      </Link>
    </li>
  );
}
