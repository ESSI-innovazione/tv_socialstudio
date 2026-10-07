"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, CalendarClock, Camera, Check, CircleAlert, LoaderCircle, Send, Unplug } from "lucide-react";
import type { ChannelStatus } from "@/lib/publish";
import type { Asset, Channel, Run, ScheduledPost, Surface } from "@/lib/types";

interface Props {
  run: Run;
  /** Gli asset approvati della variante scelta: uno per formato. */
  assets: Asset[];
  channels: ChannelStatus;
}

interface Target {
  channel: Channel;
  surface: Surface;
  label: string;
  icon: typeof Camera;
  asset: Asset | undefined;
}

/** Il minuto locale in formato `datetime-local`, per il valore minimo del campo. */
function localInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * L'ultimo passo: il canale, la caption, adesso o a una data. Il server
 * rifiuta un asset non approvato e un canale non collegato per il «subito»;
 * la programmazione si accetta sempre, perche' le chiavi possono arrivare.
 */
export function PublishStep({ run, assets, channels }: Props) {
  const targets = ([
    { channel: "linkedin", surface: "feed", label: "LinkedIn", icon: Building2, asset: assets.find((a) => a.format === "linkedin") },
    { channel: "instagram", surface: "feed", label: "Instagram feed", icon: Camera, asset: assets.find((a) => a.format === "ig-feed") },
    { channel: "instagram", surface: "story", label: "Instagram story", icon: Camera, asset: assets.find((a) => a.format === "ig-story") },
  ] as Target[]).filter((t) => t.asset);

  const [target, setTarget] = useState<Target | null>(targets[0] ?? null);
  const [caption, setCaption] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState<"now" | "later" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ScheduledPost | null>(null);

  // La caption di partenza e' quella scritta per il canale, hashtag compresi.
  useEffect(() => {
    if (!target) return;
    const c = run.captions.find((x) => x.channel === target.channel);
    setCaption(c ? `${c.text}\n\n${c.hashtags.map((h) => `#${h}`).join(" ")}` : "");
    setDone(null);
    setError(null);
  }, [target, run.captions]);

  if (targets.length === 0) {
    return (
      <p className="rounded-card px-3.5 py-3 text-[12.5px] leading-[1.5]" style={{ background: "var(--color-line-soft)", color: "var(--color-ink-soft)" }}>
        Questa variante non ha formati social: il poster si scarica, non si pubblica.
      </p>
    );
  }
  if (!target) return null;

  const live = channels[target.channel];

  const submit = async (mode: "now" | "later") => {
    if (!target.asset) return;
    setBusy(mode);
    setError(null);
    try {
      // La caption porta gli hashtag in coda: si separano per il canale.
      const tags = [...caption.matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu)].map((m) => m[2]);
      const text = caption.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").trim();
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: target.asset.id,
          channel: target.channel,
          surface: target.surface,
          caption: text,
          hashtags: tags,
          scheduledFor: mode === "later" && when ? new Date(when).toISOString() : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { post?: ScheduledPost; error?: string };
      if (!res.ok || !data.post) throw new Error(data.error ?? "La pubblicazione non e' partita.");
      setDone(data.post);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (done) {
    const ok = done.status === "published";
    const scheduled = done.status === "scheduled";
    return (
      <section className="flex flex-col gap-2 rounded-card px-3.5 py-3 text-[13px] leading-[1.45]" style={{ background: ok || scheduled ? "var(--color-success-bg)" : "#fdecea", color: ok || scheduled ? "var(--color-success)" : "#8c1d18" }}>
        <p className="flex items-start gap-2">
          {ok || scheduled ? <Check size={16} strokeWidth={2.4} className="mt-[1px] shrink-0" /> : <CircleAlert size={16} strokeWidth={2.2} className="mt-[1px] shrink-0" />}
          <span>
            {ok ? (
              <>
                <span className="font-semibold">Pubblicato su {target.label}.</span>
                {done.external_id ? <span className="block text-[12px]">id {done.external_id}</span> : null}
              </>
            ) : scheduled ? (
              <>
                <span className="font-semibold">Programmato</span> per il{" "}
                {new Date(done.scheduled_for ?? "").toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                {!live ? <span className="block text-[12px]">Il canale non e&apos; collegato: partira&apos; quando lo sara&apos;.</span> : null}
              </>
            ) : (
              <>
                <span className="font-semibold">Non riuscito.</span>
                <span className="block text-[12px]">{done.error}</span>
              </>
            )}
          </span>
        </p>
        <div className="flex gap-2">
          <Link href="/studio/calendario" className="text-[12.5px] font-semibold underline-offset-2 hover:underline" style={{ color: "inherit" }}>
            Apri il calendario
          </Link>
          <button type="button" onClick={() => setDone(null)} className="ml-auto cursor-pointer text-[12.5px] font-semibold" style={{ color: "inherit" }}>
            Un altro canale
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-card p-3.5" style={{ border: "1px solid var(--color-line)" }}>
      <div className="flex flex-wrap gap-1.5">
        {targets.map((t) => {
          const on = t.label === target.label;
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              type="button"
              onClick={() => setTarget(t)}
              aria-pressed={on}
              className="tv-pill h-[32px] cursor-pointer gap-1.5 px-3 text-[12.5px] transition-colors"
              style={{ background: on ? "var(--color-wine)" : "var(--color-line-soft)", color: on ? "#ffffff" : "var(--color-ink-soft)" }}
            >
              <Icon size={13} strokeWidth={2} />
              {t.label}
            </button>
          );
        })}
      </div>

      <p className="flex items-center gap-1.5 text-[12px]" style={{ color: live ? "var(--color-success)" : "var(--color-warning)" }}>
        {live ? <Check size={13} strokeWidth={2.4} /> : <Unplug size={13} strokeWidth={2.2} />}
        {live ? "Canale collegato" : "Canale non collegato: puoi comunque programmare"}
      </p>

      {target.surface !== "story" ? (
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={5}
          className="tv-scroll w-full resize-none rounded-[10px] px-3 py-2.5 text-[12.5px] leading-[1.5] outline-none focus:shadow-focus"
          style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }}
          aria-label="Caption"
        />
      ) : (
        <p className="text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
          Le story non hanno caption: esce l&apos;immagine 1080×1920.
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="tv-label">QUANDO</span>
        <input
          type="datetime-local"
          value={when}
          min={localInput(new Date())}
          onChange={(e) => setWhen(e.target.value)}
          className="h-[38px] rounded-[10px] px-3 text-[13px] outline-none focus:shadow-focus"
          style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }}
        />
      </label>

      {error ? (
        <p className="text-[12px] leading-[1.45]" style={{ color: "var(--color-warning)" }}>
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => submit("later")}
          disabled={!when || busy !== null}
          className="tv-pill h-[40px] justify-center gap-2 text-[13px] transition-colors hover:bg-line-soft"
          style={{ border: "1px solid var(--color-line)", color: when ? "var(--color-ink)" : "var(--color-ink-faint)", cursor: when ? "pointer" : "not-allowed" }}
          title={when ? undefined : "Scegli una data e un'ora"}
        >
          {busy === "later" ? <LoaderCircle size={14} strokeWidth={2.2} className="tv-anim-spin" /> : <CalendarClock size={14} strokeWidth={2} />}
          Programma
        </button>
        <button
          type="button"
          onClick={() => submit("now")}
          disabled={!live || busy !== null}
          className="tv-pill h-[40px] justify-center gap-2 text-[13px] transition-all"
          style={{
            background: live ? "var(--color-coral)" : "var(--color-mute)",
            color: "#ffffff",
            boxShadow: live ? "var(--shadow-coral)" : "none",
            cursor: live ? "pointer" : "not-allowed",
          }}
          title={live ? undefined : "Il canale non e' collegato"}
        >
          {busy === "now" ? <LoaderCircle size={14} strokeWidth={2.2} className="tv-anim-spin" /> : <Send size={14} strokeWidth={2.2} />}
          Pubblica ora
        </button>
      </div>
    </section>
  );
}
