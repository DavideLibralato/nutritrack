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
// - escludi ("Non duplicarlo"): niente, anche se alla conferma l'altra riga
//   non c'è più (togliEsclusi, dentro pianoInserimento).
// Più righe dello stesso alimento a destinazione: somma e scrivi le
// riducono a una (la più vecchia), come nel passo C.
//
// Le copie: stesso alimento_id e valori copiati dalla voce ORIGINALE
// (decisione 5: anche se l'alimento è stato tolto dal catalogo, è "ripeti
// quello che ho mangiato"); creato_il adesso; consumato_alle come
// /aggiungi (decisione 9): l'ora attuale solo se il giorno è oggi,
// altrimenti vuoto; gruppo_id nuovo e comune per un pasto intero (sono
// righe inserite insieme), nessuno per un alimento solo.
//
// Le scelte sui doppioni sono quelle di ogni riga nuova che entra in un
// pasto, scritte una volta sola in pianoInserimento.ts: qui si preparano
// le copie e si tolgono gli originali dalla destinazione, poi decide lui.

import type { VoceDiario } from "../db/tipi";
import { trovaDoppioni, type Doppione, type SceltaDoppione, type Scrittura } from "./pianoSpostamento";
import { pianoInserimento, type DatiVoce } from "./pianoInserimento";

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
  function copia(v: VoceDiario): DatiVoce {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, updated_at, deleted_at, ...contenuto } = v;
    return {
      ...contenuto,
      pasto_id: pastoDestinazioneId,
      data: dataDestinazione,
      gruppo_id: gruppoId,
      creato_il: adesso,
      consumato_alle: dataDestinazione === oggi ? adesso : null,
    };
  }

  const { scritture, inseriti, esclusi } = pianoInserimento({
    nuove: originali.map(copia),
    destinazione: destinazioneSenzaOriginali(originali, destinazione),
    scelte,
  });
  return { scritture, duplicati: inseriti, esclusi };
}
