import { after } from "next/server";
import { currentUser } from "@/auth";
import { FORMATS, type FormatId } from "@/lib/brand";
import type { VideoRequest } from "@/lib/db-videos";
import { supabaseConfigured } from "@/lib/env";
import { archetypeFromLabel, decodeLayout } from "@/lib/layout-model";
import { MOCK_BRIEF } from "@/lib/mock-run";
import type { VariantCopy } from "@/lib/types";
import { VideoError } from "@/lib/video/errors";
import { advance, startVideo, toVideoView, videosForRun } from "@/lib/video/jobs";
import { musicAvailable, renderVideo } from "@/lib/video/render";
import { DURATION_MS } from "@/lib/video/spec";

/**
 * Avvia un video e torna subito; elenca quelli di un'esecuzione.
 *
 * La richiesta porta con se' tutto cio' che l'editor mostra — copy,
 * impaginazione, foto — perche' niente di questo sta nel database. Il
 * rendering parte dopo la risposta, nella stessa funzione: chi interroga
 * lo stato non aspetta mai un minuto per un JSON.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

function isFormat(value: unknown): value is FormatId {
  return typeof value === "string" && value in FORMATS;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optional(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Il copy cosi' com'e' nell'editor, con ogni campo al suo tipo. */
function normalizeCopy(input: unknown, index: number): VariantCopy | null {
  if (!input || typeof input !== "object") return null;
  const c = input as Record<string, unknown>;
  if (typeof c.headline !== "string" || !c.headline.trim()) return null;

  return {
    index,
    layout: text(c.layout),
    eyebrow: text(c.eyebrow),
    headline: c.headline,
    subhead: text(c.subhead),
    body: text(c.body),
    badge: optional(c.badge),
    cta_label: text(c.cta_label),
    cta_url: text(c.cta_url),
    disclaimer: optional(c.disclaimer),
  };
}

interface Payload {
  runId?: unknown;
  variant?: unknown;
  format?: unknown;
  copy?: unknown;
  layout?: unknown;
  photo?: unknown;
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  if (!isFormat(payload.format)) {
    return Response.json({ error: "Formato mancante o sconosciuto." }, { status: 400 });
  }

  const variant = typeof payload.variant === "number" ? payload.variant : Number.NaN;
  if (!Number.isInteger(variant) || variant < 0) {
    return Response.json({ error: "Indice della variante non valido." }, { status: 400 });
  }

  const copy = normalizeCopy(payload.copy, variant);
  if (!copy) {
    return Response.json({ error: "Serve il copy della variante, con almeno il titolo." }, { status: 400 });
  }

  // L'impaginazione passa dagli stessi vincoli dell'URL del PNG: la puo'
  // scrivere chiunque, e un blocco fuori dai margini non deve arrivare a Chromium.
  const layout =
    payload.layout && typeof payload.layout === "object"
      ? decodeLayout(JSON.stringify(payload.layout), payload.format)
      : null;

  const videoRequest: VideoRequest = {
    format: payload.format,
    variant,
    copy,
    archetype: archetypeFromLabel(copy.layout),
    layout,
    photo: optional(payload.photo) ?? MOCK_BRIEF.photo,
    durationMs: DURATION_MS,
  };

  // In database `run_id` e' una chiave esterna verso `runs`: un id che non e'
  // un UUID (le esecuzioni simulate) non puo' entrarci. Senza database
  // l'id resta com'e', cosi' la console ritrova i video dopo un refresh.
  const runId =
    typeof payload.runId === "string" && (!supabaseConfigured || UUID.test(payload.runId))
      ? payload.runId
      : null;

  try {
    const job = await startVideo(videoRequest, { runId, createdBy: user.email });

    // L'origine viene dalla richiesta, non dall'ambiente: le foto devono
    // caricarsi anche in locale e sui deployment di anteprima.
    const origin = new URL(request.url).origin;
    after(async () => {
      try {
        await advance(job.id, renderVideo, origin, { force: true });
      } catch (error) {
        console.error("[videos] render", error);
      }
    });

    return Response.json({ video: toVideoView(job) }, { status: 202 });
  } catch (error) {
    // Un freno non e' un guasto: si dice cosa e' successo.
    if (error instanceof VideoError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const runId = new URL(request.url).searchParams.get("runId");
  if (!runId) return Response.json({ error: "Serve runId." }, { status: 400 });

  const [jobs, music] = await Promise.all([videosForRun(runId), musicAvailable()]);
  return Response.json({ videos: jobs.map(toVideoView), music });
}
