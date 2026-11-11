"use client";

// Il testo del promemoria per una pagina (ultimaEsportazione.ts): la pagina
// Esporta sotto il pulsante, Impostazioni nella nota del gruppo «I tuoi
// dati». useSyncExternalStore legge la data da localStorage e ridisegna
// quando segnaEsportazione o togliUltimaEsportazione avvisano. Sul server
// (Next disegna anche lì) localStorage non c'è: undefined, e la riga
// compare solo nel browser, senza un «Mai esportato» falso per un istante.

import { useCallback, useSyncExternalStore } from "react";
import {
  iscriviUltimaEsportazione,
  leggiUltimaEsportazione,
  testoPromemoria,
} from "./ultimaEsportazione";

export function useUltimaEsportazione(userId: string | null | undefined): string | undefined {
  // Il valore letto è la data salvata (una stringa o null): React ridisegna
  // solo quando cambia davvero. Il testo si ricava dopo.
  const leggi = useCallback(() => (userId ? leggiUltimaEsportazione(userId) : undefined), [userId]);
  const ultima = useSyncExternalStore(iscriviUltimaEsportazione, leggi, () => undefined);
  return ultima === undefined ? undefined : testoPromemoria(ultima);
}
