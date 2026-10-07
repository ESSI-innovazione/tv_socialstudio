import { currentUser } from "@/auth";
import { ApprovalError, decide } from "@/lib/approvals";

/**
 * La decisione di un approvatore: approva, oppure rimanda indietro con un
 * commento. Il ruolo si verifica qui, sul server, con la sessione: il
 * pulsante nella pagina non basta.
 */

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  if (user.role !== "approver") return Response.json({ error: "Solo un approvatore puo' decidere." }, { status: 403 });

  const { id } = await context.params;

  let payload: { decision?: unknown; comment?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const decision = payload.decision === "approved" || payload.decision === "rejected" ? payload.decision : null;
  if (!decision) return Response.json({ error: "La decisione deve essere approved o rejected." }, { status: 400 });

  try {
    const result = await decide(id, decision, user, typeof payload.comment === "string" ? payload.comment : null);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ApprovalError) return Response.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
