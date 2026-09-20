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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import { sincronizzaOutbox } from "./sincronizza";
import type { VoceOutbox } from "./outbox";

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
