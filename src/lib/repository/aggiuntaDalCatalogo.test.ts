// Test permanenti per aggiungiDalCatalogo (src/lib/repository/alimenti.ts;
// PUNTO_DI_PARTENZA.md §10.1). Proteggono quello che non si vede a
// schermo: che la copia nasca con tutti i suoi valori (anche i quattro
// nascosti) e con catalogo_id, che salga al server, che un doppio tocco o
// un alimento già presente non creino un doppione, e che una copia
// cancellata e poi riaggiunta nasca come riga nuova invece di tornare in
// vita (la discesa potrebbe annullarla, §9.2).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db/database";
import type { Alimento } from "../db/tipi";
import { CATALOGO_PRECARICATO, type AlimentoCatalogo } from "../catalogo/catalogoPrecaricato";
import { aggiungiDalCatalogo, salvaAlimento } from "./alimenti";
import { eliminaAlimenti } from "./composizioni";

const USER = "utente-catalogo";

const upsertMock = vi.fn();

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    // La salita manda solo le voci dell'utente della sessione.
    auth: { getSession: async () => ({ data: { session: { user: { id: "utente-catalogo" } } } }) },
    from: (tabella: string) => ({
      upsert: (dati: unknown) => upsertMock(tabella, dati),
    }),
  }),
}));

