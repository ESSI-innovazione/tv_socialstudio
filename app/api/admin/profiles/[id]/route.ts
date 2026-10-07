import { readJson, requireCan } from "@/lib/admin";
import { listProfiles, logProfileEvent, updateProfile } from "@/lib/db";
import { isRole } from "@/lib/permissions";
import type { Profile, Role } from "@/lib/types";

/**
 * Cambio di ruolo, di spunta admin, di nome o di accesso di un collega.
 *
 * Due cose non si possono fare: toccare il proprio ruolo o la propria spunta
 * (ci si chiuderebbe fuori per sbaglio) e lasciare il team senza un admin o
 * senza nessuno che possa approvare. Ogni cambio resta scritto.
 */

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireCan("manageTeam");
  if ("response" in gate) return gate.response;

  const { id } = await context.params;
  const payload = await readJson<{ role?: unknown; name?: unknown; is_admin?: unknown; active?: unknown }>(request);
  if (!payload) return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });

  const patch: { role?: Role; name?: string | null; is_admin?: boolean; active?: boolean } = {};
  if (payload.role !== undefined) {
    if (!isRole(payload.role)) return Response.json({ error: "Ruolo sconosciuto." }, { status: 400 });
    patch.role = payload.role;
  }
  if (payload.name !== undefined) {
    patch.name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;
  }
  if (payload.is_admin !== undefined) patch.is_admin = payload.is_admin === true;
  if (payload.active !== undefined) patch.active = payload.active !== false;
  if (Object.keys(patch).length === 0) return Response.json({ error: "Niente da modificare." }, { status: 400 });

  const profiles = await listProfiles();
  const target = profiles.find((p) => p.id === id);
  if (!target) return Response.json({ error: "Profilo non trovato" }, { status: 404 });

  const self = target.email === gate.user.email;
  if (self && ((patch.role !== undefined && patch.role !== target.role) || patch.is_admin === false || patch.active === false)) {
    return Response.json({ error: "Non puoi cambiare il tuo ruolo o toglierti l'accesso: chiedilo a un altro admin." }, { status: 409 });
  }

  // Com'era il team dopo la modifica? Se resta senza admin, o senza nessuno
  // che approva, la modifica non passa.
  const after: Profile = { ...target, ...patch };
  const others = profiles.filter((p) => p.id !== id && p.active !== false);
  const admins = others.filter((p) => p.is_admin).length + (after.active !== false && after.is_admin ? 1 : 0);
  if (admins === 0) {
    return Response.json({ error: "E' l'ultimo admin: nomina prima qualcun altro." }, { status: 409 });
  }
  const approvers = others.filter((p) => p.role === "approver" || p.is_admin).length + (after.active !== false && (after.role === "approver" || after.is_admin) ? 1 : 0);
  if (approvers === 0) {
    return Response.json({ error: "Resterebbe un team senza nessuno che approva: nomina prima un altro approvatore." }, { status: 409 });
  }

  const profile = await updateProfile(id, patch);
  if (!profile) return Response.json({ error: "Modifica non riuscita." }, { status: 500 });

  const changes: { field: "role" | "is_admin" | "active"; from: string; to: string }[] = [];
  if (patch.role !== undefined && patch.role !== target.role) changes.push({ field: "role", from: target.role, to: patch.role });
  if (patch.is_admin !== undefined && patch.is_admin !== target.is_admin) changes.push({ field: "is_admin", from: String(target.is_admin), to: String(patch.is_admin) });
  if (patch.active !== undefined && patch.active !== target.active) changes.push({ field: "active", from: String(target.active), to: String(patch.active) });
  for (const change of changes) {
    await logProfileEvent({ profile_id: id, email: target.email, changed_by: gate.user.email, field: change.field, from_value: change.from, to_value: change.to });
  }

  return Response.json({ profile });
}
