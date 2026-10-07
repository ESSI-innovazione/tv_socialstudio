"use client";

import { useMemo, useState, type DragEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, Lock, Move, Send, Trash2, Unplug } from "lucide-react";
import type { FormatId } from "@/lib/brand";
import { archetypeFromLabel, templateLayout, type AssetLayout } from "@/lib/layout-model";
import type { ChannelStatus } from "@/lib/publish";
import type { Asset, Channel, ScheduledPost, Surface, VariantCopy } from "@/lib/types";
import { AssetPreview } from "./asset-preview";
import { ChannelBadge, CHANNEL_LABEL, SegmentedTabs, StatusChip, type ChannelId } from "./ui";

export interface CalendarPost {
  post: ScheduledPost;
  asset: Asset | null;
  variant: VariantCopy | null;
  photo: string | null;
  runId: string;
  campaign: string;
}

/** Un asset approvato senza data: si trascina su un giorno. */
export interface ReadyItem {
  assetId: string;
  runId: string;
  channel: Channel;
  surface: Surface;
  format: FormatId;
  variant: VariantCopy;
  layout: AssetLayout | null;
  photo: string | null;
  campaign: string;
  caption: string;
  hashtags: string[];
}

interface Props {
  items: CalendarPost[];
  ready: ReadyItem[];
  channels: ChannelStatus;
  canPublish: boolean;
}

type View = "settimana" | "mese";
type Filter = "tutti" | ChannelId;

/** Cosa si sta trascinando: un post da spostare o un asset pronto da programmare. */
type Carry = { kind: "post"; id: string } | { kind: "ready"; id: string };

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

/** L'ora a cui un asset trascinato su un giorno viene programmato. */
const DEFAULT_HOUR = 10;

/** La chiave di un giorno nel fuso locale: niente UTC che sposta i post di sera al giorno dopo. */
function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function postDate(p: ScheduledPost): Date {
  return new Date(p.published_at ?? p.scheduled_for ?? p.created_at);
}

/** Il lunedi' della settimana di una data. */
function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function localInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Il motivo di un fallimento, in italiano piano: il messaggio del canale e' gia' tradotto da publish-errors. */
function plainReason(error: string | null): string {
  if (!error) return "Non e' riuscito. Riprova piu' tardi.";
  if (/401|autorizzazione|token/i.test(error)) return "L'autorizzazione del canale e' scaduta o revocata: va rinnovata, poi Riprova.";
  if (/non collegato/i.test(error)) return "Il canale non e' collegato: mancano le chiavi. Appena ci sono, Riprova.";
  if (/429|limite/i.test(error)) return "Il canale ha chiesto di aspettare: Riprova fra qualche minuto.";
  return error;
}

/**
 * Il calendario. Settimana o mese, filtro per canale, trascinamento con il
 * mouse e con la tastiera (Invio o Spazio prende, le frecce spostano di un
 * giorno o di una settimana, Invio lascia, Esc annulla). A destra, il
 * dettaglio del post scelto e gli asset pronti da programmare.
 */
