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
 *  - lo store dei file (Vercel Blob), se c'e' quello ma non il database:
 *    un JSON per lavoro piu' un indice. Esiste perche' in produzione la
 *    memoria non regge: la richiesta che crea il lavoro e quella che ne
 *    chiede lo stato possono atterrare su due istanze diverse, e la seconda
 *    risponderebbe "video sconosciuto" a un video che sta uscendo.
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
};

/* ------------------------------------------------------------------ */
/* Lo store dei file                                                    */
/* ------------------------------------------------------------------ */

const JOB_PREFIX = "video/jobs/";
const INDEX_PATH = "video/jobs/index.json";
/** Quanti lavori ricorda l'indice. Bastano per i freni e per la console. */
const INDEX_SIZE = 200;

/** Il poco che serve a elencare senza aprire ogni lavoro. */
type IndexEntry = Pick<VideoJob, "id" | "run_id" | "status" | "created_at">;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function readJson<T>(path: string): Promise<T | null> {
  const file = await objectStore().get(path);
  if (!file) return null;
  try {
    return JSON.parse(decoder.decode(file.data)) as T;
  } catch {
    return null;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await objectStore().put(path, encoder.encode(JSON.stringify(value)), "application/json");
}

async function readIndex(): Promise<IndexEntry[]> {
  return (await readJson<IndexEntry[]>(INDEX_PATH)) ?? [];
}

/**
 * Aggiorna l'indice. Due istanze che scrivono nello stesso istante possono
 * perdersi una voce a vicenda: il lavoro resta comunque nel suo file, e al
 * massimo sparisce dall'elenco. Per uno strumento interno e' un rischio
 * che vale la semplicita' di non avere una coda.
 */
async function indexJob(job: VideoJob): Promise<void> {
  const entry: IndexEntry = {
    id: job.id,
    run_id: job.run_id,
    status: job.status,
    created_at: job.created_at,
  };
  const rest = (await readIndex()).filter((e) => e.id !== job.id);
  const next = [entry, ...rest]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, INDEX_SIZE);
  await writeJson(INDEX_PATH, next);
}

async function loadMany(entries: IndexEntry[]): Promise<VideoJob[]> {
  const jobs = await Promise.all(entries.map((e) => readJson<VideoJob>(`${JOB_PREFIX}${e.id}.json`)));
  return jobs.filter((j): j is VideoJob => j !== null);
}

const storeBackend: Backend = {
  async create(job) {
    await writeJson(`${JOB_PREFIX}${job.id}.json`, job);
    await indexJob(job);
    return job;
  },

  async update(id, patch) {
    const current = await readJson<VideoJob>(`${JOB_PREFIX}${id}.json`);
    if (!current) return;
    const next = { ...current, ...patch };
    await writeJson(`${JOB_PREFIX}${id}.json`, next);
    if (patch.status && patch.status !== current.status) await indexJob(next);
  },

  async get(id) {
    return readJson<VideoJob>(`${JOB_PREFIX}${id}.json`);
  },

  async open(limit) {
    const entries = (await readIndex())
      .filter((e) => OPEN.includes(e.status))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limit);
    return loadMany(entries);
  },

  async byRun(runId, limit) {
    const entries = (await readIndex()).filter((e) => e.run_id === runId).slice(0, limit);
    return loadMany(entries);
  },

  async inFlight() {
    return (await readIndex()).filter((e) => OPEN.includes(e.status)).length;
  },

  async startedSince(iso) {
    return (await readIndex()).filter((e) => e.created_at >= iso).length;
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

/** Quanti rendering sono in volo adesso. Serve al limite di concorrenza. */
export async function inFlightCount(): Promise<number> {
  return backend().inFlight();
}

/** Quanti ne sono stati avviati nelle ultime 24 ore. Serve al tetto giornaliero. */
export async function startedLastDay(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return backend().startedSince(since);
}

/** Svuota la memoria e l'indice dello store. Serve ai test. */
export async function resetVideoStore(): Promise<void> {
  memory().clear();
  if (backend() === storeBackend) await writeJson(INDEX_PATH, []);
}
