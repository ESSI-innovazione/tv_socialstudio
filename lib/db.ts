import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "./env";
import type { FormatId } from "./brand";
import type {
  Approval,
  Asset,
  Campaign,
  Profile,
  ProfileEvent,
  Role,
  Run,
  RunState,
  ScheduledPost,
  Template,
  Tool,
  ToolSnapshot,
  ToolVersion,
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
  profileEvents: ProfileEvent[];
  campaigns: Campaign[];
  tools: Tool[];
  toolVersions: ToolVersion[];
  templates: Template[];
  runs: Run[];
  approvals: Approval[];
  posts: ScheduledPost[];
}

// Il modulo puo' essere rivalutato tra richieste: teniamo lo store sul globale.
const globalStore = globalThis as unknown as { __tvStore?: MemoryStore; __tvStoreVersion?: number };

/**
 * La forma del seme. Quando cambia (una colonna nuova negli strumenti, una
 * tabella in piu') lo store in memoria si rifa' da capo invece di servire
 * righe vecchie a codice nuovo: in sviluppo il processo sopravvive ai
 * salvataggi, e uno store stantio e' un errore difficile da riconoscere.
 */
const SEED_VERSION = 4;

function memory(): MemoryStore {
  if (!globalStore.__tvStore || globalStore.__tvStoreVersion !== SEED_VERSION) {
    globalStore.__tvStore = structuredClone(MEMORY_SEED);
    globalStore.__tvStoreVersion = SEED_VERSION;
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

/** Tutto il team, in ordine alfabetico di email. */
export async function listProfiles(): Promise<Profile[]> {
  const supabase = db();
  if (!supabase) return [...memory().profiles].sort((a, b) => a.email.localeCompare(b.email));

  const { data, error } = await supabase.from("profiles").select("*").order("email");
  if (error) {
    console.error("[db] listProfiles", error.message);
    return [...memory().profiles];
  }
  return data as Profile[];
}

/** Un collega nuovo. Con un profilo puo' entrare con Google da subito. */
export async function createProfile(input: {
  email: string;
  name: string | null;
  role: Role;
  is_admin?: boolean;
  invited_by?: string | null;
}): Promise<Profile> {
  const row: Profile = {
    id: crypto.randomUUID(),
    email: input.email,
    name: input.name,
    role: input.role,
    is_admin: input.is_admin ?? false,
    invited_by: input.invited_by ?? null,
    invited_at: input.invited_by ? new Date().toISOString() : null,
    last_seen_at: null,
    active: true,
    created_at: new Date().toISOString(),
  };

  const supabase = db();
  if (!supabase) {
    memory().profiles.push(row);
    return row;
  }

  const { data, error } = await supabase.from("profiles").insert(row).select().single();
  if (error) throw new Error(`Non riesco a creare il profilo: ${error.message}`);
  return data as Profile;
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = db();
  if (!supabase) return memory().profiles.find((p) => p.id === id) ?? null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[db] getProfileById", error.message);
    return null;
  }
  return (data as Profile) ?? null;
}

/** L'ultimo accesso. Lo chiama la sessione, al piu' una volta l'ora. */
export async function touchProfileSeen(id: string): Promise<void> {
  const at = new Date().toISOString();
  const supabase = db();
  if (!supabase) {
    const row = memory().profiles.find((p) => p.id === id);
    if (row) row.last_seen_at = at;
    return;
  }
  const { error } = await supabase.from("profiles").update({ last_seen_at: at }).eq("id", id);
  if (error) console.error("[db] touchProfileSeen", error.message);
}

/** Ogni cambio di ruolo, spunta o accesso resta scritto: chi, quando, da cosa a cosa. */
export async function logProfileEvent(input: Omit<ProfileEvent, "id" | "at">): Promise<ProfileEvent> {
  const row: ProfileEvent = { id: crypto.randomUUID(), at: new Date().toISOString(), ...input };
  const supabase = db();
  if (!supabase) {
    memory().profileEvents.push(row);
    return row;
  }
  const { error } = await supabase.from("profile_events").insert(row);
  if (error) console.error("[db] logProfileEvent", error.message);
  return row;
}

export async function listProfileEvents(limit = 50): Promise<ProfileEvent[]> {
  const supabase = db();
  if (!supabase) return [...memory().profileEvents].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);

  const { data, error } = await supabase.from("profile_events").select("*").order("at", { ascending: false }).limit(limit);
  if (error) {
    console.error("[db] listProfileEvents", error.message);
    return [];
  }
  return data as ProfileEvent[];
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, "role" | "name" | "is_admin" | "active" | "invited_at">>,
): Promise<Profile | null> {
  const supabase = db();
  if (!supabase) {
    const row = memory().profiles.find((p) => p.id === id);
    if (row) Object.assign(row, patch);
    return row ?? null;
  }

  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select().maybeSingle();
  if (error) {
    console.error("[db] updateProfile", error.message);
    return null;
  }
  return (data as Profile) ?? null;
}

