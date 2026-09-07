"use client";

import { useId, useState } from "react";
import { ChevronDown, FileText, ImageIcon, Link2, Minus, Plus } from "lucide-react";
import { FORMATS, FORMAT_ORDER, type FormatId } from "@/lib/brand";
import { durationLabel, timeAgo } from "@/lib/format";
import type { Attachment, Run, Template, Tool } from "@/lib/types";
import type { ImageChoice, ImagePurpose } from "@/lib/integrations/types";
import { ImagePicker } from "./image-picker";
import { RunBar } from "./run-bar";
import { StepCard } from "./step-card";
import { toolIcon } from "./tool-icons";

interface Props {
  instruction: string;
  onInstruction: (v: string) => void;
  attachments: Attachment[];
  formats: FormatId[];
  onToggleFormat: (f: FormatId) => void;
  templates: Template[];
  templateId: string | null;
  onTemplate: (id: string) => void;
  variantCount: number;
  onVariantCount: (n: number) => void;
  tools: Tool[];
  activeTool: string | null;
  onTool: (slug: string) => void;
  recentRuns: Run[];
  onRun: () => void;
  imageId: string | null;
  imageLabel: string | null;
  onImage: (choice: ImageChoice | null) => void;
}

type Step = 1 | 2 | 3;

/**
 * La composizione in tre passi, uno aperto alla volta.
 *
 * 1. cosa creare — lo strumento, che porta con se' i formati
 * 2. il brief e le fonti
 * 3. formati, visual, template, varianti
 *
 * Gli altri due passi restano visibili come una riga di riepilogo, cosi' si
 * vede sempre dove si e' e cosa si e' scelto, senza avere tutto aperto.
 */
