"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormatId } from "@/lib/brand";
import { mockScript, startMockRun } from "@/lib/mock-run";
import { applyEvent } from "@/lib/run-events";
import { SAMPLE_ATTACHMENTS } from "@/lib/seed-data";
import type { Campaign, Run, RunState, Template, Tool, VariantCopy } from "@/lib/types";
import type { ImageChoice } from "@/lib/integrations/types";
import type { StudioUser } from "@/auth";
import { Composer } from "./composer";
import { studioNav } from "./nav";
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
 *
 * L'esecuzione la guida ancora il driver simulato, ma la riga nasce sul
 * server con l'utente della sessione, e il risultato — copy, caption,
 * controllo del brand, asset — viene salvato appena il driver finisce.
 * Ogni ritocco al testo viene salvato poco dopo, cosi' lo storico e
 * l'archivio mostrano quello che si vede qui.
 */
export function StudioShell({ user, tools, campaigns, templates, recentRuns, initialRun, channelsLive, figmaSyncedAt }: Props) {
  const restorable = initialRun && initialRun.variants.length > 0 ? initialRun : null;

  const [state, setState] = useState<RunState>(restorable ? restorable.state : "composing");
  const [run, setRun] = useState<Run | null>(restorable);
  const [selected, setSelected] = useState(0);

  // Si parte da zero: lo strumento scelto al passo 1 porta il suo brief e i suoi formati.
  const [instruction, setInstruction] = useState("");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [formats, setFormats] = useState<FormatId[]>([]);

  /**
   * Il visual scelto per la campagna. Vive qui e non nel selettore, perche'
   * deve sopravvivere al passaggio a «in esecuzione»: e' quello che finisce
   * sugli asset.
   */
  const [image, setImage] = useState<ImageChoice | null>(null);
  const [attachments] = useState(SAMPLE_ATTACHMENTS);
  const [variantCount, setVariantCount] = useState(3);
  const [templateId, setTemplateId] = useState<string | null>(templates[0]?.id ?? null);
  const [campaignId, setCampaignId] = useState<string | null>(campaigns.find((c) => c.active)?.id ?? campaigns[0]?.id ?? null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const toggleFormat = (f: FormatId) => setFormats((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const pickTool = (slug: string) => {
    setActiveTool(slug);
    const tool = tools.find((t) => t.slug === slug);
    if (!tool || tool.automatic) return;
    // Il brief dello strumento e' un canovaccio: non sovrascrive quello che
    // si e' gia' scritto.
    if (!instruction.trim()) setInstruction(tool.prompt_template);
    if (tool.default_formats.length > 0) setFormats(tool.default_formats);
  };

  /* ---------------- persistenza ---------------- */

  /** Le esecuzioni gia' salvate per intero, per non riscriverle a ogni render. */
  const saved = useRef<Set<string>>(new Set(restorable ? [restorable.id] : []));

  // Appena il driver chiude, il risultato va sul server. Gli asset tornano
  // con l'id definitivo e prendono il posto di quelli provvisori.
  useEffect(() => {
    if (state !== "results" || !run || saved.current.has(run.id)) return;
    saved.current.add(run.id);
    const body = {
      state: run.state,
      steps: run.steps,
      logs: run.logs,
      brief: run.brief,
      variants: run.variants,
      captions: run.captions,
      guard: run.guard,
      finished_at: run.finished_at,
      duration_ms: run.duration_ms,
      assets: run.assets,
    };
    fetch(`/api/runs/${run.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { run: Run | null } | null) => {
        if (!data?.run) return;
        const persisted = data.run;
        setRun((prev) => (prev && prev.id === persisted.id ? { ...prev, assets: persisted.assets } : prev));
      })
      .catch(() => saved.current.delete(run.id));
  }, [state, run]);

  // I ritocchi al testo e alla foto: salvati con un po' di ritardo, in blocco.
  const variants = run?.variants;
  const photo = run?.brief?.photo;
  const edits = useRef(0);
  useEffect(() => {
    if (state !== "results" || !run || !saved.current.has(run.id)) return;
    // Il primo passaggio e' il risultato appena arrivato, non un ritocco.
    if (edits.current++ === 0) return;
    const id = run.id;
    const body = JSON.stringify({ variants, brief: run.brief });
    const t = setTimeout(() => {
      fetch(`/api/runs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body }).catch(() => undefined);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants, photo]);

  /* ---------------- esecuzione ---------------- */

  /**
   * Avvio dell'esecuzione. La riga nasce sul server, con l'utente della
   * sessione; poi il driver simulato la popola evento dopo evento.
   */
  const start = async () => {
    clearTimers();
    const input = {
      instruction,
      formats,
      attachments: [...attachments],
      templateId,
      campaignId,
      toolSlug: activeTool ?? "libero",
      variantCount,
      createdBy: user.email,
    };

    let created: Run | null = null;
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.ok) created = ((await res.json()) as { run: Run }).run;
    } catch {
      // Senza server la console gira comunque: il lavoro non verra' salvato.
    }

    const fresh: Run = created
      ? { ...startMockRun(input), id: created.id, created_at: created.created_at }
      : startMockRun(input);
    if (!created) saved.current.add(fresh.id);

    edits.current = 0;
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
            return image && next.brief ? { ...next, brief: { ...next.brief, photo: image.url } } : next;
          });
          if (event.type === "state") {
            const ms = Date.now() - began;
            setRun((prev) => (prev ? { ...prev, finished_at: new Date().toISOString(), duration_ms: ms } : prev));
            setState(event.state);
          }
        }, at),
      );
    }
  };

  const reset = () => {
    clearTimers();
    setRun(null);
    setState("composing");
  };

  /** Cambio di fotografia dall'editor: vale per tutte le varianti dell'esecuzione. */
  const setPhoto = (photo: string) =>
    setRun((prev) => (prev?.brief ? { ...prev, brief: { ...prev.brief, photo } } : prev));

  const editVariant = (index: number, patch: Partial<VariantCopy>) =>
    setRun((prev) => (prev ? { ...prev, variants: prev.variants.map((v) => (v.index === index ? { ...v, ...patch } : v)) } : prev));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <TopBar
        user={user}
        nav={studioNav(user.role)}
        campaigns={campaigns}
        campaignId={campaignId}
        onCampaign={setCampaignId}
        figmaSyncedAt={figmaSyncedAt}
        brandKit="Brand Kit 2026"
      />

      <div className="flex min-h-0 flex-1">
        <main className="tv-scroll min-w-0 flex-1 overflow-y-auto">
          {state === "composing" ? (
            <Composer
              instruction={instruction}
              onInstruction={setInstruction}
              imageId={image?.id ?? null}
              imageLabel={image?.label ?? null}
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

          {state === "running" && run ? <RunMonitor run={run} onCancel={reset} /> : null}

          {state === "results" && run ? (
            <Results
              run={run}
              selected={selected}
              onSelect={setSelected}
              onEdit={editVariant}
              onPhoto={setPhoto}
              onReset={reset}
              user={user}
              channelsLive={channelsLive}
            />
          ) : null}
        </main>

        <RightRail
          state={state}
          formats={formats}
          variantCount={variantCount}
          photoUrl={image?.url ?? null}
          run={run}
          selected={selected}
          user={user}
          channelsLive={channelsLive}
        />
      </div>
    </div>
  );
}
