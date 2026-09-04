import { BRAND, BRAND_RULES, FORMATS, PHOTOS, UNVERIFIED, type FormatId } from "./brand";
import { COPY_JSON_SHAPE } from "./copy-schema";
import type { Attachment, Template } from "./types";

/**
 * Assemblaggio del prompt.
 *
 * Le prime due parti — voce del brand e regole dei formati — sono identiche
 * a ogni esecuzione: quando l'API verra' accesa vanno marcate con
 * cache_control, cosi' non si paga due volte lo stesso preambolo.
 * La terza parte e' l'unica che cambia.
 */

export interface PromptInput {
  instruction: string;
  attachments: Attachment[];
  formats: FormatId[];
  variantCount: number;
  template: Template | null;
  toolTemplate: string | null;
}

/** Parte stabile: voce, palette, regole. Candidata al prefisso cachato. */
export function brandPrefix(): string {
  const palette = [
    `wine ${BRAND.wine}`,
    `rose ${BRAND.rose}`,
    `coral ${BRAND.coral}`,
    `apricot ${BRAND.apricot}`,
  ].join(", ");

  const archive = PHOTOS.map((p) => `- ${p.file} — ${p.subject}. Usare per: ${p.use}`).join("\n");

  return `Sei il copywriter del team marketing di Time Vision, societa' italiana di
consulenza e formazione professionale. Scrivi in italiano.

VOCE
Istituzionale e diretta. Frasi brevi. Nessun superlativo, nessun punto
esclamativo, nessuna emoji. Chi legge e' un imprenditore o il titolare di una
PMI: ha poco tempo e diffida di chi promette troppo. Di' la cosa concreta
prima di dire perche' conta.

PALETTE E TIPOGRAFIA
Palette bloccata: ${palette}. Un solo accento per asset. Font unico Lexend.
Non proporre colori o font diversi: non e' una tua scelta.

REGOLE DI BRAND ATTIVE
${BRAND_RULES.map((r) => `- ${r}`).join("\n")}

LA REGOLA CHE NON SI NEGOZIA
Non scrivere mai una cifra, una percentuale, una data o un requisito che non
sia testualmente presente nelle fonti allegate. Non dedurre, non arrotondare,
non completare a memoria. Se un dato serve e non c'e', scrivi esattamente
${UNVERIFIED} al suo posto e segnalo in facts con "verified": false.
Un poster bello con un importo sbagliato e' un danno, non un asset.

Ogni fatto verificabile che finisce su un asset va elencato in brief.facts con
la fonte da cui viene, citata per nome.

ARCHIVIO FOTOGRAFICO
Scegli una sola foto tra queste, per nome file:
${archive}`;
}

/** Parte stabile: cosa devono contenere i formati richiesti. */
export function formatRules(formats: FormatId[]): string {
  const lines = formats.map((id) => {
    const spec = FORMATS[id];
    return `- ${spec.label} ${spec.width}x${spec.height} (${spec.exportNote}), margine di sicurezza ${spec.safeArea}px`;
  });

  return `FORMATI RICHIESTI
${lines.join("\n")}

Il copy e' unico e vale per tutti i formati: cambia la griglia, non il testo.
Il titolo deve reggere anche nel formato piu' stretto, quindi tienilo sotto i
60 caratteri. Il corpo sotto i 220. La banda (badge) sotto i 44, in maiuscolo,
e serve solo quando c'e' una scadenza o un'urgenza reale.`;
}

/** Parte variabile: il brief di questa esecuzione. */
export function runSection(input: PromptInput): string {
  const sources =
    input.attachments.length === 0
      ? `NESSUNA FONTE ALLEGATA
Non hai documenti. Ogni dato numerico o data va marcato ${UNVERIFIED}.`
      : input.attachments
          .map((a) => {
            const head = `--- FONTE: ${a.label} ---`;
            if (a.kind === "link") return `${head}\n${a.url ?? ""}\n(solo riferimento, non contenuto verificabile)`;
            if (a.kind === "photo") return `${head}\nindicazione fotografica: ${a.content ?? ""}`;
            return `${head}\n${a.content ?? ""}`;
          })
          .join("\n\n");

  const templateLine = input.template
    ? `TEMPLATE: ${input.template.name}. ${input.template.description ?? ""}`
    : "TEMPLATE: nessuno selezionato.";

  const toolLine = input.toolTemplate
    ? `\nISTRUZIONE SALVATA DELLO STRUMENTO\n${input.toolTemplate}`
    : "";

  return `${templateLine}${toolLine}

FONTI ALLEGATE — l'unico posto da cui possono venire i dati
${sources}

ISTRUZIONE DEL TEAM
${input.instruction}

COSA DEVI PRODURRE
${input.variantCount} varianti dello stesso messaggio, diverse per impianto e per
taglio del titolo, non per contenuto. Piu' le caption per i canali richiesti.

Rispondi con un solo oggetto JSON, senza testo prima o dopo, in questa forma:

${COPY_JSON_SHAPE}`;
}

/** Il prompt completo, quello che finisce nel riquadro da copiare. */
export function buildPrompt(input: PromptInput): string {
  return [brandPrefix(), formatRules(input.formats), runSection(input)].join("\n\n");
}

/**
 * Le tre parti separate, per la chiamata API: le prime due vanno nel system
 * con cache_control, la terza nel messaggio utente.
 */
export function buildPromptParts(input: PromptInput): {
  cachedPrefix: string;
  run: string;
} {
  return {
    cachedPrefix: [brandPrefix(), formatRules(input.formats)].join("\n\n"),
    run: runSection(input),
  };
}
