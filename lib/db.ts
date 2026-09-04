import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "./env";
import type { FormatId } from "./brand";
import type {
  Approval,
  Asset,
  Campaign,
  Profile,
  Run,
  RunState,
  ScheduledPost,
  Template,
  Tool,
} from "./types";
import { MEMORY_SEED } from "./seed-data";

/**
 * Accesso ai dati. Con Supabase configurato parla al database con la service
 * role key, sempre dal server. Senza, cade su uno store in memoria che tiene
 * in piedi l'app end-to-end prima che esista una credenziale.
 *
 * Lo store in memoria non sopravvive al riavvio del processo: e' un ponte
 * verso il database reale, non un sostituto.
 */

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

export const usingMemoryStore = !supabaseConfigured;

/* ------------------------------------------------------------------ */
/* Store in memoria                                                     */
/* ------------------------------------------------------------------ */

interface MemoryStore {
  profiles: Profile[];
  campaigns: Campaign[];
  tools: Tool[];
  templates: Template[];
  runs: Run[];
  approvals: Approval[];
  posts: ScheduledPost[];
}

// Il modulo puo' essere rivalutato tra richieste: teniamo lo store sul globale.
const globalStore = globalThis as unknown as { __tvStore?: MemoryStore };

function memory(): MemoryStore {
  if (!globalStore.__tvStore) {
    globalStore.__tvStore = structuredClone(MEMORY_SEED);
  }
  return globalStore.__tvStore;
}

/* ------------------------------------------------------------------ */
/* Profili                                                              */
/* ------------------------------------------------------------------ */

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const supabase = db();
  if (!supabase) {
    return memory().profiles.find((p) => p.email === email) ?? null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("[db] getProfileByEmail", error.message);
    return null;
  }
  return (data as Profile) ?? null;
}

/* ------------------------------------------------------------------ */
/* Strumenti, campagne, template                                        */
/* ------------------------------------------------------------------ */

export async function getTools(): Promise<Tool[]> {
  const supabase = db();
  if (!supabase) return [...memory().tools].sort((a, b) => a.position - b.position);

  const { data, error } = await supabase.from("tools").select("*").order("position");
  if (error || !data?.length) {
    if (error) console.error("[db] getTools", error.message);
    return [...memory().tools].sort((a, b) => a.position - b.position);
  }
  return data as Tool[];
}

export async function getToolBySlug(slug: string): Promise<Tool | null> {
  const tools = await getTools();
  return tools.find((t) => t.slug === slug) ?? null;
}

export async function getCampaigns(): Promise<Campaign[]> {
  const supabase = db();
  if (!supabase) return memory().campaigns;

  const { data, error } = await supabase.from("campaigns").select("*").order("created_at");
  if (error || !data?.length) {
    if (error) console.error("[db] getCampaigns", error.message);
    return memory().campaigns;
  }
  return data as Campaign[];
}

export async function getTemplates(): Promise<Template[]> {
  const supabase = db();
  if (!supabase) return memory().templates;

  const { data, error } = await supabase.from("templates").select("*").order("name");
  if (error || !data?.length) {
    if (error) console.error("[db] getTemplates", error.message);
    return memory().templates;
  }
  return data as Template[];
}

export async function upsertTemplates(rows: Omit<Template, "id">[]): Promise<Template[]> {
  const supabase = db();
  if (!supabase) {
    const store = memory();
    for (const row of rows) {
      const existing = store.templates.find((t) => t.figma_node_id === row.figma_node_id);
      if (existing) Object.assign(existing, row);
      else store.templates.push({ ...row, id: crypto.randomUUID() });
    }
    return store.templates;
  }

  const { data, error } = await supabase
    .from("templates")
    .upsert(rows, { onConflict: "figma_node_id" })
    .select();

  if (error) {
    console.error("[db] upsertTemplates", error.message);
    return getTemplates();
  }
  return data as Template[];
}

/* ------------------------------------------------------------------ */
/* Esecuzioni                                                           */
/* ------------------------------------------------------------------ */

export interface NewRun {
  campaign_id: string | null;
  tool_slug: string;
  instruction: string;
  attachments: Run["attachments"];
  formats: FormatId[];
  variant_count: number;
  template_id: string | null;
  created_by: string | null;
}

