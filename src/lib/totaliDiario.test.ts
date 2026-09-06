import { describe, it, expect } from "vitest";
import {
  sommaTotali,
  totaleVoce,
  vociDelGiorno,
  obiettivoValidoPer,
  TOTALI_ZERO,
} from "./totaliDiario";
import type { VoceDiario, Obiettivo } from "./db/tipi";

// Costruttore di comodo: parte da una voce plausibile e sovrascrive solo i
// campi che contano per il caso di test.
function voce(modifiche: Partial<VoceDiario> = {}): VoceDiario {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-09-04T10:00:00.000Z",
    deleted_at: null,
    alimento_id: "a1",
    pasto_id: "p1",
    gruppo_id: null,
    quantita_g: 100,
    data: "2026-09-04",
    creato_il: "2026-09-04T10:00:00.000Z",
    consumato_alle: null,
    nome_alimento: "Alimento",
    kcal_100g: 100,
    proteine_100g: 10,
    carboidrati_100g: 20,
    grassi_100g: 5,
    ...modifiche,
  };
}

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

describe("totaleVoce", () => {
  it("scala i valori per 100 g in base alla quantità", () => {
    const t = totaleVoce(
      voce({ quantita_g: 150, kcal_100g: 200, proteine_100g: 30, carboidrati_100g: 10, grassi_100g: 4 })
    );
    expect(t).toEqual({ kcal: 300, proteine: 45, carboidrati: 15, grassi: 6 });
  });

  it("una quantità di 0 g non aggiunge nulla", () => {
    expect(totaleVoce(voce({ quantita_g: 0 }))).toEqual(TOTALI_ZERO);
  });
});

describe("sommaTotali", () => {
  it("somma i contributi di più voci", () => {
    const t = sommaTotali([
      voce({ quantita_g: 100, kcal_100g: 100, proteine_100g: 10, carboidrati_100g: 20, grassi_100g: 5 }),
      voce({ quantita_g: 200, kcal_100g: 50, proteine_100g: 4, carboidrati_100g: 6, grassi_100g: 2 }),
    ]);
    // 100 + (50 * 2) = 200 kcal; 10 + (4 * 2) = 18 proteine; ecc.
    expect(t).toEqual({ kcal: 200, proteine: 18, carboidrati: 32, grassi: 9 });
  });

  it("un giorno senza voci dà tutti zero, non NaN", () => {
    expect(sommaTotali([])).toEqual(TOTALI_ZERO);
  });

  it("non muta l'oggetto TOTALI_ZERO esportato", () => {
    sommaTotali([voce({ kcal_100g: 999 })]);
    expect(TOTALI_ZERO).toEqual({ kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 });
  });
});

describe("vociDelGiorno", () => {
  it("tiene solo le voci del giorno richiesto", () => {
    const righe = [
      voce({ data: "2026-09-03" }),
      voce({ data: "2026-09-04" }),
      voce({ data: "2026-09-04" }),
      voce({ data: "2026-09-05" }),
    ];
    expect(vociDelGiorno(righe, "2026-09-04")).toHaveLength(2);
  });

  it("esclude le voci cancellate logicamente", () => {
    const righe = [
      voce({ data: "2026-09-04" }),
      voce({ data: "2026-09-04", deleted_at: "2026-09-04T12:00:00.000Z" }),
    ];
    expect(vociDelGiorno(righe, "2026-09-04")).toHaveLength(1);
  });
});

describe("obiettivoValidoPer", () => {
  it("sceglie l'obiettivo con valido_dal più recente non successivo alla data", () => {
    const vecchio = obiettivo({ valido_dal: "2026-01-01", kcal: 2000 });
    const nuovo = obiettivo({ valido_dal: "2026-06-01", kcal: 1800 });

    expect(obiettivoValidoPer([vecchio, nuovo], "2026-03-15")?.kcal).toBe(2000);
    expect(obiettivoValidoPer([vecchio, nuovo], "2026-09-04")?.kcal).toBe(1800);
  });

  it("un giorno precedente al primo obiettivo non ha target (null)", () => {
    const primo = obiettivo({ valido_dal: "2026-06-01" });
    expect(obiettivoValidoPer([primo], "2026-05-31")).toBeNull();
  });

  it("a parità di valido_dal vince updated_at (due cambi nello stesso giorno)", () => {
    const mattina = obiettivo({
      valido_dal: "2026-09-04",
      updated_at: "2026-09-04T08:00:00.000Z",
      kcal: 2100,
    });
    const sera = obiettivo({
      valido_dal: "2026-09-04",
      updated_at: "2026-09-04T20:00:00.000Z",
      kcal: 1900,
    });
    expect(obiettivoValidoPer([mattina, sera], "2026-09-04")?.kcal).toBe(1900);
  });

  it("ignora gli obiettivi cancellati logicamente", () => {
    const attivo = obiettivo({ valido_dal: "2026-01-01", kcal: 2000 });
    const cancellato = obiettivo({
      valido_dal: "2026-06-01",
      kcal: 1500,
      deleted_at: "2026-06-02T10:00:00.000Z",
    });
    expect(obiettivoValidoPer([attivo, cancellato], "2026-09-04")?.kcal).toBe(2000);
  });
});
