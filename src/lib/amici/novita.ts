"use client";

// Le novità di Amici e il loro pallino (PUNTO_DI_PARTENZA.md §3 "Amici",
// "Il pallino"; mockup docs/mockups/amici.html, schermata 2).
//
// Il numero della TAB è una SOMMA di parti: oggi una sola, le richieste di
// amicizia ricevute in attesa. Il branch condivisione-alimenti aggiungerà
// gli alimenti in arrivo come un termine in più di NovitaAmici e di
// totaleNovita. Attenzione (decisione del 16/10): quel termine va sul
// pallino della tab, ma NON sulla riga Amici. Gli alimenti in arrivo stanno
// nella pagina Alimenti, con il loro conteggio sulla riga Alimenti di
// Impostazioni ("2 in arrivo"); la riga Amici mostra solo le richieste
// (richiesteRicevute, non il totale). Anche il testo per lo screen reader
// sulla tab ("N novità in Amici") vale finché c'è solo questo termine:
// con gli alimenti si deciderà un testo comune.
//
// Da dove arriva: Supabase (filtrato dalla RLS), mai Dexie. Quando: agli
// stessi inneschi della discesa (avvio, ritorno online, ritorno in primo
// piano: useNovitaAmici) e dopo ogni rilettura della pagina Amici
// (useAmicizie chiama impostaNovita con le righe appena lette). Niente
// polling, niente Realtime (§9.2).
//
// Offline: l'ultimo numero noto, in localStorage con una chiave per utente;
// lo sovrascrive il primo contatto riuscito; lo cancellano Esci ed Elimina
// account. Accesso protetto come le altre chiavi: senza localStorage
// (Safari privato, memoria piena) il numero vive solo in memoria.
//
// La tab bar e la riga Amici leggono lo stesso numero da qui
// (useSyncExternalStore): una lettura aggiorna tutti e due.

import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { contaRichiesteRicevute } from "./amicizie";

// --- Il conteggio ---

export interface NovitaAmici {
  richiesteRicevute: number;
  // alimentiInArrivo: number;  ← branch condivisione-alimenti: nella somma
  //                               della tab, non nella riga Amici
}

export function totaleNovita(novita: NovitaAmici): number {
  return novita.richiesteRicevute;
}

// --- La chiave in localStorage ---

// Il valore è il JSON delle parti ({"richiesteRicevute":2}), non il solo
// totale: la riga Amici legge le richieste, la tab il totale, e offline
// tutte e due devono avere il loro numero.
export function chiaveNovita(idUtente: string): string {
  return `nutritrack:amici:novita:${idUtente}`;
}

export function leggiNovitaSalvate(idUtente: string): NovitaAmici | null {
  try {
    const testo = window.localStorage.getItem(chiaveNovita(idUtente));
    if (testo === null) return null;
    const valore: unknown = JSON.parse(testo);
    const richieste = (valore as { richiesteRicevute?: unknown } | null)?.richiesteRicevute;
    // Un valore rovinato (scritto a mano, versione diversa) vale "non so".
    if (typeof richieste !== "number" || !Number.isInteger(richieste) || richieste < 0) return null;
    return { richiesteRicevute: richieste };
  } catch {
    return null;
  }
}

function salvaNovita(idUtente: string, novita: NovitaAmici) {
  try {
    window.localStorage.setItem(chiaveNovita(idUtente), JSON.stringify(novita));
  } catch {
    // Niente localStorage: il numero resta solo in memoria.
  }
}

// Per Esci ed Elimina account: via la chiave e il numero in memoria di
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

const NESSUNA: NovitaAmici = { richiesteRicevute: 0 };

const memoria = new Map<string, NovitaAmici>();
const ascoltatori = new Set<() => void>();
// L'ultima lettura partita per ogni utente: una risposta più vecchia si
// scarta, come in useAmicizie.
const ultimaLettura = new Map<string, number>();

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
  return a !== undefined && a.richiesteRicevute === b.richiesteRicevute;
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

function scrivi(idUtente: string, novita: NovitaAmici) {
  salvaNovita(idUtente, novita);
  if (uguali(memoria.get(idUtente), novita)) return;
  memoria.set(idUtente, novita);
  avvisa();
}

// Scrive le novità arrivate dal server con le righe della pagina Amici
// (useAmicizie): in memoria e in localStorage. Una lettura di
// aggiornaNovita partita prima, e arrivata dopo, si scarta.
export function impostaNovita(idUtente: string, novita: NovitaAmici) {
  ultimaLettura.set(idUtente, (ultimaLettura.get(idUtente) ?? 0) + 1);
  scrivi(idUtente, novita);
}

// Chiede le novità al server. Se la risposta non arriva, restano le ultime
// note.
export async function aggiornaNovita(idUtente: string): Promise<void> {
  const numeroLettura = (ultimaLettura.get(idUtente) ?? 0) + 1;
  ultimaLettura.set(idUtente, numeroLettura);
  let richiesteRicevute: number | null;
  try {
    richiesteRicevute = await contaRichiesteRicevute(createClient(), idUtente);
  } catch {
    // Anche il client che non si crea vale "risposta non arrivata": il
    // pallino resta com'era, senza un errore non gestito sulla tab bar.
    richiesteRicevute = null;
  }
  if (richiesteRicevute === null || ultimaLettura.get(idUtente) !== numeroLettura) return;
  scrivi(idUtente, { richiesteRicevute });
}

// Le novità di chi è entrato, aggiornate agli inneschi della discesa.
// Nessuna finché l'utente non è noto. La tab usa totaleNovita, la riga
// Amici solo richiesteRicevute.
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
