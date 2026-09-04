import { LOGO_PATH, LOGO_VIEWBOX } from "@/lib/brand";
import {
  FORMAT_SIZE,
  type AssetFormat,
  type CampaignFacts,
  type TemplateSpec,
  type TextSlot,
} from "@/lib/integrations/types";

/**
 * L'impaginazione, una sola, parametrica sul formato.
 *
 * Quattro componenti separati divergono: qualcuno corregge il titolo su
 * LinkedIn e si dimentica della story, e sei mesi dopo gli asset della stessa
 * campagna non si somigliano piu'. Qui c'e' un componente che cambia
 * proporzione, non quattro che prendono vita propria.
 *
 * Vincolo di scrittura: solo flexbox e stili inline. Satori non conosce CSS
 * grid, backdrop-filter, i filtri CSS, ne' la scorciatoia `background`.
 * Rispettarlo qui significa che lo stesso albero vale anche per Chromium.
 */

export interface CompositionProps {
  spec: TemplateSpec;
  facts: CampaignFacts;
  format: AssetFormat;
  /** Origine assoluta: Satori scarica le immagini, non conosce i percorsi relativi. */
  baseUrl: string;
}

const FONT = "'Lexend', 'Segoe UI', system-ui, sans-serif";

const ON_WINE_FAINT = "#d8a3ae";
const CORAL = "#ff7f51";
const APRICOT = "#ff9b54";

/** Il disclaimer non scende mai sotto i 12px: e' un requisito di leggibilita'. */
const DISCLAIMER_FLOOR = 12;

/** Sotto questo il testo diventa illeggibile: meglio troncare che rimpicciolire ancora. */
const MIN_FIT = 0.72;

/** L'ordine verticale dei ruoli. Il disclaimer sta in fondo, sempre. */
const FLOW: TextSlot["role"][] = ["eyebrow", "headline", "subhead", "body", "deadline", "cta"];

function slotOf(spec: TemplateSpec, format: AssetFormat, role: TextSlot["role"]): TextSlot | null {
  return spec.frames[format]?.slots.find((s) => s.role === role) ?? null;
}

function rawCopy(facts: CampaignFacts, role: TextSlot["role"]): string | null {
  switch (role) {
    case "headline":
      return facts.headline;
    case "subhead":
      return facts.subhead;
    case "body":
      return facts.body ?? null;
    case "eyebrow":
      return facts.eyebrow ?? null;
    case "deadline":
      return facts.deadline?.label ?? null;
    case "cta":
      return facts.cta;
    case "disclaimer":
      return facts.disclaimer ?? null;
    default:
      return null;
  }
}

/**
 * `maxChars` e' la dichiarazione del template: quanto testo entra in quel
 * riquadro senza rompere l'impaginazione. Ignorarla e' come non averla: il
 * testo lungo si mangia il blocco sotto. Si taglia a fine parola, mai a meta'.
 *
 * Il disclaimer non si tocca: e' testo legale, o c'e' tutto o non serve.
 */
