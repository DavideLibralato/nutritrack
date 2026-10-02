// Test permanenti per "Annulla" dopo un inserimento (PUNTO_DI_PARTENZA.md,
// punti 10.2 e 10.6). Quello che non deve rompersi in silenzio: si
// cancellano esattamente le voci di quell'inserimento (tutte, per un pasto
// salvato), e la cancellazione è logica e passa dall'outbox — altrimenti la
// voce ricomparirebbe al primo sync.

import { describe, it, expect, vi } from "vitest";
import { annullaInserimento } from "./vociDiario";
import { repositoryVociDiario } from "./index";
import { db } from "../db/database";
import type { VoceDiario } from "../db/tipi";

// Rete assente, come negli altri test dei repository: si esercita solo la
// parte locale (tabella + outbox), il sync ha i suoi test in src/lib/sync.
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
  }),
}));

function creaVoce(userId: string, nome: string, gruppoId: string | null = null) {
  return repositoryVociDiario.crea({
    user_id: userId,
    alimento_id: null,
    pasto_id: "pasto-1",
    gruppo_id: gruppoId,
    quantita_g: 100,
    data: "2026-10-02",
    creato_il: "2026-10-02T08:00:00.000Z",
    consumato_alle: null,
    nome_alimento: nome,
    kcal_100g: 100,
    proteine_100g: 1,
    carboidrati_100g: 1,
    grassi_100g: 1,
  } as Omit<VoceDiario, "id" | "updated_at" | "deleted_at">);
}

describe("annullaInserimento", () => {
  it("annulla una voce singola: deleted_at scritto, la voce sparisce dal diario", async () => {
    const userId = crypto.randomUUID();
    const voce = await creaVoce(userId, "Pane");

    const cancellate = await annullaInserimento([voce.id]);

    expect(cancellate).toBe(1);
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
      creaVoce(userId, "Yogurt", gruppoId),
      creaVoce(userId, "Avena", gruppoId),
      creaVoce(userId, "Mirtilli", gruppoId),
    ]);
    const altra = await creaVoce(userId, "Caffè");

    const cancellate = await annullaInserimento(pasto.map((v) => v.id));

    expect(cancellate).toBe(3);
    const rimaste = await repositoryVociDiario.ottieniTutti(userId);
    expect(rimaste.map((v) => v.id)).toEqual([altra.id]);
  });

  it("la cancellazione logica è nell'outbox, una sola voce per riga", async () => {
    const userId = crypto.randomUUID();
    const gruppoId = crypto.randomUUID();
    const voci = await Promise.all([
      creaVoce(userId, "Pasta", gruppoId),
      creaVoce(userId, "Sugo", gruppoId),
    ]);

    await annullaInserimento(voci.map((v) => v.id));

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

    await annullaInserimento([voce.id]);
    const dopoIlPrimo = await db.voci_diario.get(voce.id);
    const cancellateAlSecondo = await annullaInserimento([voce.id]);

    expect(cancellateAlSecondo).toBe(0);
    const dopoIlSecondo = await db.voci_diario.get(voce.id);
    expect(dopoIlSecondo?.deleted_at).toBe(dopoIlPrimo?.deleted_at);
    expect(dopoIlSecondo?.updated_at).toBe(dopoIlPrimo?.updated_at);
  });
});
