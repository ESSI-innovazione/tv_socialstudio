import Image from "next/image";
import { Box, Play } from "lucide-react";
import DynamicHero from "@/components/ui/dynamic-hero";

export default function HomePage() {
  return (
    <DynamicHero
      nav={[
        { label: "Home", href: "/" },
        { label: "Come funziona", href: "#come-funziona" },
        { label: "Template", href: "/studio" },
        { label: "Brand Kit", href: "/studio" },
        { label: "Accedi", href: "/studio", emphasis: true },
      ]}
      status={
        <div className="tv-pill h-8 gap-2 border border-wine-edge bg-wine-tint px-3.5">
          <span className="size-1.5 rounded-full bg-success" />
          <span className="text-xs font-medium text-ink-soft">Figma Pro connesso</span>
        </div>
      }
      eyebrow={
        <div className="tv-pill h-[30px] gap-2.5 border border-warm-edge bg-warm-tint px-3.5">
          <span className="text-[11px] font-bold tracking-[0.1em] text-rose">AGENTE CREATIVO</span>
          <span className="size-[3px] rounded-full bg-warm-edge" />
          <span className="text-xs font-medium text-warning">uso interno · team marketing</span>
        </div>
      }
      headline={
        <>
          Dal brief al post <span className="font-bold text-wine">pubblicato</span>.
        </>
      }
      tagline="Una sola pagina: scrivi l'istruzione e l'agente apre i template Figma del brand, costruisce poster, cataloghi, visual 3D e i post per LinkedIn e Instagram."
      ctaLabel="Entra nello Studio"
      ctaHref="/studio"
      media={<HeroMedia />}
    />
  );
}

/** Il collage di anteprime: riempie la card come uno sfondo a mosaico. */
function HeroMedia() {
  return (
    <>
      <div className="grid h-full w-full grid-cols-[1.1fr_1fr] gap-1.5 sm:grid-cols-[0.8fr_1.15fr_1fr]">
        <div className="hidden flex-col overflow-hidden bg-wine sm:flex">
          <div className="relative flex-1">
            <Image
              src="/brand/tv-aula.jpg"
              alt=""
              fill
              sizes="(max-width: 640px) 0px, 260px"
              className="object-cover"
              priority
            />
          </div>
          <div className="flex flex-col gap-2 p-4">
            <div className="text-[15px] font-bold leading-tight text-white">Master Academy 2026</div>
            <div className="h-[6px] w-[54px] rounded-full bg-coral" />
          </div>
        </div>

        <div className="relative overflow-hidden">
          <Image
            src="/brand/tv-team.jpg"
            alt=""
            fill
            sizes="(max-width: 640px) 55vw, 360px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-wine/[0.62]" />
          <div className="absolute inset-0 flex flex-col justify-end gap-2.5 p-5">
            <div className="text-[16px] font-bold leading-[1.15] text-white sm:text-[26px]">
              Fondi STEP 2026
              <br />
              fino al 70%
            </div>
            <div className="text-[11px] font-semibold tracking-[0.08em] text-apricot">
              TIMEVISION.IT
            </div>
          </div>
        </div>

        <div className="grid grid-rows-[2.4fr_1fr] gap-1.5">
          <div className="relative overflow-hidden">
            <Image
              src="/brand/tv-digitale.jpg"
              alt=""
              fill
              sizes="(max-width: 640px) 45vw, 320px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(42,17,25,.86)_38%,rgba(42,17,25,0)_100%)]" />
            <div className="absolute left-4 top-4 w-40 text-[14px] font-semibold leading-[1.25] text-white sm:text-[16px]">
              Voucher Cloud e Cybersecurity
            </div>
            <div className="absolute bottom-4 left-4 text-[10px] font-semibold tracking-[0.08em] text-apricot">
              CLICK-DAY 10 NOV
            </div>
          </div>

          <div className="flex items-center gap-3 bg-paper px-4">
            <div className="flex size-[42px] shrink-0 items-center justify-center rounded-lg bg-wine-tint">
              <Box size={21} strokeWidth={1.9} className="text-rose" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="truncate text-[13px] font-semibold text-ink">Visual 3D · render</div>
              <div className="truncate text-[11px] text-ink-faint">4 varianti pronte</div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label="Guarda la demo"
        className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-full bg-wine/30 backdrop-blur-[6px] transition-colors hover:bg-wine/45"
      >
        <Play size={18} fill="#ffffff" stroke="none" />
      </button>
    </>
  );
}
