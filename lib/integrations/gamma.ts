import { env } from "../env";
import {
  createJob,
  getJob,
  inFlightCount,
  startedLastDay,
  updateJob,
  type DocumentJob,
} from "../db-documents";
import { documentPath, objectStore } from "../storage";
import {
  FORMAT_MAP,
  GAMMA_API_BASE,
  LANGUAGE,
  LIMITS,
  themeId,
  type ThemeKey,
} from "./gamma-config";
import {
  GammaError,
  GammaGenerationFailedError,
  GammaLocalLimitError,
  GammaNotConfiguredError,
  GammaQuotaError,
  GammaRateLimitError,
  GammaRequestError,
} from "./gamma-errors";
import type { DocumentRequest, GeneratedDocument } from "./types";

/**
 * Documenti multipagina attraverso Gamma.
 *
 * Il motivo per cui esiste questo modulo invece di un impaginatore nostro:
 * `catalogo-servizi` e' un PDF A4 di dodici pagine costruito dai servizi
 * scelti, e la paginazione sensata e' il problema difficile del prodotto.
 * Gamma lo risolve, e il workspace ha gia' il tema di brand.
 *
 * Endpoint verificati sulla documentazione, non dedotti:
 *   POST https://public-api.gamma.app/v1.0/generations
 *   GET  https://public-api.gamma.app/v1.0/generations/{id}
 * Autenticazione con header `X-API-KEY`.
 */

/* ------------------------------------------------------------------ */
/* Forma delle risposte                                                 */
/* ------------------------------------------------------------------ */

export interface GammaCreateResponse {
  generationId: string;
  warnings?: string;
  pageWarnings?: string[];
}

export interface GammaStatusResponse {
  generationId: string;
  status: "pending" | "completed" | "failed";
  gammaId?: string;
  gammaUrl?: string;
  /** Scade in circa una settimana e non e' legato alla chiave. Da trattare come segreto. */
  exportUrl?: string;
  error?: { message: string; statusCode: number };
  credits?: { deducted: number; remaining: number };
}

/* ------------------------------------------------------------------ */
/* Corpo della richiesta                                                */
/* ------------------------------------------------------------------ */

export interface GammaGenerationBody {
  inputText: string;
  textMode: "generate" | "condense" | "preserve";
  format: string;
  title?: string;
  numCards?: number;
  exportAs?: string;
  themeId: string;
  additionalInstructions?: string;
  cardOptions: { dimensions: string };
  textOptions: {
    language: string;
    amount: string;
    tone?: string;
    audience?: string;
  };
  imageOptions: { source: string; style?: string };
}

/**
 * Da richiesta nostra a corpo di Gamma.
 *
 * `textMode` non e' una costante: da un brief si genera, da un documento
 * lungo si condensa, da un testo gia' approvato si preserva. Mandare
 * `generate` su un testo approvato lo farebbe riscrivere.
 */
export function buildBody(
  req: DocumentRequest,
  theme: ThemeKey = "brand",
): GammaGenerationBody {
  const mapping = FORMAT_MAP[req.format];

  // Oltre questa soglia il testo e' una fonte da condensare, non un brief.
  const textMode = req.inputText.length > 6000 ? "condense" : "generate";

  const usesArchive = (req.imageKeys?.length ?? 0) > 0;

  const body: GammaGenerationBody = {
    // Il testo va intero: riassumerlo prima significa far scrivere Gamma su
    // una fonte gia' impoverita, ed e' il modo piu' rapido di perdere un dato.
    inputText: req.inputText,
    textMode,
    format: mapping.format,
    title: req.title,
    themeId: themeId(theme),
    cardOptions: { dimensions: mapping.dimensions },
    textOptions: {
      language: LANGUAGE,
      amount: mapping.amount,
      ...(req.tone ? { tone: req.tone } : {}),
      ...(req.audience ? { audience: req.audience } : {}),
    },
    // Con l'archivio fotografico aziendale non si generano immagini: le foto
    // vere di Time Vision battono qualunque render, e non costano crediti.
    imageOptions: usesArchive
      ? { source: "noImages" }
      : { source: "aiGenerated", style: "3D render, palette istituzionale bordeaux e corallo, superfici pulite, nessun testo" },
  };

  if (req.numCards) body.numCards = req.numCards;
  if (mapping.exportAs) body.exportAs = mapping.exportAs;

  if (usesArchive) {
    body.additionalInstructions =
      "Lascia spazi per le immagini senza generarle: le fotografie vengono inserite dopo dall'archivio aziendale.";
  }

  return body;
}

/* ------------------------------------------------------------------ */
/* Client                                                               */
/* ------------------------------------------------------------------ */

