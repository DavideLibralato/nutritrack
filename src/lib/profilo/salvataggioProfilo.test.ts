// Test permanenti del Salva unico del Profilo (CLAUDE.md: logica sottile che
// sbaglia in silenzio). Due cose da non rompere mai:
//
// 1. Cambiando UNA sezione, le tabelle delle altre non vengono toccate —
//    né la riga locale, né la coda verso Supabase (outbox). Prima del Salva
//    unico ogni "Salva obiettivo" apriva un periodo nuovo anche per un
//    refuso, e nei grafici compariva uno stacco mai avvenuto.
// 2. Primo inserimento: nessuna domanda "cambio vero o correzione", un solo
//    periodo creato, e (regola A, 2026-09-26) vale anche per i giorni
//    precedenti alla sua data.
//
// Si parte da righe scritte direttamente in Dexie (non dal repository), così
// all'inizio di ogni test l'outbox è vuota e tutto ciò che contiene dopo è
// stato scritto da salvaProfilo.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import type { Obiettivo, ObiettivoTarget, Profilo } from "../db/tipi";
import { TIPO_GIORNO_NORMALE, TIPO_GIORNO_ALLENAMENTO } from "../db/tipi";
import { obiettivoValidoPer, periodoInCorso } from "../totaliDiario";
import {
  valoriDaDati,
  modifiche,
  sezioniModificate,
  serveSceltaPeriodo,
  limitiDataInizio,
  validaModulo,
  salvaProfilo,
  ribasaModulo,
  type ValoriModulo,
  type SceltaPeriodo,
} from "./salvataggioProfilo";

// Il repository prova subito a inviare l'outbox a Supabase: qui la rete
// "non c'è", così le voci restano in coda e si possono contare.
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  }),
}));

const USER = "utente-salvataggio";
const OGGI = "2026-09-26";

const PROFILO: Profilo = {
  id: "profilo-1",
  user_id: USER,
  updated_at: "2026-09-01T10:00:00.000Z",
  deleted_at: null,
  nome: null,
  sesso: "maschio",
  data_nascita: "1990-05-10",
  altezza_cm: 180,
  livello_attivita: "moderato",
  differenzia_giorni: true,
  giorni_allenamento_default: ["lunedi", "giovedi"],
};

const PERIODO: Obiettivo = {
  id: "periodo-1",
  user_id: USER,
  updated_at: "2026-09-01T10:00:00.000Z",
  deleted_at: null,
  valido_dal: "2026-09-01",
  tipo: "massa",
  kcal: 2500,
  proteine_g: 150,
  carboidrati_g: 300,
  grassi_g: 70,
  peso_obiettivo: 80,
};

function riga(tipo: string, kcal: number): ObiettivoTarget {
  return {
    id: `target-${tipo}`,
    user_id: USER,
    updated_at: "2026-09-01T10:00:00.000Z",
    deleted_at: null,
    obiettivo_id: PERIODO.id,
    tipo_giorno: tipo,
    kcal,
    proteine_g: 150,
    carboidrati_g: 300,
    grassi_g: 70,
  };
}

const TARGET = [riga(TIPO_GIORNO_NORMALE, 2500), riga(TIPO_GIORNO_ALLENAMENTO, 2900)];

beforeEach(async () => {
  await Promise.all([
    db.profili.clear(),
    db.obiettivi.clear(),
    db.obiettivi_target.clear(),
    db.outbox.clear(),
  ]);
});

async function conDatiEsistenti() {
  await db.profili.put(PROFILO);
  await db.obiettivi.put(PERIODO);
  await db.obiettivi_target.bulkPut(TARGET);
}

// Le tabelle con almeno una voce in coda verso Supabase.
async function tabelleInOutbox(): Promise<string[]> {
  const voci = await db.outbox.toArray();
  return [...new Set(voci.map((v) => v.tabella))].sort();
}

async function salva(
  caricati: ValoriModulo,
  attuali: ValoriModulo,
  contesto: {
    periodoVistoId: string | null;
    scelta?: SceltaPeriodo | null;
  }
) {
  return salvaProfilo({
    userId: USER,
    caricati,
    attuali,
    giornoCorrente: OGGI,
    periodoVistoId: contesto.periodoVistoId,
    scelta: contesto.scelta ?? null,
  });
}