/* ------------------------------------------------------------------ */
/* Strumenti, campagne, template                                        */
/* ------------------------------------------------------------------ */

/** Modifica uno strumento salvato: titolo, descrizione, istruzione, formati. */
export async function updateTool(
  id: string,
  patch: Partial<Omit<Tool, "id" | "slug" | "run_count" | "automatic">>,
): Promise<Tool | null> {
  const supabase = db();
  if (!supabase) {
    const row = memory().tools.find((t) => t.id === id);
    if (row) Object.assign(row, patch);
    return row ?? null;
  }

  const { data, error } = await supabase
    .from("tools")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[db] updateTool", error.message);
    return null;
  }
  return data ? normalizeTool(data as Tool) : null;
}

/**
 * Una riga della tabella tools com'era prima della migrazione 012 non ha i
 * campi del modulo: qui prende i valori di partenza, cosi' la console non
 * cade se la migrazione non e' ancora passata.
 */
function normalizeTool(row: Partial<Tool> & Pick<Tool, "id" | "slug" | "title" | "description" | "prompt_template">): Tool {
  return {
    ...row,
    fields: Array.isArray(row.fields) ? row.fields : [],
    cta_label: row.cta_label ?? null,
    cover_image: row.cover_image ?? null,
    category: row.category ?? null,
    estimated_minutes: row.estimated_minutes ?? null,
    default_template: row.default_template ?? null,
    default_variants: row.default_variants ?? 3,
    published_version: row.published_version ?? 1,
    default_formats: row.default_formats ?? [],
    run_count: row.run_count ?? 0,
    note: row.note ?? null,
    automatic: row.automatic ?? false,
    position: row.position ?? 0,
  };
}

export async function getTools(): Promise<Tool[]> {
  const supabase = db();
  if (!supabase) return memory().tools.map(normalizeTool).sort((a, b) => a.position - b.position);

  const { data, error } = await supabase.from("tools").select("*").order("position");
  if (error || !data?.length) {
    if (error) console.error("[db] getTools", error.message);
    return memory().tools.map(normalizeTool).sort((a, b) => a.position - b.position);
  }
  return (data as Tool[]).map(normalizeTool);
}

export async function getToolBySlug(slug: string): Promise<Tool | null> {
  const tools = await getTools();
  return tools.find((t) => t.slug === slug) ?? null;
}

/* ------------------------------------------------------------------ */
/* Versioni degli strumenti                                             */
/* ------------------------------------------------------------------ */

/** Cio' che di uno strumento si versiona: quello che il team vede e usa. */
export function snapshotOf(tool: Tool | ToolSnapshot): ToolSnapshot {
  return {
    title: tool.title,
    description: tool.description,
    prompt_template: tool.prompt_template,
    fields: tool.fields,
    cta_label: tool.cta_label,
    default_formats: tool.default_formats,
    category: tool.category,
    estimated_minutes: tool.estimated_minutes,
    cover_image: tool.cover_image,
    default_template: tool.default_template,
    default_variants: tool.default_variants,
  };
}

