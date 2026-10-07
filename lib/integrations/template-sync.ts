import { listTemplateSpecs, readTemplateSpec, writeTemplateSpecs } from "../db-templates";
import { recordTemplateSync, upsertTemplates } from "../db";
import { fixtureSpec } from "../render/fixture";
import type { TemplateChange, TemplateSync } from "../types";
import { figmaConfigured, figmaFileUrl, readFigmaLibrary } from "./figma";
import type { AssetFormat, TemplateSpec } from "./types";

/**
 * La sincronizzazione in due passi.
 *
 * Prima si legge la libreria e la si confronta con la cache: cosa e' nuovo,
 * cosa e' cambiato, cosa non c'e' piu'. Niente viene scritto. Poi chi ha
 * guardato decide cosa rendere disponibile al team, e solo quello entra
 * nella cache, con una riga nello storico. Le esecuzioni gia' fatte tengono
 * il template com'era: la cache tiene l'ultima versione, l'asset la sua.
 *
 * Senza FIGMA_TOKEN la libreria e' quella di prova: due template come nel
 * seme, uno dei quali ritoccato, piu' uno nuovo. Cosi' il flusso si prova
 * end-to-end prima che esista una credenziale.
 */

export interface LibrarySource {
  name: string;
  url: string | null;
  /** Vero quando la libreria e' quella di prova, non Figma. */
  mock: boolean;
  lastModified: string | null;
}

/* ------------------------------------------------------------------ */
/* La libreria di prova                                                 */
/* ------------------------------------------------------------------ */

const MOCK_BASELINE_AT = "2026-09-04T10:00:00Z";
const MOCK_UPDATED_AT = "2026-10-01T09:30:00Z";

function withName(spec: TemplateSpec, id: string, name: string, updatedAt: string): TemplateSpec {
  return { ...spec, id, name, updatedAt };
}

/** I due template del seme, com'erano all'ultima sincronizzazione. */
function mockBaseline(): TemplateSpec[] {
  const base = fixtureSpec();
  return [withName(base, "1:2", "Bando con countdown", MOCK_BASELINE_AT), withName(base, "1:3", "Corso e academy", MOCK_BASELINE_AT)];
}

/** La libreria di prova «di oggi»: il bando ritoccato, l'academy uguale, un template nuovo. */
function mockLibrary(): { file: { name: string; lastModified: string }; specs: TemplateSpec[] } {
  const base = fixtureSpec();
  const bando = withName(base, "1:2", "Bando con countdown", MOCK_UPDATED_AT);
  // Il titolo del poster scende di due punti: e' la modifica che il diff deve vedere.
  const poster = bando.frames["poster-a4"];
  bando.frames = {
    ...bando.frames,
    "poster-a4": { ...poster, slots: poster.slots.map((s) => (s.role === "headline" ? { ...s, fontSize: s.fontSize - 2 } : s)) },
  };
  const academy = withName(base, "1:3", "Corso e academy", MOCK_BASELINE_AT);
  const evento = withName(base, "1:4", "Evento e webinar", MOCK_UPDATED_AT);
  return { file: { name: "Time Vision Brand 2026 (libreria di prova)", lastModified: MOCK_UPDATED_AT }, specs: [bando, academy, evento] };
}

/* ------------------------------------------------------------------ */
/* Lettura e confronto                                                  */
/* ------------------------------------------------------------------ */

export async function readLibrary(): Promise<{ source: LibrarySource; specs: TemplateSpec[] }> {
  if (figmaConfigured()) {
    const { file, specs } = await readFigmaLibrary();
    return { source: { name: file.name, url: figmaFileUrl(), mock: false, lastModified: file.lastModified }, specs };
  }

  // Senza una cache, la libreria di prova parte dai due template del seme:
  // cosi' il primo confronto mostra una modifica e una novita', non tre novita'.
  if ((await listTemplateSpecs()).length === 0) await writeTemplateSpecs(mockBaseline());

  const { file, specs } = mockLibrary();
  return { source: { name: file.name, url: null, mock: true, lastModified: file.lastModified }, specs };
}

