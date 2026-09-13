// "Preferiti" nella pagina Aggiungi (PUNTO_DI_PARTENZA.md, sezione 3, punto
// 4 — solo alimenti singoli: i pasti salvati sono un pezzo separato).
//
// Funzione pura, stesso stile di recenti.ts. La quantità mostrata e usata dal
// "+" è l'ultima registrata per quell'alimento; se non è mai stato
// registrato, la porzione di default dell'alimento.

import type { Alimento, Preferito, VoceDiario } from "../db/tipi";

export interface AlimentoPreferito {
  alimento: Alimento;
  quantitaG: number;
}

export function alimentiPreferiti(
  catalogo: Alimento[],
  preferiti: Preferito[],
  voci: VoceDiario[]
): AlimentoPreferito[] {
  // Più recente prima, per trovare in un solo passaggio l'ultima quantità
  // usata di ciascun alimento (stessa logica di recenti.ts).
  const ordinate = [...voci].sort(
    (a, b) => new Date(b.creato_il).getTime() - new Date(a.creato_il).getTime()
  );
  const ultimaQuantitaPerAlimento = new Map<string, number>();
  for (const v of ordinate) {
    if (v.alimento_id && !ultimaQuantitaPerAlimento.has(v.alimento_id)) {
      ultimaQuantitaPerAlimento.set(v.alimento_id, v.quantita_g);
    }
  }

  const risultato: AlimentoPreferito[] = [];
  for (const p of preferiti) {
    // L'alimento potrebbe non esistere più nel catalogo (eliminato dopo
    // averlo messo tra i preferiti): in quel caso non compare.
    const alimento = catalogo.find((a) => a.id === p.alimento_id);
    if (!alimento) continue;
    const quantitaG =
      ultimaQuantitaPerAlimento.get(alimento.id) ?? alimento.porzione_default_g;
    risultato.push({ alimento, quantitaG });
  }

  // Elenco curato dall'utente, non uno storico: ordine alfabetico per
  // ritrovare un alimento specifico, non cronologico come Recenti.
  return risultato.sort((a, b) => a.alimento.nome.localeCompare(b.alimento.nome, "it"));
}
