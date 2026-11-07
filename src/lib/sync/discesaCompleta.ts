// Il segno "discesa completa" (dal 07/11, branch esporta;
// PUNTO_DI_PARTENZA.md §10.4, "Esporta i miei dati"). Dice che su questo
// dispositivo, per questo utente, tutte le tabelle della discesa
// (TABELLE_DISCESA in discesa.ts) sono scese almeno una volta nello stesso
// giro: la copia in Dexie contiene tutto quello che il server aveva in
// quel momento. Esporta parte solo con questo segno.
//
// Diverso dal segno "discesa riuscita" dell'onboarding
// (statoSincronizzazione.ts), che resta com'è: quello sta solo in memoria e
// guarda tre tabelle. Questo sta in localStorage, così vale anche offline
// dopo aver riaperto l'app.
//
// Le regole:
// - lo accende scaricaTutto quando nessuna tabella del giro è fallita;
// - una volta acceso, un giro fallito dopo non lo spegne: ciò che il
//   server aveva è già in Dexie;
// - vale solo se in Dexie c'è anche il profilo vivo dell'utente
//   (copiaLocaleCompleta): Safari può cancellare IndexedDB lasciando il
//   localStorage, e il segno da solo direbbe "completo" su una copia vuota;
// - lo tolgono Esci (sempre, anche quando i dati restano) ed Elimina
//   account.
//
// Accesso a localStorage protetto come negli altri segni: senza
// localStorage (navigazione privata, lato server) il segno non c'è, ed
// Esporta lo dice.

import { db } from "../db/database";

export function chiaveDiscesaCompleta(userId: string): string {
  return `nutritrack:sincronizzazione:discesa-completa:${userId}`;
}

// Il valore salvato è l'ora in cui si è acceso la prima volta (ISO 8601):
// non serve a decidere niente, aiuta solo a capire, guardando il
// dispositivo, da quando vale.
export function segnaDiscesaCompleta(userId: string, adesso: Date = new Date()): void {
  try {
    if (window.localStorage.getItem(chiaveDiscesaCompleta(userId)) !== null) return;
    window.localStorage.setItem(chiaveDiscesaCompleta(userId), adesso.toISOString());
  } catch {
    // Niente localStorage: il segno non si salva.
  }
}

export function togliSegnoDiscesaCompleta(userId: string): void {
  try {
    window.localStorage.removeItem(chiaveDiscesaCompleta(userId));
  } catch {
    // Niente localStorage: non c'era niente da togliere.
  }
}

// Solo il segno, senza guardare Dexie.
export function segnoDiscesaCompleta(userId: string): boolean {
  try {
    return window.localStorage.getItem(chiaveDiscesaCompleta(userId)) !== null;
  } catch {
    return false;
  }
}

// La domanda che fa Esporta: la copia locale di questo utente è completa?
// Il segno, più il profilo vivo in Dexie.
export async function copiaLocaleCompleta(userId: string): Promise<boolean> {
  if (!segnoDiscesaCompleta(userId)) return false;
  const profiloVivo = await db.profili
    .where("user_id")
    .equals(userId)
    .filter((p) => p.deleted_at === null)
    .first();
  return profiloVivo !== undefined;
}
