// Un gruppo dell'elenco Impostazioni (PUNTO_DI_PARTENZA.md, sezione 3,
// "Impostazioni"; mockup in docs/mockups/impostazioni.html): un riquadro
// arrotondato con le righe dentro, e sopra un titolo facoltativo piccolo,
// grigio e in maiuscolo ("ALIMENTAZIONE", "APP"). Sotto, una nota
// facoltativa in grigio (come le spiegazioni sotto i gruppi dell'iPhone).
//
// Nelle pagine con un modulo (Profilo, Obiettivi) il gruppo dice anche se ha
// modifiche non salvate, come le sezioni del vecchio Profilo: bordo
// d'accento ed etichetta "Modificato" accanto al titolo (`modificato`). Un
// errore di validazione compare sotto, in arancio (`errore`).
//
// Lo sfondo è --superficie (bg-surface): bianco sul crema in chiaro, un
// marrone appena più chiaro dello sfondo al buio.

import type { ReactNode } from "react";

export default function GruppoImpostazioni({
  titolo,
  nota,
  modificato = false,
  errore,
  children,
}: {
  titolo?: string;
  nota?: ReactNode;
  modificato?: boolean;
  errore?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="w-full">
      {(titolo || modificato) && (
        <div className="mx-4 mb-2 flex items-baseline justify-between gap-3">
          {titolo && (
            <h2 className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{titolo}</h2>
          )}
          {modificato && (
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-accent">
              Modificato
            </span>
          )}
        </div>
      )}
      <div
        className={`overflow-hidden rounded-[20px] border bg-surface ${
          modificato ? "border-accent" : "border-border"
        }`}
      >
        {children}
      </div>
      {errore && (
        <div role="alert" className="mx-4 mt-2 text-sm leading-snug text-warning">
          {errore}
        </div>
      )}
      {nota && <div className="mx-4 mt-2 text-sm leading-snug text-muted">{nota}</div>}
    </section>
  );
}
