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
  spostaNelPasto,
  duplicaNelPasto,
} from "./vociDiario";
import { repositoryVociDiario } from "./index";
import { db } from "../db/database";
import { scaricaTabella } from "../sync/discesa";
import type { Pasto, Profilo, VoceDiario } from "../db/tipi";
import { idGiorno } from "./giorni";

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

describe("sposta e annulla", () => {
  // Il diario come lo vede l'utente: per ogni pasto, alimento e grammi.
  async function diario(userId: string) {
    const vive = await repositoryVociDiario.ottieniTutti(userId);
    return vive.map((v) => `${v.pasto_id}: ${v.nome_alimento} ${v.quantita_g} g`).sort();
  }

  it("Somma, poi Annulla: tutto com'era, compresi i grammi sommati", async () => {
    const userId = crypto.randomUUID();
    await creaVoce(userId, "Yogurt", { pastoId: "colazione", quantita: 125 });
    await creaVoce(userId, "Pane", { pastoId: "colazione", quantita: 50 });
    const yogurtPranzo = await creaVoce(userId, "Yogurt", { pastoId: "pranzo", quantita: 100 });
    const prima = await diario(userId);

    const origine = { tipo: "pasto" as const, pastoId: "colazione" };
    const primo = await spostaNelPasto({ userId, data: GIORNO, origine, pastoDestinazioneId: "pranzo" });
    // Con un doppione e senza scelte non si scrive niente.
    expect(primo.esito).toBe("doppioni");
    expect(await diario(userId)).toEqual(prima);
    if (primo.esito !== "doppioni") return;

    const esito = await spostaNelPasto({
      userId,
      data: GIORNO,
      origine,
      pastoDestinazioneId: "pranzo",
      scelte: { "alimento-Yogurt": { tipo: "somma" } },
      doppioniVisti: primo.doppioni,
    });
    expect(esito.esito).toBe("fatto");
    expect(await diario(userId)).toEqual(["pranzo: Pane 50 g", "pranzo: Yogurt 225 g"]);
    if (esito.esito !== "fatto") return;

    await annullaOperazione(esito.fotografia);

    expect(await diario(userId)).toEqual(prima);
    // La riga di destinazione è la stessa di prima, tornata a 100 g.
    expect((await db.voci_diario.get(yogurtPranzo.id))?.quantita_g).toBe(100);
  });

  it("i doppioni sono cambiati prima della conferma: niente scritto, si richiedono le scelte", async () => {
    const userId = crypto.randomUUID();
    await creaVoce(userId, "Yogurt", { pastoId: "colazione", quantita: 125 });
    await creaVoce(userId, "Mela", { pastoId: "colazione", quantita: 150 });
    await creaVoce(userId, "Yogurt", { pastoId: "pranzo", quantita: 100 });
    const origine = { tipo: "pasto" as const, pastoId: "colazione" };
    const primo = await spostaNelPasto({ userId, data: GIORNO, origine, pastoDestinazioneId: "pranzo" });
    if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");

    // Nel frattempo (un altro dispositivo) a pranzo compare anche una mela.
    await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 80 });
    const prima = await diario(userId);

    const esito = await spostaNelPasto({
      userId,
      data: GIORNO,
      origine,
      pastoDestinazioneId: "pranzo",
      scelte: { "alimento-Yogurt": { tipo: "somma" } },
      doppioniVisti: primo.doppioni,
    });

    expect(esito.esito).toBe("doppioni");
    // Quali, non in che ordine: l'ordine segue quello delle righe in Dexie.
    if (esito.esito === "doppioni") {
      expect(esito.doppioni.map((d) => d.nome).sort()).toEqual(["Mela", "Yogurt"]);
    }
    expect(await diario(userId)).toEqual(prima);
  });
});

