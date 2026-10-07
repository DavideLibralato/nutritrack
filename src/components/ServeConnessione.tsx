// "Serve la connessione" (PUNTO_DI_PARTENZA.md, sezione 9.2, "Seed dei
// pasti predefiniti"): al primo avvio su un dispositivo vuoto, senza rete,
// l'app non può sapere quali pasti hai già e non li crea alla cieca. Il
// riquadro prende il posto dell'elenco dei pasti in Oggi e in Aggiungi.
// Riprova da solo quando torna la rete (usePastiIniziali); "Riprova" è per
// chi non vuole aspettare.
//
// Disegno del mockup "Pasti e orari", sezione "Primo avvio senza rete".

import { CLASSE_FOCUS } from "@/lib/classeFocus";

export default function ServeConnessione({ onRiprova }: { onRiprova: () => void }) {
  return (
    <div className="rounded-2xl bg-surface p-5 text-center">
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="mx-auto text-muted"
      >
        <path d="M3 3l18 18" />
        <path d="M8.5 8.6A6 6 0 0 0 6 13a4 4 0 0 0 1 7.9h10.5" />
        <path d="M20.4 17.5A4 4 0 0 0 17.5 11 6 6 0 0 0 10 6.2" />
      </svg>
      <h2 className="mt-2 font-display text-lg font-bold">Serve la connessione</h2>
      <p className="mt-1.5 text-sm text-muted">
        Al primo avvio l&apos;app scarica i tuoi pasti. Collegati a internet: riprova da sola
        appena torna la rete.
      </p>
      <button
        type="button"
        onClick={onRiprova}
        className={`mt-4 w-full rounded-lg bg-accent-strong p-3 font-medium text-on-strong ${CLASSE_FOCUS}`}
      >
        Riprova
      </button>
    </div>
  );
}
