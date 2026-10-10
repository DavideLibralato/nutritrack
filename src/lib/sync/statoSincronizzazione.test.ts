// Lo stato dell'indicatore di sincronizzazione (statoSincronizzazione.ts,
// dal 10/10/2026). Logica sottile che non fa rumore se sbaglia: un
// indicatore che dice "tutto salvato" mentre il server rifiuta è il
// problema del 6/9 ("Salvato." in locale, sync fallita in silenzio) con
// un'etichetta in più. Si provano le priorità della funzione pura, e il
// collegamento con salita e discesa vere (solo il client Supabase è finto).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import { sincronizzaOutbox } from "./sincronizza";
import { scaricaTutto } from "./discesa";
import {
  azzeraStatoGiri,
  CHIAVE_ULTIMO_SUCCESSO,
  leggiStatoGiri,
  iscriviStatoGiri,
  statoDaMostrare,
  RITARDO_IN_CORSO_MS,
  type RiassuntoCoda,
  type StatoGiri,
  type StatoVerso,
} from "./statoSincronizzazione";
import type { VoceOutbox } from "./outbox";

// --- Client Supabase finto ---------------------------------------------------
// Salita: risponde come `rispostaUpsert`. Discesa: ogni tabella risponde
// vuota, salvo quelle in `rispostePerTabella`.
const server = vi.hoisted(() => ({
  rispostaUpsert: { error: null, status: 201 } as { error: { message: string } | null; status: number },
  rispostePerTabella: {} as Record<string, { error: { message: string }; status: number }>,
}));

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: (tabella: string) => {
      const builder = {
        upsert: async () => server.rispostaUpsert,
        select: () => builder,
        order: () => builder,
        eq: () => builder,
        or: () => builder,
        gte: () => builder,
        range: () => builder,
        then: (risolvi: (v: unknown) => void) =>
          risolvi(server.rispostePerTabella[tabella] ?? { data: [], error: null, status: 200 }),
      };
      return builder;
    },
  }),
}));

// --- Aiuti ------------------------------------------------------------------

const ADESSO = Date.parse("2026-10-10T14:30:00.000Z");

const CODA_VUOTA: RiassuntoCoda = { inAttesa: 0, inAttesaDal: null, accantonate: 0 };

function verso(parziale: Partial<StatoVerso> = {}): StatoVerso {
  return { inCorso: false, esito: "ok", dal: null, diFila: 0, ...parziale };
}

function giri(parziale: {
  salita?: Partial<StatoVerso>;
  discesa?: Partial<StatoVerso> & { tabelleNonScaricate?: StatoGiri["discesa"]["tabelleNonScaricate"] };
  inCorsoDal?: string | null;
  ultimoSuccesso?: string | null;
} = {}): StatoGiri {
  return {
    salita: verso(parziale.salita),
    discesa: { ...verso(parziale.discesa), tabelleNonScaricate: parziale.discesa?.tabelleNonScaricate ?? [] },
    inCorsoDal: parziale.inCorsoDal ?? null,
    ultimoSuccesso: parziale.ultimoSuccesso ?? "2026-10-10T14:00:00.000Z",
  };
}

function inCorsoDa(ms: number): string {
  return new Date(ADESSO - ms).toISOString();
}

function voce(id: string, tentativi = 0): VoceOutbox {
  return {
    id: `pasti:${id}`,
    tabella: "pasti",
    record_id: id,
    dati: { id, user_id: "u1", updated_at: "2026-10-10T09:00:00.000Z", deleted_at: null },
    creato_il: "2026-10-10T09:00:00.000Z",
    tentativi,
    ultimo_errore: null,
    sospesa_il: null,
  };
}

// --- statoDaMostrare: le priorità -----------------------------------------------

