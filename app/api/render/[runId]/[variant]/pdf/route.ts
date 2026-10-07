import { currentUser } from "@/auth";
import { getRun } from "@/lib/db";
import { PdfRefused, pdfResponse, printSetupFrom, runPdf } from "@/lib/render/run-pdf";

/**
 * Il PDF di stampa di una variante: `?bleed=1` aggiunge i 3 mm di
 * abbondanza, `?marks=1` i segni di taglio. Lo stampa Chromium, che puo'
 * fallire: l'errore torna in chiaro, non come un file vuoto.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request, context: { params: Promise<{ runId: string; variant: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const { runId, variant } = await context.params;
  const index = Number.parseInt(variant, 10);
  if (!Number.isInteger(index) || index < 0) return Response.json({ error: "Indice della variante non valido." }, { status: 400 });

  const run = await getRun(runId);
  if (!run) return Response.json({ error: "Esecuzione non trovata." }, { status: 404 });

  const url = new URL(request.url);
  try {
    const { bytes, filename } = await runPdf(run, { ...printSetupFrom(url.searchParams), variants: [index], layoutParam: url.searchParams.get("layout") }, url.origin);
    return pdfResponse(bytes, filename);
  } catch (error) {
    if (error instanceof PdfRefused) return Response.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : String(error);
    console.error("[render] pdf", message);
    return Response.json({ error: `Chromium non e' riuscito a stampare il PDF: ${message}` }, { status: 500 });
  }
}
