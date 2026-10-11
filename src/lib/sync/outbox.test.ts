// Dall'11/10/2026 la salita manda solo le voci dell'utente della sessione
// (sincronizza.ts): una voce senza dati.user_id non partirebbe mai, e
// nessuno se ne accorgerebbe — la modifica resterebbe sul telefono senza
// errori a schermo. Oggi ogni scrittura porta lo user_id; questi test
// tengono fermo il controllo che fa diventare un errore futuro
// un'eccezione subito, prima di scrivere qualunque cosa.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import type { Alimento, Misurazione } from "../db/tipi";
import { accodaMutazione } from "./outbox";
import { creaRepository } from "../repository/repository";

// Nessuna rete: se una scrittura arrivasse fino alla sincronizzazione, il
// giro finirebbe qui senza mandare niente.
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
  }),
}));

const misurazioni = creaRepository<Misurazione>(db.misurazioni, "misurazioni");
const alimenti = creaRepository<Alimento>(db.alimenti, "alimenti");

function rigaMisurazione(user_id: string | null): Misurazione {
  return {
    id: crypto.randomUUID(),
    user_id,
    tipo: "peso",
    valore: 70,
    unita: "kg",
    data: "2026-10-11",
    updated_at: "2026-10-11T09:00:00.000Z",
    deleted_at: null,
  };
}

describe("una voce senza user_id non entra in outbox", () => {
  beforeEach(async () => {
    await db.outbox.clear();
    await db.misurazioni.clear();
    await db.alimenti.clear();
  });

  it("accodaMutazione rifiuta user_id null o vuoto, e non scrive niente", async () => {
    await expect(accodaMutazione("misurazioni", rigaMisurazione(null))).rejects.toThrow(/user_id/);
    await expect(accodaMutazione("misurazioni", rigaMisurazione(""))).rejects.toThrow(/user_id/);
    expect(await db.outbox.count()).toBe(0);
  });

  it("accodaMutazione con user_id valorizzato accoda la voce", async () => {
    await accodaMutazione("misurazioni", rigaMisurazione("u1"));
    const voci = await db.outbox.toArray();
    expect(voci).toHaveLength(1);
    expect(voci[0].dati.user_id).toBe("u1");
  });

  it("crea senza user_id fallisce prima di scrivere la riga in locale", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, updated_at, deleted_at, ...dati } = rigaMisurazione(null);
    await expect(misurazioni.crea(dati)).rejects.toThrow(/user_id/);
    expect(await db.misurazioni.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it("aggiorna ed elimina su una riga del catalogo condiviso (user_id null) falliscono senza toccarla", async () => {
    const condiviso: Alimento = {
      id: crypto.randomUUID(),
      user_id: null,
      nome: "Mela",
      marca: null,
      barcode: null,
      kcal_100g: 52,
      proteine_100g: 0.3,
      carboidrati_100g: 14,
      grassi_100g: 0.2,
      zuccheri_100g: null,
      fibre_100g: null,
      saturi_100g: null,
      sale_100g: null,
      porzione_default_g: 150,
      fonte: "manuale",
      verificato: true,
      updated_at: "2026-10-01T00:00:00.000Z",
      deleted_at: null,
    };
    await db.alimenti.put(condiviso);

    await expect(alimenti.aggiorna(condiviso.id, { nome: "Mela rossa" })).rejects.toThrow(/user_id/);
    await expect(alimenti.elimina(condiviso.id)).rejects.toThrow(/user_id/);

    expect(await db.alimenti.get(condiviso.id)).toEqual(condiviso);
    expect(await db.outbox.count()).toBe(0);
  });

  it("si può modificare una riga propria: la voce porta lo user_id della riga", async () => {
    const riga = await misurazioni.crea({ user_id: "u1", tipo: "peso", valore: 70, unita: "kg", data: "2026-10-11" });
    await misurazioni.elimina(riga.id);
    const voce = await db.outbox.get(`misurazioni:${riga.id}`);
    expect(voce?.dati.user_id).toBe("u1");
    expect(voce?.dati.deleted_at).not.toBeNull();
  });
});
