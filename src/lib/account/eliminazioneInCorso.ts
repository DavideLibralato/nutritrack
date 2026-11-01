// Il segno "eliminazione in corso" di "Elimina il mio account"
// (PUNTO_DI_PARTENZA.md §9.6): fa sì che la pulizia di questo dispositivo
// arrivi in fondo anche se il flusso si interrompe a metà.
//
// Due fasi, in localStorage (sopravvive alla chiusura dell'app):
// - "richiesta": scritto PRIMA di chiedere al server di cancellare
//   l'account. Se l'app si chiude prima della risposta non si sa com'è
//   andata: al prossimo avvio si chiede al server se l'utente esiste
//   ancora;
// - "confermata": scritto appena il server ha detto di sì. Da qui in poi
//   non serve più la rete: l'account non c'è più, si pulisce e basta.
//
// Il flusso NON toglie il segno "confermata" a pulizia finita: lo toglie
// il prossimo avvio, dopo una seconda pulizia. Una discesa partita prima
// dell'eliminazione può finire DOPO la pulizia e riscrivere righe vecchie
// in Dexie; al prossimo avvio nessuna discesa vecchia è più in corso.
//
// Accesso protetto come in segnoRipristinoPassword.ts: senza localStorage
// (navigazione privata, memoria bloccata) non c'è segno, e la pulizia fa
// solo il primo giro, quello del flusso.

import type { AuthError } from "@supabase/supabase-js";
import { attendiDiscesaInCorso } from "../sync/discesa";
import { utenteEliminato } from "../supabase/utenteOffline";
import { pulisciDispositivoDopoEliminazione } from "./puliziaDopoEliminazione";

export const CHIAVE_ELIMINAZIONE = "nutritrack:eliminazione-account";

export type FaseEliminazione = "richiesta" | "confermata";

export interface SegnoEliminazione {
  idUtente: string;
  fase: FaseEliminazione;
}

export function scriviSegnoEliminazione(idUtente: string, fase: FaseEliminazione): void {
  try {
    localStorage.setItem(CHIAVE_ELIMINAZIONE, JSON.stringify({ idUtente, fase }));
  } catch {
    // Niente segno: resta solo la pulizia del flusso.
  }
}

// Un valore illeggibile (scritto a mano, versione futura) vale "nessun
// segno": meglio una pulizia in meno che cancellare in base a un dato
// che non si capisce.
export function leggiSegnoEliminazione(): SegnoEliminazione | null {
  try {
    const valore = JSON.parse(localStorage.getItem(CHIAVE_ELIMINAZIONE) ?? "null");
    if (
      typeof valore?.idUtente === "string" &&
      valore.idUtente !== "" &&
      (valore.fase === "richiesta" || valore.fase === "confermata")
    ) {
      return { idUtente: valore.idUtente, fase: valore.fase };
    }
    return null;
  } catch {
    return null;
  }
}

export function togliSegnoEliminazione(): void {
  try {
    localStorage.removeItem(CHIAVE_ELIMINAZIONE);
  } catch {
    // Se non si può leggere non si poteva nemmeno scrivere.
  }
}

// Che cosa dice il server dell'utente del segno.
// - "non-esiste": il server rifiuta il token perché l'utente non c'è più
//   (codice "user_not_found", verificato il 26/10/2026; il controllo sta
//   in utenteEliminato, utenteOffline.ts);
// - "esiste": il server riconosce proprio quell'utente;
// - "sconosciuto": tutto il resto — rete, sessione mancante o scaduta,
//   un altro utente entrato nel frattempo. Nel dubbio non si cancella
//   niente: una sessione scaduta non vuol dire account cancellato.
export type VerificaUtente = "esiste" | "non-esiste" | "sconosciuto";

export function classificaVerificaUtente(
  idUtente: string,
  utente: { id: string } | null,
  errore: AuthError | null
): VerificaUtente {
  if (utenteEliminato(errore)) return "non-esiste";
  if (!errore && utente?.id === idUtente) return "esiste";
  return "sconosciuto";
}

