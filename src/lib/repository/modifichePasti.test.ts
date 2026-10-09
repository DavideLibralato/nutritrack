// Le scritture di Pasti e orari e i loro Annulla (PUNTO_DI_PARTENZA.md,
// sezione 3, "Pasti e orari"): test permanenti. La rinomina "da oggi"
// tocca tre cose insieme (due righe di `pasti` e le voci di oggi): un
// guasto a metà, o un Annulla che dimentica una voce, lascerebbe voci
// sotto un pasto "Non più in uso" senza che nessuno se ne accorga.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db/database";
import type { Pasto, VoceDiario } from "../db/tipi";
import { repositoryPasti, repositoryVociDiario } from "./index";
import {
  aggiungiPasto,
  annullaModificaPasti,
  correggiPasto,
  ErroreControlloPasto,
  rinominaDaOggi,
} from "./modifichePasti";

// Server sempre irraggiungibile: le scritture restano nella coda outbox,
// dove i test le guardano.
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      upsert: async () => ({ error: { message: "offline" } }),
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
