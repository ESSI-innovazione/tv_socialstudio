/**
 * Lettura dell'ambiente tollerante alle chiavi mancanti: l'app deve girare
 * end-to-end sui mock prima che esista una sola credenziale.
 */

function read(name: string): string | null {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

export const env = {
  get supabaseUrl() {
    return read("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceKey() {
    return read("SUPABASE_SERVICE_ROLE_KEY");
  },
  get anthropicKey() {
    return read("ANTHROPIC_API_KEY");
  },
  get figmaToken() {
    return read("FIGMA_TOKEN");
  },
  get figmaFileKey() {
    return read("FIGMA_FILE_KEY");
  },
  get linkedinToken() {
    return read("LINKEDIN_ACCESS_TOKEN");
  },
  get linkedinOrgId() {
    return read("LINKEDIN_ORGANIZATION_ID");
  },
  get igToken() {
    return read("IG_ACCESS_TOKEN");
  },
  get igUserId() {
    return read("IG_USER_ID");
  },
  get gammaApiKey() {
    return read("GAMMA_API_KEY");
  },
  /**
   * Token di Pollinations. Non serve per generare: senza, il motore risponde
   * lo stesso col modello gratuito. Serve solo ad aprire il catalogo dei
   * modelli migliori, se un giorno se ne compra uno.
   */
  get pollinationsToken() {
    return read("POLLINATIONS_TOKEN");
  },
  /**
   * Il modello di Pollinations. Senza token l'unico servito e' `sana`:
   * chiederne un altro non da' errore, da' `sana` in silenzio.
   */
  get visualModel() {
    return read("VISUAL_MODEL") ?? "sana";
  },
  /**
   * Chi genera i visual: `gamma` o `flux`.
   *
   * Gamma e' il default quando c'e' la chiave, e non e' una preferenza: rende
   * 2048px, capisce l'italiano senza traduzione e sbaglia molto meno il
   * soggetto. Pollinations e' gratuito e resta la scelta quando non si
   * vogliono spendere crediti, al prezzo di 768px e di un prompt che va
   * tradotto.
   */
  get visualEngine(): "gamma" | "flux" {
    const choice = read("VISUAL_ENGINE");
    if (choice === "gamma" || choice === "flux") return choice;
    return read("GAMMA_API_KEY") ? "gamma" : "flux";
  },
  get blobToken() {
    return read("BLOB_READ_WRITE_TOKEN");
  },
  /**
   * Il Chrome installato, per il poster e il video in locale. Su Vercel resta
   * vuota: si usa il binario di @sparticuz/chromium.
   */
  get chromePath() {
    return read("CHROME_PATH");
  },
  get cronSecret() {
    return read("CRON_SECRET");
  },
  get googleClientId() {
    return read("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return read("GOOGLE_CLIENT_SECRET");
  },
  get authSecret() {
    return read("NEXTAUTH_SECRET") ?? read("AUTH_SECRET");
  },
  /** URL pubblico dell'app, usato per costruire gli URL assoluti di rendering. */
  get siteUrl() {
    return (
      read("NEXTAUTH_URL") ??
      (read("VERCEL_PROJECT_PRODUCTION_URL")
        ? `https://${read("VERCEL_PROJECT_PRODUCTION_URL")}`
        : null) ??
      (read("VERCEL_URL") ? `https://${read("VERCEL_URL")}` : null) ??
      "http://localhost:3000"
    );
  },
};

/** Dominio aziendale: nessun altro puo' entrare. */
export const ALLOWED_EMAIL_DOMAIN = "timevision.it";

/** Vero quando l'autenticazione Google e' configurata davvero. */
export const authConfigured = Boolean(
  env.googleClientId && env.googleClientSecret && env.authSecret,
);

/** Vero quando esiste un database reale dietro l'app. */
export const supabaseConfigured = Boolean(env.supabaseUrl && env.supabaseServiceKey);
