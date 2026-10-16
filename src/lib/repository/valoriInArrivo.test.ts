// Test permanenti per "Usa questi valori" e il suo Annulla
// (usaValoriInArrivo e annullaValoriInArrivo in alimenti.ts). Sono due
// scritture in due posti (Dexie e il server) che non stanno in una
// transazione: l'ordine decide cosa resta se la rete cade fra le due. Un
// ordine sbagliato non fa rumore: si scopre il giorno in cui un alimento
// mandato da un amico sparisce senza che nessuno l'abbia scelto.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/database";
import type { Alimento } from "../db/tipi";
import type { ValoriAlimento } from "../catalogo/alimentiInArrivo";
import { annullaValoriInArrivo, usaValoriInArrivo } from "./alimenti";

// Server sempre irraggiungibile per la coda: le modifiche restano
// nell'outbox, dove i test le guardano.
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      upsert: async () => ({ error: { message: "offline" } }),
    }),
  }),
}));

const IO = "utente-valori-in-arrivo";

const MIEI: ValoriAlimento = {
  kcal_100g: 57,
  grassi_100g: 0.4,
  carboidrati_100g: 3.9,
  proteine_100g: 10,
  porzione_default_g: 150,
  zuccheri_100g: null,
  fibre_100g: null,
  saturi_100g: null,
  sale_100g: null,
};

const IN_ARRIVO: ValoriAlimento = {
  kcal_100g: 59,
  grassi_100g: 0.2,
  carboidrati_100g: 3.6,
  proteine_100g: 10,
  porzione_default_g: 170,
  zuccheri_100g: 3.6,
  fibre_100g: null,
  saturi_100g: 0.1,
  sale_100g: 0.1,
};

function yogurt(altro: Partial<Alimento> = {}): Alimento {
  return {
    id: "yogurt",
    user_id: IO,
    updated_at: "2026-10-16T00:00:00.000Z",
    deleted_at: null,
    nome: "Yogurt greco 0%",
    marca: "Fage",
    barcode: "520",
    ...MIEI,
    fonte: "etichetta",
    verificato: false,
    ...altro,
  };
}

async function valoriSalvati(): Promise<ValoriAlimento> {
  const a = (await db.alimenti.get("yogurt"))!;
  return {
    kcal_100g: a.kcal_100g,
    grassi_100g: a.grassi_100g,
    carboidrati_100g: a.carboidrati_100g,
    proteine_100g: a.proteine_100g,
    porzione_default_g: a.porzione_default_g,
    zuccheri_100g: a.zuccheri_100g,
    fibre_100g: a.fibre_100g,
    saturi_100g: a.saturi_100g,
    sale_100g: a.sale_100g,
  };
}

beforeEach(async () => {
  await Promise.all([db.alimenti.clear(), db.outbox.clear()]);
  await db.alimenti.put(yogurt());
});

