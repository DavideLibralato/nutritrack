// Helper specifici per i preferiti, oltre al CRUD generico di
// repositoryPreferiti. Solo alimenti singoli in questo pezzo — i pasti
// salvati (composizioni) sono un giro a parte.

import { db } from "../db/database";
import { repositoryPreferiti } from "./index";
import type { Preferito } from "../db/tipi";

export function ePreferito(preferiti: Preferito[], alimentoId: string): boolean {
  return preferiti.some((p) => p.alimento_id === alimentoId);
}

// Aggiunge o toglie in base allo stato attuale: un solo punto d'ingresso per
// la stella nello sheet quantità, che non deve sapere se sta aggiungendo o
// togliendo. Scrive subito nel repository (non solo stato locale) — la
// stella riflette poi lo stato vero tramite la liveQuery del chiamante.
//
// Bug corretto qui (trovato controllando le voci ferme nell'outbox): togliere
// e rimettere la stessa stella faceva sempre un crea() con un id nuovo,
// perché `preferiti` (passato dal chiamante) arriva già filtrato senza le
// righe cancellate — la vecchia riga cancellata restava su Supabase, e il
// vincolo unico su (user_id, alimento_id) non fa eccezione per le righe
// cancellate logicamente. Risultato: "duplicate key" a ogni ri-aggiunta, mai
// visibile a schermo (fallimento di sync silenzioso). Ora, se una riga
// cancellata per lo stesso alimento esiste già, si risuscita (deleted_at ->
// null) invece di crearne una seconda — per questo si guarda direttamente
// la tabella Dexie, non l'elenco già filtrato.
export async function togglePreferito(
  userId: string,
  preferiti: Preferito[],
  alimentoId: string
): Promise<void> {
  const vivo = preferiti.find((p) => p.alimento_id === alimentoId);
  if (vivo) {
    await repositoryPreferiti.elimina(vivo.id);
    return;
  }

  const cancellati = await db.preferiti
    .filter(
      (p) => p.user_id === userId && p.alimento_id === alimentoId && p.deleted_at !== null
    )
    .toArray();

  if (cancellati.length > 0) {
    // Se per il bug ne sono rimaste più di una (crea() ripetuti nel tempo),
    // si risuscita la più recente: le altre restano cancellate, innocue,
    // detriti da un giro di pulizia a parte sull'outbox — non qui.
    const daResuscitare = [...cancellati].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at)
    )[0];
    await repositoryPreferiti.aggiorna(daResuscitare.id, { deleted_at: null });
    return;
  }

  await repositoryPreferiti.crea({ user_id: userId, alimento_id: alimentoId });
}
