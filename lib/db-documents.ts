import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "./env";
import type { DocFormat, DocumentRequest } from "./integrations/types";

/**
 * Le generazioni come lavori durevoli.
 *
 * Una generazione Gamma impiega minuti. Se vivesse nella richiesta che l'ha
 * avviata, chiudere la scheda la perderebbe — e i crediti spesi con lei.
 * Qui la riga nasce al momento dell'invio e sopravvive al processo: chi
 * riprende trova il `generation_id` e continua a interrogare, non ne avvia
 * una seconda.
 */

export type DocStatus = "pending" | "generating" | "exporting" | "ready" | "failed";

export interface DocumentJob {
  id: string;
  run_id: string | null;
  format: DocFormat;
  title: string;
  request: DocumentRequest;
  theme_id: string;
  status: DocStatus;
  /** L'id restituito da Gamma all'invio. La chiave per riprendere. */
  generation_id: string | null;
  gamma_id: string | null;
  gamma_url: string | null;
  /** Il nostro file, non quello di Gamma. */
  stored_path: string | null;
  mime: string | null;
  pages: number | null;
  credits_used: number | null;
  error: string | null;
  attempts: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

let client: SupabaseClient | null = null;

function db(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!client) {
    client = createClient(env.supabaseUrl!, env.supabaseServiceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

const globalStore = globalThis as unknown as { __tvDocs?: Map<string, DocumentJob> };

function memory(): Map<string, DocumentJob> {
  if (!globalStore.__tvDocs) globalStore.__tvDocs = new Map();
  return globalStore.__tvDocs;
}

const TABLE = "documents";

export async function createJob(
  input: Pick<DocumentJob, "format" | "title" | "request" | "theme_id" | "run_id" | "created_by">,
): Promise<DocumentJob> {
  const now = new Date().toISOString();
  const job: DocumentJob = {
    id: crypto.randomUUID(),
    status: "pending",
    generation_id: null,
    gamma_id: null,
    gamma_url: null,
    stored_path: null,
    mime: null,
    pages: null,
    credits_used: null,
    error: null,
    attempts: 0,
    created_at: now,
    updated_at: now,
    ...input,
  };

  const supabase = db();
  if (!supabase) {
    memory().set(job.id, job);
    return job;
  }

  const { data, error } = await supabase.from(TABLE).insert(job).select().single();
  if (error) throw new Error(`Non riesco a registrare la generazione: ${error.message}`);
  return data as DocumentJob;
}

export async function updateJob(id: string, patch: Partial<DocumentJob>): Promise<void> {
  const merged = { ...patch, updated_at: new Date().toISOString() };

  const supabase = db();
  if (!supabase) {
    const job = memory().get(id);
    if (job) memory().set(id, { ...job, ...merged });
    return;
  }

  const { error } = await supabase.from(TABLE).update(merged).eq("id", id);
  if (error) console.error("[db-documents] update", error.message);
}

export async function getJob(id: string): Promise<DocumentJob | null> {
  const supabase = db();
  if (!supabase) return memory().get(id) ?? null;

  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[db-documents] get", error.message);
    return null;
  }
  return (data as DocumentJob) ?? null;
}

/** I lavori ancora aperti: quelli che il drain deve interrogare. */
export async function openJobs(limit = 10): Promise<DocumentJob[]> {
  const open: DocStatus[] = ["pending", "generating", "exporting"];

  const supabase = db();
  if (!supabase) {
    return [...memory().values()]
      .filter((j) => open.includes(j.status))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limit);
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .in("status", open)
    .order("created_at")
    .limit(limit);

  if (error) {
    console.error("[db-documents] open", error.message);
    return [];
  }
  return data as DocumentJob[];
}

/** Quante generazioni sono in volo adesso. Serve al limite di concorrenza. */
export async function inFlightCount(): Promise<number> {
  const busy: DocStatus[] = ["pending", "generating", "exporting"];

  const supabase = db();
  if (!supabase) return [...memory().values()].filter((j) => busy.includes(j.status)).length;

  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .in("status", busy);

  if (error) {
    console.error("[db-documents] inFlight", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Quante ne sono state avviate nelle ultime 24 ore. Serve al tetto giornaliero. */
export async function startedLastDay(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const supabase = db();
  if (!supabase) return [...memory().values()].filter((j) => j.created_at >= since).length;

  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  if (error) {
    console.error("[db-documents] daily", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Svuota lo store in memoria. Serve ai test. */
export function resetDocumentStore(): void {
  memory().clear();
}
