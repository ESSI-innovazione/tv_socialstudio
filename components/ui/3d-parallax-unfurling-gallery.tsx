"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

/**
 * Il muro di visual che si apre.
 *
 * Due modi, stessa coreografia:
 *  - `scroll`: la barra si apre e la matrice si raddrizza mentre si scorre;
 *  - `auto`:   la stessa cosa succede da sola all'apertura della pagina, una
 *              volta sola. E' il modo giusto quando sopra c'e' qualcosa da
 *              usare subito — un login non si merita 600vh di scroll.
 */

/** Le foto Time Vision del brand kit. Nessuna immagine da fuori. */
export const TV_GALLERY_IMAGES: string[] = [
  "/brand/tv-aula.jpg",
  "/brand/gallery/tv-13.jpg",
  "/brand/gallery/tv-01.webp",
  "/brand/tv-team.jpg",
  "/brand/gallery/tv-07.webp",
  "/brand/gallery/tv-14.webp",
  "/brand/tv-digitale.jpg",
  "/brand/gallery/tv-06.webp",
  "/brand/gallery/tv-10.jpg",
  "/brand/tv-network.jpg",
  "/brand/gallery/tv-09.jpg",
  "/brand/gallery/tv-02.webp",
  "/brand/tv-consulenza.jpg",
  "/brand/gallery/tv-11.jpg",
  "/brand/gallery/tv-19.webp",
  "/brand/tv-fondi.jpg",
  "/brand/gallery/tv-08.webp",
  "/brand/gallery/tv-03.webp",
  "/brand/tv-master.jpg",
  "/brand/gallery/tv-17.webp",
  "/brand/gallery/tv-20.webp",
  "/brand/gallery/tv-04.webp",
  "/brand/gallery/tv-16.webp",
  "/brand/gallery/tv-18.webp",
];

interface ImageCardProps {
  src: string;
  priority?: boolean;
  onLoad?: () => void;
}

/**
 * Una tessera del muro. Le foto arrivano da fonti diverse: il duotone le
 * riporta tutte sotto la stessa luce, cosi' il muro resta Time Vision e non
 * un collage di stock.
 */
const ImageCard = ({ src, priority, onLoad }: ImageCardProps) => {
  return (
    <div className="relative h-[180px] w-full flex-shrink-0 overflow-hidden rounded-[10px] bg-ink will-change-transform [backface-visibility:hidden] sm:h-[240px] md:h-[300px]">
      <Image
        src={src}
        alt=""
        aria-hidden
        fill
        sizes="(max-width: 768px) 34vw, 22vw"
        priority={priority}
        onLoad={onLoad}
        className="object-cover grayscale contrast-[1.3] brightness-[0.78]"
      />
      {/* Duotone: la luminosita' resta della foto, il colore diventa vino. */}
      <div className="absolute inset-0 bg-wine mix-blend-color" />
      {/* Il moltiplicato tiene giu' le alte luci: niente rosa slavato. */}
      <div className="absolute inset-0 bg-wine/25 mix-blend-multiply" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(26,10,17,.08)_0%,rgba(26,10,17,.32)_100%)]" />
    </div>
  );
};

export interface ParallaxUnfurlingGalleryProps {
  /** Le immagini del muro. Vengono distribuite su quattro colonne. */
  images?: string[];
  /** `auto` apre il muro da solo; `scroll` lo lega allo scorrimento. */
  mode?: "auto" | "scroll";
  /** Cosa vive sopra il muro: la card di accesso, un titolo, niente. */
  children?: React.ReactNode;
  className?: string;
}

