import { PHOTOS } from "../brand";
import { env } from "../env";
import { objectStore } from "../storage";
import { recordImage, countImagesLastDay, listRecentImages } from "../db-images";
import { GAMMA_API_BASE, themeId } from "./gamma-config";
import {
  GammaLocalLimitError,
  GammaNotConfiguredError,
  GammaQuotaError,
  GammaRateLimitError,
  GammaRequestError,
} from "./gamma-errors";
import type { ImageChoice, ImagePurpose, ImageRequest, ImageSource } from "./types";

/**
 * Da dove vengono i visual.
 *
 * L'archivio aziendale viene prima, sempre: sono fotografie vere di Time
 * Vision, non costano niente e nessun render le batte quando servono persone
 * o aule. La generazione esiste per i key visual astratti, dove non c'e' una
 * fotografia possibile.
 *
 * Endpoint verificato sulla documentazione:
 *   POST https://public-api.gamma.app/v1.0/images
 *   GET  https://public-api.gamma.app/v1.0/images/{id}
 */

/* ------------------------------------------------------------------ */
/* Limiti                                                               */
/* ------------------------------------------------------------------ */

/** Ogni immagine consuma crediti. Questo e' il freno giornaliero. */
export const IMAGE_LIMIT_PER_DAY = 30;

/** Quanto si aspetta un'immagine prima di rinunciare. */
const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 3_000;

/* ------------------------------------------------------------------ */
/* Formati                                                              */
/* ------------------------------------------------------------------ */

type SizePreset = "banner" | "slide" | "social-portrait" | "social-square" | "story";

/** A ogni impiego la sua proporzione, cosi' il ritaglio non mangia il soggetto. */
const SIZE_FOR: Record<ImagePurpose, SizePreset> = {
  "poster-a4": "social-portrait",
  linkedin: "banner",
  "ig-feed": "social-square",
  "ig-story": "story",
  catalogo: "slide",
};

/* ------------------------------------------------------------------ */
/* Risposte di Gamma                                                    */
/* ------------------------------------------------------------------ */

interface CreateImageResponse {
  imageGenerationId: string;
  warnings?: { code: string; message: string }[];
}

