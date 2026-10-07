import type { FormatId } from "./brand";
import type { AssetLayout } from "./layout-model";
import type { ToolField } from "./tool-fields";

/* ------------------------------------------------------------------ */
/* Ruoli e profili                                                      */
/* ------------------------------------------------------------------ */

export type Role = "editor" | "designer" | "approver";

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  /** Gestisce il team. Una spunta separata dal ruolo. */
  is_admin: boolean;
  invited_by: string | null;
  invited_at: string | null;
  /** L'ultimo accesso, aggiornato al piu' una volta l'ora. Null finche' non entra. */
  last_seen_at: string | null;
  /** Falso quando l'accesso e' stato tolto. Il lavoro resta. */
  active: boolean;
  created_at: string;
}

/** Un cambio di ruolo, di spunta admin o di accesso: chi, quando, da cosa a cosa. */
export interface ProfileEvent {
  id: string;
  profile_id: string;
  email: string;
  changed_by: string;
  field: "role" | "is_admin" | "active" | "invited";
  from_value: string | null;
  to_value: string | null;
  at: string;
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

export type ToolCategory = "social" | "stampa";

export interface Tool {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** Template dell'istruzione, con segnaposto {{campo}}. Editabile dal marketing. */
  prompt_template: string;
  /** Le domande del modulo, una per segnaposto. Vedi lib/tool-fields.ts. */
  fields: ToolField[];
  /** L'etichetta del pulsante che avvia lo strumento, es. «Crea il poster». */
  cta_label: string | null;
  /** Una foto dell'archivio per la card nella home. */
  cover_image: string | null;
  category: ToolCategory | null;
  estimated_minutes: number | null;
  /** Il template proposto all'apertura del modulo. Null: il primo in libreria. */
  default_template: string | null;
  /** Quante varianti propone il modulo, da 1 a 4. */
  default_variants: number;
  /** La versione che il team usa. Le bozze stanno in tool_versions. */
  published_version: number;
  default_formats: FormatId[];
  /** Contatore di esecuzioni, oppure una nota tipo "automatico a ogni esecuzione". */
  run_count: number;
  note: string | null;
  /** Gli strumenti di sistema non compaiono come lanciabili a mano. */
  automatic: boolean;
  position: number;
}

/** Quello che di uno strumento si versiona: cio' che il team vede e usa. */
export type ToolSnapshot = Pick<
  Tool,
  "title" | "description" | "prompt_template" | "fields" | "cta_label" | "default_formats" | "category" | "estimated_minutes" | "cover_image" | "default_template" | "default_variants"
>;

export interface ToolVersion {
  id: string;
  tool_id: string;
  version: number;
  snapshot: ToolSnapshot;
  created_by: string | null;
  created_at: string;
  /** Null finche' e' una bozza. */
  published_at: string | null;
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
  /**
   * L'impaginazione controllata dal brand-guard, cosi' com'era. E' quella
   * che viene resa e pubblicata. Assente finche' nessuno l'ha verificata.
   */
  layout?: AssetLayout | null;
  /** Le verifiche del brand-guard su questo asset e il loro verdetto. */
  guard?: GuardCheck[] | null;
  guard_status?: GuardStatus | null;
  guard_checked_at?: string | null;
  /** Approvato: da quale richiesta, da chi, quando. Null finche' non lo e'. */
  approval_id?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
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

export type Channel = "linkedin" | "instagram";
export type Surface = "feed" | "story";

export interface ScheduledPost {
  id: string;
  run_id: string;
  channel: Channel;
  /** Per Instagram: feed oppure story. */
  surface: Surface;
  caption: string;
  hashtags: string[];
  asset_id: string | null;
  /** La variante pubblicata, per riaprire l'asset giusto dal calendario. */
  variant_index: number | null;
  status: PostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  external_id: string | null;
  error: string | null;
  attempts: number;
  /** Quando una funzione l'ha preso in carico: evita la doppia pubblicazione. */
  claimed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Approval {
  id: string;
  run_id: string;
  /** La variante dell'esecuzione per cui si chiede. */
  variant_index: number;
  /** Chi ha chiesto. */
  requested_by: string | null;
  /** Il messaggio di chi chiede. */
  note: string | null;
  approver_name: string;
  approver_email: string | null;
  status: "pending" | "approved" | "rejected";
  /** Il commento di chi decide: obbligatorio quando rimanda indietro. */
  comment: string | null;
  decided_at: string | null;
  created_at: string;
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