/** Quali formati di un template sono cambiati rispetto alla cache. */
function changedFormats(incoming: TemplateSpec, cached: TemplateSpec): AssetFormat[] {
  const formats = new Set<AssetFormat>([...incoming.formats, ...cached.formats]);
  return [...formats].filter((f) => JSON.stringify(incoming.frames[f] ?? null) !== JSON.stringify(cached.frames[f] ?? null));
}

export async function diffLibrary(): Promise<{ source: LibrarySource; changes: TemplateChange[]; at: string }> {
  const { source, specs } = await readLibrary();
  const cached = await listTemplateSpecs();
  const changes: TemplateChange[] = [];

  for (const spec of specs) {
    const known = cached.find((c) => c.id === spec.id);
    if (!known) {
      changes.push({ id: spec.id, name: spec.name, kind: "new", description: `Template nuovo con ${spec.formats.length} ${spec.formats.length === 1 ? "formato" : "formati"}: ${spec.formats.join(", ")}.`, formats: spec.formats });
      continue;
    }
    const full = await readTemplateSpec(spec.id);
    const formats = full ? changedFormats(spec, full) : spec.formats;
    const renamed = full && full.name !== spec.name;
    if (formats.length === 0 && !renamed) continue;
    const parts: string[] = [];
    if (renamed) parts.push(`si chiamava «${full!.name}»`);
    if (formats.length > 0) parts.push(`${formats.length === 1 ? "frame cambiato" : "frame cambiati"}: ${formats.join(", ")}`);
    changes.push({ id: spec.id, name: spec.name, kind: "modified", description: `${parts.join(" · ")}.`, formats: spec.formats });
  }

  for (const known of cached) {
    if (!specs.some((s) => s.id === known.id)) {
      changes.push({ id: known.id, name: known.name, kind: "removed", description: "Non e' piu' nella libreria. Resta disponibile alle esecuzioni gia' fatte.", formats: known.formats });
    }
  }

  return { source, changes, at: new Date().toISOString() };
}

/* ------------------------------------------------------------------ */
/* Scrittura                                                            */
/* ------------------------------------------------------------------ */

export async function applyLibrary(accept: string[], by: string): Promise<{ sync: TemplateSync; written: number }> {
  const { source, specs } = await readLibrary();
  const { changes } = await diffLibrary();
  const accepted = changes.filter((c) => accept.includes(c.id));
  const toWrite = specs.filter((s) => accepted.some((c) => c.id === s.id && c.kind !== "removed"));

  if (toWrite.length > 0) {
    await writeTemplateSpecs(toWrite);
    // La riga che la console legge: nome, formati, quando.
    await upsertTemplates(
      toWrite.map((s) => ({
        figma_node_id: s.id,
        name: s.name,
        description: null,
        frame_count: s.formats.length,
        thumbnail_url: null,
        formats: s.formats,
        synced_at: new Date().toISOString(),
      })),
    );
  }

  const counts = { new: 0, modified: 0, removed: 0 };
  for (const c of accepted) counts[c.kind] += 1;
  const summary =
    accepted.length === 0
      ? "Nessuna modifica accettata."
      : [counts.new > 0 ? `${counts.new} ${counts.new === 1 ? "nuovo" : "nuovi"}` : null, counts.modified > 0 ? `${counts.modified} ${counts.modified === 1 ? "aggiornato" : "aggiornati"}` : null, counts.removed > 0 ? `${counts.removed} ${counts.removed === 1 ? "tolto" : "tolti"}` : null]
          .filter(Boolean)
          .join(", ") + (source.mock ? " (libreria di prova)" : "");

  const sync = await recordTemplateSync({ by, summary, changes: accepted });
  return { sync, written: toWrite.length };
}
