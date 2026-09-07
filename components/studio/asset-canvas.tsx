import { BRAND, FORMATS, LOGO_PATH, LOGO_VIEWBOX, type FormatId } from "@/lib/brand";
import { fontFamilyFor } from "@/lib/fonts";
import {
  fontSizeOf,
  isDark,
  rgba,
  type ArchetypeId,
  type AssetLayout,
  type Block,
  type BlockKind,
  type LayoutStyle,
} from "@/lib/layout-model";
import type { VariantCopy } from "@/lib/types";

/**
 * Disegna l'asset a dimensione nativa leggendo il layout come dato.
 *
 * E' l'unico posto in cui un blocco diventa pixel: lo usano l'anteprima,
 * l'editor e il rendering server-side. Se preview ed export divergessero,
 * sarebbe perche' esistono due compositori: qui ce n'e' uno.
 *
 * Ogni blocco porta `data-block-id` e `data-block-kind`: al PNG non servono
 * (Satori li ignora), al video si': il CSS del reveal aggancia l'animazione
 * a quegli attributi.
 *
 * Il Brand Kit decide i colori di partenza. Chi impagina puo' cambiare il
 * fondo e il colore di ogni testo: la scelta sta nel layout, non qui, e
 * l'inchiostro di default si adatta da solo a un fondo chiaro o scuro.
 */

export interface AssetCanvasProps {
  copy: VariantCopy;
  layout: AssetLayout;
  archetype: ArchetypeId;
  photo: string;
  /** Origine assoluta, richiesta dal rendering server-side. Vuota nel browser. */
  baseUrl?: string;
}

export interface Ground {
  bg: string;
  onDark: boolean;
}

/** Su quale fondo si posa il testo: quello scelto, o quello dell'impianto. */
export function groundOf(archetype: ArchetypeId, style?: LayoutStyle): Ground {
  const bg = style?.background ?? (archetype === "countdown-in-evidenza" ? BRAND.warmTint : BRAND.wine);
  return { bg, onDark: isDark(bg) };
}

/** Il colore che un testo ha se nessuno l'ha scelto: dipende solo dal fondo. */
export function defaultTextColor(kind: BlockKind, onDark: boolean): string {
  switch (kind) {
    case "eyebrow":
      return onDark ? BRAND.onWineFaint : BRAND.rose;
    case "headline":
      return onDark ? "#ffffff" : BRAND.wine;
    case "subhead":
      return BRAND.apricot;
    case "body":
      return onDark ? BRAND.onWine : BRAND.inkSoft;
    case "disclaimer":
      return onDark ? BRAND.onWineFaint : BRAND.inkFaint;
    case "cta":
      return onDark ? "#ffffff" : BRAND.ink;
    case "badge":
      // Per la banda il colore e' quello del nastro, non della scritta.
      return BRAND.coral;
    default:
      return onDark ? "#ffffff" : BRAND.ink;
  }
}

