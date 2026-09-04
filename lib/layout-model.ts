import { FORMATS, type FormatId } from "./brand";

/**
 * Il layout di un asset come dato, non come codice.
 *
 * Ogni elemento e' un blocco con una posizione. Chi impagina puo' spostarlo e
 * ridimensionarlo, ma dentro i limiti del brand: la griglia decide dove puo'
 * atterrare, il margine di sicurezza decide dove non puo' andare, e la scala
 * tipografica decide quali corpi esistono. Non e' una tela libera.
 *
 * Le coordinate sono normalizzate 0..1 sull'artboard, quindi lo stesso blocco
 * sopravvive al cambio di formato: cambia la griglia, non il contenuto.
 */

export type BlockKind =
  | "logo"
  | "eyebrow"
  | "headline"
  | "subhead"
  | "body"
  | "badge"
  | "cta"
  | "image"
  | "disclaimer";

export const BLOCK_LABELS: Record<BlockKind, string> = {
  logo: "Marchio",
  eyebrow: "Occhiello",
  headline: "Titolo",
  subhead: "Sottotitolo",
  body: "Testo",
  badge: "Banda",
  cta: "Call to action",
  image: "Immagine",
  disclaimer: "Disclaimer",
};

export interface Block {
  id: string;
  kind: BlockKind;
  /** Angolo in alto a sinistra, in frazione di artboard. */
  x: number;
  y: number;
  /** Larghezza in frazione di artboard. */
  w: number;
  /** Altezza, solo per i blocchi immagine. Il testo si dimensiona da solo. */
  h?: number;
  /** Indice nella scala tipografica del formato. Mai pixel arbitrari. */
  step?: number;
  align?: "left" | "center" | "right";
  /** Punto d'interesse dell'immagine, in frazione: decide cosa sopravvive al taglio. */
  focal?: { x: number; y: number };
  visible: boolean;
  /** Un blocco bloccato non si sposta: il marchio, per esempio. */
  locked?: boolean;
}

export interface AssetLayout {
  format: FormatId;
  blocks: Block[];
}

/* ------------------------------------------------------------------ */
/* Vincoli di brand                                                     */
/* ------------------------------------------------------------------ */

/** Dodici colonne orizzontali, ritmo verticale di 8px alla dimensione nativa. */
export const GRID_COLUMNS = 12;
export const VERTICAL_RHYTHM = 8;

/** La scala tipografica per formato. Un blocco puo' solo salire o scendere di un passo. */
const TYPE_LADDER: Record<FormatId, number[]> = {
  "poster-a4": [12, 15, 18, 21, 26, 30, 34, 42, 52, 64, 74, 88],
  linkedin: [11, 13, 15, 17, 21, 25, 30, 38, 46, 54, 62, 72],
  "ig-feed": [17, 20, 24, 28, 34, 40, 48, 58, 70, 86, 100, 116],
  "ig-story": [19, 22, 26, 31, 39, 46, 55, 66, 80, 96, 112, 130],
};

/** Il passo di default per ciascun tipo di blocco. */
const DEFAULT_STEP: Record<BlockKind, number> = {
  logo: 3,
  eyebrow: 1,
  headline: 10,
  subhead: 6,
  body: 4,
  badge: 4,
  cta: 5,
  image: 0,
  disclaimer: 0,
};

/** Il corpo minimo ammesso per tipo: sotto questo, brand-guard blocca. */
const MIN_STEP: Record<BlockKind, number> = {
  logo: 2,
  eyebrow: 0,
  headline: 6,
  subhead: 3,
  body: 2,
  badge: 2,
  cta: 3,
  image: 0,
  disclaimer: 0,
};

export function ladderFor(format: FormatId): number[] {
  return TYPE_LADDER[format];
}

/** Da passo a pixel alla dimensione nativa del formato. */
export function fontSizeOf(format: FormatId, block: Block): number {
  const ladder = TYPE_LADDER[format];
  const step = clamp(block.step ?? DEFAULT_STEP[block.kind], 0, ladder.length - 1);
  return ladder[step];
}

export function minStepOf(kind: BlockKind): number {
  return MIN_STEP[kind];
}

/** Il margine di sicurezza in frazione di artboard. */
export function safeInset(format: FormatId): { x: number; y: number } {
  const spec = FORMATS[format];
  return { x: spec.safeArea / spec.width, y: spec.safeArea / spec.height };
}

/* ------------------------------------------------------------------ */
/* Aggancio alla griglia                                                */
/* ------------------------------------------------------------------ */

/** Aggancia una posizione alla colonna piu' vicina e al ritmo verticale. */
export function snap(format: FormatId, x: number, y: number): { x: number; y: number } {
  const spec = FORMATS[format];
  const inset = safeInset(format);

  const usable = 1 - inset.x * 2;
  const column = usable / GRID_COLUMNS;
  const snappedX = inset.x + Math.round((x - inset.x) / column) * column;

  const rhythm = VERTICAL_RHYTHM / spec.height;
  const snappedY = Math.round(y / rhythm) * rhythm;

  return { x: snappedX, y: snappedY };
}

/**
 * Riporta un blocco dentro i margini. Un blocco che li attraversa non e' un
 * errore da segnalare dopo: e' una posizione che non deve poter esistere.
 */
