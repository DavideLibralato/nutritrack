"use client";

// Le novità di Amici e il loro pallino (PUNTO_DI_PARTENZA.md §3 "Amici",
// "Il pallino"; mockup docs/mockups/amici.html, schermata 2).
//
// Il numero della TAB è una SOMMA di due parti: le richieste di amicizia
// ricevute in attesa e, dal branch condivisione-alimenti, gli alimenti in
// arrivo dagli amici. Le due parti hanno anche il loro posto: la riga Amici
// di Impostazioni mostra solo le richieste ("2 nuove"), la riga Alimenti
// solo gli alimenti ("2 in arrivo"). Sulla tab un pallino solo, per la
// somma, e lo screen reader legge "Impostazioni, N novità".
//
// Da dove arriva: Supabase (filtrato dalla RLS), mai Dexie. Quando: agli
// stessi inneschi della discesa (avvio, ritorno online, ritorno in primo
// piano: useNovitaAmici), dopo ogni rilettura della pagina Amici
// (useAmicizie scrive le richieste) e di quella degli alimenti in arrivo
// (useAlimentiInArrivo scrive gli alimenti). Ciascuna pagina scrive SOLO
// la sua parte: nessuna azzera l'altra. Niente polling, niente Realtime
// (§9.2).
//
// Offline: le ultime novità note, in localStorage con una chiave per
// utente; le sovrascrive il primo contatto riuscito; le cancellano Esci ed
// Elimina account. Accesso protetto come le altre chiavi: senza
// localStorage (Safari privato, memoria piena) i numeri vivono solo in
// memoria.
//
// La tab bar e le righe di Impostazioni leggono gli stessi numeri da qui
// (useSyncExternalStore): una lettura aggiorna tutti.

import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { contaRichiesteRicevute } from "./amicizie";
import { contaAlimentiInArrivo } from "./alimentiCondivisi";

// --- Il conteggio ---

export interface NovitaAmici {
  // Richieste di amicizia ricevute, in attesa: la riga Amici.
  richiesteRicevute: number;
  // Alimenti mandati dagli amici, in attesa: la riga Alimenti.
  alimentiInArrivo: number;
}

type ParteNovita = keyof NovitaAmici;
const PARTI: readonly ParteNovita[] = ["richiesteRicevute", "alimentiInArrivo"];

export function totaleNovita(novita: NovitaAmici): number {
  return novita.richiesteRicevute + novita.alimentiInArrivo;
}

// --- La chiave in localStorage ---

// Il valore è il JSON delle parti ({"richiesteRicevute":2,
// "alimentiInArrivo":1}), non il solo totale: ogni riga legge la sua parte,
// la tab la somma, e offline tutte devono avere il loro numero.
export function chiaveNovita(idUtente: string): string {
  return `nutritrack:amici:novita:${idUtente}`;
}

function numeroValido(valore: unknown): valore is number {
  return typeof valore === "number" && Number.isInteger(valore) && valore >= 0;
}

export function leggiNovitaSalvate(idUtente: string): NovitaAmici | null {
  try {
    const testo = window.localStorage.getItem(chiaveNovita(idUtente));
    if (testo === null) return null;
    const valore = JSON.parse(testo) as Record<string, unknown> | null;
    const richieste = valore?.richiesteRicevute;
    const alimenti = valore?.alimentiInArrivo;
    // Un valore rovinato (scritto a mano, versione diversa) vale "non so".
    if (!numeroValido(richieste)) return null;
    // Salvato prima degli alimenti in arrivo: la chiave non c'è, vale 0.
    if (alimenti === undefined) return { richiesteRicevute: richieste, alimentiInArrivo: 0 };
    if (!numeroValido(alimenti)) return null;
    return { richiesteRicevute: richieste, alimentiInArrivo: alimenti };
  } catch {
    return null;
  }
}

function salvaNovita(idUtente: string, novita: NovitaAmici) {
  try {
    window.localStorage.setItem(chiaveNovita(idUtente), JSON.stringify(novita));
  } catch {
    // Niente localStorage: i numeri restano solo in memoria.
  }
}

// Per Esci ed Elimina account: via la chiave e i numeri in memoria di
// questo utente. Chi entra dopo su questo dispositivo non vede le novità di
// un altro.
export function cancellaNovita(idUtente: string) {
  try {
    window.localStorage.removeItem(chiaveNovita(idUtente));
  } catch {
    // Niente localStorage: non c'era niente da togliere.
  }
  memoria.delete(idUtente);
  avvisa();
}

// --- Le novità in memoria, condivise ---

const NESSUNA: NovitaAmici = { richiesteRicevute: 0, alimentiInArrivo: 0 };

const memoria = new Map<string, NovitaAmici>();
const ascoltatori = new Set<() => void>();
// L'ultima lettura partita per ogni utente e per ogni parte: una risposta
// più vecchia si scarta, come in useAmicizie. Per parte, così una
// scrittura della pagina Amici non fa scartare il conteggio degli alimenti
// (e viceversa).
const ultimaLettura = new Map<string, number>();

function chiaveLettura(idUtente: string, parte: ParteNovita): string {
  return `${idUtente}:${parte}`;
}

