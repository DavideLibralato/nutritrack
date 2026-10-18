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
  aggiungiNelPasto,
  type AlimentoDaAggiungere,
} from "./vociDiario";
import { repositoryVociDiario } from "./index";
import { db } from "../db/database";
import { scaricaTabella } from "../sync/discesa";
import type { Pasto, Profilo, VoceDiario } from "../db/tipi";
import { idGiorno } from "./giorni";
import type { SceltaDoppione } from "../diario/pianoSpostamento";

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

  // Caso 2 dei "doppioni rimasti" (18/10): la Mela a pranzo, l'unico
  // doppione che l'utente ha visto, viene cancellata fra il foglio e la
  // conferma (un altro dispositivo). Prima la Mela si spostava lo stesso,
  // contro il "Non spostarlo"; ora vale come in Aggiungi.
  describe("il doppione visto è sparito prima della conferma", () => {
    async function preparaDoppioneSparito(userId: string) {
      await creaVoce(userId, "Mela", { pastoId: "colazione", quantita: 150 });
      await creaVoce(userId, "Pane", { pastoId: "colazione", quantita: 50 });
      const melaPranzo = await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 100 });
      const origine = { tipo: "pasto" as const, pastoId: "colazione" };
      const primo = await spostaNelPasto({ userId, data: GIORNO, origine, pastoDestinazioneId: "pranzo" });
      if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");
      expect(primo.doppioni.map((d) => d.nome)).toEqual(["Mela"]);
      await repositoryVociDiario.elimina(melaPranzo.id);
      return { origine, doppioniVisti: primo.doppioni };
    }

    it("«Non spostarlo» vale lo stesso: la Mela resta a colazione, il Pane si sposta", async () => {
      const userId = crypto.randomUUID();
      const { origine, doppioniVisti } = await preparaDoppioneSparito(userId);

      const esito = await spostaNelPasto({
        userId,
        data: GIORNO,
        origine,
        pastoDestinazioneId: "pranzo",
        scelte: { "alimento-Mela": { tipo: "escludi" } },
        doppioniVisti,
      });

      if (esito.esito !== "fatto") throw new Error("atteso fatto");
      expect(await diario(userId)).toEqual(["colazione: Mela 150 g", "pranzo: Pane 50 g"]);
      expect(esito.piano.spostati).toEqual(["Pane"]);
      expect(esito.piano.esclusi).toEqual(["Mela"]);
    });

    it("una voce sola con «Non spostarlo»: niente scritto, la Mela fra gli esclusi", async () => {
      const userId = crypto.randomUUID();
      const mela = await creaVoce(userId, "Mela", { pastoId: "colazione", quantita: 150 });
      const melaPranzo = await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 100 });
      const origine = { tipo: "voce" as const, id: mela.id };
      const primo = await spostaNelPasto({ userId, data: GIORNO, origine, pastoDestinazioneId: "pranzo" });
      if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");
      await repositoryVociDiario.elimina(melaPranzo.id);
      const prima = await diario(userId);

      const esito = await spostaNelPasto({
        userId,
        data: GIORNO,
        origine,
        pastoDestinazioneId: "pranzo",
        scelte: { "alimento-Mela": { tipo: "escludi" } },
        doppioniVisti: primo.doppioni,
      });

      if (esito.esito !== "fatto") throw new Error("atteso fatto");
      expect(await diario(userId)).toEqual(prima);
      expect(esito.piano).toEqual({ scritture: [], spostati: [], esclusi: ["Mela"] });
      expect(esito.fotografia).toEqual({ prima: [], idCreate: [] });
    });

    it("con Somma si sposta senza foglio: non c'è più niente da sommare", async () => {
      const userId = crypto.randomUUID();
      const { origine, doppioniVisti } = await preparaDoppioneSparito(userId);

      const esito = await spostaNelPasto({
        userId,
        data: GIORNO,
        origine,
        pastoDestinazioneId: "pranzo",
        scelte: { "alimento-Mela": { tipo: "somma" } },
        doppioniVisti,
      });

      if (esito.esito !== "fatto") throw new Error("atteso fatto");
      expect(await diario(userId)).toEqual(["pranzo: Mela 150 g", "pranzo: Pane 50 g"]);
      expect(esito.piano.esclusi).toEqual([]);
    });
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

  // Caso 2 dei "doppioni rimasti" (18/10), come per Sposta: l'altra Mela a
  // pranzo sparisce fra il foglio e la conferma. Prima si copiava lo
  // stesso, contro il "Non duplicarlo".
  describe("il doppione visto è sparito prima della conferma", () => {
    async function preparaDoppioneSparito(userId: string) {
      await creaVoce(userId, "Mela", { pastoId: "colazione", quantita: 150 });
      await creaVoce(userId, "Pane", { pastoId: "colazione", quantita: 50 });
      const melaPranzo = await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 100 });
      const base = {
        userId,
        dataPartenza: GIORNO,
        origine: { tipo: "pasto" as const, pastoId: "colazione" },
        dataDestinazione: GIORNO,
        pastoDestinazioneId: "pranzo",
        profilo: null,
        adesso: ADESSO,
      };
      const primo = await duplicaNelPasto(base);
      if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");
      expect(primo.doppioni.map((d) => d.nome)).toEqual(["Mela"]);
      await repositoryVociDiario.elimina(melaPranzo.id);
      return { base, doppioniVisti: primo.doppioni };
    }

    it("«Non duplicarlo» vale lo stesso: si copia solo il Pane", async () => {
      const userId = crypto.randomUUID();
      const { base, doppioniVisti } = await preparaDoppioneSparito(userId);
      const prima = await diario(userId);

      const esito = await duplicaNelPasto({
        ...base,
        scelte: { "alimento-Mela": { tipo: "escludi" } },
        doppioniVisti,
      });

      if (esito.esito !== "fatto") throw new Error("atteso fatto");
      expect(await diario(userId)).toEqual([...prima, `${GIORNO} pranzo: Pane 50 g`].sort());
      expect(esito.piano.duplicati).toEqual(["Pane"]);
      expect(esito.piano.esclusi).toEqual(["Mela"]);
    });

    it("con Somma si copia senza foglio: non c'è più niente da sommare", async () => {
      const userId = crypto.randomUUID();
      const { base, doppioniVisti } = await preparaDoppioneSparito(userId);
      const prima = await diario(userId);

      const esito = await duplicaNelPasto({
        ...base,
        scelte: { "alimento-Mela": { tipo: "somma" } },
        doppioniVisti,
      });

      if (esito.esito !== "fatto") throw new Error("atteso fatto");
      expect(await diario(userId)).toEqual(
        [...prima, `${GIORNO} pranzo: Mela 150 g`, `${GIORNO} pranzo: Pane 50 g`].sort()
      );
      expect(esito.piano.esclusi).toEqual([]);
    });
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

