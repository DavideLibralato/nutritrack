// I sette giorni della settimana come cerchi L M M G V S D (mockup
// docs/mockups/impostazioni.html, "Giorni di allenamento"): toccato, un
// giorno si accende (verde pieno) o si spegne. È la settimana tipo del
// profilo (`giorni_allenamento_default`): propone il tipo dei giorni non
// ancora registrati, non cambia quelli già scritti (regole in
// PUNTO_DI_PARTENZA.md, sezione 3, "Giorni normali e giorni di allenamento").
//
// Ogni cerchio è un bottone con aria-pressed e il nome completo del giorno
// per lo screen reader ("Lunedì"), perché L M M G V S D da sole sono
// ambigue (due M). 40 px di cerchio, area toccabile alta 44 px.

import type { GiornoSettimana } from "@/lib/db/tipi";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

const GIORNI: { valore: GiornoSettimana; lettera: string; nome: string }[] = [
  { valore: "lunedi", lettera: "L", nome: "Lunedì" },
  { valore: "martedi", lettera: "M", nome: "Martedì" },
  { valore: "mercoledi", lettera: "M", nome: "Mercoledì" },
  { valore: "giovedi", lettera: "G", nome: "Giovedì" },
  { valore: "venerdi", lettera: "V", nome: "Venerdì" },
  { valore: "sabato", lettera: "S", nome: "Sabato" },
  { valore: "domenica", lettera: "D", nome: "Domenica" },
];

// "L M V" per il valore di prima, sotto i cerchi; "nessuno" se vuoto.
export function elencoGiorni(giorni: GiornoSettimana[]): string {
  const scelti = GIORNI.filter((g) => giorni.includes(g.valore));
  return scelti.length > 0 ? scelti.map((g) => g.nome.slice(0, 3)).join(" ") : "nessuno";
}

export default function CerchiGiorni({
  scelti,
  onAlterna,
}: {
  scelti: GiornoSettimana[];
  onAlterna: (giorno: GiornoSettimana) => void;
}) {
  return (
    <div role="group" aria-label="Giorni di allenamento" className="flex justify-between px-3 py-2">
      {GIORNI.map((g) => {
        const acceso = scelti.includes(g.valore);
        return (
          <button
            key={g.valore}
            type="button"
            aria-pressed={acceso}
            aria-label={g.nome}
            onClick={() => onAlterna(g.valore)}
            className={`flex size-11 items-center justify-center rounded-full ${CLASSE_FOCUS}`}
          >
            <span
              aria-hidden
              className={`flex size-10 items-center justify-center rounded-full border-[1.5px] font-medium ${
                acceso
                  ? "border-transparent bg-accent-strong text-on-strong"
                  : "border-border text-muted"
              }`}
            >
              {g.lettera}
            </span>
          </button>
        );
      })}
    </div>
  );
}
