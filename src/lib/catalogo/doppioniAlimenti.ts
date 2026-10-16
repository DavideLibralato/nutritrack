// La regola del doppione nel catalogo (PUNTO_DI_PARTENZA.md, sezione 3,
// "Alimenti", "Mai due alimenti uguali"; decisa il 16/10): stesso nome E
// stessa marca = stesso prodotto. Scritta una volta sola, qui: la usano
// "Nuovo alimento" e "Modifica alimento" (CreaAlimentoForm, mentre si
// scrive e di nuovo al Salva), l'Annulla dopo un'eliminazione
// (ripristinaAlimenti) e, dal branch `condivisione-alimenti`, gli alimenti
// in arrivo dagli amici.
//
// - Maiuscole e accenti indifferenti, come la ricerca (cercaPerNome usa la
//   stessa testoConfronto): "Caffè" = "CAFFE", "Müller" = "Muller".
// - Spazi ai bordi ignorati, spazi doppi interni contati come uno.
// - La marca vuota conta come una marca: due "Banana" senza marca sono
//   doppioni. Mai il solo nome: «Yogurt greco 0% · Fage» e «Yogurt greco
//   0% · Müller» no.
// - Contano solo gli alimenti vivi dell'utente. Il catalogo comune
//   (user_id null) no: un alimento verificato non si modifica, se ne crea
//   uno proprio (sezione 10.8), anche con lo stesso nome.
//
// Solo nell'app, non sul server: un indice unico su `alimenti`
// bloccherebbe in silenzio la coda outbox (come quello sui nomi dei pasti,
// tolto il 20/9). Due telefoni offline possono ancora crearne due: caso
// raro, accettato.
//
// Funzioni pure, senza Dexie: i test sono in doppioniAlimenti.test.ts.

import type { Alimento } from "../db/tipi";

// Il testo come si salva: senza spazi ai bordi e con gli spazi doppi
// interni ridotti a uno ("  Pane   di segale " → "Pane di segale"). Come
// normalizzaNome dei pasti (src/lib/pasti/controlliPasti.ts).
export function normalizzaSpazi(testo: string): string {
  return testo.trim().replace(/\s+/g, " ");
}

// Il testo come si confronta: spazi normalizzati, minuscole, senza accenti.
export function testoConfronto(testo: string): string {
  return normalizzaSpazi(testo)
    .toLowerCase()
    .normalize("NFD") // separa le lettere accentate in lettera + segno
    .replace(/\p{Diacritic}/gu, ""); // toglie i segni diacritici combinanti
}

// La chiave di un alimento: nome e marca confrontabili, con in mezzo un
// carattere che nessuno scrive in un campo di testo (e che Postgres non
// accetta in una colonna text). Senza separatore
// "a" + "b c" e "a b" + "c" darebbero la stessa chiave.
export function chiaveAlimento(a: { nome: string; marca: string | null }): string {
  return `${testoConfronto(a.nome)}\u0000${testoConfronto(a.marca ?? "")}`;
}

// L'alimento dell'utente che è già "questo", se c'è. `escludiId`: in
// Modifica l'alimento stesso, così una rinomina che cambia solo maiuscole
// o accenti ("pane" → "Pane") passa. Con il nome vuoto non c'è doppione:
// il form segnala già il nome mancante.
export function trovaDoppione(
  catalogo: Alimento[],
  candidato: { nome: string; marca: string | null },
  opzioni: { userId: string; escludiId?: string }
): Alimento | null {
  if (testoConfronto(candidato.nome) === "") return null;
  const chiave = chiaveAlimento(candidato);
  return (
    catalogo.find(
      (a) =>
        a.deleted_at === null &&
        a.user_id === opzioni.userId &&
        a.id !== opzioni.escludiId &&
        chiaveAlimento(a) === chiave
    ) ?? null
  );
}
