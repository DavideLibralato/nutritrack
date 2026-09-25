"use client";

// Barra temporanea in basso: un messaggio breve, e facoltativamente un'azione
// ("Annulla"). Compare DOPO che qualcosa è successo — a differenza dell'avviso
// dentro SheetNome, che compare PRIMA e chiede conferma. Oggi la usano:
// - /aggiungi, dopo la cancellazione di un alimento, con "Annulla" (regola
//   "Alimenti cancellati" in PUNTO_DI_PARTENZA.md, punto 4);
// - Oggi, al tocco della stella su un pasto il cui contenuto è già salvato
//   (punto 3), senza azione.
//
// Se l'utente non fa niente, dopo `durataMs` chiama onChiudi e sparisce: non
// succede nient'altro. Il conto alla rovescia si ferma mentre il dito/mouse
// è sopra la barra o il pulsante ha il fuoco da tastiera, e riparte da capo
// quando se ne va — un tempo che scade mentre qualcuno sta per premere è la
// cosa più frustrante che una barra così possa fare.
//
// Posizione: `absolute`, ancorata al fondo del contenitore in cui la si
// mette (il chiamante gli dà `relative`). Non ha un suo `fixed` apposta: in
// /aggiungi il contenitore è il <main>, già agganciato al visual viewport con
// useAreaVisibile (src/lib/areaVisibile.ts, stesso meccanismo degli sheet),
// quindi la barra sta sopra la tastiera di iOS insieme a tutta la pagina.
// `sopra`: invece di stare nel fondo del contenitore, sta appena sopra di
// esso (in Oggi: sopra la fascia del "+ Aggiungi", senza coprirla).
// `margineHome`: aggiunge sotto lo spazio della barretta home di iOS
// (env(safe-area-inset-bottom)) — serve dove il contenitore arriva fino al
// bordo dello schermo, non dove sotto c'è già qualcosa che lo gestisce.
//
// Concetto React: la `key` che il chiamante dà a questo componente. Cambiarla
// (un nuovo messaggio) fa ripartire il componente da zero, timer compreso,
// invece di continuare il conto alla rovescia del messaggio precedente.

import { useEffect, useRef, useState } from "react";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

interface Props {
  testo: string;
  azione?: { etichetta: string; onClick: () => void };
  durataMs?: number;
  onChiudi: () => void;
  sopra?: boolean;
  margineHome?: boolean;
}

export default function BarraAnnulla({
  testo,
  azione,
  durataMs = 8000,
  onChiudi,
  sopra = false,
  margineHome = false,
}: Props) {
  const [inPausa, setInPausa] = useState(false);

  // onChiudi tenuto in un ref: la pagina che ospita la barra si ridisegna
  // spesso (useLiveQuery), e se il timer dipendesse direttamente da
  // onChiudi ripartirebbe da capo ogni volta che la funzione cambia identità
  // — la barra non sparirebbe mai finché i dati si muovono.
  const rifOnChiudi = useRef(onChiudi);
  useEffect(() => {
    rifOnChiudi.current = onChiudi;
  }, [onChiudi]);

  useEffect(() => {
    if (inPausa) return;
    const timer = setTimeout(() => rifOnChiudi.current(), durataMs);
    return () => clearTimeout(timer);
  }, [inPausa, durataMs]);

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-40 px-4 ${
        sopra ? "bottom-full" : "bottom-0"
      } ${margineHome ? "pb-[calc(1rem+env(safe-area-inset-bottom))]" : "pb-3"}`}
    >
      {/* role="status": gli screen reader leggono il testo quando compare,
          senza spostare il fuoco da dove l'utente si trova. */}
      <div
        role="status"
        onPointerEnter={() => setInPausa(true)}
        onPointerLeave={() => setInPausa(false)}
        onFocus={() => setInPausa(true)}
        onBlur={() => setInPausa(false)}
        className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-xl bg-foreground py-3 pl-4 pr-2 text-sm text-background shadow-lg"
      >
        <p className="min-w-0 flex-1">{testo}</p>
        {azione && (
          <button
            type="button"
            onClick={azione.onClick}
            className={`shrink-0 rounded-lg px-3 py-1.5 font-semibold underline underline-offset-2 ${CLASSE_FOCUS}`}
          >
            {azione.etichetta}
          </button>
        )}
      </div>
    </div>
  );
}
