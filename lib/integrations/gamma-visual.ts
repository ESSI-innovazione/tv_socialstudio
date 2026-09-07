import { env } from "../env";
import { GAMMA_API_BASE } from "./gamma-config";
import { VisualEngineError } from "./visual-errors";
import type { GeneratedVisual } from "./flux";
import type { ImagePurpose, ImageRequest } from "./types";

/**
 * Il motore dei visual: Gamma.
 *
 * E' quello che produce i risultati migliori, e capisce l'italiano senza che
 * nessuno traduca niente: e' la stessa pipeline che ha fatto le immagini dei
 * deck del prototipo FN4. Restituisce 2048px sul lato lungo.
 *
 * Endpoint verificato sulla documentazione e sul campo:
 *   POST https://public-api.gamma.app/v1.0/images
 *   GET  https://public-api.gamma.app/v1.0/images/{id}
 *
 * ATTENZIONE, e' il punto che ha fatto perdere piu' tempo di tutti:
 * **questo endpoint non ha un prompt negativo**. Non esiste `negativePrompt`
 * ne' niente di equivalente — confermato sulla documentazione. Tutto quello
 * che si scrive nel prompt viene letto come *soggetto*, comprese le
 * proibizioni. Il prompt di prima diceva «Nessun testo, nessun logo, nessun
 * volto riconoscibile» e Gamma rispondeva con nature morte: una tazza bianca
 * su fondo grigio, sfondi decorativi, «carta da parati». Non era un guasto di
 * Gamma, era il nostro prompt.
 *
 * Quindi qui si scrive solo in positivo, e si scrive poco. Lo stile lo porta
 * il campo `type`, non il testo; il velo del brand lo mette il compositore
 * (`asset-canvas.tsx`). Il prompt resta quasi solo quello di chi lo scrive.
 */

/** Quanto si aspetta un'immagine prima di rinunciare. Misurate: 24-36 secondi. */
const POLL_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 3_000;

/** A ogni impiego la sua proporzione, cosi' il ritaglio non mangia il soggetto. */
const SIZE_FOR: Record<ImagePurpose, string> = {
  "poster-a4": "social-portrait",
  linkedin: "banner",
  "ig-feed": "social-square",
  "ig-story": "story",
  catalogo: "slide",
};

interface CreateResponse {
  imageGenerationId?: string;
  message?: string;
}

interface StatusResponse {
  status?: "pending" | "completed" | "failed";
  image?: { url: string; width: number; height: number; format: string; mimeType: string };
  error?: { message: string; statusCode: number };
  credits?: { deducted: number; remaining: number };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* Il prompt                                                            */
/* ------------------------------------------------------------------ */

/**
 * Il prompt di chi scrive, piu' al massimo due frasi. Tutte affermative.
 *
 * `di spalle o di scorcio` si aggiunge solo dove possono comparire persone:
 * su un astratto o una line art introdurrebbe figure che nessuno ha chiesto.
 * Non e' un divieto travestito — e' un'inquadratura, e Gamma la esegue: nelle
 * prove le persone escono di spalle, e nessun volto e' riconoscibile.
 */
export function gammaVisualPrompt(req: ImageRequest): string {
  const parts = [req.prompt.trim()];

  if (req.style === "photo" || req.style === "scene") {
    parts.push("Persone riprese di spalle o di scorcio.");
  }
  parts.push("Ampio spazio uniforme per il testo sovrapposto.");

  return parts.join(" ");
}

/* ------------------------------------------------------------------ */

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GAMMA_API_BASE}${path}`, {
    ...init,
    headers: {
      "X-API-KEY": env.gammaApiKey!,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new VisualEngineError(
      response.status,
      response.status === 402
        ? "Crediti Gamma esauriti: controlla il residuo nel workspace."
        : response.status === 429
          ? "Gamma ha applicato un limite di frequenza: riprova fra qualche minuto."
          : detail.slice(0, 160),
    );
  }

  return (await response.json()) as T;
}

/** Genera un visual con Gamma e ne restituisce i byte. */
export async function generateWithGamma(req: ImageRequest): Promise<GeneratedVisual> {
  const fullPrompt = gammaVisualPrompt(req);

  const created = await call<CreateResponse>("/images", {
    method: "POST",
    body: JSON.stringify({
      prompt: fullPrompt,
      type: req.style === "lineart" ? "illustration" : req.style,
      sizePreset: SIZE_FOR[req.purpose],
      // Il tema del workspace NON si passa: su un'immagine decide la palette e
      // vince sul prompt. La palette del brand la mette il compositore.
    }),
  });

  if (!created.imageGenerationId) {
    throw new VisualEngineError(502, created.message ?? "Gamma non ha aperto la generazione.");
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let status: StatusResponse | null = null;

  while (Date.now() < deadline) {
    await wait(POLL_INTERVAL_MS);
    status = await call<StatusResponse>(`/images/${created.imageGenerationId}`);

    if (status.status === "failed") {
      throw new VisualEngineError(
        status.error?.statusCode ?? 500,
        status.error?.message ?? "generazione fallita.",
      );
    }
    if (status.image?.url) break;
  }

  if (!status?.image?.url) {
    throw new VisualEngineError(504, "l'immagine non e' arrivata in tempo.");
  }

  // L'indirizzo di Gamma scade in circa una settimana e chiunque ce l'abbia
  // scarica il file. Si portano a casa i byte subito.
  const download = await fetch(status.image.url, { cache: "no-store" });
  if (!download.ok) {
    throw new VisualEngineError(download.status, "scaricamento dell'immagine fallito.");
  }

  const mimeType = status.image.mimeType || "image/jpeg";

  return {
    bytes: new Uint8Array(await download.arrayBuffer()),
    mimeType,
    extension: (status.image.format || "jpg").replace(/^\./, ""),
    width: status.image.width,
    height: status.image.height,
    // Gamma non espone un seme: due chiamate uguali danno immagini diverse, ed
    // e' esattamente quello che serve a «rigenera».
    seed: null,
    model: "gamma",
    fullPrompt,
    translated: false,
    creditsUsed: status.credits?.deducted ?? null,
    providerId: created.imageGenerationId,
  };
}
