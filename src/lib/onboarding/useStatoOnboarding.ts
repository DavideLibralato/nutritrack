"use client";

// Lo stato del segno dell'onboarding per una pagina (PUNTO_DI_PARTENZA.md,
// sezione 3, "Onboarding"): mette insieme i cinque ingressi di statoSegno
// (statoOnboarding.ts) e la sua risposta. Lo usano la pagina /onboarding,
// la guardia in (app)/layout.tsx e (commit dopo) la scheda di Oggi.
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
//
// Due forme:
//   - useStatoOnboarding(): utente e metadati dalla sessione di supabase-js
//     (useUtenteId, useMetadatiUtente). useUtenteId fa una chiamata getUser
//     al server a ogni montaggio: va bene nella pagina /onboarding;
//   - useStatoOnboardingPer(userId, segno): il cuore, con utente e segno già
//     letti da chi chiama. La guardia lo usa con quelli del cookie, senza
//     rete. userId null = nessun utente: niente Dexie, niente da mostrare.

import { useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMetadatiUtente, useUtenteId } from "../supabase/useUtente";
import { useDiscesaRiuscita } from "../sync/useDiscesaRiuscita";
import { repositoryMisurazioni, repositoryObiettivi, repositoryProfili } from "../repository";
import { iscriviSegnoLocale, leggiSegnoLocale } from "./segnoOnboarding";
import { segnoDaiMetadati, statoSegno, type SegnoMetadati, type StatoSegno } from "./statoOnboarding";

const NESSUN_SEGNO: StatoSegno = {
  segno: null,
  mostraOnboarding: false,
  mostraScheda: false,
  attendiDiscesa: false,
};

export function useStatoOnboarding(): StatoSegno | undefined {
  const userId = useUtenteId();
  const metadati = useMetadatiUtente();
  return useStatoOnboardingPer(userId, metadati === undefined ? undefined : segnoDaiMetadati(metadati ?? undefined));
}

// `segno`: il segno nei metadati, già interpretato (segnoDaiMetadati);
// undefined finché i metadati non sono letti.
export function useStatoOnboardingPer(
  userId: string | null | undefined,
  segno: SegnoMetadati | undefined
): StatoSegno | undefined {
  const locale = useSyncExternalStore(
    iscriviSegnoLocale,
    () => (userId ? leggiSegnoLocale(userId) : null),
    () => null
  );
  const discesaRiuscita = useDiscesaRiuscita(userId);

  // Le righe delle tre tabelle da cui si decide l'onboarding (le stesse di
  // righeOnboardingInDexie in segnoOnboarding.ts): vive, dell'utente.
  // Senza utente la query non legge niente.
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
  if (userId === undefined || segno === undefined || dati === undefined) return undefined;

  return statoSegno({
    metadati: segno,
    locale,
    ciSonoObiettivi: dati.ciSonoObiettivi,
    discesaRiuscita,
    righeInDexie: dati.righeInDexie,
  });
}
