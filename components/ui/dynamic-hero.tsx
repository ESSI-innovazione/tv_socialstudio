"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface HeroNavItem {
  label: string;
  href: string;
  /** L'ultima voce e' l'accesso: pesa di piu' e usa il colore del brand. */
  emphasis?: boolean;
}

export interface DynamicHeroProps {
  eyebrow?: React.ReactNode;
  headline: React.ReactNode;
  tagline: React.ReactNode;
  ctaLabel: string;
  ctaHref: string;
  nav?: HeroNavItem[];
  /** Contenuto della card multimediale arrotondata sotto la CTA. */
  media?: React.ReactNode;
  /** Riga di stato in alto a destra. */
  status?: React.ReactNode;
  brand?: { name: string; sub: string };
}

interface Point {
  x: number;
  y: number;
}

/** Punto di partenza della curva, in frazione del riquadro. */
const ORIGIN_FRACTION: Point = { x: 0.206, y: 0.322 };

/**
 * Arco quadratico tratteggiato che parte da sinistra e punta alla CTA.
 * Prima che il mouse si muova disegna comunque la freccia corretta, cosi'
 * la pagina e' giusta al caricamento e negli screenshot.
 */
function quadraticPath(from: Point, to: Point): { path: string; head: string } {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;

  // La curva si inarca perpendicolarmente alla congiungente.
  const bow = Math.min(120, length * 0.22);
  const controlX = midX - (dy / length) * bow;
  const controlY = midY + (dx / length) * bow;

  // Tangente in coda alla curva, per orientare la punta.
  const tangentX = to.x - controlX;
  const tangentY = to.y - controlY;
  const tangentLength = Math.hypot(tangentX, tangentY) || 1;
  const ux = tangentX / tangentLength;
  const uy = tangentY / tangentLength;

  const headLength = 14;
  const spread = 0.42;
  const leftX = to.x - headLength * (ux * Math.cos(spread) - uy * Math.sin(spread));
  const leftY = to.y - headLength * (uy * Math.cos(spread) + ux * Math.sin(spread));
  const rightX = to.x - headLength * (ux * Math.cos(-spread) - uy * Math.sin(-spread));
  const rightY = to.y - headLength * (uy * Math.cos(-spread) + ux * Math.sin(-spread));

  return {
    path: `M${from.x.toFixed(1)} ${from.y.toFixed(1)} Q${controlX.toFixed(1)} ${controlY.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`,
    head: `M${leftX.toFixed(1)} ${leftY.toFixed(1)} L${to.x.toFixed(1)} ${to.y.toFixed(1)} L${rightX.toFixed(1)} ${rightY.toFixed(1)}`,
  };
}

export function DynamicHero({
  eyebrow,
  headline,
  tagline,
  ctaLabel,
  ctaHref,
  nav = [],
  media,
  status,
  brand = { name: "TIME VISION", sub: "MARKETING STUDIO" },
}: DynamicHeroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [from, setFrom] = useState<Point | null>(null);
  const [to, setTo] = useState<Point | null>(null);

  /** Ricalcola il bersaglio: il bordo sinistro della CTA, leggermente sopra. */
  const measure = useCallback(() => {
    const root = rootRef.current;
    const cta = ctaRef.current;
    if (!root || !cta) return;

    const rootRect = root.getBoundingClientRect();
    const ctaRect = cta.getBoundingClientRect();

    setBox({ w: rootRect.width, h: rootRect.height });
    setTo({
      x: ctaRect.left - rootRect.left - 10,
      y: ctaRect.top - rootRect.top + ctaRect.height * 0.5,
    });
    setFrom((current) =>
      current ?? {
        x: rootRect.width * ORIGIN_FRACTION.x,
        y: rootRect.height * ORIGIN_FRACTION.y,
      },
    );
  }, []);

  useEffect(() => {
    measure();

    const root = rootRef.current;
    if (!root) return;

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    let frame = 0;
    function onMove(event: MouseEvent) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = root!.getBoundingClientRect();
        setFrom({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      });
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const geometry = from && to ? quadraticPath(from, to) : null;

  return (
    <div
      ref={rootRef}
      className="relative min-h-screen w-full overflow-hidden bg-canvas text-ink"
    >
      <div className="absolute left-6 top-7 z-10 flex items-center gap-3 sm:left-11 sm:top-8">
        <svg width="27" height="28" viewBox="0 0 105 108" fill="#720026" aria-hidden="true">
          <path d="M52.44,1.18a52.44,52.44,0,1,0,52.44,52.44A52.44,52.44,0,0,0,52.44,1.18m6.07,92.48v-34h14V47.55H46.37V93.66a40.49,40.49,0,1,1,12.14,0" />
        </svg>
        <div className="flex flex-col gap-0.5">
          <div className="text-[14px] font-bold leading-none tracking-[0.14em] text-wine">
            {brand.name}
          </div>
          <div className="text-[10px] font-medium leading-none tracking-[0.16em] text-ink-faint">
            {brand.sub}
          </div>
        </div>
      </div>

      {status ? (
        <div className="absolute right-6 top-8 z-10 hidden items-center sm:right-11 sm:flex">
          {status}
        </div>
      ) : null}

      {nav.length > 0 ? (
        <nav className="relative z-10 mx-auto hidden w-full max-w-3xl items-center justify-between px-8 py-4 text-sm md:flex">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={
                item.emphasis
                  ? "rounded-lg px-4 py-2 font-semibold text-wine transition-colors hover:bg-wine-tint"
                  : "rounded-lg px-4 py-2 font-medium text-ink-soft transition-colors hover:bg-wine-tint hover:text-wine"
              }
            >
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}

      <main className="relative z-10 flex flex-col items-center px-6 pb-20">
        <div className="mt-14 flex flex-col items-center md:mt-[72px]">
          {eyebrow ? <div className="mb-5">{eyebrow}</div> : null}

          <h1 className="m-0 max-w-[860px] text-balance text-center text-[clamp(2.25rem,1.1rem_+_3.6vw,4rem)] font-medium leading-[1.04] tracking-[-0.03em] text-ink">
            {headline}
          </h1>

          <p className="mt-5 max-w-[560px] text-pretty text-center text-[clamp(1.0625rem,1rem_+_0.25vw,1.1875rem)] leading-[1.55] text-ink-soft">
            {tagline}
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <a
            ref={ctaRef}
            href={ctaHref}
            className="rounded-xl border border-ink/50 px-6 py-3 text-[16px] font-medium text-ink transition-colors hover:border-wine hover:bg-wine hover:text-white"
          >
            {ctaLabel}
          </a>
        </div>

        {media ? (
          <div className="mt-16 w-full max-w-[900px]">
            <div className="rounded-[32px] bg-line p-1">
              <div className="relative flex h-[280px] items-center justify-center gap-6 overflow-hidden rounded-[28px] bg-wine-tint sm:h-[400px]">
                {media}
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {box && geometry ? (
        <svg
          width={box.w}
          height={box.h}
          viewBox={`0 0 ${box.w} ${box.h}`}
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[5] hidden md:block"
        >
          <path
            d={geometry.path}
            stroke="#2a1119"
            strokeOpacity="0.5"
            strokeWidth="2"
            strokeDasharray="10 5"
            strokeLinecap="round"
          />
          <path
            d={geometry.head}
            stroke="#2a1119"
            strokeOpacity="0.5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </div>
  );
}

export default DynamicHero;
