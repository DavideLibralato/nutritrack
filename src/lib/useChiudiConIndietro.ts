"use client";

// Lo swipe "indietro" chiude la schermata a tutto schermo aperta sopra la
// pagina, invece di uscire dalla pagina (PUNTO_DI_PARTENZA.md §3,
// "Alimenti", "Lo swipe indietro").
//
// Il problema. Il modulo di Impostazioni > Alimenti, un pasto salvato in
// Preferiti, la scansione... non sono pagine: sono uno stato della pagina
// (useState) che disegna un'altra schermata al posto dell'elenco. Per il
// telefono la pagina è una sola, quindi lo swipe indietro (in Safari e
// nell'app installata) torna alla pagina di prima, e la schermata aperta
// si perde.
//
// Il rimedio, in parole semplici. Il browser tiene un elenco delle pagine
// visitate, la "cronologia"; lo swipe torna alla voce precedente.
// - Quando una schermata si apre, aggiungiamo in cima una voce con lo
//   STESSO indirizzo (window.history.pushState), marcata con un segno. Per
//   l'utente non cambia niente.
// - Lo swipe allora toglie quella voce invece di uscire: il browser manda
//   l'evento "popstate", e qui si chiude la schermata.
// - Se invece la schermata si chiude dall'app (freccia, Salva, Elimina, una
//   scansione che apre altro), la voce aggiunta resta in cima: la togliamo
//   noi con history.go(-1), altrimenti il prossimo "indietro" non
//   farebbe niente di visibile. Prima si controlla che in cima ci sia
//   ancora la nostra voce: Next, con router.push/replace, riscrive il
//   segno, e allora non si tocca niente (si sta uscendo dalla pagina).
// - Dopo un ricaricamento la schermata è chiusa ma la voce col segno c'è
//   ancora: al montaggio si torna indietro sotto di lei.
//
// Due livelli: una schermata dentro un'altra (la ricerca dentro un pasto
// salvato) aggiunge una seconda voce, e lo swipe chiude solo quella di
// sopra. Schermate che si danno il cambio (scansione → modulo, «Apri» su
// un altro alimento) restano la stessa voce: chi usa l'hook passa
// `aperto` vero finché almeno una è aperta.
//
// Il pushState è quello di Next (che lo sostituisce con una sua versione):
// copia nella voce i dati di Next, che allo swipe rimette la stessa pagina
// senza chiedere niente al server. Funziona offline.

import { useEffect, useRef } from "react";

// La chiave del segno in history.state: gli id delle schermate aperte
// fino a quella voce, dalla più esterna. ["a"] = il pasto, ["a", "b"] = la
// ricerca dentro il pasto.
export const CHIAVE_SEGNO = "nutritrackSchermate";

interface Voce {
  id: string;
  chiudi: () => void;
}

// Stato condiviso da tutti gli hook del documento: le voci aggiunte da noi
// e ancora in cronologia, dalla più esterna. Una pagina ricaricata riparte
// da vuoto.
let pila: Voce[] = [];
// Quanti history.go() nostri aspettano ancora il loro popstate: quel
// popstate non è uno swipe e non chiude niente.
let ritorniInAttesa = 0;
// Aperture arrivate mentre un ritorno era in corso: si aggiungono dopo,
// altrimenti il ritorno porterebbe via la voce appena aggiunta.
let apertureInAttesa: Voce[] = [];
// Le chiusure dall'app aspettano un giro (setTimeout 0): se intanto la
// pagina naviga via (router.replace riscrive il segno) o si smonta, il
// ritorno non parte. Per id.
const chiusureInAttesa = new Map<string, ReturnType<typeof setTimeout>>();
// Quanti hook sono montati. L'ascolto di popstate resta acceso finché ce
// n'è uno, e anche dopo, finché un nostro ritorno aspetta il suo
// popstate: senza, il conteggio dei ritorni resterebbe appeso e alla
// pagina dopo le aperture non aggiungerebbero più il passo.
let montati = 0;
let inAscolto = false;

function aggiornaAscolto() {
  const serve = montati > 0 || ritorniInAttesa > 0;
  if (serve && !inAscolto) window.addEventListener("popstate", suPopState);
  if (!serve && inAscolto) window.removeEventListener("popstate", suPopState);
  inAscolto = serve;
}

function segnoCorrente(): string[] {
  const segno: unknown = window.history.state?.[CHIAVE_SEGNO];
  return Array.isArray(segno) ? segno.filter((x): x is string => typeof x === "string") : [];
}

function tornaIndietro(passi: number) {
  if (passi <= 0) return;
  ritorniInAttesa++;
  window.history.go(-passi);
}

