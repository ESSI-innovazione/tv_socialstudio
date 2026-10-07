import { readJson, requireCan } from "@/lib/admin";
import { createProfile, getProfileByEmail, listProfiles, logProfileEvent } from "@/lib/db";
import { ALLOWED_EMAIL_DOMAIN, env } from "@/lib/env";
import { sendInvite } from "@/lib/invites";
import { isRole } from "@/lib/permissions";

/**
 * Il team: elenco e invito di un collega. Solo l'indirizzo aziendale
 * entra, e il ruolo di partenza lo decide chi invita. Con un profilo la
 * persona puo' entrare con Google da subito: l'email e' un avviso in piu'.
 */

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireCan("manageTeam");
  if ("response" in gate) return gate.response;
  return Response.json({ profiles: await listProfiles() });
}

export async function POST(request: Request) {
  const gate = await requireCan("manageTeam");
  if ("response" in gate) return gate.response;

  const payload = await readJson<{ email?: unknown; name?: unknown; role?: unknown; isAdmin?: unknown }>(request);
  if (!payload) return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
    return Response.json({ error: "Indirizzo email non valido." }, { status: 400 });
  }
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    return Response.json({ error: `Solo gli indirizzi @${ALLOWED_EMAIL_DOMAIN} possono entrare.` }, { status: 400 });
  }

  const role = isRole(payload.role) ? payload.role : "editor";
  const isAdmin = payload.isAdmin === true;
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;

  if (await getProfileByEmail(email)) {
    return Response.json({ error: "Questo indirizzo e' gia' nel team." }, { status: 409 });
  }

  try {
    const profile = await createProfile({ email, name, role, is_admin: isAdmin, invited_by: gate.user.email });
    await logProfileEvent({
      profile_id: profile.id,
      email: profile.email,
      changed_by: gate.user.email,
      field: "invited",
      from_value: null,
      to_value: `${role}${isAdmin ? "+admin" : ""}`,
    });
    const mailed = await sendInvite(profile, gate.user.name);
    return Response.json({ profile, mailed, url: env.siteUrl }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
