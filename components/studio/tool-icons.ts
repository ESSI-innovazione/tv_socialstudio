import {
  BookOpen,
  Box,
  Frame,
  LayoutTemplate,
  Share2,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/** Un'icona per strumento. Chi non e' in elenco prende la scintilla. */
export const TOOL_ICONS: Record<string, LucideIcon> = {
  "poster-bando": LayoutTemplate,
  "catalogo-servizi": BookOpen,
  "visual-3d": Box,
  "social-kit": Share2,
  "figma-sync": Frame,
  "brand-guard": ShieldCheck,
};

export function toolIcon(slug: string): LucideIcon {
  return TOOL_ICONS[slug] ?? Sparkles;
}
