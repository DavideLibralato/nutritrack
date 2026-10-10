// Le scritture di Pasti e orari e i loro Annulla (PUNTO_DI_PARTENZA.md,
// sezione 3, "Pasti e orari"): test permanenti. La rinomina "da oggi"
// tocca tre cose insieme (due righe di `pasti` e le voci da oggi in poi): un
// guasto a metà, o un Annulla che dimentica una voce, lascerebbe voci
// sotto un pasto "Non più in uso" senza che nessuno se ne accorga.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db/database";
import type { Pasto, VoceDiario } from "../db/tipi";
import { repositoryPasti, repositoryVociDiario } from "./index";
import { idVoceRicreata } from "./vociDiario";
import { ordinaOutbox } from "../sync/outbox";
import {
  aggiungiPasto,
  annullaModificaPasti,
  correggiPasto,
  eliminaPasto,
  ErroreControlloPasto,
  idPastoRicreato,
  rinominaDaOggi,
} from "./modifichePasti";

// Conta i tentativi di invio: con una sincronizzazione per volta, anche
// un'operazione con molte righe ne fa pochi (passo 4).
const invii = { conteggio: 0 };

// Server sempre irraggiungibile: le scritture restano nella coda outbox,
// dove i test le guardano.
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      upsert: async () => {
        invii.conteggio++;
        return { error: { message: "offline" } };
      },
    }),
  }),
}));

const USER = "utente-pasti-orari";
const OGGI = "2026-10-09";
const IERI = "2026-10-08";

function riga(id: string, nome: string, ora_inizio: string, altro: Partial<Pasto> = {}): Pasto {
  return {
    id, nome, ora_inizio, ordine: 2, user_id: USER,
    updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null, ...altro,
  };
}

function voce(id: string, pasto_id: string, data: string, altro: Partial<VoceDiario> = {}): VoceDiario {
  return {
    id, user_id: USER, updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null,
    alimento_id: "a1", pasto_id, gruppo_id: null, quantita_g: 100, data,
    creato_il: "2026-10-01T00:00:00.000Z", consumato_alle: null,
    nome_alimento: "Mela", kcal_100g: 52, proteine_100g: 0.3, carboidrati_100g: 14, grassi_100g: 0.2,
    ...altro,
  };
}

// Il pranzo "di sempre", salvato prima di Dexie version(6): senza le chiavi
// valido_dal / valido_al.
const PRANZO = riga("pranzo", "Pranzo", "12:30:00");
const CENA = riga("cena", "Cena", "19:30", { ordine: 4, valido_dal: null, valido_al: null });

async function pastoIn(id: string): Promise<Pasto> {
  const p = await db.pasti.get(id);
  if (!p) throw new Error(`manca il pasto ${id}`);
  return p;
}

async function idInCoda(): Promise<string[]> {
  return (await db.outbox.toArray()).map((v) => v.id).sort();
}

