// I testi dello username, dal mockup approvato (docs/mockups/amici.html).
// Gli stessi nella pagina, mentre si scrive, e nella Server Action, all'invio:
// stanno qui e non in src/lib/actions/auth.ts perché un file "use server"
// può esportare solo funzioni async.

import type { StatoUsername } from "./useDisponibilitaUsername";

export const TESTO_USERNAME_NON_VALIDO =
  "Da 3 a 20 caratteri: inizia con una lettera, poi lettere, numeri e _.";
export const TESTO_USERNAME_IN_USO = "Questo username è già in uso.";
export const TESTO_USERNAME_REGOLE =
  "Da 3 a 20 caratteri: lettere, numeri e _. Serve agli amici per trovarti.";

// La riga sotto il campo, per ogni stato. "vuoto": niente. "errore": la
// risposta non è arrivata, si ricontrolla all'invio.
export function testoStatoUsername(stato: StatoUsername): string {
  switch (stato) {
    case "vuoto":
      return "";
    case "controllo":
      return "Controllo…";
    case "disponibile":
      return "Disponibile";
    case "in_uso":
      return TESTO_USERNAME_IN_USO;
    case "non_valido":
      return TESTO_USERNAME_NON_VALIDO;
    case "errore":
      return "Non riesco a controllarlo ora: lo controllo quando crei l'account.";
  }
}
