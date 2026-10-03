// Test permanenti per la regola della pesata del giorno (PUNTO_DI_PARTENZA.md,
// sezione 3, "Peso"). Logica che sbaglia in silenzio: fino al 3/10 una
// pesata con lo stesso valore dell'ultima, in un giorno nuovo, non veniva
// scritta, mentre il messaggio diceva "Registrato", e lo storico del peso
// perdeva i giorni stabili.

import { beforeEach, describe, expect, it } from "vitest";
import { registraPesoSenzaDuplicati } from "./misurazioni";
import { db } from "../db/database";

const UTENTE = "utente-test-peso";

async function pesateDi(utente: string) {
  return db.misurazioni
    .filter((m) => m.user_id === utente && m.tipo === "peso" && m.deleted_at === null)
    .toArray();
}

describe("registraPesoSenzaDuplicati", () => {
  beforeEach(async () => {
    await Promise.all([db.misurazioni.clear(), db.outbox.clear()]);
  });

  it("giorno diverso con lo stesso valore dell'ultima pesata: scrive la riga", async () => {
    await registraPesoSenzaDuplicati(UTENTE, 85, "2026-10-02");
    await registraPesoSenzaDuplicati(UTENTE, 85, "2026-10-03");

    const righe = await pesateDi(UTENTE);
    expect(righe.map((r) => [r.data, r.valore]).sort()).toEqual([
      ["2026-10-02", 85],
      ["2026-10-03", 85],
    ]);
  });

  it("stesso giorno con un valore diverso: sostituisce la pesata del giorno", async () => {
    await registraPesoSenzaDuplicati(UTENTE, 85, "2026-10-03");
    await registraPesoSenzaDuplicati(UTENTE, 84.6, "2026-10-03");

    const righe = await pesateDi(UTENTE);
    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({ data: "2026-10-03", valore: 84.6 });
  });

  it("stesso giorno con lo stesso valore: nessun doppione e nessuna scrittura", async () => {
    await registraPesoSenzaDuplicati(UTENTE, 85, "2026-10-03");
    const prima = await pesateDi(UTENTE);
    await registraPesoSenzaDuplicati(UTENTE, 85, "2026-10-03");

    const righe = await pesateDi(UTENTE);
    expect(righe).toHaveLength(1);
    // Nessuna scrittura: updated_at uguale, niente di nuovo da sincronizzare.
    expect(righe[0].updated_at).toBe(prima[0].updated_at);
  });

  it("le pesate di un altro utente non contano", async () => {
    await registraPesoSenzaDuplicati("altro-utente", 85, "2026-10-03");
    await registraPesoSenzaDuplicati(UTENTE, 85, "2026-10-03");

    expect(await pesateDi(UTENTE)).toHaveLength(1);
    expect(await pesateDi("altro-utente")).toHaveLength(1);
  });
});
