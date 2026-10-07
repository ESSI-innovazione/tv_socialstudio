import { FORMATS, type FormatId } from "./brand";
import { FIELD_TYPES, type ToolField } from "./tool-fields";
import type { ToolSnapshot } from "./types";

/**
 * Lettura difensiva di una versione di strumento arrivata dal client.
 * Quello che non ha la forma giusta viene scartato o riportato a un valore
 * sicuro: una bozza mal formata non deve poter rompere il modulo del team.
 */
export function parseSnapshot(raw: unknown): ToolSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

  const fields: ToolField[] = Array.isArray(r.fields)
    ? (r.fields as unknown[]).flatMap((f) => {
        if (!f || typeof f !== "object") return [];
        const x = f as Record<string, unknown>;
        const type = FIELD_TYPES.some((t) => t.id === x.type) ? (x.type as ToolField["type"]) : "text";
        const options = Array.isArray(x.options) ? (x.options as unknown[]).filter((o): o is string => typeof o === "string" && o.trim().length > 0) : undefined;
        return [
          {
            key: str(x.key).trim().toLowerCase(),
            label: str(x.label).trim(),
            type,
            required: x.required === true,
            example: str(x.example),
            ...(options && options.length > 0 ? { options } : {}),
          },
        ];
      })
    : [];

  const formats = Array.isArray(r.default_formats) ? [...new Set((r.default_formats as unknown[]).filter((f): f is FormatId => typeof f === "string" && f in FORMATS))] : [];
  const minutes = typeof r.estimated_minutes === "number" && Number.isFinite(r.estimated_minutes) ? Math.max(1, Math.round(r.estimated_minutes)) : null;

  return {
    title: str(r.title).trim(),
    description: str(r.description).trim(),
    prompt_template: str(r.prompt_template),
    fields,
    cta_label: str(r.cta_label).trim() || null,
    default_formats: formats,
    category: r.category === "social" || r.category === "stampa" ? r.category : null,
    estimated_minutes: minutes,
    cover_image: str(r.cover_image).trim() || null,
    default_template: str(r.default_template).trim() || null,
    default_variants: typeof r.default_variants === "number" ? Math.min(4, Math.max(1, Math.round(r.default_variants))) : 3,
  };
}
