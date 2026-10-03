"use client";

// Impostazioni > Sincronizzazione (PUNTO_DI_PARTENZA.md, sezione 3,
// "Impostazioni"). Oggi c'è solo "Ricarica i dati dal tuo account" (§9.2).
// Qui arriverà l'indicatore di sincronizzazione (§11, "Non ancora
// costruito"); finché non c'è, la riga nell'elenco non mostra nessuno stato.

import { useUtenteId } from "@/lib/supabase/useUtente";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RicaricaDatiAccount from "@/components/RicaricaDatiAccount";

export default function SincronizzazionePage() {
  const userId = useUtenteId();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <IntestazioneSottopagina titolo="Sincronizzazione" />
      {userId && (
        <GruppoImpostazioni titolo="Dati su questo dispositivo">
          <RicaricaDatiAccount userId={userId} />
        </GruppoImpostazioni>
      )}
    </main>
  );
}