export async function createRun(input: NewRun): Promise<Run> {
  const row: Run = {
    id: crypto.randomUUID(),
    campaign_id: input.campaign_id,
    tool_slug: input.tool_slug,
    instruction: input.instruction,
    attachments: input.attachments,
    formats: input.formats,
    variant_count: input.variant_count,
    template_id: input.template_id,
    state: "running",
    steps: [],
    logs: [],
    brief: null,
    variants: [],
    captions: [],
    guard: [],
    assets: [],
    error: null,
    created_by: input.created_by,
    created_at: new Date().toISOString(),
    finished_at: null,
    duration_ms: null,
  };

  const supabase = db();
  if (!supabase) {
    memory().runs.unshift(row);
    return row;
  }

  const { assets: _assets, ...persisted } = row;
  const { data, error } = await supabase.from("runs").insert(persisted).select().single();
  if (error) {
    console.error("[db] createRun", error.message);
    memory().runs.unshift(row);
    return row;
  }
  return { ...(data as Run), assets: [] };
}

export async function updateRun(id: string, patch: Partial<Run>): Promise<void> {
  const supabase = db();
  if (!supabase) {
    const run = memory().runs.find((r) => r.id === id);
    if (run) Object.assign(run, patch);
    return;
  }

  const { assets: _assets, ...persisted } = patch;
  if (Object.keys(persisted).length === 0) return;

  const { error } = await supabase.from("runs").update(persisted).eq("id", id);
  if (error) console.error("[db] updateRun", error.message);
}

export async function getRun(id: string): Promise<Run | null> {
  const supabase = db();
  if (!supabase) return memory().runs.find((r) => r.id === id) ?? null;

  const { data, error } = await supabase
    .from("runs")
    .select("*, assets(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[db] getRun", error.message);
    return memory().runs.find((r) => r.id === id) ?? null;
  }
  if (!data) return null;

  const { assets, ...run } = data as Run & { assets: Asset[] };
  return { ...run, assets: assets ?? [] };
}

/** L'esecuzione piu' recente, quella che la console ripristina al refresh. */
export async function getLatestRun(): Promise<Run | null> {
  const supabase = db();
  if (!supabase) return memory().runs[0] ?? null;

  const { data, error } = await supabase
    .from("runs")
    .select("*, assets(*)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[db] getLatestRun", error.message);
    return memory().runs[0] ?? null;
  }
  if (!data) return null;

  const { assets, ...run } = data as Run & { assets: Asset[] };
  return { ...run, assets: assets ?? [] };
}

export async function listRuns(limit = 5): Promise<Run[]> {
  const supabase = db();
  if (!supabase) return memory().runs.slice(0, limit);

  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[db] listRuns", error.message);
    return memory().runs.slice(0, limit);
  }
  return (data as Run[]).map((r) => ({ ...r, assets: [] }));
}

export async function setRunState(id: string, state: RunState): Promise<void> {
  await updateRun(id, { state });
}

/* ------------------------------------------------------------------ */
/* Asset                                                                */
/* ------------------------------------------------------------------ */

export async function insertAssets(rows: Asset[]): Promise<void> {
  if (rows.length === 0) return;

  const supabase = db();
  if (!supabase) {
    const run = memory().runs.find((r) => r.id === rows[0].run_id);
    if (run) run.assets.push(...rows);
    return;
  }

  const { error } = await supabase.from("assets").insert(rows);
  if (error) console.error("[db] insertAssets", error.message);
}

export async function getAsset(id: string): Promise<Asset | null> {
  const supabase = db();
  if (!supabase) {
    for (const run of memory().runs) {
      const hit = run.assets.find((a) => a.id === id);
      if (hit) return hit;
    }
    return null;
  }

  const { data, error } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[db] getAsset", error.message);
    return null;
  }
  return (data as Asset) ?? null;
}

/* ------------------------------------------------------------------ */
/* Approvazioni                                                         */
/* ------------------------------------------------------------------ */

