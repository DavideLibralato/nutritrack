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

import { isAuthApiError, type AuthError } from "@supabase/supabase-js";
import { cancellaDatiUtente } from "../sync/ripristino";

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
//   (codice "user_not_found"). Da verificare nella prova vera che sia
//   proprio questo il codice che arriva per un account cancellato;
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
  if (errore && isAuthApiError(errore) && errore.code === "user_not_found") return "non-esiste";
  if (!errore && utente?.id === idUtente) return "esiste";
  return "sconosciuto";
}

export type EsitoRipresa =
  // Nessun segno: niente da fare.
  | "niente"
  // Dati dell'utente cancellati dal dispositivo, segno tolto.
  | "pulito"
  // Il server dice che l'utente esiste: la richiesta non era arrivata.
  // Dati intatti, segno tolto.
  | "annullato"
  // Non si sa (rete, sessione) o la pulizia è fallita: dati intatti, segno
  // lasciato per il prossimo avvio.
  | "in-attesa";

// All'avvio dell'app. `verifica` chiede al server dell'utente del segno:
// si chiama solo con il segno "richiesta", quindi con il segno
// "confermata" la ripresa funziona anche offline.
export async function riprendiEliminazioneInSospeso(
  verifica: (idUtente: string) => Promise<VerificaUtente>
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
  }

  try {
    await cancellaDatiUtente(segno.idUtente);
  } catch (errore) {
    console.error("Eliminazione account: pulizia del dispositivo non riuscita, si riprova al prossimo avvio.", errore);
    return "in-attesa";
  }
  togliSegnoEliminazione();
  return "pulito";
}
