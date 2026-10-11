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

// Togli e rimetti dalla pagina Impostazioni > Preferiti e pasti salvati: la
// stella sulla riga e l'"Annulla" della barra. A differenza di
// togglePreferito, non decidono da un elenco passato dal chiamante: lo
// rileggono da Dexie. Il motivo è il tocco veloce: stella e subito "Annulla",
// prima che la liveQuery della pagina abbia ridisegnato. Con l'elenco della
// pagina, ancora vecchio di un giro, l'Annulla vedrebbe il preferito "vivo"
// e invece di rimetterlo lo toglierebbe di nuovo.
//
// Tutte e due si possono chiamare due volte senza danni: togliere un
// alimento che non è fra i preferiti, o rimetterne uno che c'è già, non fa
// niente.

// Toglie TUTTE le righe vive di quell'alimento: di norma una, ma due
// dispositivi offline possono averne create due (alimentiPreferiti le
// mostra come una sola), e toglierne una lascerebbe la stella piena.
export async function togliPreferito(userId: string, alimentoId: string): Promise<void> {
  const vivi = await repositoryPreferiti.ottieniTutti(userId);
  await Promise.all(
    vivi.filter((p) => p.alimento_id === alimentoId).map((p) => repositoryPreferiti.elimina(p.id))
  );
}

// Rimette l'alimento fra i preferiti passando da togglePreferito, che
// rimette in vita la riga cancellata (stesso id) invece di crearne una
// nuova: niente "duplicate key" sul server (vedi il commento sopra).
export async function rimettiPreferito(userId: string, alimentoId: string): Promise<void> {
  const vivi = await repositoryPreferiti.ottieniTutti(userId);
  if (ePreferito(vivi, alimentoId)) return;
  await togglePreferito(userId, vivi, alimentoId);
}
