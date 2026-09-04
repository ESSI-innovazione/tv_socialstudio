/**
 * Riesporta il contratto condiviso e aggiunge le sole costanti che servono
 * al lettore Figma. Il contratto in `types.ts` resta intatto: e' lo stesso
 * file che importa anche il modulo dei documenti multipagina.
 */

export type {
  AssetFormat,
  AssetRenderer,
  CampaignFacts,
  RenderedAsset,
  TemplateSource,
  TemplateSpec,
  TextSlot,
} from "./types";

export { FORMAT_SIZE } from "./types";

/**
 * I ruoli ammessi per un livello di testo. E' l'elenco che compare
 * nell'errore quando qualcuno battezza un livello a modo suo, quindi vive
 * qui una volta sola.
 */
export const FIGMA_ROLES = [
  "headline",
  "subhead",
  "body",
  "cta",
  "eyebrow",
  "deadline",
  "disclaimer",
] as const;
