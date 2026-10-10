// Le schede in cima a Pasti e orari quando c'è almeno un cambio programmato
// (PUNTO_DI_PARTENZA.md, sezione 3, "Pasti e orari", "Schede per data";
// mockup docs/mockups/pasti-e-orari.html, "2 · Schede per data"): "Oggi" e
// una pastiglia "Dal lun 12 ott" per ogni data con cambi. Le date arrivano
// dalla pagina, che le calcola dalle righe (dateProgrammate): qui non si
// salva niente.
//
// Ogni scheda è un bottone con aria-pressed, come SelettoreSegmenti; a
// differenza sua le pastiglie non si stringono: con tante date la fila
// scorre di lato.

import { formattaGiornoCorto } from "@/lib/dataGiorno";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

export default function SchedePerData({
  date,
  selezionata,
  onCambia,
}: {
  date: string[];
  // null: la scheda "Oggi".
  selezionata: string | null;
  onCambia: (data: string | null) => void;
}) {
  const schede: { data: string | null; etichetta: string }[] = [
    { data: null, etichetta: "Oggi" },
    ...date.map((d) => ({ data: d, etichetta: `Dal ${formattaGiornoCorto(d)}` })),
  ];
  return (
    <div role="group" aria-label="Pasti per data" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
      {schede.map((s) => {
        const attiva = s.data === selezionata;
        return (
          <button
            key={s.data ?? "oggi"}
            type="button"
            aria-pressed={attiva}
            onClick={() => onCambia(s.data)}
            className={`min-h-9 flex-none rounded-full border-[1.5px] px-3.5 text-sm font-medium whitespace-nowrap ${
              attiva ? "border-accent bg-[var(--capsula-attiva)] text-[var(--testo-capsula)]" : "border-border text-foreground"
            } ${CLASSE_FOCUS}`}
          >
            {s.etichetta}
          </button>
        );
      })}
    </div>
  );
}
