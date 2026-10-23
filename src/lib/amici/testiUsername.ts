// I testi dello username, dal mockup approvato (docs/mockups/amici.html):
// in "Scegli il tuo nome su Libra" (Amici e onboarding), nel foglio di
// Profilo e in Aggiungi un amico.

import type { StatoFoglioUsername } from "./foglioUsername";

export const TESTO_USERNAME_NON_VALIDO =
  "Da 3 a 20 caratteri: inizia con una lettera, poi lettere, numeri e _.";
// Senza "username": compare sotto un campo che sta da solo, e iPhone con
// quella parola lo prenderebbe per un campo di accesso (PUNTO §3, "Lo
// username"). Fino al 23/10 era "Questo username è già in uso.".
export const TESTO_NOME_IN_USO = "Questo nome è già in uso.";
export const TESTO_USERNAME_REGOLE =
  "Da 3 a 20 caratteri: lettere, numeri e _. Serve agli amici per trovarti.";

// Nel foglio "Cambia username" di Profilo, sotto il campo (mockup).
export const TESTO_USERNAME_AMICI_RESTANO =
  "I tuoi amici restano: sono legati al tuo account, non al nome. Il vecchio nome torna libero.";
// Offline, sotto il campo della card di Amici e del foglio di Profilo:
// compare anche all'apertura, quindi senza "username" (fino al 23/10 "Per
// cambiare lo username serve la connessione.").
export const TESTO_NOME_SENZA_RETE = "Per cambiare il nome serve la connessione.";
export const TESTO_USERNAME_NON_SALVATO =
  "Non sono riuscito a salvarlo. Controlla la connessione e riprova.";
// Nel passo dell'onboarding, offline (PUNTO §3, "Lo username dopo
// l'accesso"). Senza "username", come tutti i testi vicino a un campo da
// solo (iPhone).
export const TESTO_NOME_SENZA_RETE_ONBOARDING =
  "Senza connessione non posso controllare se il nome è libero: te lo chiederò in Amici.";

// La riga sotto il campo, per ogni stato. "vuoto": niente. "errore": la
// risposta non è arrivata, si ricontrolla all'invio. "attuale": solo nel
// foglio di Profilo, il nome che hai già. `quando`: il momento del
// ricontrollo, "quando continui" in Amici, "quando vai avanti"
// nell'onboarding, "quando salvi" nel foglio di Profilo.
export function testoStatoUsername(stato: StatoFoglioUsername, quando: string): string {
  switch (stato) {
    case "vuoto":
      return "";
    case "controllo":
      return "Controllo…";
    case "disponibile":
      return "Disponibile";
    case "in_uso":
      return TESTO_NOME_IN_USO;
    case "non_valido":
      return TESTO_USERNAME_NON_VALIDO;
    case "errore":
      return `Non riesco a controllarlo ora: lo controllo ${quando}.`;
    // Senza "username": compare appena si apre il foglio di Profilo, sotto
    // il campo, e iPhone prenderebbe il campo per un accesso (§3 "Lo
    // username", 16/10).
    case "attuale":
      return "È già il tuo nome.";
  }
}
