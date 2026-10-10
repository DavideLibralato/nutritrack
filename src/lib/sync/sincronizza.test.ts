// Bug reale (non solo ipotetico): un utente ha creato un obiettivo dal
// Profilo, e la riga "normale" collegata in obiettivi_target non è mai
// arrivata su Supabase, senza nessun errore visibile a schermo. La causa
// trovata rileggendo sincronizzaOutbox: il ciclo, quando una voce falliva,
// passava comunque alla successiva (`continue`). Per due voci collegate da
// una foreign key (qui: obiettivi_target.obiettivo_id → obiettivi.id), se la
// voce genitore fallisce anche solo per un singhiozzo di rete, la voce
// figlia tentata subito dopo fallisce per forza — e trattandosi di un
// fallimento di sync silenzioso (sezione 11 del documento), il buco si nota
// solo controllando Supabase a mano, mesi dopo. Bug di logica sottile
// (CLAUDE.md, sezione test): resta come test permanente.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db/database";
import { sincronizzaOutbox } from "./sincronizza";
import { accodaMutazione, ordinaOutbox, type VoceOutbox } from "./outbox";

const upsertMock = vi.fn();

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: (tabella: string) => ({
      upsert: (dati: unknown) => upsertMock(tabella, dati),
    }),
  }),
}));

function voce(parziale: Partial<VoceOutbox> & Pick<VoceOutbox, "id" | "tabella" | "creato_il">): VoceOutbox {
  return {
    record_id: parziale.id.split(":")[1] ?? parziale.id,
    dati: { id: "x", user_id: "u1", updated_at: "2026-09-20T00:00:00.000Z", deleted_at: null },
    tentativi: 0,
    ultimo_errore: null,
    sospesa_il: null,
    ...parziale,
  };
}

describe("sincronizzaOutbox — voci collegate da una foreign key", () => {
  beforeEach(async () => {
    upsertMock.mockReset();
    await db.outbox.clear();
  });

  it("se la voce genitore fallisce, non tenta la voce figlia nella stessa passata", async () => {
    await db.outbox.bulkPut([
      voce({ id: "obiettivi:g1", tabella: "obiettivi", creato_il: "2026-09-20T10:00:00.000Z" }),
      voce({
        id: "obiettivi_target:f1",
        tabella: "obiettivi_target",
        creato_il: "2026-09-20T10:00:00.001Z",
      }),
    ]);

    upsertMock.mockResolvedValueOnce({ error: { message: "violazione chiave esterna" } });

    const risultato = await sincronizzaOutbox();

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith("obiettivi", expect.anything());
    expect(risultato).toEqual({ inviate: 0, fallite: 1, sospese: 0 });

    const rimaste = await db.outbox.toArray();
    expect(rimaste).toHaveLength(2);
    const figlia = rimaste.find((v) => v.tabella === "obiettivi_target");
    expect(figlia?.tentativi).toBe(0); // mai tentata, non solo fallita
  });

  it("se la voce genitore riesce, la stessa passata prosegue con la figlia", async () => {
    await db.outbox.bulkPut([
      voce({ id: "obiettivi:g2", tabella: "obiettivi", creato_il: "2026-09-20T11:00:00.000Z" }),
      voce({
        id: "obiettivi_target:f2",
        tabella: "obiettivi_target",
        creato_il: "2026-09-20T11:00:00.001Z",
      }),
    ]);

    upsertMock.mockResolvedValue({ error: null });

    const risultato = await sincronizzaOutbox();

    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(risultato).toEqual({ inviate: 2, fallite: 0, sospese: 0 });
    expect(await db.outbox.toArray()).toHaveLength(0);
  });
});

// Bug reale trovato subito dopo, ancora peggiore: una voce che non può
// riuscire (schema pre-split, vincolo violato...) bloccava `break` per
// sempre tutte le voci dietro di lei — la sync per intere tabelle si è
// fermata per settimane dietro un singolo pasto doppione. Oltre una soglia
// di tentativi, la voce va accantonata (non cancellata) e la coda deve
// proseguire con le altre.
describe("sincronizzaOutbox — voci che non passeranno mai", () => {
  beforeEach(async () => {
    upsertMock.mockReset();
    await db.outbox.clear();
  });

  it("dopo la soglia di tentativi, la voce si accantona e non blocca le successive", async () => {
    await db.outbox.bulkPut([
      voce({
        id: "pasti:doppione",
        tabella: "pasti",
        creato_il: "2026-09-20T09:00:00.000Z",
        tentativi: 4, // un fallimento in più raggiunge la soglia (5)
        ultimo_errore: "duplicate key value violates unique constraint pasti_user_nome_idx",
      }),
      voce({ id: "misurazioni:m1", tabella: "misurazioni", creato_il: "2026-09-20T09:00:00.001Z" }),
    ]);

    upsertMock
      .mockResolvedValueOnce({
        error: { message: "duplicate key value violates unique constraint pasti_user_nome_idx" },
      })
      .mockResolvedValueOnce({ error: null });

    const risultato = await sincronizzaOutbox();

    expect(upsertMock).toHaveBeenCalledTimes(2); // non si è fermata alla prima
    expect(risultato).toEqual({ inviate: 1, fallite: 1, sospese: 1 });

    const rimaste = await db.outbox.toArray();
    expect(rimaste).toHaveLength(1); // la misurazione è stata inviata e cancellata
    expect(rimaste[0].tabella).toBe("pasti");
    expect(rimaste[0].sospesa_il).not.toBeNull();
    expect(rimaste[0].tentativi).toBe(5);
  });

  it("una voce già accantonata non viene ritentata nei giri successivi", async () => {
    await db.outbox.put(
      voce({
        id: "pasti:doppione",
        tabella: "pasti",
        creato_il: "2026-09-20T09:00:00.000Z",
        tentativi: 5,
        ultimo_errore: "duplicate key value violates unique constraint pasti_user_nome_idx",
        sospesa_il: "2026-09-20T09:05:00.000Z",
      })
    );

    const risultato = await sincronizzaOutbox();

    expect(upsertMock).not.toHaveBeenCalled();
    expect(risultato).toEqual({ inviate: 0, fallite: 0, sospese: 0 });
    expect(await db.outbox.count()).toBe(1); // resta, solo ignorata
  });
});

