import { requireCan } from "@/lib/admin";
import { getProfileById, updateProfile } from "@/lib/db";
import { env } from "@/lib/env";
import { sendInvite } from "../../route";

/**
 * Rimanda l'invito a chi non e' ancora entrato. Il profilo c'e' gia': si
 * rinnova solo la data dell'invito e si riprova la posta.
 */

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireCan("manageTeam");
  if ("response" in gate) return gate.response;

  const { id } = await context.params;
  const profile = await getProfileById(id);
  if (!profile) return Response.json({ error: "Profilo non trovato" }, { status: 404 });
  if (profile.last_seen_at) return Response.json({ error: "Questa persona e' gia' entrata: non serve un invito." }, { status: 409 });

  await updateProfile(id, { invited_at: new Date().toISOString() });
  const mailed = await sendInvite(profile, gate.user.name);
  return Response.json({ mailed, url: env.siteUrl });
}
