import { readJson, requireCan } from "@/lib/admin";
import { getToolVersion, getTools, listToolVersions, publishToolVersion, saveToolDraft } from "@/lib/db";
import { validateTool } from "@/lib/tool-fields";

/**
 * Pubblica una versione: da quel momento e' quella che il team vede.
 *
 * Si pubblica la bozza corrente, oppure una versione vecchia (Ripristina):
 * in quel caso la vecchia viene prima copiata in una bozza nuova, cosi' la
 * storia resta una riga sola e non si riscrive mai una versione passata.
 * Prima di pubblicare, le regole: ogni segnaposto ha una domanda, ogni
 * domanda e' usata, almeno un formato.
 */

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireCan("editTools");
  if ("response" in gate) return gate.response;

  const { id } = await context.params;
  const tool = (await getTools()).find((t) => t.id === id);
  if (!tool) return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  if (tool.automatic) return Response.json({ error: "Gli strumenti automatici non si modificano." }, { status: 409 });

  const payload = await readJson<{ versionId?: unknown }>(request);
  const versions = await listToolVersions(id);
  let target = typeof payload?.versionId === "string" ? await getToolVersion(payload.versionId) : (versions.find((v) => v.published_at === null) ?? null);
  if (!target || target.tool_id !== id) return Response.json({ error: "Non c'e' una bozza da pubblicare." }, { status: 404 });

  // Una versione gia' pubblicata si ripristina: diventa una bozza nuova.
  if (target.published_at) target = await saveToolDraft(id, target.snapshot, gate.user.email);

  const problems = validateTool(target.snapshot);
  if (problems.length > 0) return Response.json({ error: problems[0], problems }, { status: 400 });

  try {
    const published = await publishToolVersion(id, target.id);
    if (!published) return Response.json({ error: "Pubblicazione non riuscita." }, { status: 500 });
    return Response.json({ tool: published, versions: await listToolVersions(id) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
