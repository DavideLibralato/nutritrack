import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import RegistraServiceWorker from "@/components/RegistraServiceWorker";
import Sincronizzazione from "@/components/Sincronizzazione";

// Font per titoli e numeri: piu caratteristico del generico Geist/Arial usato finora.
const fontIntestazioni = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
});

// Font per il testo normale.
const fontTesto = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NutriTrack",
  description: "Traccia calorie e macronutrienti in modo semplice e veloce",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NutriTrack",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1F1B16",
  width: "device-width",
  initialScale: 1,
  // Quando si apre la tastiera software, l'area di layout si rimpicciolisce
  // davvero (invece di farsi coprire): cosi `100dvh` e le righe ancorate in
  // fondo restano sopra la tastiera. Supportato da Chrome/Android; su iOS e
  // ignorato e ci pensa il fallback con visualViewport in /aggiungi.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${fontIntestazioni.variable} ${fontTesto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegistraServiceWorker />
        <Sincronizzazione />
      </body>
    </html>
  );
}
