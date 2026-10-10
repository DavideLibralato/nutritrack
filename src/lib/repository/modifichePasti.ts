// Le scritture della pagina Impostazioni > Pasti e orari, e il loro Annulla
// (PUNTO_DI_PARTENZA.md, sezione 3, "Pasti e orari"):
// - correggiPasto: nome e/o ora sulla stessa riga, quindi in ogni giorno
//   del pasto, passati compresi. È anche il cambio della sola ora;
// - rinominaDaOggi: il modello C (sezione 4, "pasti"). La riga vecchia si
//   chiude ieri, ne nasce una nuova da oggi, e le voci da oggi in poi
//   (il diario arriva fino a oggi + 7) passano a quella nuova;
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
import { v5 as uuidv5 } from "uuid";
import { giornoPrecedente, oggiLocale } from "../dataGiorno";
import { totaleVoce } from "../totaliDiario";
import { pastoValidoIl } from "../pasti/validitaPasti";
import {
  domandaPerNome,
  erroreNome,
  erroreOra,
  normalizzaNome,
  normalizzaOra,
  periodoDi,
  prossimoOrdine,
  regoleElimina,
  type Periodo,
} from "../pasti/controlliPasti";
import { repositoryPasti, repositoryVociDiario } from "./index";
import { tuttiIPasti } from "./pasti";
import { annullaOperazione } from "./vociDiario";

export interface FotografiaPasti {
  // Le righe di `pasti` come erano PRIMA (copie intere).
  pastiPrima: Pasto[];
  // Le righe di `pasti` create dall'operazione.
  idPastiCreati: string[];
  // Solo per "da oggi": le voci dal giorno `dal` in poi che stanno su
  // `daPastoId` tornano su `aPastoId`. Si rileggono al momento
  // dell'Annulla, non si prende un elenco fisso: così torna indietro anche
  // una voce aggiunta nel frattempo al pasto nuovo (da un'altra scheda o
  // un altro dispositivo), in qualunque giorno. Vive solo in memoria, nella
  // barra dell'Annulla: non si salva da nessuna parte.
  vociDaRiportare: { daPastoId: string; aPastoId: string; dal: string } | null;
  // Solo per Elimina pasto (passo 4): il pasto com'era, come è stato
  // eliminato, e le voci eliminate com'erano (copie intere).
  eliminazione?: { pasto: Pasto; modo: ModoElimina; voci: VoceDiario[] };
}

// "tutto": anche nei giorni passati (e il pasto che comincia oggi o dopo);
// "oggi": da oggi, i giorni passati restano.
export type ModoElimina = "tutto" | "oggi";

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
// 2. le voci vive del pasto vecchio da oggi in poi passano a quello nuovo,
//    così il pasto nuovo non nasce vuoto accanto a un doppione "Non più in
//    uso" — né oggi, né nei giorni futuri già pianificati;
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

    const vociDaOggi = await vociVive(vecchio.id, oggi);
    for (const voce of vociDaOggi) {
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
        vociDaRiportare: { daPastoId: pastoNuovo.id, aPastoId: vecchio.id, dal: oggi },
      },
      pastoNuovo,
      vociSpostate: vociDaOggi.length,
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

