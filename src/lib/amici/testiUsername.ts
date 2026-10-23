// I testi dello username, dal mockup approvato (docs/mockups/amici.html).
// Gli stessi nella pagina, mentre si scrive, e nella Server Action, all'invio:
// stanno qui e non in src/lib/actions/auth.ts perché un file "use server"
// può esportare solo funzioni async.

import type { StatoFoglioUsername } from "./foglioUsername";

export const TESTO_USERNAME_NON_VALIDO =
  "Da 3 a 20 caratteri: inizia con una lettera, poi lettere, numeri e _.";
export const TESTO_USERNAME_IN_USO = "Questo username è già in uso.";
// Lo stesso, senza "username", dove il campo sta da solo: "Scegli il tuo
// nome su Libra" in Amici e nel passo dell'onboarding (deciso il 23/10;
// la regola di iPhone in PUNTO §3, "Lo username").
export const TESTO_NOME_IN_USO = "Questo nome è già in uso.";
export const TESTO_USERNAME_REGOLE =
  "Da 3 a 20 caratteri: lettere, numeri e _. Serve agli amici per trovarti.";

// Nel foglio "Cambia username" di Profilo, sotto il campo (mockup).
export const TESTO_USERNAME_AMICI_RESTANO =
  "I tuoi amici restano: sono legati al tuo account, non al nome. Il vecchio nome torna libero.";
export const TESTO_USERNAME_SENZA_RETE = "Per cambiare lo username serve la connessione.";
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
// ricontrollo, "quando crei l'account" in Registrati, "quando salvi" nel
// foglio. `inUso`: il testo del nome preso (TESTO_NOME_IN_USO dove il
// campo sta da solo).
export function testoStatoUsername(
  stato: StatoFoglioUsername,
  quando = "quando crei l'account",
  inUso = TESTO_USERNAME_IN_USO
): string {
  switch (stato) {
    case "vuoto":
      return "";
    case "controllo":
      return "Controllo…";
    case "disponibile":
      return "Disponibile";
    case "in_uso":
      return inUso;
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
