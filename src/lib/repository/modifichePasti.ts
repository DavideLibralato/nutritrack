// Le scritture della pagina Impostazioni > Pasti e orari, e il loro Annulla
// (PUNTO_DI_PARTENZA.md, sezione 3, "Pasti e orari"):
// - correggiPasto: nome e/o ora sulla stessa riga, quindi in ogni giorno
//   del pasto, passati compresi. È anche il cambio della sola ora;
// - rinominaDaOggi: il modello C (sezione 4, "pasti"). La riga vecchia si
//   chiude ieri, ne nasce una nuova da oggi, e le voci di oggi passano a
//   quella nuova;
// - aggiungiPasto: una riga nuova, da sempre o da oggi.
//
// Ogni funzione rilegge le righe da Dexie e rifà i controlli
// (controlliPasti.ts) al momento della scrittura: la pagina li fa già per
// mostrare gli errori sotto i campi, ma fra l'apertura dello sheet e il
// Salva una sync può aver cambiato i pasti (come in duplicaNelPasto).
//
// Le righe scritte hanno SEMPRE valido_dal e valido_al espliciti, anche
// null: una riga salvata prima di Dexie version(6) non ha le chiavi, e qui
// non si lascia una chiave mancante su una riga che si tocca.
//
// Ogni operazione restituisce una FOTOGRAFIA per l'Annulla, come le voci
// di diario (vociDiario.ts): le righe di `pasti` com'erano prima, gli id
// delle righe create e, per "da oggi", quali voci riportare indietro.
// L'Annulla scrive solo in avanti e non rimette mai in vita una riga
// cancellata (stesso motivo di vociDiario.ts: la discesa fa vincere sempre
// una cancellazione arrivata dal server).

import { db } from "../db/database";
import type { Pasto, VoceDiario } from "../db/tipi";
import { giornoPrecedente } from "../dataGiorno";
import { pastoValidoIl } from "../pasti/validitaPasti";
import {
  domandaPerNome,
  erroreNome,
  erroreOra,
  normalizzaNome,
  normalizzaOra,
  periodoDi,
  prossimoOrdine,
  type Periodo,
} from "../pasti/controlliPasti";
import { repositoryPasti, repositoryVociDiario } from "./index";
import { tuttiIPasti } from "./pasti";

export interface FotografiaPasti {
  // Le righe di `pasti` come erano PRIMA (copie intere).
  pastiPrima: Pasto[];
  // Le righe di `pasti` create dall'operazione.
  idPastiCreati: string[];
  // Solo per "da oggi": le voci di `data` che stanno su `daPastoId` tornano
  // su `aPastoId`. Si rileggono al momento dell'Annulla, non si prende un
  // elenco fisso: così torna indietro anche una voce aggiunta nel
  // frattempo al pasto nuovo (da un'altra scheda o un altro dispositivo).
  vociDaRiportare: { daPastoId: string; aPastoId: string; data: string } | null;
}

// Un controllo non superato al momento della scrittura. `campo` dice sotto
// quale campo dello sheet mostrare il messaggio.
export class ErroreControlloPasto extends Error {
  constructor(
    public campo: "nome" | "ora",
    messaggio: string
  ) {
    super(messaggio);
    this.name = "ErroreControlloPasto";
  }
}

function controlla(campo: "nome" | "ora", errore: string | null): void {
  if (errore) throw new ErroreControlloPasto(campo, errore);
}

async function pastoVivo(id: string): Promise<Pasto> {
  const pasto = await repositoryPasti.ottieniPerId(id);
  if (!pasto || pasto.deleted_at !== null) {
    throw new Error(`Il pasto ${id} non c'è più`);
  }
  return pasto;
}

// Le date della riga, sempre esplicite (vedi in testa al file).
function dateEsplicite(pasto: Pasto): Pick<Pasto, "valido_dal" | "valido_al"> {
  return { valido_dal: pasto.valido_dal ?? null, valido_al: pasto.valido_al ?? null };
}

