// Test permanenti per l'"Annulla" delle voci di diario (PUNTO_DI_PARTENZA.md,
// punti 10.2 e 10.6, e sezione 3, "Tieni premuto"). Quello che non deve
// rompersi in silenzio:
// - dopo un inserimento si cancellano esattamente le voci di
//   quell'inserimento (tutte, per un pasto salvato), con una cancellazione
//   logica che passa dall'outbox — altrimenti la voce ricomparirebbe al
//   primo sync. È il comportamento di sempre, ora passato alla fotografia
//   generica: deve restare identico;
// - dopo un'eliminazione le righe tornano identiche, e restano vive anche
//   se la cancellazione era già arrivata sul server (l'annulla scrive solo
//   in avanti);
// - annullare due volte, o riprovare dopo un guasto, non duplica niente;
// - un'eliminazione che si rompe a metà non lascia scritture parziali.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  annullaOperazione,
  eliminaPastoDelGiorno,
  eliminaVoci,
  fotografiaInserimento,
  idVoceRicreata,
} from "./vociDiario";
import { repositoryVociDiario } from "./index";
import { db } from "../db/database";
import { scaricaTabella } from "../sync/discesa";
import type { VoceDiario } from "../db/tipi";

// Rete assente, come negli altri test dei repository: si esercita solo la
// parte locale (tabella + outbox). Il test sulla discesa sostituisce questa
// risposta con una finta risposta di Supabase.
const fromMock = vi.fn();
vi.mock("../supabase/client", () => ({
  createClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  fromMock.mockReset();
  fromMock.mockImplementation(() => {
    throw new Error("Rete non disponibile (finta, nei test).");
  });
});

const GIORNO = "2026-10-02";

function creaVoce(
  userId: string,
  nome: string,
  {
    gruppoId = null,
    pastoId = "pasto-1",
    quantita = 100,
  }: { gruppoId?: string | null; pastoId?: string; quantita?: number } = {}
) {
  return repositoryVociDiario.crea({
    user_id: userId,
    alimento_id: `alimento-${nome}`,
    pasto_id: pastoId,
    gruppo_id: gruppoId,
    quantita_g: quantita,
    data: GIORNO,
    creato_il: "2026-10-02T08:00:00.000Z",
    consumato_alle: "2026-10-02T08:05:00.000Z",
    nome_alimento: nome,
    kcal_100g: 100,
    proteine_100g: 1,
    carboidrati_100g: 2,
    grassi_100g: 3,
  } as Omit<VoceDiario, "id" | "updated_at" | "deleted_at">);
}

// Il contenuto che l'utente vede e che conta per i totali: tutto tranne
// i campi tecnici (id, updated_at, deleted_at).
function contenutoVisibile(v: VoceDiario) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, updated_at, deleted_at, ...resto } = v;
  return resto;
}

function perNome(voci: VoceDiario[]) {
  return [...voci].sort((a, b) => a.nome_alimento.localeCompare(b.nome_alimento));
}

