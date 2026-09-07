"use client";

import { Building2, Camera, CalendarClock, Check, Download, LoaderCircle, Lock, Send } from "lucide-react";
import { FORMATS, type FormatId } from "@/lib/brand";
import { deadlineLabel, daysUntil } from "@/lib/format";
import type { Run, RunState } from "@/lib/types";
import type { StudioUser } from "@/auth";
import { AssetPreview } from "./asset-preview";
import { LogoMark } from "./logo";

interface Props {
  state: RunState;
  formats: FormatId[];
  variantCount: number;
  /** Il visual scelto al passo 3, se c'e': riempie i fogli dell'anteprima. */
  photoUrl: string | null;
  run: Run | null;
  selected: number;
  user: StudioUser;
  channelsLive: boolean;
}

/**
 * La colonna di destra fa una cosa sola: mostra cosa si sta per ottenere,
 * o cosa si e' ottenuto. Niente regole, niente stato dei canali.
 */
export function RightRail({ state, formats, variantCount, photoUrl, run, selected, user, channelsLive }: Props) {
  return (
    <aside
      className="tv-scroll flex w-[372px] shrink-0 flex-col gap-5 overflow-y-auto bg-paper p-5"
      style={{ borderLeft: "1px solid var(--color-line)" }}
      aria-label="Anteprima"
    >
      {state === "composing" ? <Sheets formats={formats} variantCount={variantCount} photoUrl={photoUrl} /> : null}
      {state === "running" ? <RunningRail run={run} /> : null}
      {state === "results" && run ? <PublishRail run={run} selected={selected} user={user} channelsLive={channelsLive} /> : null}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* composing — i fogli                                                  */
/* ------------------------------------------------------------------ */

/**
 * Un foglio per formato, alla proporzione vera. Vuoti all'inizio; quando si
 * sceglie un visual, il visual entra nei fogli. E' l'unico posto in cui la
 * composizione mostra qualcosa di concreto prima di eseguire.
 */
function Sheets({ formats, variantCount, photoUrl }: { formats: FormatId[]; variantCount: number; photoUrl: string | null }) {
  return (
    <section>
      <p className="tv-label pb-3">COSA OTTERRAI</p>
      {formats.length === 0 ? (
        <p className="rounded-card px-3.5 py-3 text-[13px] leading-[1.5]" style={{ background: "var(--color-line-soft)", color: "var(--color-ink-soft)" }}>
          Scegli cosa creare: i formati compariranno qui, alla loro proporzione.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {formats.map((id) => {
            const spec = FORMATS[id];
            return (
              <li key={id} className="flex items-center gap-4">
                <Sheet id={id} photoUrl={photoUrl} />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
                    {spec.label}
                  </span>
                  <span className="block text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
                    {spec.exportNote}
                  </span>
                  <span className="block text-[12px]" style={{ color: "var(--color-rose)" }}>
                    {variantCount} {variantCount === 1 ? "variante" : "varianti"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Sheet({ id, photoUrl }: { id: FormatId; photoUrl: string | null }) {
  const spec = FORMATS[id];
  const ratio = spec.height / spec.width;
  const w = ratio > 1 ? 72 : 120;
  const h = Math.round(w * ratio);
  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-[6px] transition-[background-color]"
      style={{
        width: w,
        height: h,
        background: photoUrl ? `linear-gradient(180deg, rgb(114 0 38 / .35), rgb(114 0 38 / .9)), url(${photoUrl}) center/cover` : "var(--color-wine-tint)",
        border: photoUrl ? "none" : "1.5px dashed var(--color-wine-edge)",
      }}
      aria-hidden
    >
      <span className="absolute top-1.5 left-1.5">
        <LogoMark size={9} color={photoUrl ? "#ffffff" : "var(--color-wine)"} />
      </span>
      <span className="absolute right-2 bottom-2 left-2 flex flex-col gap-[3px]">
        <span className="h-[4px] w-[70%] rounded-full" style={{ background: photoUrl ? "rgb(255 255 255 / .85)" : "var(--color-wine-edge)" }} />
        <span className="h-[3px] w-[45%] rounded-full" style={{ background: photoUrl ? "rgb(255 255 255 / .55)" : "var(--color-wine-edge)" }} />
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* running                                                              */
/* ------------------------------------------------------------------ */

function RunningRail({ run }: { run: Run | null }) {
  const asset = run?.assets[0] ?? null;
  const variant = asset ? run?.variants.find((v) => v.index === asset.variant_index) : null;

  return (
    <section>
      <p className="tv-label pb-3">PRIMA ANTEPRIMA</p>
      {variant && asset ? (
        <div className="tv-anim-rise">
          <div className="rounded-card bg-paper p-2.5" style={{ border: "1px solid var(--color-line)" }}>
            <AssetPreview variant={variant} format={asset.format} photo={run?.brief?.photo} displayWidth={310} />
          </div>
          <p className="pt-2.5 text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
            {FORMATS[asset.format].label} · {variant.layout}
          </p>
        </div>
      ) : (
        <div
          className="flex h-[220px] flex-col items-center justify-center gap-3 rounded-card"
          style={{ border: "1.5px dashed var(--color-wine-edge)", background: "var(--color-line-soft)" }}
        >
          <LoaderCircle size={22} strokeWidth={2} className="tv-anim-spin" style={{ color: "var(--color-coral)" }} />
          <p className="text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
            il primo asset comparirà qui
          </p>
        </div>
      )}

      {run?.brief ? (
        <dl className="mt-5 flex flex-col gap-2 text-[13px]">
          <Row label="Campagna" value={run.brief.campaign_name} />
          <Row label="Per" value={run.brief.audience} />
          <Row label="Tono" value={run.brief.tone} />
          {run.brief.deadline ? <Row label="Scadenza" value={deadlineLabel(run.brief.deadline) ?? "—"} /> : null}
        </dl>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-[84px] shrink-0" style={{ color: "var(--color-ink-faint)" }}>
        {label}
      </dt>
      <dd style={{ color: "var(--color-ink-soft)" }}>{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* results — pubblicazione                                              */
/* ------------------------------------------------------------------ */

function PublishRail({ run, selected, user, channelsLive }: { run: Run; selected: number; user: StudioUser; channelsLive: boolean }) {
  const blocked = run.guard.some((c) => c.status === "fail");
  const canPublish = user.role === "approver" && !blocked;
  const days = daysUntil(run.brief?.deadline ?? null);

  return (
    <>
      <section>
        <p className="tv-label pb-3">CAPTION · VARIANTE {selected + 1}</p>
        <ul className="flex flex-col gap-2.5">
          {run.captions.map((caption) => (
            <li key={caption.channel} className="rounded-card p-3.5" style={{ border: "1px solid var(--color-line)" }}>
              <div className="flex items-center gap-2 pb-2">
                {caption.channel === "linkedin" ? (
                  <Building2 size={16} strokeWidth={1.9} style={{ color: "var(--color-wine)" }} />
                ) : (
                  <Camera size={16} strokeWidth={1.9} style={{ color: "var(--color-wine)" }} />
                )}
                <span className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                  {caption.channel === "linkedin" ? "LinkedIn" : "Instagram"}
                </span>
              </div>
              <p className="tv-scroll max-h-[112px] overflow-y-auto text-[12.5px] leading-[1.55] whitespace-pre-line" style={{ color: "var(--color-ink-soft)" }}>
                {caption.text}
              </p>
              <p className="pt-2 text-[11.5px]" style={{ color: "var(--color-rose)" }}>
                {caption.hashtags.map((h) => `#${h}`).join(" ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {days !== null && days >= 0 ? (
        <p className="rounded-card px-3.5 py-3 text-[13px]" style={{ background: "var(--color-warm-tint)", color: "var(--color-warning)" }}>
          <span className="font-semibold">{days} giorni alla scadenza</span> · {deadlineLabel(run.brief?.deadline ?? null)}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <div
          className="flex items-center gap-2.5 rounded-card px-3.5 py-3 text-[13px] leading-[1.45]"
          style={{
            background: canPublish ? "var(--color-success-bg)" : "var(--color-warm-tint)",
            color: canPublish ? "var(--color-success)" : "var(--color-warning)",
          }}
        >
          {canPublish ? <Check size={16} strokeWidth={2.2} className="shrink-0" /> : <Lock size={16} strokeWidth={2} className="shrink-0" />}
          <span>
            {blocked
              ? "Il controllo del brand ha bloccato la pubblicazione."
              : canPublish
                ? `${user.name} può pubblicare.`
                : "Serve un approvatore per pubblicare. La bozza resta in attesa."}
          </span>
        </div>

        <button
          type="button"
          disabled={!canPublish && blocked}
          className="tv-pill h-[46px] w-full justify-center gap-2 text-[14.5px] transition-all"
          style={{
            background: blocked ? "var(--color-mute)" : "var(--color-coral)",
            color: "#ffffff",
            boxShadow: blocked ? "none" : "var(--shadow-coral)",
            cursor: blocked ? "not-allowed" : "pointer",
          }}
        >
          <Send size={16} strokeWidth={2.2} />
          {canPublish ? "Pubblica" : "Richiedi approvazione"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="tv-pill h-[40px] cursor-pointer justify-center gap-2 text-[13px] transition-colors hover:bg-line-soft"
            style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
          >
            <Download size={15} strokeWidth={1.9} />
            Scarica
          </button>
          <button
            type="button"
            className="tv-pill h-[40px] cursor-pointer justify-center gap-2 text-[13px] transition-colors hover:bg-line-soft"
            style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
          >
            <CalendarClock size={15} strokeWidth={1.9} />
            Programma
          </button>
        </div>
        {!channelsLive ? (
          <p className="pt-1 text-center text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
            I canali non sono ancora collegati: la pubblicazione non parte da qui.
          </p>
        ) : null}
      </div>
    </>
  );
}
