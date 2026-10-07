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
 */

export type SnapshotKind = "jpeg" | "pdf";

export interface Snapshot {
  bytes: Uint8Array;
  mime: "image/jpeg" | "application/pdf";
}

export async function snapshotAsset(html: string, format: FormatId, kind: SnapshotKind): Promise<Snapshot> {
  const size = FORMATS[format];
  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });

    // Font e immagini pronti prima dello scatto, o esce un ripiego di sistema.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => undefined)));
    });

    if (kind === "pdf") {
      const pdf = await page.pdf({
        width: `${size.width}px`,
        height: `${size.height}px`,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return { bytes: new Uint8Array(pdf), mime: "application/pdf" };
    }

    const jpeg = await page.screenshot({
      type: "jpeg",
      quality: 92,
      clip: { x: 0, y: 0, width: size.width, height: size.height },
    });
    return { bytes: new Uint8Array(jpeg), mime: "image/jpeg" };
  } finally {
    await browser.close();
  }
}
