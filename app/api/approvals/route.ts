import { currentUser } from "@/auth";
import { ApprovalError, decide, requestApproval } from "@/lib/approvals";
import { getApprovals, getRun } from "@/lib/db";
import { can } from "@/lib/permissions";

/**
 * Le richieste di approvazione.
 *
 * POST: un editor chiede l'approvazione di una variante che ha passato il
 * brand-guard. Un approvatore puo' chiedere e approvare in un colpo solo
 * (`autoApprove`): e' lo stesso flusso, con la decisione gia' presa.
 * GET: le richieste di un'esecuzione, per la colonna di destra.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const runId = new URL(request.url).searchParams.get("runId");
  if (!runId) return Response.json({ error: "Serve runId." }, { status: 400 });

  return Response.json({ approvals: await getApprovals(runId) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  let payload: { runId?: unknown; variantIndex?: unknown; note?: unknown; autoApprove?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  if (typeof payload.runId !== "string") return Response.json({ error: "Serve runId." }, { status: 400 });
  const variantIndex = typeof payload.variantIndex === "number" ? payload.variantIndex : Number.NaN;
  if (!Number.isInteger(variantIndex) || variantIndex < 0) {
    return Response.json({ error: "Indice della variante non valido." }, { status: 400 });
  }

  const run = await getRun(payload.runId);
  if (!run) return Response.json({ error: "Esecuzione non trovata" }, { status: 404 });

  try {
    const note = typeof payload.note === "string" ? payload.note : null;
    const requested = await requestApproval(run, variantIndex, user, note);

    if (payload.autoApprove === true) {
      // Il ruolo lo controlla `decide`: un editor che lo chiede riceve un 403
      // e la richiesta resta in attesa, come se non l'avesse chiesto.
      if (!can(user, "approve")) {
        return Response.json({ error: "Solo un approvatore puo' approvare subito.", approval: requested.approval }, { status: 403 });
      }
      const decided = await decide(requested.approval.id, "approved", user, note);
      return Response.json({ approval: decided.approval, assets: decided.assets, mailed: decided.mailed }, { status: 201 });
    }

    return Response.json({ approval: requested.approval, mailed: requested.mailed }, { status: 201 });
  } catch (error) {
    if (error instanceof ApprovalError) return Response.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
