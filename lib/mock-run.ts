import { FORMATS, UNVERIFIED, type FormatId } from "./brand";
import type {
  Asset,
  Attachment,
  BriefParse,
  Caption,
  GuardCheck,
  Run,
  RunEvent,
  RunStep,
  VariantCopy,
} from "./types";

/**
 * Driver simulato dell'esecuzione. Produce esattamente gli stessi `RunEvent`
 * che la rotta di esecuzione emettera' in streaming al passo 3: quando arriva
 * il motore vero, questo file sparisce e la console non cambia di una riga.
 *
 * La regola vale anche qui: nessun dato che non sia nelle fonti allegate.
 * Cio' che manca resta marcato UNVERIFIED, non viene inventato.
 */

const SOURCE = "scheda-misura-MIMIT.pdf";

const BRIEF: BriefParse = {
  campaign_name: "Voucher Cloud e Cybersecurity — MIMIT",
  headline_hint: "fino a 20.000 € a fondo perduto",
  audience: "PMI e lavoratori autonomi titolari di partita IVA",
  tone: "istituzionale e diretto",
  cta_label: "Scopri il voucher",
  cta_url: "https://timevision.it/voucher-cloud",
  disclaimer:
    "Misura del Ministero delle Imprese e del Made in Italy. Contributo a fondo perduto fino a 20.000 €, pari al 50% delle spese ammissibili. Fa fede il testo ufficiale della misura.",
  deadline: "2026-11-10T12:00:00+01:00",
  photo: "tv-digitale.jpg",
  facts: [
    { claim: "Contributo massimo", value: "20.000 €", source: SOURCE, verified: true },
    {
      claim: "Intensità del contributo",
      value: "50% delle spese ammissibili",
      source: SOURCE,
      verified: true,
    },
    { claim: "Dotazione complessiva", value: "150 milioni di euro", source: SOURCE, verified: true },
    { claim: "Beneficiari", value: "PMI e lavoratori autonomi", source: SOURCE, verified: true },
    {
      claim: "Apertura sportello",
      value: "10 novembre 2026, ore 12:00",
      source: SOURCE,
      verified: true,
    },
    {
      claim: "Durata dello sportello",
      value: UNVERIFIED,
      source: "assente nelle fonti allegate",
      verified: false,
    },
  ],
};

const VARIANTS: VariantCopy[] = [
  {
    index: 0,
    layout: "dato dominante",
    eyebrow: "Voucher cloud e cybersecurity",
    headline: "20.000 €",
    subhead: "a fondo perduto per digitalizzare la tua impresa",
    body: "Il Ministero delle Imprese e del Made in Italy copre il 50% delle spese in servizi cloud e cybersecurity. Dotazione complessiva 150 milioni di euro per PMI e lavoratori autonomi.",
    badge: "Click-day 10 novembre 2026, ore 12:00",
    cta_label: "Scopri il voucher",
    cta_url: "https://timevision.it/voucher-cloud",
    disclaimer: BRIEF.disclaimer,
  },
  {
    index: 1,
    layout: "countdown in evidenza",
    eyebrow: "Click-day 10 novembre 2026",
    headline: "Il cloud che ti paga il ministero",
    subhead: "Fino a 20.000 € a fondo perduto, il 50% delle spese ammissibili",
    body: "Ti accompagniamo dalla candidatura alla rendicontazione. Lo sportello apre alle ore 12:00 del 10 novembre 2026: la domanda va preparata prima.",
    badge: "150 milioni disponibili",
    cta_label: "Scopri il voucher",
    cta_url: "https://timevision.it/voucher-cloud",
    disclaimer: BRIEF.disclaimer,
  },
  {
    index: 2,
    layout: "foto a tutta pagina",
    eyebrow: "PMI e lavoratori autonomi",
    headline: "Metti in sicurezza la tua impresa",
    subhead: "Voucher cloud e cybersecurity — fino a 20.000 € dal MIMIT",
    body: "Il 50% delle spese in servizi cloud e soluzioni di cybersecurity è coperto dal contributo. Consulenza gratuita per la candidatura.",
    badge: "Apertura 10 novembre 2026",
    cta_label: "Scopri il voucher",
    cta_url: "https://timevision.it/voucher-cloud",
    disclaimer: BRIEF.disclaimer,
  },
];

