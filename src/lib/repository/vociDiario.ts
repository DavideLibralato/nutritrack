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
import { repositoryPasti, repositoryVociDiario } from "./index";
import type { Profilo, VoceDiario } from "../db/tipi";
import { dataScrivibile, oggiLocale } from "../dataGiorno";
import { garantisciGiornoPerPrimaVoce } from "./giorni";
import { pastoValidoIl } from "../pasti/validitaPasti";
import { doppioniDuplica, pianoDuplica, type PianoDuplica } from "../diario/pianoDuplica";
import {
  pianoSpostamento,
  stessiDoppioni,
  trovaDoppioni,
  type Doppione,
  type PianoSpostamento,
  type SceltaDoppione,
  type Scrittura,
} from "../diario/pianoSpostamento";

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
  const ids = (await vociDelPasto(userId, data, pastoId)).map((v) => v.id);
  return eliminaVoci(ids);
}

// Le voci vive di un pasto in un giorno, lette da Dexie adesso.
async function vociDelPasto(userId: string, data: string, pastoId: string): Promise<VoceDiario[]> {
  const voci = await repositoryVociDiario.ottieniTutti(userId);
  return voci.filter((v) => v.data === data && v.pasto_id === pastoId);
}

// Applica un elenco di scritture (crea / aggiorna / elimina) e ne
// restituisce la fotografia: le righe create vanno in `idCreate`, quelle
// toccate in `prima` com'erano. Ogni riga esistente si rilegge prima di
// scriverla: se nel frattempo è sparita o è stata cancellata, l'operazione
// si ferma. In ogni caso di errore le scritture già fatte si annullano
// subito: o tutto, o niente.
export async function applicaScritture(scritture: Scrittura[]): Promise<FotografiaVoci> {
  const foto: FotografiaVoci = { prima: [], idCreate: [] };
  const fotografate = new Set<string>();
  try {
    for (const s of scritture) {
      if (s.tipo === "crea") {
        const nuova = await repositoryVociDiario.crea(s.dati);
        foto.idCreate.push(nuova.id);
        continue;
      }
      const voce = await repositoryVociDiario.ottieniPerId(s.id);
      if (!voce || voce.deleted_at !== null) {
        throw new Error(`La voce ${s.id} non c'è più: operazione interrotta`);
      }
      // La copia di com'era PRIMA della prima scrittura su questa riga.
      if (!fotografate.has(s.id)) {
        foto.prima.push(voce);
        fotografate.add(s.id);
      }
      if (s.tipo === "aggiorna") await repositoryVociDiario.aggiorna(s.id, s.modifiche);
      else await repositoryVociDiario.elimina(s.id);
    }
  } catch (errore) {
    await annullaOperazione(foto).catch(() => {});
    throw errore;
  }
  return foto;
}

// Da dove parte uno spostamento: una voce sola o tutto un pasto.
export type OrigineSpostamento =
  | { tipo: "voce"; id: string }
  | { tipo: "pasto"; pastoId: string };

export type EsitoSpostaNelPasto =
  // Servono (di nuovo) le scelte per i doppioni: la prima volta, o perché
  // nel frattempo gli alimenti in doppione sono cambiati. Niente scritto.
  | { esito: "doppioni"; doppioni: Doppione[] }
  // Fatto: il piano applicato e la sua fotografia (vuota se non si è
  // scritto niente, per esempio tutto escluso con "Non spostarlo").
  | { esito: "fatto"; piano: PianoSpostamento; fotografia: FotografiaVoci };

// Sposta (sezione 3, "Tieni premuto"). Le righe si rileggono da Dexie qui,
// al momento della conferma, non si prendono da quelle che la pagina
// mostrava. Se ci sono doppioni e le scelte non ci sono ancora, o sono
// state fatte per un elenco di doppioni diverso da quello di adesso, non si
// scrive niente e si restituiscono i doppioni da chiedere.
export async function spostaNelPasto({
  userId,
  data,
  origine,
  pastoDestinazioneId,
  scelte,
  doppioniVisti,
}: {
  userId: string;
  data: string;
  origine: OrigineSpostamento;
  pastoDestinazioneId: string;
  scelte?: Record<string, SceltaDoppione>;
  doppioniVisti?: Doppione[];
}): Promise<EsitoSpostaNelPasto> {
  let partenza: VoceDiario[];
  if (origine.tipo === "voce") {
    const voce = await repositoryVociDiario.ottieniPerId(origine.id);
    partenza = voce && voce.deleted_at === null ? [voce] : [];
  } else {
    partenza = await vociDelPasto(userId, data, origine.pastoId);
  }
  const destinazione = await vociDelPasto(userId, data, pastoDestinazioneId);

  const doppioni = trovaDoppioni(partenza, destinazione);
  if (doppioni.length > 0 && (!scelte || !doppioniVisti || !stessiDoppioni(doppioni, doppioniVisti))) {
    return { esito: "doppioni", doppioni };
  }

  const piano = pianoSpostamento({
    partenza,
    destinazione,
    pastoDestinazioneId,
    scelte: scelte ?? {},
  });
  const fotografia = await applicaScritture(piano.scritture);
  return { esito: "fatto", piano, fotografia };
}