// Aggiungi da /aggiungi con i doppioni (sezione 3, "Doppioni"): prima
// aggiungere un alimento già presente nel pasto creava una seconda riga in
// silenzio. Quello che non deve rompersi: la destinazione si rilegge da
// Dexie alla conferma, o tutto o niente, "Annulla" riporta anche i grammi
// sommati o scritti, il giorno si classifica solo se nasce una riga.
describe("aggiungi nel pasto", () => {
  // Il "giorno" dei test, il 2 ottobre, è oggi; ieri è il 1°.
  const ADESSO = new Date(2026, 9, 2, 13, 0, 0);
  const IERI = "2026-10-01";

  beforeEach(async () => {
    const base = { user_id: "condiviso-nei-test", ora_inizio: "12:00", ordine: 0, updated_at: "2026-09-01T10:00:00.000Z", deleted_at: null };
    await db.pasti.bulkPut([
      { ...base, id: "colazione", nome: "Colazione" },
      { ...base, id: "pranzo", nome: "Pranzo" },
    ]);
  });

  // Lo stesso alimento_id di creaVoce (`alimento-${nome}`).
  function da(nome: string, grammi: number, kcal = 100): AlimentoDaAggiungere {
    return {
      alimento: { id: `alimento-${nome}`, nome, kcal_100g: kcal, proteine_100g: 1, carboidrati_100g: 2, grassi_100g: 3 },
      grammi,
    };
  }

  function aggiungi(
    userId: string,
    alimenti: AlimentoDaAggiungere[],
    altro: Partial<Parameters<typeof aggiungiNelPasto>[0]> = {}
  ) {
    return aggiungiNelPasto({
      userId,
      data: GIORNO,
      pastoId: "pranzo",
      alimenti,
      inGruppo: alimenti.length > 1,
      profilo: null,
      adesso: ADESSO,
      ...altro,
    });
  }

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

  it("la stessa Mela due volte di fila: la seconda trova la prima, niente scritto", async () => {
    const userId = crypto.randomUUID();
    const primo = await aggiungi(userId, [da("Mela", 150)]);
    expect(primo.esito).toBe("fatto");
    const prima = await diario(userId);
    expect(prima).toEqual([`${GIORNO} pranzo: Mela 150 g`]);

    const secondo = await aggiungi(userId, [da("Mela", 80)]);

    expect(secondo).toEqual({
      esito: "doppioni",
      doppioni: [
        { alimentoId: "alimento-Mela", nome: "Mela", grammiEsistenti: 150, grammiInArrivo: 80, righeEsistenti: 1, righeInArrivo: 1 },
      ],
    });
    expect(await diario(userId)).toEqual(prima);
  });

  it("una riga compare fra il foglio e la conferma: «cambiati», niente scritto", async () => {
    const userId = crypto.randomUUID();
    await creaVoce(userId, "Yogurt", { pastoId: "pranzo", quantita: 100 });
    const pastoSalvato = [da("Yogurt", 125), da("Mela", 150)];
    const primo = await aggiungi(userId, pastoSalvato);
    if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");
    expect(primo.doppioni.map((d) => d.nome)).toEqual(["Yogurt"]);

    // Nel frattempo (un altro dispositivo) a pranzo compare anche una mela.
    await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 80 });
    const prima = await diario(userId);

    const esito = await aggiungi(userId, pastoSalvato, {
      scelte: { "alimento-Yogurt": { tipo: "somma" } },
      doppioniVisti: primo.doppioni,
    });

    expect(esito.esito).toBe("cambiati");
    if (esito.esito === "cambiati") {
      expect(esito.doppioni.map((d) => d.nome).sort()).toEqual(["Mela", "Yogurt"]);
    }
    expect(await diario(userId)).toEqual(prima);
  });

  describe("il doppione visto è sparito prima della conferma", () => {
    // La Mela a pranzo, l'unico doppione che l'utente ha visto, viene
    // cancellata nel frattempo (un altro dispositivo).
    async function preparaDoppioneSparito(userId: string) {
      const mela = await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 100 });
      const pastoSalvato = [da("Mela", 150), da("Pane", 50)];
      const primo = await aggiungi(userId, pastoSalvato);
      if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");
      expect(primo.doppioni.map((d) => d.nome)).toEqual(["Mela"]);
      await repositoryVociDiario.elimina(mela.id);
      return { pastoSalvato, doppioniVisti: primo.doppioni };
    }

    it("«Non aggiungerlo» vale lo stesso: la Mela non si aggiunge, il Pane sì", async () => {
      const userId = crypto.randomUUID();
      const { pastoSalvato, doppioniVisti } = await preparaDoppioneSparito(userId);

      const esito = await aggiungi(userId, pastoSalvato, {
        scelte: { "alimento-Mela": { tipo: "escludi" } },
        doppioniVisti,
      });

      if (esito.esito !== "fatto") throw new Error("atteso fatto");
      expect(await diario(userId)).toEqual([`${GIORNO} pranzo: Pane 50 g`]);
      expect(esito.piano.inseriti).toEqual(["Pane"]);
      expect(esito.piano.esclusi).toEqual(["Mela"]);
    });

    it("con Somma si aggiunge senza foglio: non c'è più niente da sommare", async () => {
      const userId = crypto.randomUUID();
      const { pastoSalvato, doppioniVisti } = await preparaDoppioneSparito(userId);

      const esito = await aggiungi(userId, pastoSalvato, {
        scelte: { "alimento-Mela": { tipo: "somma" } },
        doppioniVisti,
      });

      if (esito.esito !== "fatto") throw new Error("atteso fatto");
      expect(await diario(userId)).toEqual([`${GIORNO} pranzo: Mela 150 g`, `${GIORNO} pranzo: Pane 50 g`]);
      expect(esito.piano.esclusi).toEqual([]);
    });
  });

  it("un guasto a metà pasto salvato: niente scritto, nemmeno la Somma già fatta", async () => {
    const userId = crypto.randomUUID();
    await creaVoce(userId, "Pane", { pastoId: "pranzo", quantita: 50 });
    const prima = await diario(userId);
    const pastoSalvato = [da("Pane", 30), da("Burro", 10), da("Marmellata", 20)];
    const primo = await aggiungi(userId, pastoSalvato);
    if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");

    // Le scritture sono: Pane sommato, Burro creato, Marmellata creata. La
    // seconda creazione si rompe.
    const originale = repositoryVociDiario.crea;
    let chiamate = 0;
    const spia = vi.spyOn(repositoryVociDiario, "crea").mockImplementation(async (dati, id) => {
      chiamate++;
      if (chiamate === 2) throw new Error("Guasto finto");
      return originale(dati, id);
    });

    await expect(
      aggiungi(userId, pastoSalvato, {
        scelte: { "alimento-Pane": { tipo: "somma" } },
        doppioniVisti: primo.doppioni,
      })
    ).rejects.toThrow("Guasto finto");
    spia.mockRestore();

    expect(await diario(userId)).toEqual(prima);
  });

  for (const [scelta, dopo] of [
    [{ tipo: "somma" as const }, 150],
    [{ tipo: "scrivi" as const, grammi: 120 }, 120],
  ] as const) {
    it(`${scelta.tipo === "somma" ? "Somma" : "Scrivi quantità"}, poi Annulla: la riga torna ai grammi di prima`, async () => {
      const userId = crypto.randomUUID();
      const mela = await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 100 });
      const primo = await aggiungi(userId, [da("Mela", 50)]);
      if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");

      const esito = await aggiungi(userId, [da("Mela", 50)], {
        scelte: { "alimento-Mela": scelta },
        doppioniVisti: primo.doppioni,
      });
      if (esito.esito !== "fatto") throw new Error("atteso fatto");
      // Una riga sola, la stessa di prima, con i grammi nuovi.
      expect(await diario(userId)).toEqual([`${GIORNO} pranzo: Mela ${dopo} g`]);
      expect((await db.voci_diario.get(mela.id))?.quantita_g).toBe(dopo);
      expect(esito.piano.aggiornati).toEqual([{ nome: "Mela", grammi: dopo, tipo: scelta.tipo }]);

      await annullaOperazione(esito.fotografia);

      expect(await diario(userId)).toEqual([`${GIORNO} pranzo: Mela 100 g`]);
      expect(await db.voci_diario.get(mela.id)).toMatchObject({ quantita_g: 100, deleted_at: null });
    });
  }

  describe("il giorno si classifica solo se nasce una riga", () => {
    it("una riga nuova su un giorno senza voci: classificato", async () => {
      const userId = crypto.randomUUID();
      const esito = await aggiungi(userId, [da("Mela", 150)], { data: IERI, profilo: profiloDifferenziato(userId) });
      expect(esito.esito).toBe("fatto");
      expect((await db.giorni.get(idGiorno(userId, IERI)))?.deleted_at).toBeNull();
    });

    it("solo una Somma: non classificato", async () => {
      const userId = crypto.randomUUID();
      await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 100 });
      const profilo = profiloDifferenziato(userId);
      const primo = await aggiungi(userId, [da("Mela", 50)], { profilo });
      if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");

      const esito = await aggiungi(userId, [da("Mela", 50)], {
        profilo,
        scelte: { "alimento-Mela": { tipo: "somma" } },
        doppioniVisti: primo.doppioni,
      });

      expect(esito.esito).toBe("fatto");
      expect(await diario(userId)).toEqual([`${GIORNO} pranzo: Mela 150 g`]);
      expect(await db.giorni.get(idGiorno(userId, GIORNO))).toBeUndefined();
    });

    it("tutto escluso: niente scritto, fotografia vuota, non classificato", async () => {
      const userId = crypto.randomUUID();
      await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 100 });
      const prima = await diario(userId);
      const profilo = profiloDifferenziato(userId);
      const primo = await aggiungi(userId, [da("Mela", 50)], { profilo });
      if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");

      const esito = await aggiungi(userId, [da("Mela", 50)], {
        profilo,
        scelte: { "alimento-Mela": { tipo: "escludi" } },
        doppioniVisti: primo.doppioni,
      });

      if (esito.esito !== "fatto") throw new Error("atteso fatto");
      expect(esito.piano.esclusi).toEqual(["Mela"]);
      expect(esito.fotografia).toEqual({ prima: [], idCreate: [] });
      expect(await diario(userId)).toEqual(prima);
      expect(await db.giorni.get(idGiorno(userId, GIORNO))).toBeUndefined();
    });
  });

  describe("com'è fatta la riga nuova", () => {
    it("un pasto salvato oggi: valori dal catalogo, ora del consumo adesso, un gruppo nuovo comune", async () => {
      const userId = crypto.randomUUID();
      const esito = await aggiungi(userId, [da("Pane", 50, 270), da("Burro", 10, 717)]);
      if (esito.esito !== "fatto") throw new Error("atteso fatto");

      const righe = perNome(await repositoryVociDiario.ottieniTutti(userId));
      expect(righe.map(contenutoVisibile)).toEqual([
        expect.objectContaining({ nome_alimento: "Burro", alimento_id: "alimento-Burro", quantita_g: 10, kcal_100g: 717 }),
        expect.objectContaining({ nome_alimento: "Pane", alimento_id: "alimento-Pane", quantita_g: 50, kcal_100g: 270 }),
      ]);
      for (const r of righe) {
        expect(r).toMatchObject({ data: GIORNO, pasto_id: "pranzo", creato_il: ADESSO.toISOString(), consumato_alle: ADESSO.toISOString() });
      }
      expect(righe[0].gruppo_id).not.toBeNull();
      expect(righe[1].gruppo_id).toBe(righe[0].gruppo_id);
    });

    it("un alimento solo su un altro giorno: niente gruppo, niente ora inventata", async () => {
      const userId = crypto.randomUUID();
      await aggiungi(userId, [da("Mela", 150)], { data: IERI, inGruppo: false });
      const [riga] = await repositoryVociDiario.ottieniTutti(userId);
      expect(riga).toMatchObject({ data: IERI, gruppo_id: null, consumato_alle: null });
    });
  });

  describe("giorno e pasto si ricontrollano prima di scrivere", () => {
    it("oltre oggi + 7: rifiutato, niente scritto", async () => {
      const userId = crypto.randomUUID();
      await expect(aggiungi(userId, [da("Mela", 150)], { data: "2026-10-10" })).rejects.toThrow("Giorno non valido");
      expect(await repositoryVociDiario.ottieniTutti(userId)).toHaveLength(0);
    });

    it("un pasto che non c'è: rifiutato, niente scritto", async () => {
      const userId = crypto.randomUUID();
      await expect(aggiungi(userId, [da("Mela", 150)], { pastoId: "pasto-inesistente" })).rejects.toThrow(
        "Pasto non valido"
      );
      expect(await repositoryVociDiario.ottieniTutti(userId)).toHaveLength(0);
    });
  });
});

