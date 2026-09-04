import { openJobs } from "@/lib/db-documents";
import { advance } from "@/lib/integrations/gamma";
import { env } from "@/lib/env";

/**
 * Svuota la coda delle generazioni aperte.
 *
 * E' il pezzo che rende il lavoro durevole: chi chiude la scheda non perde
 * niente, perche' il drain riprende dalla riga e continua a interrogare Gamma
 * fino a quando il file e' archiviato.
 *
 * Non interroga a raffica: un passo per lavoro a ogni passata.
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

  const jobs = await openJobs(10);
  const results: { id: string; status: string; error?: string }[] = [];

  for (const job of jobs) {
    try {
      const advanced = await advance(job.id);
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