interface ImageStatusResponse {
  status?: "pending" | "completed" | "failed";
  image?: {
    url: string;
    width: number;
    height: number;
    format: string;
    mimeType: string;
  };
  error?: { message: string; statusCode: number };
  credits?: { deducted: number; remaining: number };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.gammaApiKey) throw new GammaNotConfiguredError();

  const response = await fetch(`${GAMMA_API_BASE}${path}`, {
    ...init,
    headers: {
      "X-API-KEY": env.gammaApiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 402) {
    throw new GammaQuotaError(await response.text().catch(() => ""));
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* Il prompt                                                            */
/* ------------------------------------------------------------------ */

/**
 * Aggiunge al testo di chi chiede i vincoli che non sono negoziabili.
 *
 * Due regole, e la seconda conta piu' della prima. Niente testo dentro
 * l'immagine: il testo lo mette il compositore, dove il brand controlla corpo
 * e posizione. E niente persone o luoghi riconoscibili: una foto sintetica di
 * un'aula spacciata per un'aula Time Vision e' un rischio reputazionale che
 * nessun controllo automatico intercetta.
 */
export function imagePrompt(req: ImageRequest): string {
  return [
    req.prompt.trim(),
    // I codici esadecimali non funzionano: il modello li ignora e sceglie la
    // sua palette. I nomi dei colori li capisce. Non basta comunque, ed e' per
    // questo che il compositore applica il velo del brand sopra ogni visual
    // generato: la conformita' non si chiede, si impone.
    "Palette obbligatoria: bordeaux profondo e vinaccia scura come colore dominante,",
    "accenti corallo e albicocca caldi. Nessun blu, nessun verde, nessun turchese.",
    "Nessun testo, nessuna scritta, nessun logo dentro l'immagine.",
    "Nessun volto riconoscibile, nessuna persona reale, nessun luogo identificabile.",
    "Composizione pulita, spazio libero per il testo che verrà sovrapposto.",
  ].join(" ");
}

/**
 * Vero quando il visual e' stato generato e non viene dall'archivio.
 *
 * Serve al compositore: su un visual generato il velo del brand si applica
 * sempre, qualunque dimensione abbia. Un modello che sceglie la sua palette
 * e' la norma, non l'eccezione, e nessuna istruzione lo rende affidabile.
 */
export function isGeneratedVisual(photo: string): boolean {
  return photo.includes("/visual/") || photo.includes("%2Fvisual%2F") || photo.includes("visual%2F");
}

/* ------------------------------------------------------------------ */
/* La fonte                                                             */
/* ------------------------------------------------------------------ */

export const imageSource: ImageSource = {
  archive() {
    return PHOTOS.map((photo) => ({
      id: photo.file,
      origin: "archive" as const,
      url: `/brand/${photo.file}`,
      label: photo.subject,
      width: 1200,
      height: 800,
    }));
  },

  async generate(req: ImageRequest, withTheme = false): Promise<ImageChoice> {
    const today = await countImagesLastDay();
    if (today >= IMAGE_LIMIT_PER_DAY) {
      throw new GammaLocalLimitError("daily", IMAGE_LIMIT_PER_DAY);
    }

    const created = await call<CreateImageResponse>("/images", {
      method: "POST",
      body: JSON.stringify({
        prompt: imagePrompt(req),
        type: req.style,
        sizePreset: SIZE_FOR[req.purpose],
        // Il tema del workspace NON si passa qui. Su un documento decide
        // l'impaginazione ed e' quello che vogliamo; su un'immagine decide la
        // palette e vince sul prompt. Due generazioni consecutive sono uscite
        // blu e turchesi nonostante il prompt vietasse esplicitamente
        // entrambi: e' il tema che comanda.
        ...(withTheme ? { themeId: themeId("brand") } : {}),
      }),
    });

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let status: ImageStatusResponse | null = null;

    while (Date.now() < deadline) {
      await wait(POLL_INTERVAL_MS);
      status = await call<ImageStatusResponse>(`/images/${created.imageGenerationId}`);

      if (status.status === "failed") {
        throw new GammaRequestError(
          status.error?.statusCode ?? 500,
          "/images",
          status.error?.message ?? "generazione dell'immagine fallita",
        );
      }
      if (status.image?.url) break;
    }

    if (!status?.image?.url) {
      throw new GammaRequestError(504, "/images", "l'immagine non è arrivata in tempo");
    }

    // L'indirizzo di Gamma scade in circa una settimana e chiunque ce l'abbia
    // scarica il file. Si porta a casa subito e si restituisce il nostro.
    const stored = await rehost(created.imageGenerationId, status.image);

    const choice: ImageChoice = {
      id: created.imageGenerationId,
      origin: "generated",
      url: stored.url,
      label: req.prompt.slice(0, 80),
      width: status.image.width,
      height: status.image.height,
      prompt: req.prompt,
      model: "gamma",
      createdAt: new Date().toISOString(),
    };

    // La provenienza si registra sempre: un visual generato deve poter dire
    // da quale richiesta è nato, come ogni altro asset.
    await recordImage({
      id: choice.id,
      stored_path: stored.path,
      prompt: req.prompt,
      full_prompt: imagePrompt(req),
      style: req.style,
      purpose: req.purpose,
      width: choice.width,
      height: choice.height,
      credits_used: status.credits?.deducted ?? null,
    });

    return choice;
  },
};

async function rehost(
  id: string,
  image: { url: string; mimeType: string; format: string },
): Promise<{ path: string; url: string }> {
  const response = await fetch(image.url, { cache: "no-store" });
  if (!response.ok) {
    throw new GammaRequestError(response.status, "download immagine", "scaricamento fallito");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const extension = (image.format || "png").replace(/^\./, "");
  const path = `visual/${id}.${extension}`;

  const stored = await objectStore().put(path, bytes, image.mimeType || "image/png");
  return { path, url: stored.url };
}

/** I visual generati di recente, per riproporli senza rigenerarli. */
export async function recentGenerated(limit = 12): Promise<ImageChoice[]> {
  const rows = await listRecentImages(limit);

  return rows.map((row) => ({
    id: row.id,
    origin: "generated" as const,
    url: objectStore().urlFor(row.stored_path),
    label: row.prompt.slice(0, 80),
    width: row.width,
    height: row.height,
    prompt: row.prompt,
    model: "gamma",
    createdAt: row.created_at,
  }));
}
