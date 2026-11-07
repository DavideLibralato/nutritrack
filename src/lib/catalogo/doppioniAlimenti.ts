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
// - Dal branch `codice-a-barre` (07/11; PUNTO §3, "Codice a barre"):
//   anche lo **stesso codice a barre non vuoto** = stesso prodotto, con
//   qualunque nome e marca. I codici si confrontano così come sono: sono
//   già nella forma unica di leggiCodice (src/lib/barcode/codiceEan.ts),
//   sia quelli salvati da qui sia quelli arrivati dagli amici, che li
//   hanno salvati con la stessa regola.
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

// I due hanno lo stesso codice a barre, e non è vuoto. Un codice assente
// (null, o "" se mai arrivasse così) non rende uguali due alimenti.
export function stessoCodice(
  a: { barcode?: string | null },
  b: { barcode?: string | null }
): boolean {
  const codice = a.barcode ?? "";
  return codice !== "" && codice === (b.barcode ?? "");
}

// Stesso prodotto: stesso nome e stessa marca, oppure stesso codice. Serve
// a chi confronta due candidati fra loro (la selezione degli alimenti in
// arrivo); trovaDoppione, qui sotto, confronta un candidato con il
// catalogo.
export function stessoProdotto(
  a: { nome: string; marca: string | null; barcode?: string | null },
  b: { nome: string; marca: string | null; barcode?: string | null }
): boolean {
  return stessoCodice(a, b) || chiaveAlimento(a) === chiaveAlimento(b);
}

// Il messaggio del form quando c'è un doppione (CreaAlimentoForm, sotto i
// campi Nome e Marca). Deve dire che il confronto è su nome E marca: sotto
// il solo nome sembrava un errore sul nome, come se un altro «Pane» non
// si potesse avere (Davide, 16/10). Il nome e la marca sono quelli
// dell'alimento che c'è già, come li ha scritti l'utente.
//
// Se il doppione è per il codice a barre (passato `candidato`, con lo
// stesso codice), il messaggio dice il codice: nome e marca possono
// essere diversi, e «con questo nome e questa marca» sarebbe falso.
export function testoDoppione(
  doppione: { nome: string; marca: string | null; barcode?: string | null },
  candidato?: { barcode?: string | null }
): string {
  const marca = doppione.marca?.trim();
  if (candidato && stessoCodice(doppione, candidato)) {
    const etichetta = marca ? `${doppione.nome} · ${marca}` : doppione.nome;
    return `Hai già un alimento con questo codice a barre: «${etichetta}».`;
  }
  return marca
    ? `Hai già un alimento con questo nome e questa marca: «${doppione.nome} · ${marca}».`
    : `Hai già «${doppione.nome}», senza marca.`;
}

// L'alimento dell'utente che è già "questo", se c'è. `escludiId`: in
// Modifica l'alimento stesso, così una rinomina che cambia solo maiuscole
// o accenti ("pane" → "Pane") passa.
//
// Il codice viene prima: se un alimento ha lo stesso codice è quello,
// anche se un altro ha lo stesso nome e marca (il codice è l'identità più
// precisa, ed è quella che il messaggio deve dire). Con il nome vuoto il
// codice conta lo stesso (il modulo di un prodotto non trovato parte con
// il solo codice); nome e marca no, il form segnala già il nome mancante.
//
// `candidato.barcode` lo passa solo chi sta per far nascere un alimento
// con quel codice: una creazione, un ripristino, una copia in arrivo. In
// Modifica il codice non cambia, quindi non si passa: due alimenti con lo
// stesso codice nati da due telefoni offline non devono bloccare per
// sempre la modifica di uno dei due.
export function trovaDoppione(
  catalogo: Alimento[],
  candidato: { nome: string; marca: string | null; barcode?: string | null },
  opzioni: { userId: string; escludiId?: string }
): Alimento | null {
  const vivi = catalogo.filter(
    (a) => a.deleted_at === null && a.user_id === opzioni.userId && a.id !== opzioni.escludiId
  );
  const perCodice = vivi.find((a) => stessoCodice(a, candidato));
  if (perCodice) return perCodice;
  if (testoConfronto(candidato.nome) === "") return null;
  const chiave = chiaveAlimento(candidato);
  return vivi.find((a) => chiaveAlimento(a) === chiave) ?? null;
}
