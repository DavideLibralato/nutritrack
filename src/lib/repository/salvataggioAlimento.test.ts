// Test permanenti per salvaAlimento (src/lib/repository/alimenti.ts), il
// Salva di "Nuovo alimento" e "Modifica alimento". Proteggono il controllo
// del doppione AL SALVA, quello che il form non può fare da solo:
// - un alimento uguale nato dopo l'ultimo ridisegno del form (un altro
//   dispositivo, via sync) non deve diventare un secondo alimento;
// - il doppio tocco su Salva: due salvataggi partiti insieme, prima che il
//   pulsante si spenga, devono scrivere una riga sola.
// Sono race condition: non fanno rumore e si scoprono mesi dopo.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import type { Alimento } from "../db/tipi";
import { salvaAlimento, type CampiForm } from "./alimenti";

// Server sempre irraggiungibile: le scritture restano nella coda outbox,
// dove i test le guardano (stesso schema di eliminazioneAlimenti.test.ts).
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      upsert: async () => ({ error: { message: "offline" } }),
    }),
  }),
}));

const USER = "utente-salva-alimento";

function campi(nome: string, marca: string | null = null): CampiForm {
  return {
    nome,
    marca,
    kcal_100g: 250,
    grassi_100g: 2,
    carboidrati_100g: 50,
    proteine_100g: 8,
    porzione_default_g: 50,
  };
}

// Un alimento scritto direttamente in Dexie, come lo lascia la sync in
// discesa (niente outbox).
function arrivatoDallaSync(id: string, nome: string, marca: string | null): Alimento {
  return {
    ...campi(nome, marca),
    id,
    user_id: USER,
    updated_at: "2026-10-16T00:00:00.000Z",
    deleted_at: null,
    barcode: null,
    zuccheri_100g: null,
    fibre_100g: null,
    saturi_100g: null,
    sale_100g: null,
    fonte: "manuale",
    verificato: false,
  };
}

async function vivi(): Promise<Alimento[]> {
  return db.alimenti.filter((a) => a.deleted_at === null).toArray();
}

beforeEach(async () => {
  await Promise.all([db.alimenti.clear(), db.outbox.clear()]);
});

describe("salvaAlimento", () => {
  it("crea un alimento nuovo, con gli spazi di nome e marca normalizzati", async () => {
    const esito = await salvaAlimento(USER, campi("  Pane   di segale ", "  "));

    expect(esito.esito).toBe("salvato");
    const [unico] = await vivi();
    expect(unico.nome).toBe("Pane di segale");
    expect(unico.marca).toBeNull();
    expect(await db.outbox.count()).toBe(1);
  });

  it("un alimento uguale arrivato dalla sync dopo il ridisegno: al Salva niente scritto", async () => {
    // Il form ha controllato quando il catalogo era vuoto; poi la sync
    // porta "Pane · Mulino" da un altro telefono, e l'utente tocca Salva.
    await db.alimenti.put(arrivatoDallaSync("da-altro-telefono", "Pane", "Mulino"));

    const esito = await salvaAlimento(USER, campi("PANE", " mulino "));

    expect(esito).toMatchObject({ esito: "doppione", doppione: { id: "da-altro-telefono" } });
    expect((await vivi()).map((a) => a.id)).toEqual(["da-altro-telefono"]);
    expect(await db.outbox.count()).toBe(0);
  });

  it("doppio tocco su Salva: due salvataggi insieme scrivono una riga sola", async () => {
    const [primo, secondo] = await Promise.all([
      salvaAlimento(USER, campi("Banana")),
      salvaAlimento(USER, campi("Banana")),
    ]);

    expect([primo.esito, secondo.esito].sort()).toEqual(["doppione", "salvato"]);
    expect(await vivi()).toHaveLength(1);
    expect(await db.outbox.count()).toBe(1);
  });

  it("in Modifica: rinominare verso un altro alimento non scrive; cambiare solo maiuscole sì", async () => {
    await db.alimenti.bulkPut([
      arrivatoDallaSync("pane", "pane", null),
      arrivatoDallaSync("latte", "Latte", null),
    ]);

    const versoAltro = await salvaAlimento(USER, campi("latte"), "pane");
    expect(versoAltro).toMatchObject({ esito: "doppione", doppione: { id: "latte" } });
    expect((await db.alimenti.get("pane"))?.nome).toBe("pane");

    const soloMaiuscole = await salvaAlimento(USER, campi("Pane"), "pane");
    expect(soloMaiuscole.esito).toBe("salvato");
    expect((await db.alimenti.get("pane"))?.nome).toBe("Pane");
  });

  it("un alimento cancellato o del catalogo comune non blocca", async () => {
    await db.alimenti.bulkPut([
      { ...arrivatoDallaSync("cancellato", "Mela", null), deleted_at: "2026-10-15T00:00:00.000Z" },
      { ...arrivatoDallaSync("comune", "Kiwi", null), user_id: null, verificato: true },
    ]);

    expect((await salvaAlimento(USER, campi("Mela"))).esito).toBe("salvato");
    expect((await salvaAlimento(USER, campi("Kiwi"))).esito).toBe("salvato");
  });
});

