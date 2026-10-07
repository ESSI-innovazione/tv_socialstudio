import { deadlineLabel } from "./format";

/**
 * I campi di uno strumento e la composizione dell'istruzione.
 *
 * Un'istruzione salvata porta dei segnaposto {{chiave}}; ogni chiave ha un
 * campo dichiarato nello strumento. Qui si riempie il canovaccio con i
 * valori del modulo, e si rifiuta quello che non torna: un segnaposto senza
 * campo o un campo obbligatorio vuoto sono un errore, mai una stringa vuota
 * infilata di nascosto nel prompt. Il modulo nasce da queste dichiarazioni,
 * e la pagina che modifica uno strumento le valida con le stesse funzioni.
 */

export type FieldType = "text" | "date" | "datetime" | "choice" | "choice_link" | "longtext";

export interface ToolField {
  /** La chiave del segnaposto: minuscole, numeri e trattino basso. */
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** Un valore di esempio, mostrato come segnaposto e usato da «Prova con dati di esempio». */
  example: string;
  /** Le scelte, per `choice` e `choice_link`. */
  options?: string[];
}

export const FIELD_TYPES: { id: FieldType; label: string }[] = [
  { id: "text", label: "Testo breve" },
  { id: "longtext", label: "Testo lungo" },
  { id: "date", label: "Data" },
  { id: "datetime", label: "Data e ora" },
  { id: "choice", label: "Scelta" },
  { id: "choice_link", label: "Scelta con link" },
];

/** Cosa accetta un tipo, per l'aiuto sotto il campo. */
export const FIELD_TYPE_HINT: Record<FieldType, string> = {
  text: "una riga",
  longtext: "qualche riga",
  date: "una data",
  datetime: "una data e un'ora",
  choice: "una delle opzioni",
  choice_link: "un'opzione e l'indirizzo a cui porta",
};

export const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export interface ToolLike {
  prompt_template: string;
  fields: ToolField[];
}

export class ToolFieldError extends Error {
  readonly key: string | null;
  constructor(message: string, key: string | null = null) {
    super(message);
    this.name = "ToolFieldError";
    this.key = key;
  }
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Le chiavi dei segnaposto nell'ordine in cui compaiono, senza doppioni. */
export function placeholdersOf(template: string): string[] {
  const out: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const key = match[1].toLowerCase();
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

/** Vero quando il valore e' da considerare assente. */
export function isBlank(value: string | undefined | null): boolean {
  return !value || value.trim().length === 0;
}

/** I campi obbligatori che non hanno ancora un valore, nell'ordine del modulo. */
export function missingRequired(tool: ToolLike, values: Record<string, string>): ToolField[] {
  return tool.fields.filter((f) => f.required && isBlank(values[f.key]));
}

/**
 * Come un valore entra nel prompt. Le date diventano leggibili («10 novembre
 * 2026, ore 12:00») perche' il modello scrive quello che legge, e un ISO nel
 * copy sarebbe un errore da brand-guard.
 */
export function renderValue(field: ToolField, raw: string): string {
  const value = raw.trim();
  if (field.type === "date" || field.type === "datetime") {
    const label = deadlineLabel(value.length === 10 ? `${value}T00:00:00` : value);
    if (!label) return value;
    return field.type === "date" ? label.replace(/, ore .*$/, "") : label;
  }
  return value;
}

/**
 * Riempie il canovaccio. Un segnaposto senza campo e' un errore (lo
 * strumento e' mal configurato); un campo obbligatorio vuoto e' un errore
 * (il modulo non e' finito). Un campo facoltativo vuoto esce come «(non
 * indicato)»: visibile, non inventato.
 */
export function fillTemplate(tool: ToolLike, values: Record<string, string>): string {
  const byKey = new Map(tool.fields.map((f) => [f.key, f]));

  for (const key of placeholdersOf(tool.prompt_template)) {
    if (!byKey.has(key)) {
      throw new ToolFieldError(`L'istruzione usa {{${key}}} ma lo strumento non ha questo campo.`, key);
    }
  }

  const missing = missingRequired(tool, values);
  if (missing.length > 0) {
    throw new ToolFieldError(`Manca ${missing[0].label.toLowerCase()}.`, missing[0].key);
  }

  return tool.prompt_template.replace(PLACEHOLDER, (_whole, rawKey: string) => {
    const field = byKey.get(rawKey.toLowerCase())!;
    const raw = values[field.key];
    return isBlank(raw) ? "(non indicato)" : renderValue(field, raw);
  });
}

/**
 * Il canovaccio spezzato in testo e segnaposto, per disegnarlo con i chip
 * colorati. Un segnaposto senza campo resta segnalato come tale.
 */
export type TemplatePart = { kind: "text"; text: string } | { kind: "field"; key: string; field: ToolField | null; value: string | null };

export function splitTemplate(tool: ToolLike, values: Record<string, string> = {}): TemplatePart[] {
  const byKey = new Map(tool.fields.map((f) => [f.key, f]));
  const parts: TemplatePart[] = [];
  let last = 0;
  for (const match of tool.prompt_template.matchAll(PLACEHOLDER)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ kind: "text", text: tool.prompt_template.slice(last, start) });
    const key = match[1].toLowerCase();
    const field = byKey.get(key) ?? null;
    const raw = values[key];
    parts.push({ kind: "field", key, field, value: field && !isBlank(raw) ? renderValue(field, raw) : null });
    last = start + match[0].length;
  }
  if (last < tool.prompt_template.length) parts.push({ kind: "text", text: tool.prompt_template.slice(last) });
  return parts;
}

