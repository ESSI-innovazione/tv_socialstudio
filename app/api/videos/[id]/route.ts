import { currentUser } from "@/auth";
import { getJob } from "@/lib/db-videos";
import { advance, toVideoView } from "@/lib/video/jobs";
import { renderVideo } from "@/lib/video/render";

/**
 * Stato di un video.
 *
 * Di norma legge e basta: il rendering e' partito con la richiesta che ha
 * creato la riga. Se pero' quel rendering e' stato interrotto — la funzione
 * e' morta, il lavoro e' rimasto `rendering` per piu' di quanto una funzione
 * possa vivere — lo riprende da qui, cosi' chi guarda non aspetta il cron.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await context.params;
  const existing = await getJob(id);
  if (!existing) return Response.json({ error: "Video sconosciuto" }, { status: 404 });

  const origin = new URL(request.url).origin;
  const job = (await advance(id, renderVideo, origin)) ?? existing;

  return Response.json({ video: toVideoView(job) });
}
