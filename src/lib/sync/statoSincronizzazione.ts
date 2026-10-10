// Lo stato della sincronizzazione, per l'indicatore in Impostazioni >
// Sincronizzazione (PUNTO_DI_PARTENZA.md, sezione 9.2, "L'indicatore").
// Dal 10/10/2026.
//
// Due fonti, nessun polling:
// - la coda (quante modifiche in attesa, da quando, quante accantonate)
//   sta in Dexie, nella tabella outbox: la pagina la legge con
//   useLiveQuery, che si aggiorna da sola quando la coda cambia;
// - come sono andati i giri (in corso, esito dell'ultimo, da quando dura
//   un errore) sta qui, IN MEMORIA: sincronizza.ts e discesa.ts lo
//   aggiornano a inizio e fine giro. Non serve salvarlo: all'apertura
//   dell'app parte comunque un giro, che lo ricalcola. Fa eccezione l'ora
//   dell'ultimo contatto riuscito col server, che sta in localStorage
//   (sopravvive a un riavvio, ed è condivisa fra le schede).
//
// La pagina legge lo stato in memoria con useSyncExternalStore (come
// useOnline in EsciAccount.tsx): iscriviStatoGiri dice a React quando
// ridisegnare, leggiStatoGiri restituisce il valore attuale. Per questo lo
// stato è un oggetto che si SOSTITUISCE a ogni cambiamento, mai
// modificato sul posto: React confronta il riferimento, e un oggetto
// modificato sul posto sembrerebbe sempre lo stesso.
//
// statoDaMostrare, in fondo, mette insieme le due fonti e sceglie l'unico
// stato da mostrare, per priorità.

import type { NomeTabella } from "../db/tipi";

// Come è finito un giro, in un verso.
// - ok: la coda è passata tutta (salita) o tutte le tabelle sono scaricate
//   (discesa). Le voci accantonate non contano: si contano a parte;
// - rete: una richiesta non è arrivata (status 0: niente rete, rete caduta,
//   tempo massimo);
// - sessione: il server ha risposto 401 (sessione scaduta);
// - errore: il server ha rifiutato (vincolo, permessi...) o un guasto
//   imprevisto.
export type EsitoGiro = "ok" | "rete" | "sessione" | "errore";

export type Verso = "salita" | "discesa";

export interface StatoVerso {
  inCorso: boolean;
  // null = nessun giro finito in questa sessione dell'app.
  esito: EsitoGiro | null;
  // ISO: il primo giro della serie attuale con questo stesso esito (non
  // ok). Per "dalle 14:02": un errore che si ripete non cambia l'ora.
  dal: string | null;
  // Quanti giri di fila con questo stesso esito (non ok). Il pallino sulla
  // tab per "il server rifiuta" si accende dal secondo (decisione del
  // 10/10): un intoppo isolato non deve accendere niente.
  diFila: number;
}

export interface StatoGiri {
  salita: StatoVerso;
  discesa: StatoVerso & { tabelleNonScaricate: NomeTabella[] };
  // ISO: quando è iniziato il lavoro in corso (salita o discesa), null se
  // non c'è niente in corso. "In corso" si mostra solo dopo un secondo.
  inCorsoDal: string | null;
  // ISO: l'ultimo giro che ha davvero parlato col server ed è andato bene.
  ultimoSuccesso: string | null;
}

// Una tabella che la discesa non è riuscita a scaricare, e perché
// (scaricaTutto in discesa.ts restituisce l'elenco).
export interface TabellaNonScaricata {
  tabella: NomeTabella;
  esito: Exclude<EsitoGiro, "ok">;
}

// Lo status HTTP di una risposta, in esito. Stessa regola di
// rifiutoDelServer in sincronizza.ts (0 e 401 non sono rifiuti della
// riga). `null` = eccezione, nessuna risposta: conta come errore, come i
// tentativi in sincronizza.ts.
export function esitoDaStatus(status: number | null): Exclude<EsitoGiro, "ok"> {
  if (status === 0) return "rete";
  if (status === 401) return "sessione";
  return "errore";
}

