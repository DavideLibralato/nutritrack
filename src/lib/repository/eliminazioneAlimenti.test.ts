// Eliminazione e ripristino di più alimenti insieme (Impostazioni >
// Alimenti, selezione multipla; PUNTO_DI_PARTENZA.md sezione 3,
// "Alimenti"). Test permanenti: sono errori che non fanno rumore e si
// scoprono mesi dopo.
// - Due alimenti dello stesso pasto salvato eliminati insieme: il pasto
//   deve sparire, non restare un guscio vuoto (il bug del 22/09 rifatto per
//   un'altra strada, se la cascata si facesse un alimento alla volta).
// - Tutto o niente: un guasto a metà non deve lasciare un pasto salvato con
//   un ingrediente in meno per un alimento rimasto nel catalogo, né righe
//   nell'outbox che la sync manderebbe a Supabase.
// - L'Annulla rimette esattamente ciò che quella eliminazione ha toccato.
// - Diario e preferiti non si toccano.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db/database";
import type { Alimento, Composizione, ComposizioneVoce, Preferito, VoceDiario } from "../db/tipi";
import { repositoryAlimenti, repositoryComposizioniVoci } from "./index";
import { eliminaAlimenti, ripristinaAlimenti } from "./composizioni";
import { catalogoLocale } from "./alimenti";
import { pastiSalvati } from "../inserimento/pastiSalvati";
import { alimentiPreferiti } from "../inserimento/preferiti";

// Server sempre irraggiungibile: le scritture restano nella coda outbox,
// dove i test le guardano (stesso schema di modifichePasti.test.ts).
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      upsert: async () => ({ error: { message: "offline" } }),
    }),
  }),
}));

const USER = "utente-elimina-alimenti";
const BASE = { user_id: USER, updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null };

function alimento(id: string, altro: Partial<Alimento> = {}): Alimento {
  return {
    ...BASE,
    id,
    nome: id,
    marca: null,
    barcode: null,
    kcal_100g: 100,
    proteine_100g: 5,
    carboidrati_100g: 10,
    grassi_100g: 2,
    zuccheri_100g: null,
    fibre_100g: null,
    saturi_100g: null,
    sale_100g: null,
    porzione_default_g: 100,
    fonte: "manuale",
    verificato: false,
    ...altro,
  };
}

function pastoSalvato(id: string, nome = id): Composizione {
  return { ...BASE, id, nome, tipo: "pasto_salvato", alimento_id: null };
}

function riga(composizioneId: string, alimentoId: string, ordine: number): ComposizioneVoce {
  return {
    ...BASE,
    id: `${composizioneId}-${alimentoId}`,
    composizione_id: composizioneId,
    alimento_id: alimentoId,
    quantita_g: 100,
    ordine,
  };
}

function voceDiario(id: string, alimentoId: string): VoceDiario {
  return {
    ...BASE,
    id,
    alimento_id: alimentoId,
    pasto_id: "pranzo",
    gruppo_id: null,
    quantita_g: 80,
    data: "2026-10-14",
    creato_il: "2026-10-14T12:00:00.000Z",
    consumato_alle: null,
    nome_alimento: alimentoId,
    kcal_100g: 100,
    proteine_100g: 5,
    carboidrati_100g: 10,
    grassi_100g: 2,
  };
}

// Il catalogo di partenza, scritto direttamente in Dexie (niente outbox):
// - "Colazione": avena + latte → si eliminano tutti e due, resta vuoto;
// - "Cena": pane + latte → resta con il pane;
// - "Spuntino": mela → non toccato.
async function catalogoDiPartenza() {
  await db.alimenti.bulkPut([
    alimento("avena"),
    alimento("latte"),
    alimento("pane"),
    alimento("mela"),
  ]);
  await db.composizioni.bulkPut([
    pastoSalvato("colazione", "Colazione"),
    pastoSalvato("cena", "Cena"),
    pastoSalvato("spuntino", "Spuntino"),
  ]);
  await db.composizioni_voci.bulkPut([
    riga("colazione", "avena", 0),
    riga("colazione", "latte", 1),
    riga("cena", "pane", 0),
    riga("cena", "latte", 1),
    riga("spuntino", "mela", 0),
  ]);
}

