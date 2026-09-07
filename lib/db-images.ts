import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "./env";

/**
 * Provenienza dei visual generati.
 *
 * Un asset registra da quale template, brief e documenti nasce. Un visual
 * generato non fa eccezione: la richiesta che l'ha prodotto, il prompt
 * completo davvero inviato e i crediti spesi. Senza, fra sei mesi nessuno sa
 * piu' se quell'immagine e' una fotografia o un render.
 */

export interface ImageRow {
  id: string;
  stored_path: string;
  prompt: string;
  /** Il prompt completo, vincoli di brand compresi. E' quello che ha generato. */
  full_prompt: string;
  style: string;
  purpose: string;
  width: number;
  height: number;
  /** Sempre null da quando il motore e' gratuito. Resta per le righe vecchie. */
  credits_used: number | null;
  /** Il modello che ha prodotto l'immagine. */
  model?: string | null;
  /** Il seme: senza, una variante riuscita non si sa piu' rifare. */
  seed?: number | null;
  /**
   * Vero quando qualcuno ha tenuto il visual. Generare non e' archiviare:
   * la riga si scrive sempre, ma solo le salvate tornano nell'archivio.
   */
  saved: boolean;
  created_at: string;
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

const globalStore = globalThis as unknown as { __tvImages?: ImageRow[] };

function memory(): ImageRow[] {
  if (!globalStore.__tvImages) globalStore.__tvImages = [];
  return globalStore.__tvImages;
}

const TABLE = "generated_images";

export async function recordImage(row: Omit<ImageRow, "created_at">): Promise<void> {
  const full: ImageRow = { ...row, created_at: new Date().toISOString() };

  const supabase = db();
  if (!supabase) {
    memory().unshift(full);
    return;
  }

  const { error } = await supabase.from(TABLE).insert(full);
  if (error) console.error("[db-images] record", error.message);
}

/**
 * Tiene, o toglie, un visual dall'archivio. Restituisce falso se la riga
 * non esiste: chi chiama deve poterlo dire, invece di fingere un salvataggio.
 */
export async function markImageSaved(id: string, saved: boolean): Promise<boolean> {
  const supabase = db();
  if (!supabase) {
    const row = memory().find((r) => r.id === id);
    if (!row) return false;
    row.saved = saved;
    return true;
  }

  const { data, error } = await supabase.from(TABLE).update({ saved }).eq("id", id).select("id");
  if (error) {
    console.error("[db-images] save", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/** Quante generazioni nelle ultime 24 ore, salvate o no: il freno conta i tentativi. */
export async function countImagesLastDay(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const supabase = db();
  if (!supabase) return memory().filter((r) => r.created_at >= since).length;

  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  if (error) {
    console.error("[db-images] count", error.message);
    return 0;
  }
  return count ?? 0;
}

/** I visual tenuti in archivio, dal piu' recente. Le generazioni non salvate non ci sono. */
export async function listRecentImages(limit = 12): Promise<ImageRow[]> {
  const supabase = db();
  if (!supabase) return memory().filter((r) => r.saved).slice(0, limit);

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("saved", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[db-images] list", error.message);
    return [];
  }
  return data as ImageRow[];
}

/** Svuota lo store in memoria. Serve ai test. */
export function resetImageStore(): void {
  memory().length = 0;
}
