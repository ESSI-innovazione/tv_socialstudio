import { pageToSpec, type FigmaNode } from "@/lib/integrations/figma";
import { FORMAT_SIZE, type AssetFormat, type CampaignFacts, type TemplateSpec } from "@/lib/integrations/types";

/**
 * Un template di prova nella forma esatta in cui Figma restituisce i nodi,
 * fatto passare dallo stesso estrattore che usa `sync()`.
 *
 * Serve a provare la catena intera — JSON di Figma, TemplateSpec, PNG — senza
 * un token. Quando la libreria vera sara' collegata, questo file resta solo
 * come banco di prova dei renderer.
 */

const WINE = { r: 0.4470588, g: 0, b: 0.14901961 };
const WHITE = { r: 1, g: 1, b: 1 };
const CORAL = { r: 1, g: 0.49803922, b: 0.31764707 };
const ON_WINE = { r: 0.9098039, g: 0.76862746, b: 0.79607844 };
const ON_WINE_FAINT = { r: 0.84705883, g: 0.6392157, b: 0.68235296 };

/** La scala tipografica del template, per formato. Presa dagli artboard approvati. */
const TYPE: Record<AssetFormat, Record<string, [number, number, number, number]>> = {
  // ruolo: [corpo, peso, interlinea, spaziatura]
  "poster-a4": {
    eyebrow: [13, 600, 15.6, 1.69],
    headline: [74, 800, 77, -2.59],
    subhead: [34, 600, 39.1, -0.68],
    body: [21, 400, 32.5, 0],
    deadline: [22, 800, 26.4, -0.22],
    cta: [30, 700, 36, -0.6],
    disclaimer: [12, 400, 16.8, 0],
  },
  linkedin: {
    eyebrow: [13, 600, 15.6, 1.3],
    headline: [62, 800, 64.5, -2.17],
    subhead: [28, 600, 32.2, -0.56],
    body: [21, 400, 31.5, 0],
    deadline: [17, 800, 20.4, -0.17],
    cta: [19, 700, 22.8, -0.38],
    disclaimer: [12, 400, 16.8, 0],
  },
  "ig-feed": {
    eyebrow: [22, 600, 26.4, 3.08],
    headline: [86, 800, 89.4, -3.01],
    subhead: [40, 600, 46, -0.8],
    body: [34, 400, 48.3, 0],
    deadline: [26, 800, 31.2, -0.26],
    cta: [34, 700, 40.8, -0.68],
    disclaimer: [17, 400, 23.8, 0],
  },
  "ig-story": {
    eyebrow: [24, 600, 28.8, 3.36],
    headline: [96, 800, 99.8, -3.36],
    subhead: [46, 600, 52.9, -0.92],
    body: [39, 400, 55.4, 0],
    deadline: [30, 800, 36, -0.3],
    cta: [38, 700, 45.6, -0.76],
    disclaimer: [19, 400, 26.6, 0],
  },
};

const COLOR: Record<string, typeof WHITE> = {
  eyebrow: ON_WINE_FAINT,
  headline: WHITE,
  subhead: CORAL,
  body: ON_WINE,
  deadline: WHITE,
  cta: WHITE,
  disclaimer: ON_WINE_FAINT,
};

const MAX_CHARS: Record<string, number> = {
  eyebrow: 28,
  headline: 48,
  subhead: 64,
  body: 220,
  deadline: 44,
  cta: 40,
  disclaimer: 320,
};

/** Il margine di sicurezza per formato, che è anche la posizione del marchio. */
const PAD: Record<AssetFormat, number> = {
  "poster-a4": 64,
  linkedin: 54,
  "ig-feed": 96,
  "ig-story": 96,
};

