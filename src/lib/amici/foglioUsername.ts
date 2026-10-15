// Il foglio "Cambia username" (Profilo; poi "Scegli il tuo username" in
// Amici): che cosa dire sotto il campo e quando si può salvare
// (PUNTO_DI_PARTENZA.md §3, mockup docs/mockups/amici.html, schermata 5).
//
// Il caso da non sbagliare: il proprio nome attuale. Per il database è
// "preso" (da te), quindi `username_disponibile` risponde false; senza
// questa regola il foglio aperto direbbe "Questo username è già in uso."
// sul tuo stesso nome.

import { normalizzaUsername } from "@/lib/validazione";
import type { StatoUsername } from "./useDisponibilitaUsername";

export type StatoFoglioUsername = StatoUsername | "attuale";

export function statoNelFoglio(
  stato: StatoUsername,
  valore: string,
  attuale: string | null
): StatoFoglioUsername {
  if (attuale !== null && normalizzaUsername(valore) === attuale) return "attuale";
  return stato;
}

// Si salva con un nome nuovo nel formato giusto, che non risulta preso.
// "controllo" ed "errore" non bloccano: decide imposta_username, che sa
// dire "occupato". Senza connessione no: il salvataggio è solo online.
export function puoSalvareUsername(stato: StatoFoglioUsername, online: boolean): boolean {
  if (!online) return false;
  return stato === "disponibile" || stato === "controllo" || stato === "errore";
}