/** Le versioni di uno strumento, dalla piu' recente. La bozza, se c'e', e' la prima. */
export async function listToolVersions(toolId: string): Promise<ToolVersion[]> {
  const supabase = db();
  if (!supabase) return memory().toolVersions.filter((v) => v.tool_id === toolId).sort((a, b) => b.version - a.version);

  const { data, error } = await supabase.from("tool_versions").select("*").eq("tool_id", toolId).order("version", { ascending: false });
  if (error) {
    console.error("[db] listToolVersions", error.message);
    return [];
  }
  return data as ToolVersion[];
}

export async function getToolVersion(id: string): Promise<ToolVersion | null> {
  const supabase = db();
  if (!supabase) return memory().toolVersions.find((v) => v.id === id) ?? null;

  const { data, error } = await supabase.from("tool_versions").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[db] getToolVersion", error.message);
    return null;
  }
  return (data as ToolVersion) ?? null;
}

/**
 * Salva la bozza di uno strumento. Ce n'e' una sola per strumento: se
 * esiste si aggiorna, se no nasce col numero successivo all'ultima
 * versione. Il team continua a vedere la versione pubblicata.
 */
export async function saveToolDraft(toolId: string, snapshot: ToolSnapshot, by: string): Promise<ToolVersion> {
  const [versions, tools] = await Promise.all([listToolVersions(toolId), getTools()]);
  const draft = versions.find((v) => v.published_at === null);
  // Il seme nasce come v1 senza una riga in tool_versions: la prima bozza e' la v2.
  const current = tools.find((t) => t.id === toolId)?.published_version ?? 0;
  const next = Math.max(versions[0]?.version ?? 0, current) + 1;

  const supabase = db();
  if (!supabase) {
    if (draft) {
      draft.snapshot = snapshot;
      draft.created_by = by;
      return draft;
    }
    const row: ToolVersion = { id: crypto.randomUUID(), tool_id: toolId, version: next, snapshot, created_by: by, created_at: new Date().toISOString(), published_at: null };
    memory().toolVersions.push(row);
    return row;
  }

  if (draft) {
    const { data, error } = await supabase.from("tool_versions").update({ snapshot, created_by: by }).eq("id", draft.id).select().single();
    if (error) throw new Error(`Non riesco a salvare la bozza: ${error.message}`);
    return data as ToolVersion;
  }
  const { data, error } = await supabase.from("tool_versions").insert({ tool_id: toolId, version: next, snapshot, created_by: by }).select().single();
  if (error) throw new Error(`Non riesco a salvare la bozza: ${error.message}`);
  return data as ToolVersion;
}

/**
 * Pubblica una versione: la bozza diventa quello che il team usa. Una
 * versione vecchia si ripristina prima come bozza e poi si pubblica, cosi'
 * ogni pubblicazione e' una riga nuova e la storia resta lineare.
 */
export async function publishToolVersion(toolId: string, versionId: string): Promise<Tool | null> {
  const version = await getToolVersion(versionId);
  if (!version || version.tool_id !== toolId) return null;
  const now = new Date().toISOString();

  const supabase = db();
  if (!supabase) {
    version.published_at = now;
    const tool = memory().tools.find((t) => t.id === toolId);
    if (!tool) return null;
    Object.assign(tool, version.snapshot, { published_version: version.version });
    return normalizeTool(tool);
  }

  const { error: mark } = await supabase.from("tool_versions").update({ published_at: now }).eq("id", versionId);
  if (mark) throw new Error(`Non riesco a pubblicare: ${mark.message}`);
  return updateTool(toolId, { ...version.snapshot, published_version: version.version });
}

