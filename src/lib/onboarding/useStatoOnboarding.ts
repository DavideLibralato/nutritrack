"use client";

// Lo stato del segno dell'onboarding per una pagina (PUNTO_DI_PARTENZA.md,
// sezione 3, "Onboarding"): mette insieme i cinque ingressi di statoSegno
// (statoOnboarding.ts) e la sua risposta. Lo useranno la pagina
// /onboarding, la guardia in (app)/layout.tsx e la scheda di Oggi.
//
// Gli ingressi, ognuno con il suo modo di avvisare React quando cambia:
//   - i metadati dell'account: useMetadatiUtente (onAuthStateChange);
//   - la chiave locale: useSyncExternalStore con iscriviSegnoLocale, che
//     segnoOnboarding.ts avvisa a ogni scrittura;
//   - obiettivi vivi e righe dell'utente in Dexie: useLiveQuery, che si
//     rilancia da sola quando le tabelle cambiano;
//   - la discesa riuscita in questa sessione: useDiscesaRiuscita.
//
// `undefined` = non ancora noto: finché non ci sono l'utente, i metadati e la
// risposta di Dexie. Chi lo usa aspetta, invece di decidere su un "niente"
// che è solo "non ancora letto".

import { useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMetadatiUtente, useUtenteId } from "../supabase/useUtente";
import { useDiscesaRiuscita } from "../sync/useDiscesaRiuscita";
import { repositoryMisurazioni, repositoryObiettivi, repositoryProfili } from "../repository";
import { iscriviSegnoLocale, leggiSegnoLocale } from "./segnoOnboarding";
import { segnoDaiMetadati, statoSegno, type StatoSegno } from "./statoOnboarding";

const NESSUN_SEGNO: StatoSegno = {
  segno: null,
  mostraOnboarding: false,
  mostraScheda: false,
  attendiDiscesa: false,
};

export function useStatoOnboarding(): StatoSegno | undefined {
  const userId = useUtenteId();
  const metadati = useMetadatiUtente();
  const locale = useSyncExternalStore(
    iscriviSegnoLocale,
    () => (userId ? leggiSegnoLocale(userId) : null),
    () => null
  );
  const discesaRiuscita = useDiscesaRiuscita(userId);

  // Le righe delle tre tabelle da cui si decide l'onboarding (le stesse di
  // righeOnboardingInDexie in segnoOnboarding.ts): vive, dell'utente.
  const dati = useLiveQuery(async () => {
    if (!userId) return undefined;
    const [profili, misurazioni, obiettivi] = await Promise.all([
      repositoryProfili.ottieniTutti(userId),
      repositoryMisurazioni.ottieniTutti(userId),
      repositoryObiettivi.ottieniTutti(userId),
    ]);
    return {
      ciSonoObiettivi: obiettivi.length > 0,
      righeInDexie: profili.length > 0 || misurazioni.length > 0 || obiettivi.length > 0,
    };
  }, [userId]);

  if (userId === null) return NESSUN_SEGNO;
  if (userId === undefined || metadati === undefined || dati === undefined) return undefined;

  return statoSegno({
    metadati: segnoDaiMetadati(metadati ?? undefined),
    locale,
    ciSonoObiettivi: dati.ciSonoObiettivi,
    discesaRiuscita,
    righeInDexie: dati.righeInDexie,
  });
}