// Caso 5 dei "doppioni rimasti" (18/10): il totale di "Somma" non deve mai
// superare 99999,99 g (numeric(7,2)). Dexie lo salverebbe, il server lo
// rifiuterebbe e la sync accantonerebbe la riga. Il foglio spegne Somma
// prima, ma alla conferma le righe si rileggono: qui la rete di sicurezza
// nei piani, per Sposta (e quindi il trascinamento), Duplica e Aggiungi.
describe("Somma oltre il massimo di 99999,99 g", () => {
  const ADESSO = new Date(2026, 9, 2, 13, 0, 0);

  beforeEach(async () => {
    const base = { user_id: "condiviso-nei-test", ora_inizio: "12:00", ordine: 0, updated_at: "2026-09-01T10:00:00.000Z", deleted_at: null };
    await db.pasti.bulkPut([
      { ...base, id: "colazione", nome: "Colazione" },
      { ...base, id: "pranzo", nome: "Pranzo" },
    ]);
  });

  // Tutto quello che l'operazione potrebbe aver toccato: le righe del
  // diario e le voci dell'outbox, cioè quello che la sync manderebbe.
  async function stato(userId: string) {
    const voci = await db.voci_diario.filter((v) => v.user_id === userId).toArray();
    const ids = new Set(voci.map((v) => v.id));
    const outbox = await db.outbox.filter((o) => ids.has(o.record_id)).count();
    return { voci: perNome(voci).map((v) => `${v.pasto_id} ${v.quantita_g} ${v.deleted_at}`), outbox };
  }

  // La Mela a colazione (in arrivo) e a pranzo (destinazione).
  async function prepara(userId: string, inArrivo: number, aPranzo: number) {
    const mela = await creaVoce(userId, "Mela", { pastoId: "colazione", quantita: inArrivo });
    await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: aPranzo });
    return mela;
  }

  const sposta = async (userId: string, melaId: string) => {
    const base = { userId, data: GIORNO, origine: { tipo: "voce" as const, id: melaId }, pastoDestinazioneId: "pranzo" };
    const primo = await spostaNelPasto(base);
    if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");
    return spostaNelPasto({ ...base, scelte: { "alimento-Mela": { tipo: "somma" } }, doppioniVisti: primo.doppioni });
  };
  const duplica = async (userId: string, melaId: string) => {
    const base = {
      userId, dataPartenza: GIORNO, origine: { tipo: "voce" as const, id: melaId },
      dataDestinazione: GIORNO, pastoDestinazioneId: "pranzo", profilo: null, adesso: ADESSO,
    };
    const primo = await duplicaNelPasto(base);
    if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");
    return duplicaNelPasto({ ...base, scelte: { "alimento-Mela": { tipo: "somma" } }, doppioniVisti: primo.doppioni });
  };
  // Aggiungi: la quantità in arrivo è quella della Mela a colazione.
  const aggiungi = async (userId: string, melaId: string) => {
    const grammi = (await db.voci_diario.get(melaId))!.quantita_g;
    const base = {
      userId, data: GIORNO, pastoId: "pranzo", inGruppo: false, profilo: null, adesso: ADESSO,
      alimenti: [{ alimento: { id: "alimento-Mela", nome: "Mela", kcal_100g: 100, proteine_100g: 1, carboidrati_100g: 2, grassi_100g: 3 }, grammi }],
    };
    const primo = await aggiungiNelPasto(base);
    if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");
    return aggiungiNelPasto({ ...base, scelte: { "alimento-Mela": { tipo: "somma" } }, doppioniVisti: primo.doppioni });
  };

  for (const [nome, operazione] of [
    ["Sposta", sposta],
    ["Duplica", duplica],
    ["Aggiungi", aggiungi],
  ] as const) {
    it(`${nome}: 50.000 + 50.000 g è rifiutato, niente scritto e niente in outbox`, async () => {
      const userId = crypto.randomUUID();
      const mela = await prepara(userId, 50000, 50000);
      const prima = await stato(userId);

      await expect(operazione(userId, mela.id)).rejects.toThrow(/oltre il massimo/);

      expect(await stato(userId)).toEqual(prima);
    });

    it(`${nome}: 50.000 + 49.999,99 g fa esattamente 99999,99 g e passa`, async () => {
      const userId = crypto.randomUUID();
      const mela = await prepara(userId, 49999.99, 50000);

      const esito = await operazione(userId, mela.id);

      expect(esito.esito).toBe("fatto");
      const vive = (await repositoryVociDiario.ottieniTutti(userId)).filter((v) => v.pasto_id === "pranzo");
      expect(vive.map((v) => v.quantita_g)).toEqual([99999.99]);
    });
  }
});

