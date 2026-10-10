// La coda vista da un utente (codaDellUtente.ts, dal 10/10/2026). Il
// rischio sottile: su un dispositivo condiviso la coda contiene anche le
// modifiche di un altro utente (i dati locali non si cancellano
// all'uscita, sezione 9.6). "Riprova a salvarle" deve toccare solo quelle
// di chi la preme, e il conteggio non deve mescolarle.

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db/database";
import { riassuntoCoda, riprovaAccantonate, vociAccantonate, vociInCodaDellUtente } from "./codaDellUtente";
import type { VoceOutbox } from "./outbox";

const IO = "utente-io";
const ALTRO = "utente-altro";

function voce(
  id: string,
  userId: string,
  // `dati`: solo i campi in più (nome, pasto_id...), la base la mette qui.
  altro: Omit<Partial<VoceOutbox>, "dati"> & { dati?: Record<string, unknown> } = {}
): VoceOutbox {
  const [tabella, recordId] = id.split(":") as [VoceOutbox["tabella"], string];
  const { dati, ...campi } = altro;
  return {
    id,
    tabella,
    record_id: recordId,
    creato_il: "2026-10-10T09:00:00.000Z",
    tentativi: 0,
    ultimo_errore: null,
    sospesa_il: null,
    ...campi,
    dati: { id: recordId, user_id: userId, updated_at: "2026-10-10T09:00:00.000Z", deleted_at: null, ...dati },
  };
}

const SOSPESA = { tentativi: 5, ultimo_errore: "violazione", ultimo_status: 409, sospesa_il: "2026-10-10T10:00:00.000Z" };

beforeEach(async () => {
  await Promise.all([db.outbox.clear(), db.pasti.clear()]);
});

describe("riprovaAccantonate", () => {
  it("rimette in coda solo le accantonate di quell'utente, come nuove", async () => {
    await db.outbox.bulkPut([
      voce("pasti:mia", IO, SOSPESA),
      voce("pasti:sua", ALTRO, SOSPESA),
      voce("misurazioni:in-attesa", IO, { tentativi: 2 }),
    ]);

    expect(await riprovaAccantonate(IO)).toBe(1);

    expect(await db.outbox.get("pasti:mia")).toMatchObject({ sospesa_il: null, tentativi: 0 });
    // Quella dell'altro utente resta com'era.
    expect(await db.outbox.get("pasti:sua")).toMatchObject({ sospesa_il: SOSPESA.sospesa_il, tentativi: 5 });
    // Una voce solo in attesa non si tocca: i suoi tentativi contano ancora.
    expect(await db.outbox.get("misurazioni:in-attesa")).toMatchObject({ tentativi: 2 });
  });
});

describe("riassuntoCoda", () => {
  it("conta in attesa e accantonate dell'utente, e da quando dice la voce in attesa più vecchia", async () => {
    await db.outbox.bulkPut([
      voce("pasti:a", IO, { creato_il: "2026-10-10T14:05:00.000Z" }),
      voce("pasti:b", IO, { creato_il: "2026-10-10T14:02:00.000Z" }),
      voce("pasti:c", IO, { ...SOSPESA, creato_il: "2026-10-09T08:00:00.000Z" }),
      voce("pasti:d", ALTRO, { creato_il: "2026-10-01T08:00:00.000Z" }),
    ]);

    expect(riassuntoCoda(await vociInCodaDellUtente(IO))).toEqual({
      inAttesa: 2,
      inAttesaDal: "2026-10-10T14:02:00.000Z",
      accantonate: 1,
    });
  });
});

describe("vociAccantonate", () => {
  it("in parole dell'utente: tipo, nome o alimento e pasto, in ordine di modifica", async () => {
    await db.pasti.put({
      id: "pasto-pranzo", user_id: IO, updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null,
      nome: "Pranzo", ora_inizio: "12:30", ordine: 2,
    });
    const voci = [
      voce("voci_diario:v1", IO, {
        ...SOSPESA,
        creato_il: "2026-10-08T11:10:00.000Z",
        dati: { pasto_id: "pasto-pranzo", nome_alimento: "Yogurt magro" },
      }),
      voce("pasti:p1", IO, { ...SOSPESA, creato_il: "2026-10-07T15:00:00.000Z", dati: { nome: "Merenda" } }),
      voce("misurazioni:m1", IO, { ...SOSPESA, creato_il: "2026-10-09T07:00:00.000Z", ultimo_status: undefined }),
      voce("pasti:in-attesa", IO, { dati: { nome: "Cena" } }),
    ];

    const elenco = await vociAccantonate(voci);

    expect(elenco.map((v) => [v.tipo, v.dettaglio])).toEqual([
      ["Pasto", "«Merenda»"],
      ["Voce del diario", "Yogurt magro, Pranzo"],
      ["Misurazione", null],
    ]);
    expect(elenco[1]).toMatchObject({ tabella: "voci_diario", tentativi: 5, status: 409, errore: "violazione" });
    // Una voce di prima della version(8), senza status: "non noto".
    expect(elenco[2].status).toBeNull();
  });
});
