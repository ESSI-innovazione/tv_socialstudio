import { LOGO_PATH, LOGO_VIEWBOX } from "@/lib/brand";

/** Il marchio Time Vision, monocromatico. Mai ruotato, mai deformato. */
export function LogoMark({ size = 26, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size * (108 / 105)}
      viewBox={LOGO_VIEWBOX}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path d={LOGO_PATH} fill={color} />
    </svg>
  );
}

/** Marchio piu' wordmark, come compare in barra. */
export function Wordmark({ color = "#ffffff" }: { color?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={24} color={color} />
      <span className="flex flex-col leading-none">
        <span className="text-[14px] font-extrabold tracking-[-0.01em]" style={{ color }}>
          Time Vision
        </span>
        <span
          className="mt-[3px] text-[9px] font-semibold tracking-[0.16em] uppercase"
          style={{ color, opacity: 0.72 }}
        >
          Marketing Studio
        </span>
      </span>
    </span>
  );
}
