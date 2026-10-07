/**
 * La geometria della stampa: abbondanza, segni di taglio, misura della pagina.
 *
 * L'asset e' impaginato al suo formato di rifilo (794x1123 px, cioe' A4 a 96
 * dpi). Per la tipografia si aggiunge l'abbondanza — 3 mm di disegno oltre
 * il taglio, perche' la lama non e' mai precisa — e, se si vuole, i segni
 * di taglio in una fascia esterna. L'area di sicurezza non si sposta: il
 * foglio al rifilo resta identico, cambia solo cio' che gli sta intorno.
 *
 * Tutto in px CSS a 96 dpi: Chromium stampa 96 px per pollice, quindi 794 px
 * sono 210 mm esatti.
 */

export const MM_TO_PX = 96 / 25.4;

/** La fascia per i segni di taglio, fuori dall'abbondanza. */
export const SLUG_MM = 5;

/** Quanto i segni stanno lontani dall'abbondanza, per non finire nel disegno. */
export const MARK_GAP_MM = 1;

export interface PrintSetup {
  /** Millimetri di abbondanza. Zero: niente abbondanza. */
  bleedMm: number;
  marks: boolean;
}

export interface Size {
  w: number;
  h: number;
}

export interface PrintGeometry {
  trim: Size;
  /** Abbondanza in px. */
  bleed: number;
  /** Fascia esterna in px: c'e' solo con i segni di taglio. */
  slug: number;
  /** La pagina intera: rifilo piu' abbondanza piu' fascia, da ogni lato. */
  page: Size;
  /** Dove sta l'angolo in alto a sinistra del rifilo nella pagina. */
  offset: { x: number; y: number };
  /**
   * Di quanto ingrandire una copia dell'asset messa sotto, perche' il
   * disegno continui nell'abbondanza. La copia al rifilo sta sopra, 1:1.
   */
  underScale: number;
  marks: boolean;
}

export function mmToPx(mm: number): number {
  return Math.round(mm * MM_TO_PX * 100) / 100;
}

export function printGeometry(trim: Size, setup: PrintSetup): PrintGeometry {
  const bleed = Math.max(0, mmToPx(setup.bleedMm));
  const slug = setup.marks ? mmToPx(SLUG_MM) : 0;
  const offset = bleed + slug;
  // Il fattore che copre l'abbondanza su tutti e quattro i lati: si prende
  // il piu' grande fra larghezza e altezza, cosi' nessun bordo resta vuoto.
  const underScale = bleed > 0 ? Math.max((trim.w + 2 * bleed) / trim.w, (trim.h + 2 * bleed) / trim.h) : 1;
  return {
    trim,
    bleed,
    slug,
    page: { w: trim.w + 2 * offset, h: trim.h + 2 * offset },
    offset: { x: offset, y: offset },
    underScale,
    marks: setup.marks,
  };
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Otto segmenti, due per angolo, sulla linea di rifilo: partono oltre
 * l'abbondanza e finiscono al bordo della fascia. Senza fascia, niente segni.
 */
export function cropMarks(g: PrintGeometry): Segment[] {
  if (!g.marks || g.slug <= 0) return [];
  const gap = Math.min(mmToPx(MARK_GAP_MM), g.slug / 2);
  const start = g.bleed + gap;
  const end = g.bleed + g.slug;
  const left = g.offset.x;
  const top = g.offset.y;
  const right = g.offset.x + g.trim.w;
  const bottom = g.offset.y + g.trim.h;

  return [
    // in alto a sinistra
    { x1: left - end, y1: top, x2: left - start, y2: top },
    { x1: left, y1: top - end, x2: left, y2: top - start },
    // in alto a destra
    { x1: right + start, y1: top, x2: right + end, y2: top },
    { x1: right, y1: top - end, x2: right, y2: top - start },
    // in basso a sinistra
    { x1: left - end, y1: bottom, x2: left - start, y2: bottom },
    { x1: left, y1: bottom + start, x2: left, y2: bottom + end },
    // in basso a destra
    { x1: right + start, y1: bottom, x2: right + end, y2: bottom },
    { x1: right, y1: bottom + start, x2: right, y2: bottom + end },
  ];
}

/** Il nome del file: campagna, strumento, variante. Senza accenti ne' spazi. */
export function pdfFileName(campaign: string, tool: string, variant: number | "tutte"): string {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "asset";
  return `${slug(campaign)}-${slug(tool)}-${variant === "tutte" ? "tutte-le-varianti" : `v${variant}`}.pdf`;
}
