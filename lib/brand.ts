/**
 * Brand kit Time Vision — fonte di verita' unica per UI e rendering.
 * Se un valore non e' qui, non puo' finire su un asset.
 */

export const BRAND = {
  wine: "#720026",
  rose: "#ce4257",
  coral: "#ff7f51",
  apricot: "#ff9b54",

  ink: "#2a1119",
  inkSoft: "#5c4850",
  inkFaint: "#7e6a73",

  line: "#ecdfe2",
  lineSoft: "#f6eff1",
  canvas: "#fbf7f5",
  paper: "#ffffff",
  wineTint: "#fbeef0",
  wineEdge: "#f4dee2",
  warmTint: "#fff2ea",
  warmEdge: "#ffd9c4",

  success: "#1f5436",
  successBg: "#e8f1ec",
  warning: "#a8481a",
  warningBg: "#fff2ea",

  mute: "#e0d2d6",
  onWine: "#e8c4cb",
  onWineFaint: "#d8a3ae",
} as const;

/** La palette che brand-guard considera ammessa su un asset. */
export const ALLOWED_ASSET_COLORS: string[] = [
  BRAND.wine,
  BRAND.rose,
  BRAND.coral,
  BRAND.apricot,
  BRAND.ink,
  BRAND.paper,
  BRAND.canvas,
  BRAND.wineTint,
  BRAND.onWine,
  BRAND.onWineFaint,
];

export const FONT_FAMILY = "'Lexend', 'Segoe UI', system-ui, sans-serif";
export const FONT_STACK_MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

/** Marchio Time Vision, monocromatico, mai ruotato o deformato. */
export const LOGO_PATH =
  "M52.44,1.18a52.44,52.44,0,1,0,52.44,52.44A52.44,52.44,0,0,0,52.44,1.18m6.07,92.48v-34h14V47.55H46.37V93.66a40.49,40.49,0,1,1,12.14,0";
export const LOGO_VIEWBOX = "0 0 105 108";

/* ------------------------------------------------------------------ */
/* Formati di output                                                    */
/* ------------------------------------------------------------------ */

export type FormatId = "poster-a4" | "linkedin" | "ig-feed" | "ig-story";

export interface FormatSpec {
  id: FormatId;
  label: string;
  /** Dimensioni di authoring in px (96 dpi per l'A4). */
  width: number;
  height: number;
  /** Nota di export mostrata in UI. */
  exportNote: string;
  /** Margine di sicurezza in px alla dimensione di authoring. */
  safeArea: number;
  channel: "print" | "linkedin" | "instagram";
}

export const FORMATS: Record<FormatId, FormatSpec> = {
  "poster-a4": {
    id: "poster-a4",
    label: "Poster A4",
    width: 794,
    height: 1123,
    exportNote: "210 × 297 mm · 300 dpi",
    safeArea: 64,
    channel: "print",
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    width: 1200,
    height: 627,
    exportNote: "1200 × 627",
    safeArea: 54,
    channel: "linkedin",
  },
  "ig-feed": {
    id: "ig-feed",
    label: "IG feed",
    width: 1080,
    height: 1080,
    exportNote: "1080 × 1080",
    safeArea: 96,
    channel: "instagram",
  },
  "ig-story": {
    id: "ig-story",
    label: "IG story",
    width: 1080,
    height: 1920,
    exportNote: "1080 × 1920",
    safeArea: 96,
    channel: "instagram",
  },
};

export const FORMAT_ORDER: FormatId[] = ["poster-a4", "linkedin", "ig-feed", "ig-story"];

/** Fattore di scala per portare l'A4 da 96 dpi a 300 dpi in export. */
export const A4_PRINT_SCALE = 300 / 96;

/* ------------------------------------------------------------------ */
/* Regole brand attive — mostrate in console e imposte al modello       */
/* ------------------------------------------------------------------ */

export const BRAND_RULES: string[] = [
  "palette istituzionale bloccata",
  "Lexend 700 / 400 · logo in alto a sinistra",
  "nessun claim senza fonte normativa",
  "disclaimer bando obbligatorio in calce",
];

/** Fotografie di archivio disponibili al compositore. */
export const PHOTOS = [
  { file: "tv-aula.jpg", subject: "Aula, formazione in presenza", use: "Corsi, academy, master" },
  { file: "tv-consulenza.jpg", subject: "Consulenza uno-a-uno", use: "Servizi alle imprese" },
  { file: "tv-digitale.jpg", subject: "Digitale, tecnologia", use: "Voucher digitali, cybersecurity, cloud" },
  { file: "tv-fondi.jpg", subject: "Finanza, fondi", use: "Bandi, contributi, agevolazioni" },
  { file: "tv-master.jpg", subject: "Master, alta formazione", use: "Percorsi lunghi, specializzazioni" },
  { file: "tv-network.jpg", subject: "Rete, community", use: "Eventi, community, partnership" },
  { file: "tv-team.jpg", subject: "Team, persone", use: "Employer branding, chi siamo" },
] as const;

export type PhotoFile = (typeof PHOTOS)[number]["file"];

/** Segnaposto per un dato non confermato. Mai un numero plausibile al suo posto. */
export const UNVERIFIED = "[DA VERIFICARE]";
