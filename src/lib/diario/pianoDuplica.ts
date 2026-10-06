// Duplica un alimento o un pasto intero in un pasto di un giorno qualsiasi
// fino a oggi (PUNTO_DI_PARTENZA.md, sezione 3, "Tieni premuto", passo E):
// le decisioni, senza database e senza React, come pianoSpostamento.ts.
// Chi legge le righe da Dexie e applica le scritture è duplicaNelPasto in
// src/lib/repository/vociDiario.ts.
//
// L'originale non si tocca MAI: nessuna scrittura punta a una delle righe
// che si duplicano.
//
// Le righe che si duplicano non sono MAI doppioni di se stesse (regola del
// passo E): duplicare la Mela nel suo stesso pasto e giorno crea una
// seconda riga Mela, senza foglio dei doppioni — altrimenti "Somma"
// modificherebbe l'originale. Un doppione c'è solo se nel pasto di
// destinazione c'è un'ALTRA riga dello stesso alimento. Lì le scelte sono
// quelle del passo C, ma toccano solo quell'altra riga:
// - somma: la riga di destinazione prende il totale (sua quantità + quella
//   duplicata), con i suoi valori; nessuna copia;
// - scrivi: la riga di destinazione prende i grammi scritti; nessuna copia;
// - separati: la copia si crea accanto;
// - escludi ("Non duplicarlo"): niente.
// Più righe dello stesso alimento a destinazione: somma e scrivi le
// riducono a una (la più vecchia), come nel passo C.
//
// Le copie: stesso alimento_id e valori copiati dalla voce ORIGINALE
// (decisione 5: anche se l'alimento è stato tolto dal catalogo, è "ripeti
// quello che ho mangiato"); creato_il adesso; consumato_alle come
// /aggiungi (decisione 9): l'ora attuale solo se il giorno è oggi,
// altrimenti vuoto; gruppo_id nuovo e comune per un pasto intero (sono
// righe inserite insieme), nessuno per un alimento solo.

import type { VoceDiario } from "../db/tipi";
import {
  arrotondaGrammi,
  rigaCheResta,
  sommaGrammi,
  trovaDoppioni,
  type Doppione,
  type SceltaDoppione,
  type Scrittura,
} from "./pianoSpostamento";

export interface PianoDuplica {
  scritture: Scrittura[];
  // Nomi degli alimenti duplicati davvero (con una copia, o sommati in una
  // riga di destinazione), uno per alimento.
  duplicati: string[];
  // Nomi degli alimenti non duplicati ("Non duplicarlo").
  esclusi: string[];
}

// Le righe di destinazione tolte quelle che si stanno duplicando: duplicare
// nello stesso pasto e giorno non deve trovare l'originale come doppione.
function destinazioneSenzaOriginali(originali: VoceDiario[], destinazione: VoceDiario[]): VoceDiario[] {
  const ids = new Set(originali.map((v) => v.id));
  return destinazione.filter((v) => !ids.has(v.id));
}

export function doppioniDuplica(originali: VoceDiario[], destinazione: VoceDiario[]): Doppione[] {
  return trovaDoppioni(originali, destinazioneSenzaOriginali(originali, destinazione));
}

export function pianoDuplica({
  originali,
  destinazione,
  dataDestinazione,
  pastoDestinazioneId,
  scelte,
  adesso,
  oggi,
  gruppoId,
}: {
  originali: VoceDiario[];
  destinazione: VoceDiario[];
  dataDestinazione: string;
  pastoDestinazioneId: string;
  scelte: Record<string, SceltaDoppione>;
  // ISO 8601 dell'istante della duplicazione (creato_il, consumato_alle).
  adesso: string;
  // oggiLocale(): decide consumato_alle.
  oggi: string;
  // Il gruppo comune delle copie di un pasto intero; null per un alimento.
  gruppoId: string | null;
}): PianoDuplica {
  const scritture: Scrittura[] = [];
  const duplicati: string[] = [];
  const esclusi: string[] = [];
  const altre = destinazioneSenzaOriginali(originali, destinazione);
  const giaDecisi = new Set<string>();

  function copia(v: VoceDiario): Scrittura {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, updated_at, deleted_at, ...contenuto } = v;
    return {
      tipo: "crea",
      dati: {
        ...contenuto,
        pasto_id: pastoDestinazioneId,
        data: dataDestinazione,
        gruppo_id: gruppoId,
        creato_il: adesso,
        consumato_alle: dataDestinazione === oggi ? adesso : null,
      },
    };
  }

  for (const voce of originali) {
    const k = voce.alimento_id;
    const esistenti = k === null ? [] : altre.filter((v) => v.alimento_id === k);

    if (esistenti.length === 0) {
      scritture.push(copia(voce));
      if (k === null || !giaDecisi.has(k)) duplicati.push(voce.nome_alimento);
      if (k !== null) giaDecisi.add(k);
      continue;
    }

    if (giaDecisi.has(k!)) continue;
    giaDecisi.add(k!);
    const scelta = scelte[k!];
    if (!scelta) throw new Error(`Manca la scelta per il doppione ${k}`);
    const arrivano = originali.filter((v) => v.alimento_id === k);

    switch (scelta.tipo) {
      case "escludi":
        esclusi.push(voce.nome_alimento);
        break;
      case "separati":
        for (const v of arrivano) scritture.push(copia(v));
        duplicati.push(voce.nome_alimento);
        break;
      case "somma":
      case "scrivi": {
        const resta = rigaCheResta(esistenti);
        const grammi =
          scelta.tipo === "somma"
            ? arrotondaGrammi(sommaGrammi(esistenti) + sommaGrammi(arrivano))
            : arrotondaGrammi(scelta.grammi);
        scritture.push({ tipo: "aggiorna", id: resta.id, modifiche: { quantita_g: grammi } });
        for (const v of esistenti) {
          if (v.id !== resta.id) scritture.push({ tipo: "elimina", id: v.id });
        }
        duplicati.push(voce.nome_alimento);
        break;
      }
    }
  }

  return { scritture, duplicati, esclusi };
}
