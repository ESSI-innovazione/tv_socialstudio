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
  get blobToken() {
    return read("BLOB_READ_WRITE_TOKEN");
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
