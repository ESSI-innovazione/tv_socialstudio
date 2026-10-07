import { readJson, requireCan } from "@/lib/admin";
import { listTemplateSyncs } from "@/lib/db";
import { FigmaError } from "@/lib/integrations/figma-errors";
import { applyLibrary, diffLibrary } from "@/lib/integrations/template-sync";

/**
 * La sincronizzazione dei template, in due passi e solo per chi puo'.
 *
 * POST ?dry=1 legge la libreria e torna il confronto con la cache, senza
 * scrivere. POST con `accept` scrive solo i template accettati e lascia
 * una riga nello storico. GET: lo storico. Un errore di Figma non e' un
 * guasto del server: torna 409 con il messaggio che dice quale template
 * e perche', e rimanda a TEMPLATES.md.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const gate = await requireCan("syncTemplates");
  if ("response" in gate) return gate.response;
  return Response.json({ history: await listTemplateSyncs() });
}

export async function POST(request: Request) {
  const gate = await requireCan("syncTemplates");
  if ("response" in gate) return gate.response;

  const dry = new URL(request.url).searchParams.get("dry") === "1";

  try {
    if (dry) return Response.json(await diffLibrary());

    const payload = await readJson<{ accept?: unknown }>(request);
    const accept = Array.isArray(payload?.accept) ? (payload!.accept as unknown[]).filter((id): id is string => typeof id === "string") : [];
    const result = await applyLibrary(accept, gate.user.email);
    return Response.json({ ...result, history: await listTemplateSyncs() });
  } catch (error) {
    if (error instanceof FigmaError) return Response.json({ error: `${error.message} Vedi TEMPLATES.md.` }, { status: 409 });
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
