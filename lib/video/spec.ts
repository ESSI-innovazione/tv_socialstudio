import { FORMATS, type FormatId } from "../brand";

/**
 * Le costanti del video breve.
 *
 * Un video e' l'asset che prende vita per otto secondi: abbastanza per una
 * story, abbastanza corto perche' il rendering stia dentro una funzione.
 * A 30 fotogrammi al secondo sono 240 scatti di Chromium: e' il costo che
 * decide la durata, non il gusto.
 */

export const FPS = 30;
export const DURATION_MS = 8000;

/**
 * Freni, come per Gamma. Qui non si spendono crediti ma CPU: due render in
 * volo occupano due funzioni per un minuto ciascuna, e il tetto giornaliero
 * evita che un ciclo impazzito riempia lo store.
 */
export const LIMITS = { concurrency: 2, perDay: 40 } as const;

/** Un lavoro `pending` piu' vecchio di cosi' ha perso chi doveva avviarlo. */
export const STALE_PENDING_MS = 20_000;

/**
 * Un lavoro `rendering` piu' vecchio di cosi' e' stato interrotto: il
 * `maxDuration` delle rotte e' 300 secondi, quindi oltre i sei minuti nessuna
 * funzione ci sta ancora lavorando.
 */
export const STALE_RENDERING_MS = 6 * 60_000;

/** Un rendering interrotto si riprende una volta. Alla seconda e' un guasto. */
export const MAX_ATTEMPTS = 2;

/** La base musicale del brand. Se manca, il video esce con audio silenzioso. */
export const MUSIC_FILE = "brand-bed.mp3";

export interface VideoSize {
  /** Dimensioni della pagina in Chromium: quelle del formato. */
  captureWidth: number;
  captureHeight: number;
  /** Il fattore di scala dello scatto. */
  scale: number;
  /** Dimensioni del file: pari, come vuole H.264 con yuv420p. */
  width: number;
  height: number;
}

/** La larghezza a cui esce il poster: quella di una story, non di piu'. */
const POSTER_VIDEO_WIDTH = 1080;

/**
 * Le misure del video per formato.
 *
 * L'A4 e' disegnato a 794 px di larghezza, troppo poco per un video: si
 * cattura in scala fino a 1080 px. Non di piu': a scala doppia (1588x2246)
 * i 240 scatti con una fotografia dentro superavano i 300 secondi della
 * funzione in produzione, e il lavoro moriva a meta'. Le dimensioni
 * dispari (LinkedIn e' alto 627) perdono un pixel: l'encoder non le
 * accetta e nessuno lo nota.
 */
export function videoSize(format: FormatId): VideoSize {
  const spec = FORMATS[format];
  const scale = format === "poster-a4" ? POSTER_VIDEO_WIDTH / spec.width : 1;
  const even = (n: number) => Math.floor((n * scale) / 2) * 2;
  return {
    captureWidth: spec.width,
    captureHeight: spec.height,
    scale,
    width: even(spec.width),
    height: even(spec.height),
  };
}
