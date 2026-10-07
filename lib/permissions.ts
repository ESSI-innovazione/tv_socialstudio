import type { Role } from "./types";

/**
 * La matrice dei permessi, in un posto solo.
 *
 * Le rotte la interrogano con `can()`, la barra laterale decide cosa
 * mostrare con la stessa funzione, e la pagina del team la disegna da
 * `ACTIONS`: non puo' esistere una tabella nella UI che dica una cosa
 * diversa da quella che il server applica.
 *
 * L'admin e' una spunta, non un ruolo: un approvatore admin resta
 * approvatore per il lavoro di tutti i giorni, e in piu' gestisce il team.
 */

export type Action = "createRuns" | "syncTemplates" | "approve" | "publish" | "editTools" | "manageTeam";

export interface ActionSpec {
  key: Action;
  /** Come si legge nella pagina del team. */
  label: string;
  /** I ruoli che possono farlo da soli, senza la spunta admin. */
  roles: Role[];
}

export const ACTIONS: ActionSpec[] = [
  { key: "createRuns", label: "Creare, salvare bozze, esportare", roles: ["editor", "designer", "approver"] },
  { key: "syncTemplates", label: "Sincronizzare i template Figma e renderli disponibili al team", roles: ["designer", "approver"] },
  { key: "approve", label: "Approvare", roles: ["approver"] },
  { key: "publish", label: "Pubblicare e programmare i post", roles: ["approver"] },
  { key: "editTools", label: "Modificare gli strumenti e le loro istruzioni", roles: ["approver"] },
  { key: "manageTeam", label: "Invitare persone, cambiare ruoli, togliere accessi", roles: [] },
];

export const ROLES: Role[] = ["editor", "designer", "approver"];

export const ROLE_LABEL: Record<Role, string> = {
  editor: "Editor",
  designer: "Designer",
  approver: "Approvatore",
};

/** Una riga per ruolo, per le card di invito. */
export const ROLE_HINT: Record<Role, string> = {
  editor: "Crea, salva bozze ed esporta. Chiede l'approvazione.",
  designer: "Come l'editor, e in piu' sincronizza i template da Figma.",
  approver: "Approva, pubblica, programma e modifica gli strumenti.",
};

export interface Actor {
  role: Role;
  isAdmin: boolean;
}

export function can(user: Actor, action: Action): boolean {
  if (user.isAdmin) return true;
  const spec = ACTIONS.find((a) => a.key === action);
  return spec ? spec.roles.includes(user.role) : false;
}

/** «Approvatore · Admin»: l'etichetta sotto il nome in barra. */
export function roleLabel(user: Actor): string {
  return user.isAdmin ? `${ROLE_LABEL[user.role]} · Admin` : ROLE_LABEL[user.role];
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}
