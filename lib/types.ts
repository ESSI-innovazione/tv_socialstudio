import type { FormatId } from "./brand";

/* ------------------------------------------------------------------ */
/* Ruoli e profili                                                      */
/* ------------------------------------------------------------------ */

export type Role = "editor" | "approver";

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Strumenti — istruzioni salvate e parametriche                        */
/* ------------------------------------------------------------------ */

export type ToolSlug =
  | "poster-bando"
  | "catalogo-servizi"
  | "visual-3d"
  | "social-kit"
  | "figma-sync"
  | "brand-guard";

export interface Tool {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** Template dell'istruzione, con segnaposto {{campo}}. Editabile dal marketing. */
  prompt_template: string;
  default_formats: FormatId[];
  /** Contatore di esecuzioni, oppure una nota tipo "automatico a ogni esecuzione". */
  run_count: number;
  note: string | null;
  /** Gli strumenti di sistema non compaiono come lanciabili a mano. */
  automatic: boolean;
  position: number;
}

/* ------------------------------------------------------------------ */
/* Campagne e template                                                  */
/* ------------------------------------------------------------------ */

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

export interface Template {
  id: string;
  figma_node_id: string | null;
  name: string;
  description: string | null;
  frame_count: number;
  /** Anteprima cachata da Figma. */
  thumbnail_url: string | null;
  formats: FormatId[];
  synced_at: string | null;
}

/* ------------------------------------------------------------------ */
/* Esecuzioni                                                           */
/* ------------------------------------------------------------------ */

export type RunState = "composing" | "running" | "results" | "failed";

export type StepStatus = "pending" | "active" | "done" | "failed";

export interface RunStep {
  key: string;
  label: string;
  status: StepStatus;
  /** Durata in millisecondi, presente solo a passo concluso. */
  duration_ms?: number;
  detail?: string;
}

export interface LogLine {
  /** Sorgente del messaggio: figma-sync, brand-guard, copy, layout... */
  source: string;
  message: string;
  at: number;
}

/** Un fatto verificabile che finira' su un asset, con la sua fonte. */
export interface Fact {
  claim: string;
  value: string;
  source: string;
  verified: boolean;
}

export interface BriefParse {
  campaign_name: string;
  headline_hint: string;
  audience: string;
  tone: string;
  cta_label: string;
  cta_url: string;
  /** Disclaimer normativo obbligatorio, se il contenuto riguarda un bando. */
  disclaimer: string | null;
  /** Data e ora della scadenza, se presente nel brief. */
  deadline: string | null;
  photo: string;
  facts: Fact[];
}

/** Il copy di una variante, indipendente dal formato. */
export interface VariantCopy {
  index: number;
  /** Nome dell'impianto: "testo in alto", "foto a tutta pagina"... */
  layout: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  body: string;
  badge: string | null;
  cta_label: string;
  cta_url: string;
  disclaimer: string | null;
}

export interface Caption {
  channel: "linkedin" | "instagram";
  text: string;
  hashtags: string[];
}

export type GuardStatus = "pass" | "warn" | "fail";

export interface GuardCheck {
  key: string;
  label: string;
  status: GuardStatus;
  detail: string | null;
}

export interface Asset {
  id: string;
  run_id: string;
  variant_index: number;
  format: FormatId;
  /** Rotta di rendering che produce il PNG. */
  render_url: string;
  width: number;
  height: number;
  /** Provenienza: cosa ha prodotto questo asset. */
  template_id: string | null;
  source_documents: string[];
}

export interface Run {
  id: string;
  campaign_id: string | null;
  tool_slug: string;
  instruction: string;
  attachments: Attachment[];
  formats: FormatId[];
  variant_count: number;
  template_id: string | null;
  state: RunState;
  steps: RunStep[];
  logs: LogLine[];
  brief: BriefParse | null;
  variants: VariantCopy[];
  captions: Caption[];
  guard: GuardCheck[];
  assets: Asset[];
  error: string | null;
  created_by: string | null;
  created_at: string;
  finished_at: string | null;
  duration_ms: number | null;
}

export type AttachmentKind = "document" | "link" | "photo";

export interface Attachment {
  kind: AttachmentKind;
  label: string;
  /** Testo estratto, usato come unica fonte ammessa per i fatti. */
  content?: string;
  url?: string;
}

/* ------------------------------------------------------------------ */
/* Pubblicazione                                                        */
/* ------------------------------------------------------------------ */

export type PostStatus = "draft" | "pending_approval" | "approved" | "scheduled" | "published" | "failed";

export interface ScheduledPost {
  id: string;
  run_id: string;
  channel: "linkedin" | "instagram";
  /** Per Instagram: feed oppure story. */
  surface: string;
  caption: string;
  hashtags: string[];
  asset_id: string | null;
  status: PostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  external_id: string | null;
  error: string | null;
}

export interface Approval {
  id: string;
  run_id: string;
  approver_name: string;
  approver_email: string | null;
  status: "pending" | "approved" | "rejected";
  decided_at: string | null;
}

/* ------------------------------------------------------------------ */
/* Eventi in streaming dalla rotta di esecuzione                        */
/* ------------------------------------------------------------------ */

export type RunEvent =
  | { type: "state"; state: RunState }
  | { type: "step"; step: RunStep }
  | { type: "log"; line: LogLine }
  | { type: "brief"; brief: BriefParse }
  | { type: "variant"; variant: VariantCopy }
  | { type: "caption"; caption: Caption }
  | { type: "guard"; checks: GuardCheck[] }
  | { type: "asset"; asset: Asset }
  | { type: "done"; run: Run }
  | { type: "error"; message: string };
