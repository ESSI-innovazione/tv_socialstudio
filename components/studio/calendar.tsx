"use client";

import { useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Camera, Check, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, Send, Trash2, Unplug } from "lucide-react";
import type { FormatId } from "@/lib/brand";
import { archetypeFromLabel, templateLayout } from "@/lib/layout-model";
import type { ChannelStatus } from "@/lib/publish";
import type { Asset, PostStatus, ScheduledPost, VariantCopy } from "@/lib/types";
import { AssetPreview } from "./asset-preview";

export interface CalendarPost {
  post: ScheduledPost;
  asset: Asset | null;
  variant: VariantCopy | null;
  photo: string | null;
  runId: string;
  campaign: string;
}

interface Props {
  items: CalendarPost[];
  channels: ChannelStatus;
}

type View = "mese" | "settimana";

const STATUS: Record<PostStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Bozza", bg: "var(--color-paper)", fg: "var(--color-ink)" },
  pending_approval: { label: "In approvazione", bg: "var(--color-warm-tint)", fg: "var(--color-warning)" },
  approved: { label: "Approvato", bg: "var(--color-success-bg)", fg: "var(--color-success)" },
  scheduled: { label: "Programmato", bg: "var(--color-wine-tint)", fg: "var(--color-wine)" },
  published: { label: "Pubblicato", bg: "var(--color-success-bg)", fg: "var(--color-success)" },
  failed: { label: "Non riuscito", bg: "#fdecea", fg: "#8c1d18" },
};

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

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

