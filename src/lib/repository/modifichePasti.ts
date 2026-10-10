// Le scritture della pagina Impostazioni > Pasti e orari, e il loro Annulla
// (PUNTO_DI_PARTENZA.md, sezione 3, "Pasti e orari" e "Date future e cambi
// programmati"):
// - correggiPasto: nome e/o ora sulla stessa riga, quindi in ogni giorno
//   di quella riga, passati compresi. È anche "Subito" per la sola ora;
// - cambiaDal: nome e/o ora nuovi DA UN GIORNO (oggi o una data futura),
//   il modello C (sezione 4, "pasti"). La riga valida quel giorno si chiude
//   il giorno prima, ne nasce una nuova dello stesso filo, e le voci da quel
//   giorno in poi passano a quella nuova. rinominaDaOggi è il caso "oggi";
// - aggiungiPasto: una riga nuova, da sempre, da oggi o da una data;
// - eliminaPasto: anche nei giorni passati, da oggi o da una data;
// - annullaCambioProgrammato: l'Annulla dalle schede per data.
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
// Ogni operazione restituisce una FOTOGRAFIA per l'Annulla della barra,
// come le voci di diario (vociDiario.ts): le righe di `pasti` com'erano
// prima, gli id delle righe create e, per un cambio da un giorno, quali
// voci riportare indietro. L'Annulla scrive solo in avanti e non rimette
// mai in vita una riga cancellata (stesso motivo di vociDiario.ts: la
// discesa fa vincere sempre una cancellazione arrivata dal server).

import { db } from "../db/database";
import type { Pasto, VoceDiario } from "../db/tipi";
import { v5 as uuidv5 } from "uuid";
import { giornoPrecedente, oggiLocale } from "../dataGiorno";
import { totaleVoce } from "../totaliDiario";
import { pastoValidoIl } from "../pasti/validitaPasti";
import {
  chiaveNome,
  domandaPerNome,
  erroreNome,
  erroreOra,
  iniziaOggiODopo,
  normalizzaNome,
  normalizzaOra,
  periodoDi,
  prossimoOrdine,
  regoleElimina,
  righeDaTagliare,
  type Periodo,
} from "../pasti/controlliPasti";
import {
  cambiProgrammati,
  filoDi,
  idCambio,
  limitiDaUnaData,
  type CambioProgrammato,
} from "../pasti/cambiProgrammati";
import { repositoryPasti, repositoryVociDiario } from "./index";
import { tuttiIPasti } from "./pasti";
import { annullaOperazione } from "./vociDiario";

export interface FotografiaPasti {
  // Le righe di `pasti` come erano PRIMA (copie intere).
  pastiPrima: Pasto[];
  // Le righe di `pasti` create dall'operazione.
  idPastiCreati: string[];
  // Solo per un cambio da un giorno: le voci dal giorno `dal` in poi che
  // stanno su `daPastoId` tornano su `aPastoId`. Si rileggono al momento
  // dell'Annulla, non si prende un elenco fisso: così torna indietro anche
  // una voce aggiunta nel frattempo al pasto nuovo (da un'altra scheda o
  // un altro dispositivo), in qualunque giorno. Vive solo in memoria, nella
  // barra dell'Annulla: non si salva da nessuna parte.
  vociDaRiportare: { daPastoId: string; aPastoId: string; dal: string } | null;
  // Solo per Elimina pasto: il pasto com'era, come è stato eliminato, le
  // voci eliminate com'erano (copie intere), le righe toccate com'erano
  // (il pasto e i suoi cambi programmati, passo 5) e il giorno del taglio
  // (null per "anche nei giorni passati").
  eliminazione?: { pasto: Pasto; modo: ModoElimina; voci: VoceDiario[]; toccate: Pasto[]; dal: string | null };
}

// "tutto": anche nei giorni passati (e il pasto che comincia oggi o dopo);
// "oggi": da oggi, i giorni passati restano;
// "data": da una data futura (passo 5), fino al giorno prima resta.
export type ModoElimina = "tutto" | "oggi" | "data";

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

