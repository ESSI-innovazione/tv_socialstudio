import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  FORMAT_SIZE,
  type AssetFormat,
  type CampaignFacts,
  type RenderedAsset,
  type TemplateSpec,
} from "@/lib/integrations/types";
import { launchChromium } from "./chromium";
import { Composition } from "./composition";

/**
 * Il poster A4, via Chromium headless.
 *
 * Satori basta per i social, non per la stampa: qui servono CSS completo e un
 * PDF vero. La durata delle funzioni su Pro lo rende praticabile, ma va tenuto
 * sul runtime Node — su Edge non c'e' nessun binario da avviare.
 *
 * L'impaginazione e' la stessa dei social: si serializza lo stesso componente
 * in HTML e lo si apre in una pagina della dimensione esatta.
 */

/** 794x1123 sono i px di authoring a 96 dpi. Per la stampa servono 300. */
export const PRINT_SCALE = 300 / 96;

async function fontFace(): Promise<string> {
  const dir = path.join(process.cwd(), "assets", "fonts");
  const weights = [400, 600, 700, 800] as const;

  const faces = await Promise.all(
    weights.map(async (weight) => {
      const buffer = await readFile(path.join(dir, `Lexend-${weight}.ttf`));
      return `@font-face{font-family:'Lexend';font-style:normal;font-weight:${weight};src:url(data:font/ttf;base64,${buffer.toString("base64")}) format('truetype');}`;
    }),
  );

  return faces.join("");
}

/**
 * L'HTML completo della pagina. Il font viaggia incorporato: Chromium non
 * deve andare in rete per impaginare, altrimenti un export puo' uscire con il
 * font sbagliato a seconda di com'e' andata la richiesta.
 */
export async function printablePage(
  spec: TemplateSpec,
  facts: CampaignFacts,
  format: AssetFormat,
  baseUrl: string,
): Promise<string> {
  const size = FORMAT_SIZE[format];

  // Import dinamico: Next impedisce di importare react-dom/server in cima a un
  // modulo raggiungibile dal bundle client. Qui gira solo dentro la funzione.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const body = renderToStaticMarkup(
    <Composition spec={spec} facts={facts} format={format} baseUrl={baseUrl} />,
  );

  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<style>
${await fontFace()}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;width:${size.w}px;height:${size.h}px;}
body{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;}
img{display:block;}
</style></head><body>${body}</body></html>`;
}

export async function renderForPrint(
  spec: TemplateSpec,
  facts: CampaignFacts,
  format: AssetFormat,
  baseUrl: string,
  as: "png" | "pdf" = "png",
): Promise<RenderedAsset> {
  const size = FORMAT_SIZE[format];
  const html = await printablePage(spec, facts, format, baseUrl);

  const browser = await launchChromium();
  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: size.w,
      height: size.h,
      // Il fattore di scala e' cio' che porta l'A4 da 96 a 300 dpi.
      deviceScaleFactor: as === "png" ? PRINT_SCALE : 1,
    });

    await page.setContent(html, { waitUntil: "load" });

    // Il font e le immagini devono essere pronti prima dello scatto,
    // altrimenti l'export esce con un ripiego di sistema.
    await page.evaluate(() => document.fonts.ready);

    if (as === "pdf") {
      const pdf = await page.pdf({
        width: `${size.w}px`,
        height: `${size.h}px`,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      return {
        format,
        bytes: Buffer.from(pdf),
        mime: "application/pdf",
        width: size.w,
        height: size.h,
      };
    }

    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, ...size2(size) } });

    return {
      format,
      bytes: Buffer.from(png),
      mime: "image/png",
      width: Math.round(size.w * PRINT_SCALE),
      height: Math.round(size.h * PRINT_SCALE),
    };
  } finally {
    await browser.close();
  }
}

function size2(size: { w: number; h: number }) {
  return { width: size.w, height: size.h };
}
