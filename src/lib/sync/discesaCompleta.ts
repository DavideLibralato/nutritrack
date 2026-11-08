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
//   (statoCopiaLocale): Safari può cancellare IndexedDB lasciando il
//   localStorage, e il segno da solo direbbe "completo" su una copia vuota;
// - lo tolgono Esci (sempre, anche quando i dati restano) ed Elimina
//   account.
//
// Accesso a localStorage protetto come negli altri segni: senza
// localStorage (navigazione privata, lato server) il segno non c'è, ed
// Esporta lo dice.

import { db } from "../db/database";
import type { NomeTabella, RigaBase } from "../db/tipi";

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
// Il segno, più il profilo vivo in Dexie. Se no, cosa manca: la pagina
// Esporta mostra due messaggi diversi (mockup docs/mockups/esporta.html):
// - "completa": il segno e il profilo vivo;
// - "non-scaricata": manca il segno, i dati non sono ancora scesi tutti.
//   Oppure il segno c'è ma in Dexie non c'è NESSUNA riga viva
//   dell'utente: Safari ha svuotato IndexedDB e lasciato il localStorage.
//   Il profilo sul server può esserci, non va creato: si aspetta la
//   discesa successiva;
// - "senza-profilo": il segno c'è, il profilo no, ma altre righe
//   dell'utente sì (almeno i pasti di base): l'utente il profilo non l'ha
//   mai compilato (chi ha rimandato l'onboarding).
export type StatoCopiaLocale = "completa" | "non-scaricata" | "senza-profilo";

// Le tabelle dati, le stesse di TABELLE_DISCESA (discesa.ts). Scritte qui
// e non importate da lì perché discesa.ts importa già questo file. Un
// Record con chiave NomeTabella: se una tabella si aggiunge a tipi.ts e
// non qui, TypeScript si ferma; che coincidano con TABELLE_DISCESA lo
// prova discesaCompleta.test.ts.
export const TABELLE_DATI: Record<NomeTabella, true> = {
  profili: true,
  obiettivi: true,
  obiettivi_target: true,
  giorni: true,
  pasti: true,
  alimenti: true,
  voci_diario: true,
  composizioni: true,
  composizioni_voci: true,
  misurazioni: true,
  preferiti: true,
};

async function haRigaViva(nome: NomeTabella, userId: string): Promise<boolean> {
  const riga = await db
    .table<RigaBase, string>(nome)
    .where("user_id")
    .equals(userId)
    .filter((r) => r.deleted_at === null)
    .first();
  return riga !== undefined;
}

export async function statoCopiaLocale(userId: string): Promise<StatoCopiaLocale> {
  if (!segnoDiscesaCompleta(userId)) return "non-scaricata";
  if (await haRigaViva("profili", userId)) return "completa";
  for (const nome of Object.keys(TABELLE_DATI) as NomeTabella[]) {
    if (await haRigaViva(nome, userId)) return "senza-profilo";
  }
  return "non-scaricata";
}

export async function copiaLocaleCompleta(userId: string): Promise<boolean> {
  return (await statoCopiaLocale(userId)) === "completa";
}