function frameNode(format: AssetFormat, offsetX: number): FigmaNode {
  const size = FORMAT_SIZE[format];
  const pad = PAD[format];
  const wide = size.w > size.h;

  const children: FigmaNode[] = [
    {
      id: `${format}:logo`,
      name: "logo",
      type: "VECTOR",
      absoluteBoundingBox: { x: offsetX + pad, y: pad, width: pad * 1.6, height: pad * 0.7 },
      fills: [{ type: "SOLID", visible: true, color: WHITE }],
    },
    {
      id: `${format}:image`,
      name: "image",
      type: "RECTANGLE",
      absoluteBoundingBox: wide
        ? { x: offsetX + size.w * 0.54, y: 0, width: size.w * 0.46, height: size.h }
        : { x: offsetX + pad, y: size.h * 0.62, width: size.w - pad * 2, height: size.h * 0.2 },
    },
  ];

  let y = pad * 3;
  for (const role of ["eyebrow", "headline", "subhead", "body", "deadline", "cta", "disclaimer"]) {
    const [fontSize, fontWeight, lineHeightPx, letterSpacing] = TYPE[format][role];
    children.push({
      id: `${format}:${role}`,
      name: `${role}@${MAX_CHARS[role]}`,
      type: "TEXT",
      absoluteBoundingBox: {
        x: offsetX + pad,
        y,
        width: (wide ? size.w * 0.48 : size.w - pad * 2),
        height: lineHeightPx * 2,
      },
      style: { fontSize, fontWeight, lineHeightPx, letterSpacing },
      fills: [{ type: "SOLID", visible: true, color: COLOR[role] }],
      characters: role,
    });
    y += lineHeightPx * 2 + 20;
  }

  return {
    id: `frame:${format}`,
    name: format,
    type: "FRAME",
    absoluteBoundingBox: { x: offsetX, y: 0, width: size.w, height: size.h },
    fills: [{ type: "SOLID", visible: true, color: WINE }],
    children,
  };
}

/** La pagina «TPL/Bando con countdown» come la restituirebbe l'API di Figma. */
export function fixturePage(): FigmaNode {
  let offset = 0;
  const frames: FigmaNode[] = [];

  for (const format of ["poster-a4", "linkedin", "ig-feed", "ig-story"] as AssetFormat[]) {
    frames.push(frameNode(format, offset));
    offset += FORMAT_SIZE[format].w + 200;
  }

  return { id: "1:0", name: "TPL/Bando con countdown", type: "CANVAS", children: frames };
}

export function fixtureSpec(): TemplateSpec {
  return pageToSpec(fixturePage(), "2026-09-04T10:00:00Z");
}

export const FIXTURE_FACTS: CampaignFacts = {
  campaign: "Voucher Cloud e Cybersecurity — MIMIT",
  headline: "Fino a 20.000 € a fondo perduto",
  subhead: "per cloud e cybersecurity",
  body: "Il MIMIT copre il 50% delle spese di PMI e lavoratori autonomi. 150 milioni di euro disponibili sull'intero territorio nazionale.",
  cta: "Scopri il voucher",
  ctaUrl: "timevision.it/voucher-cloud",
  eyebrow: "MIMIT · MISURA 2026",
  deadline: { label: "Click-day 10 novembre 2026 · ore 12:00", iso: "2026-11-10T12:00:00+01:00" },
  disclaimer:
    "Misura del Ministero delle Imprese e del Made in Italy. Importi, requisiti e termini sono quelli del decreto attuativo: verifica sempre il testo ufficiale prima di presentare domanda.",
  imageKey: "tv-digitale.jpg",
  sources: [
    { claim: "Contributo massimo 20.000 €", document: "scheda-misura-MIMIT.pdf" },
    { claim: "Intensità 50% delle spese", document: "scheda-misura-MIMIT.pdf" },
    { claim: "Click-day 10 novembre 2026", document: "scheda-misura-MIMIT.pdf" },
  ],
};

/**
 * Il caso peggiore realistico: titolo lungo, corpo lungo, disclaimer lungo.
 * Se l'impaginazione regge qui, regge sulle campagne vere.
 */
export const FIXTURE_FACTS_LONG: CampaignFacts = {
  ...FIXTURE_FACTS,
  headline: "Contributi a fondo perduto per la digitalizzazione delle piccole e medie imprese italiane",
  subhead: "cloud, cybersecurity e servizi di consulenza specialistica correlata",
  body: "Il Ministero delle Imprese e del Made in Italy copre il 50% delle spese ammissibili sostenute da piccole e medie imprese e da lavoratori autonomi titolari di partita IVA, con una dotazione complessiva di 150 milioni di euro distribuiti sull'intero territorio nazionale fino a esaurimento delle risorse disponibili.",
  deadline: { label: "Apertura dello sportello 10 novembre 2026 alle ore 12:00", iso: "2026-11-10T12:00:00+01:00" },
};
