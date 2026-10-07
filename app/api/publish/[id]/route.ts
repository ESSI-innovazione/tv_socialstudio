import { currentUser } from "@/auth";
import { can } from "@/lib/permissions";
import { deletePost, getPost, markPost } from "@/lib/db";
import { publishNow } from "@/lib/publish";

/**
 * Un post programmato: si sposta (trascinandolo nel calendario), si
 * pubblica subito, si toglie. Un post gia' pubblicato non si tocca piu':
 * e' sul canale, e qui resta come memoria.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  if (!can(user, "publish")) return Response.json({ error: "Pubblicare e programmare e' riservato agli approvatori." }, { status: 403 });

  const { id } = await context.params;
  const post = await getPost(id);
  if (!post) return Response.json({ error: "Post non trovato" }, { status: 404 });
  if (post.status === "published") return Response.json({ error: "Il post e' gia' pubblicato: non si sposta." }, { status: 409 });

  let payload: { scheduledFor?: unknown; publishNow?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  if (payload.publishNow === true) {
    // Un post fallito riparte da zero: altrimenti il conto dei tentativi lo chiuderebbe subito.
    if (post.status === "failed") await markPost(id, { status: "scheduled", attempts: 0, error: null, claimed_at: null });
    const fresh = (await getPost(id)) ?? post;
    const result = await publishNow(fresh);
    if (!result) return Response.json({ error: "Qualcun altro sta pubblicando questo post adesso." }, { status: 409 });
    return Response.json({ post: result });
  }

  if (typeof payload.scheduledFor === "string") {
    const when = new Date(payload.scheduledFor);
    if (Number.isNaN(when.getTime())) return Response.json({ error: "Data non valida." }, { status: 400 });
    await markPost(id, { scheduled_for: when.toISOString(), status: "scheduled", error: null, claimed_at: null, attempts: 0 });
    return Response.json({ post: await getPost(id) });
  }

  return Response.json({ error: "Niente da modificare." }, { status: 400 });
}

export async function DELETE(_request: Request, context: Context) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  if (!can(user, "publish")) return Response.json({ error: "Pubblicare e programmare e' riservato agli approvatori." }, { status: 403 });

  const { id } = await context.params;
  const post = await getPost(id);
  if (!post) return Response.json({ error: "Post non trovato" }, { status: 404 });
  if (post.status === "published") return Response.json({ error: "Il post e' gia' pubblicato: toglilo dal canale, non da qui." }, { status: 409 });

  await deletePost(id);
  return Response.json({ ok: true });
}