export type EsitoDuplicaNelPasto =
  // Come per Sposta: servono (di nuovo) le scelte per i doppioni.
  | { esito: "doppioni"; doppioni: Doppione[] }
  | { esito: "fatto"; piano: PianoDuplica; fotografia: FotografiaVoci };

// Duplica (sezione 3, "Tieni premuto", passo E): copia un alimento o un
// pasto intero di `dataPartenza` nel pasto e giorno scelti. Le righe si
// rileggono da Dexie qui, al momento della conferma; le regole sono in
// src/lib/diario/pianoDuplica.ts (l'originale non si tocca mai, e non è mai
// doppione di se stesso). Se nasce almeno una copia, il giorno di
// destinazione si classifica come per il primo inserimento in /aggiungi
// (garantisciGiornoPerPrimaVoce, decisione 8): non fa niente se il giorno
// è già scritto o se i giorni differenziati sono spenti. Come in /aggiungi,
// "Annulla" non toglie quella riga di `giorni`.
export async function duplicaNelPasto({
  userId,
  dataPartenza,
  origine,
  dataDestinazione,
  pastoDestinazioneId,
  profilo,
  scelte,
  doppioniVisti,
  adesso = new Date(),
}: {
  userId: string;
  dataPartenza: string;
  origine: OrigineSpostamento;
  dataDestinazione: string;
  pastoDestinazioneId: string;
  profilo: Profilo | null;
  scelte?: Record<string, SceltaDoppione>;
  doppioniVisti?: Doppione[];
  adesso?: Date;
}): Promise<EsitoDuplicaNelPasto> {
  // Anche qui, non solo nel foglio: nessuna copia nel futuro.
  if (!dataScrivibile(dataDestinazione, adesso)) {
    throw new Error(`Giorno non valido per Duplica: ${dataDestinazione}`);
  }
  // E nessuna copia in un pasto che quel giorno non esiste (cancellato, o
  // fuori dal suo periodo): il foglio offre solo i pasti di quel giorno,
  // ma fra l'apertura e la conferma una sync può averli cambiati.
  const pastoDestinazione = await repositoryPasti.ottieniPerId(pastoDestinazioneId);
  if (!pastoDestinazione || !pastoValidoIl(pastoDestinazione, dataDestinazione)) {
    throw new Error(`Pasto non valido per Duplica il : `);
  }

  let originali: VoceDiario[];
  if (origine.tipo === "voce") {
    const voce = await repositoryVociDiario.ottieniPerId(origine.id);
    originali = voce && voce.deleted_at === null ? [voce] : [];
  } else {
    originali = await vociDelPasto(userId, dataPartenza, origine.pastoId);
  }
  const destinazione = await vociDelPasto(userId, dataDestinazione, pastoDestinazioneId);

  const doppioni = doppioniDuplica(originali, destinazione);
  if (doppioni.length > 0 && (!scelte || !doppioniVisti || !stessiDoppioni(doppioni, doppioniVisti))) {
    return { esito: "doppioni", doppioni };
  }

  const piano = pianoDuplica({
    originali,
    destinazione,
    dataDestinazione,
    pastoDestinazioneId,
    scelte: scelte ?? {},
    adesso: adesso.toISOString(),
    oggi: oggiLocale(adesso),
    gruppoId: origine.tipo === "pasto" ? crypto.randomUUID() : null,
  });
  if (piano.scritture.some((s) => s.tipo === "crea")) {
    await garantisciGiornoPerPrimaVoce(userId, dataDestinazione, profilo);
  }
  const fotografia = await applicaScritture(piano.scritture);
  return { esito: "fatto", piano, fotografia };
}