export function Composer({
  instruction,
  onInstruction,
  attachments,
  formats,
  onToggleFormat,
  templates,
  templateId,
  onTemplate,
  variantCount,
  onVariantCount,
  tools,
  activeTool,
  onTool,
  recentRuns,
  onRun,
  imageId,
  imageLabel,
  onImage,
}: Props) {
  const [step, setStep] = useState<Step>(activeTool ? (instruction.trim() ? 3 : 2) : 1);
  const fieldId = useId();

  const tool = tools.find((t) => t.slug === activeTool) ?? null;
  const template = templates.find((t) => t.id === templateId) ?? templates[0] ?? null;
  const launchable = tools.filter((t) => !t.automatic);

  const briefDone = instruction.trim().length > 12;
  const formatsDone = formats.length > 0;
  const ready = Boolean(tool) && briefDone && formatsDone;

  const hint = !tool
    ? "Scegli cosa vuoi creare"
    : !briefDone
      ? "Scrivi il brief per continuare"
      : !formatsDone
        ? "Scegli almeno un formato"
        : `${variantCount} ${variantCount === 1 ? "variante" : "varianti"} in ${formats.length} ${
            formats.length === 1 ? "formato" : "formati"
          } · il controllo del brand è automatico`;

  const pickTool = (slug: string) => {
    onTool(slug);
    setStep(2);
  };

  const step3Summary = [
    formats.map((f) => FORMATS[f].label).join(", ") || "nessun formato",
    imageLabel ? `visual: ${imageLabel}` : "visual dall'archivio",
    template?.name,
    `${variantCount} ${variantCount === 1 ? "variante" : "varianti"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4 px-8 pt-7">
      <header className="pb-1">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]" style={{ color: "var(--color-ink)" }}>
          Nuova creazione
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--color-ink-soft)" }}>
          Tre passi, poi lo Studio scrive, impagina e controlla il brand da solo.
        </p>
      </header>

      {/* ---------------- 1 · cosa ---------------- */}
      <StepCard
        number={1}
        title="Cosa vuoi creare?"
        summary={tool ? tool.description : null}
        done={Boolean(tool)}
        open={step === 1}
        onOpen={() => setStep(1)}
      >
        <div className="grid grid-cols-2 gap-3">
          {launchable.map((t) => (
            <ToolCard key={t.id} tool={t} active={t.slug === activeTool} onPick={() => pickTool(t.slug)} />
          ))}
        </div>
      </StepCard>

      {/* ---------------- 2 · brief ---------------- */}
      <StepCard
        number={2}
        title="Scrivi il brief"
        summary={
          briefDone
            ? `${instruction.trim().slice(0, 90)}${instruction.trim().length > 90 ? "…" : ""} · ${attachments.length} ${
                attachments.length === 1 ? "fonte" : "fonti"
              }`
            : null
        }
        done={briefDone}
        open={step === 2}
        onOpen={() => setStep(2)}
      >
        <label htmlFor={fieldId} className="tv-label">
          BRIEF
        </label>
        <textarea
          id={fieldId}
          value={instruction}
          onChange={(e) => onInstruction(e.target.value)}
          rows={7}
          spellCheck={false}
          placeholder="Di cosa parla la campagna? Misura, importi, scadenza, a chi si rivolge, tono, cosa deve fare chi legge."
          className="tv-scroll mt-2 w-full resize-none rounded-[12px] px-4 py-3 text-[15px] leading-[1.6] outline-none transition-[border-color,box-shadow] focus:shadow-focus"
          style={{
            border: "1px solid var(--color-line)",
            background: "var(--color-paper)",
            color: "var(--color-ink)",
          }}
        />
        <p className="mt-2 text-[12.5px] leading-[1.5]" style={{ color: "var(--color-ink-faint)" }}>
          Cifre e date vengono solo dalle fonti allegate. Quello che non c&apos;è resta segnato{" "}
          <span style={{ color: "var(--color-warning)", fontWeight: 600 }}>[DA VERIFICARE]</span>, mai inventato.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="tv-label mr-1">FONTI</span>
          {attachments.map((a) => (
            <AttachmentChip key={a.label} attachment={a} />
          ))}
          <button
            type="button"
            className="tv-pill h-[32px] cursor-pointer gap-1.5 px-3 text-[12.5px] transition-colors hover:bg-line-soft"
            style={{ border: "1px dashed var(--color-line)", color: "var(--color-ink-soft)", background: "transparent" }}
          >
            <Plus size={13} strokeWidth={2.2} />
            Allega fonte
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => setStep(3)}
            disabled={!briefDone}
            className="tv-pill h-[40px] px-5 text-[13.5px] transition-colors"
            style={{
              background: briefDone ? "var(--color-wine)" : "var(--color-line-soft)",
              color: briefDone ? "#ffffff" : "var(--color-ink-faint)",
              cursor: briefDone ? "pointer" : "not-allowed",
            }}
          >
            Continua
          </button>
        </div>
      </StepCard>

      {/* ---------------- 3 · formati e visual ---------------- */}
      <StepCard
        number={3}
        title="Formati e visual"
        summary={tool ? step3Summary : null}
        done={formatsDone && Boolean(tool)}
        open={step === 3}
        onOpen={() => setStep(3)}
      >
        <div className="flex flex-col gap-6">
          <div>
            <p className="tv-label pb-2.5">FORMATI</p>
            <div className="flex flex-wrap gap-2">
              {FORMAT_ORDER.map((id) => {
                const spec = FORMATS[id];
                const on = formats.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onToggleFormat(id)}
                    aria-pressed={on}
                    className="tv-pill h-[40px] cursor-pointer gap-2 px-4 text-[13.5px] transition-colors"
                    style={{
                      background: on ? "var(--color-wine-tint)" : "var(--color-paper)",
                      border: `1px solid ${on ? "var(--color-rose)" : "var(--color-line)"}`,
                      color: on ? "var(--color-wine)" : "var(--color-ink-soft)",
                    }}
                  >
                    {spec.label}
                    <span className="text-[11.5px] font-normal" style={{ color: on ? "var(--color-rose)" : "var(--color-ink-faint)" }}>
                      {spec.exportNote}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <ImagePicker selectedId={imageId} onSelect={onImage} purpose={(formats[0] ?? "ig-feed") as ImagePurpose} />

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="tv-label pb-2.5">TEMPLATE</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {templates.map((t) => {
                  const on = t.id === template?.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onTemplate(t.id)}
                      aria-pressed={on}
                      className="tv-pill h-[34px] cursor-pointer px-3.5 text-[13px] transition-colors"
                      style={{
                        background: on ? "var(--color-wine)" : "var(--color-line-soft)",
                        color: on ? "#ffffff" : "var(--color-ink-soft)",
                      }}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="tv-label pb-2.5">VARIANTI</p>
              <Stepper value={variantCount} onChange={onVariantCount} />
            </div>
          </div>
        </div>
      </StepCard>

      {recentRuns.length > 0 ? <RecentRuns runs={recentRuns} /> : null}

      <RunBar ready={ready} hint={hint} onRun={onRun} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ToolCard({ tool, active, onPick }: { tool: Tool; active: boolean; onPick: () => void }) {
  const Icon = toolIcon(tool.slug);
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className="flex cursor-pointer items-start gap-3.5 rounded-card p-4 text-left transition-[border-color,background-color] hover:bg-line-soft"
      style={{
        border: `1.5px solid ${active ? "var(--color-rose)" : "var(--color-line)"}`,
        background: active ? "var(--color-wine-tint)" : "var(--color-paper)",
      }}
    >
      <span
        className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px]"
        style={{
          background: active ? "var(--color-wine)" : "var(--color-line-soft)",
          color: active ? "#ffffff" : "var(--color-wine)",
        }}
      >
        <Icon size={19} strokeWidth={1.9} />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
          {tool.title}
        </span>
        <span className="text-[12.5px] leading-[1.45]" style={{ color: "var(--color-ink-soft)" }}>
          {tool.description}
        </span>
      </span>
    </button>
  );
}

function AttachmentChip({ attachment }: { attachment: Attachment }) {
  const Icon = attachment.kind === "document" ? FileText : attachment.kind === "link" ? Link2 : ImageIcon;
  return (
    <span
      className="tv-pill h-[32px] gap-1.5 px-3 text-[12.5px]"
      style={{ background: "var(--color-line-soft)", color: "var(--color-ink-soft)", fontWeight: 500 }}
    >
      <Icon size={13} strokeWidth={1.9} style={{ color: "var(--color-rose)" }} />
      {attachment.label}
    </span>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span
      className="tv-pill h-[40px] gap-0.5 px-1.5 text-[13.5px]"
      style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)", fontWeight: 500 }}
    >
      <StepButton label="Meno varianti" onClick={() => onChange(Math.max(1, value - 1))}>
        <Minus size={14} strokeWidth={2.2} />
      </StepButton>
      <span className="w-[86px] text-center tabular-nums" style={{ color: "var(--color-ink)" }}>
        {value} {value === 1 ? "variante" : "varianti"}
      </span>
      <StepButton label="Più varianti" onClick={() => onChange(Math.min(3, value + 1))}>
        <Plus size={14} strokeWidth={2.2} />
      </StepButton>
    </span>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-line-soft"
      style={{ color: "var(--color-ink-soft)" }}
    >
      {children}
    </button>
  );
}

function RecentRuns({ runs }: { runs: Run[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold"
        style={{ color: "var(--color-ink-faint)" }}
      >
        <ChevronDown
          size={15}
          strokeWidth={2.2}
          className="transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
        Ultime creazioni ({runs.length})
      </button>
      {open ? (
        <ul className="tv-anim-rise mt-2.5 flex flex-col gap-1.5">
          {runs.slice(0, 2).map((run) => (
            <li
              key={run.id}
              className="flex items-center gap-3 rounded-card bg-paper px-4 py-3"
              style={{ border: "1px solid var(--color-line)" }}
            >
              <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--color-ink)" }}>
                {run.instruction}
              </span>
              <span className="shrink-0 text-[12px]" style={{ color: "var(--color-ink-faint)" }} suppressHydrationWarning>
                {durationLabel(run.duration_ms)} · {timeAgo(run.created_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
