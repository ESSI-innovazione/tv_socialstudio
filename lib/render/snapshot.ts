import { FORMATS, type FormatId } from "@/lib/brand";
import { launchChromium } from "./chromium";

/**
 * Chromium fotografa o stampa la pagina dell'asset.
 *
 * `jpeg` e' per Instagram, che non accetta PNG. `pdf` e' per la stampa: la
 * pagina e' impaginata ai pixel di authoring (794x1123 per l'A4, cioe' 96
 * dpi) e il PDF esce alla stessa misura fisica — 210x297 mm — con testo e
 * vettori veri, quindi senza una risoluzione da dichiarare: la fotografia
 * e' l'unico elemento raster, e viaggia alla sua risoluzione nativa.
 *
 * Con abbondanza e segni di taglio la pagina e' piu' grande del formato:
 * chi la chiede passa la misura calcolata da print-geometry.ts.
 */

export type SnapshotKind = "jpeg" | "pdf";

export interface Snapshot {
  bytes: Uint8Array;
  mime: "image/jpeg" | "application/pdf";
}

export async function snapshotAsset(html: string, format: FormatId, kind: SnapshotKind, page?: { w: number; h: number }): Promise<Snapshot> {
  const spec = FORMATS[format];
  const size = page ?? { w: spec.width, h: spec.height };
  const browser = await launchChromium();
  try {
    const tab = await browser.newPage();
    await tab.setViewport({ width: Math.ceil(size.w), height: Math.ceil(size.h), deviceScaleFactor: 1 });
    await tab.setContent(html, { waitUntil: "load" });

    // Font e immagini pronti prima dello scatto, o esce un ripiego di sistema.
    await tab.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => undefined)));
    });

    if (kind === "pdf") {
      const pdf = await tab.pdf({
        width: `${size.w}px`,
        height: `${size.h}px`,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return { bytes: new Uint8Array(pdf), mime: "application/pdf" };
    }

    const jpeg = await tab.screenshot({
      type: "jpeg",
      quality: 92,
      clip: { x: 0, y: 0, width: size.w, height: size.h },
    });
    return { bytes: new Uint8Array(jpeg), mime: "image/jpeg" };
  } finally {
    await browser.close();
  }
}
