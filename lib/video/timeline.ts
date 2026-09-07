import type { AssetLayout, BlockKind } from "../layout-model";
import { DURATION_MS, FPS } from "./spec";

/**
 * Il "reveal": come l'asset prende vita.
 *
 * La foto scivola da un leggero zoom al riposo per tutta la durata, il
 * marchio appare subito, i testi entrano uno dopo l'altro nell'ordine in cui
 * li si legge, dall'alto verso il basso. Poi tutto resta fermo: una story si
 * guarda, non si insegue.
 *
 * L'ordine viene dal layout, non dal tipo di blocco: un'impaginazione
 * modificata nell'editor anima nell'ordine in cui la si vede.
 */

export type Effect = "drift" | "fade" | "rise";

export interface BlockMotion {
  id: string;
  kind: BlockKind;
  effect: Effect;
  delayMs: number;
  durationMs: number;
}

export interface Timeline {
  durationMs: number;
  fps: number;
  /** Quanti scatti servono. */
  frames: number;
  motions: BlockMotion[];
}

export const LOGO_MS = 500;
export const RISE_MS = 600;
export const FIRST_DELAY_MS = 400;
export const STAGGER_MS = 260;

export function buildTimeline(
  layout: AssetLayout,
  durationMs = DURATION_MS,
  fps = FPS,
): Timeline {
  const visible = layout.blocks.filter((b) => b.visible);
  const motions: BlockMotion[] = [];

  for (const block of visible) {
    if (block.kind === "image") {
      motions.push({ id: block.id, kind: block.kind, effect: "drift", delayMs: 0, durationMs });
    } else if (block.kind === "logo") {
      motions.push({ id: block.id, kind: block.kind, effect: "fade", delayMs: 0, durationMs: LOGO_MS });
    }
  }

  const texts = visible
    .filter((b) => b.kind !== "image" && b.kind !== "logo")
    .sort((a, b) => a.y - b.y || a.x - b.x);

  texts.forEach((block, i) => {
    motions.push({
      id: block.id,
      kind: block.kind,
      effect: "rise",
      delayMs: FIRST_DELAY_MS + i * STAGGER_MS,
      durationMs: RISE_MS,
    });
  });

  return { durationMs, fps, frames: frameCount(durationMs, fps), motions };
}

export function frameCount(durationMs: number, fps: number): number {
  return Math.round((durationMs * fps) / 1000);
}

/** Il tempo, in millisecondi, a cui scattare il fotogramma `index`. */
export function frameTime(index: number, fps: number): number {
  return (index * 1000) / fps;
}

/** Quando l'ultimo testo ha finito di entrare. Deve stare dentro la durata. */
export function entranceEnd(timeline: Timeline): number {
  return timeline.motions
    .filter((m) => m.effect !== "drift")
    .reduce((max, m) => Math.max(max, m.delayMs + m.durationMs), 0);
}
