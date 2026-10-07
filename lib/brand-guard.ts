import { defaultTextColor, groundOf } from "@/components/studio/asset-canvas";
import { BRAND, FORMATS, UNVERIFIED, type FormatId } from "./brand";
import { DEFAULT_FONT } from "./fonts";
import type { ArchetypeId, AssetLayout, Block } from "./layout-model";
import type { Attachment, BriefParse, GuardCheck, GuardStatus, VariantCopy } from "./types";

/**
 * Il controllo del brand su un asset preciso.
 *
 * Legge l'impaginazione come dato e il copy come testo, e applica le regole
 * di `lib/brand.ts`: la palette e' quella del Brand Kit, il carattere e'
 * Lexend, il marchio c'e' ed e' in alto a sinistra, ogni cifra ha una fonte
 * nei documenti allegati, il disclaimer sta in calce, il testo regge il
 * contrasto AA. Nessuna rete, nessun modello: sono regole, non opinioni.
 *
 * Un `fail` blocca approvazione e pubblicazione. Un `warn` lascia passare ma
 * resta scritto sull'asset, perche' chi approva lo veda.
 */

export interface GuardInput {
  copy: VariantCopy;
  layout: AssetLayout;
  archetype: ArchetypeId;
  format: FormatId;
  brief: BriefParse | null;
  attachments: Attachment[];
}

export interface GuardResult {
  status: GuardStatus;
  checks: GuardCheck[];
}

/** Ogni valore del Brand Kit e' ammesso su un asset. Niente altro. */
const PALETTE = new Set(Object.values(BRAND).map((hex) => hex.toLowerCase()));

function check(key: string, label: string, status: GuardStatus, detail: string | null = null): GuardCheck {
  return { key, label, status, detail };
}

function worst(statuses: GuardStatus[]): GuardStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  return "pass";
}