// Aspetta finché la condizione è vera, o fallisce dopo timeoutMs.
async function attendi(condizione: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
  const inizio = Date.now();
  while (!(await condizione())) {
    if (Date.now() - inizio > timeoutMs) throw new Error("condizione mai vera entro il timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
}

function dalCatalogo(id: string): AlimentoCatalogo {
  const voce = CATALOGO_PRECARICATO.find((a) => a.id === id);
  if (!voce) throw new Error(`${id} non è nel catalogo`);
  return voce;
}

// Due alimenti veri del catalogo: uno di marca con il codice, uno sfuso.
const GOCCIOLE = dalCatalogo("off:8013355999143");
const MANDORLE = dalCatalogo("ciqual:15000");

async function miei(): Promise<Alimento[]> {
  return db.alimenti.filter((a) => a.user_id === USER).toArray();
}

describe("aggiungiDalCatalogo", () => {
  beforeEach(async () => {
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({ error: null });
    await db.alimenti.clear();
    await db.composizioni.clear();
    await db.composizioni_voci.clear();
    await db.outbox.clear();
  });

  // Nessuna sync lasciata a metà per il test dopo.
  afterEach(async () => {
    await attendi(async () => (await db.outbox.count()) === 0);
  });

  it("crea un alimento mio con tutti i valori del catalogo, i quattro nascosti compresi, e catalogo_id", async () => {
    const esito = await aggiungiDalCatalogo(USER, GOCCIOLE);
    expect(esito.esito).toBe("aggiunto");
    const [copia] = await miei();
    expect(copia).toEqual({
      id: expect.any(String),
      updated_at: expect.any(String),
      deleted_at: null,
      user_id: USER,
      nome: GOCCIOLE.nome,
      marca: GOCCIOLE.marca,
      barcode: GOCCIOLE.barcode,
      kcal_100g: GOCCIOLE.kcal_100g,
      proteine_100g: GOCCIOLE.proteine_100g,
      carboidrati_100g: GOCCIOLE.carboidrati_100g,
      grassi_100g: GOCCIOLE.grassi_100g,
      zuccheri_100g: GOCCIOLE.zuccheri_100g,
      fibre_100g: GOCCIOLE.fibre_100g,
      saturi_100g: GOCCIOLE.saturi_100g,
      sale_100g: GOCCIOLE.sale_100g,
      porzione_default_g: GOCCIOLE.porzione_default_g,
      fonte: "off",
      verificato: false,
      catalogo_id: "off:8013355999143",
    });
    // I quattro valori nascosti sono pieni davvero, non null.
    expect([
      copia.zuccheri_100g,
      copia.fibre_100g,
      copia.saturi_100g,
      copia.sale_100g,
    ]).not.toContain(null);
  });

  it("la copia sale al server con catalogo_id e i valori nascosti", async () => {
    const esito = await aggiungiDalCatalogo(USER, GOCCIOLE);
    await attendi(async () => (await db.outbox.count()) === 0);
    expect(upsertMock).toHaveBeenCalledWith(
      "alimenti",
      expect.objectContaining({
        id: esito.alimento.id,
        user_id: USER,
        catalogo_id: "off:8013355999143",
        zuccheri_100g: GOCCIOLE.zuccheri_100g,
        fibre_100g: GOCCIOLE.fibre_100g,
        saturi_100g: GOCCIOLE.saturi_100g,
        sale_100g: GOCCIOLE.sale_100g,
        verificato: false,
      })
    );
  });

  it("uno sfuso di Ciqual: fonte 'manuale', senza codice", async () => {
    await aggiungiDalCatalogo(USER, MANDORLE);
    const [copia] = await miei();
    expect(copia).toMatchObject({
      nome: "Mandorle",
      barcode: null,
      fonte: "manuale",
      catalogo_id: "ciqual:15000",
    });
  });

  it("il doppio tocco su «Aggiungi»: una riga sola, il secondo trova la prima", async () => {
    const [primo, secondo] = await Promise.all([
      aggiungiDalCatalogo(USER, MANDORLE),
      aggiungiDalCatalogo(USER, MANDORLE),
    ]);
    expect(await miei()).toHaveLength(1);
    expect([primo.esito, secondo.esito].sort()).toEqual(["aggiunto", "nei-tuoi"]);
    expect(primo.alimento.id).toBe(secondo.alimento.id);
  });

  it("lo stesso codice già fra i miei (creato a mano): niente scritto, «Apri» apre quello", async () => {
    const amano = await salvaAlimento(
      USER,
      {
        nome: "Biscotti",
        marca: null,
        kcal_100g: 480,
        proteine_100g: 6,
        carboidrati_100g: 65,
        grassi_100g: 21,
        porzione_default_g: 30,
      },
      undefined,
      { barcode: "8013355999143", fonte: "barcode" }
    );
    expect(amano.esito).toBe("salvato");
    await attendi(async () => (await db.outbox.count()) === 0);
    upsertMock.mockClear();

    const esito = await aggiungiDalCatalogo(USER, GOCCIOLE);
    expect(esito.esito).toBe("nei-tuoi");
    expect(esito.alimento.nome).toBe("Biscotti");
    expect(await miei()).toHaveLength(1);
    expect(await db.outbox.count()).toBe(0);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("stesso nome e marca già fra i miei: niente scritto", async () => {
    await salvaAlimento(USER, {
      nome: "gocciole chocolate",
      marca: "PAVESI",
      kcal_100g: 480,
      proteine_100g: 6,
      carboidrati_100g: 65,
      grassi_100g: 21,
      porzione_default_g: 30,
    });
    const esito = await aggiungiDalCatalogo(USER, GOCCIOLE);
    expect(esito.esito).toBe("nei-tuoi");
    expect(await miei()).toHaveLength(1);
  });

  it("una copia rinominata con Modifica resta «Nei tuoi»: la modifica non toglie catalogo_id", async () => {
    const { alimento } = await aggiungiDalCatalogo(USER, MANDORLE);
    const rinomina = await salvaAlimento(
      USER,
      {
        nome: "Mandorle tostate",
        marca: "Mia",
        kcal_100g: 620,
        proteine_100g: 19,
        carboidrati_100g: 9,
        grassi_100g: 52,
        porzione_default_g: 25,
      },
      alimento.id
    );
    expect(rinomina.esito).toBe("salvato");
    expect(await db.alimenti.get(alimento.id)).toMatchObject({
      nome: "Mandorle tostate",
      catalogo_id: "ciqual:15000",
    });

    const esito = await aggiungiDalCatalogo(USER, MANDORLE);
    expect(esito).toMatchObject({ esito: "nei-tuoi", alimento: { id: alimento.id } });
    expect(await miei()).toHaveLength(1);
  });

  it("Annulla dopo «Aggiungi», poi di nuovo «Aggiungi»: una riga nuova, la vecchia resta cancellata", async () => {
    const primo = await aggiungiDalCatalogo(USER, MANDORLE);
    await eliminaAlimenti(USER, [primo.alimento.id]);
    expect((await db.alimenti.get(primo.alimento.id))?.deleted_at).not.toBeNull();

    const secondo = await aggiungiDalCatalogo(USER, MANDORLE);
    expect(secondo.esito).toBe("aggiunto");
    expect(secondo.alimento.id).not.toBe(primo.alimento.id);
    expect((await db.alimenti.get(primo.alimento.id))?.deleted_at).not.toBeNull();
    const vivi = (await miei()).filter((a) => a.deleted_at === null);
    expect(vivi.map((a) => a.id)).toEqual([secondo.alimento.id]);
  });

  it("un alimento creato a mano nasce con catalogo_id null, scritto", async () => {
    const esito = await salvaAlimento(USER, {
      nome: "Pane",
      marca: null,
      kcal_100g: 260,
      proteine_100g: 8,
      carboidrati_100g: 50,
      grassi_100g: 2,
      porzione_default_g: 50,
    });
    expect(esito.esito).toBe("salvato");
    const riga = await db.alimenti.get((esito as { alimento: Alimento }).alimento.id);
    expect(riga).toHaveProperty("catalogo_id", null);
  });
});
