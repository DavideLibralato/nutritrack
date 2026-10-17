// Una scelta fra poche opzioni a tessere affiancate, in griglia (mockup
// docs/mockups/onboarding.html, stile B: il sesso al passo 2
// dell'onboarding). Ogni tessera è un pulsante con aria-pressed, dentro un
// gruppo con l'etichetta per lo screen reader, come SelettoreSegmenti.
//
// `valore` null = nessuna scelta: nessuna tessera premuta. Nell'onboarding
// il sesso parte così, e Avanti resta spento finché non se ne tocca una.
// La tessera scelta: capsula d'accento (--capsula-attiva) con il testo
// --testo-capsula e il bordo d'accento; non l'accento puro sulla capsula,
// che in chiaro fa 4,2:1 (commento in globals.css).

import { CLASSE_FOCUS } from "@/lib/classeFocus";

export interface Tessera<T extends string> {
  valore: T;
  etichetta: string;
  // Nome completo per lo screen reader, se l'etichetta è abbreviata.
  etichettaAccessibile?: string;
}

export default function TessereScelta<T extends string>({
  tessere,
  valore,
  onScegli,
  etichetta,
}: {
  tessere: Tessera<T>[];
  valore: T | null;
  onScegli: (valore: T) => void;
  // Cosa si sceglie, per lo screen reader ("Sesso").
  etichetta: string;
}) {
  return (
    <div role="group" aria-label={etichetta} className="grid grid-cols-3 gap-2">
      {tessere.map((t) => {
        const scelta = t.valore === valore;
        return (
          <button
            key={t.valore}
            type="button"
            aria-pressed={scelta}
            aria-label={t.etichettaAccessibile}
            onClick={() => onScegli(t.valore)}
            className={`rounded-2xl border px-1.5 py-3 text-[15px] font-semibold ${
              scelta
                ? "border-accent bg-[var(--capsula-attiva)] text-[var(--testo-capsula)] shadow-[inset_0_0_0_1px_var(--accento)]"
                : "border-border bg-surface text-foreground"
            } ${CLASSE_FOCUS}`}
          >
            {t.etichetta}
          </button>
        );
      })}
    </div>
  );
}
