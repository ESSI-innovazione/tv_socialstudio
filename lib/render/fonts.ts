import { readFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_FONT, FONTS, type FontId } from "../fonts";

/**
 * I caratteri per il rendering server-side.
 *
 * I file stanno nel repo, non su Google Fonts: un export non deve dipendere
 * da una rete di terzi ne' fallire perche' un CDN e' lento. Sono tutti sotto
 * Open Font License, quindi ridistribuirli e' consentito.
 *
 * Satori legge TTF, OTF e WOFF. Non legge WOFF2: scaricare il formato
 * sbagliato e' l'errore che fa fallire il render senza dirti perche'.
 */

export interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 700 | 800;
  style: "normal";
}

const WEIGHTS = [400, 600, 700, 800] as const;

const cache = new Map<FontId, LoadedFont[]>();

/** Una famiglia intera, nei quattro pesi che il compositore usa. */
export async function fontFamily(id: FontId): Promise<LoadedFont[]> {
  const hit = cache.get(id);
  if (hit) return hit;

  const spec = FONTS[id];
  const dir = path.join(process.cwd(), "assets", "fonts");

  const loaded = await Promise.all(
    WEIGHTS.map(async (weight) => {
      const buffer = await readFile(path.join(dir, `${spec.file}-${weight}.ttf`));
      return {
        name: spec.name,
        data: buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer,
        weight,
        style: "normal" as const,
      };
    }),
  );

  cache.set(id, loaded);
  return loaded;
}

/**
 * I font che servono a un asset: quello scelto, piu' Lexend che resta il
 * ripiego per qualunque blocco senza famiglia sua.
 */
export async function fontsFor(id: FontId | undefined): Promise<LoadedFont[]> {
  const chosen = id ?? DEFAULT_FONT;
  if (chosen === DEFAULT_FONT) return fontFamily(DEFAULT_FONT);
  const [base, extra] = await Promise.all([fontFamily(DEFAULT_FONT), fontFamily(chosen)]);
  return [...base, ...extra];
}

/** Lexend da sola: e' quello che il rendering usava prima che esistesse una scelta. */
export function lexend(): Promise<LoadedFont[]> {
  return fontFamily(DEFAULT_FONT);
}
