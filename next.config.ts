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
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "ffmpeg-static"],

  outputFileTracingIncludes: {
    "/api/render/**": ["./node_modules/@sparticuz/chromium/bin/**"],
    // Il video apre Chromium, lancia ffmpeg e legge font e musica dal disco:
    // tutto va portato con la funzione, o in produzione manca in silenzio.
    "/api/videos": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/ffmpeg-static/ffmpeg",
      "./assets/fonts/**",
      "./assets/audio/**",
    ],
    "/api/videos/**": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/ffmpeg-static/ffmpeg",
      "./assets/fonts/**",
      "./assets/audio/**",
    ],
  },
};

export default nextConfig;