/** Uno strumento nuovo, vuoto: parte come bozza da scrivere. */
export async function createTool(input: { slug: string; title: string; category: Tool["category"] }): Promise<Tool> {
  const tools = await getTools();
  const row: Tool = normalizeTool({
    id: crypto.randomUUID(),
    slug: input.slug,
    title: input.title,
    description: "Descrivi in una riga cosa produce questo strumento.",
    prompt_template: "Scrivi qui l'istruzione, con i segnaposto fra doppie graffe come {{argomento}}.",
    fields: [{ key: "argomento", label: "L'argomento", type: "text", required: true, example: "" }],
    cta_label: "Crea",
    category: input.category,
    default_formats: ["linkedin"],
    position: (tools.at(-1)?.position ?? 0) + 1,
    published_version: 0,
  });

  const supabase = db();
  if (!supabase) {
    memory().tools.push(row);
    return row;
  }
  const { data, error } = await supabase.from("tools").insert(row).select().single();
  if (error) throw new Error(`Non riesco a creare lo strumento: ${error.message}`);
  return normalizeTool(data as Tool);
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

/**
 * L'esecuzione piu' recente di una persona, quella che la console le
 * ripristina al refresh. Il lavoro e' per utente: la console di Giulia non
 * riapre il poster di Marco.
 */
export async function getLatestRun(email: string): Promise<Run | null> {
  const supabase = db();
  if (!supabase) return memory().runs.find((r) => r.created_by === email) ?? null;

  const { data, error } = await supabase
    .from("runs")
    .select("*, assets(*)")
    .eq("created_by", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[db] getLatestRun", error.message);
    return memory().runs.find((r) => r.created_by === email) ?? null;
  }
  if (!data) return null;

  const { assets, ...run } = data as Run & { assets: Asset[] };
  return { ...run, assets: assets ?? [] };
}

/** Le esecuzioni di una persona, dalla piu' recente. */
export async function listRuns(email: string, limit = 5): Promise<Run[]> {
  const supabase = db();
  if (!supabase) return memory().runs.filter((r) => r.created_by === email).slice(0, limit);

  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .eq("created_by", email)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[db] listRuns", error.message);
    return memory().runs.filter((r) => r.created_by === email).slice(0, limit);
  }
  return (data as Run[]).map((r) => ({ ...r, assets: [] }));
}

/**
 * Le esecuzioni di certe campagne, di tutto il team, dalla piu' recente.
 * Serve alla home per le scadenze dei bandi: una data entra solo se
 * un'esecuzione l'ha letta da una fonte.
 */
