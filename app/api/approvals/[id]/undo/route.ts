import { currentUser } from "@/auth";
import { ApprovalError, undoDecision } from "@/lib/approvals";
import { can } from "@/lib/permissions";

/**
 * Il ripensamento di chi ha appena approvato: la richiesta torna in attesa
 * e gli asset non sono piu' approvati. Vale solo per chi ha deciso, e solo
 * nella mezz'ora successiva.
 */

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  if (!can(user, "approve")) return Response.json({ error: "Solo un approvatore puo' annullare." }, { status: 403 });

  const { id } = await context.params;
  try {
    return Response.json(await undoDecision(id, user));
  } catch (error) {
    if (error instanceof ApprovalError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
