import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Le pagine dello Studio, nell'ordine della barra. La console resta la
 * prima: tutto il resto e' il lavoro intorno — rivedere, approvare,
 * ritrovare. Le voci riservate compaiono solo agli approvatori.
 */
export function studioNav(role: Role): NavItem[] {
  const items: NavItem[] = [
    { href: "/studio", label: "Studio" },
    { href: "/studio/storico", label: "I miei lavori" },
  ];
  if (role === "approver") {
    items.push({ href: "/studio/approvazioni", label: "Approvazioni" });
  }
  return items;
}