export async function listCampaignRuns(campaignIds: string[], limit = 50): Promise<Run[]> {
  if (campaignIds.length === 0) return [];
  const supabase = db();
  if (!supabase) {
    return memory()
      .runs.filter((r) => r.campaign_id !== null && campaignIds.includes(r.campaign_id))
      .slice(0, limit);
  }

  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .in("campaign_id", campaignIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[db] listCampaignRuns", error.message);
    return [];
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sostituisce gli asset di un'esecuzione con quelli definitivi.
 *
 * Il driver dell'esecuzione battezza gli asset con un id leggibile
 * (`run-v0-linkedin`); il database vuole UUID. Qui ogni asset che non ne ha
 * uno lo riceve, e la console riprende quelli salvati.
 */
export async function replaceAssets(runId: string, rows: Asset[]): Promise<Asset[]> {
  const normalized: Asset[] = rows.map((a) => ({
    ...a,
    id: UUID.test(a.id) ? a.id : crypto.randomUUID(),
    run_id: runId,
  }));

  const supabase = db();
  if (!supabase) {
    const run = memory().runs.find((r) => r.id === runId);
    if (run) run.assets = normalized;
    return normalized;
  }

  const { error: wipe } = await supabase.from("assets").delete().eq("run_id", runId);
  if (wipe) console.error("[db] replaceAssets delete", wipe.message);

  if (normalized.length === 0) return [];
  const { data, error } = await supabase.from("assets").insert(normalized).select();
  if (error) {
    console.error("[db] replaceAssets insert", error.message);
    return normalized;
  }
  return data as Asset[];
}

/** Aggiorna un asset: l'esito del brand-guard, l'impaginazione controllata. */
export async function updateAsset(id: string, patch: Partial<Asset>): Promise<Asset | null> {
  const supabase = db();
  if (!supabase) {
    for (const run of memory().runs) {
      const hit = run.assets.find((a) => a.id === id);
      if (hit) {
        Object.assign(hit, patch);
        return hit;
      }
    }
    return null;
  }

  const { data, error } = await supabase.from("assets").update(patch).eq("id", id).select().maybeSingle();
  if (error) {
    console.error("[db] updateAsset", error.message);
    return null;
  }
  return (data as Asset) ?? null;
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

export async function getApproval(id: string): Promise<Approval | null> {
  const supabase = db();
  if (!supabase) return memory().approvals.find((a) => a.id === id) ?? null;

  const { data, error } = await supabase.from("approvals").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[db] getApproval", error.message);
    return null;
  }
  return (data as Approval) ?? null;
}

/** Le richieste in un certo stato. Le pendenti dalla piu' vecchia: e' la coda degli approvatori. */
export async function listApprovals(status: Approval["status"], limit = 100): Promise<Approval[]> {
  const supabase = db();
  if (!supabase) {
    const rows = memory().approvals.filter((a) => a.status === status);
    rows.sort((a, b) => (status === "pending" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)));
    return rows.slice(0, limit);
  }

  const { data, error } = await supabase
    .from("approvals")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(limit);

  if (error) {
    console.error("[db] listApprovals", error.message);
    return memory().approvals.filter((a) => a.status === status).slice(0, limit);
  }
  return data as Approval[];
}

export interface NewApproval {
  run_id: string;
  variant_index: number;
  requested_by: string;
  note: string | null;
}

/** Una richiesta di approvazione. Il nome dell'approvatore si riempie alla decisione. */
export async function createApproval(input: NewApproval): Promise<Approval> {
  const row: Approval = {
    id: crypto.randomUUID(),
    run_id: input.run_id,
    variant_index: input.variant_index,
    requested_by: input.requested_by,
    note: input.note,
    approver_name: "Approvatori",
    approver_email: null,
    status: "pending",
    comment: null,
    decided_at: null,
    created_at: new Date().toISOString(),
  };

  const supabase = db();
  if (!supabase) {
    memory().approvals.push(row);
    return row;
  }

  const { data, error } = await supabase.from("approvals").insert(row).select().single();
  if (error) {
    console.error("[db] createApproval", error.message);
    memory().approvals.push(row);
    return row;
  }
  return data as Approval;
}

export async function decideApproval(
  id: string,
  status: "approved" | "rejected",
  approver: { email: string; name: string },
  comment: string | null = null,
): Promise<Approval | null> {
  const patch = {
    status,
    decided_at: new Date().toISOString(),
    approver_email: approver.email,
    approver_name: approver.name,
    comment,
  };

  const supabase = db();
  if (!supabase) {
    const row = memory().approvals.find((a) => a.id === id);
    if (row) Object.assign(row, patch);
    return row ?? null;
  }

  const { data, error } = await supabase.from("approvals").update(patch).eq("id", id).select().maybeSingle();
  if (error) {
    console.error("[db] decideApproval", error.message);
    return null;
  }
  return (data as Approval) ?? null;
}

/**
 * Segna approvati gli asset di una variante. E' la denormalizzazione che
 * permette all'archivio di chiedere «gli asset approvati» con una query
 * sola; con `null` li riporta a non approvati, se la decisione cambia.
 */
export async function markAssetsApproved(
  runId: string,
  variantIndex: number,
  approval: { id: string; email: string } | null,
): Promise<Asset[]> {
  const patch = approval
    ? { approval_id: approval.id, approved_by: approval.email, approved_at: new Date().toISOString() }
    : { approval_id: null, approved_by: null, approved_at: null };

  const supabase = db();
  if (!supabase) {
    const run = memory().runs.find((r) => r.id === runId);
    if (!run) return [];
    const hit = run.assets.filter((a) => a.variant_index === variantIndex);
    for (const a of hit) Object.assign(a, patch);
    return hit;
  }

  const { data, error } = await supabase
    .from("assets")
    .update(patch)
    .eq("run_id", runId)
    .eq("variant_index", variantIndex)
    .select();
  if (error) {
    console.error("[db] markAssetsApproved", error.message);
    return [];
  }
  return data as Asset[];
}

/** Chi puo' approvare: riceve le richieste via email. Gli admin approvano anche loro. */
export async function listApprovers(): Promise<Profile[]> {
  const approves = (p: Profile) => p.active !== false && (p.role === "approver" || p.is_admin);
  const supabase = db();
  if (!supabase) return memory().profiles.filter(approves);

  const { data, error } = await supabase.from("profiles").select("*").or("role.eq.approver,is_admin.eq.true");
  if (error) {
    console.error("[db] listApprovers", error.message);
    return [];
  }
  return (data as Profile[]).filter(approves);
}

/* ------------------------------------------------------------------ */
/* Archivio                                                             */
/* ------------------------------------------------------------------ */

/** Un asset approvato con l'esecuzione da cui nasce, per l'archivio condiviso. */
export interface ArchiveEntry {
  asset: Asset;
  run: Run;
}

/**
 * Tutti gli asset approvati del team, dal piu' recente. I filtri si applicano
 * dopo, in memoria: l'archivio di un team marketing si conta in centinaia di
 * righe, non in milioni, e un filtro solo serve a tutti e due gli store.
 */
export async function listApprovedAssets(limit = 500): Promise<ArchiveEntry[]> {
  const supabase = db();
  if (!supabase) {
    const out: ArchiveEntry[] = [];
    for (const run of memory().runs) {
      for (const asset of run.assets) if (asset.approved_at) out.push({ asset, run });
    }
    out.sort((a, b) => (b.asset.approved_at ?? "").localeCompare(a.asset.approved_at ?? ""));
    return out.slice(0, limit);
  }

  const { data, error } = await supabase
    .from("assets")
    .select("*, runs(*)")
    .not("approved_at", "is", null)
    .order("approved_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[db] listApprovedAssets", error.message);
    return [];
  }

  return (data as (Asset & { runs: Run | null })[]).flatMap(({ runs, ...asset }) =>
    runs ? [{ asset, run: { ...runs, assets: [] } }] : [],
  );
}

