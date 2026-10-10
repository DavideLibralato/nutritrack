// Lo stato della sincronizzazione in breve, a destra della riga
// "Sincronizzazione" nell'elenco di Impostazioni (mockup approvato il
// 10/10, docs/mockups/sincronizzazione.html, riga "2 · Pallino + testo"):
// un pallino colorato e una parola o due. Funzione pura, con il suo test.
//
// Il colore segue il riquadro della pagina: grigio come gli altri valori
// dell'elenco quando è tutto a posto o in corso (pallino verde), ocra per
// in attesa, arancio per i tre stati che chiedono attenzione.

import type { StatoDaMostrare } from "./statoSincronizzazione";

export type TonoRiga = "neutro" | "attesa" | "avviso";

export interface RigaSincronizzazione {
  testo: string;
  tono: TonoRiga;
  // Il pallino che pulsa: solo per "in corso".
  pulsa: boolean;
}

export function rigaSincronizzazione(stato: StatoDaMostrare): RigaSincronizzazione {
  switch (stato.tipo) {
    case "accantonate":
      return { testo: "Da controllare", tono: "avviso", pulsa: false };
    case "sessione":
      return { testo: "Accedi di nuovo", tono: "avviso", pulsa: false };
    case "errore":
      return { testo: "Errore", tono: "avviso", pulsa: false };
    case "in-attesa":
      return { testo: `${stato.numero} in attesa`, tono: "attesa", pulsa: false };
    case "in-corso":
      return { testo: "In corso…", tono: "neutro", pulsa: true };
    case "sincronizzato":
      return { testo: "Tutto salvato", tono: "neutro", pulsa: false };
  }
}
