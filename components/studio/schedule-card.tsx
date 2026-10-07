"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, CircleAlert, LoaderCircle, Lock } from "lucide-react";
import { FORMATS, type FormatId } from "@/lib/brand";
import { can } from "@/lib/permissions";
import type { ChannelStatus } from "@/lib/publish";
import type { Asset, Channel, Run, ScheduledPost, Surface } from "@/lib/types";
import type { StudioUser } from "@/auth";
import { ChannelBadge, StatusChip } from "./ui";

interface Props {
  run: Run;
  /** Gli asset della variante scelta. */
  assets: Asset[];
  /** Vero quando la variante e' approvata: prima, la card resta chiusa. */
  approved: boolean;
  user: StudioUser;
  channels: ChannelStatus;
  /** I post gia' programmati per questa esecuzione, per mostrarli qui. */
  posts: ScheduledPost[];
  onPosts: (next: ScheduledPost[]) => void;
}

interface Target {
  key: string;
  channel: Channel;
  surface: Surface;
  label: string;
  format: FormatId;
}

const TARGETS: Target[] = [
  { key: "linkedin", channel: "linkedin", surface: "feed", label: "Pagina LinkedIn", format: "linkedin" },
  { key: "ig-feed", channel: "instagram", surface: "feed", label: "Instagram feed", format: "ig-feed" },
  { key: "ig-story", channel: "instagram", surface: "story", label: "Instagram story", format: "ig-story" },
];

/** Il minuto locale in formato `datetime-local`. */
function localInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Domani alle dieci: un orario sensato da cui partire. */
function tomorrowAtTen(): { day: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: "10:00" };
}

/**
 * «Programma la pubblicazione»: i canali con il loro formato, giorno e ora,
 * e un pulsante. Chiusa finche' la variante non e' approvata, e aperta solo
 * a chi puo' programmare: il server controlla le stesse due cose.
 */
