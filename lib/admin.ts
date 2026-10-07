import { currentUser, type StudioUser } from "@/auth";
import { can, type Action } from "./permissions";

/**
 * Il cancello delle rotte riservate: l'utente della sessione deve esistere
 * e avere il permesso. Si decide qui, sul server, con la matrice di
 * lib/permissions.ts, non con un pulsante nascosto nella pagina.
 */
export async function requireCan(action: Action): Promise<{ user: StudioUser } | { response: Response }> {
  const user = await currentUser();
  if (!user) return { response: Response.json({ error: "Non autorizzato" }, { status: 401 }) };
  if (!can(user, action)) {
    return { response: Response.json({ error: DENIED[action] }, { status: 403 }) };
  }
  return { user };
}

/** Il motivo del rifiuto, in italiano, per chi lo legge in un errore. */
const DENIED: Record<Action, string> = {
  createRuns: "Il tuo profilo non puo' creare.",
  syncTemplates: "Riservato a designer e approvatori.",
  approve: "Solo un approvatore puo' approvare.",
  publish: "Solo un approvatore puo' pubblicare o programmare.",
  editTools: "Solo un approvatore puo' modificare gli strumenti.",
  manageTeam: "Riservato agli admin.",
};

/** Compatibilita' con le rotte scritte prima della matrice. */
export async function requireApprover() {
  return requireCan("approve");
}

export async function readJson<T extends Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as T) : null;
  } catch {
    return null;
  }
}
