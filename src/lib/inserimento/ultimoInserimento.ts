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

export interface UltimoInserimento {
  // Gli id delle voci create: una per un alimento singolo, tutte quelle del
  // gruppo per un pasto salvato. "Annulla" cancella esattamente queste.
  idVoci: string[];
  nome: string;
  // null per un alimento singolo; per un pasto salvato, quante voci.
  numeroAlimenti: number | null;
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
