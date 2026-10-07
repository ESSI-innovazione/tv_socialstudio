"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Warp, type WarpProps } from "@paper-design/shaders-react";
import { BRAND } from "@/lib/brand";

/**
 * Card con fondo shader (WebGL, @paper-design/shaders-react).
 *
 * Il fondo e' il Warp della libreria: colori che si mescolano e si
 * attorcigliano sopra un pattern di base. Qui i colori sono solo quelli
 * del Brand Kit — vino, rosa, corallo, albicocca, inchiostro — e sopra
 * sta un velo scuro che tiene il testo leggibile (AA su fondo inchiostro).
 *
 * Con `prefers-reduced-motion` l'animazione si ferma: il fondo resta, non
 * si muove.
 */

export type ShaderConfig = Pick<WarpProps, "proportion" | "softness" | "distortion" | "swirl" | "swirlIterations" | "shape" | "shapeScale" | "colors">;

/** Sei impianti, tutti del brand: cambiano pattern e vortice, non la palette. */
export const BRAND_SHADERS: ShaderConfig[] = [
  { proportion: 0.35, softness: 0.9, distortion: 0.15, swirl: 0.6, swirlIterations: 8, shape: "checks", shapeScale: 0.08, colors: [BRAND.wine, BRAND.rose, BRAND.coral, BRAND.apricot] },
  { proportion: 0.45, softness: 1.0, distortion: 0.2, swirl: 0.9, swirlIterations: 12, shape: "stripes", shapeScale: 0.12, colors: [BRAND.ink, BRAND.wine, BRAND.rose, BRAND.apricot] },
  { proportion: 0.4, softness: 0.8, distortion: 0.18, swirl: 0.7, swirlIterations: 10, shape: "edge", shapeScale: 0.1, colors: [BRAND.wine, BRAND.coral, BRAND.apricot, BRAND.rose] },
  { proportion: 0.5, softness: 1.0, distortion: 0.22, swirl: 0.8, swirlIterations: 15, shape: "checks", shapeScale: 0.09, colors: [BRAND.rose, BRAND.wine, BRAND.apricot, BRAND.ink] },
  { proportion: 0.38, softness: 0.95, distortion: 0.16, swirl: 0.85, swirlIterations: 11, shape: "stripes", shapeScale: 0.11, colors: [BRAND.coral, BRAND.wine, BRAND.rose, BRAND.ink] },
  { proportion: 0.42, softness: 1.0, distortion: 0.19, swirl: 0.75, swirlIterations: 9, shape: "edge", shapeScale: 0.13, colors: [BRAND.apricot, BRAND.rose, BRAND.wine, BRAND.ink] },
];

/** La versione spenta, per le card che si vedono ma non si scelgono. */
export const MUTED_SHADER: ShaderConfig = {
  proportion: 0.4,
  softness: 1.0,
  distortion: 0.12,
  swirl: 0.5,
  swirlIterations: 6,
  shape: "checks",
  shapeScale: 0.1,
  colors: [BRAND.inkSoft, BRAND.inkFaint, BRAND.ink, BRAND.inkSoft],
};

export function shaderConfigFor(index: number): ShaderConfig {
  return BRAND_SHADERS[index % BRAND_SHADERS.length];
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export interface ShaderCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  config?: ShaderConfig;
  /** Un'etichetta in alto a destra: «automatico», «nuovo»... */
  badge?: string;
  /** La riga in calce: «Scegli», «Learn more»... Assente, niente riga. */
  footer?: ReactNode;
  active?: boolean;
  /** Spenta: fondo grigio, nessuna interazione. */
  muted?: boolean;
  onClick?: () => void;
  className?: string;
  speed?: number;
  /**
   * Una fotografia al posto dello shader: la foto riempie la card e il velo
   * vino la porta in palette. Senza, resta il fondo shader del brand.
   */
  image?: string;
}

