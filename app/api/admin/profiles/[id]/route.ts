import { readJson, requireApprover } from "@/lib/admin";
import { listProfiles, updateProfile } from "@/lib/db";
import type { Role } from "@/lib/types";

/**
 * Cambio di ruolo o di nome di un collega. L'ultimo approvatore non puo'
 * retrocedersi: resterebbe un team senza nessuno che approva.
 */

export const runtime = "nodejs";

const ROLES: Role[] = ["editor", "approver"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApprover();
  if ("response" in gate) return gate.response;

  const { id } = await context.params;
  const payload = await readJson<{ role?: unknown; name?: unknown }>(request);
  if (!payload) return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });

  const patch: { role?: Role; name?: string | null } = {};
  if (payload.role !== undefined) {
    if (!ROLES.includes(payload.role as Role)) return Response.json({ error: "Ruolo sconosciuto." }, { status: 400 });
    patch.role = payload.role as Role;
  }
  if (payload.name !== undefined) {
    patch.name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;
  }
  if (Object.keys(patch).length === 0) return Response.json({ error: "Niente da modificare." }, { status: 400 });

  const profiles = await listProfiles();
  const target = profiles.find((p) => p.id === id);
  if (!target) return Response.json({ error: "Profilo non trovato" }, { status: 404 });

  if (patch.role === "editor" && target.role === "approver") {
    const approvers = profiles.filter((p) => p.role === "approver").length;
    if (approvers <= 1) {
      return Response.json({ error: "E' l'ultimo approvatore: nomina prima qualcun altro." }, { status: 409 });
    }
  }

  const profile = await updateProfile(id, patch);
  if (!profile) return Response.json({ error: "Modifica non riuscita." }, { status: 500 });
  return Response.json({ profile });
}
