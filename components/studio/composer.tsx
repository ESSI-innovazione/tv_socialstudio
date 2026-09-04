"use client";

import { useId, useState } from "react";
import {
  FileText,
  ImageIcon,
  Link2,
  Minus,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { FORMATS, FORMAT_ORDER, type FormatId } from "@/lib/brand";
import { durationLabel, timeAgo } from "@/lib/format";
import type { Attachment, Run, Template, Tool } from "@/lib/types";
import { TOOL_ICONS } from "./left-rail";

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
}

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
}: Props) {
  const [focused, setFocused] = useState(false);
  const fieldId = useId();
  const template = templates.find((t) => t.id === templateId) ?? templates[0] ?? null;
  const ready = instruction.trim().length > 12 && formats.length > 0;

  return (
    <div className="flex flex-col gap-7 px-8 py-7">
      {/* ---------------- istruzione ---------------- */}
      <section>
        <div
          className="rounded-card-lg bg-paper transition-shadow"
          style={{
            border: "1.5px solid var(--color-rose)",
            boxShadow: focused
              ? "0 0 0 4px rgb(206 66 87 / 0.10), var(--shadow-card)"
              : "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-4">
            <label htmlFor={fieldId} className="tv-label">
              ISTRUZIONE
            </label>
            <span
              className="tv-pill h-[26px] gap-1.5 px-2.5 text-[11px]"
              style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}
            >
              <ShieldCheck size={13} strokeWidth={2} />
              brand-guard attivo
            </span>
          </div>

          <textarea
            id={fieldId}
            value={instruction}
            onChange={(e) => onInstruction(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            rows={6}
            spellCheck={false}
            placeholder="Descrivi la campagna: misura, importi, scadenza, destinatario, tono, CTA. Allega le fonti: quello che non c'è nelle fonti non finirà sugli asset."
            className="tv-scroll w-full resize-none bg-transparent px-5 py-3.5 text-[14.5px] leading-[1.62] outline-none"
            style={{ color: "var(--color-ink)" }}
          />

          <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
            {attachments.map((a) => (
              <AttachmentChip key={a.label} attachment={a} />
            ))}
            <button
              type="button"
              className="tv-pill h-[30px] gap-1.5 px-3 text-[12px] transition-colors"
              style={{
                border: "1px dashed var(--color-line)",
                color: "var(--color-ink-faint)",
                background: "transparent",
              }}
            >
              <Plus size={13} strokeWidth={2} />
              Allega fonte
            </button>
          </div>
        </div>
      </section>

      {/* ---------------- formati ---------------- */}
      <section>
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
                className="tv-pill h-[38px] gap-2 px-4 text-[13px] transition-colors"
                style={{
                  background: on ? "var(--color-wine-tint)" : "var(--color-paper)",
                  border: `1px solid ${on ? "var(--color-rose)" : "var(--color-line)"}`,
                  color: on ? "var(--color-wine)" : "var(--color-ink-soft)",
                }}
              >
                {spec.label}
                <span
                  className="text-[11px] font-normal"
                  style={{ color: on ? "var(--color-rose)" : "var(--color-ink-faint)" }}
                >
                  {spec.exportNote}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------------- template + esegui ---------------- */}
      <section
        className="tv-card flex flex-wrap items-center justify-between gap-4 p-4"
        style={{ boxShadow: "var(--shadow-card-soft)" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px]"
            style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}
          >
            <Sparkles size={19} strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <p className="tv-label">TEMPLATE</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {templates.map((t) => {
                const on = t.id === template?.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTemplate(t.id)}
                    aria-pressed={on}
                    className="tv-pill h-[30px] px-3 text-[12.5px] transition-colors"
                    style={{
                      background: on ? "var(--color-wine)" : "var(--color-line-soft)",
                      color: on ? "#ffffff" : "var(--color-ink-soft)",
                    }}
                  >
                    {t.name}
                  </button>
                );
              })}
              <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
                {template ? `${template.frame_count} frame` : "nessun frame"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Stepper value={variantCount} onChange={onVariantCount} />
          <button
            type="button"
            onClick={onRun}
            disabled={!ready}
            className="tv-pill h-[50px] gap-2.5 px-7 text-[14.5px] transition-all"
            style={{
              background: ready ? "var(--color-coral)" : "var(--color-mute)",
              color: "#ffffff",
              boxShadow: ready ? "var(--shadow-coral)" : "none",
              cursor: ready ? "pointer" : "not-allowed",
            }}
          >
            <Play size={17} strokeWidth={2.4} fill="currentColor" />
            Esegui istruzione
          </button>
        </div>
      </section>

      {/* ---------------- istruzioni pronte ---------------- */}
      <section>
        <div className="flex items-baseline justify-between pb-2.5">
          <p className="tv-label">ISTRUZIONI PRONTE</p>
          <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
            modificabili dal marketing, senza rilascio
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {tools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              active={tool.slug === activeTool}
              onPick={() => onTool(tool.slug)}
            />
          ))}
        </div>
      </section>

      {/* ---------------- ultime esecuzioni ---------------- */}
      {recentRuns.length > 0 ? (
        <section>
          <p className="tv-label pb-2.5">ULTIME ESECUZIONI</p>
          <ul className="flex flex-col gap-1.5">
            {recentRuns.slice(0, 2).map((run) => (
              <li key={run.id}>
                <div
                  className="flex items-center gap-3 rounded-card bg-paper px-4 py-3"
                  style={{ border: "1px solid var(--color-line)" }}
                >
                  <span
                    className="tv-mono shrink-0 text-[11.5px] font-semibold"
                    style={{ color: "var(--color-rose)" }}
                  >
                    {run.tool_slug}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-[13px]"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {run.instruction}
                  </span>
                  <span
                    className="shrink-0 text-[11.5px]"
                    style={{ color: "var(--color-ink-faint)" }}
                    suppressHydrationWarning
                  >
                    {durationLabel(run.duration_ms)} · {timeAgo(run.created_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AttachmentChip({ attachment }: { attachment: Attachment }) {
  const Icon =
    attachment.kind === "document" ? FileText : attachment.kind === "link" ? Link2 : ImageIcon;
  return (
    <span
      className="tv-pill h-[30px] gap-1.5 px-3 text-[12px]"
      style={{
        background: "var(--color-line-soft)",
        color: "var(--color-ink-soft)",
        border: "1px solid var(--color-line)",
      }}
    >
      <Icon size={13} strokeWidth={1.9} style={{ color: "var(--color-rose)" }} />
      {attachment.label}
    </span>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span
      className="tv-pill h-[38px] gap-0.5 px-1.5 text-[13px]"
      style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
    >
      <StepButton label="Meno varianti" onClick={() => onChange(Math.max(1, value - 1))}>
        <Minus size={14} strokeWidth={2.2} />
      </StepButton>
      <span className="w-[74px] text-center" style={{ color: "var(--color-ink)" }}>
        {value} {value === 1 ? "variante" : "varianti"}
      </span>
      <StepButton label="Più varianti" onClick={() => onChange(Math.min(3, value + 1))}>
        <Plus size={14} strokeWidth={2.2} />
      </StepButton>
    </span>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-[28px] w-[28px] items-center justify-center rounded-full transition-colors"
      style={{ color: "var(--color-ink-soft)" }}
    >
      {children}
    </button>
  );
}

function ToolCard({
  tool,
  active,
  onPick,
}: {
  tool: Tool;
  active: boolean;
  onPick: () => void;
}) {
  const Icon = TOOL_ICONS[tool.slug] ?? Sparkles;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={tool.automatic}
      aria-pressed={active}
      className="flex h-full flex-col items-start gap-2 rounded-card bg-paper p-3.5 text-left transition-all"
      style={{
        border: `1px solid ${active ? "var(--color-rose)" : "var(--color-line)"}`,
        boxShadow: active ? "var(--shadow-card)" : "var(--shadow-card-soft)",
        cursor: tool.automatic ? "default" : "pointer",
        opacity: tool.automatic ? 0.82 : 1,
      }}
    >
      <span className="flex w-full items-center gap-2">
        <Icon
          size={17}
          strokeWidth={1.9}
          className="shrink-0"
          style={{ color: active ? "var(--color-rose)" : "var(--color-ink-faint)" }}
        />
        <span
          className="tv-mono truncate text-[12px] font-semibold"
          style={{ color: "var(--color-rose)" }}
        >
          {tool.slug}
        </span>
      </span>
      <span
        className="text-[12.5px] leading-[1.45]"
        style={{ color: "var(--color-ink-soft)" }}
      >
        {tool.description}
      </span>
      <span className="mt-auto pt-1 text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
        {tool.note ?? `${tool.run_count} esecuzioni`}
      </span>
    </button>
  );
}
