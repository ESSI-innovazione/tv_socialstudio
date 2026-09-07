import { launchChromium } from "@/lib/render/chromium";
import type { VideoSize } from "./spec";
import { frameTime, type Timeline } from "./timeline";

/**
 * I fotogrammi, uno alla volta.
 *
 * Il tempo non scorre: si mettono in pausa tutte le animazioni e prima di
 * ogni scatto si imposta il loro `currentTime`. Il fotogramma `n` e' sempre
 * lo stesso, qualunque sia la velocita' della macchina — e' questo che
 * rende il video riproducibile e la cattura indipendente dal carico.
 *
 * E' un generatore: i byte vanno dritti a ffmpeg senza toccare il disco,
 * che su Vercel e' piccolo.
 */
export async function* captureFrames(
  html: string,
  size: VideoSize,
  timeline: Timeline,
): AsyncGenerator<Uint8Array, void, undefined> {
  const browser = await launchChromium();
  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: size.captureWidth,
      height: size.captureHeight,
      deviceScaleFactor: size.scale,
    });

    await page.setContent(html, { waitUntil: "load" });

    // Font e immagini pronti prima del primo scatto, poi si ferma il tempo.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((img) => img.decode().catch(() => undefined)),
      );
      for (const animation of document.getAnimations()) animation.pause();
    });

    const clip = { x: 0, y: 0, width: size.captureWidth, height: size.captureHeight };

    for (let i = 0; i < timeline.frames; i++) {
      await page.evaluate((ms: number) => {
        for (const animation of document.getAnimations()) animation.currentTime = ms;
      }, frameTime(i, timeline.fps));

      yield await page.screenshot({ type: "png", clip });
    }
  } finally {
    await browser.close();
  }
}
