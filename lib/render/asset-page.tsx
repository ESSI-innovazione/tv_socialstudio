import { AssetCanvas, groundOf } from "@/components/studio/asset-canvas";
import { FORMATS, type FormatId } from "@/lib/brand";
import { DEFAULT_FONT, FONTS, type FontId } from "@/lib/fonts";
import type { ArchetypeId, AssetLayout } from "@/lib/layout-model";
import type { VariantCopy } from "@/lib/types";
import { inlinePhoto } from "@/lib/video/page";
import { fontFamily } from "./fonts";
import { cropMarks, printGeometry, type PrintGeometry, type PrintSetup } from "./print-geometry";

/**
 * L'asset come pagina HTML ferma, per Chromium.
 *
 * E' lo stesso `AssetCanvas` dell'anteprima, del PNG e del video: un solo
 * compositore. Qui serve a due cose che Satori non sa fare — un JPEG, che
 * Instagram pretende, e un PDF vettoriale per la stampa. Font e fotografia
 * viaggiano incorporati: Chromium non deve andare in rete per impaginare.
 *
 * Per la stampa, intorno al foglio al rifilo possono esserci l'abbondanza
 * e i segni di taglio (vedi print-geometry.ts). Il foglio al rifilo resta
 * identico, 1:1: sotto di lui una copia appena ingrandita continua il
 * disegno nell'abbondanza, cosi' una lama imprecisa non scopre il bianco.
 */

export interface AssetPageInput {
  copy: VariantCopy;
  layout: AssetLayout;
  archetype: ArchetypeId;
  photo: string;
  format: FormatId;
}

async function fontFaces(ids: Iterable<FontId | undefined>): Promise<string> {
  const wanted = new Set<FontId>([DEFAULT_FONT]);
  for (const id of ids) if (id) wanted.add(id);
  const faces: string[] = [];
  for (const fontId of wanted) {
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

/** Un foglio: l'asset al rifilo, oppure la pagina di stampa con abbondanza e segni. */
function sheet(input: AssetPageInput, photo: string, baseUrl: string, g: PrintGeometry | null, markup: (node: React.ReactElement) => string): string {
  const canvas = markup(<AssetCanvas copy={input.copy} layout={input.layout} archetype={input.archetype} photo={photo} baseUrl={baseUrl} />);
  if (!g) return canvas;

  const ground = groundOf(input.archetype, input.layout.style).bg;
  const under =
    g.bleed > 0
      ? `<div style="position:absolute;left:${g.offset.x}px;top:${g.offset.y}px;width:${g.trim.w}px;height:${g.trim.h}px;transform:scale(${g.underScale});transform-origin:center center;">${canvas}</div>`
      : "";
  const marks = cropMarks(g)
    .map((s) => {
      const horizontal = s.y1 === s.y2;
      const left = Math.min(s.x1, s.x2);
      const top = Math.min(s.y1, s.y2);
      const w = horizontal ? Math.abs(s.x2 - s.x1) : 0.5;
      const h = horizontal ? 0.5 : Math.abs(s.y2 - s.y1);
      return `<div style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;background:#000;"></div>`;
    })
    .join("");

  return `<div class="sheet" style="position:relative;width:${g.page.w}px;height:${g.page.h}px;overflow:hidden;background:${ground};">${under}<div style="position:absolute;left:${g.offset.x}px;top:${g.offset.y}px;width:${g.trim.w}px;height:${g.trim.h}px;overflow:hidden;">${canvas}</div>${marks}</div>`;
}

function document(body: string, faces: string, page: { w: number; h: number }, multi: boolean): string {
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<style>
${faces}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;width:${page.w}px;${multi ? "" : `height:${page.h}px;overflow:hidden;`}}
body{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;}
img{display:block;}
.sheet{break-after:page;page-break-after:always;}
.sheet:last-child{break-after:auto;page-break-after:auto;}
@page{size:${page.w}px ${page.h}px;margin:0;}
</style></head><body>${body}</body></html>`;
}

/** Un asset solo, al rifilo oppure con la geometria di stampa. */
export async function assetPage(input: AssetPageInput, baseUrl: string, print: PrintSetup | null = null): Promise<string> {
  const { html } = await assetDocument([input], baseUrl, print);
  return html;
}

/**
 * Piu' asset in un documento solo, un foglio per pagina: e' il PDF con
 * tutte le varianti. La misura della pagina e' la stessa per tutti i fogli.
 */
export async function assetDocument(
  inputs: AssetPageInput[],
  baseUrl: string,
  print: PrintSetup | null = null,
): Promise<{ html: string; page: { w: number; h: number } }> {
  if (inputs.length === 0) throw new Error("Nessun asset da impaginare.");
  const size = FORMATS[inputs[0].format];
  const trim = { w: size.width, h: size.height };
  const g = print && (print.bleedMm > 0 || print.marks) ? printGeometry(trim, print) : null;
  const page = g ? g.page : trim;

  // Import dinamico: Next impedisce di importare react-dom/server in cima a un
  // modulo raggiungibile dal bundle client. Qui gira solo dentro la funzione.
  const { renderToStaticMarkup } = await import("react-dom/server");

  const sheets: string[] = [];
  for (const input of inputs) {
    const photo = await inlinePhoto(input.photo, baseUrl);
    sheets.push(sheet(input, photo, baseUrl, g, renderToStaticMarkup));
  }

  const faces = await fontFaces(inputs.map((i) => i.layout.style?.font));
  return { html: document(sheets.join(""), faces, page, inputs.length > 1), page };
}