function nuovaLettura(idUtente: string, parte: ParteNovita): number {
  const numero = (ultimaLettura.get(chiaveLettura(idUtente, parte)) ?? 0) + 1;
  ultimaLettura.set(chiaveLettura(idUtente, parte), numero);
  return numero;
}

function avvisa() {
  for (const ascolta of ascoltatori) ascolta();
}

function iscrivi(ascolta: () => void) {
  ascoltatori.add(ascolta);
  return () => {
    ascoltatori.delete(ascolta);
  };
}

function uguali(a: NovitaAmici | undefined, b: NovitaAmici): boolean {
  return (
    a !== undefined &&
    a.richiesteRicevute === b.richiesteRicevute &&
    a.alimentiInArrivo === b.alimentiInArrivo
  );
}

// Le novità di un utente: quelle in memoria, altrimenti le ultime salvate
// (offline, all'avvio), altrimenti nessuna. Quelle lette da localStorage
// restano in memoria: React chiede questo valore a ogni disegno e vuole
// sempre lo stesso oggetto finché non cambia.
export function novitaDi(idUtente: string): NovitaAmici {
  const inMemoria = memoria.get(idUtente);
  if (inMemoria) return inMemoria;
  const salvate = leggiNovitaSalvate(idUtente);
  if (!salvate) return NESSUNA;
  memoria.set(idUtente, salvate);
  return salvate;
}

// Scrive alcune parti, lasciando com'è l'altra.
function scrivi(idUtente: string, parti: Partial<NovitaAmici>) {
  const novita = { ...novitaDi(idUtente), ...parti };
  salvaNovita(idUtente, novita);
  if (uguali(memoria.get(idUtente), novita)) return;
  memoria.set(idUtente, novita);
  avvisa();
}

// Scrive le parti arrivate dal server con le righe di una pagina: la pagina
// Amici le richieste (useAmicizie), la pagina Alimenti gli alimenti in
// arrivo (useAlimentiInArrivo). Una lettura di aggiornaNovita partita
// prima, e arrivata dopo, si scarta per quelle parti.
export function impostaNovita(idUtente: string, parti: Partial<NovitaAmici>) {
  for (const parte of PARTI) {
    if (parti[parte] !== undefined) nuovaLettura(idUtente, parte);
  }
  scrivi(idUtente, parti);
}

// Chiede i due numeri al server, insieme. Se una risposta non arriva, quella
// parte resta l'ultima nota.
export async function aggiornaNovita(idUtente: string): Promise<void> {
  const numeri = {
    richiesteRicevute: nuovaLettura(idUtente, "richiesteRicevute"),
    alimentiInArrivo: nuovaLettura(idUtente, "alimentiInArrivo"),
  };
  let risposte: [number | null, number | null];
  try {
    const supabase = createClient();
    risposte = await Promise.all([
      contaRichiesteRicevute(supabase, idUtente).catch(() => null),
      contaAlimentiInArrivo(supabase, idUtente).catch(() => null),
    ]);
  } catch {
    // Anche il client che non si crea vale "risposta non arrivata": il
    // pallino resta com'era, senza un errore non gestito sulla tab bar.
    risposte = [null, null];
  }
  const parti: Partial<NovitaAmici> = {};
  PARTI.forEach((parte, i) => {
    const valore = risposte[i];
    if (valore !== null && ultimaLettura.get(chiaveLettura(idUtente, parte)) === numeri[parte]) {
      parti[parte] = valore;
    }
  });
  if (Object.keys(parti).length > 0) scrivi(idUtente, parti);
}

// Le novità di chi è entrato, aggiornate agli inneschi della discesa.
// Nessuna finché l'utente non è noto. La tab usa totaleNovita, la riga
// Amici richiesteRicevute, la riga Alimenti alimentiInArrivo.
export function useNovitaAmici(): NovitaAmici {
  const userId = useUtenteId();

  const novita = useSyncExternalStore(
    iscrivi,
    () => (userId ? novitaDi(userId) : NESSUNA),
    () => NESSUNA
  );

  useEffect(() => {
    if (!userId) return;
    void aggiornaNovita(userId);
    function alRitorno() {
      if (document.visibilityState === "visible") void aggiornaNovita(userId!);
    }
    function allaRete() {
      void aggiornaNovita(userId!);
    }
    document.addEventListener("visibilitychange", alRitorno);
    window.addEventListener("online", allaRete);
    return () => {
      document.removeEventListener("visibilitychange", alRitorno);
      window.removeEventListener("online", allaRete);
    };
  }, [userId]);

  return novita;
}


// --- Il pallino sulla tab Impostazioni (funzione pura, con test) ---

// Un pallino solo: se la sincronizzazione chiede attenzione vince il suo
// arancio (§9.2), altrimenti con delle novità quello del colore principale.
export type PallinoTab = "sincronizzazione" | "amici" | null;

export function pallinoTab(sincronizzazione: boolean, novita: number): PallinoTab {
  if (sincronizzazione) return "sincronizzazione";
  if (novita > 0) return "amici";
  return null;
}
