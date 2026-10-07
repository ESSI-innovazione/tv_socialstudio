import { AssetCanvas } from "@/components/studio/asset-canvas";
import { FORMATS, type FormatId } from "@/lib/brand";
import { DEFAULT_FONT, FONTS, type FontId } from "@/lib/fonts";
import type { ArchetypeId, AssetLayout } from "@/lib/layout-model";
import type { VariantCopy } from "@/lib/types";
import { inlinePhoto } from "@/lib/video/page";
import { fontFamily } from "./fonts";

/**
 * L'asset come pagina HTML ferma, per Chromium.
 *
 * E' lo stesso `AssetCanvas` dell'anteprima, del PNG e del video: un solo
 * compositore. Qui serve a due cose che Satori non sa fare — un JPEG, che
 * Instagram pretende, e un PDF vettoriale per la stampa. Font e fotografia
 * viaggiano incorporati: Chromium non deve andare in rete per impaginare.
 */

export interface AssetPageInput {
  copy: VariantCopy;
  layout: AssetLayout;
  archetype: ArchetypeId;
  photo: string;
  format: FormatId;
}

async function fontFaces(id: FontId | undefined): Promise<string> {
  const ids = new Set<FontId>([DEFAULT_FONT, id ?? DEFAULT_FONT]);
  const faces: string[] = [];
  for (const fontId of ids) {
    const spec = FONTS[fontId];
    for (const font of await fontFamily(fontId)) {
      const data = Buffer.from(font.data).toString("base64");
      faces.push(
        `@font-face{font-family:'${spec.name}';font-style:normal;font-weight:${font.weight};src:url(data:font/ttf;base64,${data}) format('truetype');}`,
      );
    }
  }
  return faces.join("");
}

export async function assetPage(input: AssetPageInput, baseUrl: string): Promise<string> {
  const size = FORMATS[input.format];
  // Import dinamico: Next impedisce di importare react-dom/server in cima a un
  // modulo raggiungibile dal bundle client. Qui gira solo dentro la funzione.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const photo = await inlinePhoto(input.photo, baseUrl);
  const body = renderToStaticMarkup(
    <AssetCanvas copy={input.copy} layout={input.layout} archetype={input.archetype} photo={photo} baseUrl={baseUrl} />,
  );

  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<style>
${await fontFaces(input.layout.style?.font)}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;width:${size.width}px;height:${size.height}px;overflow:hidden;}
body{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;}
img{display:block;}
@page{size:${size.width}px ${size.height}px;margin:0;}
</style></head><body>${body}</body></html>`;
}