// Correggi: nome e ora nuovi sulla stessa riga. Il nome si controlla solo
// se è cambiato (davvero o solo nelle maiuscole: anche allora non deve
// scontrarsi con un altro pasto).
export async function correggiPasto({
  id,
  nome,
  ora,
  oggi,
}: {
  id: string;
  nome: string;
  ora: string;
  oggi: string;
}): Promise<FotografiaPasti> {
  const prima = await pastoVivo(id);
  const righe = await tuttiIPasti(prima.user_id ?? "");
  const periodo = periodoDi(prima);
  if (normalizzaNome(nome) !== prima.nome) {
    controlla("nome", erroreNome(nome, periodo, righe, [prima.id]));
  }
  if (normalizzaOra(ora) !== normalizzaOra(prima.ora_inizio)) {
    controlla("ora", erroreOra(ora, periodo, righe, [prima.id], oggi));
  }

  await repositoryPasti.aggiorna(prima.id, {
    nome: normalizzaNome(nome),
    ora_inizio: normalizzaOra(ora),
    ...dateEsplicite(prima),
  });
  return { pastiPrima: [prima], idPastiCreati: [], vociDaRiportare: null };
}

export interface EsitoRinominaDaOggi {
  fotografia: FotografiaPasti;
  pastoNuovo: Pasto;
  vociSpostate: number;
}

// Da oggi (modello C), tutto in UNA transazione Dexie: o tutte le
// scritture, coda outbox compresa, o nessuna.
// 1. riga nuova: nome nuovo, ora (nuova o di prima), stesso `ordine`,
//    valido_dal = oggi, valido_al = quello della vecchia (oggi sempre null;
//    al passo 5 una fine già fissata passa alla riga che la prosegue);
// 2. le voci vive di oggi del pasto vecchio passano a quello nuovo, così il
//    pasto nuovo non nasce vuoto accanto a un doppione "Non più in uso";
// 3. la riga vecchia si chiude ieri, con l'ora nuova se è cambiata (l'ora
//    vale in ogni giorno del pasto, come nel cambio della sola ora).
// L'ordine con cui queste righe arrivano al server non dipende da qui: la
// coda manda sempre i pasti prima delle voci (ordinaOutbox, outbox.ts).
export async function rinominaDaOggi({
  id,
  nome,
  ora,
  oggi,
}: {
  id: string;
  nome: string;
  ora: string;
  oggi: string;
}): Promise<EsitoRinominaDaOggi> {
  return db.transaction("rw", [db.pasti, db.voci_diario, db.outbox], async () => {
    const vecchio = await pastoVivo(id);
    if (!pastoValidoIl(vecchio, oggi)) {
      throw new Error(`Il pasto ${id} oggi non vale: niente rinomina da oggi`);
    }
    if (domandaPerNome(vecchio, nome, oggi) !== "chiedi") {
      // Nome uguale, solo maiuscole, o pasto che comincia oggi: è una
      // correzione, non un cambio da oggi.
      throw new Error(`Il pasto ${id} non si rinomina da oggi: si corregge`);
    }

    const righe = await tuttiIPasti(vecchio.user_id ?? "");
    const periodoNuovo: Periodo = { dal: oggi, al: vecchio.valido_al ?? null };
    controlla("nome", erroreNome(nome, periodoNuovo, righe, [vecchio.id]));
    // L'ora vale per la vecchia (tutto il suo periodo) e per la nuova, che
    // sta dentro quel periodo: basta controllare quello.
    if (normalizzaOra(ora) !== normalizzaOra(vecchio.ora_inizio)) {
      controlla("ora", erroreOra(ora, periodoDi(vecchio), righe, [vecchio.id], oggi));
    }

    const pastoNuovo = await repositoryPasti.crea({
      user_id: vecchio.user_id,
      nome: normalizzaNome(nome),
      ora_inizio: normalizzaOra(ora),
      ordine: vecchio.ordine,
      valido_dal: oggi,
      valido_al: vecchio.valido_al ?? null,
    });

    const vociDiOggi = await vociVive(vecchio.id, oggi);
    for (const voce of vociDiOggi) {
      await repositoryVociDiario.aggiorna(voce.id, { pasto_id: pastoNuovo.id });
    }

    await repositoryPasti.aggiorna(vecchio.id, {
      ora_inizio: normalizzaOra(ora),
      valido_dal: vecchio.valido_dal ?? null,
      valido_al: giornoPrecedente(oggi),
    });

    return {
      fotografia: {
        pastiPrima: [vecchio],
        idPastiCreati: [pastoNuovo.id],
        vociDaRiportare: { daPastoId: pastoNuovo.id, aPastoId: vecchio.id, data: oggi },
      },
      pastoNuovo,
      vociSpostate: vociDiOggi.length,
    };
  });
}