// Difetto trovato il 9/10/2026 (PUNTO_DI_PARTENZA.md, sezione 9.2, "L'ordine
// della coda"): riscrivere una riga già in coda le dà un creato_il nuovo,
// quindi un genitore modificato DOPO i suoi figli finiva dietro di loro. Il
// server rifiutava il figlio (foreign key), la coda si fermava e dopo 5
// giri il figlio veniva accantonato: mai arrivato. Qui il server finto
// rifiuta una voce di diario il cui pasto non ha ancora ricevuto, come fa
// Postgres con voci_diario.pasto_id → pasti.id.
describe("sincronizzaOutbox — i genitori partono prima dei figli", () => {
  const pastiSulServer = new Set<string>();

  beforeEach(async () => {
    upsertMock.mockReset();
    pastiSulServer.clear();
    await db.outbox.clear();
    upsertMock.mockImplementation(async (tabella: string, dati: { id: string; pasto_id?: string }) => {
      if (tabella === "pasti") {
        pastiSulServer.add(dati.id);
        return { error: null };
      }
      if (tabella === "voci_diario" && dati.pasto_id && !pastiSulServer.has(dati.pasto_id)) {
        return { error: { message: 'violates foreign key constraint "voci_diario_pasto_id_fkey"' } };
      }
      return { error: null };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("un pasto modificato dopo la voce che lo usa parte lo stesso per primo", async () => {
    const base = { user_id: "u1", deleted_at: null, updated_at: "2026-10-09T10:00:00.000Z" };
    const pasto = { ...base, id: "p-nuovo", nome: "Pranzo 1", ora_inizio: "12:30", ordine: 2 };
    const voceDiario = { ...base, id: "v1", pasto_id: "p-nuovo" };

    // La sequenza vera, offline: pasto nuovo, voce spostata su di lui, poi
    // l'ora del pasto corretta. La terza scrittura sostituisce la voce del
    // pasto in coda, con un creato_il successivo a quello della voce.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T10:00:00.000Z"));
    await accodaMutazione("pasti", pasto);
    vi.setSystemTime(new Date("2026-10-09T10:00:01.000Z"));
    await accodaMutazione("voci_diario", voceDiario);
    vi.setSystemTime(new Date("2026-10-09T10:00:02.000Z"));
    const pastoCorretto = { ...pasto, ora_inizio: "13:00" };
    await accodaMutazione("pasti", pastoCorretto);
    vi.useRealTimers();

    const risultato = await sincronizzaOutbox();

    expect(upsertMock.mock.calls.map((c) => c[0])).toEqual(["pasti", "voci_diario"]);
    expect(risultato).toEqual({ inviate: 2, fallite: 0, sospese: 0 });
    expect(await db.outbox.count()).toBe(0);
  });
});

describe("ordinaOutbox", () => {
  it("prima per livello della tabella, poi creato_il, poi id", () => {
    const voci = [
      voce({ id: "composizioni_voci:c1", tabella: "composizioni_voci", creato_il: "2026-10-09T08:00:00.000Z" }),
      voce({ id: "voci_diario:b", tabella: "voci_diario", creato_il: "2026-10-09T09:00:00.000Z" }),
      voce({ id: "composizioni:k1", tabella: "composizioni", creato_il: "2026-10-09T12:00:00.000Z" }),
      voce({ id: "voci_diario:a", tabella: "voci_diario", creato_il: "2026-10-09T09:00:00.000Z" }),
      voce({ id: "alimenti:x", tabella: "alimenti", creato_il: "2026-10-09T11:00:00.000Z" }),
      voce({ id: "misurazioni:m", tabella: "misurazioni", creato_il: "2026-10-09T10:00:00.000Z" }),
    ];

    expect(ordinaOutbox(voci).map((v) => v.id)).toEqual([
      "misurazioni:m",
      "alimenti:x",
      "voci_diario:a",
      "voci_diario:b",
      "composizioni:k1",
      "composizioni_voci:c1",
    ]);
  });
});

// Difetto trovato il 10/10/2026 (analisi dell'indicatore di
// sincronizzazione): senza rete la libreria Supabase non lancia
// un'eccezione, risponde { error } con status 0, e il giro lo contava come
// un tentativo. Offline ogni scrittura fa un giro: dopo 5 scritture la
// prima voce in coda veniva accantonata senza che il server l'avesse mai
// vista. Lo stesso con la sessione scaduta (401). Ora conta solo un
// rifiuto vero del server.
describe("sincronizzaOutbox — richieste che non arrivano al server", () => {
  const SENZA_RETE = {
    error: { message: "TypeError: Failed to fetch" },
    status: 0,
  };
  const SESSIONE_SCADUTA = {
    error: { message: "JWT expired" },
    status: 401,
  };

  beforeEach(async () => {
    upsertMock.mockReset();
    await db.outbox.clear();
    await db.outbox.bulkPut([
      voce({ id: "pasti:p1", tabella: "pasti", creato_il: "2026-10-10T09:00:00.000Z" }),
      voce({ id: "misurazioni:m1", tabella: "misurazioni", creato_il: "2026-10-10T09:00:00.001Z" }),
    ]);
  });

  it("offline, sei giri non accantonano niente e non contano tentativi", async () => {
    upsertMock.mockResolvedValue(SENZA_RETE);

    for (let giro = 0; giro < 6; giro++) {
      expect(await sincronizzaOutbox()).toEqual({ inviate: 0, fallite: 1, sospese: 0 });
    }

    // Uno per giro: sempre fermo sulla prima voce, mai tentata la seconda.
    expect(upsertMock).toHaveBeenCalledTimes(6);
    const pasto = await db.outbox.get("pasti:p1");
    expect(pasto?.tentativi).toBe(0);
    expect(pasto?.sospesa_il).toBeNull();
    expect(pasto?.ultimo_errore).toBe("TypeError: Failed to fetch");
    expect((await db.outbox.get("misurazioni:m1"))?.tentativi).toBe(0);
  });

  it("con la sessione scaduta (401) la coda aspetta senza consumare tentativi", async () => {
    await db.outbox.update("pasti:p1", { tentativi: 4 }); // a un passo dalla soglia
    upsertMock.mockResolvedValue(SESSIONE_SCADUTA);

    await sincronizzaOutbox();
    await sincronizzaOutbox();

    const pasto = await db.outbox.get("pasti:p1");
    expect(pasto?.tentativi).toBe(4);
    expect(pasto?.sospesa_il).toBeNull();
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });

  // Senza rete Supabase risponde con status 0, non lancia: un'eccezione è
  // più probabilmente un guasto su quella riga. Se non contasse, la riga
  // fermerebbe la coda per sempre senza mai accantonarsi.
  it("un'eccezione durante l'invio conta come tentativo, e al quinto accantona", async () => {
    upsertMock.mockImplementation(async (tabella: string) => {
      if (tabella === "pasti") throw new Error("riga non serializzabile");
      return { error: null, status: 201 };
    });

    await sincronizzaOutbox();
    const dopoUno = await db.outbox.get("pasti:p1");
    expect(dopoUno?.tentativi).toBe(1);
    expect(dopoUno?.sospesa_il).toBeNull();
    expect(dopoUno?.ultimo_errore).toBe("riga non serializzabile");
    expect(await db.outbox.get("misurazioni:m1")).toBeDefined(); // coda ferma

    for (let giro = 0; giro < 3; giro++) await sincronizzaOutbox();
    expect(await sincronizzaOutbox()).toEqual({ inviate: 1, fallite: 1, sospese: 1 });

    const pasto = await db.outbox.get("pasti:p1");
    expect(pasto?.tentativi).toBe(5);
    expect(pasto?.sospesa_il).not.toBeNull();
    expect(await db.outbox.get("misurazioni:m1")).toBeUndefined(); // passata dopo
  });

  it("un rifiuto vero del server (403) conta ancora, fino ad accantonare", async () => {
    await db.outbox.update("pasti:p1", { tentativi: 4 });
    upsertMock
      .mockResolvedValueOnce({
        error: { message: "new row violates row-level security policy" },
        status: 403,
      })
      .mockResolvedValueOnce({ error: null, status: 201 });

    expect(await sincronizzaOutbox()).toEqual({ inviate: 1, fallite: 1, sospese: 1 });
    expect((await db.outbox.get("pasti:p1"))?.sospesa_il).not.toBeNull();
    expect(await db.outbox.get("misurazioni:m1")).toBeUndefined();
  });

  it("tornata la rete, la coda parte dalla prima voce come se nulla fosse", async () => {
    upsertMock.mockResolvedValueOnce(SENZA_RETE).mockResolvedValue({ error: null, status: 201 });

    await sincronizzaOutbox();
    expect(await sincronizzaOutbox()).toEqual({ inviate: 2, fallite: 0, sospese: 0 });
    expect(await db.outbox.count()).toBe(0);
  });
});
