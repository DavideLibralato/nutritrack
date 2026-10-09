// Le scritture del repository dentro una db.transaction() (src/lib/
// repository/repository.ts, dal 9/10/2026). Ogni scrittura lancia la sync
// verso Supabase, che fa chiamate di rete: se quella catena restasse
// agganciata alla transazione, IndexedDB chiuderebbe la transazione
// mentre la sync aspetta la rete, e la sync fallirebbe in silenzio
// lasciando la coda piena. Dexie.ignoreTransaction la fa partire fuori.
// Serve alla rinomina "da oggi" dei pasti, che deve essere tutto o niente.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import { repositoryPasti } from "./index";

const upsertMock = vi.fn();

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: (tabella: string) => ({
      upsert: (dati: unknown) => upsertMock(tabella, dati),
    }),
  }),
}));

const USER = "utente-transazione";

// Aspetta finché la condizione è vera, o fallisce dopo timeoutMs.
async function attendi(condizione: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
  const inizio = Date.now();
  while (!(await condizione())) {
    if (Date.now() - inizio > timeoutMs) throw new Error("condizione mai vera entro il timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("repository dentro una transazione Dexie", () => {
  beforeEach(async () => {
    upsertMock.mockReset();
    // Una risposta che arriva "dalla rete": dopo un timer, non subito.
    upsertMock.mockImplementation(
      () => new Promise((risolvi) => setTimeout(() => risolvi({ error: null }), 20))
    );
    await db.pasti.clear();
    await db.outbox.clear();
  });

  it("la riga e la sua voce in coda si salvano, e la sync dopo il commit svuota la coda", async () => {
    let id = "";
    await db.transaction("rw", [db.pasti, db.outbox], async () => {
      const pasto = await repositoryPasti.crea({
        user_id: USER,
        nome: "Merenda",
        ora_inizio: "17:00",
        ordine: 5,
        valido_dal: null,
        valido_al: null,
      });
      id = pasto.id;
    });

    expect(await db.pasti.get(id)).toBeDefined();
    await attendi(async () => (await db.outbox.count()) === 0);
    expect(upsertMock).toHaveBeenCalledWith("pasti", expect.objectContaining({ id }));
  });

  it("se la transazione fallisce, né la riga né la sua voce in coda restano", async () => {
    await expect(
      db.transaction("rw", [db.pasti, db.outbox], async () => {
        await repositoryPasti.crea({
          user_id: USER,
          nome: "Merenda",
          ora_inizio: "17:00",
          ordine: 5,
          valido_dal: null,
          valido_al: null,
        });
        throw new Error("guasto a metà");
      })
    ).rejects.toThrow("guasto a metà");

    expect(await db.pasti.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    // La sync, partita fuori dalla transazione, non ha visto niente da mandare.
    await new Promise((r) => setTimeout(r, 50));
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