function aggiungiVoce(voce: Voce) {
  pila.push(voce);
  // Lo stato di prima (con i dati di Next) più il segno; nessun indirizzo:
  // resta quello di adesso.
  window.history.pushState({ ...window.history.state, [CHIAVE_SEGNO]: pila.map((v) => v.id) }, "");
}

function apri(voce: Voce) {
  // Chiusa e riaperta prima che il ritorno partisse: la voce è ancora lì.
  const inAttesa = chiusureInAttesa.get(voce.id);
  if (inAttesa !== undefined) {
    clearTimeout(inAttesa);
    chiusureInAttesa.delete(voce.id);
    return;
  }
  if (pila.some((v) => v.id === voce.id)) return;
  if (ritorniInAttesa > 0) {
    apertureInAttesa.push(voce);
    return;
  }
  aggiungiVoce(voce);
}

function chiudiDallApp(id: string) {
  apertureInAttesa = apertureInAttesa.filter((v) => v.id !== id);
  if (!pila.some((v) => v.id === id) || chiusureInAttesa.has(id)) return;
  chiusureInAttesa.set(
    id,
    setTimeout(() => {
      chiusureInAttesa.delete(id);
      const posizione = pila.findIndex((v) => v.id === id);
      if (posizione < 0) return; // chiusa intanto da uno swipe
      // Lei e quelle sopra (una ricerca rimasta aperta dentro) escono
      // dalla pila in ogni caso.
      pila = pila.slice(0, posizione);
      // In cima deve esserci ancora la nostra voce: il segno della voce
      // corrente contiene questo id. Se Next l'ha riscritto (la pagina sta
      // navigando via), nessun ritorno.
      const segno = segnoCorrente();
      const dove = segno.indexOf(id);
      if (dove < 0) return;
      tornaIndietro(segno.length - dove);
    }, 0)
  );
}

function rimuoviSenzaTornare(id: string) {
  const inAttesa = chiusureInAttesa.get(id);
  if (inAttesa !== undefined) clearTimeout(inAttesa);
  chiusureInAttesa.delete(id);
  apertureInAttesa = apertureInAttesa.filter((v) => v.id !== id);
  pila = pila.filter((v) => v.id !== id);
}

function suPopState() {
  if (ritorniInAttesa > 0) {
    ritorniInAttesa--;
    if (ritorniInAttesa === 0) {
      const daAprire = apertureInAttesa;
      apertureInAttesa = [];
      daAprire.forEach(aggiungiVoce);
    }
    aggiornaAscolto();
    return;
  }
  // Uno swipe (indietro o avanti). Indietro: le nostre voci che la voce
  // corrente non ha più si chiudono, dalla più interna.
  const segno = segnoCorrente();
  while (pila.length > 0 && !segno.includes(pila[pila.length - 1].id)) {
    const voce = pila.pop()!;
    const inAttesa = chiusureInAttesa.get(voce.id);
    if (inAttesa !== undefined) clearTimeout(inAttesa);
    chiusureInAttesa.delete(voce.id);
    voce.chiudi();
  }
  // Avanti su una voce col segno di una schermata che non è aperta: si
  // torna giù, altrimenti il prossimo "indietro" non farebbe niente.
  tornaIndietro(segno.filter((id) => !pila.some((v) => v.id === id)).length);
}

// Al montaggio, nessuna schermata nostra aperta ma la voce corrente ha il
// segno: è rimasta da prima di un ricaricamento. Si torna sotto di lei.
function controllaVoceRimasta() {
  if (pila.length > 0 || ritorniInAttesa > 0) return;
  tornaIndietro(segnoCorrente().length);
}

let contatoreId = 0;

// `aperto`: vero finché la schermata (o una delle schermate che si danno
// il cambio) è aperta. `chiudi`: cosa fare quando lo swipe la chiude, di
// solito lo stesso setState della freccia. Smontare la pagina con la
// schermata aperta non tocca la cronologia.
export function useChiudiConIndietro(aperto: boolean, chiudi: () => void) {
  const id = useRef<string | null>(null);
  if (id.current === null) id.current = `s${++contatoreId}`;
  // Sempre l'ultima `chiudi`: è una funzione nuova a ogni ridisegno.
  const rifChiudi = useRef(chiudi);
  useEffect(() => {
    rifChiudi.current = chiudi;
  });

  useEffect(() => {
    montati++;
    aggiornaAscolto();
    controllaVoceRimasta();
    const mio = id.current!;
    return () => {
      rimuoviSenzaTornare(mio);
      montati--;
      aggiornaAscolto();
    };
  }, []);

  useEffect(() => {
    const mio = id.current!;
    if (aperto) apri({ id: mio, chiudi: () => rifChiudi.current() });
    else chiudiDallApp(mio);
  }, [aperto]);
}
