"use client";

import {
  Building2,
  CalendarClock,
  Camera,
  Check,
  Frame,
  LoaderCircle,
  Lock,
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { BRAND_RULES, FORMATS, type FormatId } from "@/lib/brand";
import { deadlineLabel, daysUntil } from "@/lib/format";
import type { Run, RunState } from "@/lib/types";
import type { StudioUser } from "@/auth";
import { AssetPreview } from "./asset-preview";

interface Props {
  state: RunState;
  formats: FormatId[];
  variantCount: number;
  run: Run | null;
  selected: number;
  user: StudioUser;
  channelsLive: boolean;
}

export function RightRail({
  state,
  formats,
  variantCount,
  run,
  selected,
  user,
  channelsLive,
}: Props) {
  return (
    <aside
      className="tv-scroll flex w-[372px] shrink-0 flex-col gap-5 overflow-y-auto bg-paper p-5"
      style={{ borderLeft: "1px solid var(--color-line)" }}
      aria-label="Pannello di contesto"
    >
      {state === "composing" ? (
        <ComposingRail formats={formats} variantCount={variantCount} channelsLive={channelsLive} />
      ) : null}
      {state === "running" ? <RunningRail run={run} /> : null}
      {state === "results" && run ? (
        <PublishRail run={run} selected={selected} user={user} channelsLive={channelsLive} />
      ) : null}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* composing                                                            */
/* ------------------------------------------------------------------ */

function ComposingRail({
  formats,
  variantCount,
  channelsLive,
}: {
  formats: FormatId[];
  variantCount: number;
  channelsLive: boolean;
}) {
  return (
    <>
      <section>
        <p className="tv-label pb-3">COSA VERRÀ PRODOTTO</p>
        {formats.length === 0 ? (
          <p
            className="rounded-card px-3.5 py-3 text-[12.5px]"
            style={{ background: "var(--color-line-soft)", color: "var(--color-ink-faint)" }}
          >
            Scegli almeno un formato per vedere l&apos;anteprima della produzione.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {formats.map((id) => {
              const spec = FORMATS[id];
              const ratio = spec.height / spec.width;
              const w = 54;
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 rounded-card px-3.5 py-3"
                  style={{ border: "1px solid var(--color-line)" }}
                >
                  <span
                    className="shrink-0 rounded-[5px]"
                    style={{
                      width: w,
                      height: Math.min(78, Math.round(w * ratio)),
                      border: "1.5px dashed var(--color-wine-edge)",
                      background: "var(--color-line-soft)",
                    }}
                  />
                  <span className="min-w-0">
                    <span
                      className="block text-[13px] font-semibold"
                      style={{ color: "var(--color-ink)" }}
                    >
                      {spec.label}
                    </span>
                    <span className="block text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
                      {spec.exportNote}
                    </span>
                    <span className="block text-[11.5px]" style={{ color: "var(--color-rose)" }}>
                      {variantCount} {variantCount === 1 ? "variante" : "varianti"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <p className="tv-label pb-3">REGOLE DI BRAND ATTIVE</p>
        <ul className="flex flex-col gap-1.5">
          {BRAND_RULES.map((rule) => (
            <li key={rule} className="flex items-start gap-2.5 text-[12.5px] leading-[1.5]">
              <ShieldCheck
                size={15}
                strokeWidth={2}
                className="mt-[2px] shrink-0"
                style={{ color: "var(--color-rose)" }}
              />
              <span style={{ color: "var(--color-ink-soft)" }}>{rule}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="tv-label pb-3">CANALI COLLEGATI</p>
        <ul className="flex flex-col gap-1.5">
          <ChannelRow icon={Building2} name="Time Vision" detail="pagina aziendale" live={channelsLive} />
          <ChannelRow icon={Camera} name="@timevision" detail="feed e storie" live={channelsLive} />
          <ChannelRow icon={Frame} name="Brand 2026" detail="sola lettura" live={channelsLive} />
        </ul>
      </section>
    </>
  );
}

function ChannelRow({
  icon: Icon,
  name,
  detail,
  live,
}: {
  icon: LucideIcon;
  name: string;
  detail: string;
  live: boolean;
}) {
  return (
    <li
      className="flex items-center gap-2.5 rounded-card px-3.5 py-2.5"
      style={{ border: "1px solid var(--color-line)" }}
    >
      <Icon size={17} strokeWidth={1.9} className="shrink-0" style={{ color: "var(--color-wine)" }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
          {name}
        </span>
        <span className="block text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
          {detail}
        </span>
      </span>
      <span
        className="tv-pill h-[22px] shrink-0 px-2.5 text-[10.5px]"
        style={{
          background: live ? "var(--color-success-bg)" : "var(--color-warm-tint)",
          color: live ? "var(--color-success)" : "var(--color-warning)",
        }}
      >
        {live ? "collegato" : "mock"}
      </span>
    </li>
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
          <div
            className="rounded-card bg-paper p-2.5"
            style={{ border: "1px solid var(--color-line)" }}
          >
            <AssetPreview
              variant={variant}
              format={asset.format}
              photo={run?.brief?.photo}
              displayWidth={310}
            />
          </div>
          <p className="pt-2.5 text-[12.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
            {FORMATS[asset.format].label} · {variant.layout}
          </p>
          <p className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
            {FORMATS[asset.format].exportNote}
          </p>
        </div>
      ) : (
        <div
          className="flex h-[220px] flex-col items-center justify-center gap-3 rounded-card"
          style={{ border: "1.5px dashed var(--color-wine-edge)", background: "var(--color-line-soft)" }}
        >
          <LoaderCircle
            size={22}
            strokeWidth={2}
            className="tv-anim-spin"
            style={{ color: "var(--color-coral)" }}
          />
          <p className="text-[12.5px]" style={{ color: "var(--color-ink-faint)" }}>
            il primo asset comparirà qui
          </p>
        </div>
      )}

      {run?.brief ? (
        <div className="mt-5">
          <p className="tv-label pb-2.5">BRIEF LETTO</p>
          <dl className="flex flex-col gap-2 text-[12.5px]">
            <Row label="Campagna" value={run.brief.campaign_name} />
            <Row label="Destinatario" value={run.brief.audience} />
            <Row label="Tono" value={run.brief.tone} />
            {run.brief.deadline ? (
              <Row label="Scadenza" value={deadlineLabel(run.brief.deadline) ?? "—"} />
            ) : null}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-[92px] shrink-0" style={{ color: "var(--color-ink-faint)" }}>
        {label}
      </dt>
      <dd style={{ color: "var(--color-ink-soft)" }}>{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* results — pannello di pubblicazione                                  */
/* ------------------------------------------------------------------ */

function PublishRail({
  run,
  selected,
  user,
  channelsLive,
}: {
  run: Run;
  selected: number;
  user: StudioUser;
  channelsLive: boolean;
}) {
  const blocked = run.guard.some((c) => c.status === "fail");
  const canPublish = user.role === "approver" && !blocked;
  const days = daysUntil(run.brief?.deadline ?? null);

  return (
    <>
      <section>
        <p className="tv-label pb-3">PUBBLICAZIONE</p>

        {days !== null && days >= 0 ? (
          <div
            className="mb-3 rounded-card px-3.5 py-3"
            style={{ background: "var(--color-warm-tint)", border: "1px solid var(--color-warm-edge)" }}
          >
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--color-warning)" }}>
              {days} giorni alla scadenza
            </p>
            <p className="text-[11.5px]" style={{ color: "var(--color-warning)" }}>
              {deadlineLabel(run.brief?.deadline ?? null)}
            </p>
          </div>
        ) : null}

        <ul className="flex flex-col gap-2.5">
          {run.captions.map((caption) => (
            <li
              key={caption.channel}
              className="rounded-card p-3.5"
              style={{ border: "1px solid var(--color-line)" }}
            >
              <div className="flex items-center gap-2 pb-2">
                {caption.channel === "linkedin" ? (
                  <Building2 size={16} strokeWidth={1.9} style={{ color: "var(--color-wine)" }} />
                ) : (
                  <Camera size={16} strokeWidth={1.9} style={{ color: "var(--color-wine)" }} />
                )}
                <span className="text-[12.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
                  {caption.channel === "linkedin" ? "LinkedIn" : "Instagram"}
                </span>
                <span
                  className="tv-pill ml-auto h-[20px] px-2 text-[10.5px]"
                  style={{ background: "var(--color-line-soft)", color: "var(--color-ink-faint)" }}
                >
                  V{selected + 1}
                </span>
              </div>
              <p
                className="tv-scroll max-h-[104px] overflow-y-auto text-[12px] leading-[1.55] whitespace-pre-line"
                style={{ color: "var(--color-ink-soft)" }}
              >
                {caption.text}
              </p>
              <p className="pt-2 text-[11px]" style={{ color: "var(--color-rose)" }}>
                {caption.hashtags.map((h) => `#${h}`).join(" ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="tv-label pb-2.5">APPROVAZIONE</p>
        <div
          className="flex items-center gap-2.5 rounded-card px-3.5 py-3"
          style={{
            background: canPublish ? "var(--color-success-bg)" : "var(--color-warm-tint)",
            border: `1px solid ${canPublish ? "#cfe2d7" : "var(--color-warm-edge)"}`,
          }}
        >
          {canPublish ? (
            <Check size={16} strokeWidth={2.2} style={{ color: "var(--color-success)" }} />
          ) : (
            <Lock size={16} strokeWidth={2} style={{ color: "var(--color-warning)" }} />
          )}
          <p
            className="text-[12.5px] leading-[1.45]"
            style={{ color: canPublish ? "var(--color-success)" : "var(--color-warning)" }}
          >
            {blocked
              ? "Brand guard ha bloccato la pubblicazione."
              : canPublish
                ? `${user.name} può pubblicare come approvatore.`
                : "Serve un approvatore per pubblicare. La bozza resta in attesa."}
          </p>
        </div>
      </section>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <button
          type="button"
          disabled={!canPublish}
          className="tv-pill h-[44px] w-full justify-center gap-2 text-[14px] transition-all"
          style={{
            background: canPublish ? "var(--color-coral)" : "var(--color-mute)",
            color: "#ffffff",
            boxShadow: canPublish ? "var(--shadow-coral)" : "none",
            cursor: canPublish ? "pointer" : "not-allowed",
          }}
        >
          <Send size={16} strokeWidth={2.2} />
          {canPublish ? "Pubblica ora" : "Richiedi approvazione"}
        </button>
        <button
          type="button"
          className="tv-pill h-[38px] w-full justify-center gap-2 text-[13px] transition-colors"
          style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
        >
          <CalendarClock size={15} strokeWidth={1.9} />
          Programma
        </button>
        {!channelsLive ? (
          <p className="pt-1 text-center text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
            Canali in mock: la pubblicazione non esce ancora da qui.
          </p>
        ) : null}
      </div>
    </>
  );
}
