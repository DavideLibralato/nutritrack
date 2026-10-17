"use client";

// Il segno "discesa riuscita in questa sessione" per una pagina
// (statoSincronizzazione.ts, discesaRiuscitaPer; dal 17/10, branch
// onboarding). Vero quando profili, misurazioni e obiettivi dell'utente sono
// scese almeno una volta da quando l'app è aperta.
//
// useSyncExternalStore è l'hook di React per un valore che vive fuori da
// React (come in useStatoSincronizzazione): gli si dà come iscriversi ai
// cambiamenti (iscriviStatoGiri) e come leggere il valore adesso. Il valore
// è un vero/falso, quindi React ridisegna solo quando cambia davvero. Il
// terzo argomento è il valore durante il disegno sul server, dove non c'è
// una sessione: sempre falso.

import { useCallback, useSyncExternalStore } from "react";
import { discesaRiuscitaPer, iscriviStatoGiri } from "./statoSincronizzazione";

export function useDiscesaRiuscita(userId: string | null | undefined): boolean {
  // useCallback: la stessa funzione finché l'utente non cambia; se cambia,
  // React rilegge il valore per l'utente nuovo.
  const leggi = useCallback(() => discesaRiuscitaPer(userId), [userId]);
  return useSyncExternalStore(iscriviStatoGiri, leggi, () => false);
}
