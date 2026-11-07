// Test permanenti per cercaCodice (ricercaCodice.ts) e per la scelta
// nel catalogo locale (alimentoPerCodice in src/lib/repository/alimenti.ts).
// L'ordine catalogo locale → Open Food Facts sbaglia in silenzio: se OFF
// venisse chiamato anche per un prodotto già nel catalogo, si aprirebbe
// "Nuovo alimento" e il prodotto rischierebbe di diventare un secondo
// alimento con lo stesso codice; se contasse un alimento cancellato, o
// quello di un altro utente, il prodotto non si troverebbe mai più.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import type { Alimento } from "../db/tipi";
import { cercaCodice } from "./ricercaCodice";

// Nessuna scrittura va al server in questi test (si legge solo): il
// client finto evita che il modulo della sync ne crei uno vero.
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      upsert: async () => ({ error: { message: "offline" } }),
    }),
  }),
}));

const IO = "utente-ricerca-codice";
const CODICE = "3017620422003";

function alimento(
  id: string,
  opzioni: Partial<Pick<Alimento, "user_id" | "barcode" | "deleted_at" | "updated_at">> = {}
): Alimento {
  return {
    id,
    user_id: IO,
    updated_at: "2026-11-07T10:00:00.000Z",
    deleted_at: null,
    nome: `Alimento ${id}`,
    marca: null,
    barcode: CODICE,
    kcal_100g: 539,
    proteine_100g: 6.3,
    carboidrati_100g: 57.5,
    grassi_100g: 30.9,
    zuccheri_100g: null,
    fibre_100g: null,
    saturi_100g: null,
    sale_100g: null,
    porzione_default_g: 15,
    fonte: "off",
    verificato: false,
    ...opzioni,
  };
}

function trovatoSuOff(): typeof fetch {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify({ product: { product_name: "Nutella da OFF" } }), { status: 200 })
  );
}

beforeEach(async () => {
  await db.alimenti.clear();
});

describe("cercaCodice", () => {
  it("un mio alimento con quel codice: dritti allo sheet, Open Food Facts non si chiama", async () => {
    await db.alimenti.put(alimento("mio"));
    const fetchFinta = trovatoSuOff();

    const esito = await cercaCodice(IO, CODICE, { fetchBase: fetchFinta });

    expect(esito).toEqual({ esito: "nel-catalogo", alimento: expect.objectContaining({ id: "mio" }) });
    expect(fetchFinta).not.toHaveBeenCalled();
  });

  it("un alimento del catalogo comune con quel codice vale come nel catalogo", async () => {
    await db.alimenti.put(alimento("comune", { user_id: null }));
    const fetchFinta = trovatoSuOff();

    const esito = await cercaCodice(IO, CODICE, { fetchBase: fetchFinta });

    expect(esito).toEqual({ esito: "nel-catalogo", alimento: expect.objectContaining({ id: "comune" }) });
    expect(fetchFinta).not.toHaveBeenCalled();
  });

  it("il mio vince su quello del catalogo comune, anche se quello è più recente", async () => {
    await db.alimenti.bulkPut([
      alimento("comune", { user_id: null, updated_at: "2026-11-07T12:00:00.000Z" }),
      alimento("mio", { updated_at: "2026-11-01T00:00:00.000Z" }),
    ]);

    const esito = await cercaCodice(IO, CODICE, { fetchBase: trovatoSuOff() });

    expect(esito).toEqual({ esito: "nel-catalogo", alimento: expect.objectContaining({ id: "mio" }) });
  });

  it("due miei con lo stesso codice (due telefoni offline): il più recente", async () => {
    await db.alimenti.bulkPut([
      alimento("vecchio", { updated_at: "2026-11-01T00:00:00.000Z" }),
      alimento("nuovo", { updated_at: "2026-11-05T00:00:00.000Z" }),
    ]);

    const esito = await cercaCodice(IO, CODICE, { fetchBase: trovatoSuOff() });

    expect(esito).toEqual({ esito: "nel-catalogo", alimento: expect.objectContaining({ id: "nuovo" }) });
  });

  it("un alimento cancellato non conta: si cerca su Open Food Facts", async () => {
    await db.alimenti.put(alimento("cancellato", { deleted_at: "2026-11-06T00:00:00.000Z" }));
    const fetchFinta = trovatoSuOff();

    const esito = await cercaCodice(IO, CODICE, { fetchBase: fetchFinta });

    expect(esito).toEqual({
      esito: "open-food-facts",
      prodotto: expect.objectContaining({ nome: "Nutella da OFF" }),
    });
    expect(fetchFinta).toHaveBeenCalledTimes(1);
  });

  it("l'alimento di un altro utente non conta", async () => {
    await db.alimenti.put(alimento("suo", { user_id: "un-altro-utente" }));
    const fetchFinta = trovatoSuOff();

    const esito = await cercaCodice(IO, CODICE, { fetchBase: fetchFinta });

    expect(esito.esito).toBe("open-food-facts");
    expect(fetchFinta).toHaveBeenCalledTimes(1);
  });

  it("un alimento con un altro codice non conta", async () => {
    await db.alimenti.put(alimento("altro-codice", { barcode: "96385074" }));
    const esito = await cercaCodice(IO, CODICE, { fetchBase: trovatoSuOff() });
    expect(esito.esito).toBe("open-food-facts");
  });

  it("fuori dal catalogo e non su Open Food Facts: non trovato", async () => {
    const esito = await cercaCodice(IO, CODICE, {
      fetchBase: async () => new Response("{}", { status: 404 }),
    });
    expect(esito).toEqual({ esito: "non-trovato" });
  });

  it("fuori dal catalogo e senza rete: rete", async () => {
    const esito = await cercaCodice(IO, CODICE, {
      fetchBase: async () => {
        throw new TypeError("Load failed");
      },
    });
    expect(esito).toEqual({ esito: "rete" });
  });

  it("nel catalogo il prodotto si trova anche senza rete", async () => {
    await db.alimenti.put(alimento("mio"));
    const esito = await cercaCodice(IO, CODICE, {
      fetchBase: async () => {
        throw new TypeError("Load failed");
      },
    });
    expect(esito.esito).toBe("nel-catalogo");
  });

  it("schermata già chiusa dopo la lettura del catalogo: Open Food Facts non si chiama", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchFinta = trovatoSuOff();

    const esito = await cercaCodice(IO, CODICE, { fetchBase: fetchFinta, segnale: controller.signal });

    expect(esito).toEqual({ esito: "annullata" });
    expect(fetchFinta).not.toHaveBeenCalled();
  });
});
