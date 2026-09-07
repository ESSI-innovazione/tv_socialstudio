import { env } from "../env";
import { VisualEngineError } from "./visual-errors";
import { STYLE_PROMPT } from "./visual-styles";
import { toEnglish } from "./translate";
import type { ImagePurpose, ImageRequest } from "./types";

/**
 * Il motore dei visual: Pollinations.
 *
 * E' lo stesso motore del prototipo FN4: una GET, nessuna chiave, l'immagine
 * torna nel corpo della risposta. E' il ripiego gratuito — il motore buono e'
 * Gamma (`gamma-visual.ts`), che rende 2048px e capisce l'italiano. Questo
 * serve quando non si vogliono spendere crediti.
 *
 * Endpoint verificato:
 *   GET https://image.pollinations.ai/prompt/{prompt}?width&height&seed&model&nologo
 *   GET https://image.pollinations.ai/models   → i modelli disponibili
 *
 * Due limiti misurati, non dedotti, che vale la pena conoscere:
 *
 *  - la risoluzione e' tagliata a circa 0,59 megapixel (l'equivalente di
 *    768x768). Le proporzioni richieste vengono rispettate, la dimensione no:
 *    1080x1920 torna 576x1024, 1200x627 torna 1062x555. Per lo schermo basta,
 *    per una stampa A4 a 300dpi il file va ingrandito e si vede.
 *  - senza token il catalogo dei modelli e' il solo `sana`. Il `flux` dei
 *    tempi di FN4 non e' piu' gratuito: chiedendolo si viene serviti lo stesso,
 *    in silenzio, da `sana`. Con un token il catalogo si allarga: e' per questo
 *    che il modello e' configurabile invece che scritto qui dentro.
 *  - `enhance=true` non fa piu' niente. In FN4 era il pezzo che faceva
 *    funzionare i prompt italiani: passava il testo a un LLM che lo riscriveva
 *    e di fatto lo traduceva. Quell'LLM sta sul loro endpoint di testo, che
 *    oggi risponde 402. Provato: stesso prompt e stesso seme con enhance on e
 *    off danno la stessa immagine (35830 contro 35832 byte). Il parametro
 *    resta perche' non costa niente e un giorno potrebbe tornare, ma il lavoro
 *    che faceva lo fa `translate.ts`.
 */

const BASE = "https://image.pollinations.ai/prompt";

/** Quanto si aspetta una singola richiesta. Misurate: dai 2 ai 45 secondi. */
const TIMEOUT_MS = 90_000;

/** Un servizio gratuito ogni tanto non risponde. Si riprova, con un altro seme. */
const ATTEMPTS = 3;

/* ------------------------------------------------------------------ */
/* Stili                                                                */
/* ------------------------------------------------------------------ */

// Vivono in `visual-styles.ts`: da li' li legge anche il pannello di scelta,
// che e' un componente client e non puo' tirarsi dietro questo file.
export { STYLE_PROMPT, STYLES, DEFAULT_STYLE, isStyle } from "./visual-styles";

/* ------------------------------------------------------------------ */
/* Formati                                                              */
/* ------------------------------------------------------------------ */

/**
 * A ogni impiego la sua proporzione, cosi' il ritaglio non mangia il soggetto.
 *
 * Si chiede la dimensione vera del formato: il motore taglia comunque i pixel
 * ma tiene il rapporto, ed e' il rapporto che conta per il compositore.
 */
const SIZE_FOR: Record<ImagePurpose, { width: number; height: number }> = {
  "poster-a4": { width: 794, height: 1123 },
  linkedin: { width: 1200, height: 627 },
  "ig-feed": { width: 1080, height: 1080 },
  "ig-story": { width: 1080, height: 1920 },
  catalogo: { width: 1600, height: 900 },
};

/* ------------------------------------------------------------------ */
/* Il prompt                                                            */
/* ------------------------------------------------------------------ */

/**
 * Aggiunge al soggetto lo stile e i vincoli che restano.
 *
 * Tutto in inglese, soggetto compreso: `generateBytes` lo traduce prima di
 * arrivare qui (`translate.ts` spiega perche' non e' facoltativo).
 *
 * Quello che NON c'e' piu': l'imposizione della palette di brand. Chiedere al
 * modello «dominante bordeaux e vinaccia» produceva immagini virate di rosso in
 * cui il soggetto spariva, ed era anche inutile — il velo del brand lo mette il
 * compositore, sopra il visual, dove si controlla davvero
 * (`asset-canvas.tsx`, il ramo `generated`).
 *
 * Quello che resta, perche' serve: niente testo (lo scrive il compositore),
 * niente volti riconoscibili, e una zona libera dove appoggiare le parole.
 */
