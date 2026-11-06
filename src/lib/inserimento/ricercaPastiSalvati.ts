// La ricerca di Aggiungi nei pasti salvati (PUNTO_DI_PARTENZA.md §3,
// "Aggiungi alimento", "Ricerca nei pasti salvati"; decisione del 13/10,
// regole del 03/11). Un pasto salvato compare se la parola cercata è:
// - nel suo nome: allora niente "Contiene";
// - altrimenti nel nome di uno dei suoi alimenti: allora la riga dice
//   "Contiene <alimento>", con il PRIMO alimento che la contiene
//   nell'ordine del pasto (composizioni_voci.ordine).
// Il confronto è testoConfronto, lo stesso di cercaPerNome sugli alimenti:
// maiuscole, accenti e spazi doppi indifferenti, la parola può stare a metà
// ("riso" trova "Gallette di riso"). Si guarda solo il nome dell'alimento,
// non la marca, come nella ricerca degli alimenti.
//
// Riceve i pasti già costruiti da pastiSalvati: le voci contengono solo
// gli alimenti ancora nel catalogo, quindi un alimento cancellato non fa
// trovare il pasto. L'ordine resta quello ricevuto: pastiSalvati li dà già
// per nome, come nei Preferiti.
//
// Funzione pura, senza Dexie: test in ricercaPastiSalvati.test.ts.

import { testoConfronto } from "../catalogo/doppioniAlimenti";
import type { PastoSalvato } from "./pastiSalvati";

export interface PastoSalvatoTrovato {
  pasto: PastoSalvato;
  // Il nome dell'alimento per cui il pasto è stato trovato, così come è
  // scritto nel catalogo; null se la parola è nel nome del pasto.
  contiene: string | null;
}

export function cercaPastiSalvati(pasti: PastoSalvato[], query: string): PastoSalvatoTrovato[] {
  const q = testoConfronto(query);
  if (!q) return [];

  const trovati: PastoSalvatoTrovato[] = [];
  for (const pasto of pasti) {
    if (testoConfronto(pasto.nome).includes(q)) {
      trovati.push({ pasto, contiene: null });
      continue;
    }
    // Le voci sono già nell'ordine del pasto (vociValidePerComposizione).
    const voce = pasto.voci.find((v) => testoConfronto(v.alimento.nome).includes(q));
    if (voce) trovati.push({ pasto, contiene: voce.alimento.nome });
  }
  return trovati;
}

// La seconda riga di un pasto trovato per un alimento: "Contiene Gallette
// di riso". Il resto del sottotitolo ("4 alimenti · 410 kcal") resta
// sottotitoloPastoSalvato.
export function testoContiene(nomeAlimento: string): string {
  return `Contiene ${nomeAlimento}`;
}
