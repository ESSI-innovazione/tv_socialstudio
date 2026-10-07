import { currentUser } from "@/auth";
import { duplicateRun, getRun } from "@/lib/db";

/**
 * «Parti da questo»: copia un'esecuzione dell'archivio in una nuova, di chi
 * la chiede. Il copy e l'impaginazione si ereditano; il brand-guard e
 * l'approvazione si rifanno, perche' la copia puo' cambiare.
 */

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await context.params;
  const source = await getRun(id);
  if (!source) return Response.json({ error: "Esecuzione non trovata" }, { status: 404 });
  if (source.variants.length === 0) {
    return Response.json({ error: "Questa esecuzione non ha un risultato da duplicare." }, { status: 409 });
  }

  const run = await duplicateRun(source, user.email);
  return Response.json({ run }, { status: 201 });
}