export function Calendar({ items, ready, channels, canPublish }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("settimana");
  const [cursor, setCursor] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>("tutti");
  const [selected, setSelected] = useState<{ kind: "post" | "ready"; id: string } | null>(null);
  const [carry, setCarry] = useState<Carry | null>(null);
  /** Il giorno di destinazione scelto da tastiera, in attesa di Invio. */
  const [target, setTarget] = useState<Date | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<ChannelId | null>(null);

  const today = dayKey(new Date());
  const visible = useMemo(() => items.filter((i) => filter === "tutti" || i.post.channel === filter), [items, filter]);
  const readyVisible = useMemo(() => ready.filter((r) => filter === "tutti" || r.channel === filter), [ready, filter]);

  const cells = useMemo(() => {
    if (view === "settimana") {
      const start = mondayOf(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = mondayOf(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [view, cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    for (const item of visible) {
      const key = dayKey(postDate(item.post));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    for (const list of map.values()) list.sort((a, b) => postDate(a.post).getTime() - postDate(b.post).getTime());
    return map;
  }, [visible]);

  const selectedPost = selected?.kind === "post" ? (items.find((i) => i.post.id === selected.id) ?? null) : null;
  const selectedReady = selected?.kind === "ready" ? (ready.find((r) => r.assetId === selected.id) ?? null) : null;

  /* ---------------- le azioni ---------------- */

  const fail = (message: string) => {
    setError(message);
    setBusy(false);
  };

  /** Spostare un post: stesso orario, giorno nuovo. */
  const movePost = async (item: CalendarPost, day: Date) => {
    if (item.post.status === "published") return;
    const current = postDate(item.post);
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), current.getHours(), current.getMinutes());
    if (dayKey(next) === dayKey(current)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/publish/${item.post.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduledFor: next.toISOString() }) });
    if (!res.ok) return fail(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Spostamento non riuscito.");
    setBusy(false);
    router.refresh();
  };

  /** Programmare un asset pronto: quel giorno, all'ora di default o a quella data. */
  const scheduleReady = async (item: ReadyItem, when: Date) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: item.assetId, channel: item.channel, surface: item.surface, caption: item.caption, hashtags: item.hashtags, scheduledFor: when.toISOString() }),
    });
    if (!res.ok) return fail(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Programmazione non riuscita.");
    setBusy(false);
    setSelected(null);
    router.refresh();
  };

  const dropOn = (day: Date, what: Carry | null) => {
    setOver(null);
    setCarry(null);
    setTarget(null);
    if (!what || !canPublish) return;
    if (what.kind === "post") {
      const item = items.find((i) => i.post.id === what.id);
      if (item) void movePost(item, day);
    } else {
      const item = ready.find((r) => r.assetId === what.id);
      if (item) void scheduleReady(item, new Date(day.getFullYear(), day.getMonth(), day.getDate(), DEFAULT_HOUR, 0));
    }
  };

  /* ---------------- tastiera ---------------- */

  /**
   * Con un elemento preso in mano, le frecce scelgono il giorno (sinistra e
   * destra un giorno, su e giu' una settimana), Invio lascia, Esc annulla.
   * La destinazione si vede evidenziata prima di confermare.
   */
  const onGridKey = (e: KeyboardEvent) => {
    if (!carry) return;
    const base = target ?? (carry.kind === "post" ? postDate(items.find((i) => i.post.id === carry.id)!.post) : new Date());
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      const next = addDays(base, step[e.key]);
      setTarget(next);
      // La griglia segue la destinazione, se esce dalla vista.
      if (!cells.some((c) => dayKey(c) === dayKey(next))) setCursor(next);
    } else if (e.key === "Enter" && target) {
      e.preventDefault();
      dropOn(target, carry);
    } else if (e.key === "Escape") {
      setCarry(null);
      setTarget(null);
    }
  };

  const pickUp = (what: Carry) => {
    if (!canPublish) return;
    setCarry((c) => (c && c.id === what.id ? null : what));
    setTarget(null);
    setSelected(what);
  };

  const move = (delta: number) => setCursor((c) => (view === "mese" ? new Date(c.getFullYear(), c.getMonth() + delta, 1) : addDays(c, delta * 7)));

  const rangeLabel =
    view === "mese"
      ? cursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" })
      : `${cells[0].toLocaleDateString("it-IT", { day: "numeric", month: "short" })} – ${cells[6].toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}`;

  const carried = carry ? (carry.kind === "post" ? (items.find((i) => i.post.id === carry.id)?.variant?.headline ?? "il post") : (ready.find((r) => r.assetId === carry.id)?.variant.headline ?? "l'asset")) : null;

  return (
    <div className="flex flex-col gap-4" onKeyDown={onGridKey}>
      {/* ---------------- canali ---------------- */}
      <div className="flex flex-wrap items-center gap-2">
        {(["linkedin", "instagram"] as ChannelId[]).map((c) => {
          const live = channels[c];
          return (
            <span key={c} className="flex flex-col gap-1">
              {live ? (
                <span className="tv-pill h-[36px] gap-2 px-3.5 text-[12.5px]" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
                  <Check size={13} strokeWidth={2.6} />
                  {CHANNEL_LABEL[c]} collegato
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setHint((h) => (h === c ? null : c))}
                  aria-expanded={hint === c}
                  className="tv-pill h-[36px] cursor-pointer gap-2 px-3.5 text-[12.5px]"
                  style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)", border: "1px solid var(--color-warm-edge)" }}
                >
                  <Unplug size={13} strokeWidth={2.2} />
                  {c === "linkedin" ? "Collega LinkedIn" : "Collega l'account Business Instagram"}
                </button>
              )}
            </span>
          );
        })}
        {hint ? (
          <p className="w-full text-[12.5px] leading-[1.5]" style={{ color: "var(--color-ink-soft)" }}>
            {hint === "linkedin"
              ? "Servono un'app LinkedIn approvata con w_organization_social e un amministratore della pagina Time Vision che la autorizzi: LINKEDIN_ACCESS_TOKEN e LINKEDIN_ORGANIZATION_ID nell'ambiente. I post programmati aspettano fino ad allora."
              : "Serve un account Instagram Business collegato a una pagina Facebook: IG_ACCESS_TOKEN e IG_USER_ID nell'ambiente. I post programmati aspettano fino ad allora."}
          </p>
        ) : null}
      </div>

      {/* ---------------- barra ---------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => move(-1)} aria-label={view === "mese" ? "Mese precedente" : "Settimana precedente"} className="flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-line-soft" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}>
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <button type="button" onClick={() => setCursor(new Date())} className="tv-pill h-[44px] cursor-pointer px-4 text-[13px] transition-colors hover:bg-line-soft" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}>
            Oggi
          </button>
          <button type="button" onClick={() => move(1)} aria-label={view === "mese" ? "Mese successivo" : "Settimana successiva"} className="flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-line-soft" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}>
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
        </div>
        <span className="px-2 text-[15px] font-semibold capitalize" style={{ color: "var(--color-ink)" }} aria-live="polite">
          {rangeLabel}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SegmentedTabs<Filter>
            aria-label="Canale"
            size="sm"
            value={filter}
            onChange={setFilter}
            items={[
              { key: "tutti", label: "Tutti" },
              { key: "linkedin", label: "LinkedIn" },
              { key: "instagram", label: "Instagram" },
            ]}
          />
          <SegmentedTabs<View>
            aria-label="Vista"
            size="sm"
            value={view}
            onChange={setView}
            items={[
              { key: "settimana", label: "Settimana" },
              { key: "mese", label: "Mese" },
            ]}
          />
        </div>
      </div>

      {carry ? (
        <p role="status" className="rounded-card px-4 py-2.5 text-[12.5px]" style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }}>
          <Move size={13} strokeWidth={2.2} className="mr-1.5 inline-block" />
          Hai preso {carried}: frecce per scegliere il giorno
          {target ? ` (${target.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })})` : ""}, Invio per lasciare, Esc per annullare.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-card px-4 py-2.5 text-[12.5px]" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------- griglia ---------------- */}
        <div className="tv-scroll tv-card min-w-0 overflow-x-auto" style={{ padding: 0 }}>
          <div style={{ minWidth: view === "settimana" ? 980 : 760 }}>
            <div className="grid grid-cols-7" style={{ borderBottom: "1px solid var(--color-line)" }}>
              {DAYS.map((d) => (
                <div key={d} className="tv-label px-3 py-2">
                  {d.toUpperCase()}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7" style={{ gridAutoRows: view === "mese" ? "minmax(112px, auto)" : "minmax(440px, auto)" }}>
              {cells.map((day, i) => {
                const key = dayKey(day);
                const list = byDay.get(key) ?? [];
                const outside = view === "mese" && day.getMonth() !== cursor.getMonth();
                const isToday = key === today;
                const isTarget = (over === key && Boolean(carry)) || (target !== null && dayKey(target) === key);
                return (
                  <div
                    key={key}
                    onDragOver={(e) => {
                      if (!carry) return;
                      e.preventDefault();
                      setOver(key);
                    }}
                    onDragLeave={() => setOver((o) => (o === key ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const raw = e.dataTransfer.getData("text/plain");
                      const [kind, id] = raw.split(":");
                      dropOn(day, kind === "post" || kind === "ready" ? { kind, id: raw.slice(kind.length + 1) } : carry);
                      void id;
                    }}
                    className="flex min-w-0 flex-col gap-1.5 p-1.5 transition-colors"
                    style={{
                      borderRight: (i + 1) % 7 === 0 ? "none" : "1px solid var(--color-line-soft)",
                      borderBottom: "1px solid var(--color-line-soft)",
                      background: isTarget ? "var(--color-warm-tint)" : isToday ? "var(--color-wine-tint)" : outside ? "var(--color-canvas)" : "var(--color-paper)",
                    }}
                  >
                    <span className="px-1 text-[12px] tabular-nums" style={{ color: isToday ? "var(--color-wine)" : outside ? "var(--color-ink-faint)" : "var(--color-ink-soft)", fontWeight: isToday ? 700 : 500 }}>
                      {day.getDate()}
                      {isToday ? <span className="ml-1 text-[10px] font-bold tracking-[0.08em] uppercase">oggi</span> : null}
                    </span>
                    {list.map((item) => (
                      <PostCard
                        key={item.post.id}
                        item={item}
                        compact={view === "mese"}
                        selected={selected?.kind === "post" && selected.id === item.post.id}
                        carried={carry?.kind === "post" && carry.id === item.post.id}
                        movable={canPublish && item.post.status !== "published"}
                        onSelect={() => setSelected({ kind: "post", id: item.post.id })}
                        onPickUp={() => pickUp({ kind: "post", id: item.post.id })}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", `post:${item.post.id}`);
                          e.dataTransfer.effectAllowed = "move";
                          setCarry({ kind: "post", id: item.post.id });
                        }}
                        onDragEnd={() => {
                          setCarry(null);
                          setOver(null);
                        }}
                      />
                    ))}
                    {view === "settimana" && list.length === 0 ? (
                      <span className="mt-auto rounded-[8px] px-2 py-4 text-center text-[11.5px] leading-[1.4]" style={{ border: "1.5px dashed var(--color-line)", color: "var(--color-ink-faint)" }}>
                        Trascina qui un post pronto
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ---------------- destra ---------------- */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start" aria-label="Dettaglio e pronti">
          <div className="tv-card p-4">
            {selectedPost ? (
              <PostDetail item={selectedPost} channels={channels} canPublish={canPublish} busy={busy} onChanged={() => router.refresh()} onRemoved={() => setSelected(null)} />
            ) : selectedReady ? (
              <ReadyDetail item={selectedReady} canPublish={canPublish} busy={busy} onSchedule={(when) => scheduleReady(selectedReady, when)} />
            ) : (
              <p className="text-[13px] leading-[1.5]" style={{ color: "var(--color-ink-soft)" }}>
                Scegli un post per vederne caption, stato e azioni, o un asset pronto per programmarlo.
                {items.length === 0 ? " Non c'e' ancora niente in calendario: si programma dai risultati, o da qui con gli asset pronti." : ""}
              </p>
            )}
          </div>

          <section className="tv-card p-4" aria-labelledby="ready-title">
            <h2 id="ready-title" className="pb-2 text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>
              Pronti da programmare
              <span className="ml-2 text-[12px] font-normal" style={{ color: "var(--color-ink-faint)" }}>
                {readyVisible.length}
              </span>
            </h2>
            {readyVisible.length === 0 ? (
              <p className="text-[12.5px] leading-[1.5]" style={{ color: "var(--color-ink-soft)" }}>
                Nessun asset approvato in attesa di una data. Quelli approvati nei risultati compaiono qui.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {readyVisible.map((r) => {
                  const on = selected?.kind === "ready" && selected.id === r.assetId;
                  const held = carry?.kind === "ready" && carry.id === r.assetId;
                  return (
                    <li key={r.assetId}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-pressed={on}
                        aria-label={`${r.variant.headline}, ${CHANNEL_LABEL[r.channel]}${r.surface === "story" ? " story" : ""}. ${canPublish ? "Invio o Spazio per prendere e scegliere il giorno con le frecce." : ""}`}
                        draggable={canPublish}
                        onClick={() => setSelected({ kind: "ready", id: r.assetId })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            pickUp({ kind: "ready", id: r.assetId });
                          }
                        }}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", `ready:${r.assetId}`);
                          e.dataTransfer.effectAllowed = "copy";
                          setCarry({ kind: "ready", id: r.assetId });
                        }}
                        onDragEnd={() => {
                          setCarry(null);
                          setOver(null);
                        }}
                        className="flex min-h-[56px] items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-[box-shadow,border-color]"
                        style={{
                          border: `1.5px solid ${on || held ? "var(--color-rose)" : "var(--color-line)"}`,
                          background: held ? "var(--color-warm-tint)" : "var(--color-paper)",
                          cursor: canPublish ? "grab" : "pointer",
                        }}
                      >
                        <span className="shrink-0 overflow-hidden rounded-[6px]" style={{ border: "1px solid var(--color-line)" }}>
                          <AssetPreview variant={r.variant} format={r.format} photo={r.photo ?? undefined} displayWidth={r.format === "linkedin" ? 64 : r.format === "ig-feed" ? 40 : 28} layout={r.layout ?? undefined} archetype={archetypeFromLabel(r.variant.layout)} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
                            {r.variant.headline}
                          </span>
                          <span className="block truncate text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
                            {r.campaign}
                          </span>
                        </span>
                        <ChannelBadge channel={r.channel} surface={r.surface} iconOnly />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Il rapporto del canale per la miniatura: LinkedIn largo, feed quadrato, story alta. */
const CARD_THUMB: Record<FormatId, number> = { linkedin: 150, "ig-feed": 84, "poster-a4": 56, "ig-story": 44 };

function PostCard({
  item,
  compact,
  selected,
  carried,
  movable,
  onSelect,
  onPickUp,
  onDragStart,
  onDragEnd,
}: {
  item: CalendarPost;
  compact: boolean;
  selected: boolean;
  carried: boolean;
  movable: boolean;
  onSelect: () => void;
  onPickUp: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  const { post, asset, variant } = item;
  const time = postDate(post).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const format = (asset?.format ?? (post.channel === "linkedin" ? "linkedin" : post.surface === "story" ? "ig-story" : "ig-feed")) as FormatId;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-[8px] px-1.5 py-1 text-left text-[11px]"
        style={{ background: selected ? "var(--color-wine-tint)" : "var(--color-line-soft)", border: `1px solid ${selected ? "var(--color-rose)" : "transparent"}`, color: "var(--color-ink)" }}
        title={variant?.headline ?? item.campaign}
      >
        <ChannelBadge channel={post.channel} surface={post.surface} iconOnly />
        <span className="tabular-nums">{time}</span>
        <span className="truncate">{variant?.headline ?? item.campaign}</span>
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={movable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && movable) {
          e.preventDefault();
          onPickUp();
        }
      }}
      aria-pressed={selected}
      aria-label={`${variant?.headline ?? item.campaign}, ${CHANNEL_LABEL[post.channel]} alle ${time}, ${post.status}. ${movable ? "Invio o Spazio per prendere e spostare con le frecce." : ""}`}
      className="flex w-full min-w-0 flex-col gap-1.5 rounded-[10px] p-2 text-left transition-[box-shadow,border-color]"
      style={{
        background: carried ? "var(--color-warm-tint)" : "var(--color-paper)",
        border: `1.5px solid ${selected || carried ? "var(--color-rose)" : "var(--color-line)"}`,
        boxShadow: selected ? "0 0 0 3px rgb(206 66 87 / 0.12)" : "var(--shadow-card-soft)",
        cursor: movable ? "grab" : "pointer",
      }}
      title={movable ? "Trascina per spostare" : post.status === "published" ? "Pubblicato" : undefined}
    >
      {variant ? (
        <span className="flex justify-center overflow-hidden rounded-[6px]" style={{ background: "var(--color-line-soft)" }}>
          <AssetPreview variant={variant} format={format} photo={item.photo ?? undefined} displayWidth={CARD_THUMB[format]} layout={asset?.layout ?? undefined} archetype={archetypeFromLabel(variant.layout)} />
        </span>
      ) : null}
      <span className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "var(--color-ink-soft)" }}>
        <ChannelBadge channel={post.channel} surface={post.surface} size="sm" />
        <span className="ml-auto tabular-nums">{time}</span>
      </span>
      <span className="line-clamp-2 text-[12.5px] leading-[1.35] font-semibold" style={{ color: "var(--color-ink)" }}>
        {variant?.headline ?? item.campaign}
      </span>
      <StatusChip status={post.status} size="sm" className="self-start" />
    </div>
  );
}

const PREVIEW_WIDTH: Record<FormatId, number> = { linkedin: 288, "ig-feed": 220, "poster-a4": 170, "ig-story": 130 };

function PostDetail({ item, channels, canPublish, busy, onChanged, onRemoved }: { item: CalendarPost; channels: ChannelStatus; canPublish: boolean; busy: boolean; onChanged: () => void; onRemoved: () => void }) {
  const { post, asset, variant } = item;
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [when, setWhen] = useState(() => localInput(postDate(post)));
  const live = channels[post.channel];

  const call = async (key: string, init: RequestInit, after?: () => void) => {
    setWorking(key);
    setError(null);
    try {
      const res = await fetch(`/api/publish/${post.id}`, init);
      const data = (await res.json().catch(() => ({}))) as { error?: string; post?: ScheduledPost };
      if (!res.ok) throw new Error(data.error ?? "Operazione non riuscita.");
      if (data.post?.status === "failed" && data.post.error) setError(plainReason(data.post.error));
      after?.();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(null);
    }
  };

  const format = (asset?.format ?? "linkedin") as FormatId;
  const layout =
    asset?.layout ??
    (variant
      ? templateLayout(format, archetypeFromLabel(variant.layout), { eyebrow: variant.eyebrow, headline: variant.headline, subhead: variant.subhead, body: variant.body, badge: variant.badge, disclaimer: variant.disclaimer })
      : null);
  const editable = canPublish && post.status !== "published";
  const moved = when !== localInput(postDate(post));

  return (
    <div className="flex flex-col gap-3">
      {variant && layout ? (
        <div className="flex justify-center rounded-[10px] py-3" style={{ background: "var(--color-line-soft)" }}>
          <AssetPreview variant={variant} format={format} photo={item.photo ?? undefined} displayWidth={PREVIEW_WIDTH[format]} layout={layout} archetype={archetypeFromLabel(variant.layout)} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={post.status} />
        <ChannelBadge channel={post.channel} surface={post.surface} size="sm" />
      </div>

      <p className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
        {variant?.headline ?? item.campaign}
        <span className="block text-[12px] font-normal" style={{ color: "var(--color-ink-faint)" }}>
          {item.campaign} · {post.created_by?.split("@")[0] ?? "—"}
        </span>
      </p>

      {post.caption ? (
        <p className="tv-scroll max-h-[120px] overflow-y-auto rounded-[10px] px-3 py-2 text-[12.5px] leading-[1.5] whitespace-pre-line" style={{ background: "var(--color-line-soft)", color: "var(--color-ink)" }}>
          {post.caption}
          {post.hashtags.length ? (
            <span className="block pt-1" style={{ color: "var(--color-rose-ink)" }}>
              {post.hashtags.map((h) => `#${h}`).join(" ")}
            </span>
          ) : null}
        </p>
      ) : null}

      {post.status === "failed" ? (
        <p className="rounded-[10px] px-3 py-2 text-[12.5px] leading-[1.45]" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          {plainReason(post.error)}
        </p>
      ) : null}
      {post.external_id ? (
        <p className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
          id sul canale: {post.external_id}
        </p>
      ) : null}
      {!live && post.status === "scheduled" ? (
        <p className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--color-warning)" }}>
          <Unplug size={13} strokeWidth={2.2} />
          Canale non collegato: partira&apos; quando lo sara&apos;.
        </p>
      ) : null}

      {editable ? (
        <label className="flex flex-col gap-1">
          <span className="tv-label">GIORNO E ORA</span>
          <span className="flex gap-1.5">
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-[44px] min-w-0 flex-1 rounded-[10px] px-3 text-[13px] outline-none focus:shadow-focus" style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }} />
            <button
              type="button"
              disabled={!moved || working !== null || busy}
              onClick={() => call("move", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduledFor: new Date(when).toISOString() }) })}
              className="tv-pill h-[44px] shrink-0 px-3.5 text-[12.5px]"
              style={{ background: moved ? "var(--color-wine)" : "var(--color-mute)", color: moved ? "#ffffff" : "var(--color-ink-soft)", cursor: moved ? "pointer" : "not-allowed" }}
            >
              {working === "move" ? <LoaderCircle size={13} strokeWidth={2.2} className="tv-anim-spin" /> : "Sposta"}
            </button>
          </span>
        </label>
      ) : (
        <p className="text-[12.5px]" style={{ color: "var(--color-ink-soft)" }} suppressHydrationWarning>
          {postDate(post).toLocaleString("it-IT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}

      {error ? (
        <p role="alert" className="text-[12px]" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {post.status === "pending_approval" || post.status === "draft" ? (
          <Link href={`/studio?run=${item.runId}`} className="tv-pill h-[44px] gap-1.5 px-4 text-[12.5px]" style={{ background: "var(--color-wine)", color: "#ffffff" }}>
            Apri per approvare
          </Link>
        ) : post.status === "published" ? (
          <Link href={`/studio?run=${item.runId}`} className="tv-pill h-[44px] gap-1.5 px-4 text-[12.5px]" style={{ border: "1px solid var(--color-line)", color: "var(--color-wine)" }}>
            Vedi il post
            <ExternalLink size={13} strokeWidth={2} />
          </Link>
        ) : canPublish ? (
          <button
            type="button"
            disabled={!live || working !== null}
            onClick={() => call("now", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publishNow: true }) })}
            className="tv-pill h-[44px] gap-1.5 px-4 text-[12.5px]"
            style={{ background: live ? "var(--color-coral)" : "var(--color-mute)", color: live ? "var(--color-ink)" : "var(--color-ink-soft)", cursor: live ? "pointer" : "not-allowed" }}
            title={live ? undefined : "Il canale non e' collegato"}
          >
            {working === "now" ? <LoaderCircle size={13} strokeWidth={2.2} className="tv-anim-spin" /> : <Send size={13} strokeWidth={2.2} />}
            {post.status === "failed" ? "Riprova" : "Pubblica ora"}
          </button>
        ) : (
          <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
            <Lock size={12} strokeWidth={2} />
            Pubblicare e&apos; riservato agli approvatori
          </span>
        )}
        {editable ? (
          <button
            type="button"
            disabled={working !== null}
            onClick={() => {
              if (window.confirm("Togliere questo post dal calendario?")) call("remove", { method: "DELETE" }, onRemoved);
            }}
            className="tv-pill h-[44px] cursor-pointer gap-1.5 px-3.5 text-[12.5px] transition-colors hover:bg-line-soft"
            style={{ border: "1px solid var(--color-line)", color: "var(--color-danger)" }}
          >
            {working === "remove" ? <LoaderCircle size={13} strokeWidth={2.2} className="tv-anim-spin" /> : <Trash2 size={13} strokeWidth={2} />}
            Togli
          </button>
        ) : null}
        {post.status !== "published" && post.status !== "pending_approval" ? (
          <Link href={`/studio?run=${item.runId}`} className="tv-pill ml-auto h-[44px] gap-1.5 px-3 text-[12.5px] transition-colors hover:bg-line-soft" style={{ color: "var(--color-wine)" }}>
            Apri
            <ExternalLink size={13} strokeWidth={2} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Un asset pronto: si sceglie giorno e ora e si mette in calendario. */
function ReadyDetail({ item, canPublish, busy, onSchedule }: { item: ReadyItem; canPublish: boolean; busy: boolean; onSchedule: (when: Date) => void }) {
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(DEFAULT_HOUR, 0, 0, 0);
    return localInput(d);
  });
  const layout = item.layout ?? templateLayout(item.format, archetypeFromLabel(item.variant.layout), { eyebrow: item.variant.eyebrow, headline: item.variant.headline, subhead: item.variant.subhead, body: item.variant.body, badge: item.variant.badge, disclaimer: item.variant.disclaimer });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center rounded-[10px] py-3" style={{ background: "var(--color-line-soft)" }}>
        <AssetPreview variant={item.variant} format={item.format} photo={item.photo ?? undefined} displayWidth={PREVIEW_WIDTH[item.format]} layout={layout} archetype={archetypeFromLabel(item.variant.layout)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status="approved" />
        <ChannelBadge channel={item.channel} surface={item.surface} size="sm" />
      </div>
      <p className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
        {item.variant.headline}
        <span className="block text-[12px] font-normal" style={{ color: "var(--color-ink-faint)" }}>
          {item.campaign}
        </span>
      </p>
      {canPublish ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="tv-label">GIORNO E ORA</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} min={localInput(new Date())} className="h-[44px] rounded-[10px] px-3 text-[13px] outline-none focus:shadow-focus" style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }} />
          </label>
          <button type="button" disabled={busy || !when} onClick={() => onSchedule(new Date(when))} className="tv-pill h-[46px] justify-center gap-2 text-[13.5px]" style={{ background: "var(--color-coral)", color: "var(--color-ink)", boxShadow: "var(--shadow-coral)", cursor: busy ? "wait" : "pointer" }}>
            {busy ? <LoaderCircle size={15} strokeWidth={2.2} className="tv-anim-spin" /> : <CalendarPlus size={15} strokeWidth={2.2} />}
            Aggiungi al calendario
          </button>
          <p className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
            Oppure trascinalo su un giorno: va alle {DEFAULT_HOUR}:00.
          </p>
        </>
      ) : (
        <p className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
          <Lock size={12} strokeWidth={2} />
          Programmare e&apos; riservato agli approvatori.
        </p>
      )}
      <Link href={`/studio?run=${item.runId}`} className="tv-pill h-[44px] gap-1.5 self-start px-3 text-[12.5px] transition-colors hover:bg-line-soft" style={{ color: "var(--color-wine)" }}>
        Apri i risultati
        <ExternalLink size={13} strokeWidth={2} />
      </Link>
    </div>
  );
}
