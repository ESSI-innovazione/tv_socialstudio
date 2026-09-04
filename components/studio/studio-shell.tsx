"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormatId } from "@/lib/brand";
import { mockScript, startMockRun } from "@/lib/mock-run";
import { applyEvent } from "@/lib/run-events";
import { SAMPLE_ATTACHMENTS, SAMPLE_INSTRUCTION } from "@/lib/seed-data";
import type { Campaign, Run, RunState, Template, Tool, VariantCopy } from "@/lib/types";
import type { ImageChoice } from "@/lib/integrations/types";
import type { StudioUser } from "@/auth";
import { Composer } from "./composer";
import { LeftRail } from "./left-rail";
import { Results } from "./results";
import { RightRail } from "./right-rail";
import { RunMonitor } from "./run-monitor";
import { TopBar } from "./top-bar";

interface Props {
  user: StudioUser;
  tools: Tool[];
  campaigns: Campaign[];
  templates: Template[];
  recentRuns: Run[];
  /** Esecuzione ripristinata dal server dopo un refresh, se c'e'. */
  initialRun: Run | null;
  /** Falso finche' le integrazioni girano sui mock. */
  channelsLive: boolean;
  figmaSyncedAt: string | null;
}

/**
 * Il prodotto e' una pagina sola. Qui vive la macchina a stati:
 * composing -> running -> results, senza mai cambiare rotta.
 */
export function StudioShell({
  user,
  tools,
  campaigns,
  templates,
  recentRuns,
  initialRun,
  channelsLive,
  figmaSyncedAt,
}: Props) {
  const restorable = initialRun && initialRun.variants.length > 0 ? initialRun : null;

  const [state, setState] = useState<RunState>(restorable ? restorable.state : "composing");
  const [run, setRun] = useState<Run | null>(restorable);
  const [selected, setSelected] = useState(0);

  const [instruction, setInstruction] = useState(SAMPLE_INSTRUCTION);

  /**
   * Il visual scelto per la campagna. Vive qui e non nel selettore, perche'
   * deve sopravvivere al passaggio a «in esecuzione»: e' quello che finisce
   * sugli asset.
   */
  const [image, setImage] = useState<ImageChoice | null>(null);
  const [attachments] = useState(SAMPLE_ATTACHMENTS);
  const [formats, setFormats] = useState<FormatId[]>([
    "poster-a4",
    "linkedin",
    "ig-feed",
    "ig-story",
  ]);
  const [variantCount, setVariantCount] = useState(3);
  const [templateId, setTemplateId] = useState<string | null>(templates[0]?.id ?? null);
  const [campaignId, setCampaignId] = useState<string | null>(
    campaigns.find((c) => c.active)?.id ?? campaigns[0]?.id ?? null,
  );
  const [activeTool, setActiveTool] = useState<string | null>("poster-bando");

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const toggleFormat = (f: FormatId) =>
    setFormats((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const pickTool = (slug: string) => {
    setActiveTool(slug);
    const tool = tools.find((t) => t.slug === slug);
    if (!tool || tool.automatic) return;
    setInstruction(tool.prompt_template);
    if (tool.default_formats.length > 0) setFormats(tool.default_formats);
  };

  /**
   * Avvio dell'esecuzione. Oggi gli eventi arrivano dal driver simulato;
   * al passo 3 arriveranno dallo stream della rotta, con lo stesso riduttore.
   */
  const start = () => {
    clearTimers();
    const fresh = startMockRun({
      instruction,
      formats,
      attachments: [...attachments],
      templateId,
      campaignId,
      toolSlug: activeTool ?? "social-kit",
      variantCount,
      createdBy: user.email,
    });

    setRun(fresh);
    setSelected(0);
    setState("running");

    const began = Date.now();
    for (const { at, event } of mockScript(fresh)) {
      timers.current.push(
        setTimeout(() => {
          setRun((prev) => {
            if (!prev) return prev;
            const next = applyEvent(prev, event);
            // Il visual scelto a mano vince su quello proposto dal brief.
            return image && next.brief
              ? { ...next, brief: { ...next.brief, photo: image.url } }
              : next;
          });
          if (event.type === "state") {
            const ms = Date.now() - began;
            setRun((prev) =>
              prev
                ? { ...prev, finished_at: new Date().toISOString(), duration_ms: ms }
                : prev,
            );
            setState(event.state);
          }
        }, at),
      );
    }
  };

  const cancel = () => {
    clearTimers();
    setRun(null);
    setState("composing");
  };

  const reset = () => {
    clearTimers();
    setRun(null);
    setState("composing");
  };

  const editVariant = (index: number, patch: Partial<VariantCopy>) =>
    setRun((prev) =>
      prev
        ? {
            ...prev,
            variants: prev.variants.map((v) => (v.index === index ? { ...v, ...patch } : v)),
          }
        : prev,
    );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <TopBar
        user={user}
        campaigns={campaigns}
        campaignId={campaignId}
        onCampaign={setCampaignId}
        figmaSyncedAt={figmaSyncedAt}
        brandKit="Brand Kit 2026"
      />

      <div className="flex min-h-0 flex-1">
        <LeftRail
          tools={tools}
          campaigns={campaigns}
          campaignId={campaignId}
          activeTool={activeTool}
          onTool={pickTool}
          onCampaign={setCampaignId}
          pendingApprovals={0}
        />

        <main className="tv-scroll min-w-0 flex-1 overflow-y-auto">
          {state === "composing" ? (
            <Composer
              instruction={instruction}
              onInstruction={setInstruction}
              imageId={image?.id ?? null}
              onImage={setImage}
              attachments={[...attachments]}
              formats={formats}
              onToggleFormat={toggleFormat}
              templates={templates}
              templateId={templateId}
              onTemplate={setTemplateId}
              variantCount={variantCount}
              onVariantCount={setVariantCount}
              tools={tools}
              activeTool={activeTool}
              onTool={pickTool}
              recentRuns={recentRuns}
              onRun={start}
            />
          ) : null}

          {state === "running" && run ? <RunMonitor run={run} onCancel={cancel} /> : null}

          {state === "results" && run ? (
            <Results
              run={run}
              selected={selected}
              onSelect={setSelected}
              onEdit={editVariant}
              onReset={reset}
            />
          ) : null}
        </main>

        <RightRail
          state={state}
          formats={formats}
          variantCount={variantCount}
          run={run}
          selected={selected}
          user={user}
          channelsLive={channelsLive}
        />
      </div>
    </div>
  );
}