describe("Salva unico — cambiando una sezione, le altre tabelle non si toccano", () => {
  it("solo Dati personali: si scrive solo profili", async () => {
    await conDatiEsistenti();
    const caricati = valoriDaDati(PROFILO, PERIODO, TARGET);
    const attuali: ValoriModulo = {
      ...caricati,
      datiPersonali: { ...caricati.datiPersonali, altezzaCm: "181" },
    };

    expect(sezioniModificate(caricati, attuali)).toEqual(["datiPersonali"]);
    expect(serveSceltaPeriodo(modifiche(caricati, attuali), PERIODO)).toBe(false);

    await salva(caricati, attuali, { periodoVistoId: PERIODO.id });

    expect(await tabelleInOutbox()).toEqual(["profili"]);
    expect((await db.profili.get(PROFILO.id))?.altezza_cm).toBe(181);
    // Le altre tabelle sono identiche a prima, updated_at compreso.
    expect(await db.obiettivi.toArray()).toEqual([PERIODO]);
    expect(await db.obiettivi_target.orderBy("id").toArray()).toEqual(
      [...TARGET].sort((a, b) => a.id.localeCompare(b.id))
    );
  });

  it("solo Obiettivo, corretto: stesso periodo aggiornato, profili e target allenamento intatti", async () => {
    await conDatiEsistenti();
    const caricati = valoriDaDati(PROFILO, PERIODO, TARGET);
    const attuali: ValoriModulo = {
      ...caricati,
      obiettivo: { ...caricati.obiettivo, target: { ...caricati.obiettivo.target, kcal: "2400" } },
    };

    expect(sezioniModificate(caricati, attuali)).toEqual(["obiettivo"]);
    expect(serveSceltaPeriodo(modifiche(caricati, attuali), PERIODO)).toBe(true);

    await salva(caricati, attuali, {
      periodoVistoId: PERIODO.id,
      scelta: { tipo: "correzione" },
    });

    expect(await tabelleInOutbox()).toEqual(["obiettivi", "obiettivi_target"]);
    expect(await db.profili.toArray()).toEqual([PROFILO]);

    // Nessun periodo nuovo: la correzione non apre uno stacco nello storico.
    const obiettivi = await db.obiettivi.toArray();
    expect(obiettivi).toHaveLength(1);
    expect(obiettivi[0].valido_dal).toBe(PERIODO.valido_dal);
    expect(obiettivi[0].kcal).toBe(2400);

    expect((await db.obiettivi_target.get("target-normale"))?.kcal).toBe(2400);
    expect(await db.obiettivi_target.get("target-allenamento")).toEqual(TARGET[1]);
  });

  it("solo l'interruttore dei giorni differenziati: si scrive solo profili", async () => {
    await conDatiEsistenti();
    const caricati = valoriDaDati(PROFILO, PERIODO, TARGET);
    const attuali: ValoriModulo = {
      ...caricati,
      giorni: { ...caricati.giorni, differenzia: false },
    };

    expect(sezioniModificate(caricati, attuali)).toEqual(["giorni"]);
    expect(serveSceltaPeriodo(modifiche(caricati, attuali), PERIODO)).toBe(false);

    await salva(caricati, attuali, { periodoVistoId: PERIODO.id });

    expect(await tabelleInOutbox()).toEqual(["profili"]);
    const profilo = await db.profili.get(PROFILO.id);
    expect(profilo?.differenzia_giorni).toBe(false);
    // Spegnendo, i giorni scelti restano: riaccendendo si ritrovano.
    expect(profilo?.giorni_allenamento_default).toEqual(["lunedi", "giovedi"]);
    expect(await db.obiettivi.toArray()).toEqual([PERIODO]);
  });

  it("solo il target allenamento: chiede la scelta, e da correzione tocca solo quella riga", async () => {
    await conDatiEsistenti();
    const caricati = valoriDaDati(PROFILO, PERIODO, TARGET);
    const attuali: ValoriModulo = {
      ...caricati,
      giorni: {
        ...caricati.giorni,
        targetAllenamento: { ...caricati.giorni.targetAllenamento, kcal: "3000" },
      },
    };

    expect(serveSceltaPeriodo(modifiche(caricati, attuali), PERIODO)).toBe(true);

    await salva(caricati, attuali, {
      periodoVistoId: PERIODO.id,
      scelta: { tipo: "correzione" },
    });

    expect(await tabelleInOutbox()).toEqual(["obiettivi_target"]);
    expect((await db.obiettivi_target.get("target-allenamento"))?.kcal).toBe(3000);
    expect(await db.obiettivi_target.get("target-normale")).toEqual(TARGET[0]);
    expect(await db.obiettivi.toArray()).toEqual([PERIODO]);
    expect(await db.profili.toArray()).toEqual([PROFILO]);
  });

  it("lo stesso numero scritto in un altro modo non è una modifica", () => {
    const caricati = valoriDaDati(PROFILO, PERIODO, TARGET);
    const attuali: ValoriModulo = {
      ...caricati,
      datiPersonali: { ...caricati.datiPersonali, altezzaCm: "180.0" },
      obiettivo: { ...caricati.obiettivo, pesoObiettivo: "80,0" },
      giorni: { ...caricati.giorni, giorniAllenamento: ["giovedi", "lunedi"] },
    };
    expect(sezioniModificate(caricati, attuali)).toEqual([]);
  });

  it("da spenta, un ritocco ai target allenamento non conta e non si salva", () => {
    const caricati = valoriDaDati(PROFILO, PERIODO, TARGET);
    const attuali: ValoriModulo = {
      ...caricati,
      giorni: {
        differenzia: false,
        giorniAllenamento: [],
        targetAllenamento: { ...caricati.giorni.targetAllenamento, kcal: "1" },
      },
    };
    const m = modifiche(caricati, attuali);
    expect(m.giorniProfilo).toBe(true);
    expect(m.targetAllenamento).toBe(false);
  });
});

