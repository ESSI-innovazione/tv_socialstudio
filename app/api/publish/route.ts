import { currentUser } from "@/auth";
import { getAsset, getRun, listPostsBetween } from "@/lib/db";
import { PublishRefused, channelStatus, schedulePost } from "@/lib/publish";
import type { Channel, Surface } from "@/lib/types";

/**
 * Pubblica subito o programma.
 *
 * POST: un asset approvato e con brand-guard positivo diventa un post su
 * LinkedIn o Instagram, adesso oppure alla data indicata. GET: i post di un
 * intervallo, per il calendario, con lo stato dei canali.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ? new Date(params.get("from")!) : new Date(Date.now() - 31 * 86_400_000);
  const to = params.get("to") ? new Date(params.get("to")!) : new Date(Date.now() + 62 * 86_400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return Response.json({ error: "Intervallo non valido." }, { status: 400 });
  }

  return Response.json({ posts: await listPostsBetween(from, to), channels: channelStatus() });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  // Pubblicare richiede un approvatore: l'approvazione da sola non basta.
  if (user.role !== "approver") return Response.json({ error: "Pubblicare e programmare e' riservato agli approvatori." }, { status: 403 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  if (typeof payload.assetId !== "string") return Response.json({ error: "Serve assetId." }, { status: 400 });
  const channel = payload.channel === "linkedin" || payload.channel === "instagram" ? (payload.channel as Channel) : null;
  if (!channel) return Response.json({ error: "Canale sconosciuto: linkedin o instagram." }, { status: 400 });
  const surface: Surface = channel === "instagram" && payload.surface === "story" ? "story" : "feed";

  const caption = typeof payload.caption === "string" ? payload.caption.trim() : "";
  if (!caption && !(channel === "instagram" && surface === "story")) {
    return Response.json({ error: "Serve la caption." }, { status: 400 });
  }
  const hashtags = Array.isArray(payload.hashtags)
    ? (payload.hashtags as unknown[]).filter((h): h is string => typeof h === "string" && h.trim().length > 0).map((h) => h.trim().replace(/^#/, ""))
    : [];

  let scheduledFor: Date | null = null;
  if (typeof payload.scheduledFor === "string" && payload.scheduledFor) {
    scheduledFor = new Date(payload.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) return Response.json({ error: "Data non valida." }, { status: 400 });
  }

  const asset = await getAsset(payload.assetId);
  if (!asset) return Response.json({ error: "Asset non trovato" }, { status: 404 });
  const run = await getRun(asset.run_id);
  if (!run) return Response.json({ error: "Esecuzione non trovata" }, { status: 404 });

  try {
    const post = await schedulePost({ asset, run, channel, surface, caption, hashtags, scheduledFor, createdBy: user.email });
    return Response.json({ post, channels: channelStatus() }, { status: 201 });
  } catch (error) {
    if (error instanceof PublishRefused) return Response.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
