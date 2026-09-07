import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "./env";
import type { FormatId } from "./brand";
import type { ArchetypeId, AssetLayout } from "./layout-model";
import { objectStore, storageIsDurable } from "./storage";
import type { VariantCopy } from "./types";

/**
 * I video come lavori durevoli.
 *
 * Un rendering dura un minuto e non puo' vivere nella richiesta che l'ha
 * avviato. La riga nasce prima di aprire Chromium e porta con se' tutto
 * cio' che serve a rifare il video: il copy, l'impaginazione, la foto.
 * Cosi' chi riprende un lavoro interrotto non deve chiedere niente
 * all'editor, che nel frattempo puo' essere stato chiuso.
 *
 * Tre posti dove puo' stare la riga, in ordine di preferenza:
 *
 *  - Supabase, se configurato: la tabella `videos`.
 *  - lo store dei file (Vercel Blob), se c'e' quello ma non il database.
 *    Esiste perche' in produzione la memoria non regge: la richiesta che
 *    crea il lavoro e quella che ne chiede lo stato possono atterrare su
 *    due istanze diverse, e la seconda risponderebbe "video sconosciuto"
 *    a un video che sta uscendo.
 *  - la memoria del processo, solo in locale senza credenziali.
 */

export type VideoStatus = "pending" | "rendering" | "ready" | "failed";

/** Tutto quello che il rendering deve sapere, cosi' com'era nell'editor. */
export interface VideoRequest {
  format: FormatId;
  variant: number;
  copy: VariantCopy;
  archetype: ArchetypeId;
  /** L'impaginazione modificata. Senza, esce il template dell'impianto. */
  layout: AssetLayout | null;
  photo: string;
  durationMs: number;
}

export interface VideoJob {
  id: string;
  run_id: string | null;
  variant_index: number;
  format: FormatId;
  request: VideoRequest;
  status: VideoStatus;
  stored_path: string | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  duration_ms: number | null;
  fps: number | null;
  /** Vero se sotto c'e' la base musicale, falso se e' uscito silenzioso. */
  music: boolean | null;
  error: string | null;
  attempts: number;
  /** Quando l'ultimo tentativo ha aperto Chromium. Serve a riconoscere un lavoro interrotto. */
  started_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const OPEN: VideoStatus[] = ["pending", "rendering"];

interface Backend {
  create(job: VideoJob): Promise<VideoJob>;
  update(id: string, patch: Partial<VideoJob>): Promise<void>;
  get(id: string): Promise<VideoJob | null>;
  open(limit: number): Promise<VideoJob[]>;
  byRun(runId: string, limit: number): Promise<VideoJob[]>;
  inFlight(): Promise<number>;
  startedSince(iso: string): Promise<number>;
  reset(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Supabase                                                             */
/* ------------------------------------------------------------------ */

const TABLE = "videos";

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl!, env.supabaseServiceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

const supabaseBackend: Backend = {
  async create(job) {
    const { data, error } = await db().from(TABLE).insert(job).select().single();
    if (error) throw new Error(`Non riesco a registrare il video: ${error.message}`);
    return data as VideoJob;
  },

  async update(id, patch) {
    const { error } = await db().from(TABLE).update(patch).eq("id", id);
    if (error) console.error("[db-videos] update", error.message);
  },

  async get(id) {
    const { data, error } = await db().from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error("[db-videos] get", error.message);
      return null;
    }
    return (data as VideoJob) ?? null;
  },

  async open(limit) {
    const { data, error } = await db()
      .from(TABLE)
      .select("*")
      .in("status", OPEN)
      .order("created_at")
      .limit(limit);
    if (error) {
      console.error("[db-videos] open", error.message);
      return [];
    }
    return data as VideoJob[];
  },

  async byRun(runId, limit) {
    const { data, error } = await db()
      .from(TABLE)
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[db-videos] byRun", error.message);
      return [];
    }
    return data as VideoJob[];
  },

  async inFlight() {
    const { count, error } = await db()
      .from(TABLE)
      .select("id", { count: "exact", head: true })
      .in("status", OPEN);
    if (error) {
      console.error("[db-videos] inFlight", error.message);
      return 0;
    }
    return count ?? 0;
  },

  async startedSince(iso) {
    const { count, error } = await db()
      .from(TABLE)
      .select("id", { count: "exact", head: true })
      .gte("created_at", iso);
    if (error) {
      console.error("[db-videos] daily", error.message);
      return 0;
    }
    return count ?? 0;
  },

