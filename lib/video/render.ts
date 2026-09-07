import { access } from "node:fs/promises";
import path from "node:path";
import { templateLayout, type BlockText } from "@/lib/layout-model";
import { captureFrames } from "./capture";
import { encodeMp4 } from "./encode";
import { VideoRenderError } from "./errors";
import type { VideoRenderer } from "./jobs";
import { FPS, MUSIC_FILE, videoSize } from "./spec";
import { buildTimeline } from "./timeline";
import { videoPage } from "./page";

/**
 * Da una riga `videos` a un MP4.
 *
 * I pezzi sono tre e ognuno puo' fallire per conto suo: la pagina (font,
 * layout), la cattura (Chromium), la codifica (ffmpeg). L'errore dice quale,
 * perche' "il video non è uscito" non aiuta nessuno a capire cosa aggiustare.
 */

/** La base musicale, se il marketing l'ha messa nel repo. */
export async function musicPath(): Promise<string | null> {
  const file = path.join(process.cwd(), "assets", "audio", MUSIC_FILE);
  try {
    await access(file);
    return file;
  } catch {
    return null;
  }
}

export async function musicAvailable(): Promise<boolean> {
  return Boolean(await musicPath());
}

export const renderVideo: VideoRenderer = async (job, baseUrl) => {
  const { request } = job;
  const size = videoSize(request.format);

  const text: BlockText = {
    eyebrow: request.copy.eyebrow,
    headline: request.copy.headline,
    subhead: request.copy.subhead,
    body: request.copy.body,
    badge: request.copy.badge,
    disclaimer: request.copy.disclaimer,
  };

  const layout = request.layout ?? templateLayout(request.format, request.archetype, text);
  const timeline = buildTimeline(layout, request.durationMs, FPS);
  const music = await musicPath();

  let html: string;
  try {
    html = await videoPage(request, layout, timeline, size, baseUrl);
  } catch (error) {
    throw new VideoRenderError("pagina", messageOf(error));
  }

  let bytes: Uint8Array;
  try {
    bytes = await encodeMp4(captureFrames(html, size, timeline), {
      width: size.width,
      height: size.height,
      fps: timeline.fps,
      durationMs: timeline.durationMs,
      music,
    });
  } catch (error) {
    const detail = messageOf(error);
    throw new VideoRenderError(detail.includes("ffmpeg") ? "codifica" : "cattura", detail);
  }

  return {
    bytes,
    width: size.width,
    height: size.height,
    durationMs: timeline.durationMs,
    fps: timeline.fps,
    music: Boolean(music),
  };
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
