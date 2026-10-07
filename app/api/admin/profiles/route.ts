import { readJson, requireCan } from "@/lib/admin";
import { createProfile, getProfileByEmail, listProfiles } from "@/lib/db";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/env";
import type { Role } from "@/lib/types";

const requireApprover = () => requireCan("manageTeam");

/**
 * Il team: elenco e aggiunta di un collega. Solo l'indirizzo aziendale
 * entra, e il ruolo di partenza lo decide chi invita.
 */

export const runtime = "nodejs";

const ROLES: Role[] = ["editor", "approver"];

export async function GET() {
  const gate = await requireApprover();
  if ("response" in gate) return gate.response;
  return Response.json({ profiles: await listProfiles() });
}

export async function POST(request: Request) {
  const gate = await requireApprover();
  if ("response" in gate) return gate.response;

  const payload = await readJson<{ email?: unknown; name?: unknown; role?: unknown }>(request);
  if (!payload) return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
    return Response.json({ error: "Indirizzo email non valido." }, { status: 400 });
  }
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    return Response.json({ error: `Solo gli indirizzi @${ALLOWED_EMAIL_DOMAIN} possono entrare.` }, { status: 400 });
  }

  const role = ROLES.includes(payload.role as Role) ? (payload.role as Role) : "editor";
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;

  if (await getProfileByEmail(email)) {
    return Response.json({ error: "Questo indirizzo e' gia' nel team." }, { status: 409 });
  }

  try {
    const profile = await createProfile({ email, name, role });
    return Response.json({ profile }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
