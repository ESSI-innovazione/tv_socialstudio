import Link from "next/link";
import { redirect } from "next/navigation";
import { Box, Send, Shapes } from "lucide-react";
import ParallaxUnfurlingGallery from "@/components/ui/3d-parallax-unfurling-gallery";
import { LogoMark } from "@/components/studio/logo";
import { auth, signIn } from "@/auth";
import { ALLOWED_EMAIL_DOMAIN, authConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * La porta dello Studio. Dietro, il muro dei visual Time Vision si apre da
 * solo: quello che il team produce qui dentro, gia' in brand. Davanti, una
 * sola cosa da fare — entrare con l'indirizzo aziendale.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (authConfigured) {
    const session = await auth();
    if (session?.user?.email?.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
      redirect("/studio");
    }
  }

  const { error } = await searchParams;

  return (
    <ParallaxUnfurlingGallery mode="auto">
      <div className="relative flex h-full w-full items-center justify-center px-5 py-8">
        <div className="tv-anim-rise w-[min(92vw,432px)] overflow-hidden rounded-[20px] border border-white/12 bg-paper shadow-[0_50px_110px_-30px_rgba(0,0,0,.75)]">
          {/* Il cappello vino: marchio, promessa, tono. */}
          <div className="relative overflow-hidden bg-wine px-7 pb-6 pt-7">
            <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-[radial-gradient(circle,rgba(255,127,81,.42)_0%,rgba(255,127,81,0)_72%)]" />

            <div className="relative flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-white/12">
                <LogoMark size={22} color="#ffffff" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-[15px] font-extrabold tracking-[-0.01em] text-white">
                  TV Social Studio
                </span>
                <span className="mt-[4px] text-[9px] font-semibold uppercase tracking-[0.16em] text-on-wine">
                  Time Vision
                </span>
              </span>
            </div>

            <h1 className="relative mt-6 text-[23px] font-bold leading-[1.18] tracking-[-0.015em] text-white">
              Dal brief al post <span className="text-apricot">pubblicato</span>.
            </h1>
            <p className="relative mt-2.5 text-[13px] leading-[1.5] text-on-wine">
              La piattaforma del team marketing: template Figma del brand, poster, cataloghi,
              visual 3D e post social, generati e approvati in un posto solo.
            </p>
          </div>

          {/* Il corpo chiaro: una sola azione. */}
          <div className="px-7 pb-7 pt-6">
            <div className="tv-label">ACCESSO RISERVATO</div>

            {error ? (
              <p className="mt-3 rounded-lg border border-warm-edge bg-warning-bg px-3 py-2.5 text-[12px] font-medium leading-[1.45] text-warning">
                {errorMessage(error)}
              </p>
            ) : null}

            {authConfigured ? (
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/studio" });
                }}
              >
                <button type="submit" className={ctaClass}>
                  <span className="flex size-6 items-center justify-center rounded-full bg-white">
                    <GoogleGlyph />
                  </span>
                  Entra con Google
                </button>
              </form>
            ) : (
              <>
                <Link href="/studio" className={ctaClass}>
                  <span className="flex size-6 items-center justify-center rounded-full bg-white/90 text-[11px] font-extrabold text-wine">
                    TV
                  </span>
                  Entra nello Studio
                </Link>
                <p className="mt-2.5 text-center text-[11px] font-medium text-ink-faint">
                  Google non e&apos; ancora configurato: accesso in modalita&apos; demo.
                </p>
              </>
            )}

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-ink-faint">
              <span className="size-1.5 rounded-full bg-success" />
              Solo indirizzi <span className="tv-mono text-ink-soft">@{ALLOWED_EMAIL_DOMAIN}</span>
            </p>

            <div className="mt-6 grid gap-3 border-t border-line pt-5">
              <Feature icon={<Shapes size={15} strokeWidth={1.9} />}>
                Template Figma del brand, sempre sincronizzati
              </Feature>
              <Feature icon={<Box size={15} strokeWidth={1.9} />}>
                Poster, cataloghi A4 e visual 3D in quattro varianti
              </Feature>
              <Feature icon={<Send size={15} strokeWidth={1.9} />}>
                LinkedIn e Instagram, dal brief alla pubblicazione
              </Feature>
            </div>
          </div>
        </div>

        <p className="absolute inset-x-0 bottom-5 text-center text-[11px] font-medium text-on-wine-faint/80">
          Uso interno &middot; Time Vision &middot; timevision.it
        </p>
      </div>
    </ParallaxUnfurlingGallery>
  );
}

const ctaClass =
  "mt-3.5 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-wine text-[14px] font-semibold text-white shadow-[0_14px_30px_-14px_rgba(114,0,38,.85)] transition-colors hover:bg-[#8a0730] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose";

function Feature({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-wine-tint text-rose">
        {icon}
      </span>
      <span className="text-[12.5px] leading-[1.35] text-ink-soft">{children}</span>
    </div>
  );
}

/** I rifiuti di NextAuth arrivano qui come stringhe: vanno tradotti. */
function errorMessage(code: string): string {
  if (code === "AccessDenied") {
    return `Quell'account non e' del dominio @${ALLOWED_EMAIL_DOMAIN}. Lo Studio e' riservato al team Time Vision.`;
  }
  if (code === "Configuration") {
    return "L'accesso Google non e' configurato correttamente. Avvisa chi gestisce lo Studio.";
  }
  return "Accesso non riuscito. Riprova, oppure avvisa chi gestisce lo Studio.";
}

function GoogleGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