describe("Cambio vero: periodo nuovo con data d'inizio", () => {
  it("crea un periodo dalla data scelta e lascia intatto il vecchio", async () => {
    await conDatiEsistenti();
    const caricati = valoriDaDati(PROFILO, PERIODO, TARGET);
    const attuali: ValoriModulo = {
      ...caricati,
      obiettivo: { ...caricati.obiettivo, target: { ...caricati.obiettivo.target, kcal: "2300" } },
    };

    await salva(caricati, attuali, {
      periodoVistoId: PERIODO.id,
      scelta: { tipo: "nuovo", validoDal: "2026-09-20" },
    });

    const obiettivi = await db.obiettivi.toArray();
    expect(obiettivi).toHaveLength(2);
    expect(await db.obiettivi.get(PERIODO.id)).toEqual(PERIODO);

    // I giorni dal 20 in poi prendono il target nuovo, quelli prima il vecchio.
    expect(obiettivoValidoPer(obiettivi, "2026-09-19")?.id).toBe(PERIODO.id);
    const nuovo = periodoInCorso(obiettivi, OGGI);
    expect(nuovo?.valido_dal).toBe("2026-09-20");
    expect(nuovo?.kcal).toBe(2300);

    // Il periodo nuovo nasce con entrambe le righe di target: "allenamento"
    // non resta scoperto fino al prossimo salvataggio a mano.
    const righeNuove = (await db.obiettivi_target.toArray()).filter(
      (r) => r.obiettivo_id === nuovo?.id
    );
    expect(righeNuove.map((r) => [r.tipo_giorno, r.kcal]).sort()).toEqual([
      [TIPO_GIORNO_ALLENAMENTO, 2900],
      [TIPO_GIORNO_NORMALE, 2300],
    ]);
  });

  it("limiti della data: dal giorno dopo l'inizio del periodo in corso fino a oggi", () => {
    expect(limitiDataInizio(PERIODO, OGGI)).toEqual({ min: "2026-09-02", max: OGGI });
    // Periodo iniziato ieri: solo oggi.
    expect(limitiDataInizio({ ...PERIODO, valido_dal: "2026-09-25" }, OGGI)).toEqual({
      min: OGGI,
      max: OGGI,
    });
    // Periodo iniziato oggi: nessuna data, si può solo correggere.
    expect(limitiDataInizio({ ...PERIODO, valido_dal: OGGI }, OGGI)).toBeNull();
  });

  it("una data fuori dai limiti non scrive niente", async () => {
    await conDatiEsistenti();
    const caricati = valoriDaDati(PROFILO, PERIODO, TARGET);
    const attuali: ValoriModulo = {
      ...caricati,
      obiettivo: { ...caricati.obiettivo, tipo: "mantenere" },
    };

    for (const validoDal of [PERIODO.valido_dal, "2026-08-15", "2026-09-27"]) {
      await expect(
        salva(caricati, attuali, {
          periodoVistoId: PERIODO.id,
          scelta: { tipo: "nuovo", validoDal },
        })
      ).rejects.toThrow();
    }
    expect(await db.outbox.count()).toBe(0);
    expect(await db.obiettivi.toArray()).toEqual([PERIODO]);
  });
});