// Un pasto nuovo: "Anche nei giorni passati" (valido_dal null, compare
// vuoto anche nei giorni già registrati) o "Da oggi".
export async function aggiungiPasto({
  userId,
  nome,
  ora,
  daOggi,
  oggi,
}: {
  userId: string;
  nome: string;
  ora: string;
  daOggi: boolean;
  oggi: string;
}): Promise<{ fotografia: FotografiaPasti; pasto: Pasto }> {
  const righe = await tuttiIPasti(userId);
  const periodo: Periodo = { dal: daOggi ? oggi : null, al: null };
  controlla("nome", erroreNome(nome, periodo, righe, []));
  controlla("ora", erroreOra(ora, periodo, righe, [], oggi));

  const pasto = await repositoryPasti.crea({
    user_id: userId,
    nome: normalizzaNome(nome),
    ora_inizio: normalizzaOra(ora),
    ordine: prossimoOrdine(righe),
    valido_dal: periodo.dal,
    valido_al: null,
  });
  return {
    fotografia: { pastiPrima: [], idPastiCreati: [pasto.id], vociDaRiportare: null },
    pasto,
  };
}

// Le voci vive di un pasto; con `data`, solo quelle di quel giorno.
async function vociVive(pastoId: string, data?: string): Promise<VoceDiario[]> {
  return db.voci_diario
    .where("pasto_id")
    .equals(pastoId)
    .filter((v) => v.deleted_at === null && (data === undefined || v.data === data))
    .toArray();
}

function stessiCampi(a: Pasto, b: Pasto): boolean {
  return (
    a.nome === b.nome &&
    normalizzaOra(a.ora_inizio) === normalizzaOra(b.ora_inizio) &&
    a.ordine === b.ordine &&
    (a.valido_dal ?? null) === (b.valido_dal ?? null) &&
    (a.valido_al ?? null) === (b.valido_al ?? null)
  );
}

export type EsitoAnnullaPasti =
  // Riscritto qualcosa.
  | "annullato"
  // Niente da fare: era già annullato (Annulla ripetuto).
  | "gia-annullato"
  // Un pasto creato dall'operazione ha nel frattempo delle voci che
  // l'Annulla non riporterebbe altrove: cancellarlo le lascerebbe sotto
  // "Non più in uso". Non si scrive niente.
  | "pasto-con-voci";

// Annulla, in una transazione:
// 1. le voci da riportare (solo "da oggi") tornano sul pasto vecchio;
// 2. i pasti creati si cancellano (deleted_at);
// 3. i pasti modificati tornano ai valori di prima, ma solo se sono ancora
//    vivi: una riga cancellata nel frattempo resta cancellata.
// Prima di scrivere si controlla il caso "pasto-con-voci": se c'è, niente.
export async function annullaModificaPasti(foto: FotografiaPasti): Promise<EsitoAnnullaPasti> {
  return db.transaction("rw", [db.pasti, db.voci_diario, db.outbox], async () => {
    const r = foto.vociDaRiportare;
    const daRiportare = r ? await vociVive(r.daPastoId, r.data) : [];
    const idRiportate = new Set(daRiportare.map((v) => v.id));

    for (const id of foto.idPastiCreati) {
      const rimaste = (await vociVive(id)).filter((v) => !idRiportate.has(v.id));
      if (rimaste.length > 0) return "pasto-con-voci";
    }

    let scritte = 0;
    if (r) {
      for (const voce of daRiportare) {
        await repositoryVociDiario.aggiorna(voce.id, { pasto_id: r.aPastoId });
        scritte++;
      }
    }
    for (const id of foto.idPastiCreati) {
      const creato = await repositoryPasti.ottieniPerId(id);
      if (!creato || creato.deleted_at !== null) continue;
      await repositoryPasti.elimina(id);
      scritte++;
    }
    for (const prima of foto.pastiPrima) {
      const attuale = await repositoryPasti.ottieniPerId(prima.id);
      if (!attuale || attuale.deleted_at !== null) continue;
      if (stessiCampi(attuale, prima)) continue;
      await repositoryPasti.aggiorna(prima.id, {
        nome: prima.nome,
        ora_inizio: prima.ora_inizio,
        ordine: prima.ordine,
        ...dateEsplicite(prima),
      });
      scritte++;
    }
    return scritte > 0 ? "annullato" : "gia-annullato";
  });
}