async function vivo(tabella: "alimenti" | "composizioni" | "composizioni_voci", id: string) {
  const r = await db.table(tabella).get(id);
  if (!r) throw new Error(`manca ${tabella}:${id}`);
  return r.deleted_at === null;
}

async function nomiPastiSalvati(): Promise<string[]> {
  const [catalogo, composizioni, composizioniVoci] = await Promise.all([
    catalogoLocale(USER),
    db.composizioni.filter((c) => c.deleted_at === null).toArray(),
    repositoryComposizioniVoci.ottieniTutti(USER),
  ]);
  return pastiSalvati(catalogo, composizioni, composizioniVoci).map((p) => p.nome);
}

beforeEach(async () => {
  await Promise.all([
    db.alimenti.clear(),
    db.composizioni.clear(),
    db.composizioni_voci.clear(),
    db.voci_diario.clear(),
    db.preferiti.clear(),
    db.outbox.clear(),
  ]);
  await catalogoDiPartenza();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("eliminaAlimenti", () => {
  it("due alimenti dello stesso pasto salvato: il pasto sparisce, non resta un guscio vuoto", async () => {
    const traccia = await eliminaAlimenti(USER, ["avena", "latte"]);

    expect(await vivo("alimenti", "avena")).toBe(false);
    expect(await vivo("alimenti", "latte")).toBe(false);
    // Colazione aveva solo avena e latte: cancellata, con le sue due righe.
    expect(await vivo("composizioni", "colazione")).toBe(false);
    expect(await vivo("composizioni_voci", "colazione-avena")).toBe(false);
    expect(await vivo("composizioni_voci", "colazione-latte")).toBe(false);
    // Cena resta, con il solo pane.
    expect(await vivo("composizioni", "cena")).toBe(true);
    expect(await vivo("composizioni_voci", "cena-latte")).toBe(false);
    expect(await vivo("composizioni_voci", "cena-pane")).toBe(true);
    expect(await nomiPastiSalvati()).toEqual(["Cena", "Spuntino"]);

    expect(traccia.idAlimenti.sort()).toEqual(["avena", "latte"]);
    expect(traccia.idComposizioni).toEqual(["colazione"]);
    expect(traccia.idComposizioniVoci.sort()).toEqual([
      "cena-latte",
      "colazione-avena",
      "colazione-latte",
    ]);
  });

  it("tutto o niente: un guasto a metà non lascia alimenti, pasti né righe cancellati, né voci in coda", async () => {
    let chiamate = 0;
    const originale = repositoryAlimenti.elimina;
    vi.spyOn(repositoryAlimenti, "elimina").mockImplementation(async (id) => {
      chiamate++;
      if (chiamate === 2) throw new Error("guasto a metà");
      return originale(id);
    });

    await expect(eliminaAlimenti(USER, ["avena", "latte"])).rejects.toThrow("guasto a metà");

    // La cascata sui pasti salvati era già scritta prima del guasto: deve
    // essere tornata indietro anche lei.
    for (const id of ["avena", "latte", "pane", "mela"]) {
      expect(await vivo("alimenti", id)).toBe(true);
    }
    for (const id of ["colazione", "cena", "spuntino"]) {
      expect(await vivo("composizioni", id)).toBe(true);
    }
    for (const id of ["colazione-avena", "colazione-latte", "cena-pane", "cena-latte"]) {
      expect(await vivo("composizioni_voci", id)).toBe(true);
    }
    expect(await db.outbox.count()).toBe(0);
  });

  it("un alimento già cancellato si salta e non entra nella traccia", async () => {
    await db.alimenti.put(alimento("mela", { deleted_at: "2026-10-10T00:00:00.000Z" }));

    const traccia = await eliminaAlimenti(USER, ["mela", "pane"]);
    expect(traccia.idAlimenti).toEqual(["pane"]);

    // L'Annulla non resuscita una cancellazione che non era sua.
    await ripristinaAlimenti(USER, traccia);
    expect(await vivo("alimenti", "pane")).toBe(true);
    expect(await vivo("alimenti", "mela")).toBe(false);
  });

  it("un alimento che non è dell'utente blocca tutto, anche gli altri", async () => {
    await db.alimenti.put(alimento("comune", { user_id: null, verificato: true }));

    await expect(eliminaAlimenti(USER, ["pane", "comune"])).rejects.toThrow();

    expect(await vivo("alimenti", "pane")).toBe(true);
    expect(await vivo("alimenti", "comune")).toBe(true);
    expect(await vivo("composizioni_voci", "cena-pane")).toBe(true);
    expect(await db.outbox.count()).toBe(0);
  });

  it("diario e preferiti non si toccano; i preferiti tornano con l'Annulla", async () => {
    await db.voci_diario.put(voceDiario("v1", "latte"));
    const preferito: Preferito = { ...BASE, id: "pref-latte", alimento_id: "latte" };
    await db.preferiti.put(preferito);
    const vociPrima = await db.voci_diario.toArray();

    const traccia = await eliminaAlimenti(USER, ["latte"]);

    expect(await db.voci_diario.toArray()).toEqual(vociPrima);
    expect((await db.preferiti.get("pref-latte"))?.deleted_at).toBeNull();
    // Nascosto finché l'alimento è cancellato...
    const nomiPreferiti = async () =>
      alimentiPreferiti(await catalogoLocale(USER), await db.preferiti.toArray(), []).map(
        (p) => p.alimento.id
      );
    expect(await nomiPreferiti()).toEqual([]);

    // ...e di nuovo visibile dopo l'Annulla, senza averlo toccato.
    await ripristinaAlimenti(USER, traccia);
    expect(await nomiPreferiti()).toEqual(["latte"]);
  });
});

describe("ripristinaAlimenti", () => {
  it("rimette tutto com'era: alimenti, il pasto rimasto vuoto e le righe", async () => {
    const traccia = await eliminaAlimenti(USER, ["avena", "latte"]);
    const esito = await ripristinaAlimenti(USER, traccia);

    expect(esito.pastiNonRipristinati).toEqual([]);
    for (const id of ["avena", "latte"]) expect(await vivo("alimenti", id)).toBe(true);
    expect(await vivo("composizioni", "colazione")).toBe(true);
    for (const id of ["colazione-avena", "colazione-latte", "cena-latte"]) {
      expect(await vivo("composizioni_voci", id)).toBe(true);
    }
    expect(await nomiPastiSalvati()).toEqual(["Cena", "Colazione", "Spuntino"]);
  });

  it("una riga cancellata prima dell'eliminazione non torna", async () => {
    // Molto prima: il latte era già stato tolto a mano dalla Cena.
    await db.composizioni_voci.put({
      ...riga("cena", "latte", 1),
      deleted_at: "2026-10-05T00:00:00.000Z",
    });

    const traccia = await eliminaAlimenti(USER, ["avena", "latte"]);
    expect(traccia.idComposizioniVoci).not.toContain("cena-latte");

    await ripristinaAlimenti(USER, traccia);
    expect(await vivo("composizioni_voci", "cena-latte")).toBe(false);
    expect(await vivo("composizioni_voci", "colazione-latte")).toBe(true);
  });

  it("un pasto vuoto il cui nome nel frattempo è stato preso non torna, gli alimenti sì", async () => {
    const traccia = await eliminaAlimenti(USER, ["avena", "latte"]);
    // Durante la finestra dell'Annulla nasce un'altra "Colazione", con la mela.
    await db.composizioni.put(pastoSalvato("colazione-2", "Colazione"));
    await db.composizioni_voci.put(riga("colazione-2", "mela", 0));

    const esito = await ripristinaAlimenti(USER, traccia);

    expect(esito.pastiNonRipristinati).toEqual(["Colazione"]);
    for (const id of ["avena", "latte"]) expect(await vivo("alimenti", id)).toBe(true);
    expect(await vivo("composizioni", "colazione")).toBe(false);
    // Le sue righe restano cancellate (sarebbero orfane); quella della Cena torna.
    expect(await vivo("composizioni_voci", "colazione-avena")).toBe(false);
    expect(await vivo("composizioni_voci", "cena-latte")).toBe(true);
  });

  it("un alimento uguale nato nel frattempo: quello cancellato non torna, né le sue righe né il pasto rimasto vuoto", async () => {
    // Si eliminano avena e latte; durante la finestra dell'Annulla nasce
    // un altro "latte" (stesso nome, maiuscole diverse, nessuna marca).
    const traccia = await eliminaAlimenti(USER, ["avena", "latte"]);
    await db.alimenti.put(alimento("latte-nuovo", { nome: "LATTE" }));

    const esito = await ripristinaAlimenti(USER, traccia);

    expect(esito.alimentiNonRipristinati).toEqual([{ nome: "latte", etichetta: "latte" }]);
    expect(esito.pastiNonRipristinati).toEqual([]);
    expect(await vivo("alimenti", "avena")).toBe(true);
    expect(await vivo("alimenti", "latte")).toBe(false);
    // Le righe del latte restano cancellate: punterebbero a un alimento
    // cancellato. Quella dell'avena torna, e con lei la Colazione.
    expect(await vivo("composizioni_voci", "colazione-latte")).toBe(false);
    expect(await vivo("composizioni_voci", "cena-latte")).toBe(false);
    expect(await vivo("composizioni_voci", "colazione-avena")).toBe(true);
    expect(await vivo("composizioni", "colazione")).toBe(true);
  });

  it("un pasto salvato che tornerebbe vuoto, perché il suo alimento non torna, resta cancellato", async () => {
    // Spuntino ha solo la mela: eliminandola, sparisce anche lui.
    const traccia = await eliminaAlimenti(USER, ["mela"]);
    expect(traccia.idComposizioni).toEqual(["spuntino"]);
    await db.alimenti.put(alimento("mela-2", { nome: "Mela" }));

    const esito = await ripristinaAlimenti(USER, traccia);

    expect(esito.alimentiNonRipristinati.map((a) => a.nome)).toEqual(["mela"]);
    // Il motivo è l'alimento, già detto: il pasto non va nell'elenco.
    expect(esito.pastiNonRipristinati).toEqual([]);
    expect(await vivo("alimenti", "mela")).toBe(false);
    expect(await vivo("composizioni", "spuntino")).toBe(false);
    expect(await vivo("composizioni_voci", "spuntino-mela")).toBe(false);
    expect(await nomiPastiSalvati()).toEqual(["Cena", "Colazione"]);
  });

  it("un alimento uguale ma di un'altra marca non blocca il ripristino", async () => {
    const traccia = await eliminaAlimenti(USER, ["pane"]);
    await db.alimenti.put(alimento("pane-mulino", { nome: "pane", marca: "Mulino" }));

    const esito = await ripristinaAlimenti(USER, traccia);

    expect(esito.alimentiNonRipristinati).toEqual([]);
    expect(await vivo("alimenti", "pane")).toBe(true);
    expect(await vivo("composizioni_voci", "cena-pane")).toBe(true);
  });

  it("tutto o niente: un guasto a metà lascia tutto ancora cancellato, e riprovare converge", async () => {
    const traccia = await eliminaAlimenti(USER, ["avena", "latte"]);
    await db.outbox.clear();

    const originale = repositoryComposizioniVoci.aggiorna;
    const spia = vi
      .spyOn(repositoryComposizioniVoci, "aggiorna")
      .mockImplementation(async (id, modifiche) => {
        if (spia.mock.calls.length === 2) throw new Error("guasto a metà");
        return originale(id, modifiche);
      });

    await expect(ripristinaAlimenti(USER, traccia)).rejects.toThrow("guasto a metà");

    // Gli alimenti erano già stati rimessi in vita prima del guasto: tornati
    // cancellati anche loro.
    for (const id of ["avena", "latte"]) expect(await vivo("alimenti", id)).toBe(false);
    expect(await vivo("composizioni", "colazione")).toBe(false);
    for (const id of traccia.idComposizioniVoci) {
      expect(await vivo("composizioni_voci", id)).toBe(false);
    }
    expect(await db.outbox.count()).toBe(0);

    // La barra ripropone l'Annulla: il secondo tentativo riesce intero.
    spia.mockRestore();
    await ripristinaAlimenti(USER, traccia);
    expect(await nomiPastiSalvati()).toEqual(["Cena", "Colazione", "Spuntino"]);
  });
});
