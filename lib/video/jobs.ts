import {
  createJob,
  getJob,
  listByRun,
  openJobs,
  startedLastDay,
  updateJob,
  type VideoJob,
  type VideoRequest,
} from "../db-videos";
import { objectStore } from "../storage";
import { VideoLimitError } from "./errors";
import { LIMITS, MAX_ATTEMPTS, STALE_PENDING_MS, STALE_RENDERING_MS } from "./spec";

/**
 * Il ciclo di vita di un video.
 *
 * `startVideo` registra la riga e basta: chi chiama decide quando e dove
 * renderizzare (la rotta lo fa dopo aver risposto, il drain lo fa per i
 * lavori persi). `advance` porta un lavoro al passo successivo ed e'
 * idempotente: chiamarlo su un lavoro finito non fa niente, chiamarlo su
 * uno in corso non ne avvia un secondo.
 *
 * Il renderer arriva da fuori. Non e' eleganza: e' cio' che permette di
 * verificare questa macchina a stati senza aprire Chromium.
 */

export interface RenderedVideo {
  bytes: Uint8Array;
  width: number;
  height: number;
  durationMs: number;
  fps: number;
  music: boolean;
}

export type VideoRenderer = (job: VideoJob, baseUrl: string) => Promise<RenderedVideo>;

/**
 * Quanti rendering occupano davvero una funzione adesso. Un lavoro stantio
 * non ne occupa nessuna: contarlo bloccherebbe tutti finche' il cron non
 * lo riprende, ed e' successo.
 */
export async function activeCount(now = Date.now()): Promise<number> {
  const open = await openJobs(LIMITS.concurrency + 10);
  return open.filter((job) => !isStale(job, now)).length;
}

async function assertWithinLimits(): Promise<void> {
  const [active, today] = await Promise.all([activeCount(), startedLastDay()]);
  if (active >= LIMITS.concurrency) throw new VideoLimitError("concurrency", LIMITS.concurrency);
  if (today >= LIMITS.perDay) throw new VideoLimitError("daily", LIMITS.perDay);
}

export async function startVideo(
  request: VideoRequest,
  options: { runId?: string | null; createdBy?: string | null } = {},
): Promise<VideoJob> {
  await assertWithinLimits();
  return createJob({
    request,
    run_id: options.runId ?? null,
    created_by: options.createdBy ?? null,
  });
}

/** Il percorso nello store. Un prefisso suo, per non confonderlo con i documenti. */
export function videoPath(job: VideoJob): string {
  return `video/${job.created_at.slice(0, 10)}/${job.id}.mp4`;
}

/**
 * Vero se nessuna funzione ci sta lavorando: un `pending` che nessuno ha
 * preso, o un `rendering` piu' vecchio di quanto una funzione possa vivere.
 */
export function isStale(job: VideoJob, now = Date.now()): boolean {
  if (job.status === "pending") {
    return now - Date.parse(job.started_at ?? job.created_at) > STALE_PENDING_MS;
  }
  if (job.status === "rendering") {
    return now - Date.parse(job.started_at ?? job.created_at) > STALE_RENDERING_MS;
  }
  return false;
}

/**
 * Fa avanzare un lavoro. Con `force` un `pending` parte subito: e' il caso
 * della rotta che l'ha appena creato. Senza, parte solo se e' stantio: e'
 * il caso del poll e del drain, che non devono avviare un secondo rendering
 * accanto a quello in corso.
 */
export async function advance(
  id: string,
  render: VideoRenderer,
  baseUrl: string,
  options: { force?: boolean; now?: number } = {},
): Promise<VideoJob | null> {
  const job = await getJob(id);
  if (!job) return null;
  if (job.status === "ready" || job.status === "failed") return job;

  const now = options.now ?? Date.now();
  const claim = job.status === "pending" ? options.force || isStale(job, now) : isStale(job, now);
  if (!claim) return job;

  if (job.attempts >= MAX_ATTEMPTS) {
    await updateJob(id, {
      status: "failed",
      error: `Il rendering si è interrotto ${MAX_ATTEMPTS} volte senza finire. Riprova con un video più corto o segnalalo.`,
    });
    return getJob(id);
  }

  await updateJob(id, {
    status: "rendering",
    attempts: job.attempts + 1,
    started_at: new Date(now).toISOString(),
    error: null,
  });

  try {
    const produced = await render({ ...job, attempts: job.attempts + 1 }, baseUrl);
    const stored = await objectStore().put(videoPath(job), produced.bytes, "video/mp4");

    await updateJob(id, {
      status: "ready",
      stored_path: stored.path,
      mime: "video/mp4",
      width: produced.width,
      height: produced.height,
      bytes: stored.bytes,
      duration_ms: produced.durationMs,
      fps: produced.fps,
      music: produced.music,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateJob(id, { status: "failed", error: message });
  }

  return getJob(id);
}

export async function videosForRun(runId: string): Promise<VideoJob[]> {
  return listByRun(runId);
}

/** La forma che la console vede. Niente percorsi interni. */
export interface VideoView {
  id: string;
  status: VideoJob["status"];
  format: VideoJob["format"];
  variant: number;
  url: string | null;
  downloadUrl: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  music: boolean | null;
  error: string | null;
  attempts: number;
  createdAt: string;
}

export function toVideoView(job: VideoJob): VideoView {
  const ready = job.status === "ready" && job.stored_path;
  return {
    id: job.id,
    status: job.status,
    format: job.format,
    variant: job.variant_index,
    url: ready ? `/api/videos/${job.id}/file` : null,
    downloadUrl: ready ? `/api/videos/${job.id}/file?download=1` : null,
    width: job.width,
    height: job.height,
    durationMs: job.duration_ms,
    music: job.music,
    error: job.error,
    attempts: job.attempts,
    createdAt: job.created_at,
  };
}
