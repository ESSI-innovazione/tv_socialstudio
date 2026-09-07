import { BRAND, FONT_FAMILY, FORMATS, LOGO_PATH, LOGO_VIEWBOX, type FormatId } from "@/lib/brand";
import {
  fontSizeOf,
  type ArchetypeId,
  type AssetLayout,
  type Block,
} from "@/lib/layout-model";
import type { VariantCopy } from "@/lib/types";

/**
 * Disegna l'asset a dimensione nativa leggendo il layout come dato.
 *
 * E' l'unico posto in cui un blocco diventa pixel: lo usano l'anteprima,
 * l'editor e — al passo successivo — il rendering server-side. Se preview ed
 * export divergessero, sarebbe perche' esistono due compositori: qui ce n'e' uno.
 */

export interface AssetCanvasProps {
  copy: VariantCopy;
  layout: AssetLayout;
  archetype: ArchetypeId;
  photo: string;
  /** Origine assoluta, richiesta dal rendering server-side. Vuota nel browser. */
  baseUrl?: string;
}

/** Su quale fondo si posa il testo: decide il colore dell'inchiostro. */
function groundOf(archetype: ArchetypeId): { bg: string; onDark: boolean } {
  if (archetype === "countdown-in-evidenza") return { bg: BRAND.warmTint, onDark: false };
  return { bg: BRAND.wine, onDark: true };
}

export function AssetCanvas({ copy, layout, archetype, photo, baseUrl = "" }: AssetCanvasProps) {
  const spec = FORMATS[layout.format];
  const ground = groundOf(archetype);

  // L'immagine sta sempre sotto al testo, qualunque sia il suo posto nell'elenco.
  const ordered = [...layout.blocks].sort(
    (a, b) => Number(a.kind === "image" ? 0 : 1) - Number(b.kind === "image" ? 0 : 1),
  );

  return (
    <div
      style={{
        position: "relative",
        width: spec.width,
        height: spec.height,
        backgroundColor: ground.bg,
        fontFamily: FONT_FAMILY,
        overflow: "hidden",
        display: "flex",
      }}
    >
      {ordered.map((b) =>
        b.visible ? (
          <BlockView
            key={b.id}
            block={b}
            copy={copy}
            format={layout.format}
            archetype={archetype}
            onDark={ground.onDark}
            photo={photo}
            baseUrl={baseUrl}
          />
        ) : null,
      )}
    </div>
  );
}

