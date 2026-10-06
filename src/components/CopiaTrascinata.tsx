"use client";

// La copia che segue il dito mentre si trascina un alimento o un pasto in
// Oggi (src/lib/trascinaInPasto.ts, dove c'è il perché di una copia invece
// della riga vera). In un portale su document.body, position: fixed, sopra
// a tutto; parte esattamente sopra la riga vera e si muove con `transform`,
// scritto da useTrascinaInPasto senza passare da React. Non riceve tocchi.
//
// Concetto React, "portale" (createPortal): il componente sta nell'albero di
// Oggi (riceve le sue props, si smonta con lei), ma il suo HTML finisce in
// un altro punto della pagina, qui in fondo a <body>, fuori dalla lista che
// lo taglierebbe.
//
// Alimento: nome e "80 g · 200 kcal", larga quanto la riga. Pasto intero:
// compatta, nome e numero di alimenti ("Pranzo · 3 alimenti").

import { createPortal } from "react-dom";

interface Props {
  rettangolo: { top: number; left: number; width: number };
  titolo: string;
  dettaglio?: string;
  // Pasto intero: larga quanto il contenuto, non quanto la riga.
  compatta: boolean;
  rifElemento: (el: HTMLElement | null) => void;
}

export default function CopiaTrascinata({ rettangolo, titolo, dettaglio, compatta, rifElemento }: Props) {
  return createPortal(
    <div
      ref={rifElemento}
      aria-hidden
      style={{
        top: rettangolo.top,
        left: rettangolo.left,
        width: compatta ? undefined : rettangolo.width,
        boxShadow: "0 0 0 6px var(--superficie), var(--ombra-fluttuante)",
      }}
      className="pointer-events-none fixed z-50 flex items-baseline justify-between gap-3 rounded bg-surface py-1 text-sm"
    >
      <span className="min-w-0 truncate font-medium text-foreground">{titolo}</span>
      {dettaglio && <span className="shrink-0 text-muted">{dettaglio}</span>}
    </div>,
    document.body
  );
}