// "Da una data" (passo 5) vale per questo pasto? Una data vera, dopo oggi
// e dentro i limiti di cambiProgrammati.ts (fino al prossimo cambio già
// programmato). Un pasto nato oggi o dopo non ha "da una data": si
// corregge, o si elimina del tutto. La pagina offre solo date valide; qui
// si ricontrolla prima di scrivere, come la data di Duplica.
function controllaDaUnaData(pasto: Pasto, righe: Pasto[], dal: string, oggi: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dal)) throw new Error(`Data non valida: ${dal}`);
  if (iniziaOggiODopo(pasto, oggi)) throw new Error(`Il pasto ${pasto.id} comincia oggi o dopo: niente "da una data"`);
  const limiti = limitiDaUnaData(pasto, righe, oggi);
  if (!limiti.disponibile || dal < limiti.min || (limiti.max !== null && dal > limiti.max)) {
    throw new Error(`Il ${dal} è fuori dai giorni possibili per ${pasto.id}`);
  }
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

export interface EsitoCambiaDal {
  fotografia: FotografiaPasti;
  // La riga che vale dal giorno scelto: quella nuova, o quella corretta se
  // il giorno era già un cambio programmato.
  pastoNuovo: Pasto;
  vociSpostate: number;
}
export type EsitoRinominaDaOggi = EsitoCambiaDal;

// Nome e/o ora nuovi DAL GIORNO `dal` (oggi, o una data futura), tutto in
// UNA transazione Dexie: o tutte le scritture, coda outbox compresa, o
// nessuna. `id` è il pasto toccato nella pagina (la riga valida oggi); il
// cambio vale sulla riga del suo filo valida il giorno `dal`:
// - se quella riga comincia proprio quel giorno, è un cambio già
//   programmato per quella data: si corregge quella riga (la stessa data
//   modifica il cambio, non ne aggiunge un altro);
// - altrimenti: riga nuova dello stesso filo (nome e ora nuovi, stesso
//   `ordine`, da `dal` alla vecchia fine), le voci vive della riga vecchia
//   da `dal` in poi passano a quella nuova (niente pasto nuovo vuoto accanto
//   a un "Non più in uso"), e la riga vecchia si chiude il giorno prima
//   TENENDO la sua ora: l'orario segue la data, come il nome (deciso il
//   10/10: "Pranzo" alle 12:30 fino al 12, "Pranzo 1" alle 14:30 dal 13).
// Da oggi serve un nome davvero diverso (domandaPerNome: per la sola ora
// "da oggi" c'è "Subito", cioè correggiPasto). Da una data basta che cambi
// il nome o l'ora.
// L'ordine con cui queste righe arrivano al server non dipende da qui: la
// coda manda sempre i pasti prima delle voci (ordinaOutbox, outbox.ts).
export async function cambiaDal({
  id,
  nome,
  ora,
  dal,
  oggi,
}: {
  id: string;
  nome: string;
  ora: string;
  dal: string;
  oggi: string;
}): Promise<EsitoCambiaDal> {
  return db.transaction("rw", [db.pasti, db.voci_diario, db.outbox], async () => {
    const pasto = await pastoVivo(id);
    if (!pastoValidoIl(pasto, oggi)) {
      throw new Error(`Il pasto ${id} oggi non vale: niente cambio da un giorno`);
    }
    const righe = await tuttiIPasti(pasto.user_id ?? "");
    if (dal === oggi) {
      if (domandaPerNome(pasto, nome, oggi) !== "chiedi") {
        // Nome uguale, solo maiuscole, o pasto che comincia oggi: è una
        // correzione, non un cambio da oggi.
        throw new Error(`Il pasto ${id} non si rinomina da oggi: si corregge`);
      }
    } else {
      controllaDaUnaData(pasto, righe, dal, oggi);
    }

    const riga = filoDi(pasto, righe).find((r) => pastoValidoIl(r, dal));
    if (!riga) throw new Error(`Il ${dal} il pasto ${id} non c'è`);
    const nomeNuovo = normalizzaNome(nome);
    const oraNuova = normalizzaOra(ora);
    const cambiaNome = nomeNuovo !== riga.nome;
    const cambiaOra = oraNuova !== normalizzaOra(riga.ora_inizio);
    if (!cambiaNome && !cambiaOra) throw new Error(`Niente da cambiare per ${id} dal ${dal}`);

    // Stessa data di un cambio già programmato: si corregge quella riga.
    if ((riga.valido_dal ?? null) === dal) {
      const periodo = periodoDi(riga);
      if (cambiaNome) controlla("nome", erroreNome(nome, periodo, righe, [riga.id]));
      if (cambiaOra) controlla("ora", erroreOra(ora, periodo, righe, [riga.id], oggi));
      const corretta = await repositoryPasti.aggiorna(riga.id, {
        nome: nomeNuovo,
        ora_inizio: oraNuova,
        ...dateEsplicite(riga),
      });
      return {
        fotografia: { pastiPrima: [riga], idPastiCreati: [], vociDaRiportare: null },
        pastoNuovo: corretta,
        vociSpostate: 0,
      };
    }

    // Da `dal` un taglio senza cambiare niente di quello che conta non ha
    // senso: serve un nome davvero diverso o un'ora diversa (le maiuscole
    // da sole si correggono, non si programmano).
    if (chiaveNome(nomeNuovo) === chiaveNome(riga.nome) && !cambiaOra) {
      throw new Error(`Il pasto ${id} non cambia davvero dal ${dal}: si corregge`);
    }
    const periodoNuovo: Periodo = { dal, al: riga.valido_al ?? null };
    controlla("nome", erroreNome(nome, periodoNuovo, righe, [riga.id]));
    if (cambiaOra) controlla("ora", erroreOra(ora, periodoNuovo, righe, [riga.id], oggi));

    const pastoNuovo = await repositoryPasti.crea({
      user_id: riga.user_id,
      nome: nomeNuovo,
      ora_inizio: oraNuova,
      ordine: riga.ordine,
      valido_dal: dal,
      valido_al: riga.valido_al ?? null,
    });

    const vociDaSpostare = await vociVive(riga.id, dal);
    for (const voce of vociDaSpostare) {
      await repositoryVociDiario.aggiorna(voce.id, { pasto_id: pastoNuovo.id });
    }

    await repositoryPasti.aggiorna(riga.id, {
      valido_dal: riga.valido_dal ?? null,
      valido_al: giornoPrecedente(dal),
    });

    return {
      fotografia: {
        pastiPrima: [riga],
        idPastiCreati: [pastoNuovo.id],
        vociDaRiportare: { daPastoId: pastoNuovo.id, aPastoId: riga.id, dal },
      },
      pastoNuovo,
      vociSpostate: vociDaSpostare.length,
    };
  });
}

