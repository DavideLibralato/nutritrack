"use client";

// Impostazioni > Peso (PUNTO_DI_PARTENZA.md, sezione 3, "Impostazioni" e
// "Peso"; passo "peso" del 3/10). In alto l'ultima pesata con la data, sotto
// "Registra peso", che salva subito in `misurazioni` (una pesata al giorno:
// la seconda aggiorna la prima). Niente storico né grafico qui: lo storico
// del peso arriva con Statistiche.
//
// Nessun Salva e nessun modulo, quindi niente guardiano delle modifiche: un
// peso scritto e non registrato è un numero solo, con il suo pulsante
// accanto.

import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { repositoryMisurazioni } from "@/lib/repository";
import { ultimaMisurazione } from "@/lib/repository/misurazioni";
import { oggiLocale } from "@/lib/dataGiorno";
import { testoUltimaPesata } from "@/lib/profilo/testiPeso";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RegistraPeso from "@/components/RegistraPeso";

export default function PesoPage() {
  const userId = useUtenteId();

  // undefined = "non so ancora" (userId o Dexie non ancora pronti): finché
  // è così non si mostra "Nessuna pesata registrata", che sarebbe falso.
  const misurazioniPeso = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryMisurazioni.ottieniTutti(userId);
    return righe.filter((riga) => riga.tipo === "peso");
  }, [userId]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <IntestazioneSottopagina titolo="Peso" />

      {userId && misurazioniPeso !== undefined ? (
        <>
          <GruppoImpostazioni titolo="Ultima pesata">
            <p className="px-4 py-3.5 font-display text-2xl font-bold">
              {testoUltimaPesata(ultimaMisurazione(misurazioniPeso), oggiLocale())}
            </p>
          </GruppoImpostazioni>

          <GruppoImpostazioni
            titolo="Nuova pesata"
            nota="Si registra subito, senza il pulsante Salva. Una pesata al giorno: la seconda sostituisce la prima."
          >
            <RegistraPeso userId={userId} />
          </GruppoImpostazioni>
        </>
      ) : (
        <p className="text-sm text-muted">Caricamento...</p>
      )}
    </main>
  );
}
