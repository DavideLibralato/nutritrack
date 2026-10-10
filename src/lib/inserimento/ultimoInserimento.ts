// L'ultimo inserimento nel diario, da /aggiungi a Oggi (PUNTO_DI_PARTENZA.md,
// punto 10.2, "Aggiunto — Annulla").
//
// Ogni percorso di inserimento, appena scritto, torna a Oggi con
// router.replace: la barra "Aggiunto" deve comparire là, ma /aggiungi a quel
// punto non c'è più. Questo modulo tiene in memoria cosa è stato appena
// scritto, e Oggi lo legge una volta sola (in un useEffect, vedi la pagina).
//
// In memoria apposta, non nell'URL né su disco: un ricaricamento della
// pagina o il tasto "indietro" non devono far ricomparire la barra di un
// inserimento vecchio. Un nuovo inserimento sostituisce quello in attesa.
// Se l'inserimento non arriva (pagina ricaricata, scheda nuova) Oggi non
// mostra nessuna barra: mai un "Annulla" su qualcosa di sbagliato.
//
// Porta la FOTOGRAFIA intera dell'operazione (src/lib/repository/
// vociDiario.ts), non solo gli id delle righe create: dal 10/10 un
// inserimento può anche sommare i grammi a una riga che c'era già
// (doppioni, sezione 3), e "Annulla" deve riportare quella riga ai grammi di
// prima, non cancellarla. E porta il messaggio già pronto (testiBarra.ts),
// perché solo /aggiungi sa cosa è successo (aggiunto, sommato, escluso).

import type { FotografiaVoci } from "../repository/vociDiario";
import type { MessaggioBarra } from "./testiBarra";

export interface UltimoInserimento {
  fotografia: FotografiaVoci;
  messaggio: MessaggioBarra;
}

let inAttesa: UltimoInserimento | null = null;

export function segnaInserimento(inserimento: UltimoInserimento): void {
  inAttesa = inserimento;
}

// Restituisce l'inserimento in attesa e lo svuota: chi lo prende è l'unico
// a vederlo.
export function prendiInserimento(): UltimoInserimento | null {
  const preso = inAttesa;
  inAttesa = null;
  return preso;
}
