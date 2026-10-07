import { currentUser } from "@/auth";
import { FORMATS, type FormatId } from "@/lib/brand";
import { checkAsset } from "@/lib/brand-guard";
import { getRun, updateAsset } from "@/lib/db";
import { archetypeFromLabel, decodeLayout, templateLayout, type AssetLayout, type BlockText } from "@/lib/layout-model";
import type { Asset } from "@/lib/types";

/**
 * Il brand-guard su una variante, formato per formato.
 *
 * La console manda le impaginazioni cosi' come sono nell'editor; qui ogni
 * asset della variante viene controllato contro le regole del Brand Kit e
 * l'esito viene scritto sull'asset insieme all'impaginazione controllata.
 * Da quel momento e' quella che viene resa e pubblicata: non si approva
 * una cosa e se ne pubblica un'altra.
 */

export const runtime = "nodejs";

function isFormat(value: string): value is FormatId {
  return value in FORMATS;
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  let payload: { runId?: unknown; variantIndex?: unknown; layouts?: unknown };
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

  const copy = run.variants.find((v) => v.index === variantIndex);
  if (!copy) return Response.json({ error: "Variante non trovata" }, { status: 404 });

  const assets = run.assets.filter((a) => a.variant_index === variantIndex);
  if (assets.length === 0) {
    return Response.json({ error: "Nessun asset da controllare: l'esecuzione non e' ancora salvata." }, { status: 409 });
  }

  // Le impaginazioni arrivano dal client, quindi passano dalla stessa
  // validazione dell'indirizzo del PNG: un blocco fuori margine non entra.
  const given = payload.layouts && typeof payload.layouts === "object" ? (payload.layouts as Record<string, unknown>) : {};
  const archetype = archetypeFromLabel(copy.layout);
  const text: BlockText = {
    eyebrow: copy.eyebrow,
    headline: copy.headline,
    subhead: copy.subhead,
    body: copy.body,
    badge: copy.badge,
    disclaimer: copy.disclaimer,
  };

  const checked: Asset[] = [];
  for (const asset of assets) {
    if (!isFormat(asset.format)) continue;
    const raw = given[asset.format];
    const layout: AssetLayout =
      (raw && typeof raw === "object" ? decodeLayout(JSON.stringify(raw), asset.format) : null) ??
      templateLayout(asset.format, archetype, text);

    const result = checkAsset({
      copy,
      layout,
      archetype,
      format: asset.format,
      brief: run.brief,
      attachments: run.attachments,
    });

    const saved = await updateAsset(asset.id, {
      layout,
      guard: result.checks,
      guard_status: result.status,
      guard_checked_at: new Date().toISOString(),
    });
    checked.push(saved ?? { ...asset, layout, guard: result.checks, guard_status: result.status });
  }

  const failed = checked.filter((a) => a.guard_status === "fail").length;
  return Response.json({
    assets: checked,
    status: failed > 0 ? "fail" : checked.some((a) => a.guard_status === "warn") ? "warn" : "pass",
    checkedBy: user.email,
  });
}
