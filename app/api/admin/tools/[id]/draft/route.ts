import { readJson, requireCan } from "@/lib/admin";
import { getTools, saveToolDraft } from "@/lib/db";
import { parseSnapshot } from "@/lib/tool-snapshot";
import { validateTool } from "@/lib/tool-fields";

/**
 * La bozza di uno strumento, salvata a ogni modifica. Una bozza puo' essere
 * incompleta: la validazione si fa alla pubblicazione, qui si torna solo
 * l'elenco dei problemi, cosi' l'editor li mostra man mano.
 */

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireCan("editTools");
  if ("response" in gate) return gate.response;

  const { id } = await context.params;
  const tool = (await getTools()).find((t) => t.id === id);
  if (!tool) return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  if (tool.automatic) return Response.json({ error: "Gli strumenti automatici non si modificano." }, { status: 409 });

  const payload = await readJson<{ snapshot?: unknown }>(request);
  const snapshot = parseSnapshot(payload?.snapshot);
  if (!snapshot) return Response.json({ error: "Bozza non valida." }, { status: 400 });

  try {
    const version = await saveToolDraft(id, snapshot, gate.user.email);
    return Response.json({ version, problems: validateTool(snapshot) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
