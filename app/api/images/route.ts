import { currentUser } from "@/auth";
import { imageSource, recentGenerated, IMAGE_LIMIT_PER_DAY } from "@/lib/integrations/images";
import { GammaError, GammaNotConfiguredError } from "@/lib/integrations/gamma-errors";
import { countImagesLastDay } from "@/lib/db-images";
import { env } from "@/lib/env";
import type { ImagePurpose, ImageRequest } from "@/lib/integrations/types";

/**
 * I visual disponibili, e la creazione di uno nuovo.
 *
 * GET restituisce l'archivio aziendale piu' i generati di recente, cosi' un
 * visual gia' pagato si riusa invece di rifarlo.
 * POST ne genera uno: consuma crediti, e lo dice.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const STYLES = ["abstract", "illustration", "photo", "scene"];
const PURPOSES = ["poster-a4", "linkedin", "ig-feed", "ig-story", "catalogo"];

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const [generated, today] = await Promise.all([recentGenerated(12), countImagesLastDay()]);

  return Response.json({
    archive: imageSource.archive(),
    generated,
    canGenerate: Boolean(env.gammaApiKey),
    remainingToday: Math.max(0, IMAGE_LIMIT_PER_DAY - today),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  let payload: Partial<ImageRequest>;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const prompt = payload.prompt?.trim();
  if (!prompt || prompt.length < 8) {
    return Response.json(
      { error: "Descrivi il visual in almeno qualche parola: il modello non indovina." },
      { status: 400 },
    );
  }

  const purpose = (PURPOSES.includes(payload.purpose ?? "") ? payload.purpose : "ig-feed") as ImagePurpose;
  const style = (STYLES.includes(payload.style ?? "") ? payload.style : "abstract") as ImageRequest["style"];

  try {
    const image = await imageSource.generate({ prompt, purpose, style });
    return Response.json({ image }, { status: 201 });
  } catch (error) {
    if (error instanceof GammaNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 501 });
    }
    if (error instanceof GammaError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
