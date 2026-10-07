import { currentUser } from "@/auth";
import { getRun } from "@/lib/db";
import { PdfRefused, pdfResponse, printSetupFrom, runPdf } from "@/lib/render/run-pdf";

/** Tutte le varianti del poster in un PDF solo, una per pagina. Stesse opzioni del singolo. */

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const { runId } = await context.params;
  const run = await getRun(runId);
  if (!run) return Response.json({ error: "Esecuzione non trovata." }, { status: 404 });

  const url = new URL(request.url);
  try {
    const variants = run.variants.map((v) => v.index).sort((a, b) => a - b);
    const { bytes, filename } = await runPdf(run, { ...printSetupFrom(url.searchParams), variants, layoutParam: null }, url.origin);
    return pdfResponse(bytes, filename);
  } catch (error) {
    if (error instanceof PdfRefused) return Response.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : String(error);
    console.error("[render] pdf", message);
    return Response.json({ error: `Chromium non e' riuscito a stampare il PDF: ${message}` }, { status: 500 });
  }
}
