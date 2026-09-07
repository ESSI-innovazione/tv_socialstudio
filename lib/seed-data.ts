import type { Approval, Campaign, Profile, Run, ScheduledPost, Template, Tool } from "./types";

/**
 * Dati iniziali per lo store in memoria. Rispecchiano `supabase/seed.sql`:
 * l'app deve comportarsi allo stesso modo con e senza database.
 */

const CAMPAIGNS: Campaign[] = [
  { id: "cam-voucher", name: "Voucher Cloud MIMIT", slug: "voucher-cloud-mimit", active: true },
  { id: "cam-step", name: "Fondi STEP 2026", slug: "fondi-step-2026", active: false },
  { id: "cam-master", name: "Master Academy", slug: "master-academy", active: false },
  { id: "cam-donna", name: "Donna in Progress", slug: "donna-in-progress", active: false },
];

const TOOLS: Tool[] = [
  {
    id: "tool-poster",
    slug: "poster-bando",
    title: "Poster per un bando",
    description: "Poster A4 per bandi e finanziamenti, con countdown e disclaimer normativo",
    prompt_template:
      "Costruisci un poster A4 per il bando {{bando}}. Metti in evidenza il countdown alla scadenza {{scadenza}} e chiudi con il disclaimer normativo obbligatorio. Tono istituzionale e diretto, destinatario {{target}}. CTA: {{cta}}.",
    default_formats: ["poster-a4"],
    run_count: 34,
    note: null,
    automatic: false,
    position: 1,
  },
  {
    id: "tool-catalogo",
    slug: "catalogo-servizi",
    title: "Catalogo servizi",
    description: "Catalogo PDF multipagina costruito dai servizi selezionati",
    prompt_template:
      "Costruisci un catalogo PDF multipagina dai servizi {{servizi}}. Una pagina di copertina, una pagina per servizio, una pagina di contatto. Tono {{tono}}, destinatario {{target}}.",
    default_formats: ["poster-a4"],
    run_count: 9,
    note: null,
    automatic: false,
    position: 2,
  },
  {
    id: "tool-3d",
    slug: "visual-3d",
    title: "Visual 3D",
    description: "Key visual 3D e mockup a partire da un concept testuale",
    prompt_template:
      "Genera un key visual 3D dal concept {{concept}}. Rendi disponibili i mockup nei formati richiesti. Palette istituzionale, nessun colore fuori brand.",
    default_formats: ["linkedin", "ig-feed"],
    run_count: 6,
    note: null,
    automatic: false,
    position: 3,
  },
  {
    id: "tool-social",
    slug: "social-kit",
    title: "Kit social",
    description: "LinkedIn, IG feed e story dallo stesso layout, con caption già scritte",
    prompt_template:
      "Declina {{argomento}} in LinkedIn 1200x627, Instagram feed 1080x1080 e story 1080x1920 dallo stesso impianto. Scrivi anche le caption per canale. CTA: {{cta}}.",
    default_formats: ["linkedin", "ig-feed", "ig-story"],
    run_count: 47,
    note: null,
    automatic: false,
    position: 4,
  },
  {
    id: "tool-figma",
    slug: "figma-sync",
    title: "Figma sync",
    description: "Importa i frame aggiornati dalla libreria Brand 2026 e li rende usabili",
    prompt_template:
      "Sincronizza la libreria Figma Time Vision Brand 2026 e aggiorna i template disponibili.",
    default_formats: [],
    run_count: 0,
    note: "ultima sincronizzazione da Figma",
    automatic: true,
    position: 5,
  },
  {
    id: "tool-guard",
    slug: "brand-guard",
    title: "Brand guard",
    description: "Verifica palette, font, logo e claim prima di ogni pubblicazione",
    prompt_template:
      "Verifica che palette, font, logo e claim siano conformi al Brand Kit e che ogni dato numerico abbia una fonte nei documenti allegati.",
    default_formats: [],
    run_count: 0,
    note: "automatico a ogni esecuzione",
    automatic: true,
    position: 6,
  },
];

