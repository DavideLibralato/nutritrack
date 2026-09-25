// Il ripristino dei dati locali sostituisce in blocco i dati di un utente
// su questo dispositivo: un errore qui non fa rumore e costa dati veri.
// Casi fissati per sempre (PUNTO_DI_PARTENZA.md, §9.2, "Ripristino dei dati
// locali"):
// - uno scarico fallito, anche su una sola tabella, non tocca il locale;
// - modifiche non inviate che l'utente non ha confermato di perdere
//   (in attesa o accantonate) non tocca il locale;
// - con la conferma, il locale è sostituito;
// - dopo il ripristino la discesa riparte incrementale dai cursori;
// - una riga che esiste solo in locale (per esempio cancellata fisicamente
//   sul server) sparisce;
// - i dati di un altro utente sul dispositivo restano intatti, compreso il
//   catalogo condiviso che la sua discesa incrementale non riscaricherebbe.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import { scaricaTabella } from "./discesa";
import { modificheNonInviate, ripristinaDatiLocali } from "./ripristino";
import type { Alimento, NomeTabella, Pasto } from "../db/tipi";
import type { VoceOutbox } from "./outbox";

// Supabase finto: ogni tabella risponde con le righe di `server[tabella]`
// (una pagina sola, sotto la dimensione di pagina), oppure con un errore se
// è in `tabelleInErrore`. `filtriGte` registra i filtri "da questa data"
// ricevuti, per il test della discesa incrementale.
let server: Partial<Record<NomeTabella, unknown[]>> = {};
let tabelleInErrore = new Set<NomeTabella>();
let filtriGte: Partial<Record<NomeTabella, unknown[]>> = {};

function builderPer(nome: NomeTabella) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    gte: vi.fn((...args: unknown[]) => {
      filtriGte[nome] = args;
      return builder;
    }),
    range: vi.fn(() => builder),
    then: (risolvi: (v: { data: unknown[] | null; error: { message: string } | null }) => void) =>
      risolvi(
        tabelleInErrore.has(nome)
          ? { data: null, error: { message: "rete giù" } }
          : { data: server[nome] ?? [], error: null }
      ),
  };
  return builder;
}

vi.mock("../supabase/client", () => ({
  createClient: () => ({ from: (nome: NomeTabella) => builderPer(nome) }),
}));

beforeEach(() => {
  server = {};
  tabelleInErrore = new Set();
  filtriGte = {};
});

function pasto(userId: string, nome: string, updatedAt: string, id = crypto.randomUUID()): Pasto {
  return {
    id,
    user_id: userId,
    updated_at: updatedAt,
    deleted_at: null,
    nome,
    ora_inizio: "12:30",
    ordine: 0,
  };
}

function alimento(userId: string | null, nome: string, updatedAt: string, id = crypto.randomUUID()): Alimento {
  return {
    id,
    user_id: userId,
    updated_at: updatedAt,
    deleted_at: null,
    nome,
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
  };
}

function voceOutbox(riga: Pasto, sospesa = false): VoceOutbox {
  return {
    id: `pasti:${riga.id}`,
    tabella: "pasti",
    record_id: riga.id,
    dati: riga,
    creato_il: new Date().toISOString(),
    tentativi: sospesa ? 5 : 0,
    ultimo_errore: sospesa ? "errore" : null,
    sospesa_il: sospesa ? new Date().toISOString() : null,
  };
}

// Scenario di prova (non il caso reale del 2026-09-25, dove i doppioni
// erano ancora anche sul server): in locale 5 pasti con id casuali, spariti
// dal server perché cancellati fisicamente, accanto ai 5 canonici; sul
// server solo i 5 canonici.
async function dispositivoConPastiDoppi(userId: string) {
  const vecchi = ["Colazione", "Spuntino", "Pranzo", "Merenda", "Cena"].map((n) =>
    pasto(userId, n, "2026-09-01T08:00:00.000Z")
  );
  const canonici = ["Colazione", "Spuntino", "Pranzo", "Merenda", "Cena"].map((n, i) =>
    pasto(userId, n, `2026-09-20T08:00:0${i}.000Z`)
  );
  await db.pasti.bulkPut([...vecchi, ...canonici]);
  server.pasti = canonici;
  return { vecchi, canonici };
}

