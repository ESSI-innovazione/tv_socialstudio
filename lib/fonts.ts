/**
 * I caratteri che un asset puo' usare.
 *
 * Lexend e' quello del Brand Kit e resta il default. Gli altri tre esistono
 * perche' una campagna puo' volere una voce diversa — un serif per un
 * catalogo, un geometrico per un annuncio — senza uscire da un elenco che
 * sappiamo rendere uguale nel browser e nell'export.
 *
 * Ogni famiglia sta in due posti, e devono coincidere: `assets/fonts` per il
 * rendering server-side, che legge i TTF dal disco, e `next/font/google`
 * in `app/layout.tsx` per il browser, che espone la variabile CSS. Un font
 * aggiunto in un posto solo si vede in anteprima e sparisce nel PNG, o viceversa.
 */

export type FontId = "lexend" | "inter" | "montserrat" | "playfair";

export interface FontSpec {
  id: FontId;
  label: string;
  /** Il nome con cui il rendering server-side registra il file. */
  name: string;
  /** Il prefisso dei file in `assets/fonts`: `${file}-${peso}.ttf`. */
  file: string;
  /** La variabile CSS dichiarata in `app/layout.tsx`. */
  cssVar: string;
  /** Il ripiego, per quando il file non e' ancora arrivato. */
  fallback: string;
  note: string;
}

export const FONTS: Record<FontId, FontSpec> = {
  lexend: {
    id: "lexend",
    label: "Lexend",
    name: "Lexend",
    file: "Lexend",
    cssVar: "--font-lexend",
    fallback: "'Segoe UI', system-ui, sans-serif",
    note: "Brand Kit",
  },
  inter: {
    id: "inter",
    label: "Inter",
    name: "Inter",
    file: "Inter",
    cssVar: "--font-inter",
    fallback: "'Segoe UI', system-ui, sans-serif",
    note: "neutro",
  },
  montserrat: {
    id: "montserrat",
    label: "Montserrat",
    name: "Montserrat",
    file: "Montserrat",
    cssVar: "--font-montserrat",
    fallback: "'Segoe UI', system-ui, sans-serif",
    note: "geometrico",
  },
  playfair: {
    id: "playfair",
    label: "Playfair",
    name: "Playfair Display",
    file: "PlayfairDisplay",
    cssVar: "--font-playfair",
    fallback: "Georgia, 'Times New Roman', serif",
    note: "serif",
  },
};

export const DEFAULT_FONT: FontId = "lexend";

export const FONT_IDS = Object.keys(FONTS) as FontId[];

export function isFontId(value: unknown): value is FontId {
  return typeof value === "string" && value in FONTS;
}

/**
 * La famiglia da scrivere nel CSS.
 *
 * Nel browser il nome vero non basta: `next/font` registra il file sotto un
 * nome generato e lo espone solo tramite la variabile. Sul server invece
 * Satori conosce il font per il nome con cui glielo abbiamo dato.
 */
export function fontFamilyFor(id: FontId | undefined, target: "browser" | "server"): string {
  const font = FONTS[id ?? DEFAULT_FONT];
  return target === "server"
    ? `'${font.name}', ${font.fallback}`
    : `var(${font.cssVar}), '${font.name}', ${font.fallback}`;
}
