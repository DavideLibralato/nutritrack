// Un alimento nella pagina Impostazioni > Preferiti e pasti salvati
// (mockup docs/mockups/preferiti-e-pasti-salvati.html, proposta A "la
// stella sulla riga"): nome, sotto "60 g · 225 kcal" (l'ultima quantità
// usata, come in Aggiungi), a destra la stella.
//
// La stella piena toglie l'alimento dai preferiti con un tocco, senza
// conferma: l'errore lo copre l'"Annulla" della barra. La riga non sparisce
// subito: resta sbiadita, con la stella vuota, finché si è sulla pagina
// (`tolto`), e ritoccare la stella lo rimette. Chi decide cosa succede è la
// pagina (onStella): questa riga disegna soltanto.
//
// Area di tocco della stella 44 px, come il segnalibro di Oggi: margini
// negativi la allargano senza spostare il disegno.

import type { Alimento } from "@/lib/db/tipi";
import { etichettaAlimento } from "@/lib/repository/alimenti";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

export default function RigaAlimentoPreferito({
  alimento,
  quantitaG,
  tolto,
  onStella,
}: {
  alimento: Alimento;
  quantitaG: number;
  tolto: boolean;
  onStella: () => void;
}) {
  const etichetta = etichettaAlimento(alimento);
  return (
    <div className="riga-impostazioni relative flex min-h-14 items-center gap-3 px-4 py-2">
      <div className={`min-w-0 flex-1 ${tolto ? "opacity-45" : ""}`}>
        <p className="truncate text-base">{etichetta}</p>
        <p className="mt-0.5 text-[13px] tabular-nums text-muted">
          {quantitaG} g · {Math.round((alimento.kcal_100g * quantitaG) / 100)} kcal
        </p>
      </div>
      <button
        type="button"
        onClick={onStella}
        aria-pressed={!tolto}
        aria-label={tolto ? `Rimetti ${etichetta} nei preferiti` : `Togli ${etichetta} dai preferiti`}
        className={`-my-2.5 -mr-2.5 flex size-11 shrink-0 items-center justify-center rounded-lg ${
          tolto ? "text-muted" : "text-accent"
        } ${CLASSE_FOCUS}`}
      >
        <Stella piena={!tolto} />
      </button>
    </div>
  );
}

function Stella({ piena }: { piena: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={piena ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
    </svg>
  );
}
