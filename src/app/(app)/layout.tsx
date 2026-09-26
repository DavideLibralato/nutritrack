// Layout condiviso delle schermate con la tab bar (Oggi, Statistiche,
// Profilo). Le parentesi in "(app)" fanno di questa cartella un *route
// group*: raggruppa più pagine sotto un layout comune senza aggiungere
// nulla all'URL — "/" resta "/" e "/profilo" resta "/profilo".
//
// Login e registrazione stanno fuori da questo gruppo, quindi non ereditano
// la tab bar.
//
// Struttura: a scorrere è il DOCUMENTO, non un <div> interno. La tab bar è
// `position: fixed` in fondo (BarraNavigazione) e il contenuto lascia sotto
// di sé uno spazio pari alla sua altezza (--altezza-tab-bar, globals.css),
// così l'ultima riga non le finisce dietro.
//
// Perché così: su iPhone la tastiera non accorcia il layout, lo copre. Se a
// scorrere è il documento, iOS porta da solo il campo toccato sopra la
// tastiera facendo scorrere la pagina, e gli elementi fissi in fondo (tab
// bar, barra Salva di Profilo) restano sul fondo del layout, cioè sotto la
// tastiera, coperti. Con la vecchia colonna alta 100dvh e il <div> che
// scorreva, iOS non poteva scorrere il div e spostava l'intera finestra,
// portandosi dietro le barre (PUNTO_DI_PARTENZA.md, sezione 3, "Layout
// delle pagine con la tab bar").
//
// `flex-1 flex-col`: il <body> è già una colonna alta almeno lo schermo, e
// questo contenitore la riempie, così una pagina corta (Statistiche) può
// centrarsi con `flex-1` nello spazio sopra la tab bar. Oggi invece si dà
// un'altezza fissa e fa scorrere solo la sua lista centrale.

import type { ReactNode } from "react";
import BarraNavigazione from "@/components/BarraNavigazione";

export default function LayoutApp({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex flex-1 flex-col pb-[var(--altezza-tab-bar)]">{children}</div>
      <BarraNavigazione />
    </>
  );
}
