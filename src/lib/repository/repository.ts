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
// Ogni scrittura fa due cose insieme: salva nella tabella locale (quello che
// la UI legge subito, anche offline) e accoda la stessa riga nell'outbox
// (quello che poi raggiunge Supabase). La UI non deve mai pensare alla
// sincronizzazione: la ottiene gratis usando queste funzioni.

import type { Table } from "dexie";
import type { NomeTabella, RigaBase } from "../db/tipi";
import { accodaMutazione } from "../sync/outbox";

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

  async function crea(
    dati: Omit<T, "id" | "updated_at" | "deleted_at">
  ): Promise<T> {
    const riga = {
      ...dati,
      id: crypto.randomUUID(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    } as T;

    await tabella.put(riga);
    await accodaMutazione(nomeTabella, riga);

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

    return riga;
  }

  // Cancellazione logica (sezione 4): scrive deleted_at, non rimuove la riga.
  async function elimina(id: string): Promise<void> {
    await aggiorna(id, { deleted_at: new Date().toISOString() } as Partial<T>);
  }

  return { ottieniTutti, ottieniPerId, crea, aggiorna, elimina };
}