describe("statoDaMostrare — un solo stato, per priorità", () => {
  it("le accantonate vincono su tutto, con il pallino", () => {
    const stato = statoDaMostrare(
      { inAttesa: 2, inAttesaDal: "2026-10-10T14:02:00.000Z", accantonate: 3 },
      giri({ salita: { esito: "sessione" }, discesa: { esito: "errore" }, inCorsoDal: inCorsoDa(5000) }),
      ADESSO
    );
    expect(stato).toEqual({ tipo: "accantonate", numero: 3, pallino: true });
  });

  it("la sessione scaduta, anche solo in discesa, vince su un rifiuto del server", () => {
    const stato = statoDaMostrare(
      { ...CODA_VUOTA, inAttesa: 2 },
      giri({ salita: { esito: "errore", dal: "2026-10-10T14:00:00.000Z", diFila: 3 }, discesa: { esito: "sessione" } }),
      ADESSO
    );
    expect(stato).toEqual({ tipo: "sessione", inAttesa: 2, pallino: true });
  });

  it("errore: il pallino si accende solo dal secondo giro fallito di fila", () => {
    const primo = statoDaMostrare(
      { ...CODA_VUOTA, inAttesa: 1 },
      giri({ salita: { esito: "errore", dal: "2026-10-10T14:02:00.000Z", diFila: 1 } }),
      ADESSO
    );
    expect(primo).toMatchObject({ tipo: "errore", inAttesa: 1, dal: "2026-10-10T14:02:00.000Z", pallino: false });

    const secondo = statoDaMostrare(
      { ...CODA_VUOTA, inAttesa: 1 },
      giri({ salita: { esito: "errore", dal: "2026-10-10T14:02:00.000Z", diFila: 2 } }),
      ADESSO
    );
    expect(secondo).toMatchObject({ tipo: "errore", pallino: true });
  });

  it("errore in salita e in discesa: da quando dice il più vecchio, e le tabelle sono quelle della discesa", () => {
    const stato = statoDaMostrare(
      CODA_VUOTA,
      giri({
        salita: { esito: "errore", dal: "2026-10-10T14:10:00.000Z", diFila: 1 },
        discesa: { esito: "errore", dal: "2026-10-10T13:50:00.000Z", diFila: 2, tabelleNonScaricate: ["pasti"] },
      }),
      ADESSO
    );
    expect(stato).toEqual({
      tipo: "errore",
      inAttesa: 0,
      dal: "2026-10-10T13:50:00.000Z",
      tabelleNonScaricate: ["pasti"],
      pallino: true,
    });
  });

  it("un errore resta a schermo mentre il giro dopo è in corso (niente sfarfallio)", () => {
    const stato = statoDaMostrare(
      { ...CODA_VUOTA, inAttesa: 1 },
      giri({ salita: { esito: "errore", dal: "2026-10-10T14:02:00.000Z", diFila: 1 }, inCorsoDal: inCorsoDa(5000) }),
      ADESSO
    );
    expect(stato.tipo).toBe("errore");
  });

  it("in corso si mostra solo dopo un secondo", () => {
    expect(
      statoDaMostrare(CODA_VUOTA, giri({ inCorsoDal: inCorsoDa(RITARDO_IN_CORSO_MS - 1) }), ADESSO).tipo
    ).toBe("sincronizzato");
    expect(
      statoDaMostrare(CODA_VUOTA, giri({ inCorsoDal: inCorsoDa(RITARDO_IN_CORSO_MS) }), ADESSO)
    ).toEqual({ tipo: "in-corso", pallino: false });
  });

  it("in attesa porta da quando: la voce più vecchia della coda", () => {
    const stato = statoDaMostrare(
      { inAttesa: 2, inAttesaDal: "2026-10-08T14:02:00.000Z", accantonate: 0 },
      giri({ salita: { esito: "rete", dal: "2026-10-08T14:02:00.000Z", diFila: 40 } }),
      ADESSO
    );
    expect(stato).toEqual({ tipo: "in-attesa", numero: 2, dal: "2026-10-08T14:02:00.000Z", pallino: false });
  });

  it("la voce di una scrittura appena fatta, con l'ultimo giro andato bene, non fa comparire 'in attesa'", () => {
    const coda = { inAttesa: 1, inAttesaDal: "2026-10-10T14:29:59.900Z", accantonate: 0 };
    const giroAppenaPartito = inCorsoDa(100);
    expect(statoDaMostrare(coda, giri({ salita: { esito: "ok" }, inCorsoDal: giroAppenaPartito }), ADESSO).tipo).toBe(
      "sincronizzato"
    );
    // Se l'ultimo giro era fallito per la rete, o non c'è ancora stato,
    // le voci aspettano davvero.
    expect(
      statoDaMostrare(coda, giri({ salita: { esito: "rete", diFila: 1 }, inCorsoDal: giroAppenaPartito }), ADESSO).tipo
    ).toBe("in-attesa");
    expect(statoDaMostrare(coda, giri({ salita: { esito: null }, inCorsoDal: giroAppenaPartito }), ADESSO).tipo).toBe(
      "in-attesa"
    );
  });

  it("un giro che lavora davvero sulla coda da più di un secondo si mostra in corso", () => {
    const stato = statoDaMostrare(
      { inAttesa: 3, inAttesaDal: "2026-10-10T14:00:00.000Z", accantonate: 0 },
      giri({ salita: { esito: "rete", diFila: 1 }, inCorsoDal: inCorsoDa(2000) }),
      ADESSO
    );
    expect(stato.tipo).toBe("in-corso");
  });

  it("senza rete ma con la coda vuota: tutto salvato, con l'ora dell'ultimo contatto", () => {
    const stato = statoDaMostrare(
      CODA_VUOTA,
      giri({ discesa: { esito: "rete", diFila: 3 }, ultimoSuccesso: "2026-10-10T08:15:00.000Z" }),
      ADESSO
    );
    expect(stato).toEqual({ tipo: "sincronizzato", ultimoSuccesso: "2026-10-10T08:15:00.000Z", pallino: false });
  });
});

// --- Il collegamento con salita e discesa ------------------------------------

