import { currentUser } from "@/auth";
import {
  imageSource,
  recentGenerated,
  regenerate,
  pickEngine,
  gammaAvailable,
  IMAGE_LIMIT_PER_DAY,
} from "@/lib/integrations/images";
import { DEFAULT_STYLE, isStyle } from "@/lib/integrations/visual-styles";
import { VisualError } from "@/lib/integrations/visual-errors";
import { translationConfigured } from "@/lib/integrations/translate";
import { countImagesLastDay } from "@/lib/db-images";
import type { ImagePurpose, ImageRequest } from "@/lib/integrations/types";

/**
 * I visual disponibili, e la creazione di uno nuovo.
 *
 * GET restituisce l'archivio aziendale piu' i generati di recente, cosi' un
 * visual gia' fatto si riusa invece di rifarlo.
 * POST ne genera uno. Con `from` genera invece una variante di uno esistente:
 * stesso prompt e stesso stile, seme nuovo.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const PURPOSES = ["poster-a4", "linkedin", "ig-feed", "ig-story", "catalogo"];

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const [generated, today] = await Promise.all([recentGenerated(12), countImagesLastDay()]);

  return Response.json({
    archive: imageSource.archive(),
    generated,
    remainingToday: Math.max(0, IMAGE_LIMIT_PER_DAY - today),
    engine: pickEngine(),
    gammaAvailable: gammaAvailable(),
    // Riguarda solo Pollinations: senza traduzione il prompt italiano parte
    // com'e' e quel modello perde il soggetto. Gamma l'italiano lo capisce.
    translates: translationConfigured(),
  });
}

interface Payload extends Partial<ImageRequest> {
  /** Il visual di cui fare una variante. */
  from?: { prompt?: string; style?: string; engine?: string };
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const purpose = (PURPOSES.includes(payload.purpose ?? "") ? payload.purpose : "ig-feed") as ImagePurpose;
  const engine = payload.engine === "gamma" || payload.engine === "flux" ? payload.engine : undefined;

  try {
    // Variante di un visual esistente: il prompt non lo si riscrive, si eredita.
    if (payload.from?.prompt) {
      const image = await regenerate(
        {
          prompt: payload.from.prompt,
          style: isStyle(payload.from.style) ? payload.from.style : DEFAULT_STYLE,
          engine:
            payload.from.engine === "gamma" || payload.from.engine === "flux"
              ? payload.from.engine
              : engine,
        },
        purpose,
      );
      return Response.json({ image }, { status: 201 });
    }

    const prompt = payload.prompt?.trim();
    if (!prompt || prompt.length < 8) {
      return Response.json(
        { error: "Descrivi il visual in almeno qualche parola: il modello non indovina." },
        { status: 400 },
      );
    }

    const image = await imageSource.generate({
      prompt,
      purpose,
      style: isStyle(payload.style) ? payload.style : DEFAULT_STYLE,
      engine,
      seed: typeof payload.seed === "number" ? payload.seed : undefined,
    });
    return Response.json({ image }, { status: 201 });
  } catch (error) {
    if (error instanceof VisualError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