describe("usaValoriInArrivo", () => {
  it("prima scrive in Dexie (con la coda), poi chiude sul server", async () => {
    const chiudi = vi.fn(async () => {
      // Quando parte la chiusura, i valori nuovi sono già sul telefono.
      expect(await valoriSalvati()).toEqual(IN_ARRIVO);
      return "ok" as const;
    });
    const esito = await usaValoriInArrivo(IO, "yogurt", IN_ARRIVO, chiudi);

    expect(chiudi).toHaveBeenCalledOnce();
    expect(esito).toEqual({
      esito: "fatto",
      traccia: { idAlimento: "yogurt", precedenti: MIEI, chiusura: "ok" },
    });
    expect(await db.outbox.count()).toBe(1);
  });

  it("nome, marca, barcode e fonte restano i propri", async () => {
    await usaValoriInArrivo(IO, "yogurt", IN_ARRIVO, async () => "ok");
    const a = (await db.alimenti.get("yogurt"))!;
    expect([a.nome, a.marca, a.barcode, a.fonte, a.verificato]).toEqual([
      "Yogurt greco 0%",
      "Fage",
      "520",
      "etichetta",
      false,
    ]);
  });

  it("se la chiusura non arriva, i valori restano aggiornati e l'esito lo dice", async () => {
    const esito = await usaValoriInArrivo(IO, "yogurt", IN_ARRIVO, async () => "errore");
    expect(esito.esito === "fatto" && esito.traccia.chiusura).toBe("errore");
    expect(await valoriSalvati()).toEqual(IN_ARRIVO);
  });

  it("ripetuto dopo una chiusura persa: niente da scrivere, chiude e basta", async () => {
    await usaValoriInArrivo(IO, "yogurt", IN_ARRIVO, async () => "errore");
    const chiudi = vi.fn(async () => "ok" as const);
    await usaValoriInArrivo(IO, "yogurt", IN_ARRIVO, chiudi);
    expect(chiudi).toHaveBeenCalledOnce();
    expect(await db.outbox.count()).toBe(1);
  });

  it("alimento cancellato, di un altro o verificato: niente scritto e il server non si chiama", async () => {
    for (const altro of [
      { deleted_at: "2026-10-16T01:00:00.000Z" },
      { user_id: "altro" },
      { verificato: true },
    ]) {
      await db.alimenti.put(yogurt(altro));
      const chiudi = vi.fn(async () => "ok" as const);
      expect(await usaValoriInArrivo(IO, "yogurt", IN_ARRIVO, chiudi)).toEqual({ esito: "non_trovato" });
      expect(chiudi).not.toHaveBeenCalled();
      expect(await valoriSalvati()).toEqual(MIEI);
    }
    expect(await db.outbox.count()).toBe(0);
  });
});

describe("annullaValoriInArrivo", () => {
  const traccia = { idAlimento: "yogurt", precedenti: MIEI, chiusura: "ok" as const };

  beforeEach(async () => {
    await db.alimenti.put(yogurt(IN_ARRIVO));
  });

  it("prima riapre sul server, poi rimette i valori di prima", async () => {
    const riapri = vi.fn(async () => {
      // Quando parte la riapertura, il telefono ha ancora i valori nuovi.
      expect(await valoriSalvati()).toEqual(IN_ARRIVO);
      return "ok" as const;
    });
    expect(await annullaValoriInArrivo(IO, traccia, riapri)).toBe("ripristinato");
    expect(riapri).toHaveBeenCalledOnce();
    expect(await valoriSalvati()).toEqual(MIEI);
    expect(await db.outbox.count()).toBe(1);
  });

  it("se la riapertura non risponde non si tocca niente: si può riprovare", async () => {
    expect(await annullaValoriInArrivo(IO, traccia, async () => "errore")).toBe("errore");
    expect(await valoriSalvati()).toEqual(IN_ARRIVO);
    expect(await db.outbox.count()).toBe(0);
  });

  it("la riapertura si chiede anche se la chiusura sembrava fallita (risposta persa)", async () => {
    const riapri = vi.fn(async () => "ok" as const);
    await annullaValoriInArrivo(IO, { ...traccia, chiusura: "errore" }, riapri);
    expect(riapri).toHaveBeenCalledOnce();
    expect(await valoriSalvati()).toEqual(MIEI);
  });

  it("non_trovata (amicizia finita): i valori di prima tornano lo stesso", async () => {
    expect(await annullaValoriInArrivo(IO, traccia, async () => "non_trovata")).toBe("ripristinato");
    expect(await valoriSalvati()).toEqual(MIEI);
  });

  it("un alimento cancellato nel frattempo non torna in vita", async () => {
    await db.alimenti.put(yogurt({ ...IN_ARRIVO, deleted_at: "2026-10-16T01:00:00.000Z" }));
    expect(await annullaValoriInArrivo(IO, traccia, async () => "ok")).toBe("ripristinato");
    const a = (await db.alimenti.get("yogurt"))!;
    expect(a.deleted_at).not.toBeNull();
    expect(a.kcal_100g).toBe(59);
  });
});
