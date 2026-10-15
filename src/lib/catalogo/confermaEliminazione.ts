// La conferma prima di eliminare uno o più alimenti dalla selezione di
// Impostazioni > Alimenti (PUNTO_DI_PARTENZA.md, sezione 3, "Alimenti"):
// cosa toccherà l'eliminazione oltre al catalogo, e le frasi dello sheet.
//
// Funzioni pure: ricevono gli elenchi già caricati da Dexie dalla pagina.

import type { Alimento, Composizione, ComposizioneVoce, Preferito } from "../db/tipi";
import { pastiSalvati } from "../inserimento/pastiSalvati";

export interface ConseguenzeEliminazione {
  // Pasti salvati da cui spariranno uno o più degli alimenti: solo quelli
  // visibili in Preferiti (pastiSalvati), contati una volta anche se
  // contengono più alimenti della selezione. Chi rimane vuoto viene
  // cancellato (cascata in eliminaAlimenti), ma per l'utente è comunque
  // "un pasto salvato da cui l'alimento viene tolto".
  pastiSalvati: number;
  // Alimenti della selezione che sono fra i preferiti: escono dall'elenco
  // dei preferiti (la riga resta, nascosta, e torna con l'Annulla). Un
  // alimento con due righe vive in `preferiti` (due dispositivi offline)
  // conta una volta, come in Preferiti.
  preferiti: number;
}

export function conseguenzeEliminazione(
  idAlimenti: string[],
  catalogo: Alimento[],
  composizioni: Composizione[],
  composizioniVoci: ComposizioneVoce[],
  preferiti: Preferito[]
): ConseguenzeEliminazione {
  const ids = new Set(idAlimenti);
  const pasti = pastiSalvati(catalogo, composizioni, composizioniVoci).filter((p) =>
    p.voci.some((v) => ids.has(v.alimento.id))
  );
  const preferitiToccati = new Set(
    preferiti.filter((p) => p.deleted_at === null && ids.has(p.alimento_id)).map((p) => p.alimento_id)
  );
  return { pastiSalvati: pasti.length, preferiti: preferitiToccati.size };
}

// Le frasi dello sheet, decise il 15/10:
// - titolo: "Eliminare «Mela»?" con un alimento solo, "Eliminare 3
//   alimenti?" con più di uno;
// - testo: "Il diario non cambia." e, solo se serve, "Verrà tolto anche
//   da 1 pasto salvato e 2 preferiti." — verbo al singolare con un
//   alimento solo, al plurale con più; se una delle due parti è a zero,
//   solo l'altra.
export function testiConfermaEliminazione(
  nomi: string[],
  conseguenze: ConseguenzeEliminazione
): { titolo: string; testo: string } {
  const titolo = nomi.length === 1 ? `Eliminare «${nomi[0]}»?` : `Eliminare ${nomi.length} alimenti?`;

  const parti: string[] = [];
  const { pastiSalvati: x, preferiti: y } = conseguenze;
  if (x > 0) parti.push(x === 1 ? "1 pasto salvato" : `${x} pasti salvati`);
  if (y > 0) parti.push(y === 1 ? "1 preferito" : `${y} preferiti`);

  let testo = "Il diario non cambia.";
  if (parti.length > 0) {
    const verbo = nomi.length === 1 ? "Verrà tolto" : "Verranno tolti";
    testo += ` ${verbo} anche da ${parti.join(" e ")}.`;
  }
  return { titolo, testo };
}
