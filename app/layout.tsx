import type { Metadata, Viewport } from "next";
import { Inter, Lexend, Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";

const lexend = Lexend({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-lexend",
  display: "swap",
});

/**
 * Le famiglie che un asset puo' scegliere oltre a Lexend, nei quattro pesi
 * del compositore. Ogni variabile ha il gemello in `lib/fonts.ts` e il TTF
 * in `assets/fonts`: mancarne uno rompe l'anteprima o l'export.
 */
// I pesi sono scritti per esteso in ogni chiamata: `next/font` li legge a
// compilazione e non accetta una costante condivisa.
const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-inter", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-montserrat", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-playfair", display: "swap" });

export const metadata: Metadata = {
  title: "Time Vision Marketing Studio",
  description:
    "Dal brief al post pubblicato. L'agente creativo del team marketing Time Vision: poster, cataloghi, visual 3D e post social sempre in brand.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#720026",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${lexend.variable} ${inter.variable} ${montserrat.variable} ${playfair.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
