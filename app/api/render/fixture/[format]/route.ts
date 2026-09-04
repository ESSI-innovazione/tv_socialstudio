import { FORMAT_SIZE, type AssetFormat } from "@/lib/integrations/types";
import { createRenderer, renderPdf } from "@/lib/render";
import { FIXTURE_FACTS, FIXTURE_FACTS_LONG, fixtureSpec } from "@/lib/render/fixture";

/**
 * Banco di prova dei renderer: template di prova, fatti di prova, formato
 * scelto dall'URL. Esiste per verificare che i quattro formati escano alla
 * dimensione esatta e che il testo lungo non sfondi il riquadro.
 *
 * `?long=1` usa il caso peggiore realistico. `?pdf=1` produce il PDF di stampa.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  request: Request,
  context: { params: Promise<{ format: string }> },
) {
  const { format: raw } = await context.params;
  const format = raw.replace(/\.(png|pdf)$/, "") as AssetFormat;

  if (!(format in FORMAT_SIZE)) {
    return new Response(`Formato sconosciuto: ${raw}`, { status: 404 });
  }

  const url = new URL(request.url);
  const facts = url.searchParams.get("long") ? FIXTURE_FACTS_LONG : FIXTURE_FACTS;
  const wantsPdf = url.searchParams.get("pdf") === "1";

  try {
    const spec = fixtureSpec();

    const asset = wantsPdf
      ? await renderPdf(spec, facts, url.origin)
      : await createRenderer(url.origin).render(spec, facts, format);

    return new Response(new Uint8Array(asset.bytes), {
      headers: {
        "Content-Type": asset.mime,
        "Content-Length": String(asset.bytes.byteLength),
        "X-Asset-Width": String(asset.width),
        "X-Asset-Height": String(asset.height),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Rendering fallito: ${message}`, { status: 500 });
  }
}