const TEMPLATES: Template[] = [
  {
    id: "tpl-bando",
    figma_node_id: "1:2",
    name: "Bando con countdown",
    description:
      "Impianto per bandi e finanziamenti: importo dominante, banda countdown, disclaimer in calce.",
    frame_count: 6,
    thumbnail_url: null,
    formats: ["poster-a4", "linkedin", "ig-feed", "ig-story"],
    synced_at: null,
  },
  {
    id: "tpl-corso",
    figma_node_id: "1:3",
    name: "Corso e academy",
    description:
      "Impianto per corsi e percorsi formativi: foto di aula, elenco moduli, CTA iscrizione.",
    frame_count: 5,
    thumbnail_url: null,
    formats: ["poster-a4", "linkedin", "ig-feed", "ig-story"],
    synced_at: null,
  },
];

const PROFILES: Profile[] = [
  {
    id: "prof-demo",
    email: "demo@timevision.it",
    name: "Giulia Rossi",
    role: "approver",
    created_at: new Date("2026-01-12").toISOString(),
  },
];

/** Due esecuzioni concluse, la lista compatta sotto la console. */
const RUNS: Run[] = [
  {
    id: "run-cig-puglia",
    campaign_id: "cam-step",
    tool_slug: "social-kit",
    instruction: "Corsi gratuiti CIG Puglia — indennità 2.400 €",
    attachments: [],
    formats: ["linkedin", "ig-feed", "ig-story"],
    variant_count: 1,
    template_id: "tpl-corso",
    state: "results",
    steps: [],
    logs: [],
    brief: null,
    variants: [],
    captions: [],
    guard: [],
    assets: [],
    error: null,
    created_by: "demo@timevision.it",
    created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    finished_at: new Date(Date.now() - 20 * 60 * 60 * 1000 + 26_000).toISOString(),
    duration_ms: 26_000,
  },
  {
    id: "run-step-catalogo",
    campaign_id: "cam-step",
    tool_slug: "catalogo-servizi",
    instruction: "Fondi STEP 2026 — catalogo servizi alle imprese",
    attachments: [],
    formats: ["poster-a4"],
    variant_count: 1,
    template_id: "tpl-bando",
    state: "results",
    steps: [],
    logs: [],
    brief: null,
    variants: [],
    captions: [],
    guard: [],
    assets: [],
    error: null,
    created_by: "demo@timevision.it",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    finished_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 72_000).toISOString(),
    duration_ms: 72_000,
  },
];

const APPROVALS: Approval[] = [];
const POSTS: ScheduledPost[] = [];

export const MEMORY_SEED = {
  profiles: PROFILES,
  campaigns: CAMPAIGNS,
  tools: TOOLS,
  templates: TEMPLATES,
  runs: RUNS,
  approvals: APPROVALS,
  posts: POSTS,
};

/** L'istruzione di esempio precaricata nella console. */
export const SAMPLE_INSTRUCTION = `Crea la campagna Voucher Cloud e Cybersecurity — MIMIT: fino a 20.000 € a fondo perduto, il ministero copre il 50% delle spese di PMI e lavoratori autonomi. 150 milioni disponibili, click-day il 10 novembre 2026 alle 12:00.
Usa il template Bando con countdown, tono istituzionale e diretto, target imprenditori e titolari di PMI. Metti in evidenza il countdown e la consulenza gratuita per candidatura e rendicontazione. CTA: «Scopri il voucher».`;

/** Allegati di esempio, le fonti ammesse per i fatti. */
export const SAMPLE_ATTACHMENTS = [
  {
    kind: "document" as const,
    label: "scheda-misura-MIMIT.pdf",
    content: `Voucher per cloud e cybersecurity — Ministero delle Imprese e del Made in Italy.
Contributo a fondo perduto fino a 20.000 euro per impresa.
Intensità del contributo: 50% delle spese ammissibili.
Dotazione complessiva: 150 milioni di euro sull'intero territorio nazionale.
Beneficiari: PMI e lavoratori autonomi titolari di partita IVA.
Apertura dello sportello (click-day): 10 novembre 2026, ore 12:00.
Spese ammissibili: servizi cloud, soluzioni di cybersecurity, consulenza specialistica correlata.`,
  },
  {
    kind: "link" as const,
    label: "timevision.it/voucher-cloud",
    url: "https://timevision.it/voucher-cloud",
  },
  {
    kind: "photo" as const,
    label: "archivio foto: digitale & PMI",
    content: "tv-digitale.jpg",
  },
];