/**
 * Copia un'esecuzione conclusa in una nuova, della persona che la duplica:
 * stesso brief, stesso copy, stessi formati, asset nuovi, nessuna
 * approvazione. E' il «parti da questo» dell'archivio.
 */
export async function duplicateRun(source: Run, createdBy: string): Promise<Run> {
  const run = await createRun({
    campaign_id: source.campaign_id,
    tool_slug: source.tool_slug,
    instruction: source.instruction,
    attachments: source.attachments,
    formats: source.formats,
    variant_count: source.variant_count,
    template_id: source.template_id,
    created_by: createdBy,
  });

  await updateRun(run.id, {
    state: source.state === "results" ? "results" : source.state,
    steps: source.steps,
    logs: [],
    brief: source.brief,
    variants: source.variants,
    captions: source.captions,
    guard: source.guard,
    finished_at: new Date().toISOString(),
    duration_ms: source.duration_ms,
  });

  const assets: Asset[] = source.assets.map((a) => ({
    id: crypto.randomUUID(),
    run_id: run.id,
    variant_index: a.variant_index,
    format: a.format,
    render_url: `/api/render/${run.id}/${a.variant_index}/${a.format}`,
    width: a.width,
    height: a.height,
    template_id: a.template_id,
    source_documents: a.source_documents,
    // L'impaginazione si eredita; il verdetto e l'approvazione no: si ricontrolla.
    layout: a.layout ?? null,
    guard: null,
    guard_status: null,
    guard_checked_at: null,
    approval_id: null,
    approved_by: null,
    approved_at: null,
  }));
  await replaceAssets(run.id, assets);

  return (await getRun(run.id)) ?? { ...run, assets };
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
  patch: Partial<Pick<ScheduledPost, "status" | "published_at" | "external_id" | "error" | "attempts" | "claimed_at" | "scheduled_for">>,
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

export type NewPost = Pick<
  ScheduledPost,
  "run_id" | "channel" | "surface" | "caption" | "hashtags" | "asset_id" | "variant_index" | "status" | "scheduled_for" | "created_by"
>;

export async function createPost(input: NewPost): Promise<ScheduledPost> {
  const row: ScheduledPost = {
    id: crypto.randomUUID(),
    ...input,
    published_at: null,
    external_id: null,
    error: null,
    attempts: 0,
    claimed_at: null,
    created_at: new Date().toISOString(),
  };

  const supabase = db();
  if (!supabase) {
    memory().posts.push(row);
    return row;
  }

  const { data, error } = await supabase.from("scheduled_posts").insert(row).select().single();
  if (error) throw new Error(`Non riesco a registrare il post: ${error.message}`);
  return data as ScheduledPost;
}

export async function getPost(id: string): Promise<ScheduledPost | null> {
  const supabase = db();
  if (!supabase) return memory().posts.find((p) => p.id === id) ?? null;

  const { data, error } = await supabase.from("scheduled_posts").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[db] getPost", error.message);
    return null;
  }
  return (data as ScheduledPost) ?? null;
}