// localStorage, come tema e colore (src/lib/tema.ts): una sola chiave per
// dispositivo, non per utente — la salita non sa di che utente sia la
// coda, e il dato è solo un'ora. Accesso protetto: senza localStorage
// (navigazione privata, lato server) si va avanti senza.
export const CHIAVE_ULTIMO_SUCCESSO = "nutritrack:sincronizzazione:ultimo-successo";

function leggiUltimoSuccesso(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(CHIAVE_ULTIMO_SUCCESSO);
  } catch {
    return null;
  }
}

function salvaUltimoSuccesso(valore: string): void {
  try {
    window.localStorage.setItem(CHIAVE_ULTIMO_SUCCESSO, valore);
  } catch {
    // Niente localStorage: l'ora resta solo in memoria.
  }
}

const VERSO_VUOTO: StatoVerso = { inCorso: false, esito: null, dal: null, diFila: 0 };

function statoIniziale(): StatoGiri {
  return {
    salita: VERSO_VUOTO,
    discesa: { ...VERSO_VUOTO, tabelleNonScaricate: [] },
    inCorsoDal: null,
    ultimoSuccesso: leggiUltimoSuccesso(),
  };
}

// Creato alla prima lettura, non all'import: sul server (Next.js disegna
// le pagine anche lì) window non c'è.
let stato: StatoGiri | null = null;
const ascoltatori = new Set<() => void>();

export function leggiStatoGiri(): StatoGiri {
  stato ??= statoIniziale();
  return stato;
}

export function iscriviStatoGiri(ascoltatore: () => void): () => void {
  ascoltatori.add(ascoltatore);
  return () => {
    ascoltatori.delete(ascoltatore);
  };
}

function aggiorna(nuovo: StatoGiri): void {
  stato = nuovo;
  for (const ascoltatore of ascoltatori) ascoltatore();
}

// Per i test, e per quando un utente esce: lo stato di un altro utente non
// deve restare a schermo. L'ora dell'ultimo successo si rilegge.
export function azzeraStatoGiri(): void {
  aggiorna(statoIniziale());
}

export function segnaInizioGiro(verso: Verso): void {
  const prima = leggiStatoGiri();
  aggiorna({
    ...prima,
    [verso]: { ...prima[verso], inCorso: true },
    inCorsoDal: prima.inCorsoDal ?? new Date().toISOString(),
  });
}

// `parlatoColServer`: il giro ha avuto almeno una risposta buona dal
// server. Un giro di salita con la coda vuota finisce "ok" senza aver
// mandato niente: non deve aggiornare "controllato alle".
export function segnaFineGiro(
  verso: Verso,
  esito: EsitoGiro,
  opzioni: { parlatoColServer: boolean; tabelleNonScaricate?: NomeTabella[] }
): void {
  const prima = leggiStatoGiri();
  const adesso = new Date().toISOString();
  const precedente = prima[verso];
  const stessoEsito = precedente.esito === esito;

  const nuovoVerso: StatoVerso =
    esito === "ok"
      ? { inCorso: false, esito, dal: null, diFila: 0 }
      : {
          inCorso: false,
          esito,
          dal: stessoEsito && precedente.dal ? precedente.dal : adesso,
          diFila: stessoEsito ? precedente.diFila + 1 : 1,
        };

  const successo = esito === "ok" && opzioni.parlatoColServer;
  if (successo) salvaUltimoSuccesso(adesso);

  const altro = verso === "salita" ? prima.discesa : prima.salita;
  aggiorna({
    ...prima,
    salita: verso === "salita" ? nuovoVerso : prima.salita,
    discesa:
      verso === "discesa"
        ? { ...nuovoVerso, tabelleNonScaricate: opzioni.tabelleNonScaricate ?? [] }
        : prima.discesa,
    inCorsoDal: altro.inCorso ? prima.inCorsoDal : null,
    ultimoSuccesso: successo ? adesso : prima.ultimoSuccesso,
  });
}

// --- Lo stato da mostrare --------------------------------------------------

// La coda, letta da Dexie per l'utente (la pagina la conta con
// useLiveQuery).
export interface RiassuntoCoda {
  inAttesa: number;
  // ISO: la voce in attesa più vecchia (creato_il). Persistente: dice da
  // quando si aspetta anche dopo un riavvio dell'app.
  inAttesaDal: string | null;
  accantonate: number;
}