export default function ParallaxUnfurlingGallery({
  images = TV_GALLERY_IMAGES,
  mode = "auto",
  children,
  className = "",
}: ParallaxUnfurlingGalleryProps) {
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const loadedCountRef = useRef(0);
  const reduceMotion = useReducedMotion();
  const scrollDriven = mode === "scroll";

  const handleItemLoad = useCallback(() => {
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= 4) setIsReady(true);
  }, []);

  // Se la rete e' lenta il muro si mostra lo stesso: meglio grigio che vuoto.
  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const colMedia = useMemo(() => {
    const pick = (r: number) => {
      const base = images.filter((_, i) => i % 4 === r);
      return [...base, ...base];
    };
    return { col1: pick(0), col2: pick(1), col3: pick(2), col4: pick(3) };
  }, [images]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    container: scrollWrapperRef,
    offset: ["start start", "end end"],
  });

  // In modo `auto` la stessa progressione 0 → 1 la guida il tempo.
  const autoProgress = useMotionValue(0);
  useEffect(() => {
    if (scrollDriven) return;
    if (reduceMotion) {
      autoProgress.set(1);
      return;
    }
    const controls = animate(autoProgress, 1, {
      duration: 2.6,
      delay: 0.15,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [autoProgress, reduceMotion, scrollDriven]);

  const progress = scrollDriven ? scrollYProgress : autoProgress;
  const smoothProgress = useSpring(progress, {
    stiffness: 100,
    damping: 20,
    mass: 0.5,
  });

  // La barra che si apre.
  const bannerWidth = useTransform(smoothProgress, [0, 0.15], ["90vw", "100vw"]);
  const bannerHeight = useTransform(smoothProgress, [0, 0.15], ["80vh", "100vh"]);
  const bannerRadius = useTransform(smoothProgress, [0, 0.15], ["48px", "0px"]);
  const bannerBorderWidth = useTransform(smoothProgress, [0, 0.15], ["4px", "0px"]);

  // La matrice che si raddrizza.
  const rotateY = useTransform(smoothProgress, [0.15, 1], [-45, -8]);
  const rotateX = useTransform(smoothProgress, [0.15, 1], [25, 4]);
  const rotateZ = useTransform(smoothProgress, [0.15, 1], [15, 2]);
  const translateZ = useTransform(smoothProgress, [0.15, 1], [-800, 0]);

  // Le colonne che scorrono in controtempo.
  const yCol1 = useTransform(smoothProgress, [0.15, 1], ["0%", "-40%"]);
  const yCol2 = useTransform(smoothProgress, [0.15, 1], ["-40%", "10%"]);
  const yCol3 = useTransform(smoothProgress, [0.15, 1], ["0%", "-40%"]);
  const yCol4 = useTransform(smoothProgress, [0.15, 1], ["-30%", "20%"]);

  const columns = [
    { key: "col1", items: colMedia.col1, y: yCol1, drift: 17 },
    { key: "col2", items: colMedia.col2, y: yCol2, drift: 21 },
    { key: "col3", items: colMedia.col3, y: yCol3, drift: 19 },
    { key: "col4", items: colMedia.col4, y: yCol4, drift: 23 },
  ] as const;

  return (
    <div
      ref={scrollWrapperRef}
      className={`w-full bg-night ${
        scrollDriven ? "h-screen overflow-y-auto overflow-x-hidden" : "h-dvh overflow-hidden"
      } ${className}`}
    >
      <section
        ref={containerRef}
        className={`relative w-full bg-night text-white selection:bg-wine-tint selection:text-wine ${
          scrollDriven ? "h-[600vh]" : "h-full"
        }`}
      >
        <div className="sticky top-0 flex h-dvh w-full items-center justify-center overflow-hidden">
          <motion.div
            style={{
              width: bannerWidth,
              height: bannerHeight,
              borderRadius: bannerRadius,
              borderWidth: bannerBorderWidth,
              borderColor: "#43202c",
            }}
            className="relative mx-auto flex max-w-[1920px] items-center justify-center overflow-hidden bg-ink will-change-transform [backface-visibility:hidden]"
          >
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ perspective: "1000px" }}
            >
              <motion.div
                style={{
                  rotateX,
                  rotateY,
                  rotateZ,
                  z: translateZ,
                  transformStyle: "preserve-3d",
                  opacity: isReady ? 1 : 0,
                }}
                className="flex h-[150vh] w-[120vw] origin-center items-center justify-center gap-4 transition-opacity duration-700 will-change-transform [backface-visibility:hidden] md:gap-6"
              >
                {columns.map((col) => (
                  <motion.div
                    key={col.key}
                    style={{ y: col.y }}
                    className="w-[22vw] min-w-[190px] shrink-0"
                  >
                    {/* Il respiro lento, sopra la parallasse: il muro resta vivo. */}
                    <motion.div
                      animate={reduceMotion ? undefined : { y: [0, -16, 0] }}
                      transition={{
                        duration: col.drift,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="flex flex-col gap-4 md:gap-6"
                    >
                      {col.items.map((src, index) => (
                        <ImageCard
                          key={`${col.key}-${index}`}
                          src={src}
                          priority={index === 0}
                          onLoad={handleItemLoad}
                        />
                      ))}
                    </motion.div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/*
              Le ombre stanno fuori dal contesto 3D: dentro `preserve-3d` lo
              z-index non conta piu', conta la profondita', e la matrice
              passerebbe davanti. Qui invece coprono sempre.
            */}
            <div className="pointer-events-none absolute inset-0 z-10 bg-night/14" />
            <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_70px_120px_-40px_rgba(26,10,17,1),inset_0_-70px_120px_-40px_rgba(26,10,17,1)] md:shadow-[inset_0_150px_200px_-40px_rgba(26,10,17,1),inset_0_-150px_200px_-40px_rgba(26,10,17,1)]" />
            <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_55px_0_110px_-40px_rgba(26,10,17,1),inset_-55px_0_110px_-40px_rgba(26,10,17,1)] md:shadow-[inset_200px_0_200px_-40px_rgba(26,10,17,1),inset_-200px_0_200px_-40px_rgba(26,10,17,1)]" />
            {/* Il centro si abbassa: quello che sta sopra ha sempre contrasto. */}
            <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_90%_42%_at_50%_50%,rgba(26,10,17,.46)_0%,rgba(26,10,17,.16)_60%,rgba(26,10,17,0)_100%)] md:bg-[radial-gradient(ellipse_58%_62%_at_50%_50%,rgba(26,10,17,.48)_0%,rgba(26,10,17,.18)_55%,rgba(26,10,17,0)_100%)]" />

            {children ? (
              <div className="relative z-30 flex h-full w-full items-center justify-center">
                {children}
              </div>
            ) : null}
          </motion.div>
        </div>
      </section>
    </div>
  );
}
