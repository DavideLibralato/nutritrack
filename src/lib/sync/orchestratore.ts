// Mette insieme i due versi della sincronizzazione e decide quando farli
// partire (PUNTO_DI_PARTENZA.md, sezione 9.2).
//
// La discesa gira sempre prima della salita: riduce (non elimina) la
// finestra in cui una mutazione locale ancora in coda outbox potrebbe
// sovrascrivere sul server una riga cambiata nel frattempo altrove — vedi
// il commento sul confronto riga-per-riga in discesa.ts. Non elimina il
// rischio perché una voce outbox già in coda prima che la discesa parta è
// uno snapshot congelato (accodaMutazione, in outbox.ts): la discesa può
// correggere Dexie, ma non riscrive una voce già in coda. Rischio residuo
// accettato, coerente con "mono-dispositivo alla volta" (sezione 9.2).
//
// Tre inneschi, gli stessi per entrambi i versi: il montaggio dell'app,
// il ritorno online, e il ritorno in primo piano della PWA dopo essere
// stata in background (tipico su telefono: l'app resta aperta in tasca
// per ore, "visibilitychange" la aggiorna al rientro senza dover aspettare
// un riavvio completo). Niente polling a intervalli: l'uso tipico è
// "apro, registro, chiudo", un giro extra ogni N secondi non guadagnerebbe
// quasi nulla.

import { scaricaTutto } from "./discesa";
import { sincronizzaOutbox } from "./sincronizza";

export async function sincronizzaBidirezionale(userId: string): Promise<void> {
  await scaricaTutto(userId);
  await sincronizzaOutbox();
}

// Da chiamare una volta all'avvio dell'app quando l'utente è noto. Ritorna
// una funzione di cleanup (da usare in un useEffect) che rimuove i
// listener.
export function avviaSincronizzazioneAutomatica(userId: string): () => void {
  const provaSincronizzazione = () => {
    sincronizzaBidirezionale(userId).catch(() => {});
  };

  const alRitornoInPrimoPiano = () => {
    if (document.visibilityState === "visible") {
      provaSincronizzazione();
    }
  };

  window.addEventListener("online", provaSincronizzazione);
  document.addEventListener("visibilitychange", alRitornoInPrimoPiano);

  return () => {
    window.removeEventListener("online", provaSincronizzazione);
    document.removeEventListener("visibilitychange", alRitornoInPrimoPiano);
  };
}