export type EsitoRipresa =
  // Nessun segno: niente da fare.
  | "niente"
  // Dati dell'utente cancellati dal dispositivo, segno tolto.
  | "pulito"
  // Pulito, e la sessione salvata era ancora quella dell'utente
  // eliminato (flusso interrotto prima del signOut): sessione chiusa,
  // ricaricamento su /login?eliminato=1. Segno "confermata" lasciato: lo
  // toglie il giro dopo, su /login, senza sessione.
  | "uscito"
  // Pulito, sessione dell'utente eliminato chiusa ma rimasta: niente
  // navigazione (il proxy rimanderebbe indietro), segno lasciato.
  | "sessione-rimasta"
  // Il server dice che l'utente esiste: la richiesta non era arrivata.
  // Dati intatti, segno tolto.
  | "annullato"
  // Non si sa (rete, sessione) o la pulizia è fallita: dati intatti, segno
  // lasciato per il prossimo avvio.
  | "in-attesa";

// Cosa serve alla ripresa oltre alla verifica, passato da
// RipresaEliminazioneAccount.tsx. Senza (i test più vecchi), si comporta
// come prima del 26/10: nessuna sessione, niente da chiudere.
export interface AzioniRipresa {
  // Di chi è la sessione salvata su questo dispositivo, senza rete
  // (idUtenteDellaSessione); null = nessuno.
  utenteAttuale: () => Promise<string | null>;
  // signOut "local", poi true se la sessione è davvero sparita.
  chiudiSessione: () => Promise<boolean>;
  // Ricaricamento completo della pagina.
  naviga: (indirizzo: string) => void;
}

const SENZA_SESSIONE: AzioniRipresa = {
  utenteAttuale: async () => null,
  chiudiSessione: async () => true,
  naviga: () => {},
};

// All'avvio dell'app. `verifica` chiede al server dell'utente del segno:
// si chiama solo con il segno "richiesta", quindi con il segno
// "confermata" la ripresa funziona anche offline.
//
// Dal 26/10/2026 (branch account-eliminato):
// - prima della pulizia si aspettano le discese in corso (con la sessione
//   ancora valida, Sincronizzazione può farne partire una all'avvio);
// - la pulizia è quella completa di Elimina account
//   (puliziaDopoEliminazione.ts), non solo Dexie;
// - se la sessione salvata è ancora dell'utente eliminato (flusso
//   interrotto prima del signOut), la si chiude e si va su
//   /login?eliminato=1, invece di lasciare l'app ferma su "Caricamento...".
//   Il segno resta "confermata" fino al giro dopo, su /login: lì non c'è
//   più sessione, quindi non parte nessuna discesa nuova, e il secondo
//   giro di pulizia copre una discesa partita prima e finita tardi.
// Senza sessione, o con la sessione di un altro utente: come prima.
export async function riprendiEliminazioneInSospeso(
  verifica: (idUtente: string) => Promise<VerificaUtente>,
  azioni: AzioniRipresa = SENZA_SESSIONE
): Promise<EsitoRipresa> {
  const segno = leggiSegnoEliminazione();
  if (!segno) return "niente";

  if (segno.fase === "richiesta") {
    const esito = await verifica(segno.idUtente).catch((): VerificaUtente => "sconosciuto");
    if (esito === "esiste") {
      togliSegnoEliminazione();
      return "annullato";
    }
    if (esito === "sconosciuto") return "in-attesa";
    // Il server ha detto che l'account non c'è più: da qui la ripresa non
    // ha più bisogno della rete. Se il segno restasse "richiesta", il giro
    // dopo (senza sessione) chiederebbe di nuovo al server, avrebbe sempre
    // "sconosciuto" e il segno non si toglierebbe più.
    scriviSegnoEliminazione(segno.idUtente, "confermata");
  }

  await attendiDiscesaInCorso();
  if (!(await pulisciDispositivoDopoEliminazione(segno.idUtente))) return "in-attesa";

  // Nel dubbio su chi c'è, come se non ci fosse nessuno: non si chiude
  // una sessione che non si sa di chi sia.
  const attuale = await azioni.utenteAttuale().catch(() => null);
  if (attuale !== segno.idUtente) {
    togliSegnoEliminazione();
    return "pulito";
  }

  if (!(await azioni.chiudiSessione().catch(() => false))) {
    console.error("Eliminazione account: la sessione è rimasta dopo il signOut, niente navigazione.");
    return "sessione-rimasta";
  }
  azioni.naviga("/login?eliminato=1");
  return "uscito";
}