// Caso 1 dei "doppioni rimasti" (18/10): dallo sheet di modifica di Oggi si
// cambia il pasto di una voce e, insieme, i grammi. Passa da spostaNelPasto
// con `origine.grammi`: la voce in arrivo vale già con i grammi nuovi (nel
// foglio, in Somma, nella rete del massimo), una scrittura sola per riga, e
// Annulla riporta pasto e grammi di prima.
describe("sposta con i grammi nuovi (sheet di modifica)", () => {
  async function diario(userId: string) {
    const vive = await repositoryVociDiario.ottieniTutti(userId);
    return vive.map((v) => `${v.pasto_id}: ${v.nome_alimento} ${v.quantita_g} g`).sort();
  }

  // La Mela a colazione, 100 g, che si porta a pranzo con 120 g; a pranzo,
  // se serve, un'altra Mela da 50 g.
  async function prepara(userId: string, { conDoppione }: { conDoppione: boolean }) {
    const mela = await creaVoce(userId, "Mela", { pastoId: "colazione", quantita: 100 });
    const altra = conDoppione ? await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 50 }) : null;
    return { mela, altra, origine: { tipo: "voce" as const, id: mela.id, grammi: 120 } };
  }

  async function spostaConScelta(userId: string, origine: { tipo: "voce"; id: string; grammi: number }, scelta: SceltaDoppione) {
    const base = { userId, data: GIORNO, origine, pastoDestinazioneId: "pranzo" };
    const primo = await spostaNelPasto(base);
    if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");
    // Il foglio mostra i grammi nuovi in arrivo, non quelli salvati.
    expect(primo.doppioni[0]).toMatchObject({ grammiEsistenti: 50, grammiInArrivo: 120 });
    const esito = await spostaNelPasto({ ...base, scelte: { "alimento-Mela": scelta }, doppioniVisti: primo.doppioni });
    if (esito.esito !== "fatto") throw new Error("atteso fatto");
    return esito;
  }

  it("senza doppione: un solo aggiorna con pasto e grammi; Annulla riporta tutti e due", async () => {
    const userId = crypto.randomUUID();
    const { mela, origine } = await prepara(userId, { conDoppione: false });
    const prima = await diario(userId);

    const esito = await spostaNelPasto({ userId, data: GIORNO, origine, pastoDestinazioneId: "pranzo" });

    if (esito.esito !== "fatto") throw new Error("atteso fatto");
    expect(esito.piano.scritture).toEqual([
      { tipo: "aggiorna", id: mela.id, modifiche: { pasto_id: "pranzo", quantita_g: 120 } },
    ]);
    expect(await diario(userId)).toEqual(["pranzo: Mela 120 g"]);
    await annullaOperazione(esito.fotografia);
    expect(await diario(userId)).toEqual(prima);
  });

  it("Somma: la riga di pranzo prende 50 + 120; la Mela spostata si cancella senza aggiornarla prima", async () => {
    const userId = crypto.randomUUID();
    const { mela, altra, origine } = await prepara(userId, { conDoppione: true });
    const prima = await diario(userId);

    const esito = await spostaConScelta(userId, origine, { tipo: "somma" });

    expect(esito.piano.scritture).toEqual([
      { tipo: "aggiorna", id: altra!.id, modifiche: { quantita_g: 170 } },
      { tipo: "elimina", id: mela.id },
    ]);
    expect(await diario(userId)).toEqual(["pranzo: Mela 170 g"]);
    await annullaOperazione(esito.fotografia);
    expect(await diario(userId)).toEqual(prima);
  });

  it("Tieni separati: pasto e grammi nello stesso aggiorna, la riga di pranzo non si tocca", async () => {
    const userId = crypto.randomUUID();
    const { mela, origine } = await prepara(userId, { conDoppione: true });
    const prima = await diario(userId);

    const esito = await spostaConScelta(userId, origine, { tipo: "separati" });

    expect(esito.piano.scritture).toEqual([
      { tipo: "aggiorna", id: mela.id, modifiche: { pasto_id: "pranzo", quantita_g: 120 } },
    ]);
    expect(await diario(userId)).toEqual(["pranzo: Mela 120 g", "pranzo: Mela 50 g"]);
    await annullaOperazione(esito.fotografia);
    expect(await diario(userId)).toEqual(prima);
  });

  it("Scrivi quantità: vale il numero scritto nel foglio, la Mela spostata si cancella", async () => {
    const userId = crypto.randomUUID();
    const { mela, altra, origine } = await prepara(userId, { conDoppione: true });
    const prima = await diario(userId);

    const esito = await spostaConScelta(userId, origine, { tipo: "scrivi", grammi: 200 });

    expect(esito.piano.scritture).toEqual([
      { tipo: "aggiorna", id: altra!.id, modifiche: { quantita_g: 200 } },
      { tipo: "elimina", id: mela.id },
    ]);
    expect(await diario(userId)).toEqual(["pranzo: Mela 200 g"]);
    await annullaOperazione(esito.fotografia);
    expect(await diario(userId)).toEqual(prima);
  });

  it("Non spostarlo: resta a colazione con i grammi nuovi; Annulla li riporta", async () => {
    const userId = crypto.randomUUID();
    const { mela, origine } = await prepara(userId, { conDoppione: true });
    const prima = await diario(userId);

    const esito = await spostaConScelta(userId, origine, { tipo: "escludi" });

    expect(esito.piano.scritture).toEqual([{ tipo: "aggiorna", id: mela.id, modifiche: { quantita_g: 120 } }]);
    expect(esito.piano.esclusi).toEqual(["Mela"]);
    expect(await diario(userId)).toEqual(["colazione: Mela 120 g", "pranzo: Mela 50 g"]);
    await annullaOperazione(esito.fotografia);
    expect(await diario(userId)).toEqual(prima);
  });

  it("grammi nuovi che con Somma superano il massimo: rifiutato, niente scritto", async () => {
    const userId = crypto.randomUUID();
    const mela = await creaVoce(userId, "Mela", { pastoId: "colazione", quantita: 100 });
    await creaVoce(userId, "Mela", { pastoId: "pranzo", quantita: 50000 });
    const prima = await diario(userId);
    const base = { userId, data: GIORNO, origine: { tipo: "voce" as const, id: mela.id, grammi: 50000 }, pastoDestinazioneId: "pranzo" };
    const primo = await spostaNelPasto(base);
    if (primo.esito !== "doppioni") throw new Error("attesi i doppioni");

    await expect(
      spostaNelPasto({ ...base, scelte: { "alimento-Mela": { tipo: "somma" } }, doppioniVisti: primo.doppioni })
    ).rejects.toThrow(/oltre il massimo/);

    expect(await diario(userId)).toEqual(prima);
  });

  it("grammi uguali a quelli salvati: le stesse scritture di uno Sposta senza grammi", async () => {
    const userId = crypto.randomUUID();
    const mela = await creaVoce(userId, "Mela", { pastoId: "colazione", quantita: 100 });

    const esito = await spostaNelPasto({
      userId, data: GIORNO, origine: { tipo: "voce", id: mela.id, grammi: 100 }, pastoDestinazioneId: "pranzo",
    });

    if (esito.esito !== "fatto") throw new Error("atteso fatto");
    expect(esito.piano.scritture).toEqual([{ tipo: "aggiorna", id: mela.id, modifiche: { pasto_id: "pranzo" } }]);
  });
});