// Dal branch `codice-a-barre` (PUNTO_DI_PARTENZA.md §3, "Codice a barre",
// "`fonte` e `barcode`"). Proteggono quello che nessuno vede: un codice
// non scritto fa cercare il prodotto su Open Food Facts a ogni scansione;
// una fonte sbagliata dice "scritto a mano" di valori presi da OFF; e il
// controllo per codice deve stare nella stessa transazione, come quello
// per nome.
describe("salvaAlimento con il codice a barre", () => {
  const NUTELLA = "3017620422003";

  it("in creazione scrive il codice e la fonte 'off'", async () => {
    const esito = await salvaAlimento(USER, campi("Nutella", "Ferrero"), undefined, {
      barcode: NUTELLA,
      fonte: "off",
    });

    expect(esito.esito).toBe("salvato");
    const [unico] = await vivi();
    expect(unico.barcode).toBe(NUTELLA);
    expect(unico.fonte).toBe("off");
    expect(unico.verificato).toBe(false);
  });

  it("valori scritti a mano: fonte 'barcode'; senza codice resta 'manuale' e barcode null", async () => {
    await salvaAlimento(USER, campi("Crema"), undefined, { barcode: "96385074", fonte: "barcode" });
    await salvaAlimento(USER, campi("Pane"));

    const perNome = Object.fromEntries((await vivi()).map((a) => [a.nome, a]));
    expect(perNome["Crema"]).toMatchObject({ barcode: "96385074", fonte: "barcode" });
    expect(perNome["Pane"]).toMatchObject({ barcode: null, fonte: "manuale" });
  });

  it("stesso codice arrivato dalla sync dopo il ridisegno, con un altro nome: niente scritto", async () => {
    await db.alimenti.put({
      ...arrivatoDallaSync("da-altro-telefono", "Nutella", "Ferrero"),
      barcode: NUTELLA,
      fonte: "off",
    });

    const esito = await salvaAlimento(USER, campi("Crema alle nocciole"), undefined, {
      barcode: NUTELLA,
      fonte: "off",
    });

    expect(esito).toMatchObject({ esito: "doppione", doppione: { id: "da-altro-telefono" } });
    expect(await vivi()).toHaveLength(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it("doppio tocco su Salva con lo stesso codice: una riga sola", async () => {
    const origine = { barcode: NUTELLA, fonte: "off" as const };
    const [primo, secondo] = await Promise.all([
      salvaAlimento(USER, campi("Nutella"), undefined, origine),
      salvaAlimento(USER, campi("Nutella"), undefined, origine),
    ]);

    expect([primo.esito, secondo.esito].sort()).toEqual(["doppione", "salvato"]);
    expect(await vivi()).toHaveLength(1);
  });

  it("in Modifica codice e fonte restano quelli della riga, anche se ne arriva un'origine", async () => {
    await db.alimenti.put({
      ...arrivatoDallaSync("nutella", "Nutella", null),
      barcode: NUTELLA,
      fonte: "off",
    });

    const esito = await salvaAlimento(USER, campi("Nutella", "Ferrero"), "nutella", {
      barcode: "96385074",
      fonte: "barcode",
    });

    expect(esito.esito).toBe("salvato");
    expect(await db.alimenti.get("nutella")).toMatchObject({
      marca: "Ferrero",
      barcode: NUTELLA,
      fonte: "off",
    });
  });

  it("in Modifica un altro alimento con lo stesso codice (due telefoni offline) non blocca", async () => {
    await db.alimenti.bulkPut([
      { ...arrivatoDallaSync("primo", "Nutella", null), barcode: NUTELLA },
      { ...arrivatoDallaSync("secondo", "Crema", null), barcode: NUTELLA },
    ]);

    // Anche se chi chiama passa l'origine: in Modifica il codice non si
    // confronta, non cambia e non può far nascere un doppione.
    const esito = await salvaAlimento(USER, campi("Crema alle nocciole"), "secondo", {
      barcode: NUTELLA,
      fonte: "off",
    });

    expect(esito.esito).toBe("salvato");
    expect((await db.alimenti.get("secondo"))?.nome).toBe("Crema alle nocciole");
  });
});

// Dal branch `alimenti-codice-a-barre` (PUNTO_DI_PARTENZA.md §3, "Codice
// a barre", "Il codice in modifica"): il codice aggiunto a un alimento
// che non ce l'aveva. Proteggono tre cose che a schermo non si vedono:
// la regola "stesso codice = stesso prodotto" anche qui, nella
// transazione; un codice arrivato con la sync che non va sovrascritto;
// la fonte che non cambia.
describe("salvaAlimento in Modifica con un codice da aggiungere", () => {
  const PATATINE = "8000500310427";
  const KETCHIPS = "8008714001827";

  it("scrive codice e valori in un solo aggiornamento; la fonte non cambia", async () => {
    await db.alimenti.put(arrivatoDallaSync("patatine", "Patatine", "San Carlo"));

    const esito = await salvaAlimento(
      USER,
      { ...campi("Patatine", "San Carlo"), kcal_100g: 537 },
      "patatine",
      undefined,
      PATATINE
    );

    expect(esito.esito).toBe("salvato");
    expect(await db.alimenti.get("patatine")).toMatchObject({
      barcode: PATATINE,
      kcal_100g: 537,
      fonte: "manuale",
      verificato: false,
    });
    const coda = await db.outbox.toArray();
    expect(coda).toHaveLength(1);
    expect(coda[0].dati).toMatchObject({ id: "patatine", barcode: PATATINE, kcal_100g: 537 });
  });

  it("il codice è già di un altro alimento vivo: doppione, niente scritto", async () => {
    await db.alimenti.bulkPut([
      { ...arrivatoDallaSync("ketchips", "Ketchips", "Amica Chips"), barcode: KETCHIPS, fonte: "off" },
      arrivatoDallaSync("patatine", "Patatine", null),
    ]);

    const esito = await salvaAlimento(USER, campi("Patatine fritte"), "patatine", undefined, KETCHIPS);

    expect(esito).toMatchObject({ esito: "doppione", doppione: { id: "ketchips" } });
    expect(await db.alimenti.get("patatine")).toMatchObject({ nome: "Patatine", barcode: null });
    expect(await db.outbox.count()).toBe(0);
  });

  it("intanto la riga ha ricevuto un altro codice (sync): non si sovrascrive, niente scritto", async () => {
    // Il form aveva letto la riga senza codice; poi arriva dalla sync la
    // stessa riga con un codice messo da un altro telefono.
    await db.alimenti.put({ ...arrivatoDallaSync("patatine", "Patatine", null), barcode: KETCHIPS });

    const esito = await salvaAlimento(USER, campi("Patatine fritte"), "patatine", undefined, PATATINE);

    expect(esito).toEqual({ esito: "ha-gia-codice", barcode: KETCHIPS });
    expect(await db.alimenti.get("patatine")).toMatchObject({ nome: "Patatine", barcode: KETCHIPS });
    expect(await db.outbox.count()).toBe(0);
  });

  it("intanto la riga ha ricevuto lo stesso codice: si salva normalmente", async () => {
    await db.alimenti.put({ ...arrivatoDallaSync("patatine", "Patatine", null), barcode: PATATINE });

    const esito = await salvaAlimento(USER, campi("Patatine fritte"), "patatine", undefined, PATATINE);

    expect(esito.esito).toBe("salvato");
    expect(await db.alimenti.get("patatine")).toMatchObject({ nome: "Patatine fritte", barcode: PATATINE });
  });

  it("un alimento cancellato o del catalogo comune con lo stesso codice non blocca", async () => {
    await db.alimenti.bulkPut([
      { ...arrivatoDallaSync("cancellato", "Ketchips", null), barcode: KETCHIPS, deleted_at: "2026-11-01T00:00:00.000Z" },
      { ...arrivatoDallaSync("comune", "Ketchips", null), barcode: PATATINE, user_id: null, verificato: true },
      arrivatoDallaSync("a", "A", null),
      arrivatoDallaSync("b", "B", null),
    ]);

    expect((await salvaAlimento(USER, campi("A"), "a", undefined, KETCHIPS)).esito).toBe("salvato");
    expect((await salvaAlimento(USER, campi("B"), "b", undefined, PATATINE)).esito).toBe("salvato");
  });

  it("in creazione il codice da aggiungere si ignora: vale solo l'origine", async () => {
    const esito = await salvaAlimento(USER, campi("Pane"), undefined, undefined, PATATINE);

    expect(esito.esito).toBe("salvato");
    expect((await vivi())[0]).toMatchObject({ barcode: null, fonte: "manuale" });
  });
});
