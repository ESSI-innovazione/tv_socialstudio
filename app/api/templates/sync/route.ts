import { requireApprover } from "@/lib/admin";
import { getTemplates } from "@/lib/db";
import { figmaTemplates } from "@/lib/integrations/figma";
import { FigmaError } from "@/lib/integrations/figma-errors";

/**
 * La sincronizzazione dei template da Figma, a mano e solo per gli
 * approvatori: Figma limita le richieste e la libreria si rilegge quando
 * qualcuno lo chiede. Legge le pagine «TPL/…» secondo TEMPLATES.md e
 * riscrive la tabella templates. Un errore di Figma non e' un guasto del
 * server: torna 409 con il messaggio che dice quale template e perche'.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const gate = await requireApprover();
  if ("response" in gate) return gate.response;
  return Response.json({ last: await lastSync() });
}

export async function POST() {
  const gate = await requireApprover();
  if ("response" in gate) return gate.response;

  try {
    const result = await figmaTemplates.sync();
    return Response.json({ ...result, by: gate.user.email, last: await lastSync() });
  } catch (error) {
    if (error instanceof FigmaError) return Response.json({ error: error.message }, { status: 409 });
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

/** Quando la libreria e' stata letta l'ultima volta, e quanti template ci sono. */
export async function lastSync(): Promise<{ at: string | null; templates: number }> {
  const templates = await getTemplates();
  const at = templates.map((t) => t.synced_at).filter((s): s is string => Boolean(s)).sort().at(-1) ?? null;
  return { at, templates: templates.length };
}
