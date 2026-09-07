import { env } from "../env";

/**
 * Chromium headless, per il poster e per il video.
 *
 * In locale si usa il Chrome installato (`CHROME_PATH`); su Vercel il
 * binario di @sparticuz/chromium, che e' compilato per quel runtime e va
 * tracciato in `next.config.ts` per ogni rotta che lo apre.
 *
 * Niente `defaultViewport` nelle opzioni: nella versione installata non
 * esiste, e metterlo ha gia' rotto l'export una volta.
 */
export async function launchChromium() {
  const [{ default: chromium }, puppeteer] = await Promise.all([
    import("@sparticuz/chromium"),
    import("puppeteer-core"),
  ]);

  const local = env.chromePath;

  return puppeteer.default.launch({
    args: local ? [] : chromium.args,
    executablePath: local ?? (await chromium.executablePath()),
    headless: true,
  });
}