// Il nome nuovo da oggi: cambiaDal con il giorno di oggi.
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
  return cambiaDal({ id, nome, ora, dal: oggi, oggi });
}

// Un pasto nuovo: "Anche nei giorni passati" (`dal` null, compare vuoto
// anche nei giorni già registrati), "Da oggi" (`dal` = oggi) o "Da una
// data" (`dal` futuro, passo 5: compare da quel giorno). Non tocca voci.
export async function aggiungiPasto({
  userId,
  nome,
  ora,
  dal,
  oggi,
}: {
  userId: string;
  nome: string;
  ora: string;
  dal: string | null;
  oggi: string;
}): Promise<{ fotografia: FotografiaPasti; pasto: Pasto }> {
  if (dal !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(dal) || dal < oggi)) {
    throw new Error(`Un pasto nuovo comincia da sempre, da oggi o da una data futura, non il ${dal}`);
  }
  const righe = await tuttiIPasti(userId);
  const periodo: Periodo = { dal, al: null };
  controlla("nome", erroreNome(nome, periodo, righe, []));
  controlla("ora", erroreOra(ora, periodo, righe, [], oggi));

  const pasto = await repositoryPasti.crea({
    user_id: userId,
    nome: normalizzaNome(nome),
    ora_inizio: normalizzaOra(ora),
    ordine: prossimoOrdine(righe),
    valido_dal: dal,
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
  // Rimettere un pasto si scontrerebbe con un pasto nato nel frattempo
  // (stesso nome o stessa ora), o il pasto non c'è più. Non si scrive
  // niente; `conflitto` va nella barra.
  | { conflitto: string };

// Annulla della barra, in una transazione:
// 1. le voci da riportare (solo per un cambio da un giorno) tornano sul
//    pasto vecchio;
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
// Elimina pasto (passo 4 e 5, PUNTO_DI_PARTENZA.md sezione 3, "Pasti e
// orari").
//
// Le voci del pasto si ELIMINANO, non si spostano (decisione del 9/10).
// L'eliminazione tocca il pasto e i suoi cambi programmati (le righe future
// del suo filo, righeDaTagliare): senza, il pasto ricomparirebbe il giorno
// del cambio.
// - "tutto" (anche nei giorni passati, e il pasto che comincia oggi o
//   dopo): deleted_at sulle righe toccate e su tutte le loro voci vive;
// - "oggi" e "data": un TAGLIO del filo al giorno D (oggi o la data). La
//   riga che contiene il giorno prima si chiude lì, le righe che cominciano
//   da D in poi si cancellano, e le loro voci vive da D in poi si
//   cancellano col SEGNO del cambio (`eliminata_dal_cambio` = idCambio
//   della riga chiusa e di D), che serve all'Annulla dalla scheda. I giorni
//   prima di D non si toccano.
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

// Il giorno da cui l'eliminazione taglia: null per "tutto".
function giornoDelTaglio(modo: ModoElimina, oggi: string, dal: string | undefined): string | null {
  if (modo === "tutto") return null;
  if (modo === "oggi") return oggi;
  if (!dal) throw new Error(`Elimina da una data senza la data`);
  return dal;
}

// Le voci vive delle righe toccate; con `taglio`, da quel giorno in poi.
async function vociDelleRighe(righe: Pasto[], taglio: string | null): Promise<VoceDiario[]> {
  const voci: VoceDiario[] = [];
  for (const r of righe) voci.push(...(await vociVive(r.id, taglio ?? undefined)));
  return voci;
}

// Le voci che un'eliminazione cancellerebbe, lette da Dexie adesso: tutte,
// da oggi in poi o dalla data in poi, del pasto e dei suoi cambi
// programmati. Lo stesso calcolo di eliminaPasto, così la conferma e la
// scrittura parlano delle stesse voci.
export async function vociDaEliminare(
  pastoId: string,
  modo: ModoElimina,
  oggi: string,
  dal?: string
): Promise<VoceDiario[]> {
  const pasto = await repositoryPasti.ottieniPerId(pastoId);
  if (!pasto || pasto.deleted_at !== null) return [];
  const toccate = righeDaTagliare(pasto, await tuttiIPasti(pasto.user_id ?? ""), oggi);
  return vociDelleRighe(toccate, giornoDelTaglio(modo, oggi, dal));
}

export type EsitoEliminaPasto =
  // Le voci vive non sono più quelle confermate (una sync ne ha portata una
  // nuova, o ne ha cancellata una): niente scritto. La pagina rimostra la
  // conferma con questi numeri.
  | { esito: "cambiate"; idVoci: string[]; riepilogo: RiepilogoVoci }
  | { esito: "fatto"; fotografia: FotografiaPasti; riepilogo: RiepilogoVoci };

// `idVociConfermate`: le voci che l'utente ha visto nella conferma (vuoto
// se non c'era conferma perché non c'erano voci). `dal`: solo per "data".
// Tutto in una transazione: pasti, voci e coda outbox, o niente.
export async function eliminaPasto({
  id,
  modo,
  oggi,
  dal,
  idVociConfermate,
}: {
  id: string;
  modo: ModoElimina;
  oggi: string;
  dal?: string;
  idVociConfermate: string[];
}): Promise<EsitoEliminaPasto> {
  return db.transaction("rw", [db.pasti, db.voci_diario, db.outbox], async () => {
    const pasto = await pastoVivo(id);
    const righe = await tuttiIPasti(pasto.user_id ?? "");
    const regole = regoleElimina(pasto, righe, oggi);
    if (regole.motivoSpento) throw new Error(`Elimina ${id}: ${regole.motivoSpento}`);
    if (modo === "tutto" && regole.motivoPassatiSpento) throw new Error(`Elimina ${id}: ${regole.motivoPassatiSpento}`);
    if (modo === "oggi" && regole.senzaDomanda) {
      throw new Error(`Il pasto ${id} comincia oggi: si elimina del tutto, non da oggi`);
    }
    const taglio = giornoDelTaglio(modo, oggi, dal);
    if (modo === "data") controllaDaUnaData(pasto, righe, taglio as string, oggi);

    const toccate = righeDaTagliare(pasto, righe, oggi);
    const voci = await vociDelleRighe(toccate, taglio);
    const riepilogo = riepilogoVoci(voci);
    const confermate = new Set(idVociConfermate);
    if (voci.length !== confermate.size || voci.some((v) => !confermate.has(v.id))) {
      return { esito: "cambiate", idVoci: voci.map((v) => v.id), riepilogo };
    }

    if (taglio === null) {
      for (const voce of voci) await repositoryVociDiario.elimina(voce.id);
      for (const r of toccate) await repositoryPasti.elimina(r.id);
    } else {
      const giornoPrima = giornoPrecedente(taglio);
      const chiusa = toccate.find((r) => pastoValidoIl(r, giornoPrima));
      if (!chiusa) throw new Error(`Il ${giornoPrima} il pasto ${id} non c'è: niente da tagliare`);
      const segno = idCambio(chiusa.id, taglio);
      const adesso = new Date().toISOString();
      for (const voce of voci) {
        await repositoryVociDiario.aggiorna(voce.id, { deleted_at: adesso, eliminata_dal_cambio: segno });
      }
      for (const r of toccate) {
        const inizio = r.valido_dal ?? null;
        const fine = r.valido_al ?? null;
        if (inizio !== null && inizio >= taglio) {
          await repositoryPasti.elimina(r.id);
        } else if (fine === null || fine >= taglio) {
          await repositoryPasti.aggiorna(r.id, { valido_dal: inizio, valido_al: giornoPrima });
        }
      }
    }

    return {
      esito: "fatto",
      riepilogo,
      fotografia: {
        pastiPrima: [],
        idPastiCreati: [],
        vociDaRiportare: null,
        eliminazione: { pasto, modo, voci, toccate, dal: taglio },
      },
    };
  });
}

// Namespace fisso per l'id del pasto RICREATO dall'Annulla di "Elimina
// pasto" (UUID v5 dall'id del pasto eliminato). Generato una volta a caso:
// non deve coincidere con quelli dei pasti predefiniti, dei giorni o delle
// voci ricreate. Deterministico, così un Annulla ripetuto (o riprovato dopo
// un guasto) trova il pasto già ricreato invece di farne un secondo.
const NAMESPACE_RIPRISTINO_PASTI = "35031c14-156b-4219-8091-1d6e853e448a";

export function idPastoRicreato(idOriginale: string): string {
  return uuidv5(idOriginale, NAMESPACE_RIPRISTINO_PASTI);
}

// "Alle 12:30 inizia già Brunch." → "Non annullato: alle 12:30 inizia già Brunch."
function nonAnnullato(motivo: string): { conflitto: string } {
  return { conflitto: `Non annullato: ${motivo.charAt(0).toLowerCase()}${motivo.slice(1)}` };
}

// Il motivo per cui una riga con questo nome, ora e periodo si
// scontrerebbe con `altri` (le righe che restano), o null.
function motivoConflitto(nome: string, ora: string, periodo: Periodo, altri: Pasto[]): string | null {
  if (erroreNome(nome, periodo, altri, [])) return `c'è già un pasto chiamato «${nome}».`;
  return erroreOra(ora, periodo, altri, [], oggiLocale());
}

// L'Annulla di Elimina pasto, dentro la transazione di annullaModificaPasti.
// Mai una riga rimessa in vita:
// - le righe CANCELLATE dall'eliminazione ("tutto": tutte quelle toccate;
//   un taglio: quelle che cominciavano dal giorno del taglio) si RICREANO
//   con un id nuovo (idPastoRicreato) e gli stessi nome, ora, ordine e date;
// - le righe CHIUSE dal taglio, ancora vive, riprendono le loro date;
// - le voci si ricreano come nel diario (annullaOperazione, id v5), sulla
//   riga ricreata se la loro era stata cancellata.
// Prima di scrivere si rifanno i controlli di nome e ora sui periodi che
// le righe riavranno: un pasto nato nel frattempo con lo stesso nome o la
// stessa ora fa rispondere "conflitto", senza scrivere niente.
async function annullaEliminazione(el: NonNullable<FotografiaPasti["eliminazione"]>): Promise<EsitoAnnullaPasti> {
  const { modo, voci, toccate, dal } = el;
  const righe = await tuttiIPasti(el.pasto.user_id ?? "");
  const nostre = new Set(toccate.flatMap((r) => [r.id, idPastoRicreato(r.id)]));
  const altri = righe.filter((r) => !nostre.has(r.id));
  const cancellate = toccate.filter(
    (r) => modo === "tutto" || (dal !== null && (r.valido_dal ?? null) !== null && (r.valido_dal as string) >= dal)
  );
  const chiuse = toccate.filter((r) => !cancellate.includes(r));

  // 1. I controlli, tutti prima di scrivere.
  for (const r of cancellate) {
    if (await repositoryPasti.ottieniPerId(idPastoRicreato(r.id))) continue;
    const motivo = motivoConflitto(r.nome, r.ora_inizio, periodoDi(r), altri);
    if (motivo) return nonAnnullato(motivo);
  }
  for (const r of chiuse) {
    const attuale = await repositoryPasti.ottieniPerId(r.id);
    if (!attuale || attuale.deleted_at !== null) return nonAnnullato(`«${r.nome}» non c'è più.`);
    if ((attuale.valido_al ?? null) === (r.valido_al ?? null)) continue;
    const motivo = motivoConflitto(attuale.nome, attuale.ora_inizio, periodoDi(r), altri);
    if (motivo) return nonAnnullato(motivo);
  }

  // 2. Le scritture.
  let scritte = 0;
  const pastiSostituiti: Record<string, string> = {};
  for (const r of cancellate) {
    const idNuovo = idPastoRicreato(r.id);
    pastiSostituiti[r.id] = idNuovo;
    if (await repositoryPasti.ottieniPerId(idNuovo)) continue;
    await repositoryPasti.crea(
      { user_id: r.user_id, nome: r.nome, ora_inizio: r.ora_inizio, ordine: r.ordine, ...dateEsplicite(r) },
      idNuovo
    );
    scritte++;
  }
  for (const r of chiuse) {
    const attuale = (await repositoryPasti.ottieniPerId(r.id)) as Pasto;
    if ((attuale.valido_al ?? null) === (r.valido_al ?? null)) continue;
    await repositoryPasti.aggiorna(r.id, { ...dateEsplicite(r) });
    scritte++;
  }
  scritte += await annullaOperazione({ prima: voci, idCreate: [] }, { pastiSostituiti });
  return scritte > 0 ? "annullato" : "gia-annullato";
}

// ---------------------------------------------------------------------------
// Annulla dalla scheda di una data (passo 5): un cambio programmato
// riconosciuto dalle righe (cambiProgrammati.ts), non dalla fotografia della
// barra, quindi anche giorni dopo o dopo un riavvio. In una transazione, e
// con i controlli di nome e ora prima di scrivere:
// - nuovo: la riga si cancella, ma non se ha già delle voci;
// - rinomina o orario: la riga vecchia riprende la fine di quella nuova
//   (così un'eliminazione programmata più avanti resta), le voci della
//   nuova tornano sulla vecchia, la nuova si cancella;
// - elimina: la riga si riapre (fino al prossimo pezzo del filo, se c'è,
//   altrimenti senza fine) e tornano le voci col segno di quel cambio,
//   cercate in TUTTO il filo, righe cancellate comprese (un taglio può aver
//   cancellato anche una rinomina programmata, con le sue voci): si
//   ricreano sulla riga riaperta, anche se il loro giorno è passato. Una
//   voce già ricreata (o tornata viva da un altro telefono) si salta.
// Le righe del filo cancellate dal taglio non tornano.
export interface EsitoAnnullaCambio {
  esito: EsitoAnnullaPasti;
  // Le voci rimesse (solo per elimina), per la barra.
  vociRimesse: number;
}

// Le voci cancellate da un "Elimina da una data" (riga `vecchia`, dal
// giorno `data`): quelle col segno di quel cambio, sulle righe `idFilo`.
async function vociSegnate(vecchia: Pasto, data: string, idFilo: string[]): Promise<VoceDiario[]> {
  const segno = idCambio(vecchia.id, data);
  return db.voci_diario
    .where("pasto_id")
    .anyOf(idFilo)
    .filter((v) => v.deleted_at !== null && (v.eliminata_dal_cambio ?? null) === segno)
    .toArray();
}

// Le stesse voci, per la scheda di quella data ("Pranzo non ci sarà più —
// 4 voci eliminate"): sono quelle che il suo Annulla rimette. Sola lettura.
export async function vociEliminateDalCambio(cambio: CambioProgrammato): Promise<VoceDiario[]> {
  if (cambio.tipo !== "elimina" || !cambio.vecchia) return [];
  const righe = await tuttiIPasti(cambio.vecchia.user_id ?? "");
  const idFilo = filoDi(cambio.vecchia, righe, { cancellate: true }).map((r) => r.id);
  return vociSegnate(cambio.vecchia, cambio.data, idFilo);
}

function stessoCambio(a: CambioProgrammato, b: CambioProgrammato): boolean {
  return a.tipo === b.tipo && a.data === b.data && a.vecchia?.id === b.vecchia?.id && a.nuova?.id === b.nuova?.id;
}

export async function annullaCambioProgrammato({
  cambio,
  oggi,
}: {
  cambio: CambioProgrammato;
  oggi: string;
}): Promise<EsitoAnnullaCambio> {
  return db.transaction("rw", [db.pasti, db.voci_diario, db.outbox], async () => {
    const userId = (cambio.vecchia ?? cambio.nuova)?.user_id ?? "";
    const righe = await tuttiIPasti(userId);
    const attuale = cambiProgrammati(righe, oggi).find((c) => stessoCambio(c, cambio));
    if (!attuale) return { esito: "gia-annullato", vociRimesse: 0 };

    if (attuale.tipo === "nuovo") {
      const nuova = attuale.nuova as Pasto;
      if ((await vociVive(nuova.id)).length > 0) return { esito: "pasto-con-voci", vociRimesse: 0 };
      await repositoryPasti.elimina(nuova.id);
      return { esito: "annullato", vociRimesse: 0 };
    }

    const vecchia = attuale.vecchia as Pasto;
    if (attuale.tipo === "rinomina" || attuale.tipo === "orario") {
      const nuova = attuale.nuova as Pasto;
      const periodo: Periodo = { dal: vecchia.valido_dal ?? null, al: nuova.valido_al ?? null };
      const altri = righe.filter((r) => r.id !== vecchia.id && r.id !== nuova.id);
      const motivo = motivoConflitto(vecchia.nome, vecchia.ora_inizio, periodo, altri);
      if (motivo) return { esito: nonAnnullato(motivo), vociRimesse: 0 };
      for (const voce of await vociVive(nuova.id)) {
        await repositoryVociDiario.aggiorna(voce.id, { pasto_id: vecchia.id });
      }
      await repositoryPasti.elimina(nuova.id);
      await repositoryPasti.aggiorna(vecchia.id, { ...dateEsplicite(vecchia), valido_al: periodo.al });
      return { esito: "annullato", vociRimesse: 0 };
    }

    // elimina
    const filo = filoDi(vecchia, righe, { cancellate: true });
    const dopo = filoDi(vecchia, righe)
      .map((r) => r.valido_dal ?? null)
      .filter((d): d is string => d !== null && d > attuale.data)
      .sort();
    const fine = dopo.length > 0 ? giornoPrecedente(dopo[0]) : null;
    const altri = righe.filter((r) => r.id !== vecchia.id);
    const motivo = motivoConflitto(vecchia.nome, vecchia.ora_inizio, { dal: vecchia.valido_dal ?? null, al: fine }, altri);
    if (motivo) return { esito: nonAnnullato(motivo), vociRimesse: 0 };

    const idFilo = filo.map((r) => r.id);
    const segnate = await vociSegnate(vecchia, attuale.data, idFilo);
    await repositoryPasti.aggiorna(vecchia.id, { ...dateEsplicite(vecchia), valido_al: fine });
    const pastiSostituiti = Object.fromEntries(idFilo.filter((id) => id !== vecchia.id).map((id) => [id, vecchia.id]));
    const vociRimesse = await annullaOperazione({ prima: segnate, idCreate: [] }, { pastiSostituiti });
    return { esito: "annullato", vociRimesse };
  });
}