export function fitToSlot(text: string, slot: TextSlot): string {
  if (slot.role === "disclaimer") return text;
  if (slot.maxChars <= 0 || text.length <= slot.maxChars) return text;

  const cut = text.slice(0, slot.maxChars - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const body = lastSpace > slot.maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;

  return `${body.replace(/[.,;:·\-–—]$/, "")}…`;
}

/** Ingombro extra oltre le righe di testo: l'imbottitura della banda, la seconda riga della CTA. */
function extraHeight(slot: TextSlot, scale: number): number {
  if (slot.role === "deadline") return slot.fontSize * scale * 1.44;
  if (slot.role === "cta") return slot.fontSize * scale * 1.03;
  return 0;
}

/** Altezza stimata del blocco a una data scala tipografica. */
function heightAt(text: string, slot: TextSlot, width: number, scale: number): number {
  const size = slot.fontSize * scale;
  const glyph = slot.fontWeight >= 700 ? 0.55 : 0.52;
  const perLine = Math.max(1, Math.floor(width / (size * glyph)));
  const lines = Math.max(1, Math.ceil(text.length / perLine));
  return lines * slot.lineHeight * scale + extraHeight(slot, scale);
}

function gapAt(slot: TextSlot, scale: number): number {
  return Math.max(slot.fontSize * scale * 0.45, 8);
}

/**
 * Trova la scala tipografica piu' alta con cui la colonna ci sta.
 *
 * Comprimere le posizioni senza toccare i corpi e' quello che faceva
 * sovrapporre i blocchi: le righe restavano alte uguali e finivano una
 * sull'altra. Qui si riduce il testo, non la distanza fra i testi.
 */
function fitScale(
  entries: { slot: TextSlot; text: string }[],
  width: number,
  available: number,
): number {
  for (let scale = 1; scale >= MIN_FIT; scale -= 0.02) {
    const total = entries.reduce(
      (sum, e) => sum + heightAt(e.text, e.slot, width, scale) + gapAt(e.slot, scale),
      0,
    );
    if (total <= available) return scale;
  }
  return MIN_FIT;
}

function styleFor(slot: TextSlot, scale: number): React.CSSProperties {
  const isDisclaimer = slot.role === "disclaimer";
  const size = isDisclaimer
    ? Math.max(slot.fontSize, DISCLAIMER_FLOOR)
    : Math.max(slot.fontSize * scale, DISCLAIMER_FLOOR);

  return {
    fontSize: size,
    fontWeight: slot.fontWeight,
    lineHeight: `${isDisclaimer ? slot.lineHeight : slot.lineHeight * scale}px`,
    letterSpacing: `${slot.letterSpacing * (isDisclaimer ? 1 : scale)}px`,
    color: isDisclaimer && slot.color === "#ffffff" ? ON_WINE_FAINT : slot.color,
  };
}

export function Composition({ spec, facts, format, baseUrl }: CompositionProps) {
  const size = FORMAT_SIZE[format];
  const frame = spec.frames[format];

  const wide = size.w > size.h;
  const pad = frame.logo.x;
  const imageBox = frame.imageSlot;

  // Sull'orizzontale il testo tiene la sinistra e la foto entra da destra.
  const columnWidth = wide && imageBox ? imageBox.x - pad * 1.5 : size.w - pad * 2;

  const disclaimerSlot = slotOf(spec, format, "disclaimer");
  const disclaimerText = disclaimerSlot ? rawCopy(facts, "disclaimer") : null;
  const disclaimerHeight =
    disclaimerSlot && disclaimerText
      ? heightAt(disclaimerText, disclaimerSlot, size.w - pad * 2, 1) + pad * 0.4
      : 0;

  const entries: { slot: TextSlot; text: string }[] = [];
  for (const role of FLOW) {
    const slot = slotOf(spec, format, role);
    if (!slot) continue;
    const raw = rawCopy(facts, role);
    if (!raw) continue;
    entries.push({ slot, text: fitToSlot(raw, slot) });
  }

  const logoBottom = frame.logo.y + frame.logo.w * 0.42 + pad * 0.5;

  // Sul verticale la foto ha diritto a una fascia: il testo non se la prende tutta.
  const reservedPhoto = !wide && imageBox ? Math.min(imageBox.h, size.h * 0.22) : 0;
  const available = size.h - pad - disclaimerHeight - logoBottom - reservedPhoto;

  const scale = fitScale(entries, columnWidth, available);

  let cursor = logoBottom;
  const placed = entries.map((entry) => {
    const y = cursor;
    cursor += heightAt(entry.text, entry.slot, columnWidth, scale) + gapAt(entry.slot, scale);
    return { ...entry, y };
  });

  const photoTop = wide ? 0 : cursor;
  const photoHeight = wide
    ? size.h
    : Math.max(0, size.h - pad - disclaimerHeight - photoTop - pad * 0.3);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: size.w,
        height: size.h,
        backgroundColor: frame.background,
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      {imageBox && facts.imageKey && photoHeight > 24 ? (
        <Photo
          baseUrl={baseUrl}
          imageKey={facts.imageKey}
          x={wide ? imageBox.x : pad}
          y={photoTop}
          w={wide ? size.w - imageBox.x : size.w - pad * 2}
          h={wide ? size.h : photoHeight}
          fit={imageBox.fit}
          wide={wide}
          ground={frame.background}
        />
      ) : null}

      <Logo logo={frame.logo} />

      {placed.map(({ slot, text, y }) =>
        slot.role === "deadline" ? (
          <DeadlineBand key={slot.id} slot={slot} text={text} x={pad} y={y} scale={scale} />
        ) : (
          <div
            key={slot.id}
            style={{
              position: "absolute",
              left: pad,
              top: y,
              width: columnWidth,
              display: "flex",
              flexDirection: "column",
              gap: slot.role === "cta" ? slot.fontSize * scale * 0.28 : 0,
            }}
          >
            <span style={{ ...styleFor(slot, scale), width: "100%" }}>{text}</span>
            {slot.role === "cta" ? (
              <span
                style={{
                  fontSize: slot.fontSize * scale * 0.62,
                  lineHeight: `${slot.fontSize * scale * 0.8}px`,
                  color: APRICOT,
                }}
              >
                {facts.ctaUrl}
              </span>
            ) : null}
          </div>
        ),
      )}

      {disclaimerSlot && disclaimerText ? (
        <div
          style={{
            position: "absolute",
            left: pad,
            top: size.h - pad * 0.6 - disclaimerHeight + pad * 0.4,
            width: size.w - pad * 2,
            display: "flex",
          }}
        >
          <span style={{ ...styleFor(disclaimerSlot, 1), width: "100%" }}>{disclaimerText}</span>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Logo({ logo }: { logo: TemplateSpec["frames"][AssetFormat]["logo"] }) {
  const mark = logo.w * 0.42;

  return (
    <div
      style={{
        position: "absolute",
        left: logo.x,
        top: logo.y,
        display: "flex",
        alignItems: "center",
        gap: mark * 0.4,
      }}
    >
      <svg
        width={mark}
        height={mark * (108 / 105)}
        viewBox={LOGO_VIEWBOX}
        fill={logo.color}
        style={{ display: "flex" }}
      >
        <path d={LOGO_PATH} />
      </svg>
      <span
        style={{
          fontSize: mark * 0.52,
          fontWeight: 700,
          letterSpacing: `${mark * 0.078}px`,
          whiteSpace: "nowrap",
          color: logo.color,
        }}
      >
        TIME VISION
      </span>
    </div>
  );
}

/** La banda corallo della scadenza: l'unico posto dove il corallo compare. */
function DeadlineBand({
  slot,
  text,
  x,
  y,
  scale,
}: {
  slot: TextSlot;
  text: string;
  x: number;
  y: number;
  scale: number;
}) {
  const size = slot.fontSize * scale;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "flex",
        backgroundColor: CORAL,
        padding: `${Math.round(size * 0.72)}px ${Math.round(size * 1.1)}px`,
      }}
    >
      <span
        style={{
          ...styleFor(slot, scale),
          color: "#ffffff",
          whiteSpace: "nowrap",
        }}
      >
        {text.toUpperCase()}
      </span>
    </div>
  );
}

function Photo({
  baseUrl,
  imageKey,
  x,
  y,
  w,
  h,
  fit,
  wide,
  ground,
}: {
  baseUrl: string;
  imageKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fit: "cover" | "contain";
  wide: boolean;
  ground: string;
}) {
  // Il velo fa parte dell'impianto: testo su foto senza velo non regge il
  // contrasto. Coordinate esplicite invece di `inset`, che Satori interpreta
  // in modo meno prevedibile.
  const veil = wide
    ? `linear-gradient(90deg, ${ground} 0%, rgba(114,0,38,.92) 26%, rgba(114,0,38,0) 100%)`
    : null;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        display: "flex",
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${baseUrl}/brand/${imageKey}`}
        alt=""
        width={Math.round(w)}
        height={Math.round(h)}
        style={{ width: w, height: h, objectFit: fit }}
      />
      {veil ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: w,
            height: h,
            display: "flex",
            backgroundImage: veil,
          }}
        />
      ) : null}
    </div>
  );
}