export function clampBlock(format: FormatId, block: Block): Block {
  const inset = safeInset(format);
  const maxW = 1 - inset.x * 2;

  const w = clamp(block.w, 0.08, maxW);
  const x = clamp(block.x, inset.x, 1 - inset.x - w);

  const h = block.h;
  const maxY = h === undefined ? 1 - inset.y : 1 - inset.y - h;
  const y = clamp(block.y, inset.y, Math.max(inset.y, maxY));

  return { ...block, x, y, w, ...(h === undefined ? {} : { h: clamp(h, 0.05, 1 - inset.y * 2) }) };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/* ------------------------------------------------------------------ */
/* Layout di partenza per archetipo                                     */
/* ------------------------------------------------------------------ */

export type ArchetypeId =
  | "testo-in-alto"
  | "foto-a-tutta-pagina"
  | "dato-dominante"
  | "countdown-in-evidenza";

export const ARCHETYPES: { id: ArchetypeId; label: string }[] = [
  { id: "testo-in-alto", label: "testo in alto" },
  { id: "foto-a-tutta-pagina", label: "foto a tutta pagina" },
  { id: "dato-dominante", label: "dato dominante" },
  { id: "countdown-in-evidenza", label: "countdown in evidenza" },
];

export function archetypeForIndex(index: number): ArchetypeId {
  return ARCHETYPES[index % ARCHETYPES.length].id;
}

export function archetypeLabel(id: ArchetypeId): string {
  return ARCHETYPES.find((a) => a.id === id)?.label ?? id;
}

function block(
  kind: BlockKind,
  x: number,
  y: number,
  w: number,
  extra: Partial<Block> = {},
): Block {
  return {
    id: kind,
    kind,
    x,
    y,
    w,
    step: DEFAULT_STEP[kind],
    align: "left",
    visible: true,
    ...extra,
  };
}

/**
 * Il layout di partenza. E' quello che il template propone: da qui chi
 * impagina si muove, e "Ripristina" ci riporta.
 */
export function defaultLayout(format: FormatId, archetype: ArchetypeId): AssetLayout {
  const inset = safeInset(format);
  const left = inset.x;
  const width = 1 - inset.x * 2;
  const wide = FORMATS[format].width > FORMATS[format].height;

  // Sull'orizzontale il testo occupa la meta' sinistra, la foto entra da destra.
  const textWidth = wide ? width * 0.52 : width;

  const logo = block("logo", left, inset.y, 0.28, { locked: true });

  if (archetype === "foto-a-tutta-pagina") {
    return {
      format,
      blocks: [
        block("image", 0, 0, 1, { h: 1, focal: { x: 0.5, y: 0.42 }, step: 0 }),
        logo,
        block("headline", left, 0.56, textWidth, { step: 9 }),
        block("badge", left, 0.76, textWidth * 0.7, {}),
        block("cta", left, 0.86, textWidth, { step: 4 }),
      ],
    };
  }

  if (archetype === "dato-dominante") {
    return {
      format,
      blocks: [
        logo,
        block("headline", left, 0.3, textWidth, { step: 11 }),
        block("subhead", left, 0.5, textWidth, { step: 7 }),
        block("body", left, 0.6, textWidth * 0.9, {}),
        block("badge", left, 0.74, textWidth * 0.7, {}),
        block("cta", left, 0.84, textWidth, { step: 4 }),
        block("disclaimer", left, 0.93, width, {}),
      ],
    };
  }

  if (archetype === "countdown-in-evidenza") {
    return {
      format,
      blocks: [
        logo,
        block("headline", left, 0.26, textWidth, { step: 9 }),
        block("body", left, 0.48, textWidth * 0.85, { step: 5 }),
        block("badge", left, 0.66, textWidth * 0.7, {}),
        block("cta", left, 0.78, textWidth, { step: 4 }),
        block("disclaimer", left, 0.92, width, {}),
      ],
    };
  }

  // testo-in-alto: l'impianto di riferimento.
  return {
    format,
    blocks: [
      logo,
      block("headline", left, 0.16, textWidth, {}),
      block("subhead", left, 0.34, textWidth, {}),
      block("body", left, 0.43, textWidth * 0.88, {}),
      block("badge", left, 0.54, textWidth * 0.72, {}),
      block(
        "image",
        wide ? 0.54 : left,
        wide ? 0 : 0.62,
        wide ? 0.46 : width,
        wide ? { h: 1, focal: { x: 0.5, y: 0.5 }, step: 0 } : { h: 0.2, focal: { x: 0.5, y: 0.5 }, step: 0 },
      ),
      block("cta", left, 0.85, textWidth, {}),
      block("disclaimer", left, 0.93, width, {}),
    ],
  };
}

/** Applica una modifica a un blocco, mantenendo i vincoli. */
export function updateBlock(
  layout: AssetLayout,
  id: string,
  patch: Partial<Block>,
): AssetLayout {
  return {
    ...layout,
    blocks: layout.blocks.map((b) =>
      b.id === id ? clampBlock(layout.format, { ...b, ...patch }) : b,
    ),
  };
}

/** Vero quando il layout e' stato toccato rispetto al template. */
export function isModified(layout: AssetLayout, archetype: ArchetypeId): boolean {
  const base = defaultLayout(layout.format, archetype);
  return JSON.stringify(base.blocks) !== JSON.stringify(layout.blocks);
}

/**
 * Dal nome libero che scrive l'agente all'archetipo noto. L'agente descrive
 * l'impianto a parole; qui si aggancia a uno dei quattro che sappiamo disegnare.
 */
export function archetypeFromLabel(label: string | null | undefined): ArchetypeId {
  if (!label) return "testo-in-alto";
  const normalised = label.toLowerCase().trim();

  const exact = ARCHETYPES.find((a) => a.label === normalised || a.id === normalised);
  if (exact) return exact.id;

  if (normalised.includes("foto")) return "foto-a-tutta-pagina";
  if (normalised.includes("countdown") || normalised.includes("scadenza")) {
    return "countdown-in-evidenza";
  }
  if (normalised.includes("dato") || normalised.includes("numero") || normalised.includes("cifra")) {
    return "dato-dominante";
  }
  return "testo-in-alto";
}
