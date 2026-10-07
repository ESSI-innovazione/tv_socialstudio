import { getDuePosts } from "@/lib/db";
import { env } from "@/lib/env";
import { publishNow } from "@/lib/publish";

/**
 * Il cron della pubblicazione: ogni cinque minuti prende i post maturi e li
 * pubblica. Ogni post viene prima preso in carico, cosi' due esecuzioni che
 * si sovrappongono non pubblicano due volte. Un canale non collegato lascia
 * il post in coda: si pubblichera' quando le chiavi ci saranno.
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

  const now = new Date();
  const due = await getDuePosts(now);
  const results: { id: string; status: string; error?: string | null }[] = [];

  for (const post of due) {
    try {
      const result = await publishNow(post, now);
      if (result) results.push({ id: post.id, status: result.status, error: result.error });
    } catch (error) {
      results.push({ id: post.id, status: "failed", error: error instanceof Error ? error.message : String(error) });
    }
  }

  return Response.json({ due: due.length, drained: results.length, results });
}