function BlockView({
  block,
  copy,
  format,
  archetype,
  onDark,
  photo,
  baseUrl,
}: {
  block: Block;
  copy: VariantCopy;
  format: FormatId;
  archetype: ArchetypeId;
  onDark: boolean;
  photo: string;
  baseUrl: string;
}) {
  const spec = FORMATS[format];
  const left = block.x * spec.width;
  const top = block.y * spec.height;
  const width = block.w * spec.width;
  const size = fontSizeOf(format, block);

  const frame: React.CSSProperties = {
    position: "absolute",
    left,
    top,
    width,
    display: "flex",
  };

  if (block.kind === "image") {
    const height = (block.h ?? 0.25) * spec.height;
    const focal = block.focal ?? { x: 0.5, y: 0.5 };
    const fullBleed = block.w >= 0.99 && (block.h ?? 0) >= 0.99;
    // Su un visual generato il velo si mette sempre: la palette del modello
    // non e' garantita, quella del brand si'.
    const generated = photo.includes("visual");
    const sideBand = block.w < 0.99 && (block.h ?? 0) >= 0.9;

    // Testo su foto senza velo non regge il contrasto: il velo fa parte
    // dell'impianto, non e' un ritocco. Coordinate esplicite invece di inset,
    // che Satori interpreta in modo meno prevedibile.
    const veil = fullBleed
      ? "linear-gradient(180deg, rgba(114,0,38,.38) 0%, rgba(114,0,38,.86) 56%, rgba(114,0,38,.97) 100%)"
      : sideBand
        ? "linear-gradient(90deg, #720026 0%, rgba(114,0,38,.92) 26%, rgba(114,0,38,0) 100%)"
        : generated
          // Un blocco piccolo non regge il velo pieno, ma un visual generato
          // non puo' restare senza: la sua palette non e' garantita. Una
          // velatura uniforme e leggera lo riporta dentro il brand senza
          // coprire il soggetto. Prima `generated` si calcolava e si buttava
          // via, e il velo su questi blocchi non arrivava mai.
          ? "linear-gradient(180deg, rgba(114,0,38,.20) 0%, rgba(114,0,38,.20) 100%)"
          : null;

    return (
      <div
        style={{ position: "absolute", left, top, width, height, display: "flex", overflow: "hidden" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoSrc(photo, baseUrl)}
          alt=""
          width={Math.round(width)}
          height={Math.round(height)}
          style={{
            width,
            height,
            objectFit: "cover",
            objectPosition: `${Math.round(focal.x * 100)}% ${Math.round(focal.y * 100)}%`,
          }}
        />
        {veil ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width,
              height,
              display: "flex",
              backgroundImage: veil,
            }}
          />
        ) : null}
      </div>
    );
  }

  if (block.kind === "logo") {
    const mark = size * 1.6;
    return (
      <div style={{ ...frame, width: "auto", alignItems: "center", gap: mark * 0.4 }}>
        <svg
          width={mark}
          height={mark * (108 / 105)}
          viewBox={LOGO_VIEWBOX}
          fill={onDark ? "#ffffff" : BRAND.wine}
          style={{ display: "flex" }}
        >
          <path d={LOGO_PATH} />
        </svg>
        <span
          style={{
            fontSize: size,
            fontWeight: 700,
            letterSpacing: "0.15em",
            whiteSpace: "nowrap",
            color: onDark ? "#ffffff" : BRAND.wine,
          }}
        >
          TIME VISION
        </span>
      </div>
    );
  }

  if (block.kind === "badge") {
    if (!copy.badge) return null;
    return (
      <div style={{ ...frame, width: "auto", maxWidth: width }}>
        <div
          style={{
            display: "flex",
            backgroundColor: BRAND.coral,
            padding: `${Math.round(size * 0.72)}px ${Math.round(size * 1.1)}px`,
          }}
        >
          <span
            style={{
              fontSize: size,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "#ffffff",
              whiteSpace: "nowrap",
            }}
          >
            {copy.badge.toUpperCase()}
          </span>
        </div>
      </div>
    );
  }

  if (block.kind === "cta") {
    return (
      <div style={{ ...frame, flexDirection: "column", gap: Math.round(size * 0.35) }}>
        <span
          style={{
            fontSize: size,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: onDark ? "#ffffff" : BRAND.ink,
          }}
        >
          {copy.cta_label}
        </span>
        <span style={{ fontSize: Math.round(size * 0.68), color: BRAND.apricot }}>
          {copy.cta_url}
        </span>
      </div>
    );
  }

  const text = textFor(block, copy);
  if (!text) return null;

  return (
    <div style={{ ...frame, justifyContent: justify(block.align) }}>
      <span style={{ ...typeStyle(block, size, onDark, archetype), textAlign: block.align }}>
        {text}
      </span>
    </div>
  );
}

function textFor(block: Block, copy: VariantCopy): string {
  switch (block.kind) {
    case "eyebrow":
      return copy.eyebrow ? copy.eyebrow.toUpperCase() : "";
    case "headline":
      return copy.headline;
    case "subhead":
      return copy.subhead;
    case "body":
      return copy.body;
    case "disclaimer":
      return copy.disclaimer ?? "";
    default:
      return "";
  }
}

function typeStyle(
  block: Block,
  size: number,
  onDark: boolean,
  archetype: ArchetypeId,
): React.CSSProperties {
  const base: React.CSSProperties = { fontSize: size, width: "100%" };

  switch (block.kind) {
    case "eyebrow":
      return {
        ...base,
        fontWeight: 600,
        letterSpacing: "0.14em",
        color: onDark ? BRAND.onWineFaint : BRAND.rose,
      };
    case "headline":
      return {
        ...base,
        fontWeight: 800,
        lineHeight: 1.04,
        letterSpacing: "-0.035em",
        color: onDark ? "#ffffff" : BRAND.wine,
      };
    case "subhead":
      return {
        ...base,
        fontWeight: 600,
        lineHeight: 1.15,
        letterSpacing: "-0.02em",
        color: BRAND.apricot,
      };
    case "body":
      return {
        ...base,
        lineHeight: 1.5,
        color: onDark ? BRAND.onWine : BRAND.inkSoft,
      };
    case "disclaimer":
      return {
        ...base,
        lineHeight: 1.4,
        color: onDark ? BRAND.onWineFaint : BRAND.inkFaint,
      };
    default:
      return { ...base, color: archetype === "countdown-in-evidenza" ? BRAND.ink : "#ffffff" };
  }
}

function justify(align: Block["align"]): string {
  if (align === "center") return "center";
  if (align === "right") return "flex-end";
  return "flex-start";
}

/**
 * Il visual puo' essere un nome di file dell'archivio oppure un indirizzo
 * nostro, se e' stato generato e riospitato. Distinguere serve qui e basta.
 */
function photoSrc(photo: string, baseUrl: string): string {
  if (photo.startsWith("http")) return photo;
  if (photo.startsWith("/")) return `${baseUrl}${photo}`;
  return `${baseUrl}/brand/${photo}`;
}
