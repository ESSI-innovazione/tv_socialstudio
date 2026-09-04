import { env } from "../env";
import {
  FIGMA_ROLES,
  type AssetFormat,
  type TemplateSource,
  type TemplateSpec,
  type TextSlot,
} from "./figma-shape";
import {
  FigmaNotConfiguredError,
  FigmaRequestError,
  TemplateIncompleteError,
  UnknownRoleError,
} from "./figma-errors";
import { readTemplateSpec, listTemplateSpecs, writeTemplateSpecs } from "../db-templates";

/**
 * La libreria brand di Figma, letta e basta.
 *
 * L'API REST di Figma non scrive contenuto di design: si leggono file, nodi e
 * immagini renderizzate. Modificare un frame richiederebbe un plugin, che qui
 * non c'entra. Il marketing e' l'unico che tocca i template, in Figma.
 *
 * La convenzione dei nomi sta in TEMPLATES.md, cosi' chi crea un template
 * nuovo non deve leggere questo file.
 */

const API = "https://api.figma.com";

/* ------------------------------------------------------------------ */
/* Forma dei nodi che ci interessano                                    */
/* ------------------------------------------------------------------ */

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  style?: {
    fontSize?: number;
    fontWeight?: number;
    lineHeightPx?: number;
    letterSpacing?: number;
  };
  fills?: { type: string; color?: FigmaColor; visible?: boolean }[];
  backgroundColor?: FigmaColor;
  characters?: string;
}

interface FigmaFile {
  name: string;
  lastModified: string;
  document: FigmaNode;
}

/* ------------------------------------------------------------------ */
/* Conversioni                                                          */
/* ------------------------------------------------------------------ */

/**
 * Figma esprime i canali in virgola mobile da 0 a 1. Qui diventano esadecimali,
 * senza arrotondare a una palette: se il file dichiara un colore fuori brand,
 * deve emergere, non essere corretto di nascosto.
 */