describe("duplica e annulla", () => {
  // Il "giorno" dei test è il 2 ottobre: si duplica sul 1° (ieri), sul 2 o
  // in avanti fino al 9 (oggi + 7).
  const ADESSO = new Date(2026, 9, 2, 13, 0, 0);
  const IERI = "2026-10-01";

  // I pasti di destinazione devono esistere in Dexie e valere quel giorno
  // (duplicaNelPasto lo ricontrolla): qui colazione e pranzo, da sempre.
  function pastoFinto(id: string, date: Partial<Pasto> = {}): Pasto {
    return {
      id, user_id: "condiviso-nei-test", nome: id, ora_inizio: "12:00", ordine: 0,
      updated_at: "2026-09-01T10:00:00.000Z", deleted_at: null, ...date,
    };
  }
  beforeEach(async () => {
    await db.pasti.bulkPut([
      pastoFinto("colazione"),
      pastoFinto("pranzo"),
    ]);
  });

  function profiloDifferenziato(userId: string): Profilo {
    return {
      id: crypto.randomUUID(),
      user_id: userId,
      updated_at: "2026-09-01T10:00:00.000Z",
      deleted_at: null,
      nome: null,
      sesso: "non_indicato",
      data_nascita: null,
      altezza_cm: null,
      livello_attivita: "sedentario",
      differenzia_giorni: true,
      giorni_allenamento_default: null,
    };
  }

  async function diario(userId: string) {
    const vive = await repositoryVociDiario.ottieniTutti(userId);
    return vive.map((v) => `${v.data} ${v.pasto_id}: ${v.nome_alimento} ${v.quantita_g} g`).sort();
  }

  it("su un altro giorno senza voci: il giorno si classifica, Annulla toglie solo le copie", async () => {
    const userId = crypto.randomUUID();
    await creaVoce(userId, "Pane", { pastoId: "colazione", quantita: 50 });
    await creaVoce(userId, "Burro", { pastoId: "colazione", quantita: 10 });
    const prima = await diario(userId);
    expect(await db.giorni.get(idGiorno(userId, IERI))).toBeUndefined();

    const esito = await duplicaNelPasto({
      userId,
      dataPartenza: GIORNO,
      origine: { tipo: "pasto", pastoId: "colazione" },
      dataDestinazione: IERI,
      pastoDestinazioneId: "colazione",
      profilo: profiloDifferenziato(userId),
      adesso: ADESSO,
    });
    if (esito.esito !== "fatto") throw new Error("atteso fatto");
    expect(await diario(userId)).toEqual(
      [...prima, `${IERI} colazione: Burro 10 g`, `${IERI} colazione: Pane 50 g`].sort()
    );
    // Il giorno di destinazione è stato classificato (decisione 8).
    expect((await db.giorni.get(idGiorno(userId, IERI)))?.deleted_at).toBeNull();

    await annullaOperazione(esito.fotografia);
    expect(await diario(userId)).toEqual(prima);
  });

  it("la Mela nel suo stesso pasto e giorno: una seconda riga, senza foglio dei doppioni", async () => {
    const userId = crypto.randomUUID();
    const mela = await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 150 });

    const esito = await duplicaNelPasto({
      userId,
      dataPartenza: GIORNO,
      origine: { tipo: "voce", id: mela.id },
      dataDestinazione: GIORNO,
      pastoDestinazioneId: "pranzo",
      profilo: null,
      adesso: ADESSO,
    });

    expect(esito.esito).toBe("fatto");
    expect(await diario(userId)).toEqual([
      `${GIORNO} pranzo: Mela 150 g`,
      `${GIORNO} pranzo: Mela 150 g`,
    ]);
    // L'originale è quello di prima, intatto.
    expect(await db.voci_diario.get(mela.id)).toEqual(mela);
  });

  it("Somma su un'altra riga: Annulla la rimette com'era, l'originale non è mai cambiato", async () => {
    const userId = crypto.randomUUID();
    const mela = await creaVoce(userId, "Mela", { pastoId: "colazione", quantita: 150 });
    const altra = await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 100 });
    const origine = { tipo: "voce" as const, id: mela.id };
    const base = { userId, dataPartenza: GIORNO, origine, dataDestinazione: GIORNO, pastoDestinazioneId: "pranzo", profilo: null, adesso: ADESSO };

    const primo = await duplicaNelPasto(base);
    if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");
    const esito = await duplicaNelPasto({
      ...base,
      scelte: { "alimento-Mela": { tipo: "somma" } },
      doppioniVisti: primo.doppioni,
    });
    if (esito.esito !== "fatto") throw new Error("atteso fatto");
    expect((await db.voci_diario.get(altra.id))?.quantita_g).toBe(250);
    expect(await db.voci_diario.get(mela.id)).toEqual(mela);

    await annullaOperazione(esito.fotografia);
    expect((await db.voci_diario.get(altra.id))?.quantita_g).toBe(100);
    expect(await db.voci_diario.get(mela.id)).toEqual(mela);
  });

  it("fino a oggi + 7 si duplica: senza ora del consumo, il giorno si classifica", async () => {
    const userId = crypto.randomUUID();
    const mela = await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 150 });
    const tra7 = "2026-10-09";

    const esito = await duplicaNelPasto({
      userId,
      dataPartenza: GIORNO,
      origine: { tipo: "voce", id: mela.id },
      dataDestinazione: tra7,
      pastoDestinazioneId: "pranzo",
      profilo: profiloDifferenziato(userId),
      adesso: ADESSO,
    });
    if (esito.esito !== "fatto") throw new Error("atteso fatto");
    const copia = (await repositoryVociDiario.ottieniTutti(userId)).find((v) => v.data === tra7);
    expect(copia?.consumato_alle).toBeNull();
    expect((await db.giorni.get(idGiorno(userId, tra7)))?.deleted_at).toBeNull();
  });

  it("oltre oggi + 7 si rifiuta, senza scrivere niente", async () => {
    const userId = crypto.randomUUID();
    const mela = await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 150 });
    await expect(
      duplicaNelPasto({
        userId,
        dataPartenza: GIORNO,
        origine: { tipo: "voce", id: mela.id },
        dataDestinazione: "2026-10-10",
        pastoDestinazioneId: "pranzo",
        profilo: profiloDifferenziato(userId),
        adesso: ADESSO,
      })
    ).rejects.toThrow();
    expect(await repositoryVociDiario.ottieniTutti(userId)).toHaveLength(1);
    expect(await db.giorni.get(idGiorno(userId, "2026-10-10"))).toBeUndefined();
  });
});

