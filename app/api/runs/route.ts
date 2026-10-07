import { currentUser } from "@/auth";
import { FORMATS, type FormatId } from "@/lib/brand";
import { bumpToolRunCount, createRun } from "@/lib/db";
import type { Attachment } from "@/lib/types";

/**
 * Registra un'esecuzione nuova e torna il suo id.
 *
 * L'esecuzione la guida ancora il driver simulato nella console, ma la riga
 * nasce qui, dal server, con l'utente della sessione: cosi' ogni lavoro ha
 * un proprietario che il client non puo' scegliere, e un id che il database
 * accetta.
 */

export const runtime = "nodejs";

function isFormat(value: unknown): value is FormatId {
  return typeof value === "string" && value in FORMATS;
}

function isAttachment(value: unknown): value is Attachment {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  return (
    (a.kind === "document" || a.kind === "link" || a.kind === "photo") &&
    typeof a.label === "string"
  );
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const instruction = typeof payload.instruction === "string" ? payload.instruction.trim() : "";
  if (!instruction) return Response.json({ error: "Serve il brief." }, { status: 400 });

  const formats = Array.isArray(payload.formats) ? payload.formats.filter(isFormat) : [];
  if (formats.length === 0) return Response.json({ error: "Serve almeno un formato." }, { status: 400 });

  const attachments = Array.isArray(payload.attachments) ? payload.attachments.filter(isAttachment) : [];
  const variantCount =
    typeof payload.variantCount === "number" && Number.isInteger(payload.variantCount)
      ? Math.min(4, Math.max(1, payload.variantCount))
      : 3;
  const toolSlug = typeof payload.toolSlug === "string" && payload.toolSlug ? payload.toolSlug : "libero";

  const run = await createRun({
    campaign_id: typeof payload.campaignId === "string" ? payload.campaignId : null,
    tool_slug: toolSlug,
    instruction,
    attachments,
    formats,
    variant_count: variantCount,
    template_id: typeof payload.templateId === "string" ? payload.templateId : null,
    created_by: user.email,
  });

  if (toolSlug !== "libero") await bumpToolRunCount(toolSlug);

  return Response.json({ run }, { status: 201 });
}
