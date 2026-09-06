// Helper specifici per il catalogo alimenti, oltre al CRUD generico di
// repositoryAlimenti.
//
// `alimenti` è l'unica tabella con `user_id` nullable (sezione 4): NULL =
// riga del catalogo condiviso, visibile a tutti; valorizzato = alimento
// privato di quell'utente. Il CRUD generico filtra per `user_id` esatto,
// quindi escluderebbe le righe condivise: per il catalogo serve l'unione
// delle due cose.

import { db } from "../db/database";
import type { Alimento } from "../db/tipi";

// Il catalogo locale visibile all'utente: i suoi alimenti privati più quelli
// condivisi. Il livello 2 (catalogo condiviso via Supabase) e il livello 3
// (Open Food Facts) della sezione 9.4 arrivano in fase 4 — qui c'è solo
// IndexedDB.
export async function catalogoLocale(userId: string): Promise<Alimento[]> {
  return db.alimenti
    .filter(
      (a) => a.deleted_at === null && (a.user_id === userId || a.user_id === null)
    )
    .toArray();
}

// Ricerca per sottostringa nel nome, indifferente a maiuscole e accenti
// ("però" trova "pero", "PANE" trova "pane"). Ordina i risultati per nome.
export function cercaPerNome(alimenti: Alimento[], query: string): Alimento[] {
  const q = senzaAccenti(query);
  if (!q) return [];

  return alimenti
    .filter((a) => senzaAccenti(a.nome).includes(q))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

function senzaAccenti(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD") // separa le lettere accentate in lettera + segno
    .replace(/\p{Diacritic}/gu, ""); // toglie i segni diacritici combinanti
}
