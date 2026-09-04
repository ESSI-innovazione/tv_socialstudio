import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Chromium va lasciato dov'e', e va portato con noi.
   *
   * @sparticuz/chromium tiene il browser compresso in `bin/` (una settantina
   * di megabyte). Servono due cose diverse, e mancarne una basta a far
   * fallire la stampa in produzione mentre in locale funziona, perche' in
   * locale si usa il Chrome installato:
   *
   * 1. il pacchetto non va inglobato dal bundler, o il binario viene spostato;
   * 2. i file di `bin/` vanno inclusi nel tracciamento, o non salgono proprio.
   */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],

  outputFileTracingIncludes: {
    "/api/render/**": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