/**
 * Cosa impedisce di pubblicare uno strumento. Vuoto quando e' tutto a posto.
 * Le stesse regole valgono nel server e nell'editor.
 */
export function validateTool(tool: ToolLike & { default_formats: string[]; title?: string }): string[] {
  const problems: string[] = [];
  if (tool.title !== undefined && tool.title.trim().length === 0) problems.push("Lo strumento ha bisogno di un nome.");
  if (tool.prompt_template.trim().length < 20) problems.push("L'istruzione e' troppo corta per essere utile.");
  if (tool.default_formats.length === 0) problems.push("Scegli almeno un formato.");

  const keys = tool.fields.map((f) => f.key);
  const seen = new Set<string>();
  for (const field of tool.fields) {
    if (!KEY_PATTERN.test(field.key)) problems.push(`La chiave «${field.key}» non va: minuscole, numeri e trattino basso, e inizia con una lettera.`);
    if (seen.has(field.key)) problems.push(`La chiave «${field.key}» e' usata due volte.`);
    seen.add(field.key);
    if (field.label.trim().length === 0) problems.push(`Il campo «${field.key}» non ha un'etichetta.`);
    if ((field.type === "choice" || field.type === "choice_link") && (!field.options || field.options.length === 0)) {
      problems.push(`Il campo «${field.label || field.key}» e' una scelta ma non ha opzioni.`);
    }
  }

  const used = placeholdersOf(tool.prompt_template);
  for (const key of used) {
    if (!keys.includes(key)) problems.push(`L'istruzione usa {{${key}}} ma non c'e' una domanda con questa chiave.`);
  }
  for (const key of keys) {
    if (!used.includes(key)) problems.push(`La domanda «${key}» non e' usata nell'istruzione.`);
  }
  return problems;
}

/** I valori di esempio di ogni campo, per «Prova con dati di esempio». */
export function exampleValues(tool: ToolLike): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of tool.fields) out[f.key] = f.example;
  return out;
}

/**
 * Da una chiave a un'etichetta decente, per chi inserisce un segnaposto
 * nuovo nell'editor: «data_scadenza» diventa «Data scadenza».
 */
export function labelFromKey(key: string): string {
  const words = key.replace(/_+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ------------------------------------------------------------------ */
/* Anteprima dal vivo                                                   */
/* ------------------------------------------------------------------ */

export interface DraftCopy {
  eyebrow: string;
  headline: string;
  subhead: string;
  body: string;
  badge: string | null;
  cta_label: string;
  cta_url: string;
  disclaimer: string | null;
}

/** Il primo valore non vuoto fra le chiavi date, oppure il primo campo di quel tipo. */
function pick(tool: ToolLike, values: Record<string, string>, keys: string[], types: FieldType[] = []): { field: ToolField; value: string } | null {
  for (const key of keys) {
    const field = tool.fields.find((f) => f.key === key);
    if (field && !isBlank(values[key])) return { field, value: values[key] };
  }
  for (const field of tool.fields) {
    if (types.includes(field.type) && !isBlank(values[field.key]) && !keys.includes(field.key)) return { field, value: values[field.key] };
  }
  return null;
}

/**
 * Un copy provvisorio per l'anteprima mentre si compila: il titolo e' il
 * nome del bando o dell'argomento, la banda e' la scadenza, il pulsante e'
 * la CTA. Non e' il copy finale, che lo scrive l'esecuzione: e' il modo di
 * vedere il poster prendere forma mentre si risponde alle domande.
 */
export function draftCopy(tool: ToolLike, values: Record<string, string>, campaign: string): DraftCopy {
  const title = pick(tool, values, ["bando", "argomento", "concept", "titolo"], ["text", "longtext"]);
  const audience = pick(tool, values, ["target", "destinatario", "pubblico"]);
  const services = pick(tool, values, ["servizi", "contenuto", "descrizione"], ["longtext"]);
  const deadline = pick(tool, values, ["scadenza", "data", "quando"], ["date", "datetime"]);
  const cta = pick(tool, values, ["cta", "pulsante", "azione"], ["choice_link"]);

  const headline = title ? firstLine(title.value, 48) : campaign;
  const subhead = audience ? `Per ${audience.value.trim()}` : services ? firstLine(services.value, 80) : "Il testo lo scrive lo Studio dalle fonti allegate.";

  return {
    eyebrow: campaign.toUpperCase(),
    headline,
    subhead,
    body: services && audience ? firstLine(services.value, 180) : "Cifre e date arrivano solo dalle fonti: quello che manca resta [DA VERIFICARE].",
    badge: deadline ? `Scadenza ${renderValue(deadline.field, deadline.value)}` : null,
    cta_label: cta ? firstLine(cta.value, 28) : "Scopri di piu'",
    cta_url: "https://timevision.it",
    disclaimer: null,
  };
}

function firstLine(text: string, max: number): string {
  const line = text.trim().split(/\r?\n/)[0] ?? "";
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