export async function getApprovals(runId: string): Promise<Approval[]> {
  const supabase = db();
  if (!supabase) return memory().approvals.filter((a) => a.run_id === runId);

  const { data, error } = await supabase
    .from("approvals")
    .select("*")
    .eq("run_id", runId)
    .order("created_at");

  if (error) {
    console.error("[db] getApprovals", error.message);
    return memory().approvals.filter((a) => a.run_id === runId);
  }
  return data as Approval[];
}

export async function seedApprovals(runId: string): Promise<Approval[]> {
  const rows: Approval[] = [
    {
      id: crypto.randomUUID(),
      run_id: runId,
      approver_name: "Ufficio legale",
      approver_email: null,
      status: "pending",
      decided_at: null,
    },
    {
      id: crypto.randomUUID(),
      run_id: runId,
      approver_name: "Direzione Marketing",
      approver_email: null,
      status: "pending",
      decided_at: null,
    },
  ];

  const supabase = db();
  if (!supabase) {
    memory().approvals.push(...rows);
    return rows;
  }

  const { data, error } = await supabase.from("approvals").insert(rows).select();
  if (error) {
    console.error("[db] seedApprovals", error.message);
    return rows;
  }
  return data as Approval[];
}

export async function decideApproval(
  id: string,
  status: "approved" | "rejected",
  email: string,
): Promise<void> {
  const patch = { status, decided_at: new Date().toISOString(), approver_email: email };

  const supabase = db();
  if (!supabase) {
    const row = memory().approvals.find((a) => a.id === id);
    if (row) Object.assign(row, patch);
    return;
  }

  const { error } = await supabase.from("approvals").update(patch).eq("id", id);
  if (error) console.error("[db] decideApproval", error.message);
}

/* ------------------------------------------------------------------ */
/* Coda di pubblicazione                                                */
/* ------------------------------------------------------------------ */

export async function getPosts(runId: string): Promise<ScheduledPost[]> {
  const supabase = db();
  if (!supabase) return memory().posts.filter((p) => p.run_id === runId);

  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("run_id", runId)
    .order("created_at");

  if (error) {
    console.error("[db] getPosts", error.message);
    return memory().posts.filter((p) => p.run_id === runId);
  }
  return data as ScheduledPost[];
}

export async function upsertPosts(rows: ScheduledPost[]): Promise<void> {
  if (rows.length === 0) return;

  const supabase = db();
  if (!supabase) {
    const store = memory();
    for (const row of rows) {
      const index = store.posts.findIndex((p) => p.id === row.id);
      if (index >= 0) store.posts[index] = row;
      else store.posts.push(row);
    }
    return;
  }

  const { error } = await supabase.from("scheduled_posts").upsert(rows);
  if (error) console.error("[db] upsertPosts", error.message);
}

/** I post maturi, che il cron deve pubblicare adesso. */
export async function getDuePosts(now = new Date()): Promise<ScheduledPost[]> {
  const supabase = db();
  if (!supabase) {
    return memory().posts.filter(
      (p) => p.status === "scheduled" && p.scheduled_for !== null && new Date(p.scheduled_for) <= now,
    );
  }

  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .limit(25);

  if (error) {
    console.error("[db] getDuePosts", error.message);
    return [];
  }
  return data as ScheduledPost[];
}

export async function markPost(
  id: string,
  patch: Partial<Pick<ScheduledPost, "status" | "published_at" | "external_id" | "error">>,
): Promise<void> {
  const supabase = db();
  if (!supabase) {
    const row = memory().posts.find((p) => p.id === id);
    if (row) Object.assign(row, patch);
    return;
  }

  const { error } = await supabase.from("scheduled_posts").update(patch).eq("id", id);
  if (error) console.error("[db] markPost", error.message);
}

/** Incrementa il contatore di esecuzioni di uno strumento. */
export async function bumpToolRunCount(slug: string): Promise<void> {
  const supabase = db();
  if (!supabase) {
    const tool = memory().tools.find((t) => t.slug === slug);
    if (tool) tool.run_count += 1;
    return;
  }

  const current = await getToolBySlug(slug);
  if (!current) return;

  const { error } = await supabase
    .from("tools")
    .update({ run_count: current.run_count + 1 })
    .eq("slug", slug);

  if (error) console.error("[db] bumpToolRunCount", error.message);
}