export function Calendar({ items, channels }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("settimana");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<"tutti" | "linkedin" | "instagram">("tutti");
  /** Lo spostamento da tastiera, in attesa di Invio: il giorno di destinazione. */
  const [pending, setPending] = useState<Date | null>(null);

  const today = dayKey(new Date());
  const visible = useMemo(() => items.filter((i) => channelFilter === "tutti" || i.post.channel === channelFilter), [items, channelFilter]);

  // Le celle: un mese intero (sei settimane piene) o la settimana corrente.
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

  const selected = items.find((i) => i.post.id === selectedId) ?? null;

  /**
   * Da tastiera: con un post selezionato le frecce scelgono il giorno
   * (sinistra/destra un giorno, su/giu' una settimana), Invio conferma,
   * Esc annulla. La destinazione si vede evidenziata prima di confermare.
   */
  const onKey = (e: React.KeyboardEvent) => {
    if (!selected || selected.post.status === "published") return;
    const base = pending ?? postDate(selected.post);
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      setPending(addDays(base, step[e.key]));
    } else if (e.key === "Enter" && pending) {
      e.preventDefault();
      const target = pending;
      setPending(null);
      void drop(selected, target);
    } else if (e.key === "Escape") {
      setPending(null);
    }
  };

  const move = (delta: number) => {
    setCursor((c) => (view === "mese" ? new Date(c.getFullYear(), c.getMonth() + delta, 1) : addDays(c, delta * 7)));
  };

  const rangeLabel =
    view === "mese"
      ? cursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" })
      : `${cells[0].toLocaleDateString("it-IT", { day: "numeric", month: "short" })} – ${cells[6].toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}`;

  /** Lo spostamento: stesso orario, giorno nuovo. */
  const drop = async (item: CalendarPost, day: Date) => {
    setOver(null);
    setDragging(null);
    if (item.post.status === "published") return;
    const current = postDate(item.post);
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), current.getHours(), current.getMinutes());
    if (dayKey(next) === dayKey(current)) return;
    setError(null);
    const res = await fetch(`/api/publish/${item.post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledFor: next.toISOString() }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Spostamento non riuscito.");
      return;
    }
    router.refresh();
  };

  const onDragStart = (e: DragEvent, item: CalendarPost) => {
    e.dataTransfer.setData("text/plain", item.post.id);
    e.dataTransfer.effectAllowed = "move";
    setDragging(item.post.id);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ---------------- canali e barra ---------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <ChannelPill icon={Building2} label="LinkedIn" live={channels.linkedin} />
        <ChannelPill icon={Camera} label="Instagram" live={channels.instagram} />

        <div role="tablist" aria-label="Canale" className="flex gap-1 rounded-full p-1" style={{ background: "var(--color-line-soft)" }}>
          {(["tutti", "linkedin", "instagram"] as const).map((c) => (
            <button
              key={c}
              role="tab"
              type="button"
              aria-selected={channelFilter === c}
              onClick={() => setChannelFilter(c)}
              className="tv-pill h-[28px] cursor-pointer px-3 text-[12px] capitalize transition-colors"
              style={{ background: channelFilter === c ? "var(--color-paper)" : "transparent", color: channelFilter === c ? "var(--color-wine)" : "var(--color-ink-soft)" }}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => move(-1)} aria-label="Precedente" className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-line-soft" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}>
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <button type="button" onClick={() => setCursor(new Date())} className="tv-pill h-[34px] cursor-pointer px-3.5 text-[13px] transition-colors hover:bg-line-soft" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}>
            Oggi
          </button>
          <button type="button" onClick={() => move(1)} aria-label="Successivo" className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-line-soft" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}>
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
          <span className="min-w-[180px] px-2 text-[14px] font-semibold capitalize" style={{ color: "var(--color-ink)" }}>
            {rangeLabel}
          </span>
          <div role="tablist" className="flex gap-1 rounded-full p-1" style={{ background: "var(--color-line-soft)" }}>
            {(["settimana", "mese"] as View[]).map((v) => (
              <button
                key={v}
                role="tab"
                type="button"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className="tv-pill h-[28px] cursor-pointer px-3.5 text-[12.5px] capitalize transition-colors"
                style={{ background: view === v ? "var(--color-wine)" : "transparent", color: view === v ? "#ffffff" : "var(--color-ink-soft)" }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-[12.5px]" style={{ color: "var(--color-warning)" }}>
          {error}
        </p>
      ) : null}

      <div className="flex gap-4">
        {/* ---------------- griglia ---------------- */}
        <div className="tv-card min-w-0 flex-1 overflow-hidden" onKeyDown={onKey}>
          {pending && selected ? (
            <p className="px-3 py-2 text-[12.5px]" style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }}>
              Sposto al {pending.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}: Invio per confermare, Esc per annullare.
            </p>
          ) : null}
          <div className="grid grid-cols-7" style={{ borderBottom: "1px solid var(--color-line)" }}>
            {DAYS.map((d) => (
              <div key={d} className="tv-label px-3 py-2">
                {d.toUpperCase()}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7" style={{ gridAutoRows: view === "mese" ? "minmax(112px, auto)" : "minmax(420px, auto)" }}>
            {cells.map((day, i) => {
              const key = dayKey(day);
              const list = byDay.get(key) ?? [];
              const outside = view === "mese" && day.getMonth() !== cursor.getMonth();
              const isToday = key === today;
              return (
                <div
                  key={key}
                  onDragOver={(e) => {
                    if (!dragging) return;
                    e.preventDefault();
                    setOver(key);
                  }}
                  onDragLeave={() => setOver((o) => (o === key ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    const item = items.find((x) => x.post.id === id);
                    if (item) drop(item, day);
                  }}
                  className="flex min-w-0 flex-col gap-1 p-1.5 transition-colors"
                  style={{
                    borderRight: (i + 1) % 7 === 0 ? "none" : "1px solid var(--color-line-soft)",
                    borderBottom: "1px solid var(--color-line-soft)",
                    background:
                      over === key || (pending && dayKey(pending) === key) ? "var(--color-warm-tint)" : isToday ? "var(--color-wine-tint)" : outside ? "var(--color-canvas)" : "var(--color-paper)",
                  }}
                >
                  <span className="px-1 text-[12px] tabular-nums" style={{ color: isToday ? "var(--color-wine)" : outside ? "var(--color-ink-faint)" : "var(--color-ink-soft)", fontWeight: isToday ? 700 : 500 }}>
                    {day.getDate()}
                  </span>
                  {list.map((item) => (
                    <PostChip
                      key={item.post.id}
                      item={item}
                      compact={view === "mese"}
                      selected={item.post.id === selectedId}
                      onSelect={() => {
                        setSelectedId(item.post.id);
                        setPending(null);
                      }}
                      onDragStart={(e) => onDragStart(e, item)}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                    />
                  ))}
                  {view === "settimana" && list.length === 0 ? (
                    <span className="mt-auto rounded-[8px] px-2 py-3 text-center text-[11.5px]" style={{ border: "1.5px dashed var(--color-line)", color: "var(--color-ink-faint)" }}>
                      Trascina qui un post
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------- dettaglio ---------------- */}
        <aside className="tv-card w-[320px] shrink-0 self-start p-4">
          {selected ? <PostDetail item={selected} channels={channels} onChanged={() => router.refresh()} onRemoved={() => setSelectedId(null)} /> : (
            <p className="text-[13px] leading-[1.5]" style={{ color: "var(--color-ink-soft)" }}>
              Scegli un post per vederne caption, stato e azioni. {items.length === 0 ? "Non c'e' ancora niente in calendario: si programma dalla colonna di destra dei risultati." : ""}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ChannelPill({ icon: Icon, label, live }: { icon: typeof Camera; label: string; live: boolean }) {
  return (
    <span className="tv-pill h-[32px] gap-2 px-3.5 text-[12.5px]" style={{ background: live ? "var(--color-success-bg)" : "var(--color-warm-tint)", color: live ? "var(--color-success)" : "var(--color-warning)" }}>
      <Icon size={14} strokeWidth={2} />
      {label}
      {live ? <Check size={13} strokeWidth={2.6} /> : <Unplug size={13} strokeWidth={2.2} />}
      <span className="font-normal">{live ? "collegato" : "canale non collegato"}</span>
    </span>
  );
}

function PostChip({
  item,
  compact,
  selected,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  item: CalendarPost;
  compact: boolean;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  const { post } = item;
  const tone = STATUS[post.status];
  const movable = post.status !== "published";
  const Icon = post.channel === "linkedin" ? Building2 : Camera;
  const time = postDate(post).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  return (
    <button
      type="button"
      draggable={movable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      aria-pressed={selected}
      className="flex w-full min-w-0 cursor-pointer flex-col gap-1 rounded-[8px] px-2 py-1.5 text-left transition-[box-shadow]"
      style={{
        background: tone.bg,
        border: `1px solid ${selected ? "var(--color-rose)" : "var(--color-line)"}`,
        boxShadow: selected ? "0 0 0 2px rgb(206 66 87 / 0.15)" : "none",
        cursor: movable ? "grab" : "pointer",
      }}
      title={movable ? "Trascina per spostare" : "Pubblicato"}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: tone.fg }}>
        <Icon size={12} strokeWidth={2.2} />
        {time}
        <span className="ml-auto truncate font-normal">{tone.label}</span>
      </span>
      {!compact ? (
        <span className="truncate text-[12px]" style={{ color: "var(--color-ink)" }}>
          {item.variant?.headline ?? item.campaign}
        </span>
      ) : null}
    </button>
  );
}

const PREVIEW_WIDTH: Record<FormatId, number> = { linkedin: 288, "ig-feed": 220, "poster-a4": 170, "ig-story": 130 };

function PostDetail({ item, channels, onChanged, onRemoved }: { item: CalendarPost; channels: ChannelStatus; onChanged: () => void; onRemoved: () => void }) {
  const { post, asset, variant } = item;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tone = STATUS[post.status];
  const live = channels[post.channel];

  const call = async (key: string, init: RequestInit, after?: () => void) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/publish/${post.id}`, init);
      const data = (await res.json().catch(() => ({}))) as { error?: string; post?: ScheduledPost };
      if (!res.ok) throw new Error(data.error ?? "Operazione non riuscita.");
      if (data.post?.status === "failed" && data.post.error) setError(data.post.error);
      after?.();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const format = (asset?.format ?? "linkedin") as FormatId;
  const layout =
    asset?.layout ??
    (variant
      ? templateLayout(format, archetypeFromLabel(variant.layout), {
          eyebrow: variant.eyebrow,
          headline: variant.headline,
          subhead: variant.subhead,
          body: variant.body,
          badge: variant.badge,
          disclaimer: variant.disclaimer,
        })
      : null);

  return (
    <div className="flex flex-col gap-3">
      {variant && layout ? (
        <div className="flex justify-center rounded-[10px] py-3" style={{ background: "var(--color-line-soft)" }}>
          <AssetPreview variant={variant} format={format} photo={item.photo ?? undefined} displayWidth={PREVIEW_WIDTH[format]} layout={layout} archetype={archetypeFromLabel(variant.layout)} />
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <span className="tv-pill h-[24px] px-2.5 text-[11px]" style={{ background: tone.bg, color: tone.fg, border: "1px solid var(--color-line)" }}>
          {tone.label}
        </span>
        <span className="text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
          {post.channel === "linkedin" ? "LinkedIn" : post.surface === "story" ? "Instagram story" : "Instagram feed"}
        </span>
      </div>

      <p className="text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>
        {postDate(post).toLocaleString("it-IT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
        <span className="block text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
          {item.campaign} · {post.created_by ?? "—"}
        </span>
      </p>

      {post.caption ? (
        <p className="tv-scroll max-h-[140px] overflow-y-auto rounded-[10px] px-3 py-2 text-[12.5px] leading-[1.5] whitespace-pre-line" style={{ background: "var(--color-line-soft)", color: "var(--color-ink)" }}>
          {post.caption}
          {post.hashtags.length ? <span className="block pt-1" style={{ color: "var(--color-rose)" }}>{post.hashtags.map((h) => `#${h}`).join(" ")}</span> : null}
        </p>
      ) : null}

      {post.error ? (
        <p className="rounded-[10px] px-3 py-2 text-[12px] leading-[1.45]" style={{ background: "#fdecea", color: "#8c1d18" }}>
          {post.error}
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
      {error ? (
        <p className="text-[12px]" style={{ color: "var(--color-warning)" }}>
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {post.status !== "published" ? (
          <button
            type="button"
            disabled={!live || busy !== null}
            onClick={() => call("now", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publishNow: true }) })}
            className="tv-pill h-[36px] gap-1.5 px-3.5 text-[12.5px]"
            style={{ background: live ? "var(--color-coral)" : "var(--color-mute)", color: "#ffffff", cursor: live ? "pointer" : "not-allowed" }}
            title={live ? undefined : "Il canale non e' collegato"}
          >
            {busy === "now" ? <LoaderCircle size={13} strokeWidth={2.2} className="tv-anim-spin" /> : <Send size={13} strokeWidth={2.2} />}
            {post.status === "failed" ? "Riprova" : "Pubblica ora"}
          </button>
        ) : null}
        {post.status !== "published" ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (window.confirm("Togliere questo post dal calendario?")) call("remove", { method: "DELETE" }, onRemoved);
            }}
            className="tv-pill h-[36px] cursor-pointer gap-1.5 px-3.5 text-[12.5px] transition-colors hover:bg-line-soft"
            style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
          >
            {busy === "remove" ? <LoaderCircle size={13} strokeWidth={2.2} className="tv-anim-spin" /> : <Trash2 size={13} strokeWidth={2} />}
            Togli
          </button>
        ) : null}
        <Link href={`/studio?run=${item.runId}`} className="tv-pill ml-auto h-[36px] gap-1.5 px-3 text-[12.5px] transition-colors hover:bg-line-soft" style={{ color: "var(--color-wine)" }}>
          Apri
          <ExternalLink size={13} strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