const CAPTIONS: Caption[] = [
  {
    channel: "linkedin",
    text: "Il MIMIT mette 150 milioni di euro sul cloud e la cybersecurity delle PMI italiane.\n\nFino a 20.000 € a fondo perduto per impresa, con il ministero che copre il 50% delle spese ammissibili in servizi cloud, soluzioni di sicurezza e consulenza specialistica correlata. Possono accedere PMI e lavoratori autonomi titolari di partita IVA.\n\nLo sportello apre alle 12:00 del 10 novembre 2026. È un click-day: la domanda si prepara prima, non quel giorno.\n\nIn Time Vision seguiamo candidatura e rendicontazione dall'inizio alla fine.",
    hashtags: ["VoucherDigitali", "MIMIT", "Cybersecurity", "PMI", "TimeVision"],
  },
  {
    channel: "instagram",
    text: "Fino a 20.000 € a fondo perduto per il cloud e la cybersecurity della tua impresa.\n\nIl MIMIT copre il 50% delle spese. 150 milioni disponibili per PMI e lavoratori autonomi.\n\nClick-day: 10 novembre 2026, ore 12:00.\n\nLink in bio per la consulenza gratuita.",
    hashtags: ["voucherdigitali", "cybersecurity", "pmi", "fondoperduto", "timevision"],
  },
];

const GUARD: GuardCheck[] = [
  {
    key: "palette",
    label: "Palette istituzionale",
    status: "pass",
    detail: "5 colori, tutti nel Brand Kit",
  },
  {
    key: "font",
    label: "Lexend su tutti i livelli",
    status: "pass",
    detail: "700 / 400, nessuna sostituzione",
  },
  {
    key: "logo",
    label: "Logo in alto a sinistra",
    status: "pass",
    detail: "area di rispetto corretta su 12 frame",
  },
  {
    key: "claims",
    label: "Claim con fonte",
    status: "warn",
    detail: "1 dato senza fonte, marcato [DA VERIFICARE]",
  },
  {
    key: "disclaimer",
    label: "Disclaimer normativo",
    status: "pass",
    detail: "presente in calce su tutti i formati",
  },
  {
    key: "contrast",
    label: "Contrasto AA",
    status: "pass",
    detail: "rapporto minimo rilevato 5.1:1",
  },
];

const STEP_DEFS: { key: string; label: string }[] = [
  { key: "template", label: "Template dalla libreria Figma" },
  { key: "brief", label: "Lettura del brief e delle fonti" },
  { key: "copy", label: "Scrittura del copy" },
  { key: "render", label: "Rendering dei formati" },
  { key: "guard", label: "Brand guard" },
];

function step(
  key: string,
  status: RunStep["status"],
  detail?: string,
  duration?: number,
): RunStep {
  const def = STEP_DEFS.find((s) => s.key === key)!;
  return { key, label: def.label, status, detail, duration_ms: duration };
}

function assetsFor(
  runId: string,
  variants: VariantCopy[],
  formats: FormatId[],
  templateId: string | null,
): Asset[] {
  const out: Asset[] = [];
  for (const v of variants) {
    for (const f of formats) {
      const spec = FORMATS[f];
      out.push({
        id: `${runId}-v${v.index}-${f}`,
        run_id: runId,
        variant_index: v.index,
        format: f,
        render_url: `/api/render/${runId}/${v.index}/${f}`,
        width: spec.width,
        height: spec.height,
        template_id: templateId,
        source_documents: [SOURCE, "timevision.it/voucher-cloud"],
      });
    }
  }
  return out;
}

export interface MockRunInput {
  instruction: string;
  formats: FormatId[];
  attachments: Attachment[];
  templateId: string | null;
  campaignId: string | null;
  toolSlug: string;
  variantCount: number;
  createdBy: string | null;
}

