// Il segno "uscita in corso" (PUNTO_DI_PARTENZA.md §9.6, "Esci svuota i
// dati locali") decide se all'avvio si cancellano i dati di un utente dal
// dispositivo. Un errore qui non fa rumore: o cancella i dati di chi è
// appena rientrato, o lascia sul telefono condiviso i dati di chi è
// uscito. Casi fissati per sempre:
// - nessuna sessione o un altro utente → si pulisce l'utente del segno, e
//   solo lui;
// - rientrato lo stesso utente → non si tocca niente, si toglie il segno;
// - una modifica in coda che l'utente non aveva accettato di perdere →
//   non si tocca niente;
// - non si sa chi c'è, o la pulizia fallisce → niente toccato, il segno
//   resta per il prossimo avvio;
// - un segno illeggibile non cancella niente.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db/database";
import type { Pasto } from "../db/tipi";
import type { VoceOutbox } from "../sync/outbox";
import {
  CHIAVE_USCITA,
  leggiSegnoUscita,
  riprendiUscitaInSospeso,
  scriviSegnoUscita,
} from "./uscitaInCorso";

function pasto(userId: string, nome: string): Pasto {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: "2026-10-10T08:00:00.000Z",
    deleted_at: null,
    nome,
    ora_inizio: "12:30",
    ordine: 0,
  };
}

function voceInCoda(riga: Pasto, creato_il: string): VoceOutbox {
  return {
    id: `pasti:${riga.id}`,
    tabella: "pasti",
    record_id: riga.id,
    dati: riga,
    creato_il,
    tentativi: 0,
    ultimo_errore: null,
    sospesa_il: null,
  };
}

const firma = (v: VoceOutbox) => `${v.id}|${v.creato_il}`;

// Un utente con un pasto, il suo cursore e una modifica in coda; accanto
// un altro utente che non va mai toccato.
async function dispositivo() {
  const utente = `utente-${crypto.randomUUID()}`;
  const altro = `utente-${crypto.randomUUID()}`;
  const suo = pasto(utente, "Pranzo");
  const dellAltro = pasto(altro, "Cena dell'altro");
  const voceSua = voceInCoda(suo, "2026-10-11T09:00:00.000Z");
  await db.pasti.bulkPut([suo, dellAltro]);
  await db.outbox.bulkPut([voceSua, voceInCoda(dellAltro, "2026-10-11T09:00:00.000Z")]);
  await db.sync_cursori.bulkPut([
    { id: `pasti:${utente}`, tabella: "pasti", user_id: utente, ultimo_aggiornamento: suo.updated_at },
    { id: `pasti:${altro}`, tabella: "pasti", user_id: altro, ultimo_aggiornamento: dellAltro.updated_at },
  ]);
  return { utente, altro, voceSua };
}

async function contaDi(userId: string) {
  return {
    pasti: await db.pasti.where("user_id").equals(userId).count(),
    coda: (await db.outbox.toArray()).filter((v) => v.dati.user_id === userId).length,
    cursori: await db.sync_cursori.where("user_id").equals(userId).count(),
  };
}

const INTATTO = { pasti: 1, coda: 1, cursori: 1 };
const VUOTO = { pasti: 0, coda: 0, cursori: 0 };

beforeEach(async () => {
  localStorage.clear();
  await db.outbox.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("riprendiUscitaInSospeso", () => {
  it("senza segno non fa niente e non chiede chi c'è", async () => {
    const { utente } = await dispositivo();
    const attuale = vi.fn();

    expect(await riprendiUscitaInSospeso(attuale)).toBe("niente");
    expect(attuale).not.toHaveBeenCalled();
    expect(await contaDi(utente)).toEqual(INTATTO);
  });

  it("nessuna sessione: pulisce righe, coda confermata e cursori dell'utente del segno, solo i suoi", async () => {
    const { utente, altro, voceSua } = await dispositivo();
    scriviSegnoUscita(utente, [firma(voceSua)]);

    expect(await riprendiUscitaInSospeso(async () => null)).toBe("pulito");
    expect(await contaDi(utente)).toEqual(VUOTO);
    expect(await contaDi(altro)).toEqual(INTATTO);
    expect(leggiSegnoUscita()).toBeNull();
  });

  it("è entrato un altro utente: pulisce comunque l'utente del segno", async () => {
    const { utente, altro, voceSua } = await dispositivo();
    scriviSegnoUscita(utente, [firma(voceSua)]);

    expect(await riprendiUscitaInSospeso(async () => altro)).toBe("pulito");
    expect(await contaDi(utente)).toEqual(VUOTO);
    expect(await contaDi(altro)).toEqual(INTATTO);
  });

  it("è rientrato lo stesso utente: non tocca niente e toglie il segno", async () => {
    const { utente, voceSua } = await dispositivo();
    scriviSegnoUscita(utente, [firma(voceSua)]);

    expect(await riprendiUscitaInSospeso(async () => utente)).toBe("rientrato");
    expect(await contaDi(utente)).toEqual(INTATTO);
    expect(leggiSegnoUscita()).toBeNull();
  });

  it("una modifica in coda non confermata: non tocca niente e toglie il segno", async () => {
    // Il segno dice "coda vuota", ma in coda c'è una modifica dell'utente:
    // perderla sarebbe perderla in silenzio.
    const { utente } = await dispositivo();
    scriviSegnoUscita(utente, []);

    expect(await riprendiUscitaInSospeso(async () => null)).toBe("modifiche-cambiate");
    expect(await contaDi(utente)).toEqual(INTATTO);
    expect(leggiSegnoUscita()).toBeNull();
  });

  it("non si sa chi c'è: non tocca niente e il segno resta", async () => {
    const { utente, voceSua } = await dispositivo();
    scriviSegnoUscita(utente, [firma(voceSua)]);

    expect(
      await riprendiUscitaInSospeso(async () => {
        throw new Error("sessione illeggibile");
      })
    ).toBe("in-attesa");
    expect(await contaDi(utente)).toEqual(INTATTO);
    expect(leggiSegnoUscita()).toEqual({ idUtente: utente, firme: [firma(voceSua)] });
  });

  it("la pulizia fallisce: niente toccato, il segno resta, e il prossimo avvio pulisce", async () => {
    const { utente, voceSua } = await dispositivo();
    scriviSegnoUscita(utente, [firma(voceSua)]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db, "transaction").mockRejectedValueOnce(new Error("IndexedDB non disponibile"));

    expect(await riprendiUscitaInSospeso(async () => null)).toBe("in-attesa");
    expect(await contaDi(utente)).toEqual(INTATTO);
    expect(leggiSegnoUscita()).not.toBeNull();

    expect(await riprendiUscitaInSospeso(async () => null)).toBe("pulito");
    expect(await contaDi(utente)).toEqual(VUOTO);
  });

  it("un segno illeggibile non cancella niente", async () => {
    const { utente } = await dispositivo();
    for (const valore of ["non json", '{"idUtente":""}', `{"idUtente":"${utente}"}`, `{"idUtente":"${utente}","firme":[1]}`]) {
      localStorage.setItem(CHIAVE_USCITA, valore);
      expect(await riprendiUscitaInSospeso(async () => null)).toBe("niente");
    }
    expect(await contaDi(utente)).toEqual(INTATTO);
  });
});
