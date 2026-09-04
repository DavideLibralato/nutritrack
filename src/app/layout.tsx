import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import RegistraServiceWorker from "@/components/RegistraServiceWorker";

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
      </body>
    </html>
  );
}
