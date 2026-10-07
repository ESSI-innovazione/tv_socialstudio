import type { Campaign } from "./types";

/**
 * La campagna attiva e' una preferenza della persona, non dello Studio: sta
 * in un cookie, cosi' la barra laterale e la console leggono la stessa
 * scelta da qualunque pagina, e un refresh non la perde.
 */
export const CAMPAIGN_COOKIE = "tv-campaign";

/** Un anno: la scelta non deve scadere a meta' campagna. */
export const CAMPAIGN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function activeCampaignId(campaigns: Campaign[], cookieValue: string | undefined): string | null {
  if (cookieValue && campaigns.some((c) => c.id === cookieValue)) return cookieValue;
  return campaigns.find((c) => c.active)?.id ?? campaigns[0]?.id ?? null;
}
