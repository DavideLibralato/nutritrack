// Operazioni sulle voci di diario che si possono annullare, e il loro
// "Annulla" (PUNTO_DI_PARTENZA.md, punti 10.2 e 10.6, e sezione 3, "Tieni
// premuto: sposta, duplica, elimina").
//
// Ogni operazione restituisce una FOTOGRAFIA: com'erano, prima, le righe
// che ha modificato o cancellato (`prima`), e gli id delle righe che ha
// creato (`idCreate`). Un inserimento da /aggiungi è il caso più semplice:
// niente `prima`, solo le righe create.
//
// L'Annulla scrive SOLO IN AVANTI, mai "resuscitando" una riga:
// - le righe create si cancellano (logicamente: deleted_at + outbox);
// - le righe modificate tornano ai valori di prima con aggiorna();
// - le righe cancellate si RICREANO, con un id nuovo e lo stesso contenuto
//   (compresi creato_il e gruppo_id).
// Il perché: la discesa fa vincere sempre una cancellazione che arriva dal
// server (src/lib/sync/discesa.ts). Rimettere deleted_at = null su una riga
// la cui cancellazione è già partita la farebbe sparire di nuovo alla
// discesa successiva, in silenzio. Una riga con un id nuovo non ha nessuna
// cancellazione sul server che possa vincere su di lei. Nessuno punta
// all'id di una voce di diario, quindi cambiarlo non rompe niente.
//
// L'id della riga ricreata è DETERMINISTICO, calcolato dall'id originale
// (UUID v5, come i giorni in giorni.ts): ripetere l'Annulla, o riprovarlo
// dopo un guasto a metà, trova la riga già ricreata e la salta invece di
// crearne una seconda.
//
// Ogni riga è riletta da Dexie, non presa dallo stato React: una voce già
// cancellata nel frattempo si salta.
//
// La riga di `giorni` creata dalla prima voce (garantisciGiornoPerPrima
// Voce) non si tocca: può contenere una scelta esplicita fatta con la
// pastiglia, che vince sempre (sezione 3).

import { v5 as uuidv5 } from "uuid";
import { repositoryVociDiario } from "./index";
import type { VoceDiario } from "../db/tipi";

export interface FotografiaVoci {
  // Le righe come erano PRIMA dell'operazione (copie intere), per quelle
  // che l'operazione ha modificato o cancellato.
  prima: VoceDiario[];
  // Le righe che l'operazione ha creato.
  idCreate: string[];
}

// Namespace fisso per l'id delle righe ricreate dall'Annulla. Generato una
// volta a caso: non deve coincidere con quello dei giorni o dei pasti.
const NAMESPACE_RIPRISTINO_VOCI = "3b614291-487c-44b1-a1a0-73495c6b813b";

export function idVoceRicreata(idOriginale: string): string {
  return uuidv5(idOriginale, NAMESPACE_RIPRISTINO_VOCI);
}

// La fotografia di un inserimento da /aggiungi: solo righe create.
export function fotografiaInserimento(idVoci: string[]): FotografiaVoci {
  return { prima: [], idCreate: [...idVoci] };
}

// Il contenuto di una voce, senza i campi tecnici che crea() assegna da sé.
function contenuto(voce: VoceDiario): Omit<VoceDiario, "id" | "updated_at" | "deleted_at"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, updated_at, deleted_at, ...resto } = voce;
  return resto;
}

function stessoContenuto(a: VoceDiario, b: VoceDiario): boolean {
  const ca = contenuto(a);
  const cb = contenuto(b);
  return (Object.keys(ca) as (keyof typeof ca)[]).every((k) => ca[k] === cb[k]);
}

// Annulla l'operazione della fotografia. Restituisce quante righe ha
// riscritto davvero (0 se era già tutto annullato).
export async function annullaOperazione(foto: FotografiaVoci): Promise<number> {
  let scritte = 0;

  for (const id of foto.idCreate) {
    const voce = await repositoryVociDiario.ottieniPerId(id);
    if (!voce || voce.deleted_at !== null) continue;
    await repositoryVociDiario.elimina(id);
    scritte++;
  }

  for (const prima of foto.prima) {
    const attuale = await repositoryVociDiario.ottieniPerId(prima.id);
    if (attuale && attuale.deleted_at === null) {
      // Ancora viva: l'operazione l'aveva modificata, si rimettono i valori.
      if (stessoContenuto(attuale, prima)) continue;
      await repositoryVociDiario.aggiorna(prima.id, contenuto(prima));
      scritte++;
      continue;
    }
    // Cancellata (o sparita): si ricrea con un id nuovo, se non è già stato
    // fatto da un Annulla precedente.
    const idNuovo = idVoceRicreata(prima.id);
    if (await repositoryVociDiario.ottieniPerId(idNuovo)) continue;
    await repositoryVociDiario.crea(contenuto(prima), idNuovo);
    scritte++;
  }

  return scritte;
}

// Elimina (logicamente) le voci indicate, saltando quelle già cancellate.
// Se una scrittura fallisce a metà, annulla subito quelle già fatte e
// rilancia l'errore: o tutto, o niente.
export async function eliminaVoci(ids: string[]): Promise<FotografiaVoci> {
  const foto: FotografiaVoci = { prima: [], idCreate: [] };
  try {
    for (const id of ids) {
      const voce = await repositoryVociDiario.ottieniPerId(id);
      if (!voce || voce.deleted_at !== null) continue;
      await repositoryVociDiario.elimina(id);
      foto.prima.push(voce);
    }
  } catch (errore) {
    await annullaOperazione(foto).catch(() => {});
    throw errore;
  }
  return foto;
}

// "Elimina tutto il pasto": le voci vive di quel pasto in quel giorno,
// rilette da Dexie al momento della conferma (non quelle che la pagina
// mostrava). Cancella le voci, non la fascia del pasto.
export async function eliminaPastoDelGiorno(
  userId: string,
  data: string,
  pastoId: string
): Promise<FotografiaVoci> {
  const voci = await repositoryVociDiario.ottieniTutti(userId);
  const ids = voci.filter((v) => v.data === data && v.pasto_id === pastoId).map((v) => v.id);
  return eliminaVoci(ids);
}