  async reset() {
    // Il database non si svuota dai test.
  },
};

/* ------------------------------------------------------------------ */
/* Memoria                                                              */
/* ------------------------------------------------------------------ */

const globalStore = globalThis as unknown as { __tvVideos?: Map<string, VideoJob> };

function memory(): Map<string, VideoJob> {
  if (!globalStore.__tvVideos) globalStore.__tvVideos = new Map();
  return globalStore.__tvVideos;
}

const memoryBackend: Backend = {
  async create(job) {
    memory().set(job.id, job);
    return job;
  },
  async update(id, patch) {
    const job = memory().get(id);
    if (job) memory().set(id, { ...job, ...patch });
  },
  async get(id) {
    return memory().get(id) ?? null;
  },
  async open(limit) {
    return [...memory().values()]
      .filter((j) => OPEN.includes(j.status))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limit);
  },
  async byRun(runId, limit) {
    return [...memory().values()]
      .filter((j) => j.run_id === runId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  },
  async inFlight() {
    return [...memory().values()].filter((j) => OPEN.includes(j.status)).length;
  },
  async startedSince(iso) {
    return [...memory().values()].filter((j) => j.created_at >= iso).length;
  },
  async reset() {
    memory().clear();
  },
};

/* ------------------------------------------------------------------ */
/* Lo store dei file                                                    */
/* ------------------------------------------------------------------ */

/**
 * Ogni cambio di stato e' un file nuovo, mai una sovrascrittura.
 *
 * La prima versione riscriveva un JSON per lavoro piu' un indice, e in
 * produzione il freno di concorrenza ha rifiutato video per un lavoro che
 * era finito da minuti: la CDN di Vercel Blob serve un file sovrascritto
 * nella versione vecchia anche per un minuto. Un poll ogni tre secondi
 * non puo' conviverci.
 *
 * Quindi: `video/jobs/{id}/{istante}~{stato}~{esecuzione}.json`. Il nome
 * porta cio' che serve a elencare e contare senza aprire il file, l'elenco
 * arriva dall'API (sempre aggiornato), e il contenuto si legge solo per
 * l'ultima versione, che non cambia mai piu'.
 */

const JOB_PREFIX = "video/jobs/";

interface Version {
  id: string;
  path: string;
  /** Millisecondi, con zeri davanti: l'ordine alfabetico e' quello temporale. */
  stamp: string;
  status: VideoStatus;
  run_id: string | null;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function stampOf(iso: string): string {
  return String(Date.parse(iso)).padStart(15, "0");
}

function versionPath(job: VideoJob): string {
  const run = job.run_id ? encodeURIComponent(job.run_id) : "";
  return `${JOB_PREFIX}${job.id}/${stampOf(job.updated_at)}~${job.status}~${run}.json`;
}

function parseVersion(path: string): Version | null {
  const match = /^video\/jobs\/([^/]+)\/(\d+)~([a-z]+)~([^/]*)\.json$/.exec(path);
  if (!match) return null;
  const [, id, stamp, status, run] = match;
  if (!(OPEN as string[]).includes(status) && status !== "ready" && status !== "failed") return null;
  return {
    id,
    path,
    stamp,
    status: status as VideoStatus,
    run_id: run ? decodeURIComponent(run) : null,
  };
}

/** Per ogni lavoro, la sua storia dal piu' vecchio al piu' recente. */
async function histories(prefix = JOB_PREFIX): Promise<Map<string, Version[]>> {
  const paths = await objectStore().list(prefix);
  const byId = new Map<string, Version[]>();
  for (const path of paths) {
    const v = parseVersion(path);
    if (!v) continue;
    const list = byId.get(v.id) ?? [];
    list.push(v);
    byId.set(v.id, list);
  }
  for (const list of byId.values()) list.sort((a, b) => a.stamp.localeCompare(b.stamp));
  return byId;
}

async function latest(id: string): Promise<Version | null> {
  const history = (await histories(`${JOB_PREFIX}${id}/`)).get(id);
  return history?.[history.length - 1] ?? null;
}

async function readVersion(v: Version): Promise<VideoJob | null> {
  const file = await objectStore().get(v.path);
  if (!file) return null;
  try {
    return JSON.parse(decoder.decode(file.data)) as VideoJob;
  } catch {
    return null;
  }
}

async function writeVersion(job: VideoJob): Promise<void> {
  await objectStore().put(versionPath(job), encoder.encode(JSON.stringify(job)), "application/json");
}

async function readLatestMany(versions: Version[]): Promise<VideoJob[]> {
  const jobs = await Promise.all(versions.map(readVersion));
  return jobs.filter((j): j is VideoJob => j !== null);
}

/** L'ultima versione di ogni lavoro, con l'istante di nascita. */
function heads(byId: Map<string, Version[]>): { head: Version; born: string }[] {
  return [...byId.values()].map((history) => ({
    head: history[history.length - 1],
    born: history[0].stamp,
  }));
}

const storeBackend: Backend = {
  async create(job) {
    await writeVersion(job);
    return job;
  },

  async update(id, patch) {
    const head = await latest(id);
    if (!head) return;
    const current = await readVersion(head);
    if (!current) return;
    const next = { ...current, ...patch };
    // Due scritture nello stesso millisecondo darebbero lo stesso nome.
    if (stampOf(next.updated_at) <= head.stamp) {
      next.updated_at = new Date(Number(head.stamp) + 1).toISOString();
    }
    await writeVersion(next);
  },

  async get(id) {
    const head = await latest(id);
    return head ? readVersion(head) : null;
  },

  async open(limit) {
    const chosen = heads(await histories())
      .filter(({ head }) => OPEN.includes(head.status))
      .sort((a, b) => a.born.localeCompare(b.born))
      .slice(0, limit);
    return readLatestMany(chosen.map((c) => c.head));
  },

  async byRun(runId, limit) {
    const chosen = heads(await histories())
      .filter(({ head }) => head.run_id === runId)
      .sort((a, b) => b.born.localeCompare(a.born))
      .slice(0, limit);
    return readLatestMany(chosen.map((c) => c.head));
  },

  async inFlight() {
    return heads(await histories()).filter(({ head }) => OPEN.includes(head.status)).length;
  },

  async startedSince(iso) {
    const since = stampOf(iso);
    return heads(await histories()).filter(({ born }) => born >= since).length;
  },

  async reset() {
    for (const path of await objectStore().list(JOB_PREFIX)) await objectStore().remove(path);
  },
};

/* ------------------------------------------------------------------ */

let forced: "store" | null = null;

/** Solo per i test: usa lo store dei file anche senza credenziali. */
export function forceStoreBackend(on: boolean): void {
  forced = on ? "store" : null;
}

function backend(): Backend {
  if (forced === "store") return storeBackend;
  if (supabaseConfigured) return supabaseBackend;
  if (storageIsDurable()) return storeBackend;
  return memoryBackend;
}

/** Vero quando i lavori sopravvivono al processo. */
export function videosAreDurable(): boolean {
  return backend() !== memoryBackend;
}

export async function createJob(
  input: Pick<VideoJob, "run_id" | "request" | "created_by">,
): Promise<VideoJob> {
  const now = new Date().toISOString();
  const job: VideoJob = {
    id: crypto.randomUUID(),
    variant_index: input.request.variant,
    format: input.request.format,
    status: "pending",
    stored_path: null,
    mime: null,
    width: null,
    height: null,
    bytes: null,
    duration_ms: null,
    fps: null,
    music: null,
    error: null,
    attempts: 0,
    started_at: null,
    created_at: now,
    updated_at: now,
    ...input,
  };
  return backend().create(job);
}

export async function updateJob(id: string, patch: Partial<VideoJob>): Promise<void> {
  await backend().update(id, { ...patch, updated_at: new Date().toISOString() });
}

export async function getJob(id: string): Promise<VideoJob | null> {
  return backend().get(id);
}

/** I lavori ancora aperti: quelli che il drain deve riprendere. */
export async function openJobs(limit = 10): Promise<VideoJob[]> {
  return backend().open(limit);
}

/** I video di un'esecuzione, dal piu' recente. Serve alla console dopo un refresh. */
export async function listByRun(runId: string, limit = 40): Promise<VideoJob[]> {
  return backend().byRun(runId, limit);
}

/** Quanti lavori risultano aperti. Il freno usa `activeCount`, che scarta gli stantii. */
export async function inFlightCount(): Promise<number> {
  return backend().inFlight();
}

/** Quanti ne sono stati avviati nelle ultime 24 ore. Serve al tetto giornaliero. */
export async function startedLastDay(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return backend().startedSince(since);
}

/** Svuota il backend corrente. Serve ai test. */
export async function resetVideoStore(): Promise<void> {
  await backend().reset();
}
