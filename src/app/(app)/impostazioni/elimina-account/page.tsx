// Impostazioni > Elimina account (PUNTO_DI_PARTENZA.md §3 e §9.6). Ci si
// arriva dalla riga rossa in fondo all'elenco Impostazioni, sotto Esci.
// La pagina è un componente server con dentro il componente client
// EliminaAccount, che ha gli stati e fa il lavoro.

import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import EliminaAccount from "@/components/EliminaAccount";

export default function EliminaAccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <IntestazioneSottopagina titolo="Elimina account" />
      <EliminaAccount />
    </main>
  );
}