describe("Primo inserimento", () => {
  it("nessuna domanda, un solo periodo, e vale anche per i giorni precedenti", async () => {
    const caricati = valoriDaDati(null, null, []);
    const attuali: ValoriModulo = {
      ...caricati,
      obiettivo: {
        tipo: "dimagrire",
        pesoObiettivo: "",
        target: { kcal: "1900", grassi: "60", carboidrati: "200", proteine: "140" },
      },
    };
    const m = modifiche(caricati, attuali);

    expect(serveSceltaPeriodo(m, null)).toBe(false);
    expect(validaModulo(attuali, m, { profilo: null, periodo: null })).toEqual({});

    await salva(caricati, attuali, { periodoVistoId: null });

    const obiettivi = await db.obiettivi.toArray();
    expect(obiettivi).toHaveLength(1);
    expect(obiettivi[0].valido_dal).toBe(OGGI);

    const target = await db.obiettivi_target.toArray();
    expect(target).toHaveLength(1);
    expect(target[0].tipo_giorno).toBe(TIPO_GIORNO_NORMALE);

    // Nessun profilo creato: la sezione Dati personali non è stata toccata.
    expect(await db.profili.count()).toBe(0);

    // Regola A: una giornata registrata a ritroso, prima del primo periodo,
    // ha comunque il suo target.
    expect(obiettivoValidoPer(obiettivi, "2026-08-01")?.id).toBe(obiettivi[0].id);
  });

  it("target allenamento senza nessun periodo e senza target normali: errore, non un periodo vuoto", () => {
    const caricati = valoriDaDati(null, null, []);
    const attuali: ValoriModulo = {
      ...caricati,
      datiPersonali: { ...caricati.datiPersonali, livelloAttivita: "leggero" },
      giorni: {
        differenzia: true,
        giorniAllenamento: ["lunedi"],
        targetAllenamento: { kcal: "2800", grassi: "70", carboidrati: "300", proteine: "150" },
      },
    };
    const errori = validaModulo(attuali, modifiche(caricati, attuali), {
      profilo: null,
      periodo: null,
    });
    expect(errori.giorni).toBeDefined();
  });

  it("creare il profilo richiede il livello di attività: l'app non lo inventa", () => {
    const caricati = valoriDaDati(null, null, []);
    const attuali: ValoriModulo = {
      ...caricati,
      giorni: { ...caricati.giorni, differenzia: true },
    };
    const errori = validaModulo(attuali, modifiche(caricati, attuali), {
      profilo: null,
      periodo: null,
    });
    expect(errori.datiPersonali).toBeDefined();
  });
});