export function toHex(color: FigmaColor): string {
  const channel = (value: number) =>
    Math.round(Math.min(Math.max(value, 0), 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

/** Il primo riempimento pieno e visibile del nodo. */
function solidFill(node: FigmaNode): string | null {
  const fill = node.fills?.find((f) => f.type === "SOLID" && f.visible !== false && f.color);
  return fill?.color ? toHex(fill.color) : null;
}

/**
 * Da «headline@48» a { role: "headline", maxChars: 48 }. Il suffisso e' come
 * il marketing dichiara quanto testo entra in quel riquadro senza che il
 * layout si rompa.
 */
export function parseLayerName(name: string): { role: string; maxChars: number | null } {
  const [rawRole, rawMax] = name.trim().split("@");
  const role = rawRole.trim().toLowerCase();
  const parsed = rawMax === undefined ? Number.NaN : Number.parseInt(rawMax, 10);
  return { role, maxChars: Number.isInteger(parsed) && parsed > 0 ? parsed : null };
}

function isRole(value: string): value is TextSlot["role"] {
  return (FIGMA_ROLES as readonly string[]).includes(value);
}

/** Quanti caratteri stanno nel riquadro, quando il nome non lo dichiara. */
function estimateMaxChars(node: FigmaNode): number {
  const box = node.absoluteBoundingBox;
  const size = node.style?.fontSize ?? 16;
  if (!box || size <= 0) return 120;

  const perLine = Math.max(1, Math.floor(box.width / (size * 0.55)));
  const lineHeight = node.style?.lineHeightPx ?? size * 1.2;
  const lines = Math.max(1, Math.floor(box.height / lineHeight));
  return perLine * lines;
}

/* ------------------------------------------------------------------ */
/* Estrazione                                                           */
/* ------------------------------------------------------------------ */

function walk(node: FigmaNode, visit: (n: FigmaNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

const FORMAT_KEYS: AssetFormat[] = ["poster-a4", "linkedin", "ig-feed", "ig-story"];

function isFormat(value: string): value is AssetFormat {
  return (FORMAT_KEYS as string[]).includes(value);
}

/**
 * Un frame Figma diventa la definizione di un formato: fondo, tipografia per
 * ruolo, riquadro immagine, posizione del marchio.
 *
 * I numeri escono dai dati del nodo cosi' come sono. Nessun arrotondamento a
 * una griglia: il template e' la fonte di verita', e un titolo a 47.5px deve
 * restare a 47.5px.
 */
function frameToSpec(
  templateName: string,
  format: AssetFormat,
  frame: FigmaNode,
): TemplateSpec["frames"][AssetFormat] {
  const origin = frame.absoluteBoundingBox ?? { x: 0, y: 0, width: 0, height: 0 };

  const slots: TextSlot[] = [];
  let imageSlot: TemplateSpec["frames"][AssetFormat]["imageSlot"];
  let logo: TemplateSpec["frames"][AssetFormat]["logo"] | null = null;

  walk(frame, (node) => {
    if (node.id === frame.id) return;

    const { role, maxChars } = parseLayerName(node.name);
    const box = node.absoluteBoundingBox;

    if (role === "image" || role === "photo") {
      if (box) {
        imageSlot = {
          x: box.x - origin.x,
          y: box.y - origin.y,
          w: box.width,
          h: box.height,
          fit: "cover",
        };
      }
      return;
    }

    if (role === "logo" || role === "marchio") {
      if (box) {
        logo = {
          x: box.x - origin.x,
          y: box.y - origin.y,
          w: box.width,
          color: solidFill(node) ?? "#ffffff",
        };
      }
      return;
    }

    if (node.type !== "TEXT") return;

    if (!isRole(role)) {
      throw new UnknownRoleError(templateName, format, node.name, FIGMA_ROLES);
    }

    slots.push({
      id: node.id,
      role,
      maxChars: maxChars ?? estimateMaxChars(node),
      fontSize: node.style?.fontSize ?? 16,
      fontWeight: node.style?.fontWeight ?? 400,
      lineHeight: node.style?.lineHeightPx ?? (node.style?.fontSize ?? 16) * 1.2,
      letterSpacing: node.style?.letterSpacing ?? 0,
      color: solidFill(node) ?? "#ffffff",
    });
  });

  if (slots.length === 0) {
    throw new TemplateIncompleteError(
      templateName,
      `il frame «${format}» non contiene nessun livello di testo riconosciuto. ` +
        `Rinomina i livelli con i ruoli: ${FIGMA_ROLES.join(", ")}.`,
    );
  }

  if (!logo) {
    throw new TemplateIncompleteError(
      templateName,
      `il frame «${format}» non ha un livello «logo». Il marchio sta su ogni asset.`,
    );
  }

  const background =
    solidFill(frame) ?? (frame.backgroundColor ? toHex(frame.backgroundColor) : "#720026");

  return { background, slots, imageSlot, logo };
}

/**
 * Una pagina «TPL/…» diventa un template. Ogni frame dentro la pagina si
 * chiama come un formato.
 */
export function pageToSpec(page: FigmaNode, lastModified: string): TemplateSpec {
  const name = page.name.replace(/^TPL\//, "").trim();

  const frames = {} as TemplateSpec["frames"];
  const formats: AssetFormat[] = [];

  for (const child of page.children ?? []) {
    const key = child.name.trim().toLowerCase();
    if (!isFormat(key)) continue;

    frames[key] = frameToSpec(name, key, child);
    formats.push(key);
  }

  if (formats.length === 0) {
    throw new TemplateIncompleteError(
      name,
      `nessun frame riconosciuto. I frame devono chiamarsi ${FORMAT_KEYS.join(", ")}.`,
    );
  }

  if (!formats.includes("poster-a4")) {
    throw new TemplateIncompleteError(
      name,
      `manca il frame «poster-a4». È il formato di riferimento da cui derivano gli altri: ` +
        `senza, il template non è pubblicabile.`,
    );
  }

  return { id: page.id, name, formats, frames, updatedAt: lastModified };
}

/* ------------------------------------------------------------------ */
/* Il client                                                            */
/* ------------------------------------------------------------------ */

function credentials(): { token: string; fileKey: string } {
  const missing: string[] = [];
  if (!env.figmaToken) missing.push("FIGMA_TOKEN");
  if (!env.figmaFileKey) missing.push("FIGMA_FILE_KEY");
  if (missing.length > 0) throw new FigmaNotConfiguredError(missing);

  return { token: env.figmaToken!, fileKey: env.figmaFileKey! };
}

async function call<T>(endpoint: string, token: string): Promise<T> {
  const response = await fetch(`${API}${endpoint}`, {
    headers: { "X-Figma-Token": token },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new FigmaRequestError(response.status, endpoint, detail.slice(0, 200));
  }

  return (await response.json()) as T;
}

export const figmaTemplates: TemplateSource = {
  /**
   * Rilegge la libreria e riscrive la cache. E' l'unica operazione che tocca
   * la rete: `list()` e `get()` leggono il database, perche' la console li
   * chiama a ogni caricamento di pagina e il rate limit di Figma e' reale.
   */
  async sync() {
    const { token, fileKey } = credentials();

    const file = await call<FigmaFile>(`/v1/files/${fileKey}`, token);

    const pages = (file.document.children ?? []).filter((page) =>
      page.name.trim().startsWith("TPL/"),
    );

    if (pages.length === 0) {
      throw new TemplateIncompleteError(
        file.name,
        `nessuna pagina «TPL/…» nel file. Vedi TEMPLATES.md per la convenzione.`,
      );
    }

    const specs = pages.map((page) => pageToSpec(page, file.lastModified));
    const result = await writeTemplateSpecs(specs);

    return { ...result, at: new Date().toISOString() };
  },

  async list() {
    return listTemplateSpecs();
  },

  async get(id: string) {
    const spec = await readTemplateSpec(id);
    if (!spec) {
      throw new TemplateIncompleteError(
        id,
        `non è in cache. Esegui una sincronizzazione prima di usarlo.`,
      );
    }
    return spec;
  },
};

/** Anteprime PNG dei frame, per la libreria dei template nella console. */
export async function figmaPreviews(nodeIds: string[]): Promise<Record<string, string>> {
  if (nodeIds.length === 0) return {};
  const { token, fileKey } = credentials();

  const ids = encodeURIComponent(nodeIds.join(","));
  const data = await call<{ images: Record<string, string | null>; err?: string }>(
    `/v1/images/${fileKey}?ids=${ids}&format=png&scale=2`,
    token,
  );

  const out: Record<string, string> = {};
  for (const [id, url] of Object.entries(data.images)) {
    if (url) out[id] = url;
  }
  return out;
}
