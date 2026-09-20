// Il livello repository (CLAUDE.md: "la UI non chiama mai Supabase
// direttamente, passa sempre dal livello repository").
//
// Concetto nuovo: questa è una "fabbrica" di repository. `creaRepository` è
// una funzione generica (il `<T>`) che, dato un tipo di riga e la tabella
// Dexie corrispondente, restituisce le funzioni di lettura/scrittura per
// quella tabella. Si scrive una volta sola qui, e in
// src/lib/repository/index.ts la si applica alle 9 tabelle: senza questa
// fabbrica servirebbero le stesse cinque funzioni copiate e incollate 9
// volte, una per tabella.
//
// Ogni scrittura fa tre cose: salva nella tabella locale (quello che la UI
// legge subito, anche offline), accoda la stessa riga nell'outbox, e prova
// subito a svuotare la coda verso Supabase. Il tentativo di sync non viene
// mai atteso (niente `await`): se c'è rete la scrittura raggiunge Supabase
// in pochi istanti, se non c'è rete fallisce in silenzio e resta in coda —
// in entrambi i casi la UI ha già la sua risposta, dal passo locale.
// SincronizzaOutbox (mount + evento "online") resta la rete di sicurezza
// per quando questo tentativo immediato non basta.

import type { Table } from "dexie";
import type { NomeTabella, RigaBase } from "../db/tipi";
import { accodaMutazione } from "../sync/outbox";
import { sincronizzaOutbox } from "../sync/sincronizza";

export function creaRepository<T extends RigaBase>(
  tabella: Table<T, string>,
  nomeTabella: NomeTabella
) {
  async function ottieniTutti(userId: string | null): Promise<T[]> {
    return tabella
      .filter((riga) => riga.user_id === userId && riga.deleted_at === null)
      .toArray();
  }

  async function ottieniPerId(id: string): Promise<T | undefined> {
    return tabella.get(id);
  }

  // idEsplicito: normalmente l'id è un uuid casuale, generato qui. Il
  // parametro esiste per i pochi casi (oggi solo il seed dei pasti
  // predefiniti, src/lib/repository/pasti.ts) in cui l'id deve essere
  // deterministico — calcolato da chi chiama a partire da dati stabili
  // (utente + nome canonico) — così due dispositivi che creano la stessa
  // riga "di diritto" senza essersi mai sincronizzati producono lo stesso
  // id invece di due righe diverse che poi divergono per sempre.
  async function crea(
    dati: Omit<T, "id" | "updated_at" | "deleted_at">,
    idEsplicito?: string
  ): Promise<T> {
    const riga = {
      ...dati,
      id: idEsplicito ?? crypto.randomUUID(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    } as T;

    await tabella.put(riga);
    await accodaMutazione(nomeTabella, riga);
    sincronizzaOutbox().catch(() => {});

    return riga;
  }

  async function aggiorna(id: string, modifiche: Partial<T>): Promise<T> {
    const esistente = await tabella.get(id);
    if (!esistente) {
      throw new Error(`Riga "${id}" non trovata in "${nomeTabella}"`);
    }

    const riga: T = {
      ...esistente,
      ...modifiche,
      updated_at: new Date().toISOString(),
    };

    await tabella.put(riga);
    await accodaMutazione(nomeTabella, riga);
    sincronizzaOutbox().catch(() => {});

    return riga;
  }

  // Cancellazione logica (sezione 4): scrive deleted_at, non rimuove la riga.
  async function elimina(id: string): Promise<void> {
    await aggiorna(id, { deleted_at: new Date().toISOString() } as Partial<T>);
  }

  return { ottieniTutti, ottieniPerId, crea, aggiorna, elimina };
}
