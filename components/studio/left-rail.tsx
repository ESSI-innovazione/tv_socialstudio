"use client";

import {
  BookOpen,
  Box,
  Frame,
  LayoutTemplate,
  Share2,
  ShieldCheck,
  ShieldQuestion,
  type LucideIcon,
} from "lucide-react";
import type { Campaign, Tool } from "@/lib/types";

export const TOOL_ICONS: Record<string, LucideIcon> = {
  "poster-bando": LayoutTemplate,
  "catalogo-servizi": BookOpen,
  "visual-3d": Box,
  "social-kit": Share2,
  "figma-sync": Frame,
  "brand-guard": ShieldCheck,
};

interface Props {
  tools: Tool[];
  campaigns: Campaign[];
  campaignId: string | null;
  activeTool: string | null;
  onTool: (slug: string) => void;
  onCampaign: (id: string) => void;
  pendingApprovals: number;
}

export function LeftRail({
  tools,
  campaigns,
  campaignId,
  activeTool,
  onTool,
  onCampaign,
  pendingApprovals,
}: Props) {
  return (
    <nav
      className="tv-scroll flex w-[236px] shrink-0 flex-col overflow-y-auto bg-paper"
      style={{ borderRight: "1px solid var(--color-line)" }}
      aria-label="Strumenti e campagne"
    >
      <div className="px-3.5 pt-5 pb-2">
        <p className="tv-label px-2.5 pb-2">STRUMENTI</p>
        <ul className="flex flex-col gap-0.5">
          {tools.map((tool) => {
            const Icon = TOOL_ICONS[tool.slug] ?? ShieldQuestion;
            const on = tool.slug === activeTool;
            return (
              <li key={tool.id}>
                <button
                  type="button"
                  onClick={() => onTool(tool.slug)}
                  aria-current={on ? "true" : undefined}
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-left text-[13px] transition-colors"
                  style={{
                    background: on ? "var(--color-wine-tint)" : "transparent",
                    color: on ? "var(--color-wine)" : "var(--color-ink-soft)",
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  <Icon size={17} strokeWidth={1.9} className="shrink-0" />
                  <span className="truncate">{tool.title}</span>
                  {tool.automatic ? (
                    <span
                      className="ml-auto h-[6px] w-[6px] shrink-0 rounded-full"
                      style={{ background: "var(--color-apricot)" }}
                      title="automatico"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mx-3.5 my-2 h-px shrink-0" style={{ background: "var(--color-line)" }} />

      <div className="px-3.5 pb-4">
        <p className="tv-label px-2.5 pb-2">CAMPAGNE</p>
        <ul className="flex flex-col gap-0.5">
          {campaigns.map((c) => {
            const on = c.id === campaignId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onCampaign(c.id)}
                  aria-current={on ? "true" : undefined}
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-left text-[13px] transition-colors"
                  style={{
                    background: on ? "var(--color-wine-tint)" : "transparent",
                    color: on ? "var(--color-wine)" : "var(--color-ink-soft)",
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{
                      background: on ? "var(--color-apricot)" : "var(--color-mute)",
                    }}
                  />
                  <span className="truncate">{c.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-auto p-3.5">
        <div
          className="rounded-card p-3.5"
          style={{
            background: pendingApprovals > 0 ? "var(--color-warm-tint)" : "var(--color-line-soft)",
            border: `1px solid ${
              pendingApprovals > 0 ? "var(--color-warm-edge)" : "var(--color-line)"
            }`,
          }}
        >
          <p
            className="text-[12px] font-semibold"
            style={{
              color: pendingApprovals > 0 ? "var(--color-warning)" : "var(--color-ink)",
            }}
          >
            {pendingApprovals > 0
              ? `${pendingApprovals} approvazioni in attesa`
              : "Nessuna approvazione in attesa"}
          </p>
          <p className="mt-1.5 text-[11.5px] leading-[1.5]" style={{ color: "var(--color-ink-faint)" }}>
            Ogni asset registra template, brief e documenti di origine.
          </p>
        </div>
      </div>
    </nav>
  );
}