describe("annulla dopo un inserimento (fotografia di sole righe create)", () => {
  it("annulla una voce singola: deleted_at scritto, la voce sparisce dal diario", async () => {
    const userId = crypto.randomUUID();
    const voce = await creaVoce(userId, "Pane");

    const scritte = await annullaOperazione(fotografiaInserimento([voce.id]));

    expect(scritte).toBe(1);
    const riga = await db.voci_diario.get(voce.id);
    // Logica, non fisica: la riga c'è ancora, con deleted_at.
    expect(riga).toBeDefined();
    expect(riga?.deleted_at).not.toBeNull();
    expect(await repositoryVociDiario.ottieniTutti(userId)).toHaveLength(0);
  });

  it("annulla un pasto salvato intero: tutte le voci del gruppo, nient'altro", async () => {
    const userId = crypto.randomUUID();
    const gruppoId = crypto.randomUUID();
    const pasto = await Promise.all([
      creaVoce(userId, "Yogurt", { gruppoId }),
      creaVoce(userId, "Avena", { gruppoId }),
      creaVoce(userId, "Mirtilli", { gruppoId }),
    ]);
    const altra = await creaVoce(userId, "Caffè");

    const scritte = await annullaOperazione(fotografiaInserimento(pasto.map((v) => v.id)));

    expect(scritte).toBe(3);
    const rimaste = await repositoryVociDiario.ottieniTutti(userId);
    expect(rimaste.map((v) => v.id)).toEqual([altra.id]);
  });

  it("la cancellazione logica è nell'outbox, una sola voce per riga", async () => {
    const userId = crypto.randomUUID();
    const gruppoId = crypto.randomUUID();
    const voci = await Promise.all([
      creaVoce(userId, "Pasta", { gruppoId }),
      creaVoce(userId, "Sugo", { gruppoId }),
    ]);

    await annullaOperazione(fotografiaInserimento(voci.map((v) => v.id)));

    for (const voce of voci) {
      const inCoda = await db.outbox.filter((v) => v.record_id === voce.id).toArray();
      // La cancellazione ha sostituito l'inserimento ancora in coda (stessa
      // chiave "voci_diario:<id>"): a Supabase arriva lo stato finale.
      expect(inCoda).toHaveLength(1);
      expect(inCoda[0].id).toBe(`voci_diario:${voce.id}`);
      expect(inCoda[0].dati.deleted_at).not.toBeNull();
    }
  });

  it("ripetere l'annulla non riscrive le voci già cancellate", async () => {
    const userId = crypto.randomUUID();
    const voce = await creaVoce(userId, "Mela");

    await annullaOperazione(fotografiaInserimento([voce.id]));
    const dopoIlPrimo = await db.voci_diario.get(voce.id);
    const scritteAlSecondo = await annullaOperazione(fotografiaInserimento([voce.id]));

    expect(scritteAlSecondo).toBe(0);
    const dopoIlSecondo = await db.voci_diario.get(voce.id);
    expect(dopoIlSecondo?.deleted_at).toBe(dopoIlPrimo?.deleted_at);
    expect(dopoIlSecondo?.updated_at).toBe(dopoIlPrimo?.updated_at);
  });
});