describe("duplica: il pasto di destinazione deve esistere quel giorno", () => {
  const ADESSO = new Date(2026, 9, 2, 13, 0, 0);
  const IERI = "2026-10-01";

  beforeEach(async () => {
    const base = { user_id: "condiviso-nei-test", ora_inizio: "12:00", ordine: 0, updated_at: "2026-09-01T10:00:00.000Z", deleted_at: null };
    await db.pasti.bulkPut([
      { ...base, id: "pranzo", nome: "Pranzo" },
      { ...base, id: "merenda", nome: "Merenda", valido_dal: GIORNO },
      { ...base, id: "cena-chiusa", nome: "Cena", valido_al: "2026-09-30" },
      { ...base, id: "spuntino-cancellato", nome: "Spuntino", deleted_at: "2026-09-15T10:00:00.000Z" },
    ]);
  });

  for (const [caso, pastoId, data] of [
    ["un pasto che nasce dopo quel giorno", "merenda", IERI],
    ["un pasto chiuso prima di quel giorno", "cena-chiusa", IERI],
    ["un pasto cancellato", "spuntino-cancellato", GIORNO],
    ["un pasto che non c'è", "pasto-inesistente", GIORNO],
  ] as const) {
    it(`${caso}: rifiutato, senza scrivere niente`, async () => {
      const userId = crypto.randomUUID();
      const mela = await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 150 });
      await expect(
        duplicaNelPasto({
          userId,
          dataPartenza: GIORNO,
          origine: { tipo: "voce", id: mela.id },
          dataDestinazione: data,
          pastoDestinazioneId: pastoId,
          profilo: null,
          adesso: ADESSO,
        })
      ).rejects.toThrow("Pasto non valido");
      expect(await repositoryVociDiario.ottieniTutti(userId)).toHaveLength(1);
    });
  }

  it("lo stesso pasto il giorno in cui esiste: la copia si fa", async () => {
    const userId = crypto.randomUUID();
    const mela = await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 150 });
    const esito = await duplicaNelPasto({
      userId,
      dataPartenza: GIORNO,
      origine: { tipo: "voce", id: mela.id },
      dataDestinazione: GIORNO,
      pastoDestinazioneId: "merenda",
      profilo: null,
      adesso: ADESSO,
    });
    expect(esito.esito).toBe("fatto");
    expect(await repositoryVociDiario.ottieniTutti(userId)).toHaveLength(2);
  });
});

// Elimina pasto (passo 4): l'Annulla ricrea le voci eliminate sul pasto
// RICREATO, non sotto quello cancellato. Senza l'opzione, niente cambia.
describe("annullaOperazione con pastiSostituiti", () => {
  it("le voci ricreate di un pasto della mappa nascono sul pasto indicato; le altre restano dov'erano", async () => {
    const userId = crypto.randomUUID();
    const pasta = await creaVoce(userId, "Pasta", { pastoId: "pranzo-vecchio" });
    const pane = await creaVoce(userId, "Pane", { pastoId: "pranzo-dopo" });
    const caffe = await creaVoce(userId, "Caffè", { pastoId: "colazione" });
    const foto = await eliminaVoci([pasta.id, pane.id, caffe.id]);

    await annullaOperazione(foto, { pastiSostituiti: { "pranzo-vecchio": "pranzo-nuovo", "pranzo-dopo": "pranzo-nuovo" } });

    expect((await db.voci_diario.get(idVoceRicreata(pasta.id)))?.pasto_id).toBe("pranzo-nuovo");
    expect((await db.voci_diario.get(idVoceRicreata(pane.id)))?.pasto_id).toBe("pranzo-nuovo");
    expect((await db.voci_diario.get(idVoceRicreata(caffe.id)))?.pasto_id).toBe("colazione");
  });

  it("la voce ricreata nasce senza il segno della cancellazione (passo 5)", async () => {
    const userId = crypto.randomUUID();
    const pasta = await creaVoce(userId, "Pasta", { pastoId: "pranzo" });
    await repositoryVociDiario.aggiorna(pasta.id, { deleted_at: "2026-10-10T08:00:00.000Z", eliminata_dal_cambio: "cambio-1" });
    const cancellata = (await db.voci_diario.get(pasta.id))!;

    await annullaOperazione({ prima: [cancellata], idCreate: [] });

    const ricreata = await db.voci_diario.get(idVoceRicreata(pasta.id));
    expect(ricreata).toMatchObject({ deleted_at: null, nome_alimento: "Pasta" });
    expect("eliminata_dal_cambio" in ricreata!).toBe(false);
  });

  it("senza l'opzione, la voce ricreata torna sul suo pasto di prima", async () => {
    const userId = crypto.randomUUID();
    const pasta = await creaVoce(userId, "Pasta", { pastoId: "pranzo-vecchio" });
    const foto = await eliminaVoci([pasta.id]);

    await annullaOperazione(foto);

    expect((await db.voci_diario.get(idVoceRicreata(pasta.id)))?.pasto_id).toBe("pranzo-vecchio");
  });
});