export function AssetCanvas({ copy, layout, archetype, photo, baseUrl = "" }: AssetCanvasProps) {
  const spec = FORMATS[layout.format];
  const ground = groundOf(archetype, layout.style);

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
        // Sul server il font si chiama col suo nome; nel browser lo conosce
        // solo la variabile CSS. `baseUrl` c'e' soltanto sul server.
        fontFamily: fontFamilyFor(layout.style?.font, baseUrl ? "server" : "browser"),
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
            ground={ground}
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
  ground,
  photo,
  baseUrl,
}: {
  block: Block;
  copy: VariantCopy;
  format: FormatId;
  ground: Ground;
  photo: string;
  baseUrl: string;
}) {
  const spec = FORMATS[format];
  const left = block.x * spec.width;
  const top = block.y * spec.height;
  const width = block.w * spec.width;
  const size = fontSizeOf(format, block);
  const { onDark } = ground;

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

    // Il velo e' del colore del fondo: cosi' un asset blu ha una foto che
    // vira al blu, e la scelta di un colore resta una scelta sola. La sua
    // forza la decide chi impagina: a zero la foto resta nuda.
    const strength = block.veil ?? 1;
    const v = (alpha: number) => rgba(ground.bg, Math.round(alpha * strength * 1000) / 1000);

    // Testo su foto senza velo non regge il contrasto: il velo fa parte
    // dell'impianto, non e' un ritocco. Coordinate esplicite invece di inset,
    // che Satori interpreta in modo meno prevedibile.
    const veil = fullBleed
      ? `linear-gradient(180deg, ${v(0.38)} 0%, ${v(0.86)} 56%, ${v(0.97)} 100%)`
      : sideBand
        ? `linear-gradient(90deg, ${v(1)} 0%, ${v(0.92)} 26%, ${v(0)} 100%)`
        : generated
          // Un blocco piccolo non regge il velo pieno, ma un visual generato
          // non puo' restare senza: la sua palette non e' garantita. Una
          // velatura uniforme e leggera lo riporta dentro il brand senza
          // coprire il soggetto.
          ? `linear-gradient(180deg, ${v(0.2)} 0%, ${v(0.2)} 100%)`
          : null;
    const showVeil = veil !== null && strength > 0;

    return (
      <div
        data-block-id={block.id}
        data-block-kind={block.kind}
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
        {showVeil ? (
          <div
            data-veil
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
    // Il marchio non si ricolora: bianco su fondo scuro, vino su fondo chiaro.
    const ink = onDark ? "#ffffff" : BRAND.wine;
    return (
      <div data-block-id={block.id} data-block-kind={block.kind} style={{ ...frame, width: "auto", alignItems: "center", gap: mark * 0.4 }}>
        <svg
          width={mark}
          height={mark * (108 / 105)}
          viewBox={LOGO_VIEWBOX}
          fill={ink}
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
            color: ink,
          }}
        >
          TIME VISION
        </span>
      </div>
    );
  }

  if (block.kind === "badge") {
    if (!copy.badge) return null;
    const band = block.color ?? defaultTextColor("badge", onDark);
    return (
      <div data-block-id={block.id} data-block-kind={block.kind} style={{ ...frame, width: "auto", maxWidth: width }}>
        <div
          style={{
            display: "flex",
            backgroundColor: band,
            padding: `${Math.round(size * 0.72)}px ${Math.round(size * 1.1)}px`,
          }}
        >
          <span
            style={{
              fontSize: size,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              // Su un nastro chiaro la scritta bianca sparirebbe.
              color: isDark(band) ? "#ffffff" : BRAND.ink,
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
      <div data-block-id={block.id} data-block-kind={block.kind} style={{ ...frame, flexDirection: "column", gap: Math.round(size * 0.35) }}>
        <span
          style={{
            fontSize: size,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: block.color ?? defaultTextColor("cta", onDark),
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
    <div data-block-id={block.id} data-block-kind={block.kind} style={{ ...frame, justifyContent: justify(block.align) }}>
      <span style={{ ...typeStyle(block, size, onDark), textAlign: block.align }}>
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

function typeStyle(block: Block, size: number, onDark: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: size,
    width: "100%",
    color: block.color ?? defaultTextColor(block.kind, onDark),
  };

  switch (block.kind) {
    case "eyebrow":
      return { ...base, fontWeight: 600, letterSpacing: "0.14em" };
    case "headline":
      return { ...base, fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.035em" };
    case "subhead":
      return { ...base, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.02em" };
    case "body":
      return { ...base, lineHeight: 1.5 };
    case "disclaimer":
      return { ...base, lineHeight: 1.4 };
    default:
      return base;
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
  if (photo.startsWith("http") || photo.startsWith("data:")) return photo;
  if (photo.startsWith("/")) return `${baseUrl}${photo}`;
  return `${baseUrl}/brand/${photo}`;
}
