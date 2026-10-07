import { readJson, requireApprover } from "@/lib/admin";
import { FORMATS, type FormatId } from "@/lib/brand";
import { getTools, updateTool } from "@/lib/db";

/**
 * Modifica di uno strumento salvato: titolo, descrizione, istruzione e
 * formati di partenza. E' il modo in cui il marketing cambia un prompt
 * senza un deploy; gli strumenti automatici non si toccano.
 */

export const runtime = "nodejs";

function isFormat(value: unknown): value is FormatId {
  return typeof value === "string" && value in FORMATS;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApprover();
  if ("response" in gate) return gate.response;

  const { id } = await context.params;
  const tools = await getTools();
  const tool = tools.find((t) => t.id === id);
  if (!tool) return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  if (tool.automatic) return Response.json({ error: "Gli strumenti automatici non si modificano da qui." }, { status: 409 });

  const payload = await readJson<{ title?: unknown; description?: unknown; prompt_template?: unknown; default_formats?: unknown }>(request);
  if (!payload) return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });

  const patch: Parameters<typeof updateTool>[1] = {};
  if (payload.title !== undefined) {
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    if (!title) return Response.json({ error: "Il titolo non puo' essere vuoto." }, { status: 400 });
    patch.title = title;
  }
  if (payload.description !== undefined) {
    const description = typeof payload.description === "string" ? payload.description.trim() : "";
    if (!description) return Response.json({ error: "La descrizione non puo' essere vuota." }, { status: 400 });
    patch.description = description;
  }
  if (payload.prompt_template !== undefined) {
    const prompt = typeof payload.prompt_template === "string" ? payload.prompt_template.trim() : "";
    if (prompt.length < 20) return Response.json({ error: "L'istruzione e' troppo corta per essere utile." }, { status: 400 });
    patch.prompt_template = prompt;
  }
  if (payload.default_formats !== undefined) {
    if (!Array.isArray(payload.default_formats) || !payload.default_formats.every(isFormat)) {
      return Response.json({ error: "Formati sconosciuti." }, { status: 400 });
    }
    patch.default_formats = [...new Set(payload.default_formats as FormatId[])];
  }
  if (Object.keys(patch).length === 0) return Response.json({ error: "Niente da modificare." }, { status: 400 });

  const updated = await updateTool(id, patch);
  if (!updated) return Response.json({ error: "Modifica non riuscita." }, { status: 500 });
  return Response.json({ tool: updated });
}
