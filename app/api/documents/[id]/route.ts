import { getJob } from "@/lib/db-documents";
import { advance, toGeneratedDocument } from "@/lib/integrations/gamma";

/**
 * Stato di una generazione. Ogni chiamata la fa avanzare di un passo, quindi
 * la console puo' interrogarla mentre l'utente guarda senza che serva un
 * processo separato.
 *
 * Non avvia mai una seconda generazione: l'identificativo e' gia' sulla riga.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let job = await getJob(id);
  if (!job) return Response.json({ error: "Generazione sconosciuta" }, { status: 404 });

  try {
    job = (await advance(id)) ?? job;
  } catch (error) {
    // L'errore e' gia' registrato sulla riga: qui si risponde con lo stato.
    job = (await getJob(id)) ?? job;
    return Response.json(
      {
        id: job.id,
        status: job.status,
        error: job.error ?? (error instanceof Error ? error.message : String(error)),
      },
      { status: 200 },
    );
  }

  return Response.json({
    id: job.id,
    status: job.status,
    title: job.title,
    format: job.format,
    attempts: job.attempts,
    creditsUsed: job.credits_used,
    error: job.error,
    document: toGeneratedDocument(job),
  });
}
