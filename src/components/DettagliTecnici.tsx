// "Dettagli tecnici", chiuso di default (decisione del 10/10: l'app potrebbe
// usarla qualcuno in famiglia, che non lo apre): righe in carattere a
// larghezza fissa con quello che serve per capire un errore senza aprire
// Supabase. In Impostazioni > Sincronizzazione due volte: sotto le
// modifiche accantonate (ModificheAccantonate) e, dal 02/11/2026, per gli
// stati "sessione" ed "errore" (mockup docs/mockups/sincronizzazione-
// sessione.html, proposta C).
//
// <details> è l'elemento HTML che si apre e si chiude da solo, tastiera e
// screen reader compresi.

import { CLASSE_FOCUS } from "@/lib/classeFocus";

export default function DettagliTecnici({
  righe,
  className = "",
}: {
  righe: { chiave: string; testo: string }[];
  className?: string;
}) {
  return (
    <details className={className}>
      <summary className={`cursor-pointer py-2 text-sm font-medium text-accent ${CLASSE_FOCUS}`}>
        Dettagli tecnici
      </summary>
      {righe.map((r) => (
        <p
          key={r.chiave}
          className="mb-2 rounded-lg bg-background px-2.5 py-2 font-mono text-[11px] leading-snug break-words text-muted"
        >
          {r.testo}
        </p>
      ))}
    </details>
  );
}
