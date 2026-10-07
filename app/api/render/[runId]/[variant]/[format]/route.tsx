import { ImageResponse } from "next/og";
import { FORMATS, type FormatId } from "@/lib/brand";
import { getRun } from "@/lib/db";
import { archetypeFromLabel, decodeLayout, templateLayout, type BlockText } from "@/lib/layout-model";
import { assetPage } from "@/lib/render/asset-page";
import { fontsFor } from "@/lib/render/fonts";
import { snapshotAsset } from "@/lib/render/snapshot";
import { AssetCanvas } from "@/components/studio/asset-canvas";
import { MOCK_VARIANTS, MOCK_BRIEF } from "@/lib/mock-run";

/**
 * L'asset come PNG, alla dimensione esatta del formato.
 *
 * E' un URL pubblico e stabile, e serve a tre cose diverse: scaricare il
 * pacchetto, mostrare l'anteprima nei metadati Open Graph, e dare a Instagram
 * un'immagine da andarsi a prendere — la sua API non accetta upload, vuole un
 * indirizzo raggiungibile.
 *
 * Disegna lo stesso componente dell'editor. Un solo compositore: quello che
 * sposti e' quello che esce. L'impaginazione modificata arriva nel parametro
 * `layout`, perche' non ha un posto nel database: senza, esce il template.
 */

export const runtime = "nodejs";
// Il JPEG e il PDF passano da Chromium: un minuto basta, i dieci secondi del default no.
export const maxDuration = 120;

interface Params {
  runId: string;
  variant: string;
  format: string;
}

function isFormat(value: string): value is FormatId {
  return value in FORMATS;
}

/**
 * Il tipo di file lo decide l'estensione: `.png` (Satori, il default),
 * `.jpg` (Chromium: Instagram non accetta PNG), `.pdf` (Chromium, solo per
 * il poster: la stampa vuole vettori, non pixel).
 */
type FileKind = "png" | "jpg" | "pdf";

function splitExtension(raw: string): { format: string; kind: FileKind } {
  const match = /\.(png|jpe?g|pdf)$/i.exec(raw);
  if (!match) return { format: raw, kind: "png" };
  const ext = match[1].toLowerCase();
  return { format: raw.slice(0, -match[0].length), kind: ext === "pdf" ? "pdf" : ext.startsWith("jp") ? "jpg" : "png" };
}

export async function GET(request: Request, context: { params: Promise<Params> }) {
  const { runId, variant, format: rawFormat } = await context.params;

  const { format, kind } = splitExtension(rawFormat);
  if (!isFormat(format)) {
    return new Response(`Formato sconosciuto: ${format}`, { status: 404 });
  }
  if (kind === "pdf" && format !== "poster-a4") {
    return new Response("Il PDF esiste solo per il poster A4.", { status: 400 });
  }

  const index = Number.parseInt(variant, 10);
  if (!Number.isInteger(index) || index < 0) {
    return new Response("Indice della variante non valido", { status: 400 });
  }

  const run = await getRun(runId);

  // Senza database la console gira sui dati simulati: il render deve seguirla,
  // altrimenti l'export e' l'unico pezzo che non funziona in demo.
  const copy = run?.variants.find((v) => v.index === index) ?? MOCK_VARIANTS[index];
  const photo = run?.brief?.photo ?? MOCK_BRIEF.photo;

  if (!copy) {
    return new Response("Variante non trovata", { status: 404 });
  }

  const spec = FORMATS[format];
  const archetype = archetypeFromLabel(copy.layout);

  const text: BlockText = {
    eyebrow: copy.eyebrow,
    headline: copy.headline,
    subhead: copy.subhead,
    body: copy.body,
    badge: copy.badge,
    disclaimer: copy.disclaimer,
  };
  // L'origine viene dalla richiesta, non dall'ambiente: cosi' le immagini si
  // caricano anche in locale e sui deployment di anteprima, che hanno un host
  // diverso da quello di produzione.
  const url = new URL(request.url);
  const baseUrl = url.origin;

  const layout = decodeLayout(url.searchParams.get("layout"), format) ?? templateLayout(format, archetype, text);

  if (kind !== "png") {
    try {
      const html = await assetPage({ copy, layout, archetype, photo, format }, baseUrl);
      const snapshot = await snapshotAsset(html, format, kind === "pdf" ? "pdf" : "jpeg");
      const name = `timevision-v${index + 1}-${format}.${kind}`;
      return new Response(new Uint8Array(snapshot.bytes), {
        headers: {
          "Content-Type": snapshot.mime,
          "Content-Length": String(snapshot.bytes.byteLength),
          "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${name}"`,
          "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[render] chromium", message);
      return new Response(`Export ${kind.toUpperCase()} non riuscito: ${message}`, { status: 500 });
    }
  }

  const fonts = await fontsFor(layout.style?.font);

  return new ImageResponse(
    (
      <AssetCanvas
        copy={copy}
        layout={layout}
        archetype={archetype}
        photo={photo}
        baseUrl={baseUrl}
      />
    ),
    {
      width: spec.width,
      height: spec.height,
      fonts,
      headers: {
        // Un asset e' immutabile: cambia il contenuto, cambia l'URL.
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
