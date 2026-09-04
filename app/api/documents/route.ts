import { currentUser } from "@/auth";
import { startDocument } from "@/lib/integrations/gamma";
import { GammaError } from "@/lib/integrations/gamma-errors";
import { THEMES, type ThemeKey } from "@/lib/integrations/gamma-config";
import type { DocFormat, DocumentRequest } from "@/lib/integrations/types";

/**
 * Avvia una generazione multipagina e torna subito.
 *
 * Non aspetta: la generazione dura minuti e vive sulla sua riga. Chi ha
 * chiamato riceve un identificativo e interroga /api/documents/{id}.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const FORMATS: DocFormat[] = ["catalogo", "deck", "one-pager", "landing"];

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  let payload: Partial<DocumentRequest> & { theme?: ThemeKey; runId?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const format = payload.format;
  if (!format || !FORMATS.includes(format)) {
    return Response.json(
      { error: `Formato mancante o sconosciuto. Ammessi: ${FORMATS.join(", ")}.` },
      { status: 400 },
    );
  }

  const inputText = payload.inputText?.trim();
  if (!inputText) {
    return Response.json(
      { error: "Serve il testo sorgente: brief e contenuto degli allegati, per intero." },
      { status: 400 },
    );
  }

  const theme = payload.theme && payload.theme in THEMES ? payload.theme : "brand";

  try {
    const job = await startDocument(
      {
        format,
        title: payload.title?.trim() || "Documento senza titolo",
        inputText,
        audience: payload.audience,
        tone: payload.tone,
        numCards: payload.numCards,
        imageKeys: payload.imageKeys ?? [],
      },
      { theme, runId: payload.runId ?? null, createdBy: user.email },
    );

    return Response.json(
      { id: job.id, status: job.status, format: job.format, title: job.title },
      { status: 202 },
    );
  } catch (error) {
    // Un rifiuto per crediti o per freno di spesa non e' un guasto: si dice
    // cosa è successo, non si riprova contro il muro.
    if (error instanceof GammaError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