function apiKey(): string {
  if (!env.gammaApiKey) throw new GammaNotConfiguredError();
  return env.gammaApiKey;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GAMMA_API_BASE}${path}`, {
    ...init,
    headers: {
      "X-API-KEY": apiKey(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 402) {
    const detail = await response.text().catch(() => "");
    throw new GammaQuotaError(detail.slice(0, 200));
  }

  if (response.status === 429) {
    const retry = response.headers.get("retry-after");
    throw new GammaRateLimitError(retry ? Number.parseInt(retry, 10) : null);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GammaRequestError(response.status, path, detail.slice(0, 200));
  }

  return (await response.json()) as T;
}

export async function submitGeneration(body: GammaGenerationBody): Promise<GammaCreateResponse> {
  return call<GammaCreateResponse>("/generations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function readGeneration(generationId: string): Promise<GammaStatusResponse> {
  return call<GammaStatusResponse>(`/generations/${generationId}`);
}

/* ------------------------------------------------------------------ */
/* Freno di spesa                                                       */
/* ------------------------------------------------------------------ */

async function assertWithinLimits(): Promise<void> {
  const [inFlight, today] = await Promise.all([inFlightCount(), startedLastDay()]);

  if (inFlight >= LIMITS.concurrency) {
    throw new GammaLocalLimitError("concurrency", LIMITS.concurrency);
  }
  if (today >= LIMITS.perDay) {
    throw new GammaLocalLimitError("daily", LIMITS.perDay);
  }
}

/* ------------------------------------------------------------------ */
/* Avvio e avanzamento del lavoro                                       */
/* ------------------------------------------------------------------ */

/**
 * Registra il lavoro e lo invia a Gamma. Torna subito: l'avanzamento lo fa
 * `advance()`, chiamato dal drain o dalla rotta di stato.
 */
export async function startDocument(
  req: DocumentRequest,
  options: { theme?: ThemeKey; runId?: string | null; createdBy?: string | null } = {},
): Promise<DocumentJob> {
  await assertWithinLimits();

  const theme = options.theme ?? "brand";

  const job = await createJob({
    format: req.format,
    title: req.title,
    request: req,
    theme_id: themeId(theme),
    run_id: options.runId ?? null,
    created_by: options.createdBy ?? null,
  });

  try {
    const created = await submitGeneration(buildBody(req, theme));
    await updateJob(job.id, { generation_id: created.generationId, status: "generating" });
    return { ...job, generation_id: created.generationId, status: "generating" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateJob(job.id, { status: "failed", error: message });
    throw error;
  }
}

/**
 * Fa avanzare un lavoro di un passo. Idempotente: chiamarla due volte non
 * avvia una seconda generazione, perche' `generation_id` e' gia' sulla riga.
 */
export async function advance(jobId: string): Promise<DocumentJob | null> {
  const job = await getJob(jobId);
  if (!job) return null;
  if (job.status === "ready" || job.status === "failed") return job;

  // Nessun id significa che l'invio non e' mai andato a buon fine.
  if (!job.generation_id) {
    await updateJob(job.id, {
      status: "failed",
      error: "Nessun identificativo di generazione: l'invio a Gamma non è riuscito.",
    });
    return getJob(jobId);
  }

  await updateJob(job.id, { attempts: job.attempts + 1 });

  const status = await readGeneration(job.generation_id);

  if (status.status === "failed") {
    await updateJob(job.id, {
      status: "failed",
      error: status.error?.message ?? "Gamma non ha spiegato il motivo.",
      credits_used: status.credits?.deducted ?? null,
    });
    throw new GammaGenerationFailedError(
      job.generation_id,
      status.error?.message ?? "motivo non riportato",
    );
  }

  if (status.status !== "completed") {
    return getJob(jobId);
  }

  const mapping = FORMAT_MAP[job.format];

  // La pagina web non ha file: l'indirizzo modificabile e' il risultato.
  if (!mapping.exportAs) {
    await updateJob(job.id, {
      status: "ready",
      gamma_id: status.gammaId ?? null,
      gamma_url: status.gammaUrl ?? null,
      credits_used: status.credits?.deducted ?? null,
    });
    return getJob(jobId);
  }

  if (!status.exportUrl) {
    await updateJob(job.id, {
      status: "failed",
      error: "Generazione completata ma senza indirizzo di export.",
    });
    return getJob(jobId);
  }

  await updateJob(job.id, { status: "exporting" });

  // Si scarica adesso. Quell'indirizzo scade in circa una settimana e chiunque
  // lo abbia scarica il file: non entra in database e non si mostra a nessuno.
  const stored = await archive(job, status.exportUrl, mapping.exportAs);

  await updateJob(job.id, {
    status: "ready",
    gamma_id: status.gammaId ?? null,
    gamma_url: status.gammaUrl ?? null,
    stored_path: stored.path,
    mime: mapping.mime,
    pages: stored.pages,
    credits_used: status.credits?.deducted ?? null,
  });

  return getJob(jobId);
}

/** Scarica l'export e lo mette nel nostro archivio. */
async function archive(
  job: DocumentJob,
  exportUrl: string,
  extension: string,
): Promise<{ path: string; pages: number | null }> {
  const response = await fetch(exportUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new GammaRequestError(response.status, "export", "download dell'export fallito");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const mapping = FORMAT_MAP[job.format];
  const path = documentPath(job.id, extension);

  await objectStore().put(path, bytes, mapping.mime ?? "application/octet-stream");

  return { path, pages: extension === "pdf" ? countPdfPages(bytes) : null };
}

/**
 * Conta le pagine di un PDF.
 *
 * Un PDF moderno non tiene gli oggetti in chiaro: dalla versione 1.5 le
 * definizioni delle pagine stanno dentro object stream compressi con zlib.
 * Cercare `/Type /Page` nel testo grezzo trova zero su qualunque file reale —
 * ed e' esattamente cosa succedeva prima. Si guarda in chiaro, poi dentro gli
 * stream compressi.
 */
export function countPdfPages(bytes: Uint8Array): number | null {
  const buffer = Buffer.from(bytes);
  if (!buffer.subarray(0, 5).toString("latin1").startsWith("%PDF-")) return null;

  const plain = buffer.toString("latin1");

  const direct = (plain.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  if (direct > 0) return direct;

  const declared = plain.match(/\/Count\s+(\d+)/);
  if (declared) return Number.parseInt(declared[1], 10);

  return countInObjectStreams(buffer);
}

function countInObjectStreams(buffer: Buffer): number | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { inflateSync } = require("node:zlib") as typeof import("node:zlib");
  const plain = buffer.toString("latin1");

  let total = 0;
  let counts: number[] = [];

  const streams = plain.matchAll(/\/Type\s*\/ObjStm[\s\S]*?stream[\r]?[\n]/g);

  for (const match of streams) {
    const start = (match.index ?? 0) + match[0].length;
    const end = plain.indexOf("endstream", start);
    if (end < 0) continue;

    try {
      const inflated = inflateSync(buffer.subarray(start, end)).toString("latin1");
      total += (inflated.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      counts = counts.concat(
        [...inflated.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number.parseInt(m[1], 10)),
      );
    } catch {
      // Uno stream illeggibile non e' un errore: si prova il prossimo.
    }
  }

  if (total > 0) return total;
  // Il /Count piu' alto e' quello della radice dell'albero delle pagine.
  return counts.length > 0 ? Math.max(...counts) : null;
}

/* ------------------------------------------------------------------ */
/* Vista finita                                                         */
/* ------------------------------------------------------------------ */

export function toGeneratedDocument(job: DocumentJob): GeneratedDocument | null {
  if (job.status !== "ready") return null;

  return {
    gammaId: job.gamma_id ?? "",
    gammaUrl: job.gamma_url ?? "",
    storedFileUrl: job.stored_path ? objectStore().urlFor(job.stored_path) : "",
    mime: (job.mime as GeneratedDocument["mime"]) ?? "application/pdf",
    pages: job.pages ?? 0,
    generatedAt: job.updated_at,
  };
}

/** Vero quando esiste una chiave: la console lo usa per dire cosa è attivo. */
export const gammaConfigured = Boolean(env.gammaApiKey);

/* ------------------------------------------------------------------ */
/* Cosa non passa di qui                                                */
/* ------------------------------------------------------------------ */

/** I formati della console, che restano sul percorso Figma piu' HTML. */
const ASSET_FORMATS = ["poster-a4", "linkedin", "ig-feed", "ig-story"];

/**
 * Rifiuta di instradare un asset della console verso Gamma.
 *
 * Sembra una semplificazione ovvia — un solo motore invece di due — e non lo
 * e', per due motivi. Gamma impagina secondo il tema, non secondo un frame:
 * non puo' garantire 1200x627 al pixel. E su quegli asset il disclaimer di un
 * bando deve stare in una posizione fissa, perche' e' un obbligo, non una
 * scelta grafica. Un motore che ridispone le cose a modo suo non puo'
 * prendersi quella responsabilita'.
 */
export function assertNotAssetFormat(format: string): void {
  if (!ASSET_FORMATS.includes(format)) return;

  throw new GammaError(
    `Il formato ${format} non passa da Gamma. Poster A4, LinkedIn, Instagram feed e story ` +
      `restano sul percorso Figma più HTML: Gamma impagina in base al tema e non garantisce ` +
      `la dimensione esatta né la posizione fissa del disclaimer normativo.`,
  );
}