export function ScheduleCard({ run, assets, approved, user, channels, posts, onPosts }: Props) {
  const available = TARGETS.filter((t) => assets.some((a) => a.format === t.format));
  const [picked, setPicked] = useState<string[]>(() => available.map((t) => t.key));
  const [{ day, time }, setWhen] = useState(tomorrowAtTen);
  const [captions, setCaptions] = useState<Record<Channel, string>>({ linkedin: "", instagram: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // La caption di partenza e' quella scritta per il canale, hashtag compresi.
  useEffect(() => {
    const next: Record<Channel, string> = { linkedin: "", instagram: "" };
    for (const c of run.captions) next[c.channel] = `${c.text}\n\n${c.hashtags.map((h) => `#${h}`).join(" ")}`;
    setCaptions(next);
  }, [run.captions]);

  const publisher = can(user, "publish");
  const open = approved && publisher;
  const mine = posts.filter((p) => assets.some((a) => a.id === p.asset_id));

  if (available.length === 0) {
    return (
      <p className="text-[12.5px] leading-[1.5]" style={{ color: "var(--color-ink-soft)" }}>
        Questa variante non ha formati social: il poster si scarica, non si pubblica.
      </p>
    );
  }

  const submit = async () => {
    if (!open || picked.length === 0 || !day || !time) return;
    const when = new Date(`${day}T${time}`);
    if (Number.isNaN(when.getTime())) {
      setError("Data o ora non valide.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const created: ScheduledPost[] = [];
    try {
      for (const target of available.filter((t) => picked.includes(t.key))) {
        const asset = assets.find((a) => a.format === target.format)!;
        const raw = captions[target.channel];
        const tags = [...raw.matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu)].map((m) => m[2]);
        const text = raw.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").trim();
        const res = await fetch("/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: asset.id, channel: target.channel, surface: target.surface, caption: text, hashtags: tags, scheduledFor: when.toISOString() }),
        });
        const data = (await res.json().catch(() => ({}))) as { post?: ScheduledPost; error?: string };
        if (!res.ok || !data.post) throw new Error(`${target.label}: ${data.error ?? "non programmato."}`);
        created.push(data.post);
      }
      onPosts([...posts, ...created]);
      setNotice(`${created.length === 1 ? "Post aggiunto" : `${created.length} post aggiunti`} al calendario per il ${when.toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`);
    } catch (e) {
      if (created.length > 0) onPosts([...posts, ...created]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {!open ? (
        <p className="flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px]" style={{ background: "var(--color-line-soft)", color: "var(--color-ink-soft)" }}>
          <Lock size={14} strokeWidth={2} className="shrink-0" />
          {!approved ? "Si sblocca dopo l'approvazione." : "Solo un approvatore puo' programmare."}
        </p>
      ) : null}

      <fieldset disabled={!open} className="flex flex-col gap-2" style={{ opacity: open ? 1 : 0.6 }}>
        <legend className="tv-label pb-1">CANALI</legend>
        {available.map((t) => {
          const on = picked.includes(t.key);
          const live = channels[t.channel];
          return (
            <label key={t.key} className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-[13px]" style={{ color: "var(--color-ink)" }}>
              <input type="checkbox" checked={on} onChange={() => setPicked((prev) => (on ? prev.filter((k) => k !== t.key) : [...prev, t.key]))} className="h-4 w-4 accent-[#720026]" />
              <ChannelBadge channel={t.channel} surface={t.surface} size="sm" />
              <span className="flex-1">{t.label}</span>
              <span className="text-[11.5px]" style={{ color: live ? "var(--color-ink-faint)" : "var(--color-warning)" }}>
                {FORMATS[t.format].exportNote}
                {!live ? " · da collegare" : ""}
              </span>
            </label>
          );
        })}
      </fieldset>

      {open
        ? (["linkedin", "instagram"] as Channel[])
            .filter((c) => available.some((t) => t.channel === c && picked.includes(t.key)))
            .map((c) => (
              <label key={c} className="flex flex-col gap-1">
                <span className="tv-label">CAPTION {c === "linkedin" ? "LINKEDIN" : "INSTAGRAM"}</span>
                <textarea
                  value={captions[c]}
                  onChange={(e) => setCaptions((prev) => ({ ...prev, [c]: e.target.value }))}
                  rows={3}
                  className="tv-scroll w-full resize-none rounded-[10px] px-3 py-2 text-[12.5px] leading-[1.5] outline-none focus:shadow-focus"
                  style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }}
                />
              </label>
            ))
        : null}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="tv-label">GIORNO</span>
          <input type="date" value={day} min={localInput(new Date()).slice(0, 10)} disabled={!open} onChange={(e) => setWhen((w) => ({ ...w, day: e.target.value }))} className="h-[44px] rounded-[10px] px-3 text-[13px] outline-none focus:shadow-focus disabled:opacity-60" style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="tv-label">ORA</span>
          <input type="time" value={time} disabled={!open} onChange={(e) => setWhen((w) => ({ ...w, time: e.target.value }))} className="h-[44px] rounded-[10px] px-3 text-[13px] outline-none focus:shadow-focus disabled:opacity-60" style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }} />
        </label>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!open || busy || picked.length === 0}
        className="tv-pill h-[46px] w-full justify-center gap-2 text-[14px] transition-all"
        style={{
          background: open && picked.length > 0 ? "var(--color-coral)" : "var(--color-mute)",
          color: open && picked.length > 0 ? "var(--color-ink)" : "var(--color-ink-soft)",
          boxShadow: open && picked.length > 0 ? "var(--shadow-coral)" : "none",
          cursor: open && picked.length > 0 ? "pointer" : "not-allowed",
        }}
      >
        {busy ? <LoaderCircle size={15} strokeWidth={2.2} className="tv-anim-spin" /> : open ? <CalendarPlus size={15} strokeWidth={2.2} /> : <Lock size={15} strokeWidth={2} />}
        Aggiungi al calendario
      </button>

      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-[12.5px] leading-[1.45]" style={{ color: "var(--color-danger)" }}>
          <CircleAlert size={14} strokeWidth={2.2} className="mt-[2px] shrink-0" />
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="flex items-start gap-1.5 text-[12.5px] leading-[1.45]" style={{ color: "var(--color-success)" }}>
          <Check size={14} strokeWidth={2.4} className="mt-[2px] shrink-0" />
          <span>
            {notice}{" "}
            <Link href="/studio/calendario" className="font-semibold underline-offset-2 hover:underline" style={{ color: "var(--color-success)" }}>
              Apri il calendario
            </Link>
          </span>
        </p>
      ) : null}

      {mine.length > 0 ? (
        <ul className="flex flex-col gap-1.5 pt-1">
          {mine.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--color-ink)" }}>
              <ChannelBadge channel={p.channel} surface={p.surface} iconOnly />
              <span className="flex-1 truncate" suppressHydrationWarning>
                {p.scheduled_for ? new Date(p.published_at ?? p.scheduled_for).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "senza data"}
              </span>
              <StatusChip status={p.status} size="sm" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