export function visualPrompt(req: ImageRequest, subject = req.prompt): string {
  return [
    subject.trim(),
    STYLE_PROMPT[req.style] + ".",
    "A clear, legible subject.",
    // Il difetto piu' frequente non e' un contenuto sbagliato, e' un'immagine
    // che non dice niente: onde, gradienti, sfondi da schermata.
    "Avoid decorative backgrounds with no subject.",
    "No text, no lettering, no logo, no branding.",
    "No recognisable faces: figures from behind, at an angle, or partial.",
    "Leave one clear, even area for text to be laid over.",
  ].join(" ");
}

/* ------------------------------------------------------------------ */
/* La generazione                                                       */
/* ------------------------------------------------------------------ */

/**
 * Quello che un motore restituisce, quale che sia. La forma e' comune a
 * Pollinations e Gamma cosi' `images.ts` non deve sapere chi ha generato.
 */
export interface GeneratedVisual {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
  /**
   * Il seme, dove esiste: rende ripetibile la generazione. Gamma non ne
   * espone uno, e li' e' `null`.
   */
  seed: number | null;
  model: string;
  /** Il prompt davvero inviato: e' quello che ha prodotto l'immagine. */
  fullPrompt: string;
  /** Vero quando il prompt e' stato tradotto in inglese prima di partire. */
  translated: boolean;
  /** Crediti spesi, dove il motore li conta. */
  creditsUsed?: number | null;
  /** L'id della generazione presso il fornitore, dove ce n'e' uno. */
  providerId?: string;
}

/** @deprecated Il nome vecchio, tenuto perche' non vale un rename. */
export type GeneratedBytes = GeneratedVisual;

/** Un seme nuovo a ogni giro: e' cosi' che «rigenera» da' un'immagine diversa. */
export function newSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

export function visualUrl(req: ImageRequest, seed: number, fullPrompt = visualPrompt(req)): string {
  const size = SIZE_FOR[req.purpose];
  const query = new URLSearchParams({
    width: String(size.width),
    height: String(size.height),
    seed: String(seed),
    model: env.visualModel,
    nologo: "true",
    enhance: "true",
  });
  if (env.pollinationsToken) query.set("token", env.pollinationsToken);

  return `${BASE}/${encodeURIComponent(fullPrompt)}?${query}`;
}

/**
 * Genera un visual e ne restituisce i byte.
 *
 * I byte, non un indirizzo: l'immagine viene archiviata da noi subito dopo.
 * L'URL di Pollinations e' rigenerabile ma non e' un archivio, e non e' dietro
 * la nostra autenticazione.
 */
export async function generateBytes(req: ImageRequest): Promise<GeneratedVisual> {
  const wanted = SIZE_FOR[req.purpose];
  let last: VisualEngineError | null = null;

  // Una traduzione sola, non una per tentativo: i tentativi cambiano il seme,
  // non il testo.
  const subject = await toEnglish(req.prompt);
  const fullPrompt = visualPrompt(req, subject.text);

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    // Il seme richiesto vale al primo tentativo. Se quello fallisce si cambia:
    // insistere sullo stesso seme che ha appena fallito non ha senso.
    const seed = attempt === 0 ? (req.seed ?? newSeed()) : newSeed();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(visualUrl(req, seed, fullPrompt), {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        last = new VisualEngineError(response.status, (await response.text().catch(() => "")).slice(0, 160));
        continue;
      }

      const mimeType = response.headers.get("content-type") ?? "";
      if (!mimeType.startsWith("image/")) {
        last = new VisualEngineError(response.status, `ha risposto ${mimeType || "senza tipo"} invece di un'immagine.`);
        continue;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 1024) {
        last = new VisualEngineError(response.status, `ha risposto con ${bytes.byteLength} byte: non e' un'immagine.`);
        continue;
      }

      // Le proporzioni sono quelle chieste, i pixel no: si legge la
      // dimensione vera dal file invece di fidarsi della richiesta, altrimenti
      // in archivio finisce un numero che il file smentisce.
      const real = readSize(bytes) ?? wanted;

      return {
        bytes,
        mimeType,
        extension: mimeType.includes("png") ? "png" : "jpg",
        width: real.width,
        height: real.height,
        seed,
        model: env.visualModel,
        fullPrompt,
        translated: subject.translated,
        creditsUsed: null,
      };
    } catch (cause) {
      const aborted = cause instanceof Error && cause.name === "AbortError";
      last = new VisualEngineError(
        aborted ? 504 : 502,
        aborted ? "non ha risposto entro 90 secondi." : (cause instanceof Error ? cause.message : String(cause)),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw last ?? new VisualEngineError(502, "nessuna risposta utile.");
}

/* ------------------------------------------------------------------ */
/* Dimensioni reali                                                     */
/* ------------------------------------------------------------------ */

/** Legge larghezza e altezza dall'intestazione del file, JPEG o PNG. */
export function readSize(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // PNG: la IHDR sta sempre agli stessi offset.
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  // JPEG: si scorrono i segmenti fino a un marcatore SOF, che porta le misure.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
      i += 2 + view.getUint16(i + 2);
    }
  }

  return null;
}
