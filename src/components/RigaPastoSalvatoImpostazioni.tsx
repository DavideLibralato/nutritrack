// Un pasto salvato nella pagina Impostazioni > Preferiti e pasti salvati
// (mockup docs/mockups/preferiti-e-pasti-salvati.html): nome, sotto "3
// alimenti · 412 kcal", freccia a destra. Tutta la riga apre
// ModificaPastoSalvato, la stessa schermata della matita in Aggiungi.
//
// Diversa dalla riga del pasto salvato in Aggiungi, dove il tocco aggiunge
// il pasto al diario: qui non c'è un pasto di destinazione, e il "+" non
// avrebbe senso. Per questo l'aspetto è diverso (freccia, niente "+"):
// righe uguali con gesti diversi confonderebbero.

import type { PastoSalvato } from "@/lib/inserimento/pastiSalvati";
import { kcalPastoSalvato, sottotitoloPastoSalvato } from "@/lib/inserimento/pastiSalvati";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

export default function RigaPastoSalvatoImpostazioni({
  pasto,
  onApri,
}: {
  pasto: PastoSalvato;
  onApri: () => void;
}) {
  const sottotitolo = sottotitoloPastoSalvato(pasto.voci.length, kcalPastoSalvato(pasto.voci));
  return (
    <button
      type="button"
      onClick={onApri}
      aria-label={`Modifica ${pasto.nome}, ${sottotitolo}`}
      className={`riga-impostazioni relative flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left ${CLASSE_FOCUS}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base">{pasto.nome}</span>
        <span className="mt-0.5 block text-[13px] tabular-nums text-muted">{sottotitolo}</span>
      </span>
      <svg
        aria-hidden
        width="9"
        height="15"
        viewBox="0 0 9 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-muted opacity-70"
      >
        <path d="M1.5 1.5l6 6-6 6" />
      </svg>
    </button>
  );
}
