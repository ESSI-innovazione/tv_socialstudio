import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Lexend per il rendering server-side.
 *
 * I file stanno nel repo, non su Google Fonts: un export non deve dipendere
 * da una rete di terzi ne' fallire perche' un CDN e' lento. Lexend e' sotto
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

let cache: LoadedFont[] | null = null;

export async function lexend(): Promise<LoadedFont[]> {
  if (cache) return cache;

  const dir = path.join(process.cwd(), "assets", "fonts");

  const loaded = await Promise.all(
    WEIGHTS.map(async (weight) => {
      const buffer = await readFile(path.join(dir, `Lexend-${weight}.ttf`));
      return {
        name: "Lexend",
        data: buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer,
        weight,
        style: "normal" as const,
      };
    }),
  );

  cache = loaded;
  return loaded;
}
