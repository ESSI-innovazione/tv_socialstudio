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

/** Il collage di anteprime dentro la card arrotondata. */
function HeroMedia() {
  return (
    <>
      {/* Prima colonna: la card ruotata, la firma del collage. */}
      <div className="hidden w-[128px] shrink-0 -translate-y-1.5 -rotate-3 flex-col overflow-hidden rounded-[9px] bg-wine shadow-[0_18px_34px_-18px_rgba(114,0,38,.55)] md:flex">
        <div className="relative h-[150px]">
          <Image
            src="/brand/tv-aula.jpg"
            alt=""
            fill
            sizes="128px"
            className="object-cover"
            priority
          />
        </div>
        <div className="flex flex-1 flex-col justify-between p-2.5">
          <div className="text-[11px] font-bold leading-tight text-white">Master Academy 2026</div>
          <div className="h-[5px] w-[42px] rounded-full bg-coral" />
        </div>
      </div>

      {/* Card ancora: e' anche il pulsante della demo. */}
      <div className="relative h-[196px] w-[148px] shrink-0 overflow-hidden rounded-xl shadow-[0_22px_44px_-20px_rgba(114,0,38,.55)] sm:h-[300px] sm:w-[180px]">
        <Image src="/brand/tv-team.jpg" alt="" fill sizes="172px" className="object-cover" priority />
        <div className="absolute inset-0 bg-wine/[0.62]" />
        <div className="absolute inset-0 flex flex-col justify-end gap-2 p-3.5">
          <div className="text-[15px] font-bold leading-[1.18] text-white">
            Fondi STEP 2026
            <br />
            fino al 70%
          </div>
          <div className="text-[9px] font-semibold tracking-[0.08em] text-apricot">TIMEVISION.IT</div>
        </div>
        <button
          type="button"
          aria-label="Guarda la demo"
          className="absolute left-1/2 top-[38%] flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-wine/35 backdrop-blur-[6px] transition-colors hover:bg-wine/55"
        >
          <Play size={18} fill="#ffffff" stroke="none" />
        </button>
      </div>

      {/* Colonna dei formati: stampa, social, 3D. */}
      <div className="flex shrink-0 flex-col gap-3">
        <div className="relative h-[108px] w-[160px] overflow-hidden rounded-[9px] shadow-[0_16px_30px_-18px_rgba(114,0,38,.5)] sm:h-[136px] sm:w-[186px]">
          <Image src="/brand/tv-digitale.jpg" alt="" fill sizes="186px" className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(42,17,25,.86)_38%,rgba(42,17,25,0)_100%)]" />
          <div className="absolute left-3 top-3.5 w-28 text-[11px] font-semibold leading-[1.28] text-white">
            Voucher Cloud e Cybersecurity
          </div>
          <div className="absolute bottom-3 left-3 text-[9px] font-semibold tracking-[0.08em] text-apricot">
            CLICK-DAY 10 NOV
          </div>
        </div>

        <div className="flex h-[60px] w-[160px] items-center gap-2.5 rounded-[9px] border border-wine-edge bg-paper px-3 shadow-[0_16px_30px_-20px_rgba(114,0,38,.45)] sm:w-[186px]">
          <div className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-wine-tint">
            <Box size={17} strokeWidth={1.9} className="text-rose" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-[11px] font-semibold text-ink">Visual 3D · render</div>
            <div className="text-[10px] text-ink-faint">4 varianti pronte</div>
          </div>
        </div>

        <div className="relative hidden h-[104px] w-[186px] overflow-hidden rounded-[9px] shadow-[0_16px_30px_-18px_rgba(114,0,38,.5)] sm:block">
          <Image src="/brand/tv-network.jpg" alt="" fill sizes="186px" className="object-cover" />
          <div className="absolute inset-0 bg-wine/[0.58]" />
          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
            <div className="text-[11px] font-semibold leading-tight text-white">Post LinkedIn</div>
            <div className="text-[9px] font-semibold tracking-[0.08em] text-apricot">3 VARIANTI</div>
          </div>
        </div>
      </div>

      {/* Colonna social + carta stampata. */}
      <div className="hidden shrink-0 translate-y-2.5 flex-col gap-3 lg:flex">
        <div className="relative h-[172px] w-[146px] overflow-hidden rounded-[9px] shadow-[0_16px_30px_-18px_rgba(114,0,38,.5)]">
          <Image src="/brand/tv-consulenza.jpg" alt="" fill sizes="146px" className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(42,17,25,0)_42%,rgba(42,17,25,.82)_100%)]" />
          <div className="absolute inset-x-3 bottom-3">
            <div className="text-[11px] font-semibold leading-tight text-white">Carosello IG</div>
            <div className="mt-0.5 text-[9px] font-semibold tracking-[0.08em] text-apricot">6 SLIDE</div>
          </div>
        </div>

        <div className="relative h-[128px] w-[146px] overflow-hidden rounded-[9px] shadow-[0_16px_30px_-18px_rgba(114,0,38,.5)]">
          <Image src="/brand/tv-fondi.jpg" alt="" fill sizes="146px" className="object-cover" />
          <div className="absolute inset-0 bg-wine/[0.55]" />
          <div className="absolute inset-x-3 bottom-3 text-[11px] font-semibold leading-tight text-white">
            Catalogo A4
          </div>
        </div>
      </div>

      {/* Chiude il collage dal lato opposto alla card ruotata. */}
      <div className="relative hidden h-[268px] w-[132px] shrink-0 -translate-y-1 rotate-2 overflow-hidden rounded-[9px] shadow-[0_18px_34px_-18px_rgba(114,0,38,.55)] xl:block">
        <Image
          src="/brand/tv-master.jpg"
          alt=""
          fill
          sizes="132px"
          className="object-cover object-[64%_38%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(114,0,38,.18)_0%,rgba(114,0,38,0)_45%,rgba(42,17,25,.8)_100%)]" />
        <div className="absolute inset-x-3 bottom-3">
          <div className="text-[11px] font-semibold leading-tight text-white">Brand Kit</div>
          <div className="mt-0.5 text-[9px] font-semibold tracking-[0.08em] text-apricot">
            TEMPLATE FIGMA
          </div>
        </div>
      </div>
    </>
  );
}