/** L'esecuzione vuota da cui parte lo stream. */
export function startMockRun(input: MockRunInput): Run {
  return {
    id: `run-${Date.now().toString(36)}`,
    campaign_id: input.campaignId,
    tool_slug: input.toolSlug,
    instruction: input.instruction,
    attachments: input.attachments,
    formats: input.formats,
    variant_count: input.variantCount,
    template_id: input.templateId,
    state: "running",
    steps: STEP_DEFS.map((s) => step(s.key, "pending")),
    logs: [],
    brief: null,
    variants: [],
    captions: [],
    guard: [],
    assets: [],
    error: null,
    created_by: input.createdBy,
    created_at: new Date().toISOString(),
    finished_at: null,
    duration_ms: null,
  };
}

/** La sequenza temporizzata, in millisecondi dall'avvio. */
export function mockScript(run: Run): { at: number; event: RunEvent }[] {
  const formats = run.formats.length > 0 ? run.formats : (["linkedin"] as FormatId[]);
  const variants = VARIANTS.slice(0, Math.max(1, Math.min(run.variant_count, VARIANTS.length)));
  const assets = assetsFor(run.id, variants, formats, run.template_id);
  const out: { at: number; event: RunEvent }[] = [];
  const base = Date.now();

  const log = (at: number, source: string, message: string) =>
    out.push({ at, event: { type: "log", line: { source, message, at: base + at } } });
  const mark = (
    at: number,
    key: string,
    status: RunStep["status"],
    detail?: string,
    ms?: number,
  ) => out.push({ at, event: { type: "step", step: step(key, status, detail, ms) } });

  mark(0, "template", "active");
  log(120, "figma-sync", "libreria Time Vision Brand 2026, lettura in sola lettura");
  log(560, "figma-sync", "frame trovati: 6 · impianto «Bando con countdown»");
  mark(900, "template", "done", "6 frame", 900);

  mark(950, "brief", "active");
  log(1100, "brief", "fonti allegate: 1 documento, 1 link, 1 foto d'archivio");
  log(1500, "brief", "estratti 5 dati verificabili da scheda-misura-MIMIT.pdf");
  log(1900, "brief", "1 dato assente dalle fonti, marcato [DA VERIFICARE]");
  out.push({ at: 2050, event: { type: "brief", brief: BRIEF } });
  mark(2100, "brief", "done", "6 fatti · 5 con fonte", 1150);

  mark(2200, "copy", "active");
  log(2350, "copy", "claude-sonnet-5 · voce di brand caricata dal Brand Kit");
  variants.forEach((v, i) => {
    const at = 2900 + i * 900;
    log(at - 250, "copy", `variante ${i + 1}: impianto «${v.layout}»`);
    out.push({ at, event: { type: "variant", variant: v } });
  });
  const copyEnd = 2900 + variants.length * 900;
  CAPTIONS.forEach((c, i) => {
    out.push({ at: copyEnd + i * 260, event: { type: "caption", caption: c } });
  });
  mark(copyEnd + 600, "copy", "done", `${variants.length} varianti · 2 caption`, copyEnd + 600 - 2200);

  const renderStart = copyEnd + 700;
  mark(renderStart, "render", "active");
  assets.forEach((a, i) => {
    const at = renderStart + 220 + i * 190;
    if (i % variants.length === 0) {
      log(at - 90, "layout", `${FORMATS[a.format].label} · ${a.width}×${a.height}`);
    }
    out.push({ at, event: { type: "asset", asset: a } });
  });
  const renderEnd = renderStart + 300 + assets.length * 190;
  mark(renderEnd, "render", "done", `${assets.length} asset`, renderEnd - renderStart);

  mark(renderEnd + 80, "guard", "active");
  log(renderEnd + 220, "brand-guard", "palette, font, logo, claim, disclaimer, contrasto");
  log(renderEnd + 700, "brand-guard", "1 avviso: dato senza fonte marcato in copy");
  out.push({ at: renderEnd + 900, event: { type: "guard", checks: GUARD } });
  mark(renderEnd + 950, "guard", "done", "5 verifiche passate · 1 avviso", 870);

  out.push({ at: renderEnd + 1150, event: { type: "state", state: "results" } });

  return out;
}

export const MOCK_BRIEF = BRIEF;
export const MOCK_GUARD = GUARD;
export const MOCK_VARIANTS = VARIANTS;
