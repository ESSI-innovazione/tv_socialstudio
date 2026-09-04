import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "./env";
import type { AssetFormat, TemplateSpec } from "./integrations/types";

/**
 * Cache delle specifiche dei template.
 *
 * `sync()` scrive qui, `list()` e `get()` leggono solo da qui. La console
 * chiama `list()` a ogni caricamento di pagina: se ogni chiamata arrivasse a
 * Figma, il rate limit si esaurirebbe in mezza giornata di lavoro normale.
 *
 * Senza database la cache sta in memoria, cosi' il modulo resta provabile
 * prima che esista un progetto Supabase.
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

const globalStore = globalThis as unknown as { __tvSpecs?: Map<string, TemplateSpec> };

function memory(): Map<string, TemplateSpec> {
  if (!globalStore.__tvSpecs) globalStore.__tvSpecs = new Map();
  return globalStore.__tvSpecs;
}

export type TemplateSummary = Pick<TemplateSpec, "id" | "name" | "formats" | "updatedAt">;

export async function writeTemplateSpecs(
  specs: TemplateSpec[],
): Promise<{ added: number; updated: number }> {
  const supabase = db();

  if (!supabase) {
    const store = memory();
    let added = 0;
    let updated = 0;
    for (const spec of specs) {
      if (store.has(spec.id)) updated += 1;
      else added += 1;
      store.set(spec.id, spec);
    }
    return { added, updated };
  }

  const { data: existing, error: readError } = await supabase
    .from("templates")
    .select("figma_node_id")
    .in(
      "figma_node_id",
      specs.map((s) => s.id),
    );

  if (readError) console.error("[db-templates] read", readError.message);

  const known = new Set((existing ?? []).map((row) => row.figma_node_id as string));

  const rows = specs.map((spec) => ({
    figma_node_id: spec.id,
    name: spec.name,
    description: null,
    frame_count: spec.formats.length,
    formats: spec.formats,
    spec: spec as unknown as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("templates").upsert(rows, { onConflict: "figma_node_id" });
  if (error) throw new Error(`Scrittura dei template fallita: ${error.message}`);

  const updated = specs.filter((s) => known.has(s.id)).length;
  return { added: specs.length - updated, updated };
}

export async function listTemplateSpecs(): Promise<TemplateSummary[]> {
  const supabase = db();

  if (!supabase) {
    return [...memory().values()].map(({ id, name, formats, updatedAt }) => ({
      id,
      name,
      formats,
      updatedAt,
    }));
  }

  const { data, error } = await supabase
    .from("templates")
    .select("figma_node_id, name, formats, synced_at, spec")
    .not("spec", "is", null)
    .order("name");

  if (error) {
    console.error("[db-templates] list", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.figma_node_id as string,
    name: row.name as string,
    formats: (row.formats ?? []) as AssetFormat[],
    updatedAt:
      ((row.spec as { updatedAt?: string } | null)?.updatedAt ?? row.synced_at) as string,
  }));
}

export async function readTemplateSpec(id: string): Promise<TemplateSpec | null> {
  const supabase = db();
  if (!supabase) return memory().get(id) ?? null;

  const { data, error } = await supabase
    .from("templates")
    .select("spec")
    .eq("figma_node_id", id)
    .maybeSingle();

  if (error) {
    console.error("[db-templates] read", error.message);
    return null;
  }

  return (data?.spec as TemplateSpec | undefined) ?? null;
}

/** Svuota la cache in memoria. Serve ai test, non all'app. */
export function resetTemplateCache(): void {
  memory().clear();
}
