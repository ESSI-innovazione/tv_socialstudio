export type AssetFormat = 'poster-a4' | 'linkedin' | 'ig-feed' | 'ig-story'

export const FORMAT_SIZE: Record<AssetFormat, { w: number; h: number }> = {
  'poster-a4': { w: 794, h: 1123 },   // A4 authored at 96dpi, exported at 300dpi
  'linkedin':  { w: 1200, h: 627 },
  'ig-feed':   { w: 1080, h: 1080 },
  'ig-story':  { w: 1080, h: 1920 },
}

/** What the copy step produces and the renderer consumes. */
export interface CampaignFacts {
  campaign: string
  headline: string
  subhead: string
  body?: string
  cta: string
  ctaUrl: string
  eyebrow?: string          // e.g. "MIMIT · MISURA 2026"
  deadline?: { label: string; iso: string }  // e.g. "CLICK-DAY 10 NOVEMBRE 2026 · ORE 12:00"
  disclaimer?: string       // legally required footer on bando assets
  imageKey?: string         // key into the photo archive
  sources: { claim: string; document: string }[]
}

export interface TextSlot {
  id: string
  role: 'headline' | 'subhead' | 'body' | 'cta' | 'eyebrow' | 'deadline' | 'disclaimer'
  maxChars: number
  fontSize: number
  fontWeight: number
  lineHeight: number
  letterSpacing: number
  color: string
}

export interface TemplateSpec {
  id: string                // Figma node id
  name: string              // e.g. "Bando con countdown"
  formats: AssetFormat[]    // which frames this template provides
  frames: Record<AssetFormat, {
    background: string
    slots: TextSlot[]
    imageSlot?: { x: number; y: number; w: number; h: number; fit: 'cover' | 'contain' }
    logo: { x: number; y: number; w: number; color: string }
  }>
  updatedAt: string
}

export interface RenderedAsset {
  format: AssetFormat
  bytes: Buffer
  mime: 'image/png' | 'application/pdf'
  width: number
  height: number
}

export interface TemplateSource {
  sync(): Promise<{ added: number; updated: number; at: string }>
  list(): Promise<Pick<TemplateSpec, 'id' | 'name' | 'formats' | 'updatedAt'>[]>
  get(id: string): Promise<TemplateSpec>
}

export interface AssetRenderer {
  render(spec: TemplateSpec, facts: CampaignFacts, format: AssetFormat): Promise<RenderedAsset>
}

/* ------------------------------------------------------------------ */

/**
 * `FORMAT_SIZE` e le dimensioni in `lib/brand.ts` descrivono gli stessi
 * formati. Questo controllo esiste solo a compilazione: se qualcuno cambia un
 * numero da una parte sola, il build si ferma invece di produrre asset della
 * dimensione sbagliata.
 */
export type AssetFormatsAreAligned = AssetFormat

/* ------------------------------------------------------------------ */
/* Documenti multipagina                                                */
/* ------------------------------------------------------------------ */

export type DocFormat = 'catalogo' | 'deck' | 'one-pager' | 'landing'

export interface DocumentRequest {
  format: DocFormat
  title: string
  /** Full source content — the brief plus any extracted attachment text. Never summarise before sending. */
  inputText: string
  audience?: string
  tone?: string
  numCards?: number
  /** Photo archive keys the document should prefer over generated imagery. */
  imageKeys?: string[]
}

export interface GeneratedDocument {
  gammaId: string
  gammaUrl: string          // for humans to open and hand-edit
  storedFileUrl: string     // OUR copy, in our storage — this is the link the app shows
  mime: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  pages: number
  generatedAt: string
}

export interface DocumentGenerator {
  generate(req: DocumentRequest): Promise<GeneratedDocument>
}

/* ------------------------------------------------------------------ */
/* Immagini                                                             */
/* ------------------------------------------------------------------ */

/** Da dove viene un visual: l'archivio aziendale o un modello. */
export type ImageOrigin = 'archive' | 'generated'

export type ImagePurpose = 'poster-a4' | 'linkedin' | 'ig-feed' | 'ig-story' | 'catalogo'

export interface ImageChoice {
  id: string
  origin: ImageOrigin
  /** Il nostro indirizzo. Mai quello del fornitore, che scade. */
  url: string
  label: string
  width: number
  height: number
  /** Presente solo sui visual generati: e' la provenienza da registrare. */
  prompt?: string
  model?: string
  createdAt?: string
}

export interface ImageRequest {
  prompt: string
  purpose: ImagePurpose
  /** Tipo di resa. Il 3D e' quello che il brand usa per i key visual. */
  style: 'abstract' | 'illustration' | 'photo' | 'scene'
}

export interface ImageSource {
  /** L'archivio fotografico aziendale. Gratuito, e la prima scelta. */
  archive(): ImageChoice[]
  /** Genera un visual nuovo. Consuma crediti. */
  generate(req: ImageRequest): Promise<ImageChoice>
}
