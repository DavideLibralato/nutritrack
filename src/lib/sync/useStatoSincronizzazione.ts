"use client";

// Lo stato della sincronizzazione per una pagina (Impostazioni >
// Sincronizzazione; poi la riga nell'elenco e il pallino sulla tab).
// Mette insieme le due fonti di statoSincronizzazione.ts:
// - la coda dell'utente, da Dexie con useLiveQuery: la query si rilancia
//   da sola quando la tabella outbox cambia, anche da un'altra scheda;
// - i giri, dalla memoria con useSyncExternalStore (l'hook di React per un
//   valore che vive fuori da React: gli si dà come iscriversi ai
//   cambiamenti e come leggere il valore).
//
// Il ridisegno dopo un secondo: "in corso" compare solo quando un giro
// dura almeno RITARDO_IN_CORSO_MS, ma il tempo che passa non avvisa
// nessuno. Quando parte un giro si programma un timer per quel momento;
// allo scatto `adesso` cambia e la pagina si ridisegna. Lo stato si scrive
// solo dentro il timer, mai subito nell'effetto (regola di React: un
// effetto non deve ridisegnare in modo sincrono).

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { riassuntoCoda, vociInCodaDellUtente } from "./codaDellUtente";
import type { VoceOutbox } from "./outbox";
import {
  iscriviStatoGiri,
  leggiStatoGiri,
  leggiStatoGiriLatoServer,
  RITARDO_IN_CORSO_MS,
  statoDaMostrare,
  type RiassuntoCoda,
  type StatoDaMostrare,
  type StatoGiri,
} from "./statoSincronizzazione";

export interface StatoSincronizzazioneUtente {
  // undefined finché Dexie non ha risposto: chi mostra lo stato aspetta,
  // invece di dire "tutto salvato" per un istante.
  stato: StatoDaMostrare | undefined;
  coda: RiassuntoCoda | undefined;
  voci: VoceOutbox[] | undefined;
  giri: StatoGiri;
  adesso: Date;
}

export function useStatoSincronizzazione(
  userId: string | null | undefined
): StatoSincronizzazioneUtente {
  const voci = useLiveQuery(
    async () => (userId ? vociInCodaDellUtente(userId) : undefined),
    [userId]
  );
  const giri = useSyncExternalStore(iscriviStatoGiri, leggiStatoGiri, leggiStatoGiriLatoServer);
  const [adessoMs, setAdessoMs] = useState(() => Date.now());

  useEffect(() => {
    // A ogni cambiamento dei giri: `adesso` torna attuale (per "controllato
    // alle" e "da quando") e, se c'è un giro in corso, si programma il
    // ridisegno per quando avrà superato il ritardo.
    const inizio = giri.inCorsoDal ? Date.parse(giri.inCorsoDal) : null;
    const attesa = inizio === null ? 0 : Math.max(0, inizio + RITARDO_IN_CORSO_MS - Date.now());
    const timer = setTimeout(() => setAdessoMs(Date.now()), attesa);
    return () => clearTimeout(timer);
  }, [giri]);

  const coda = voci ? riassuntoCoda(voci) : undefined;
  return {
    stato: coda ? statoDaMostrare(coda, giri, adessoMs) : undefined,
    coda,
    voci,
    giri,
    adesso: new Date(adessoMs),
  };
}
