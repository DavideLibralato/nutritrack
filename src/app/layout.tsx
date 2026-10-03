import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import RegistraServiceWorker from "@/components/RegistraServiceWorker";
import Sincronizzazione from "@/components/Sincronizzazione";
import { COLORI_BARRA, SCRIPT_TEMA } from "@/lib/tema";

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

// Il colore della barra di Safari/Chrome (theme-color) non sta qui ma nei
// <meta> scritti in RootLayout, accanto allo script del tema, così il loro
// ordine in <head> è sicuro.
export const viewport: Viewport = {
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
    // suppressHydrationWarning: lo script del tema aggiunge data-tema a
    // <html> prima che arrivi React, che confronterebbe l'<html> della
    // pagina con il suo e segnalerebbe l'attributo in più come un errore.
    // Così lo accetta. Vale solo per gli attributi di <html>, non per ciò
    // che c'è dentro.
    <html
      lang="it"
      className={`${fontIntestazioni.variable} ${fontTesto.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Colore della barra di Safari/Chrome e dell'anteprima nel
            multitasking, in tinta con lo sfondo: uno per tema del telefono
            (media). Sono la rete di sicurezza se lo script non parte: lo
            script mette davanti a questi un suo <meta> con il colore del
            tema in uso, che vince perché viene prima. */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={COLORI_BARRA.chiaro}
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content={COLORI_BARRA.scuro}
        />
        {/* Lo script del tema (src/lib/tema.ts): in linea e sincrono, il
            browser lo esegue appena lo legge, prima di disegnare la pagina.
            La pagina nasce già col tema giusto, senza lampi. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <RegistraServiceWorker />
        <Sincronizzazione />
      </body>
    </html>
  );
}
