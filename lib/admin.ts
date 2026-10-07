import { currentUser, type StudioUser } from "@/auth";

/**
 * Il cancello delle rotte riservate: l'utente della sessione deve esistere
 * ed essere approvatore. Si decide qui, sul server, non con un pulsante
 * nascosto nella pagina.
 */
export async function requireApprover(): Promise<{ user: StudioUser } | { response: Response }> {
  const user = await currentUser();
  if (!user) return { response: Response.json({ error: "Non autorizzato" }, { status: 401 }) };
  if (user.role !== "approver") {
    return { response: Response.json({ error: "Riservato agli approvatori." }, { status: 403 }) };
  }
  return { user };
}

export async function readJson<T extends Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as T) : null;
  } catch {
    return null;
  }
}