describe("elimina e annulla", () => {
  it("elimina tutto il pasto → annulla: le righe vive tornano identiche, ognuna in outbox", async () => {
    const userId = crypto.randomUUID();
    const gruppoId = crypto.randomUUID();
    const prima = await Promise.all([
      creaVoce(userId, "Pasta", { pastoId: "pranzo", gruppoId, quantita: 80 }),
      creaVoce(userId, "Sugo", { pastoId: "pranzo", gruppoId, quantita: 120 }),
    ]);
    const altroPasto = await creaVoce(userId, "Caffè", { pastoId: "colazione" });

    const foto = await eliminaPastoDelGiorno(userId, GIORNO, "pranzo");
    expect(foto.prima).toHaveLength(2);
    // Solo il pasto scelto: la colazione non si tocca.
    expect((await repositoryVociDiario.ottieniTutti(userId)).map((v) => v.id)).toEqual([
      altroPasto.id,
    ]);

    await annullaOperazione(foto);

    const vive = (await repositoryVociDiario.ottieniTutti(userId)).filter(
      (v) => v.pasto_id === "pranzo"
    );
    // Stesso contenuto (quantità, pasto, giorno, creato_il, gruppo_id,
    // valori copiati), id nuovo.
    expect(perNome(vive).map(contenutoVisibile)).toEqual(perNome(prima).map(contenutoVisibile));
    for (const v of vive) {
      expect(prima.map((p) => p.id)).not.toContain(v.id);
      const inCoda = await db.outbox.get(`voci_diario:${v.id}`);
      expect(inCoda?.dati.deleted_at).toBeNull();
    }
  });

  it("la cancellazione era già arrivata sul server: dopo una discesa la riga resta viva", async () => {
    const userId = crypto.randomUUID();
    const voce = await creaVoce(userId, "Mela");
    const foto = await eliminaVoci([voce.id]);
    const cancellata = await db.voci_diario.get(voce.id);

    await annullaOperazione(foto);

    // Supabase rimanda la cancellazione della riga originale, come se
    // fosse partita prima dell'Annulla. Vince sempre (discesa.ts): se
    // l'Annulla avesse rimesso deleted_at = null su QUELLA riga, la Mela
    // sparirebbe di nuovo qui, in silenzio.
    const rispostaServer = {
      data: [{ ...cancellata, updated_at: new Date(Date.now() + 1000).toISOString() }],
      error: null,
    };
    const builder = {
      select: () => builder,
      order: () => builder,
      eq: () => builder,
      or: () => builder,
      gte: () => builder,
      range: () => builder,
      upsert: async () => ({ error: { message: "finto" } }),
      then: (risolvi: (v: typeof rispostaServer) => void) => risolvi(rispostaServer),
    };
    fromMock.mockReset();
    fromMock.mockReturnValue(builder);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await scaricaTabella(userId, db.voci_diario, "voci_diario");

    const vive = await repositoryVociDiario.ottieniTutti(userId);
    expect(vive.map((v) => v.nome_alimento)).toEqual(["Mela"]);
  });

  it("annullare due volte non duplica le righe ricreate", async () => {
    const userId = crypto.randomUUID();
    const voce = await creaVoce(userId, "Pane");
    const foto = await eliminaVoci([voce.id]);

    expect(await annullaOperazione(foto)).toBe(1);
    expect(await annullaOperazione(foto)).toBe(0);

    const vive = await repositoryVociDiario.ottieniTutti(userId);
    expect(vive.map((v) => v.id)).toEqual([idVoceRicreata(voce.id)]);
  });

  it("una riga ricreata poi cancellata dall'utente non torna con un secondo annulla", async () => {
    const userId = crypto.randomUUID();
    const voce = await creaVoce(userId, "Pane");
    const foto = await eliminaVoci([voce.id]);
    await annullaOperazione(foto);
    await repositoryVociDiario.elimina(idVoceRicreata(voce.id));

    expect(await annullaOperazione(foto)).toBe(0);
    expect(await repositoryVociDiario.ottieniTutti(userId)).toHaveLength(0);
  });

  it("una riga modificata dall'operazione torna ai valori di prima, stesso id", async () => {
    const userId = crypto.randomUUID();
    const voce = await creaVoce(userId, "Riso", { quantita: 80 });
    // La fotografia di un'operazione che l'ha modificata (come farà Somma).
    await repositoryVociDiario.aggiorna(voce.id, { quantita_g: 200, pasto_id: "cena" });

    await annullaOperazione({ prima: [voce], idCreate: [] });

    const riga = await db.voci_diario.get(voce.id);
    expect(riga && contenutoVisibile(riga)).toEqual(contenutoVisibile(voce));
    expect(riga?.deleted_at).toBeNull();
  });

  it("le voci già cancellate prima non entrano nella fotografia", async () => {
    const userId = crypto.randomUUID();
    const viva = await creaVoce(userId, "Pasta", { pastoId: "pranzo" });
    const giaVia = await creaVoce(userId, "Pane", { pastoId: "pranzo" });
    await repositoryVociDiario.elimina(giaVia.id);

    const foto = await eliminaPastoDelGiorno(userId, GIORNO, "pranzo");
    await annullaOperazione(foto);

    expect(foto.prima.map((v) => v.id)).toEqual([viva.id]);
    const vive = await repositoryVociDiario.ottieniTutti(userId);
    expect(vive.map((v) => v.nome_alimento)).toEqual(["Pasta"]);
  });

  it("un guasto a metà eliminazione rimette a posto quelle già cancellate", async () => {
    const userId = crypto.randomUUID();
    const voci = await Promise.all([
      creaVoce(userId, "Pasta", { pastoId: "pranzo" }),
      creaVoce(userId, "Sugo", { pastoId: "pranzo" }),
      creaVoce(userId, "Pane", { pastoId: "pranzo" }),
    ]);
    const originale = repositoryVociDiario.elimina;
    let chiamate = 0;
    const spia = vi.spyOn(repositoryVociDiario, "elimina").mockImplementation(async (id) => {
      chiamate++;
      if (chiamate === 2) throw new Error("Guasto finto");
      return originale(id);
    });

    await expect(eliminaVoci(voci.map((v) => v.id))).rejects.toThrow("Guasto finto");
    spia.mockRestore();

    const vive = await repositoryVociDiario.ottieniTutti(userId);
    expect(perNome(vive).map(contenutoVisibile)).toEqual(perNome(voci).map(contenutoVisibile));
  });
});
