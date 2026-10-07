import { Building2, Camera } from "lucide-react";

export type ChannelId = "linkedin" | "instagram";

export const CHANNEL_LABEL: Record<ChannelId, string> = { linkedin: "LinkedIn", instagram: "Instagram" };

interface Props {
  channel: ChannelId;
  /** Feed o story, per Instagram. */
  surface?: string | null;
  size?: "sm" | "md";
  /** Solo l'icona nel cerchio, per gli spazi stretti. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Il canale, senza il logo e senza i colori della rete: LinkedIn e' vino
 * su tinta vino con un palazzo, Instagram e' caldo con una macchina
 * fotografica. Lo stesso in ogni pagina.
 */
export function ChannelBadge({ channel, surface = null, size = "md", iconOnly = false, className = "" }: Props) {
  const Icon = channel === "linkedin" ? Building2 : Camera;
  const tone = channel === "linkedin"
    ? { bg: "var(--color-wine-tint)", fg: "var(--color-wine)" }
    : { bg: "var(--color-warm-tint)", fg: "var(--color-warning)" };
  const label = surface && channel === "instagram" ? `${CHANNEL_LABEL[channel]} ${surface === "story" ? "story" : "feed"}` : CHANNEL_LABEL[channel];

  if (iconOnly) {
    return (
      <span
        className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full ${className}`}
        style={{ background: tone.bg, color: tone.fg }}
        aria-label={label}
        title={label}
      >
        <Icon size={14} strokeWidth={1.9} />
      </span>
    );
  }

  return (
    <span
      className={`tv-pill gap-1.5 ${size === "sm" ? "h-[22px] px-2 text-[11px]" : "h-[26px] px-2.5 text-[12px]"} ${className}`}
      style={{ background: tone.bg, color: tone.fg }}
    >
      <Icon size={size === "sm" ? 12 : 14} strokeWidth={1.9} />
      {label}
    </span>
  );
}
