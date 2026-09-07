import { ImageResponse } from "next/og";
import { FORMATS, type FormatId } from "@/lib/brand";
import { getRun } from "@/lib/db";
import { archetypeFromLabel, decodeLayout, templateLayout, type BlockText } from "@/lib/layout-model";
import { fontsFor } from "@/lib/render/fonts";
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

interface Params {
  runId: string;
  variant: string;
  format: string;
}

function isFormat(value: string): value is FormatId {
  return value in FORMATS;
}

export async function GET(request: Request, context: { params: Promise<Params> }) {
  const { runId, variant, format: rawFormat } = await context.params;

  const format = rawFormat.replace(/\.png$/, "");
  if (!isFormat(format)) {
    return new Response(`Formato sconosciuto: ${format}`, { status: 404 });
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
