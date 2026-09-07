import { openJobs } from "@/lib/db-videos";
import { env } from "@/lib/env";
import { advance } from "@/lib/video/jobs";
import { renderVideo } from "@/lib/video/render";

/**
 * Riprende i video rimasti a meta'.
 *
 * Un rendering parte con la richiesta che l'ha creato; se quella funzione
 * muore, la riga resta `rendering` e nessuno la guarda piu' se la scheda e'
 * chiusa. Il cron passa ogni cinque minuti e riprende solo i lavori
 * stantii: uno in corso non viene toccato.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = env.cronSecret;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Non autorizzato" }, { status: 401 });
    }
  }

  const origin = new URL(request.url).origin;
  const jobs = await openJobs(10);
  const results: { id: string; status: string; error?: string }[] = [];

  for (const job of jobs) {
    try {
      const advanced = await advance(job.id, renderVideo, origin);
      results.push({ id: job.id, status: advanced?.status ?? job.status });
    } catch (error) {
      results.push({
        id: job.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return Response.json({ drained: results.length, results });
}
