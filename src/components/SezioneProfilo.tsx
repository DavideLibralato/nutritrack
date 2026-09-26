// Una sezione del modulo Profilo (Dati personali, Obiettivo, Giorni
// differenziati). Quando ha modifiche non ancora salvate si riconosce a colpo
// d'occhio: bordo d'accento ed etichetta "Modificato" accanto al titolo. Sotto
// i singoli campi cambiati, il valore precedente lo mostra ValorePrecedente.

import type { ReactNode } from "react";

export default function SezioneProfilo({
  titolo,
  modificata,
  errore,
  children,
}: {
  titolo: string;
  modificata: boolean;
  errore?: string | null;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={titolo}
      className={`w-full max-w-sm space-y-5 rounded-xl border p-4 ${
        modificata ? "border-accent" : "border-border"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-display font-bold">{titolo}</h2>
        {modificata && (
          <span className="text-xs font-medium uppercase tracking-wide text-accent">
            Modificato
          </span>
        )}
      </div>

      {children}

      {errore && <p className="text-sm text-warning">{errore}</p>}
    </section>
  );
}
