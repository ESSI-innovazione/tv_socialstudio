import { readJson, requireCan } from "@/lib/admin";
import { getToolVersion, getTools, listToolVersions, saveToolDraft } from "@/lib/db";

/**
 * Ripristina una versione vecchia come bozza. Non pubblica: chi ripristina
 * rilegge, magari ritocca, e poi pubblica con il pulsante di sempre.
 */

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireCan("editTools");
  if ("response" in gate) return gate.response;

  const { id } = await context.params;
  const tool = (await getTools()).find((t) => t.id === id);
  if (!tool) return Response.json({ error: "Strumento non trovato" }, { status: 404 });

  const payload = await readJson<{ versionId?: unknown }>(request);
  const source = typeof payload?.versionId === "string" ? await getToolVersion(payload.versionId) : null;
  if (!source || source.tool_id !== id) return Response.json({ error: "Versione non trovata" }, { status: 404 });

  try {
    const draft = await saveToolDraft(id, source.snapshot, gate.user.email);
    return Response.json({ version: draft, versions: await listToolVersions(id) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