// "In corso" si mostra solo se dura almeno questo: un giro normale dura
// meno, e un indicatore che lampeggia a ogni tap è rumore.
export const RITARDO_IN_CORSO_MS = 1000;

// Un solo stato alla volta, il primo che vale in quest'ordine (analisi del
// 10/10, approvata):
// 1. accantonate: modifiche su cui l'app ha smesso di riprovare;
// 2. sessione: il server ha risposto 401, in salita o in discesa;
// 3. errore: il server rifiuta (salita) o una tabella non si scarica per
//    un errore che non è rete né sessione (discesa);
// 4. in corso: un giro che dura da almeno RITARDO_IN_CORSO_MS. Prima di
//    "in attesa", non dopo come nell'elenco dell'analisi: se un giro sta
//    davvero lavorando sulla coda, è quello che succede;
// 5. in attesa: modifiche in coda che aspettano (di solito niente rete).
//    Porta da quando (decisione del 10/10): un'attesa che dura giorni
//    deve notarsi;
// 6. sincronizzato, con l'ora dell'ultimo contatto riuscito.
// Un errore resta a schermo anche mentre parte il giro dopo: sparisce
// quando un giro finisce bene, non al suo inizio (niente sfarfallio).
export type StatoDaMostrare =
  | { tipo: "accantonate"; numero: number; pallino: true }
  | { tipo: "sessione"; inAttesa: number; pallino: true }
  | {
      tipo: "errore";
      inAttesa: number;
      dal: string | null;
      tabelleNonScaricate: NomeTabella[];
      pallino: boolean;
    }
  | { tipo: "in-attesa"; numero: number; dal: string | null; pallino: false }
  | { tipo: "in-corso"; pallino: false }
  | { tipo: "sincronizzato"; ultimoSuccesso: string | null; pallino: false };

// Il pallino sulla tab Impostazioni: solo per gli stati 1-3, e per il 3
// dal secondo giro fallito di fila (decisione del 10/10).
const GIRI_PER_IL_PALLINO = 2;

export function statoDaMostrare(
  coda: RiassuntoCoda,
  giri: StatoGiri,
  adessoMs: number
): StatoDaMostrare {
  if (coda.accantonate > 0) {
    return { tipo: "accantonate", numero: coda.accantonate, pallino: true };
  }

  if (giri.salita.esito === "sessione" || giri.discesa.esito === "sessione") {
    return { tipo: "sessione", inAttesa: coda.inAttesa, pallino: true };
  }

  const erroreSalita = giri.salita.esito === "errore";
  const erroreDiscesa = giri.discesa.esito === "errore";
  if (erroreSalita || erroreDiscesa) {
    const dal = [erroreSalita ? giri.salita.dal : null, erroreDiscesa ? giri.discesa.dal : null]
      .filter((d): d is string => d !== null)
      .sort()[0] ?? null;
    const diFila = Math.max(
      erroreSalita ? giri.salita.diFila : 0,
      erroreDiscesa ? giri.discesa.diFila : 0
    );
    return {
      tipo: "errore",
      inAttesa: coda.inAttesa,
      dal,
      tabelleNonScaricate: erroreDiscesa ? giri.discesa.tabelleNonScaricate : [],
      pallino: diFila >= GIRI_PER_IL_PALLINO,
    };
  }

  const inCorso = giri.inCorsoDal !== null;
  if (inCorso && adessoMs - Date.parse(giri.inCorsoDal!) >= RITARDO_IN_CORSO_MS) {
    return { tipo: "in-corso", pallino: false };
  }

  // Ogni scrittura mette una voce in coda e fa partire un giro: per
  // qualche millisecondo la coda non è vuota. Se l'ultimo giro di salita
  // era andato bene, quella voce non "aspetta": si resta su sincronizzato
  // finché il giro non finisce (o dura abbastanza da mostrare "in corso").
  // Se era fallito per la rete, o non c'è ancora stato (app appena
  // aperta), le voci aspettano davvero e "in attesa" resta a schermo.
  if (coda.inAttesa > 0 && (!inCorso || giri.salita.esito !== "ok")) {
    return { tipo: "in-attesa", numero: coda.inAttesa, dal: coda.inAttesaDal, pallino: false };
  }

  return { tipo: "sincronizzato", ultimoSuccesso: giri.ultimoSuccesso, pallino: false };
}
