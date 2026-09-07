import { readFile } from "node:fs/promises";
import path from "node:path";
import { AssetCanvas } from "@/components/studio/asset-canvas";
import type { VideoRequest } from "@/lib/db-videos";
import { DEFAULT_FONT, FONTS, type FontId } from "@/lib/fonts";
import type { AssetLayout } from "@/lib/layout-model";
import { fontFamily } from "@/lib/render/fonts";
import { objectStore } from "@/lib/storage";
import type { VideoSize } from "./spec";
import type { Timeline } from "./timeline";

/**
 * La pagina che Chromium fotografa.
 *
 * E' lo stesso `AssetCanvas` dell'editor e del PNG, serializzato in HTML e
 * vestito con il CSS del reveal. Ogni blocco porta un `data-block-id`: il
 * foglio di stile gli assegna l'animazione che la timeline ha deciso.
 *
 * I font viaggiano incorporati in base64, come per il poster: Chromium non
 * deve andare in rete per impaginare.
 */

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

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function dataUri(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

/**
 * La foto incorporata nella pagina, come i font.
 *
 * Il primo video in produzione e' uscito senza fotografia: Chromium, dentro
 * la funzione, doveva scaricarla dal dominio dell'app, e quel dominio non
 * e' sempre raggiungibile da li' (alias protetti, anteprime, rete). Il
 * PNG non ha il problema perche' Satori la scarica dal processo Node. Qui
 * la si legge da dove sta davvero — l'archivio in `public/brand` o lo
 * store dei visual generati — e la si passa come data URI. Se non si
 * trova, si torna all'indirizzo: meglio un tentativo che un buco certo.
 */
export async function inlinePhoto(photo: string, baseUrl: string): Promise<string> {
  if (photo.startsWith("data:")) return photo;

  try {
    const generated = /^\/api\/documents\/file\/(.+)$/.exec(photo);
    if (generated) {
      const file = await objectStore().get(decodeURIComponent(generated[1]));
      if (file) return dataUri(file.data, file.contentType || "image/jpeg");
    } else if (photo.startsWith("http")) {
      const response = await fetch(photo, { cache: "no-store" });
      if (response.ok) {
        const mime = response.headers.get("content-type") ?? "image/jpeg";
        return dataUri(new Uint8Array(await response.arrayBuffer()), mime.split(";")[0]);
      }
    } else {
      // "tv-team.jpg" oppure "/brand/tv-team.jpg": stesso file dell'archivio.
      const name = path.basename(photo);
      const bytes = await readFile(path.join(process.cwd(), "public", "brand", name));
      return dataUri(bytes, MIME[path.extname(name).toLowerCase()] ?? "image/jpeg");
    }
  } catch (error) {
    console.warn("[video] foto non incorporata, si prova l'indirizzo:", photo, error instanceof Error ? error.message : error);
  }

  if (photo.startsWith("http")) return photo;
  if (photo.startsWith("/")) return `${baseUrl}${photo}`;
  return `${baseUrl}/brand/${photo}`;
}

function attr(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

/**
 * Il reveal in CSS. `both` come fill-mode: prima del ritardo il blocco e'
 * gia' nel suo stato iniziale (invisibile), dopo la fine resta in quello
 * finale. Senza, un testo lampeggerebbe visibile per un fotogramma.
 */
export function revealCss(timeline: Timeline): string {
  const rules = timeline.motions.map((m) => {
    const sel = `[data-block-id="${attr(m.id)}"]`;
    switch (m.effect) {
      case "drift":
        return `${sel} img{animation:tv-drift ${m.durationMs}ms linear ${m.delayMs}ms both;transform-origin:50% 50%;}`;
      case "fade":
        return `${sel}{animation:tv-fade ${m.durationMs}ms ease-out ${m.delayMs}ms both;}`;
      case "rise":
        return `${sel}{animation:tv-rise ${m.durationMs}ms cubic-bezier(0.2,0.8,0.2,1) ${m.delayMs}ms both;}`;
    }
  });

  return (
    "@keyframes tv-drift{from{transform:scale(1.06)}to{transform:scale(1)}}" +
    "@keyframes tv-fade{from{opacity:0}to{opacity:1}}" +
    "@keyframes tv-rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}" +
    rules.join("")
  );
}

export async function videoPage(
  request: VideoRequest,
  layout: AssetLayout,
  timeline: Timeline,
  size: VideoSize,
  baseUrl: string,
): Promise<string> {
  // Import dinamico: Next impedisce di importare react-dom/server in cima a un
  // modulo raggiungibile dal bundle client. Qui gira solo dentro la funzione.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const photo = await inlinePhoto(request.photo, baseUrl);
  const body = renderToStaticMarkup(
    <AssetCanvas
      copy={request.copy}
      layout={layout}
      archetype={request.archetype}
      photo={photo}
      baseUrl={baseUrl}
    />,
  );

  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<style>
${await fontFaces(layout.style?.font)}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;width:${size.captureWidth}px;height:${size.captureHeight}px;overflow:hidden;background:#000;}
body{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;}
img{display:block;}
${revealCss(timeline)}
</style></head><body>${body}</body></html>`;
}