describe("lo stato dei giri, aggiornato da salita e discesa", () => {
  beforeEach(async () => {
    server.rispostaUpsert = { error: null, status: 201 };
    server.rispostePerTabella = {};
    window.localStorage.clear();
    azzeraStatoGiri();
    await db.outbox.clear();
  });

  it("un giro senza rete: esito rete, da quando fermo sul primo giro della serie", async () => {
    await db.outbox.put(voce("p1"));
    server.rispostaUpsert = { error: { message: "TypeError: Failed to fetch" }, status: 0 };

    await sincronizzaOutbox();
    const primo = leggiStatoGiri().salita;
    expect(primo).toMatchObject({ inCorso: false, esito: "rete", diFila: 1 });
    expect(primo.dal).not.toBeNull();

    await sincronizzaOutbox();
    expect(leggiStatoGiri().salita).toMatchObject({ esito: "rete", diFila: 2, dal: primo.dal });
  });

  it("un rifiuto del server due volte di fila accende il pallino; un giro riuscito spegne tutto e segna l'ora", async () => {
    await db.outbox.put(voce("p1"));
    server.rispostaUpsert = { error: { message: "violates check constraint" }, status: 400 };
    await sincronizzaOutbox();
    await sincronizzaOutbox();
    expect(leggiStatoGiri().salita).toMatchObject({ esito: "errore", diFila: 2 });
    const coda = { inAttesa: 1, inAttesaDal: null, accantonate: 0 };
    expect(statoDaMostrare(coda, leggiStatoGiri(), Date.now()).pallino).toBe(true);

    server.rispostaUpsert = { error: null, status: 201 };
    await sincronizzaOutbox();
    const dopo = leggiStatoGiri();
    expect(dopo.salita).toMatchObject({ esito: "ok", dal: null, diFila: 0 });
    expect(dopo.ultimoSuccesso).not.toBeNull();
    expect(window.localStorage.getItem(CHIAVE_ULTIMO_SUCCESSO)).toBe(dopo.ultimoSuccesso);
  });

  it("la sessione scaduta (401) dà esito sessione", async () => {
    await db.outbox.put(voce("p1"));
    server.rispostaUpsert = { error: { message: "JWT expired" }, status: 401 };
    await sincronizzaOutbox();
    expect(leggiStatoGiri().salita.esito).toBe("sessione");
  });

  it("un giro con la coda vuota non aggiorna 'controllato alle': non ha parlato col server", async () => {
    await sincronizzaOutbox();
    expect(leggiStatoGiri().salita.esito).toBe("ok");
    expect(leggiStatoGiri().ultimoSuccesso).toBeNull();
  });

  it("chi ascolta viene avvisato a inizio e fine giro, con un oggetto nuovo ogni volta", async () => {
    const visti: StatoGiri[] = [];
    const smetti = iscriviStatoGiri(() => visti.push(leggiStatoGiri()));
    await sincronizzaOutbox();
    smetti();

    expect(visti).toHaveLength(2);
    expect(visti[0].salita.inCorso).toBe(true);
    expect(visti[0].inCorsoDal).not.toBeNull();
    expect(visti[1].salita.inCorso).toBe(false);
    expect(visti[1].inCorsoDal).toBeNull();
    expect(visti[0]).not.toBe(visti[1]);
  });

  it("discesa: restituisce le tabelle non scaricate, e la sessione vince sulla rete", async () => {
    server.rispostePerTabella = {
      pasti: { error: { message: "JWT expired" }, status: 401 },
      alimenti: { error: { message: "FetchError: Load failed" }, status: 0 },
    };

    const nonScaricate = await scaricaTutto("u1");

    expect(nonScaricate).toEqual(
      expect.arrayContaining([
        { tabella: "pasti", esito: "sessione" },
        { tabella: "alimenti", esito: "rete" },
      ])
    );
    expect(nonScaricate).toHaveLength(2);
    expect(leggiStatoGiri().discesa).toMatchObject({
      esito: "sessione",
      tabelleNonScaricate: expect.arrayContaining(["pasti", "alimenti"]),
    });
    expect(leggiStatoGiri().ultimoSuccesso).toBeNull();
  });

  it("discesa: un rifiuto del server su una tabella dà esito errore", async () => {
    server.rispostePerTabella = { misurazioni: { error: { message: "permission denied" }, status: 403 } };
    await scaricaTutto("u1");
    expect(leggiStatoGiri().discesa).toMatchObject({ esito: "errore", tabelleNonScaricate: ["misurazioni"] });
  });

  it("discesa tutta riuscita: esito ok e ora dell'ultimo contatto", async () => {
    expect(await scaricaTutto("u1")).toEqual([]);
    expect(leggiStatoGiri().discesa).toMatchObject({ esito: "ok", tabelleNonScaricate: [] });
    expect(leggiStatoGiri().ultimoSuccesso).not.toBeNull();
  });

  it("l'ora dell'ultimo contatto si rilegge da localStorage dopo un riavvio", () => {
    window.localStorage.setItem(CHIAVE_ULTIMO_SUCCESSO, "2026-10-09T20:00:00.000Z");
    azzeraStatoGiri();
    expect(leggiStatoGiri().ultimoSuccesso).toBe("2026-10-09T20:00:00.000Z");
  });
});
