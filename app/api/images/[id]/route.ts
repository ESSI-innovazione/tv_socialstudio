import { currentUser } from "@/auth";
import { saveGenerated } from "@/lib/integrations/images";

/**
 * Tenere, o lasciar andare, un visual generato.
 *
 * Generare non e' archiviare: il visual appena fatto vive nella sessione di
 * chi l'ha chiesto. PATCH con `{ saved: true }` lo mette nell'archivio che
 * vedono tutti; con `false` lo toglie. Il file resta dov'e' in entrambi i
 * casi, perche' una campagna potrebbe gia' usarlo.
 */

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await context.params;

  let payload: { saved?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }
  if (typeof payload.saved !== "boolean") {
    return Response.json({ error: "Serve `saved`: vero per tenere il visual, falso per toglierlo." }, { status: 400 });
  }

  const found = await saveGenerated(id, payload.saved);
  if (!found) return Response.json({ error: "Visual non trovato" }, { status: 404 });

  return Response.json({ id, saved: payload.saved });
}
