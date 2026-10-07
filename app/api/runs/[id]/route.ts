import { currentUser } from "@/auth";
import { getRun, replaceAssets, updateRun } from "@/lib/db";
import type { Asset, Run, RunState } from "@/lib/types";

/**
 * Un'esecuzione: lettura e salvataggio del risultato.
 *
 * La console scrive qui quando il driver ha finito (stato, passi, copy,
 * caption, controllo del brand, asset) e ogni volta che un testo viene
 * ritoccato. Puo' scrivere solo chi l'ha creata; leggere puo' tutto il
 * team, perche' l'archivio e la coda di approvazione riaprono il lavoro
 * degli altri.
 */

export const runtime = "nodejs";

const STATES: RunState[] = ["composing", "running", "results", "failed"];

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await context.params;
  const run = await getRun(id);
  if (!run) return Response.json({ error: "Esecuzione non trovata" }, { status: 404 });

  return Response.json({ run });
}

export async function PATCH(request: Request, context: Context) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await context.params;
  const existing = await getRun(id);
  if (!existing) return Response.json({ error: "Esecuzione non trovata" }, { status: 404 });
  if (existing.created_by !== user.email) {
    return Response.json({ error: "Puoi modificare solo le tue esecuzioni." }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  // Solo i campi che il driver produce. Proprietario, strumento e brief di
  // partenza non si riscrivono: sono la provenienza dell'asset.
  const patch: Partial<Run> = {};
  if (typeof payload.state === "string" && STATES.includes(payload.state as RunState)) {
    patch.state = payload.state as RunState;
  }
  if (Array.isArray(payload.steps)) patch.steps = payload.steps as Run["steps"];
  if (Array.isArray(payload.logs)) patch.logs = payload.logs as Run["logs"];
  if (payload.brief && typeof payload.brief === "object") patch.brief = payload.brief as Run["brief"];
  if (Array.isArray(payload.variants)) patch.variants = payload.variants as Run["variants"];
  if (Array.isArray(payload.captions)) patch.captions = payload.captions as Run["captions"];
  if (Array.isArray(payload.guard)) patch.guard = payload.guard as Run["guard"];
  if (typeof payload.finished_at === "string") patch.finished_at = payload.finished_at;
  if (typeof payload.duration_ms === "number") patch.duration_ms = Math.round(payload.duration_ms);
  if (typeof payload.error === "string" || payload.error === null) patch.error = payload.error as string | null;

  await updateRun(id, patch);

  let assets: Asset[] | undefined;
  if (Array.isArray(payload.assets)) {
    const rows = (payload.assets as Asset[]).filter(
      (a) => a && typeof a === "object" && typeof a.format === "string" && typeof a.variant_index === "number",
    );
    assets = await replaceAssets(id, rows);
  }

  const run = await getRun(id);
  return Response.json({ run: run ? { ...run, assets: assets ?? run.assets } : null });
}