async function pastiLocali(userId: string) {
  return db.pasti.where("user_id").equals(userId).toArray();
}

describe("ripristinaDatiLocali", () => {
  it("una riga che esiste solo in locale sparisce, restano quelle del server", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const { canonici } = await dispositivoConPastiDoppi(userId);
    expect(await pastiLocali(userId)).toHaveLength(10);

    const esito = await ripristinaDatiLocali(userId, []);
    expect(esito.esito).toBe("ripristinato");

    const dopo = await pastiLocali(userId);
    expect(dopo.map((p) => p.id).sort()).toEqual(canonici.map((p) => p.id).sort());
  });

  it("scarico fallito anche su una sola tabella → il locale resta intatto", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    await dispositivoConPastiDoppi(userId);
    await db.sync_cursori.put({
      id: `pasti:${userId}`,
      tabella: "pasti",
      user_id: userId,
      ultimo_aggiornamento: "2026-09-20T08:00:04.000Z",
    });
    tabelleInErrore.add("misurazioni");

    const esito = await ripristinaDatiLocali(userId, []);
    expect(esito.esito).toBe("scarico-fallito");

    expect(await pastiLocali(userId)).toHaveLength(10);
    expect((await db.sync_cursori.get(`pasti:${userId}`))?.ultimo_aggiornamento).toBe(
      "2026-09-20T08:00:04.000Z"
    );
  });

  it("modifica in attesa non confermata → il locale resta intatto, anche la modifica", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    await dispositivoConPastiDoppi(userId);
    const modificato = pasto(userId, "Pranzo tardi", "2026-09-25T13:00:00.000Z");
    await db.pasti.put(modificato);
    await db.outbox.put(voceOutbox(modificato));

    const esito = await ripristinaDatiLocali(userId, []);
    expect(esito.esito).toBe("modifiche-cambiate");

    expect(await pastiLocali(userId)).toHaveLength(11);
    expect(await db.outbox.get(`pasti:${modificato.id}`)).not.toBeUndefined();
  });

  it("modifica accantonata non confermata → il locale resta intatto", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    await dispositivoConPastiDoppi(userId);
    const bloccato = pasto(userId, "Bloccato", "2026-09-25T13:00:00.000Z");
    await db.pasti.put(bloccato);
    await db.outbox.put(voceOutbox(bloccato, true));

    const modifiche = await modificheNonInviate(userId);
    expect(modifiche.inAttesa.numero).toBe(0);
    expect(modifiche.nonRiuscite).toEqual({ numero: 1, tipi: ["pasti"] });

    const esito = await ripristinaDatiLocali(userId, []);
    expect(esito.esito).toBe("modifiche-cambiate");
    expect(await pastiLocali(userId)).toHaveLength(11);
  });

  it("con la conferma → sostituito, e le modifiche confermate spariscono dalla coda", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const { canonici } = await dispositivoConPastiDoppi(userId);
    const inAttesa = pasto(userId, "Pranzo tardi", "2026-09-25T13:00:00.000Z");
    const bloccato = pasto(userId, "Bloccato", "2026-09-25T13:00:00.000Z");
    await db.pasti.bulkPut([inAttesa, bloccato]);
    await db.outbox.bulkPut([voceOutbox(inAttesa), voceOutbox(bloccato, true)]);

    const modifiche = await modificheNonInviate(userId);
    expect(modifiche.inAttesa.numero).toBe(1);
    expect(modifiche.nonRiuscite.numero).toBe(1);

    const esito = await ripristinaDatiLocali(userId, modifiche.firme);
    expect(esito.esito).toBe("ripristinato");

    expect((await pastiLocali(userId)).map((p) => p.id).sort()).toEqual(
      canonici.map((p) => p.id).sort()
    );
    expect(await db.outbox.get(`pasti:${inAttesa.id}`)).toBeUndefined();
    expect(await db.outbox.get(`pasti:${bloccato.id}`)).toBeUndefined();
  });

  it("una seconda modifica della stessa riga dopo la conferma non è coperta dalla conferma", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    await dispositivoConPastiDoppi(userId);
    const riga = pasto(userId, "Pranzo tardi", "2026-09-25T13:00:00.000Z");
    await db.pasti.put(riga);
    await db.outbox.put({ ...voceOutbox(riga), creato_il: "2026-09-25T13:00:00.000Z" });
    const modifiche = await modificheNonInviate(userId);

    // Stesso id in coda, ma è una modifica nuova (creato_il diverso).
    await db.outbox.put({ ...voceOutbox(riga), creato_il: "2026-09-25T13:05:00.000Z" });

    const esito = await ripristinaDatiLocali(userId, modifiche.firme);
    expect(esito.esito).toBe("modifiche-cambiate");
  });

  it("dopo il ripristino i cursori permettono una discesa incrementale normale", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const { canonici } = await dispositivoConPastiDoppi(userId);

    await ripristinaDatiLocali(userId, []);
    expect((await db.sync_cursori.get(`pasti:${userId}`))?.ultimo_aggiornamento).toBe(
      canonici[4].updated_at
    );

    // La discesa successiva chiede solo dal cursore (meno la finestra di
    // sicurezza di un minuto), non tutta la tabella da capo.
    const nuovo = pasto(userId, "Spuntino notturno", "2026-09-26T08:00:00.000Z");
    server.pasti = [nuovo];
    await scaricaTabella(userId, db.pasti, "pasti");

    expect(filtriGte.pasti).toEqual(["updated_at", "2026-09-20T07:59:04.000Z"]);
    expect(await pastiLocali(userId)).toHaveLength(6);
  });

  it("due utenti sul dispositivo: il ripristino di uno non tocca i dati dell'altro né il catalogo condiviso", async () => {
    const utenteA = `utente-${crypto.randomUUID()}`;
    const utenteB = `utente-${crypto.randomUUID()}`;

    // Catalogo condiviso già sul dispositivo, scaricato a suo tempo anche
    // da B (che ha il cursore "alimenti" avanti).
    const condiviso = alimento(null, "Mela", "2026-09-01T08:00:00.000Z");
    const pastoB = pasto(utenteB, "Cena di B", "2026-09-10T08:00:00.000Z");
    const alimentoB = alimento(utenteB, "Ricetta di B", "2026-09-10T08:00:00.000Z");
    await db.alimenti.bulkPut([condiviso, alimentoB]);
    await db.pasti.put(pastoB);
    await db.outbox.put(voceOutbox(pastoB));
    await db.sync_cursori.put({
      id: `alimenti:${utenteB}`,
      tabella: "alimenti",
      user_id: utenteB,
      ultimo_aggiornamento: "2026-09-10T08:00:00.000Z",
    });

    // A ripristina: il server restituisce il catalogo condiviso (Mela
    // corretta nel frattempo) più i suoi dati.
    const melaAggiornata = { ...condiviso, kcal_100g: 52, updated_at: "2026-09-15T08:00:00.000Z" };
    await dispositivoConPastiDoppi(utenteA);
    server.alimenti = [melaAggiornata, alimento(utenteA, "Pane di A", "2026-09-12T08:00:00.000Z")];

    const esito = await ripristinaDatiLocali(utenteA, []);
    expect(esito.esito).toBe("ripristinato");

    // Il catalogo condiviso c'è ancora, sovrascritto con la versione nuova.
    expect((await db.alimenti.get(condiviso.id))?.kcal_100g).toBe(52);
    // I dati di B, la sua modifica in coda e il suo cursore: intatti.
    expect(await db.pasti.get(pastoB.id)).not.toBeUndefined();
    expect(await db.alimenti.get(alimentoB.id)).not.toBeUndefined();
    expect(await db.outbox.get(`pasti:${pastoB.id}`)).not.toBeUndefined();
    expect((await db.sync_cursori.get(`alimenti:${utenteB}`))?.ultimo_aggiornamento).toBe(
      "2026-09-10T08:00:00.000Z"
    );
  });
});
