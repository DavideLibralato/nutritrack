// La forma minima che lo sheet quantità (sezione 5 di PUNTO_DI_PARTENZA.md)
// si aspetta, indipendente da dove arriva l'alimento. È l'"Alimento
// Normalizzato" della sezione 5, ridotto a quel che serve adesso: ricerca
// manuale e creazione a mano lo producono oggi, la ricerca Open Food Facts
// (fase 4) e la scansione etichetta (fase 5) lo produrranno domani senza
// cambiare lo sheet.
//
// `alimento_id` può essere null in teoria (una sorgente futura potrebbe non
// avere una riga in `alimenti`), ma per le due sorgenti di adesso è sempre
// valorizzato: sia la ricerca sia la creazione a mano partono da una riga
// del catalogo.

import type { Alimento, VoceDiario } from "../db/tipi";

export interface AlimentoPerSheet {
  alimento_id: string | null;
  nome: string;
  kcal_100g: number;
  proteine_100g: number;
  carboidrati_100g: number;
  grassi_100g: number;
  porzione_default_g: number;
}

export function daAlimento(a: Alimento): AlimentoPerSheet {
  return {
    alimento_id: a.id,
    nome: a.nome,
    kcal_100g: a.kcal_100g,
    proteine_100g: a.proteine_100g,
    carboidrati_100g: a.carboidrati_100g,
    grassi_100g: a.grassi_100g,
    porzione_default_g: a.porzione_default_g,
  };
}

// Da una voce già a diario, per riaprire lo sheet in modifica. I valori
// nutrizionali sono quelli **copiati nella voce** al momento
// dell'inserimento (sezione 4), non quelli attuali del catalogo: modificare
// la quantità non deve tirarsi dietro una correzione fatta all'alimento nel
// frattempo. La "porzione" qui è la quantità reale della voce.
export function daVoce(v: VoceDiario): AlimentoPerSheet {
  return {
    alimento_id: v.alimento_id,
    nome: v.nome_alimento,
    kcal_100g: v.kcal_100g,
    proteine_100g: v.proteine_100g,
    carboidrati_100g: v.carboidrati_100g,
    grassi_100g: v.grassi_100g,
    porzione_default_g: v.quantita_g,
  };
}
