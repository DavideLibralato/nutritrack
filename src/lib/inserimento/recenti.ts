// "Recenti" nella pagina Aggiungi (PUNTO_DI_PARTENZA.md, sezione 3, punto 3):
// gli alimenti già usati dall'utente, più recenti prima, senza duplicati —
// di ciascuno si mostra solo l'ultima quantità usata.
//
// Funzione pura: prende catalogo e voci già caricati da Dexie (via
// useLiveQuery nella pagina) e non fa altre interrogazioni.

import type { Alimento, VoceDiario } from "../db/tipi";

export interface AlimentoRecente {
  // Versione VIVA dal catalogo, non la copia congelata nella voce diario: se
  // l'alimento è stato corretto nel frattempo, "Recenti" mostra i valori
  // aggiornati — stessa scelta di `alimentoScelto` in /aggiungi.
  alimento: Alimento;
  // Quantità dell'ultima voce diario per questo alimento.
  quantitaG: number;
}

export function alimentiRecenti(
  catalogo: Alimento[],
  voci: VoceDiario[],
  limite: number
): AlimentoRecente[] {
  // Un solo passaggio, più recente prima: la prima volta che si incontra un
  // alimento_id è la sua voce più recente, le successive si ignorano.
  const ordinate = [...voci].sort(
    (a, b) => new Date(b.creato_il).getTime() - new Date(a.creato_il).getTime()
  );

  const ultimaVocePerAlimento = new Map<string, VoceDiario>();
  for (const v of ordinate) {
    if (v.alimento_id && !ultimaVocePerAlimento.has(v.alimento_id)) {
      ultimaVocePerAlimento.set(v.alimento_id, v);
    }
  }

  const risultato: AlimentoRecente[] = [];
  for (const voce of ultimaVocePerAlimento.values()) {
    if (risultato.length === limite) break;
    // L'alimento potrebbe non esistere più nel catalogo (eliminato dopo
    // l'ultimo utilizzo): in quel caso non compare nei Recenti.
    const alimento = catalogo.find((a) => a.id === voce.alimento_id);
    if (alimento) risultato.push({ alimento, quantitaG: voce.quantita_g });
  }
  return risultato;
}
