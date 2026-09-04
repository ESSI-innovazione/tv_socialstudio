import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Chromium va lasciato dov'e'.
   *
   * @sparticuz/chromium porta con se' un binario dentro il pacchetto. Se il
   * bundler lo ingloba, il binario viene spostato e all'avvio la cartella
   * `bin` non esiste piu': il rendering del poster A4 fallisce in produzione
   * mentre in locale funziona, perche' in locale si usa il Chrome installato.
   */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