// Le voci vive di un pasto; con `dal`, solo quelle da quel giorno in poi.
// "In poi", non "di quel giorno": il diario arriva fino a oggi + 7, e una
// modifica "da oggi" vale anche per i giorni già pianificati.
async function vociVive(pastoId: string, dal?: string): Promise<VoceDiario[]> {
  return db.voci_diario
    .where("pasto_id")
    .equals(pastoId)
    .filter((v) => v.deleted_at === null && (dal === undefined || v.data >= dal))
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
  | "pasto-con-voci"
  // Solo per Elimina pasto: rimettere il pasto si scontrerebbe con un
  // pasto nato nel frattempo (stesso nome o stessa ora), o il pasto non
  // c'è più. Non si scrive niente; `messaggio` va nella barra.
  | { conflitto: string };

// Annulla, in una transazione:
// 1. le voci da riportare (solo "da oggi") tornano sul pasto vecchio;
// 2. i pasti creati si cancellano (deleted_at);
// 3. i pasti modificati tornano ai valori di prima, ma solo se sono ancora
//    vivi: una riga cancellata nel frattempo resta cancellata.
// Prima di scrivere si controlla il caso "pasto-con-voci": se c'è, niente.
// L'Annulla di Elimina pasto ha regole sue (annullaEliminazione, sotto).
export async function annullaModificaPasti(foto: FotografiaPasti): Promise<EsitoAnnullaPasti> {
  return db.transaction("rw", [db.pasti, db.voci_diario, db.outbox], async () => {
    if (foto.eliminazione) return annullaEliminazione(foto.eliminazione);
    const r = foto.vociDaRiportare;
    const daRiportare = r ? await vociVive(r.daPastoId, r.dal) : [];
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

// ---------------------------------------------------------------------------
// Elimina pasto (passo 4, PUNTO_DI_PARTENZA.md sezione 3, "Pasti e orari").
//
// Le voci del pasto si ELIMINANO, non si spostano (decisione del 9/10):
// - "tutto" (anche nei giorni passati, e il pasto che comincia oggi o
//   dopo): deleted_at sul pasto e su tutte le sue voci vive;
// - "oggi": valido_al = ieri sul pasto, deleted_at sulle sue voci vive da
//   oggi in poi (anche i giorni futuri già pianificati: il diario arriva
//   fino a oggi + 7). I giorni passati non si toccano.
// La tabella `giorni` non si tocca mai.

// Quante voci, in quanti giorni, per quante kcal: i numeri della conferma
// e della barra. Le kcal con totaleVoce, la stessa funzione dei totali di
// Oggi: le voci hanno i valori copiati, niente da ricalcolare.
export interface RiepilogoVoci {
  voci: number;
  giorni: number;
  kcal: number;
}

export function riepilogoVoci(voci: VoceDiario[]): RiepilogoVoci {
  return {
    voci: voci.length,
    giorni: new Set(voci.map((v) => v.data)).size,
    kcal: voci.reduce((somma, v) => somma + totaleVoce(v).kcal, 0),
  };
}

// Le voci che un'eliminazione cancellerebbe, lette da Dexie adesso: tutte,
// o da oggi in poi.
export async function vociDaEliminare(pastoId: string, modo: ModoElimina, oggi: string): Promise<VoceDiario[]> {
  return vociVive(pastoId, modo === "oggi" ? oggi : undefined);
}

export type EsitoEliminaPasto =
  // Le voci vive non sono più quelle confermate (una sync ne ha portata una
  // nuova, o ne ha cancellata una): niente scritto. La pagina rimostra la
  // conferma con questi numeri.
  | { esito: "cambiate"; idVoci: string[]; riepilogo: RiepilogoVoci }
  | { esito: "fatto"; fotografia: FotografiaPasti; riepilogo: RiepilogoVoci };

// `idVociConfermate`: le voci che l'utente ha visto nella conferma (vuoto
// se non c'era conferma perché non c'erano voci). Tutto in una transazione:
// pasto, voci e coda outbox, o niente.
export async function eliminaPasto({
  id,
  modo,
  oggi,
  idVociConfermate,
}: {
  id: string;
  modo: ModoElimina;
  oggi: string;
  idVociConfermate: string[];
}): Promise<EsitoEliminaPasto> {
  return db.transaction("rw", [db.pasti, db.voci_diario, db.outbox], async () => {
    const pasto = await pastoVivo(id);
    const regole = regoleElimina(pasto, await tuttiIPasti(pasto.user_id ?? ""), oggi);
    if (regole.motivoSpento) throw new Error(`Elimina ${id}: ${regole.motivoSpento}`);
    if (modo === "tutto" && regole.motivoPassatiSpento) throw new Error(`Elimina ${id}: ${regole.motivoPassatiSpento}`);
    if (modo === "oggi" && regole.senzaDomanda) {
      throw new Error(`Il pasto ${id} comincia oggi: si elimina del tutto, non da oggi`);
    }

    const voci = await vociDaEliminare(pasto.id, modo, oggi);
    const riepilogo = riepilogoVoci(voci);
    const confermate = new Set(idVociConfermate);
    if (voci.length !== confermate.size || voci.some((v) => !confermate.has(v.id))) {
      return { esito: "cambiate", idVoci: voci.map((v) => v.id), riepilogo };
    }

    for (const voce of voci) await repositoryVociDiario.elimina(voce.id);
    if (modo === "tutto") {
      await repositoryPasti.elimina(pasto.id);
    } else {
      await repositoryPasti.aggiorna(pasto.id, { valido_dal: pasto.valido_dal ?? null, valido_al: giornoPrecedente(oggi) });
    }

    return {
      esito: "fatto",
      riepilogo,
      fotografia: { pastiPrima: [], idPastiCreati: [], vociDaRiportare: null, eliminazione: { pasto, modo, voci } },
    };
  });
}

// Namespace fisso per l'id del pasto RICREATO dall'Annulla di "Elimina
// pasto · anche nei giorni passati" (UUID v5 dall'id del pasto eliminato).
// Generato una volta a caso: non deve coincidere con quelli dei pasti
// predefiniti, dei giorni o delle voci ricreate. Deterministico, così un
// Annulla ripetuto (o riprovato dopo un guasto) trova il pasto già
// ricreato invece di farne un secondo.
const NAMESPACE_RIPRISTINO_PASTI = "35031c14-156b-4219-8091-1d6e853e448a";

export function idPastoRicreato(idOriginale: string): string {
  return uuidv5(idOriginale, NAMESPACE_RIPRISTINO_PASTI);
}

// "Alle 12:30 inizia già Brunch." → "Non annullato: alle 12:30 inizia già Brunch."
function nonAnnullato(motivo: string): { conflitto: string } {
  return { conflitto: `Non annullato: ${motivo.charAt(0).toLowerCase()}${motivo.slice(1)}` };
}

// L'Annulla di Elimina pasto, dentro la transazione di annullaModificaPasti.
// Mai una riga rimessa in vita:
// - "tutto": il pasto si RICREA con un id nuovo (idPastoRicreato) e gli
//   stessi nome, ora, ordine e date; le voci si ricreano come nel diario
//   (annullaOperazione, id v5), ma sul pasto nuovo;
// - "oggi": il pasto è ancora vivo, gli si rimette valido_al com'era; le
//   voci da oggi in poi si ricreano sullo stesso pasto.
// Prima di scrivere si rifanno i controlli di nome e ora sul periodo che il
// pasto riavrà: un pasto nato nel frattempo con lo stesso nome o la stessa
// ora fa rispondere "conflitto", senza scrivere niente.
async function annullaEliminazione(el: NonNullable<FotografiaPasti["eliminazione"]>): Promise<EsitoAnnullaPasti> {
  const { pasto, modo, voci } = el;
  const righe = await tuttiIPasti(pasto.user_id ?? "");
  const fotoVoci = { prima: voci, idCreate: [] };

  if (modo === "tutto") {
    const idNuovo = idPastoRicreato(pasto.id);
    let scritte = 0;
    if (!(await repositoryPasti.ottieniPerId(idNuovo))) {
      const periodo = periodoDi(pasto);
      const motivo =
        (erroreNome(pasto.nome, periodo, righe, [pasto.id]) ? `c'è già un pasto chiamato «${pasto.nome}».` : null) ??
        erroreOra(pasto.ora_inizio, periodo, righe, [pasto.id], oggiLocale());
      if (motivo) return nonAnnullato(motivo);
      await repositoryPasti.crea(
        {
          user_id: pasto.user_id,
          nome: pasto.nome,
          ora_inizio: pasto.ora_inizio,
          ordine: pasto.ordine,
          ...dateEsplicite(pasto),
        },
        idNuovo
      );
      scritte++;
    }
    scritte += await annullaOperazione(fotoVoci, { pastoSostituito: { da: pasto.id, a: idNuovo } });
    return scritte > 0 ? "annullato" : "gia-annullato";
  }

  const attuale = await repositoryPasti.ottieniPerId(pasto.id);
  if (!attuale || attuale.deleted_at !== null) return nonAnnullato(`«${pasto.nome}» non c'è più.`);
  let scritte = 0;
  if ((attuale.valido_al ?? null) !== (pasto.valido_al ?? null)) {
    const periodo = periodoDi(pasto);
    const motivo =
      (erroreNome(attuale.nome, periodo, righe, [pasto.id]) ? `c'è già un pasto chiamato «${attuale.nome}».` : null) ??
      erroreOra(attuale.ora_inizio, periodo, righe, [pasto.id], oggiLocale());
    if (motivo) return nonAnnullato(motivo);
    await repositoryPasti.aggiorna(pasto.id, { ...dateEsplicite(pasto) });
    scritte++;
  }
  scritte += await annullaOperazione(fotoVoci);
  return scritte > 0 ? "annullato" : "gia-annullato";
}
