import { z } from "zod";
import { UNVERIFIED } from "./brand";

/**
 * Il contratto del copy generato.
 *
 * E' lo stesso oggetto qualunque sia la provenienza: incollato a mano da
 * chi usa l'abbonamento Claude dell'azienda, oppure restituito dall'API
 * quando verra' accesa. Validare qui significa che accendere l'API
 * sostituisce una funzione e nient'altro.
 */

/** Un fatto verificabile e la fonte da cui viene. Senza fonte non si pubblica. */
export const FactSchema = z.object({
  claim: z.string().min(1, "l'affermazione non può essere vuota"),
  value: z.string().min(1, "il valore non può essere vuoto"),
  source: z.string().min(1, "ogni fatto deve dichiarare la fonte"),
  verified: z.boolean(),
});

export const BriefSchema = z.object({
  campaign_name: z.string().min(1),
  headline_hint: z.string().default(""),
  audience: z.string().default(""),
  tone: z.string().default(""),
  cta_label: z.string().min(1),
  cta_url: z.string().default(""),
  disclaimer: z.string().nullable().default(null),
  deadline: z.string().nullable().default(null),
  photo: z.string().default("tv-digitale.jpg"),
  facts: z.array(FactSchema).default([]),
});

export const VariantSchema = z.object({
  index: z.number().int().min(0),
  layout: z.string().min(1),
  eyebrow: z.string().default(""),
  headline: z.string().min(1, "il titolo è obbligatorio"),
  subhead: z.string().default(""),
  body: z.string().default(""),
  badge: z.string().nullable().default(null),
  cta_label: z.string().min(1),
  cta_url: z.string().default(""),
  disclaimer: z.string().nullable().default(null),
});

export const CaptionSchema = z.object({
  channel: z.enum(["linkedin", "instagram"]),
  text: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
});

/** La risposta completa che l'agente deve produrre. */
export const CopyResponseSchema = z.object({
  brief: BriefSchema,
  variants: z.array(VariantSchema).min(1, "serve almeno una variante"),
  captions: z.array(CaptionSchema).default([]),
});

export type CopyResponse = z.infer<typeof CopyResponseSchema>;
export type ParsedBrief = z.infer<typeof BriefSchema>;
export type ParsedVariant = z.infer<typeof VariantSchema>;

/** Lo schema in forma leggibile, incollato nel prompt e mostrato in UI. */
export const COPY_JSON_SHAPE = `{
  "brief": {
    "campaign_name": "string",
    "headline_hint": "string",
    "audience": "string",
    "tone": "string",
    "cta_label": "string",
    "cta_url": "string",
    "disclaimer": "string | null",
    "deadline": "string | null",
    "photo": "uno dei file dell'archivio",
    "facts": [
      { "claim": "string", "value": "string", "source": "string", "verified": true }
    ]
  },
  "variants": [
    {
      "index": 0,
      "layout": "string",
      "eyebrow": "string",
      "headline": "string",
      "subhead": "string",
      "body": "string",
      "badge": "string | null",
      "cta_label": "string",
      "cta_url": "string",
      "disclaimer": "string | null"
    }
  ],
  "captions": [
    { "channel": "linkedin" | "instagram", "text": "string", "hashtags": ["string"] }
  ]
}`;

export interface ParseFailure {
  ok: false;
  /** Messaggi in italiano, uno per campo, pronti da mostrare. */
  errors: string[];
}

export interface ParseSuccess {
  ok: true;
  data: CopyResponse;
  /** Avvisi non bloccanti: il copy passa, ma qualcosa va guardato. */
  warnings: string[];
}

export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Valida quello che e' stato incollato. Accetta sia JSON puro sia JSON
 * dentro un blocco markdown, perche' e' quello che si copia da una chat.
 */
export function parseCopyResponse(raw: string, expectedVariants?: number): ParseResult {
  const text = stripCodeFence(raw.trim());

  if (text.length === 0) {
    return { ok: false, errors: ["Incolla la risposta JSON dell'agente."] };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      errors: [
        "Non è JSON valido. Copia l'intera risposta, comprese le parentesi graffe di apertura e chiusura.",
      ],
    };
  }

  const parsed = CopyResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, errors: describeIssues(parsed.error) };
  }

  const data = parsed.data;
  const warnings: string[] = [];

  // Gli indici devono essere consecutivi da zero: la griglia ci conta sopra.
  const indices = data.variants.map((v) => v.index).sort((a, b) => a - b);
  const consecutive = indices.every((value, position) => value === position);
  if (!consecutive) {
    return {
      ok: false,
      errors: [
        `Gli indici delle varianti devono partire da 0 ed essere consecutivi. Ricevuti: ${indices.join(", ")}.`,
      ],
    };
  }

  if (expectedVariants && data.variants.length !== expectedVariants) {
    warnings.push(
      `Hai chiesto ${expectedVariants} varianti e ne sono arrivate ${data.variants.length}.`,
    );
  }

  // La regola che conta: nessuna cifra che non sia in un fatto verificato.
  const unverified = data.brief.facts.filter((f) => !f.verified);
  if (unverified.length > 0) {
    warnings.push(
      `${unverified.length} ${unverified.length === 1 ? "dato non confermato" : "dati non confermati"}: ${unverified
        .map((f) => f.claim)
        .join(", ")}.`,
    );
  }

  for (const variant of data.variants) {
    if (JSON.stringify(variant).includes(UNVERIFIED)) {
      warnings.push(`La variante ${variant.index + 1} contiene un segnaposto ${UNVERIFIED}.`);
    }
  }

  return { ok: true, data, warnings };
}

/** Toglie il recinto markdown che le chat mettono attorno al JSON. */
function stripCodeFence(text: string): string {
  const fenced = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/);
  if (fenced) return fenced[1].trim();

  // A volte si copia anche una riga di introduzione prima del JSON.
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

/** Traduce gli errori di zod in righe leggibili da chi non programma. */
function describeIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 8).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(" › ") : "risposta";
    return `${path}: ${issue.message}`;
  });
}
