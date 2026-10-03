// Un interruttore acceso/spento come quelli dell'iPhone, in una riga di un
// GruppoImpostazioni: etichetta a sinistra, interruttore a destra. Tutta la
// riga è toccabile (alta almeno 52 px).
//
// role="switch" con aria-checked: uno screen reader lo legge come
// "interruttore, attivo/non attivo", non come un bottone qualunque.
// Colori solo da token: acceso il verde pieno dei bottoni, spento il colore
// delle linee; il pallino è del colore del testo sui bottoni pieni, con
// l'ombra leggera degli elementi fluttuanti, così si vede anche spento.

import { CLASSE_FOCUS } from "@/lib/classeFocus";

export default function Interruttore({
  etichetta,
  acceso,
  onCambia,
}: {
  etichetta: string;
  acceso: boolean;
  onCambia: (acceso: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acceso}
      onClick={() => onCambia(!acceso)}
      className={`riga-impostazioni relative flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left text-base ${CLASSE_FOCUS}`}
    >
      <span className="min-w-0 flex-1">{etichetta}</span>
      <span
        aria-hidden
        className={`relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-150 motion-reduce:transition-none ${
          acceso ? "bg-accent-strong" : "bg-[var(--linea)]"
        }`}
      >
        <span
          style={{ boxShadow: "var(--ombra-fluttuante)" }}
          className={`absolute size-[27px] rounded-full bg-[var(--su-pieno)] transition-[left] duration-150 motion-reduce:transition-none ${
            acceso ? "left-[22px]" : "left-[2px]"
          }`}
        />
      </span>
    </button>
  );
}
