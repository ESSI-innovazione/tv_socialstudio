import { can, type Action, type Actor } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export type NavIcon = "tools" | "runs" | "archive" | "approvals" | "calendar" | "templates" | "edit-tools" | "team";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Il permesso che apre la pagina. Senza, la vede tutto il team. */
  requires?: Action;
  /** Un contatore accanto alla voce: le approvazioni in attesa. */
  badge?: "approvals";
}

export interface NavSection {
  /** L'intestazione in maiuscoletto. Null per la sezione principale. */
  title: string | null;
  items: NavItem[];
}

/**
 * Le pagine dello Studio, nell'ordine della barra laterale. Ogni voce
 * dichiara il permesso che serve ad aprirla: la barra e il controllo lato
 * server leggono la stessa riga, cosi' non puo' esistere una voce visibile
 * che il server rifiuta, ne' una pagina raggiungibile che la barra nasconde.
 */
const ALL: NavSection[] = [
  {
    title: null,
    items: [
      { href: "/studio", label: "Strumenti", icon: "tools" },
      { href: "/studio/storico", label: "Creazioni", icon: "runs" },
      { href: "/studio/archivio", label: "Archivio", icon: "archive" },
      { href: "/studio/approvazioni", label: "Approvazioni", icon: "approvals", requires: "approve", badge: "approvals" },
      { href: "/studio/calendario", label: "Calendario", icon: "calendar" },
      { href: "/studio/template", label: "Template", icon: "templates" },
    ],
  },
  {
    title: "Amministrazione",
    items: [
      { href: "/studio/admin/strumenti", label: "Modifica strumenti", icon: "edit-tools", requires: "editTools" },
      { href: "/studio/admin/team", label: "Team e ruoli", icon: "team", requires: "manageTeam" },
    ],
  },
];

export function studioNav(role: Role, isAdmin: boolean): NavSection[] {
  const actor: Actor = { role, isAdmin };
  return ALL.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.requires || can(actor, item.requires)),
  })).filter((section) => section.items.length > 0);
}

/** La voce attiva: la console solo su /studio esatto, le altre anche sulle sottopagine. */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/studio") return pathname === "/studio" || pathname.startsWith("/studio/strumenti");
  return pathname === href || pathname.startsWith(`${href}/`);
}
