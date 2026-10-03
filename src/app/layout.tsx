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
    // "default": nell'app installata la barra dell'orologio è opaca, la
    // pagina comincia sotto, e iOS la colora secondo il tema del sistema
    // (chiara con orologio nero in chiaro, scura con orologio bianco al
    // buio). Segue già il tema da sola. "black-translucent" no: la pagina
    // passerebbe sotto l'orologio, che è sempre bianco, quindi invisibile
    // sul fondo chiaro, e ogni pagina dovrebbe lasciare lo spazio in alto.
    statusBarStyle: "default",
    title: "NutriTrack",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Colore della barra di Safari/Chrome e dell'anteprima nel multitasking:
  // in tinta con lo sfondo della pagina, uno per tema. Sono --background
  // chiaro e scuro di globals.css, ricopiati qui perché il <meta> non legge
  // le variabili CSS.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1815" },
  ],
  width: "device-width",
  initialScale: 1,
  // Senza "cover" iOS restituisce 0 per ogni env(safe-area-inset-*): in
  // Safari non si vede (la sua barra degli strumenti sta già sopra la
  // barretta home), ma nell'app installata sulla Home la pagina arriva fino
  // al bordo e la tab bar finiva sotto la barretta. Con "cover" il valore è
  // quello vero, e --tab-bar-distanza (globals.css) e gli sheet lo usano già.
  // In alto non cambia nulla: con statusBarStyle "default" la barra di stato
  // di iOS è opaca e la pagina comincia sotto l'orologio (inset-top = 0).
  viewportFit: "cover",
  // La tastiera software copre il layout senza accorciarlo; si accorcia solo
  // la parte visibile (visualViewport). È quello che fa sempre iOS, che
  // ignora questa impostazione; su Android/Chrome è il valore predefinito, lo
  // scriviamo per dire che è una scelta. Così i due sistemi si comportano
  // allo stesso modo: gli sheet e /aggiungi si agganciano alla parte visibile
  // con useAreaVisibile e restano sopra la tastiera; tab bar e barra Salva si
  // nascondono mentre si scrive (globals.css). Con "resizes-content" su
  // Android il layout si accorcerebbe e cambierebbe sotto i piedi di Oggi e
  // Profilo a ogni apertura della tastiera.
  interactiveWidget: "resizes-visual",
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
