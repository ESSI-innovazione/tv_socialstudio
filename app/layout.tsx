import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";

const lexend = Lexend({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-lexend",
  display: "swap",
});

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
    <html lang="it" className={lexend.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
