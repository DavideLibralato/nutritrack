// Test permanenti per la regola dei valori nascosti in modifica
// (valoriNascostiDaTogliere e salvaAlimento in alimenti.ts;
// PUNTO_DI_PARTENZA.md §10.1). Un errore qui non fa rumore: zuccheri,
// fibre, saturi e sale non si vedono nel modulo, quindi una correzione dei
// carboidrati che lasciasse gli zuccheri vecchi terrebbe un dato falso
// (zuccheri oltre i carboidrati) che nessuno vede e nessuno corregge.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import type { Alimento } from "../db/tipi";
import { salvaAlimento, valoriNascostiDaTogliere, type CampiForm } from "./alimenti";

// Server sempre irraggiungibile: le scritture restano nella coda outbox,
// dove i test le guardano (come salvataggioAlimento.test.ts).
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      upsert: async () => ({ error: { message: "offline" } }),
    }),
  }),
}));

const USER = "utente-valori-nascosti";

// Una copia dal catalogo com'è in Dexie, con i quattro valori pieni.
const GOCCIOLE: Alimento = {
  id: "copia-gocciole", user_id: USER, updated_at: "2026-11-08T10:00:00.000Z", deleted_at: null,
  nome: "Gocciole chocolate", marca: "Pavesi", barcode: "8013355999143",
  kcal_100g: 488, proteine_100g: 6.5, carboidrati_100g: 64, grassi_100g: 22,
  zuccheri_100g: 25, fibre_100g: 4, saturi_100g: 6, sale_100g: 0.5,
  porzione_default_g: 30, fonte: "off", verificato: false, catalogo_id: "off:8013355999143",
};

// I campi del modulo come li manda CreaAlimentoForm, uguali alla riga.
function modulo(cambi: Partial<CampiForm> = {}): CampiForm {
  return {
    nome: GOCCIOLE.nome,
    marca: GOCCIOLE.marca,
    kcal_100g: GOCCIOLE.kcal_100g,
    proteine_100g: GOCCIOLE.proteine_100g,
    carboidrati_100g: GOCCIOLE.carboidrati_100g,
    grassi_100g: GOCCIOLE.grassi_100g,
    porzione_default_g: GOCCIOLE.porzione_default_g,
    ...cambi,
  };
}

async function nascostiDopo(cambi: Partial<CampiForm>, riga: Alimento = GOCCIOLE) {
  const esito = await salvaAlimento(USER, modulo(cambi), riga.id);
  expect(esito.esito).toBe("salvato");
  const salvata = await db.alimenti.get(riga.id);
  return {
    zuccheri: salvata!.zuccheri_100g,
    fibre: salvata!.fibre_100g,
    saturi: salvata!.saturi_100g,
    sale: salvata!.sale_100g,
  };
}

describe("valoriNascostiDaTogliere", () => {
  it("niente cambiato: niente da togliere", () => {
    expect(valoriNascostiDaTogliere(GOCCIOLE, modulo())).toEqual({});
  });

  it("carboidrati cambiati: zuccheri e fibre", () => {
    expect(valoriNascostiDaTogliere(GOCCIOLE, modulo({ carboidrati_100g: 60 }))).toEqual({
      zuccheri_100g: null,
      fibre_100g: null,
    });
  });

  it("grassi cambiati: i saturi", () => {
    expect(valoriNascostiDaTogliere(GOCCIOLE, modulo({ grassi_100g: 20 }))).toEqual({ saturi_100g: null });
  });

  it("kcal, proteine, nome, marca e porzione cambiati: niente da togliere", () => {
    expect(
      valoriNascostiDaTogliere(
        GOCCIOLE,
        modulo({ kcal_100g: 500, proteine_100g: 7, nome: "Gocciole", marca: "Mia", porzione_default_g: 40 })
      )
    ).toEqual({});
  });
});

describe("salvaAlimento in modifica: i valori nascosti", () => {
  beforeEach(async () => {
    await db.alimenti.clear();
    await db.outbox.clear();
    await db.alimenti.put(GOCCIOLE);
  });

  it("carboidrati cambiati: zuccheri e fibre null, saturi e sale restano", async () => {
    expect(await nascostiDopo({ carboidrati_100g: 60 })).toEqual({ zuccheri: null, fibre: null, saturi: 6, sale: 0.5 });
  });

  it("grassi cambiati: saturi null, zuccheri, fibre e sale restano", async () => {
    expect(await nascostiDopo({ grassi_100g: 20 })).toEqual({ zuccheri: 25, fibre: 4, saturi: null, sale: 0.5 });
  });

  it("carboidrati e grassi cambiati: resta solo il sale", async () => {
    expect(await nascostiDopo({ carboidrati_100g: 60, grassi_100g: 20 })).toEqual({
      zuccheri: null, fibre: null, saturi: null, sale: 0.5,
    });
  });

  it("solo kcal, proteine, nome, marca e porzione: i quattro restano", async () => {
    expect(
      await nascostiDopo({ kcal_100g: 500, proteine_100g: 7, nome: "Gocciole", marca: "Mia", porzione_default_g: 40 })
    ).toEqual({ zuccheri: 25, fibre: 4, saturi: 6, sale: 0.5 });
  });

  it("risalvare senza cambiare niente non toglie niente", async () => {
    expect(await nascostiDopo({})).toEqual({ zuccheri: 25, fibre: 4, saturi: 6, sale: 0.5 });
  });

  it("vale anche per un alimento non dal catalogo (arrivato da un amico, con i quattro valori)", async () => {
    const dallAmico: Alimento = { ...GOCCIOLE, id: "dall-amico", nome: "Yogurt", marca: "Fage", barcode: null, catalogo_id: null };
    await db.alimenti.put(dallAmico);
    const esito = await salvaAlimento(USER, { ...modulo(), nome: "Yogurt", marca: "Fage", carboidrati_100g: 5 }, dallAmico.id);
    expect(esito.esito).toBe("salvato");
    expect(await db.alimenti.get(dallAmico.id)).toMatchObject({ zuccheri_100g: null, fibre_100g: null, saturi_100g: 6, sale_100g: 0.5 });
  });

  it("i null vanno in coda per il server, e la copia resta dal catalogo", async () => {
    await nascostiDopo({ carboidrati_100g: 60 });
    const voce = await db.outbox.get(`alimenti:${GOCCIOLE.id}`);
    expect(voce?.dati).toMatchObject({
      carboidrati_100g: 60, zuccheri_100g: null, fibre_100g: null, saturi_100g: 6, sale_100g: 0.5,
      catalogo_id: "off:8013355999143", fonte: "off",
    });
  });
});