/* ------------------------------------------------------------------ */
/* Colori                                                               */
/* ------------------------------------------------------------------ */

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** I colori scelti a mano sull'asset: fondo e ogni testo ricolorato. */
function chosenColors(layout: AssetLayout): { where: string; hex: string }[] {
  const out: { where: string; hex: string }[] = [];
  if (layout.style?.background) out.push({ where: "fondo", hex: layout.style.background.toLowerCase() });
  for (const block of layout.blocks) {
    if (block.color && block.visible) out.push({ where: block.kind, hex: block.color.toLowerCase() });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Testo                                                                */
/* ------------------------------------------------------------------ */

/** I campi del copy che finiscono stampati sull'asset. */
function printedText(copy: VariantCopy): string[] {
  return [copy.eyebrow, copy.headline, copy.subhead, copy.body, copy.badge ?? "", copy.cta_label, copy.disclaimer ?? ""].filter(Boolean);
}

/** Cifre, percentuali, orari, anni: tutto quello che deve avere una fonte. */
export function numericTokens(text: string): string[] {
  const found = text.match(/\d[\d.,:]*\d|\d/g) ?? [];
  return [...new Set(found.map((t) => t.replace(/[.,:]$/, "")))];
}

/** Le fonti allegate, in un testo solo, normalizzato per il confronto. */
function sourceText(attachments: Attachment[], brief: BriefParse | null): string {
  const parts = attachments.map((a) => a.content ?? "").filter(Boolean);
  // I fatti gia' verificati nel brief contano come fonte: li ha estratti il
  // lettore del brief dagli stessi allegati.
  for (const fact of brief?.facts ?? []) if (fact.verified) parts.push(fact.value);
  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/* Il controllo                                                         */
/* ------------------------------------------------------------------ */

export function checkAsset(input: GuardInput): GuardResult {
  const { copy, layout, archetype, format, brief, attachments } = input;
  const checks: GuardCheck[] = [];
  const ground = groundOf(archetype, layout.style);
  const visible = layout.blocks.filter((b) => b.visible);

  // 1. Palette: ogni colore scelto a mano deve essere del Brand Kit.
  const offBrand = chosenColors(layout).filter((c) => !PALETTE.has(c.hex));
  checks.push(
    offBrand.length === 0
      ? check("palette", "Palette istituzionale", "pass", "tutti i colori sono del Brand Kit")
      : check(
          "palette",
          "Palette istituzionale",
          "fail",
          `${offBrand.length} ${offBrand.length === 1 ? "colore" : "colori"} fuori palette: ${offBrand.map((c) => `${c.where} ${c.hex}`).join(", ")}`,
        ),
  );

  // 2. Carattere: Lexend, sempre.
  const font = layout.style?.font ?? DEFAULT_FONT;
  checks.push(
    font === DEFAULT_FONT
      ? check("font", "Lexend su tutti i livelli", "pass", "700 / 400, nessuna sostituzione")
      : check("font", "Lexend su tutti i livelli", "fail", `carattere «${font}» non ammesso dal Brand Kit`),
  );

  // 3. Marchio: presente, visibile, in alto a sinistra.
  const logo = visible.find((b) => b.kind === "logo");
  if (!logo) {
    checks.push(check("logo", "Logo in alto a sinistra", "fail", "il marchio non e' sull'asset"));
  } else if (logo.y > 0.2 || logo.x > 0.3) {
    checks.push(check("logo", "Logo in alto a sinistra", "warn", "il marchio non e' nell'angolo in alto a sinistra"));
  } else {
    checks.push(check("logo", "Logo in alto a sinistra", "pass", "area di rispetto corretta"));
  }

  // 4. Dati con fonte: niente [DA VERIFICARE] stampato, ogni cifra negli allegati.
  const texts = printedText(copy);
  const unverified = texts.filter((t) => t.includes(UNVERIFIED));
  if (unverified.length > 0) {
    checks.push(check("claims", "Claim con fonte", "fail", `${unverified.length} ${unverified.length === 1 ? "testo contiene" : "testi contengono"} ${UNVERIFIED}: completalo o toglilo`));
  } else {
    const sources = sourceText(attachments, brief);
    const tokens = [...new Set(texts.flatMap(numericTokens))];
    if (tokens.length === 0) {
      checks.push(check("claims", "Claim con fonte", "pass", "nessun dato numerico sull'asset"));
    } else if (!sources) {
      checks.push(check("claims", "Claim con fonte", "warn", `${tokens.length} dati sull'asset e nessuna fonte allegata`));
    } else {
      const missing = tokens.filter((t) => !sources.includes(t));
      checks.push(
        missing.length === 0
          ? check("claims", "Claim con fonte", "pass", `${tokens.length} dati, tutti nelle fonti allegate`)
          : check("claims", "Claim con fonte", "fail", `${missing.length === 1 ? "dato" : "dati"} senza fonte: ${missing.join(", ")}`),
      );
    }
  }

  // 5. Disclaimer: obbligatorio sui bandi, in calce.
  const needsDisclaimer = Boolean(brief?.disclaimer);
  const disclaimerBlock = visible.find((b) => b.kind === "disclaimer");
  if (!needsDisclaimer) {
    checks.push(check("disclaimer", "Disclaimer normativo", "pass", "non richiesto da questo brief"));
  } else if (!copy.disclaimer?.trim()) {
    checks.push(check("disclaimer", "Disclaimer normativo", "fail", "il brief lo richiede, il copy non lo ha"));
  } else if (!disclaimerBlock) {
    checks.push(
      format === "poster-a4"
        ? check("disclaimer", "Disclaimer normativo", "fail", "sul poster il disclaimer deve essere visibile in calce")
        : check("disclaimer", "Disclaimer normativo", "warn", `non visibile sul formato ${FORMATS[format].label}: va nella caption`),
    );
  } else if (disclaimerBlock.y < 0.7) {
    checks.push(check("disclaimer", "Disclaimer normativo", "warn", "il disclaimer non e' in calce"));
  } else {
    checks.push(check("disclaimer", "Disclaimer normativo", "pass", "presente in calce"));
  }

  // 6. Contrasto AA fra ogni testo e il fondo su cui si posa.
  const textKinds: Block["kind"][] = ["headline", "subhead", "body", "cta", "eyebrow", "disclaimer"];
  const ratios = visible
    .filter((b) => textKinds.includes(b.kind))
    .map((b) => ({ kind: b.kind, ratio: contrastRatio(b.color ?? defaultTextColor(b.kind, ground.onDark), ground.bg) }));
  const weak = ratios.filter((r) => r.ratio < 4.5 && r.kind !== "subhead" && r.kind !== "eyebrow");
  const min = ratios.reduce((m, r) => Math.min(m, r.ratio), Number.POSITIVE_INFINITY);
  checks.push(
    weak.length === 0
      ? check("contrast", "Contrasto AA", "pass", Number.isFinite(min) ? `rapporto minimo ${min.toFixed(1)}:1` : "nessun testo")
      : check("contrast", "Contrasto AA", "warn", `${weak.map((w) => `${w.kind} ${w.ratio.toFixed(1)}:1`).join(", ")} sotto 4.5:1`),
  );

  return { status: worst(checks.map((c) => c.status)), checks };
}

/** Riassume piu' asset in un verdetto solo: il peggiore vince. */
export function overallStatus(statuses: (GuardStatus | null | undefined)[]): GuardStatus | null {
  const known = statuses.filter((s): s is GuardStatus => Boolean(s));
  if (known.length === 0 || known.length < statuses.length) return null;
  return worst(known);
}
