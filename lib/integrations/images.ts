import { PHOTOS } from "../brand";
import { objectStore } from "../storage";
import { recordImage, countImagesLastDay, listRecentImages } from "../db-images";
import { env } from "../env";
import { generateBytes } from "./flux";
import { generateWithGamma } from "./gamma-visual";
import { VisualError, VisualLimitError } from "./visual-errors";
import type { ImageChoice, ImageRequest, ImageSource, VisualEngine, VisualStyle } from "./types";

/**
 * Da dove vengono i visual.
 *
 * L'archivio aziendale viene prima, sempre: sono fotografie vere di Time
 * Vision, non costano niente e nessun render le batte quando servono persone
 * o aule. La generazione esiste per i key visual, dove una fotografia non c'e'.
 *
 * I motori sono due e fanno lo stesso mestiere:
 *
 *  - **Gamma** (`gamma-visual.ts`) e' il default quando c'e' la chiave. Rende
 *    2048px e capisce l'italiano senza che nessuno traduca. Consuma crediti.
 *  - **Pollinations** (`flux.ts`) e' gratuito, rende 768px e vuole il prompt
 *    in inglese. E' il ripiego quando non si vogliono spendere crediti.
 *
 * Per un periodo Gamma era stato tolto perche' produceva nature morte e
 * «carta da parati». La colpa non era sua: il nostro prompt elencava
 * proibizioni («nessun testo, nessun volto») e quell'endpoint non ha un prompt
 * negativo, quindi le leggeva come soggetto. Corretto il prompt, Gamma e' il
 * migliore dei due di parecchio. La storia sta per esteso in `gamma-visual.ts`.
 */

/* ------------------------------------------------------------------ */
/* Limiti                                                               */
/* ------------------------------------------------------------------ */

/**
 * Il freno giornaliero. Ora il motore e' gratuito, quindi il tetto non protegge
 * piu' un budget: protegge un servizio pubblico che non ci deve niente, e la
 * nostra pazienza quando qualcuno tiene premuto «rigenera».
 */
export const IMAGE_LIMIT_PER_DAY = 120;

/* ------------------------------------------------------------------ */
/* Il prompt                                                            */
/* ------------------------------------------------------------------ */

export { visualPrompt, visualPrompt as imagePrompt } from "./flux";
export { STYLES, DEFAULT_STYLE, isStyle } from "./visual-styles";

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

  async generate(req: ImageRequest): Promise<ImageChoice> {
    const today = await countImagesLastDay();
    if (today >= IMAGE_LIMIT_PER_DAY) {
      throw new VisualLimitError(IMAGE_LIMIT_PER_DAY);
    }

    const engine = pickEngine(req.engine);
    const produced = engine === "gamma" ? await generateWithGamma(req) : await generateBytes(req);

    // Due generazioni dello stesso prompt non si sovrascrivono a vicenda
    // nell'archivio: l'id porta il momento e il seme, o l'id del fornitore
    // quando un seme non c'e'.
    const id = `${Date.now().toString(36)}-${produced.seed ?? produced.providerId ?? "x"}`;
    const path = `visual/${id}.${produced.extension}`;
    const stored = await objectStore().put(path, produced.bytes, produced.mimeType);

    const choice: ImageChoice = {
      id,
      origin: "generated",
      url: stored.url,
      label: req.prompt.slice(0, 80),
      width: produced.width,
      height: produced.height,
      prompt: req.prompt,
      model: produced.model,
      style: req.style,
      seed: produced.seed,
      engine,
      createdAt: new Date().toISOString(),
    };

    // La provenienza si registra sempre: un visual generato deve poter dire
    // da quale richiesta è nato, come ogni altro asset. Stile e seme in piu',
    // perché senza quei due una variante non si sa piu' rifare.
    await recordImage({
      id: choice.id,
      stored_path: stored.path,
      prompt: req.prompt,
      full_prompt: produced.fullPrompt,
      style: req.style,
      purpose: req.purpose,
      width: choice.width,
      height: choice.height,
      credits_used: produced.creditsUsed ?? null,
      model: produced.model,
      seed: produced.seed,
    });

    return choice;
  },
};

/**
 * Una variante di un visual gia' fatto: stesso prompt, stesso stile, seme nuovo.
 *
 * E' quello che serve a chi guarda un'immagine e pensa «quasi, ma non questa».
 */
export async function regenerate(
  source: Pick<ImageChoice, "prompt" | "style" | "engine">,
  purpose: ImageRequest["purpose"],
): Promise<ImageChoice> {
  if (!source.prompt) {
    // Solo un visual d'archivio arriva qui senza prompt, e di quello non c'e'
    // niente da rigenerare: e' una fotografia, non una richiesta.
    throw new VisualError("Questo visual non e' stato generato: non c'e' un prompt da rifare.");
  }

  // Nessun seme: e' proprio la variazione che si sta cercando. Su Pollinations
  // il seme lo sorteggia il motore, Gamma non ne ha uno.
  return imageSource.generate({
    prompt: source.prompt,
    purpose,
    style: source.style ?? "photo",
    engine: source.engine,
  });
}

/** Il motore da usare: quello chiesto, o quello configurato. */
export function pickEngine(asked?: VisualEngine): VisualEngine {
  if (asked === "gamma") return env.gammaApiKey ? "gamma" : "flux";
  if (asked === "flux") return "flux";
  return env.visualEngine;
}

/** Vero quando Gamma e' utilizzabile su questo ambiente. */
export function gammaAvailable(): boolean {
  return Boolean(env.gammaApiKey);
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
    model: row.model ?? "sana",
    engine: row.model === "gamma" ? "gamma" : "flux",
    style: row.style as VisualStyle,
    seed: row.seed ?? undefined,
    createdAt: row.created_at,
  }));
}
