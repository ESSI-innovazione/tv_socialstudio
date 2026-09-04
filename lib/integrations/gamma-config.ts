import type { DocFormat } from "./types";

/**
 * Configurazione di Gamma, in un posto solo.
 *
 * Gli id dei temi cambiano quando qualcuno ricrea un tema nel workspace:
 * sparsi nel codice diventerebbero una caccia al tesoro. Qui si cambia una
 * riga.
 */

export const GAMMA_API_BASE = "https://public-api.gamma.app/v1.0";

/* ------------------------------------------------------------------ */
/* Temi del workspace                                                   */
/* ------------------------------------------------------------------ */

export interface ThemeChoice {
  id: string;
  label: string;
  /** Nota per chi sceglie nel pannello. */
  use: string;
}

export const THEMES = {
  brand: {
    id: "hjptfe5eku21fbl",
    label: "Tema TIMEVISION",
    use: "Il tema istituzionale. È il default di ogni generazione.",
  },
  eventi: {
    id: "mq30i7e6r2rxko7",
    label: "Tema per slide eventi",
    use: "Materiale per convegni e giornate formative.",
  },
  nbs: {
    id: "syma2f77m6kw1r2",
    label: "Importato da NBS_Concept_Comunicazione_v16.pptx",
    use: "Impianto ereditato dal concept NBS.",
  },
} as const satisfies Record<string, ThemeChoice>;

export type ThemeKey = keyof typeof THEMES;

/** Il tema di partenza. Ogni generazione ne dichiara uno, sempre. */
export const DEFAULT_THEME: ThemeKey = "brand";

export function themeId(key: ThemeKey = DEFAULT_THEME): string {
  return THEMES[key].id;
}

/* ------------------------------------------------------------------ */
/* Mappatura dei formati                                                */
/* ------------------------------------------------------------------ */

export type GammaFormat = "presentation" | "document" | "webpage" | "social";
export type GammaDimensions =
  | "16x9"
  | "1x1"
  | "4x3"
  | "4x5"
  | "9x16"
  | "a4"
  | "fluid"
  | "letter"
  | "pageless";
export type GammaExport = "pdf" | "pptx" | "png";

export interface FormatMapping {
  format: GammaFormat;
  dimensions: GammaDimensions;
  /** `null` per la pagina web: non c'è file da esportare, c'è un indirizzo. */
  exportAs: GammaExport | null;
  mime: "application/pdf" | "application/vnd.openxmlformats-officedocument.presentationml.presentation" | null;
  /** Quantità di testo per card. */
  amount: "brief" | "medium" | "detailed" | "extensive";
}

export const FORMAT_MAP: Record<DocFormat, FormatMapping> = {
  catalogo: {
    format: "document",
    dimensions: "a4",
    exportAs: "pdf",
    mime: "application/pdf",
    amount: "detailed",
  },
  deck: {
    format: "presentation",
    dimensions: "16x9",
    exportAs: "pptx",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    amount: "brief",
  },
  "one-pager": {
    format: "document",
    dimensions: "a4",
    exportAs: "pdf",
    mime: "application/pdf",
    amount: "medium",
  },
  landing: {
    format: "webpage",
    dimensions: "fluid",
    exportAs: null,
    mime: null,
    amount: "medium",
  },
};

/* ------------------------------------------------------------------ */
/* Limiti di spesa                                                      */
/* ------------------------------------------------------------------ */

/**
 * Ogni generazione consuma crediti del piano Pro. Questi due numeri sono il
 * freno: senza, una richiesta ripetuta per errore brucia il budget del mese
 * in un pomeriggio.
 */
export const LIMITS = {
  /** Generazioni contemporanee. */
  concurrency: 2,
  /** Generazioni avviate in 24 ore. */
  perDay: 20,
} as const;

/** La lingua non è mai negoziabile: il materiale Time Vision è in italiano. */
export const LANGUAGE = "it";