beforeEach(async () => {
  await Promise.all([db.pasti.clear(), db.voci_diario.clear(), db.outbox.clear()]);
  await db.pasti.bulkPut([PRANZO, CENA]);
  await db.voci_diario.bulkPut([
    voce("v-oggi-1", "pranzo", OGGI),
    voce("v-oggi-2", "pranzo", OGGI),
    voce("v-ieri", "pranzo", IERI),
    voce("v-oggi-cancellata", "pranzo", OGGI, { deleted_at: "2026-10-09T08:00:00.000Z" }),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rinominaDaOggi", () => {
  it("chiude la riga vecchia ieri, apre la nuova da oggi e ci sposta solo le voci vive di oggi", async () => {
    const esito = await rinominaDaOggi({ id: "pranzo", nome: "  Pranzo   1 ", ora: "12:30", oggi: OGGI });

    const vecchio = await pastoIn("pranzo");
    expect(vecchio).toMatchObject({ nome: "Pranzo", valido_dal: null, valido_al: IERI });
    // La chiave c'è, esplicita, anche se valeva null.
    expect("valido_dal" in vecchio).toBe(true);

    const nuovo = await pastoIn(esito.pastoNuovo.id);
    expect(nuovo).toMatchObject({
      nome: "Pranzo 1", ora_inizio: "12:30", ordine: 2, valido_dal: OGGI, valido_al: null, deleted_at: null,
    });

    expect((await db.voci_diario.get("v-oggi-1"))?.pasto_id).toBe(nuovo.id);
    expect((await db.voci_diario.get("v-oggi-2"))?.pasto_id).toBe(nuovo.id);
    expect((await db.voci_diario.get("v-ieri"))?.pasto_id).toBe("pranzo");
    expect((await db.voci_diario.get("v-oggi-cancellata"))?.pasto_id).toBe("pranzo");
    expect(esito.vociSpostate).toBe(2);

    expect(await idInCoda()).toEqual(
      [`pasti:${nuovo.id}`, "pasti:pranzo", "voci_diario:v-oggi-1", "voci_diario:v-oggi-2"].sort()
    );
  });

  it("con l'ora cambiata, l'ora nuova vale per tutte e due le righe", async () => {
    const esito = await rinominaDaOggi({ id: "pranzo", nome: "Pranzo 1", ora: "13:00", oggi: OGGI });
    expect((await pastoIn("pranzo")).ora_inizio).toBe("13:00");
    expect((await pastoIn(esito.pastoNuovo.id)).ora_inizio).toBe("13:00");
  });

  it("tutto o niente: un guasto a metà non lascia righe, voci spostate né voci in coda", async () => {
    let chiamate = 0;
    const originale = repositoryVociDiario.aggiorna;
    vi.spyOn(repositoryVociDiario, "aggiorna").mockImplementation(async (id, modifiche) => {
      chiamate++;
      if (chiamate === 2) throw new Error("guasto a metà");
      return originale(id, modifiche);
    });

    await expect(
      rinominaDaOggi({ id: "pranzo", nome: "Pranzo 1", ora: "12:30", oggi: OGGI })
    ).rejects.toThrow("guasto a metà");

    expect(await db.pasti.count()).toBe(2);
    expect(await pastoIn("pranzo")).toEqual(PRANZO);
    expect((await db.voci_diario.get("v-oggi-1"))?.pasto_id).toBe("pranzo");
    expect(await db.outbox.count()).toBe(0);
  });

  it("un pasto nato oggi, o un nome diverso solo nelle maiuscole, non si rinomina da oggi", async () => {
    await db.pasti.put(riga("merenda", "Merenda", "16:00", { valido_dal: OGGI, valido_al: null }));
    await expect(rinominaDaOggi({ id: "merenda", nome: "Merendina", ora: "16:00", oggi: OGGI })).rejects.toThrow();
    await expect(rinominaDaOggi({ id: "pranzo", nome: "PRANZO", ora: "12:30", oggi: OGGI })).rejects.toThrow();
    expect(await db.outbox.count()).toBe(0);
  });

  it("un nome già usato da un altro pasto si rifiuta, sul campo nome", async () => {
    const errore = await rinominaDaOggi({ id: "pranzo", nome: "cena", ora: "12:30", oggi: OGGI }).catch((e) => e);
    expect(errore).toBeInstanceOf(ErroreControlloPasto);
    expect(errore.campo).toBe("nome");
    expect(await db.outbox.count()).toBe(0);
  });
});

describe("correggiPasto", () => {
  it("cambia nome e ora sulla stessa riga, con le date esplicite", async () => {
    await correggiPasto({ id: "pranzo", nome: "Pranzo 1", ora: "13:00", oggi: OGGI });
    expect(await pastoIn("pranzo")).toMatchObject({
      nome: "Pranzo 1", ora_inizio: "13:00", valido_dal: null, valido_al: null,
    });
    expect(await db.pasti.count()).toBe(2);
  });

  it("un'ora già usata si rifiuta, sul campo ora", async () => {
    const errore = await correggiPasto({ id: "pranzo", nome: "Pranzo", ora: "19:30", oggi: OGGI }).catch((e) => e);
    expect(errore).toBeInstanceOf(ErroreControlloPasto);
    expect(errore.campo).toBe("ora");
    expect(errore.message).toBe("Alle 19:30 inizia già Cena.");
  });

  it("se l'ora non cambia non si controlla: dati vecchi con due pasti alla stessa ora non bloccano il nome", async () => {
    await db.pasti.put(riga("pranzo-bis", "Pranzo bis", "12:30"));
    await correggiPasto({ id: "pranzo", nome: "Pranzo 1", ora: "12:30", oggi: OGGI });
    expect((await pastoIn("pranzo")).nome).toBe("Pranzo 1");
  });
});

describe("aggiungiPasto", () => {
  it("da oggi o da sempre, con ordine dopo tutte le righe, cancellate comprese", async () => {
    await db.pasti.put(riga("vecchio", "Vecchio", "22:00", { ordine: 9, deleted_at: "2026-10-01T00:00:00.000Z" }));

    const { pasto } = await aggiungiPasto({ userId: USER, nome: "Merenda", ora: "16:30", daOggi: true, oggi: OGGI });
    expect(await pastoIn(pasto.id)).toMatchObject({ valido_dal: OGGI, valido_al: null, ordine: 10 });

    const { pasto: sempre } = await aggiungiPasto({ userId: USER, nome: "Spuntino", ora: "10:00", daOggi: false, oggi: OGGI });
    expect(await pastoIn(sempre.id)).toMatchObject({ valido_dal: null, valido_al: null, ordine: 11 });
  });

  it("il nome di un pasto chiuso ieri va bene da oggi, non anche nei giorni passati", async () => {
    await db.pasti.put(riga("merenda-vecchia", "Merenda", "16:00", { valido_dal: null, valido_al: IERI }));
    await expect(
      aggiungiPasto({ userId: USER, nome: "merenda", ora: "17:00", daOggi: false, oggi: OGGI })
    ).rejects.toBeInstanceOf(ErroreControlloPasto);
    await expect(
      aggiungiPasto({ userId: USER, nome: "merenda", ora: "17:00", daOggi: true, oggi: OGGI })
    ).resolves.toBeDefined();
  });
});

describe("annullaModificaPasti", () => {
  it("ora o Correggi: rimette nome e ora di prima; un secondo Annulla non scrive niente", async () => {
    const foto = await correggiPasto({ id: "pranzo", nome: "Pranzo 1", ora: "13:00", oggi: OGGI });

    expect(await annullaModificaPasti(foto)).toBe("annullato");
    expect(await pastoIn("pranzo")).toMatchObject({ nome: "Pranzo", ora_inizio: "12:30:00" });

    expect(await annullaModificaPasti(foto)).toBe("gia-annullato");
  });

  it("da oggi: cancella la riga nuova, riapre la vecchia e riporta le voci, anche una arrivata dopo", async () => {
    const { fotografia, pastoNuovo } = await rinominaDaOggi({ id: "pranzo", nome: "Pranzo 1", ora: "12:30", oggi: OGGI });
    // Una voce aggiunta al pasto nuovo nel frattempo (un'altra scheda).
    await db.voci_diario.put(voce("v-dopo", pastoNuovo.id, OGGI));

    expect(await annullaModificaPasti(fotografia)).toBe("annullato");

    expect((await pastoIn(pastoNuovo.id)).deleted_at).not.toBeNull();
    expect(await pastoIn("pranzo")).toMatchObject({ nome: "Pranzo", valido_dal: null, valido_al: null });
    for (const id of ["v-oggi-1", "v-oggi-2", "v-dopo", "v-ieri"]) {
      expect((await db.voci_diario.get(id))?.pasto_id).toBe("pranzo");
    }
    expect(await annullaModificaPasti(fotografia)).toBe("gia-annullato");
  });

  it("aggiungi: cancella la riga nuova", async () => {
    const { fotografia, pasto } = await aggiungiPasto({ userId: USER, nome: "Merenda", ora: "16:30", daOggi: true, oggi: OGGI });
    expect(await annullaModificaPasti(fotografia)).toBe("annullato");
    expect((await pastoIn(pasto.id)).deleted_at).not.toBeNull();
  });

  it("aggiungi, ma il pasto ha già delle voci: non si scrive niente", async () => {
    const { fotografia, pasto } = await aggiungiPasto({ userId: USER, nome: "Merenda", ora: "16:30", daOggi: true, oggi: OGGI });
    await db.voci_diario.put(voce("v-merenda", pasto.id, OGGI));
    await db.outbox.clear();

    expect(await annullaModificaPasti(fotografia)).toBe("pasto-con-voci");
    expect((await pastoIn(pasto.id)).deleted_at).toBeNull();
    expect(await db.outbox.count()).toBe(0);
  });

  it("non rimette mai in vita una riga cancellata nel frattempo", async () => {
    const foto = await correggiPasto({ id: "pranzo", nome: "Pranzo 1", ora: "12:30", oggi: OGGI });
    await repositoryPasti.elimina("pranzo");

    expect(await annullaModificaPasti(foto)).toBe("gia-annullato");
    const pranzo = await pastoIn("pranzo");
    expect(pranzo.deleted_at).not.toBeNull();
    expect(pranzo.nome).toBe("Pranzo 1");
  });
});

// ---------------------------------------------------------------------------
// Passo 4, Elimina pasto. Nel beforeEach Pranzo ha due voci vive oggi, una
// ieri e una già cancellata oggi; Cena c'è da sempre, quindi Pranzo non è
// l'unico pasto. Ogni voce: 100 g a 52 kcal/100 g.

async function vivo(id: string): Promise<boolean> {
  const v = await db.voci_diario.get(id);
  return !!v && v.deleted_at === null;
}

const IDS_TUTTE = ["v-ieri", "v-oggi-1", "v-oggi-2"];
const IDS_OGGI = ["v-oggi-1", "v-oggi-2"];

describe("eliminaPasto", () => {
  beforeEach(() => {
    invii.conteggio = 0;
  });

  it("anche nei giorni passati: pasto e tutte le sue voci vive cancellati, giorni intatta", async () => {
    await db.giorni.put({
      id: "g1", user_id: USER, data: IERI, tipo_giorno: "allenamento",
      updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null,
    });
    const cancellataPrima = await db.voci_diario.get("v-oggi-cancellata");

    const esito = await eliminaPasto({ id: "pranzo", modo: "tutto", oggi: OGGI, idVociConfermate: IDS_TUTTE });

    expect(esito.esito).toBe("fatto");
    expect(esito.riepilogo).toEqual({ voci: 3, giorni: 2, kcal: 156 });
    expect((await pastoIn("pranzo")).deleted_at).not.toBeNull();
    for (const id of IDS_TUTTE) expect(await vivo(id)).toBe(false);
    expect(await db.voci_diario.get("v-oggi-cancellata")).toEqual(cancellataPrima);
    expect((await db.giorni.get("g1"))?.deleted_at).toBeNull();
    expect((await pastoIn("cena")).deleted_at).toBeNull();
  });

  it("da oggi: il pasto si chiude ieri, solo le voci di oggi si cancellano", async () => {
    const esito = await eliminaPasto({ id: "pranzo", modo: "oggi", oggi: OGGI, idVociConfermate: IDS_OGGI });

    expect(esito.riepilogo).toEqual({ voci: 2, giorni: 1, kcal: 104 });
    expect(await pastoIn("pranzo")).toMatchObject({ deleted_at: null, valido_dal: null, valido_al: IERI });
    expect(await vivo("v-oggi-1")).toBe(false);
    expect(await vivo("v-oggi-2")).toBe(false);
    expect(await vivo("v-ieri")).toBe(true);
  });

  it("voci diverse da quelle confermate: niente scritto, i numeri nuovi tornano indietro", async () => {
    const esito = await eliminaPasto({ id: "pranzo", modo: "tutto", oggi: OGGI, idVociConfermate: IDS_OGGI });

    expect(esito).toMatchObject({ esito: "cambiate", riepilogo: { voci: 3, giorni: 2 } });
    expect((await pastoIn("pranzo")).deleted_at).toBeNull();
    for (const id of IDS_TUTTE) expect(await vivo(id)).toBe(true);
    expect(await db.outbox.count()).toBe(0);
  });

  it("tutto o niente: un guasto a metà non lascia voci cancellate né voci in coda", async () => {
    let chiamate = 0;
    const originale = repositoryVociDiario.elimina;
    vi.spyOn(repositoryVociDiario, "elimina").mockImplementation(async (id) => {
      chiamate++;
      if (chiamate === 2) throw new Error("guasto a metà");
      return originale(id);
    });

    await expect(
      eliminaPasto({ id: "pranzo", modo: "tutto", oggi: OGGI, idVociConfermate: IDS_TUTTE })
    ).rejects.toThrow("guasto a metà");

    for (const id of IDS_TUTTE) expect(await vivo(id)).toBe(true);
    expect((await pastoIn("pranzo")).deleted_at).toBeNull();
    expect(await db.outbox.count()).toBe(0);
  });

  it("un pasto nato oggi si elimina solo del tutto", async () => {
    await db.pasti.put(riga("brunch", "Brunch", "11:00", { valido_dal: OGGI, valido_al: null }));
    await expect(eliminaPasto({ id: "brunch", modo: "oggi", oggi: OGGI, idVociConfermate: [] })).rejects.toThrow();
    const esito = await eliminaPasto({ id: "brunch", modo: "tutto", oggi: OGGI, idVociConfermate: [] });
    expect(esito.esito).toBe("fatto");
    expect((await pastoIn("brunch")).deleted_at).not.toBeNull();
  });

  it("l'ultimo pasto non si elimina, in nessun modo", async () => {
    await db.pasti.put({ ...CENA, deleted_at: "2026-10-01T00:00:00.000Z" });
    for (const modo of ["tutto", "oggi"] as const) {
      await expect(
        eliminaPasto({ id: "pranzo", modo, oggi: OGGI, idVociConfermate: modo === "tutto" ? IDS_TUTTE : IDS_OGGI })
      ).rejects.toThrow("È l'unico pasto");
    }
    expect(await db.outbox.count()).toBe(0);
  });

  it("anche nei giorni passati è rifiutato se un giorno passato resterebbe senza pasti", async () => {
    await db.pasti.put({ ...CENA, valido_dal: OGGI });
    await expect(
      eliminaPasto({ id: "pranzo", modo: "tutto", oggi: OGGI, idVociConfermate: IDS_TUTTE })
    ).rejects.toThrow("Alcuni giorni passati");
    const daOggi = await eliminaPasto({ id: "pranzo", modo: "oggi", oggi: OGGI, idVociConfermate: IDS_OGGI });
    expect(daOggi.esito).toBe("fatto");
  });

  it("molte righe in una volta: una sola sincronizzazione, non una per riga", async () => {
    const tante = Array.from({ length: 12 }, (_, i) => voce(`v-extra-${i}`, "pranzo", IERI));
    await db.voci_diario.bulkPut(tante);

    await eliminaPasto({
      id: "pranzo", modo: "tutto", oggi: OGGI,
      idVociConfermate: [...IDS_TUTTE, ...tante.map((v) => v.id)],
    });
    await new Promise((r) => setTimeout(r, 100));

    // 16 righe in coda. Il server finto rifiuta tutto, e ogni giro si
    // ferma al primo rifiuto: un giro = un invio. Con un giro per riga
    // sarebbero 16; con un giro per volta, il giro e quello prenotato.
    expect(await db.outbox.count()).toBe(16);
    expect(invii.conteggio).toBeLessThanOrEqual(2);
  });
});

describe("annulla di eliminaPasto", () => {
  it("anche nei giorni passati: il pasto rinasce con un id nuovo, le voci rinascono su di lui", async () => {
    const esito = await eliminaPasto({ id: "pranzo", modo: "tutto", oggi: OGGI, idVociConfermate: IDS_TUTTE });
    if (esito.esito !== "fatto") throw new Error("atteso fatto");
    await db.outbox.clear();

    expect(await annullaModificaPasti(esito.fotografia)).toBe("annullato");

    const nuovo = await pastoIn(idPastoRicreato("pranzo"));
    expect(nuovo).toMatchObject({
      nome: "Pranzo", ora_inizio: "12:30:00", ordine: 2, valido_dal: null, valido_al: null, deleted_at: null,
    });
    expect((await pastoIn("pranzo")).deleted_at).not.toBeNull();
    for (const id of IDS_TUTTE) {
      const ricreata = await db.voci_diario.get(idVoceRicreata(id));
      expect(ricreata).toMatchObject({ pasto_id: nuovo.id, deleted_at: null });
      expect(ricreata?.data).toBe((await db.voci_diario.get(id))?.data);
      expect(await vivo(id)).toBe(false);
    }

    // In coda il pasto parte prima delle sue voci (ordinaOutbox).
    const coda = ordinaOutbox(await db.outbox.toArray()).map((v) => v.tabella);
    expect(coda[0]).toBe("pasti");
    expect(coda.slice(1).every((t) => t === "voci_diario")).toBe(true);

    expect(await annullaModificaPasti(esito.fotografia)).toBe("gia-annullato");
    expect(await db.pasti.count()).toBe(3);
  });

  it("da oggi: il pasto si riapre e le voci di oggi rinascono sullo stesso pasto", async () => {
    const esito = await eliminaPasto({ id: "pranzo", modo: "oggi", oggi: OGGI, idVociConfermate: IDS_OGGI });
    if (esito.esito !== "fatto") throw new Error("atteso fatto");

    expect(await annullaModificaPasti(esito.fotografia)).toBe("annullato");

    expect(await pastoIn("pranzo")).toMatchObject({ deleted_at: null, valido_dal: null, valido_al: null });
    for (const id of IDS_OGGI) {
      expect((await db.voci_diario.get(idVoceRicreata(id)))?.pasto_id).toBe("pranzo");
    }
    expect(await vivo("v-ieri")).toBe(true);
    expect(await annullaModificaPasti(esito.fotografia)).toBe("gia-annullato");
  });

  it("conflitto di nome: un pasto con lo stesso nome nato nel frattempo, niente scritto", async () => {
    const esito = await eliminaPasto({ id: "pranzo", modo: "tutto", oggi: OGGI, idVociConfermate: IDS_TUTTE });
    if (esito.esito !== "fatto") throw new Error("atteso fatto");
    await db.pasti.put(riga("altro", "pranzo", "13:00", { valido_dal: null, valido_al: null }));
    await db.outbox.clear();

    expect(await annullaModificaPasti(esito.fotografia)).toEqual({
      conflitto: "Non annullato: c'è già un pasto chiamato «Pranzo».",
    });
    expect(await db.pasti.get(idPastoRicreato("pranzo"))).toBeUndefined();
    expect(await db.voci_diario.get(idVoceRicreata("v-ieri"))).toBeUndefined();
    expect(await db.outbox.count()).toBe(0);
  });

  it("conflitto d'ora, anche da oggi: niente scritto", async () => {
    const esito = await eliminaPasto({ id: "pranzo", modo: "oggi", oggi: OGGI, idVociConfermate: IDS_OGGI });
    if (esito.esito !== "fatto") throw new Error("atteso fatto");
    await db.pasti.put(riga("brunch", "Brunch", "12:30", { valido_dal: OGGI, valido_al: null }));
    await db.outbox.clear();

    expect(await annullaModificaPasti(esito.fotografia)).toEqual({
      conflitto: "Non annullato: alle 12:30 inizia già Brunch.",
    });
    expect((await pastoIn("pranzo")).valido_al).toBe(IERI);
    expect(await db.outbox.count()).toBe(0);
  });

  it("da oggi, ma il pasto è stato cancellato nel frattempo: non lo rimette in vita", async () => {
    const esito = await eliminaPasto({ id: "pranzo", modo: "oggi", oggi: OGGI, idVociConfermate: IDS_OGGI });
    if (esito.esito !== "fatto") throw new Error("atteso fatto");
    await repositoryPasti.elimina("pranzo");

    expect(await annullaModificaPasti(esito.fotografia)).toEqual({
      conflitto: "Non annullato: «Pranzo» non c'è più.",
    });
    expect((await pastoIn("pranzo")).deleted_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Diario fino a oggi + 7 (decisione del 10/10): "da oggi" vuol dire da oggi
// in poi. Oltre alle voci del beforeEach, Pranzo ne ha una domani, una fra
// tre giorni e una cancellata domani. Senza questo, rinominare o eliminare
// "da oggi" lascerebbe le voci pianificate su un pasto chiuso ("Non più in
// uso") o vive dopo l'eliminazione.

const DOMANI = "2026-10-10";
const TRA_TRE = "2026-10-12";
const IDS_DA_OGGI = ["v-domani", "v-oggi-1", "v-oggi-2", "v-tra-tre"];

describe("da oggi, con voci nei giorni futuri", () => {
  beforeEach(async () => {
    await db.voci_diario.bulkPut([
      voce("v-domani", "pranzo", DOMANI),
      voce("v-tra-tre", "pranzo", TRA_TRE),
      voce("v-domani-cancellata", "pranzo", DOMANI, { deleted_at: "2026-10-09T08:00:00.000Z" }),
    ]);
  });

  it("rinomina: le voci da oggi in poi passano al pasto nuovo, quelle di ieri no", async () => {
    const esito = await rinominaDaOggi({ id: "pranzo", nome: "Pranzo 1", ora: "12:30", oggi: OGGI });

    for (const id of IDS_DA_OGGI) {
      expect((await db.voci_diario.get(id))?.pasto_id).toBe(esito.pastoNuovo.id);
    }
    expect((await db.voci_diario.get("v-ieri"))?.pasto_id).toBe("pranzo");
    expect((await db.voci_diario.get("v-domani-cancellata"))?.pasto_id).toBe("pranzo");
    expect(esito.vociSpostate).toBe(4);
  });

  it("annulla della rinomina: tornano anche le voci future, compresa una aggiunta dopo", async () => {
    const { fotografia, pastoNuovo } = await rinominaDaOggi({ id: "pranzo", nome: "Pranzo 1", ora: "12:30", oggi: OGGI });
    // Pianificata dopo la rinomina, fra cinque giorni, sul pasto nuovo.
    await db.voci_diario.put(voce("v-tra-cinque", pastoNuovo.id, "2026-10-14"));

    expect(await annullaModificaPasti(fotografia)).toBe("annullato");

    expect((await pastoIn(pastoNuovo.id)).deleted_at).not.toBeNull();
    for (const id of [...IDS_DA_OGGI, "v-tra-cinque", "v-ieri"]) {
      expect((await db.voci_diario.get(id))?.pasto_id).toBe("pranzo");
    }
  });

  it("elimina: cancella le voci da oggi in poi, la conferma le conta tutte", async () => {
    // La conferma vista con le sole voci di oggi non basta: niente scritto.
    const vecchia = await eliminaPasto({ id: "pranzo", modo: "oggi", oggi: OGGI, idVociConfermate: IDS_OGGI });
    expect(vecchia).toMatchObject({ esito: "cambiate", riepilogo: { voci: 4, giorni: 3, kcal: 208 } });
    if (vecchia.esito !== "cambiate") throw new Error("attese cambiate");
    expect([...vecchia.idVoci].sort()).toEqual(IDS_DA_OGGI);
    for (const id of IDS_DA_OGGI) expect(await vivo(id)).toBe(true);

    const esito = await eliminaPasto({ id: "pranzo", modo: "oggi", oggi: OGGI, idVociConfermate: IDS_DA_OGGI });
    expect(esito.esito).toBe("fatto");
    for (const id of IDS_DA_OGGI) expect(await vivo(id)).toBe(false);
    expect(await vivo("v-ieri")).toBe(true);
    expect(await pastoIn("pranzo")).toMatchObject({ deleted_at: null, valido_al: IERI });
  });

  it("annulla dell'eliminazione: rinascono anche le voci future, nei loro giorni", async () => {
    const esito = await eliminaPasto({ id: "pranzo", modo: "oggi", oggi: OGGI, idVociConfermate: IDS_DA_OGGI });
    if (esito.esito !== "fatto") throw new Error("atteso fatto");

    expect(await annullaModificaPasti(esito.fotografia)).toBe("annullato");

    expect((await pastoIn("pranzo")).valido_al).toBeNull();
    for (const id of IDS_DA_OGGI) {
      const ricreata = await db.voci_diario.get(idVoceRicreata(id));
      expect(ricreata).toMatchObject({ pasto_id: "pranzo", deleted_at: null });
      expect(ricreata?.data).toBe((await db.voci_diario.get(id))?.data);
    }
  });
});