export function ShaderCard({ title, description, icon, config, badge, footer, active = false, muted = false, onClick, className = "h-[200px]", speed = 0.5, image }: ShaderCardProps) {
  const reduced = useReducedMotion();
  const shader = muted ? MUTED_SHADER : (config ?? BRAND_SHADERS[0]);
  const Tag = onClick && !muted ? "button" : "div";

  return (
    <Tag
      type={Tag === "button" ? "button" : undefined}
      onClick={muted ? undefined : onClick}
      aria-pressed={Tag === "button" ? active : undefined}
      aria-label={Tag === "div" ? `${title}: ${badge ?? description}` : undefined}
      className={`relative w-full overflow-hidden rounded-card text-left transition-[transform,box-shadow] ${Tag === "button" ? "cursor-pointer hover:-translate-y-[2px]" : ""} ${className}`}
      style={{
        boxShadow: active ? "0 0 0 3px var(--color-rose), var(--shadow-card)" : "var(--shadow-card-soft)",
        outline: "none",
      }}
    >
      <div className="absolute inset-0" aria-hidden>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500"
            style={{ filter: muted ? "grayscale(1)" : "none", transform: active ? "scale(1.04)" : "none" }}
          />
        ) : (
          <Warp
            style={{ height: "100%", width: "100%" }}
            proportion={shader.proportion}
            softness={shader.softness}
            distortion={shader.distortion}
            swirl={shader.swirl}
            swirlIterations={shader.swirlIterations}
            shape={shader.shape}
            shapeScale={shader.shapeScale}
            scale={1}
            rotation={0}
            speed={reduced ? 0 : speed}
            colors={shader.colors}
          />
        )}
      </div>

      {/* Il velo: vino sulla foto, inchiostro sullo shader; piu' fitto in basso dove sta il testo. */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background: image
            ? `linear-gradient(180deg, ${muted ? "rgba(42,17,25,.6)" : "rgba(114,0,38,.45)"} 0%, rgba(42,17,25,.9) 100%)`
            : `linear-gradient(180deg, ${muted ? "rgba(42,17,25,.62)" : "rgba(42,17,25,.42)"} 0%, rgba(42,17,25,.84) 100%)`,
        }}
      />

      <div className="relative z-10 flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <span
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px]"
            style={{ background: "rgba(255,255,255,.14)", color: "#ffffff", backdropFilter: "blur(6px)" }}
          >
            {icon}
          </span>
          {badge ? (
            <span className="tv-pill h-[20px] px-2 text-[10.5px]" style={{ background: "rgba(255,255,255,.16)", color: "#ffffff" }}>
              {badge}
            </span>
          ) : null}
        </div>

        <h3 className="mt-auto text-[16px] leading-[1.25] font-bold text-white">{title}</h3>
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-[1.45]" style={{ color: muted ? BRAND.mute : BRAND.onWine }}>
          {description}
        </p>

        {footer ? <div className="mt-3 flex items-center text-[12.5px] font-semibold text-white">{footer}</div> : null}
      </div>
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: una griglia di sei card, come nel componente di origine.      */
/* ------------------------------------------------------------------ */

interface Feature {
  title: string;
  description: string;
  icon: ReactNode;
}

const FEATURES: Feature[] = [
  { title: "Poster per un bando", description: "Poster A4 con countdown e disclaimer normativo, pronto per la stampa.", icon: <Star /> },
  { title: "Catalogo servizi", description: "Un PDF multipagina costruito dai servizi che scegli.", icon: <Star /> },
  { title: "Visual 3D", description: "Key visual e mockup da un concept testuale, in palette.", icon: <Star /> },
  { title: "Kit social", description: "LinkedIn, feed e story dallo stesso impianto, caption incluse.", icon: <Star /> },
  { title: "Figma sync", description: "I template arrivano dalla libreria del brand, senza un deploy.", icon: <Star /> },
  { title: "Brand guard", description: "Palette, font, marchio e claim verificati prima di pubblicare.", icon: <Star /> },
];

function Star() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export default function FeaturesCards() {
  return (
    <section className="px-4 py-20" style={{ background: "var(--color-canvas)" }}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-semibold md:text-5xl" style={{ color: "var(--color-ink)" }}>
            Gli strumenti dello Studio
          </h2>
          <p className="mx-auto max-w-3xl text-lg leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
            Sei istruzioni salvate, sempre in brand, eseguibili con un clic.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <ShaderCard key={feature.title} {...feature} config={shaderConfigFor(index)} className="h-[260px]" footer={<span>Scopri</span>} />
          ))}
        </div>
      </div>
    </section>
  );
}
