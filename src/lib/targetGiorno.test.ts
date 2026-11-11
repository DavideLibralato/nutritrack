// Il target di una giornata (PUNTO_DI_PARTENZA.md, sezione 10.5, funzione
// n. 3), come lo combinano Statistiche e Oggi: deve dare gli stessi numeri
// che Oggi calcolava a mano, compreso il ripiego su "normale".

import { describe, it, expect } from "vitest";
import { targetDelGiorno } from "./targetGiorno";
import type { DatiObiettivi } from "./targetGiorno";
import type { Giorno, Obiettivo, ObiettivoTarget, Profilo } from "./db/tipi";

function obiettivo(modifiche: Partial<Obiettivo> = {}): Obiettivo {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-09-01T10:00:00.000Z",
    deleted_at: null,
    valido_dal: "2026-09-01",
    tipo: "mantenere",
    kcal: 2200,
    proteine_g: 140,
    carboidrati_g: 230,
    grassi_g: 70,
    peso_obiettivo: null,
    ...modifiche,
  };
}

function target(obiettivoId: string, tipoGiorno: string, kcal: number): ObiettivoTarget {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-09-01T10:00:00.000Z",
    deleted_at: null,
    obiettivo_id: obiettivoId,
    tipo_giorno: tipoGiorno,
    kcal,
    proteine_g: 140,
    carboidrati_g: 230,
    grassi_g: 70,
  };
}

function giorno(data: string, tipo: string): Giorno {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-09-01T10:00:00.000Z",
    deleted_at: null,
    data,
    tipo_giorno: tipo,
  };
}

function profilo(modifiche: Partial<Profilo> = {}): Profilo {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-09-01T10:00:00.000Z",
    deleted_at: null,
    nome: null,
    sesso: "non_indicato",
    data_nascita: null,
    altezza_cm: null,
    livello_attivita: "moderato",
    differenzia_giorni: false,
    giorni_allenamento_default: null,
    ...modifiche,
  };
}

const MANTENERE = obiettivo({ id: "o1" });
const DATI: DatiObiettivi = {
  obiettivi: [MANTENERE],
  obiettiviTarget: [target("o1", "normale", 2200), target("o1", "allenamento", 2600)],
  giorni: [],
  profilo: profilo(),
};

describe("targetDelGiorno", () => {
  it("senza nessun obiettivo: nessun target", () => {
    expect(targetDelGiorno({ ...DATI, obiettivi: [], obiettiviTarget: [] }, "2026-11-04")).toEqual({
      target: null,
      tipoObiettivo: null,
      tipoGiorno: "normale",
      tipoGiornoMostrato: "normale",
    });
  });

  it("un giorno normale: il target normale e il tipo di obiettivo del periodo", () => {
    const r = targetDelGiorno(DATI, "2026-11-04");
    expect(r.target?.kcal).toBe(2200);
    expect(r.tipoObiettivo).toBe("mantenere");
    expect(r.tipoGiornoMostrato).toBe("normale");
  });

  it("un giorno scritto «allenamento» vince anche con i differenziati spenti, come in Oggi", () => {
    const dati = { ...DATI, giorni: [giorno("2026-11-04", "allenamento")] };
    const r = targetDelGiorno(dati, "2026-11-04");
    expect(r.target?.kcal).toBe(2600);
    expect(r.tipoGiorno).toBe("allenamento");
    expect(r.tipoGiornoMostrato).toBe("allenamento");
  });

  it("manca il target del tipo scritto: numeri e tipo mostrato di «normale», classificazione intatta", () => {
    const dati = {
      ...DATI,
      obiettiviTarget: [target("o1", "normale", 2200)],
      giorni: [giorno("2026-11-04", "allenamento")],
    };
    const r = targetDelGiorno(dati, "2026-11-04");
    expect(r.target?.kcal).toBe(2200);
    expect(r.tipoGiorno).toBe("allenamento");
    expect(r.tipoGiornoMostrato).toBe("normale");
  });

  it("un giorno mai scritto prende la settimana tipo, se i differenziati sono accesi", () => {
    const dati = {
      ...DATI,
      profilo: profilo({ differenzia_giorni: true, giorni_allenamento_default: ["mercoledi"] }),
    };
    expect(targetDelGiorno(dati, "2026-11-04").target?.kcal).toBe(2600); // mercoledì
    expect(targetDelGiorno(dati, "2026-11-05").target?.kcal).toBe(2200); // giovedì
  });

  it("un cambio di periodo: ogni giorno il suo, prima di tutti il più vecchio", () => {
    const dimagrire = obiettivo({ id: "o2", valido_dal: "2026-11-05", tipo: "dimagrire" });
    const dati = {
      ...DATI,
      obiettivi: [MANTENERE, dimagrire],
      obiettiviTarget: [...DATI.obiettiviTarget, target("o2", "normale", 1800)],
    };
    expect(targetDelGiorno(dati, "2026-11-04")).toMatchObject({ tipoObiettivo: "mantenere" });
    expect(targetDelGiorno(dati, "2026-11-04").target?.kcal).toBe(2200);
    expect(targetDelGiorno(dati, "2026-11-05")).toMatchObject({ tipoObiettivo: "dimagrire" });
    expect(targetDelGiorno(dati, "2026-11-05").target?.kcal).toBe(1800);
    expect(targetDelGiorno(dati, "2026-08-01").target?.kcal).toBe(2200);
  });
});