/** La data che conta per il calendario: quella di pubblicazione, o quella prevista. */
export function postDate(post: ScheduledPost): string {
  return post.published_at ?? post.scheduled_for ?? post.created_at;
}

/** I post di un intervallo, per il calendario. */
export async function listPostsBetween(from: Date, to: Date): Promise<ScheduledPost[]> {
  const inRange = (p: ScheduledPost) => {
    const t = new Date(postDate(p)).getTime();
    return t >= from.getTime() && t <= to.getTime();
  };

  const supabase = db();
  if (!supabase) return memory().posts.filter(inRange).sort((a, b) => postDate(a).localeCompare(postDate(b)));

  // Il filtro per data e' su due colonne alternative: si legge un po' piu'
  // largo e si stringe in memoria, che sono comunque poche righe al mese.
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .or(
      `and(scheduled_for.gte.${from.toISOString()},scheduled_for.lte.${to.toISOString()}),` +
        `and(published_at.gte.${from.toISOString()},published_at.lte.${to.toISOString()})`,
    )
    .limit(500);

  if (error) {
    console.error("[db] listPostsBetween", error.message);
    return [];
  }
  return (data as ScheduledPost[]).filter(inRange).sort((a, b) => postDate(a).localeCompare(postDate(b)));
}

export async function deletePost(id: string): Promise<void> {
  const supabase = db();
  if (!supabase) {
    const store = memory();
    store.posts = store.posts.filter((p) => p.id !== id);
    return;
  }

  const { error } = await supabase.from("scheduled_posts").delete().eq("id", id);
  if (error) console.error("[db] deletePost", error.message);
}

/**
 * Prende in carico un post da pubblicare. Torna la riga solo se nessun'altra
 * funzione la tiene: e' il lucchetto che impedisce a due esecuzioni del cron
 * di pubblicare lo stesso post due volte. Un claim piu' vecchio di `ttlMs`
 * e' di una funzione morta e si puo' riprendere.
 */
export async function claimPost(id: string, now: Date, ttlMs: number): Promise<ScheduledPost | null> {
  const stale = new Date(now.getTime() - ttlMs).toISOString();

  const supabase = db();
  if (!supabase) {
    const row = memory().posts.find((p) => p.id === id);
    if (!row || row.status !== "scheduled") return null;
    if (row.claimed_at && row.claimed_at > stale) return null;
    row.claimed_at = now.toISOString();
    return row;
  }

  const { data, error } = await supabase
    .from("scheduled_posts")
    .update({ claimed_at: now.toISOString() })
    .eq("id", id)
    .eq("status", "scheduled")
    .or(`claimed_at.is.null,claimed_at.lt.${stale}`)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[db] claimPost", error.message);
    return null;
  }
  return (data as ScheduledPost) ?? null;
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
