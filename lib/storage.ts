import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "./env";

/**
 * Dove finiscono i file che scarichiamo.
 *
 * L'URL di export di Gamma scade in circa una settimana e non e' legato alla
 * nostra chiave: chiunque ce l'abbia scarica il file. Non e' un indirizzo da
 * salvare in database ne' da mostrare a qualcuno. Si scarica subito, si
 * archivia qui, e si restituisce il nostro.
 */

export interface StoredObject {
  /** Percorso interno, quello che finisce sulla riga del lavoro. */
  path: string;
  /** L'indirizzo che l'app mostra. */
  url: string;
  bytes: number;
}

export interface ObjectStore {
  kind: "supabase" | "memory";
  put(path: string, data: Uint8Array, contentType: string): Promise<StoredObject>;
  get(path: string): Promise<{ data: Uint8Array; contentType: string } | null>;
  urlFor(path: string): string;
}

const BUCKET = "documents";

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

/* ------------------------------------------------------------------ */

const supabaseStore: ObjectStore = {
  kind: "supabase",

  async put(path, data, contentType) {
    const supabase = db()!;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, data, { contentType, upsert: true });

    if (error) throw new Error(`Archiviazione fallita per ${path}: ${error.message}`);

    return { path, url: this.urlFor(path), bytes: data.byteLength };
  },

  async get(path) {
    const supabase = db()!;
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) return null;

    return {
      data: new Uint8Array(await data.arrayBuffer()),
      contentType: data.type || "application/octet-stream",
    };
  },

  urlFor(path) {
    // Serviamo sempre attraverso una nostra rotta, mai un indirizzo di terzi:
    // cosi' l'accesso resta dietro l'autenticazione dell'app.
    return `/api/documents/file/${encodeURIComponent(path)}`;
  },
};

/**
 * Ripiego senza Supabase: il file resta nel processo. Non sopravvive a un
 * riavvio, e su Vercel nemmeno alla richiesta successiva. Serve a provare il
 * modulo prima che esista un bucket, non a mandarlo in produzione.
 */
const globalStore = globalThis as unknown as {
  __tvFiles?: Map<string, { data: Uint8Array; contentType: string }>;
};

const memoryStore: ObjectStore = {
  kind: "memory",

  async put(path, data, contentType) {
    if (!globalStore.__tvFiles) globalStore.__tvFiles = new Map();
    globalStore.__tvFiles.set(path, { data, contentType });
    return { path, url: this.urlFor(path), bytes: data.byteLength };
  },

  async get(path) {
    return globalStore.__tvFiles?.get(path) ?? null;
  },

  urlFor(path) {
    return `/api/documents/file/${encodeURIComponent(path)}`;
  },
};

export function objectStore(): ObjectStore {
  return supabaseConfigured ? supabaseStore : memoryStore;
}

/** Il percorso di un documento archiviato. */
export function documentPath(jobId: string, extension: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `${day}/${jobId}.${extension}`;
}
