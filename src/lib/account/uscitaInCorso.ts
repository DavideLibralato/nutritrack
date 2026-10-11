// Il segno "uscita in corso" di Esci (PUNTO_DI_PARTENZA.md §9.6, "Esci
// svuota i dati locali"): fa sì che la pulizia dei dati di questo utente
// dal dispositivo arrivi in fondo anche se l'app si chiude a metà uscita,
// o se la pulizia fallisce.
//
// Esci lo scrive dopo signOut, PRIMA della pulizia, e lo toglie a pulizia
// riuscita. Le firme sono quelle delle modifiche non inviate che l'utente
// ha accettato di perdere (vuote se la coda era vuota): la ripresa pulisce
// con lo stesso controllo del flusso, quindi una modifica comparsa dopo la
// conferma non si perde nemmeno qui.
//
// All'avvio (riprendiUscitaInSospeso):
// - nessuna sessione, o la sessione di un altro utente → si ripete la
//   pulizia dell'utente del segno;
// - rientrato lo stesso utente → si toglie solo il segno. I suoi dati
//   sono di nuovo suoi; e una pulizia fallita era una transazione, quindi
//   non ha lasciato niente a metà.
//
// A differenza di Elimina account non serve la rete: l'account esiste,
// e decide solo chi è entrato su questo dispositivo.
//
// Accesso protetto come in eliminazioneInCorso.ts: senza localStorage
// (navigazione privata, memoria bloccata) non c'è segno, e la pulizia fa
// solo il giro del flusso.

import { sostituisciDatiUtente } from "../sync/ripristino";

export const CHIAVE_USCITA = "nutritrack:uscita";

export interface SegnoUscita {
  idUtente: string;
  firme: string[];
}

export function scriviSegnoUscita(idUtente: string, firme: string[]): void {
  try {
    localStorage.setItem(CHIAVE_USCITA, JSON.stringify({ idUtente, firme }));
  } catch {
    // Niente segno: resta solo la pulizia del flusso.
  }
}

// Un valore illeggibile (scritto a mano, versione futura) vale "nessun
// segno": meglio una pulizia in meno che cancellare in base a un dato che
// non si capisce.
export function leggiSegnoUscita(): SegnoUscita | null {
  try {
    const valore = JSON.parse(localStorage.getItem(CHIAVE_USCITA) ?? "null");
    if (
      typeof valore?.idUtente === "string" &&
      valore.idUtente !== "" &&
      Array.isArray(valore.firme) &&
      valore.firme.every((f: unknown) => typeof f === "string")
    ) {
      return { idUtente: valore.idUtente, firme: valore.firme };
    }
    return null;
  } catch {
    return null;
  }
}

export function togliSegnoUscita(): void {
  try {
    localStorage.removeItem(CHIAVE_USCITA);
  } catch {
    // Se non si può leggere non si poteva nemmeno scrivere.
  }
}

export type EsitoRipresaUscita =
  // Nessun segno: niente da fare.
  | "niente"
  // È rientrato lo stesso utente: dati intatti, segno tolto.
  | "rientrato"
  // Dati dell'utente del segno cancellati dal dispositivo, segno tolto.
  | "pulito"
  // In coda c'è una modifica che l'utente non aveva accettato di perdere:
  // dati intatti, segno tolto (come nel flusso).
  | "modifiche-cambiate"
  // La pulizia è fallita: dati intatti, segno lasciato per il prossimo
  // avvio.
  | "in-attesa";

// All'avvio dell'app. `utenteAttuale`: chi ha la sessione su questo
// dispositivo, senza rete (idUtenteDellaSessione); null = nessuno.
export async function riprendiUscitaInSospeso(
  utenteAttuale: () => Promise<string | null>
): Promise<EsitoRipresaUscita> {
  const segno = leggiSegnoUscita();
  if (!segno) return "niente";

  let attuale: string | null;
  try {
    attuale = await utenteAttuale();
  } catch {
    // Non si sa chi c'è: nel dubbio non si cancella niente.
    return "in-attesa";
  }
  if (attuale === segno.idUtente) {
    togliSegnoUscita();
    return "rientrato";
  }

  let pulito: boolean;
  try {
    pulito = await sostituisciDatiUtente(segno.idUtente, new Map(), segno.firme);
  } catch (errore) {
    console.error("Uscita: pulizia del dispositivo non riuscita, si riprova al prossimo avvio.", errore);
    return "in-attesa";
  }
  togliSegnoUscita();
  if (!pulito) {
    console.error("Uscita: in coda c'è una modifica non confermata, dati lasciati sul dispositivo.");
    return "modifiche-cambiate";
  }
  return "pulito";
}