// Le decisioni di scrittura si prendono rileggendo Dexie dentro salvaProfilo,
// non dallo stato React della pagina (useLiveQuery), che può essere indietro
// di un giro di ridisegno. Qui la "pagina" (caricati) crede una cosa e Dexie
// ne dice un'altra.
describe("Salva unico — decisioni su Dexie riletto, non sullo stato della pagina", () => {
  it("la pagina crede che il profilo non esista, Dexie ce l'ha: nessun secondo profilo", async () => {
    await conDatiEsistenti();
    const caricati = valoriDaDati(null, PERIODO, TARGET);
    const attuali: ValoriModulo = {
      ...caricati,
      datiPersonali: { ...caricati.datiPersonali, altezzaCm: "175", livelloAttivita: "attivo" },
    };

    const esito = await salva(caricati, attuali, { periodoVistoId: PERIODO.id });

    expect(esito.esito).toBe("salvato");
    const profili = await db.profili.toArray();
    expect(profili).toHaveLength(1);
    expect(profili[0].id).toBe(PROFILO.id);
    expect(profili[0].altezza_cm).toBe(175);
  });

  it("la pagina non vede le righe di target, Dexie sì: la correzione non crea una seconda riga 'normale'", async () => {
    await conDatiEsistenti();
    const caricati = valoriDaDati(PROFILO, PERIODO, []);
    const attuali: ValoriModulo = {
      ...caricati,
      obiettivo: { ...caricati.obiettivo, target: { ...caricati.obiettivo.target, kcal: "2400" } },
    };

    await salva(caricati, attuali, {
      periodoVistoId: PERIODO.id,
      scelta: { tipo: "correzione" },
    });

    const normali = (await db.obiettivi_target.toArray()).filter(
      (r) => r.tipo_giorno === TIPO_GIORNO_NORMALE
    );
    expect(normali).toHaveLength(1);
    expect(normali[0].id).toBe("target-normale");
    expect(normali[0].kcal).toBe(2400);
  });

  it("il periodo in corso è cambiato (altro dispositivo): non salva niente e restituisce i valori riletti", async () => {
    await conDatiEsistenti();
    const arrivato: Obiettivo = {
      ...PERIODO,
      id: "periodo-altro-dispositivo",
      valido_dal: "2026-09-20",
      kcal: 2200,
    };
    await db.obiettivi.put(arrivato);

    const caricati = valoriDaDati(PROFILO, PERIODO, TARGET);
    const attuali: ValoriModulo = {
      ...caricati,
      datiPersonali: { ...caricati.datiPersonali, altezzaCm: "181" },
      obiettivo: { ...caricati.obiettivo, tipo: "mantenere" },
    };

    const esito = await salva(caricati, attuali, {
      periodoVistoId: PERIODO.id,
      scelta: { tipo: "correzione" },
    });

    expect(esito.esito).toBe("periodo-cambiato");
    if (esito.esito === "periodo-cambiato") {
      // Il periodo arrivato non ha righe di target: si legge dalle colonne.
      expect(esito.caricati.obiettivo.target.kcal).toBe("2200");
    }
    // Niente scritto, nemmeno la sezione Dati personali.
    expect(await db.outbox.count()).toBe(0);
    expect(await db.profili.toArray()).toEqual([PROFILO]);
    expect(await db.obiettivi.get(PERIODO.id)).toEqual(PERIODO);
  });

  it("primo inserimento, ma nel frattempo è arrivato un periodo: nessun secondo 'primo periodo'", async () => {
    await db.obiettivi.put(PERIODO);
    const caricati = valoriDaDati(null, null, []);
    const attuali: ValoriModulo = {
      ...caricati,
      obiettivo: {
        tipo: "dimagrire",
        pesoObiettivo: "",
        target: { kcal: "1900", grassi: "60", carboidrati: "200", proteine: "140" },
      },
    };

    const esito = await salva(caricati, attuali, { periodoVistoId: null });

    expect(esito.esito).toBe("periodo-cambiato");
    expect(await db.obiettivi.count()).toBe(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it("se il Salva non tocca obiettivo né target, un periodo cambiato non lo blocca", async () => {
    await conDatiEsistenti();
    const caricati = valoriDaDati(PROFILO, PERIODO, TARGET);
    const attuali: ValoriModulo = {
      ...caricati,
      datiPersonali: { ...caricati.datiPersonali, altezzaCm: "181" },
    };

    const esito = await salva(caricati, attuali, { periodoVistoId: "un-periodo-vecchio" });

    expect(esito.esito).toBe("salvato");
    expect(await tabelleInOutbox()).toEqual(["profili"]);
  });

  it("la pagina crede che il profilo esista, Dexie no, e manca il livello di attività: da correggere", async () => {
    const caricati = valoriDaDati(PROFILO, null, []);
    const attuali: ValoriModulo = {
      ...caricati,
      datiPersonali: { ...caricati.datiPersonali, livelloAttivita: "", altezzaCm: "181" },
    };

    const esito = await salva(caricati, attuali, { periodoVistoId: null });

    expect(esito.esito).toBe("da-correggere");
    expect(await db.profili.count()).toBe(0);
  });
});

describe("ribasaModulo", () => {
  it("i campi non toccati prendono i valori riletti, quelli toccati restano dell'utente", () => {
    const vecchi = valoriDaDati(PROFILO, PERIODO, TARGET);
    const nuovi = valoriDaDati(
      { ...PROFILO, altezza_cm: 182 },
      { ...PERIODO, id: "periodo-nuovo", tipo: "mantenere", kcal: 2200 },
      []
    );
    const attuali: ValoriModulo = {
      ...vecchi,
      obiettivo: {
        ...vecchi.obiettivo,
        target: { ...vecchi.obiettivo.target, proteine: "170" },
      },
    };

    const ribasati = ribasaModulo(vecchi, nuovi, attuali);

    // Non toccati dall'utente: arrivano i valori nuovi.
    expect(ribasati.datiPersonali.altezzaCm).toBe("182");
    expect(ribasati.obiettivo.tipo).toBe("mantenere");
    expect(ribasati.obiettivo.target.kcal).toBe("2200");
    // Toccato dall'utente: resta il suo.
    expect(ribasati.obiettivo.target.proteine).toBe("170");
  });
});
