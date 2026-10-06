// Test permanenti per lo spostamento fra pasti (PUNTO_DI_PARTENZA.md,
// sezione 3, "Tieni premuto"): le regole dei doppioni sbagliano in modo
// silenzioso — un grammo in più o una riga di troppo nel diario non fanno
// rumore, si vedono mesi dopo nei totali.

import { describe, it, expect } from "vitest";
import {
  pianoSpostamento,
  stessiDoppioni,
  trovaDoppioni,
  type SceltaDoppione,
} from "./pianoSpostamento";
import type { VoceDiario } from "../db/tipi";

const COLAZIONE = "colazione";
const PRANZO = "pranzo";

let contatore = 0;
function voce(
  nome: string,
  pasto: string,
  grammi: number,
  extra: Partial<VoceDiario> = {}
): VoceDiario {
  contatore++;
  return {
    id: `v${contatore}`,
    user_id: "u",
    alimento_id: `alimento-${nome}`,
    pasto_id: pasto,
    gruppo_id: null,
    quantita_g: grammi,
    data: "2026-10-06",
    creato_il: `2026-10-06T08:00:${String(contatore).padStart(2, "0")}.000Z`,
    consumato_alle: null,
    nome_alimento: nome,
    kcal_100g: 100,
    proteine_100g: 1,
    carboidrati_100g: 1,
    grassi_100g: 1,
    updated_at: "2026-10-06T08:00:00.000Z",
    deleted_at: null,
    ...extra,
  };
}

function piano(
  partenza: VoceDiario[],
  destinazione: VoceDiario[],
  scelte: Record<string, SceltaDoppione> = {}
) {
  return pianoSpostamento({ partenza, destinazione, pastoDestinazioneId: PRANZO, scelte });
}

describe("trovaDoppioni", () => {
  it("somma le quantità per alimento, da tutte e due le parti", () => {
    const partenza = [voce("Yogurt", COLAZIONE, 125), voce("Yogurt", COLAZIONE, 50)];
    const destinazione = [voce("Yogurt", PRANZO, 100), voce("Yogurt", PRANZO, 30)];
    expect(trovaDoppioni(partenza, destinazione)).toEqual([
      {
        alimentoId: "alimento-Yogurt",
        nome: "Yogurt",
        grammiEsistenti: 130,
        grammiInArrivo: 175,
        righeEsistenti: 2,
        righeInArrivo: 2,
      },
    ]);
  });

  it("stessiDoppioni guarda quali alimenti, non le quantità", () => {
    const a = trovaDoppioni([voce("Mela", COLAZIONE, 100)], [voce("Mela", PRANZO, 50)]);
    const b = trovaDoppioni([voce("Mela", COLAZIONE, 999)], [voce("Mela", PRANZO, 1)]);
    const c = trovaDoppioni([voce("Pera", COLAZIONE, 100)], [voce("Pera", PRANZO, 50)]);
    expect(stessiDoppioni(a, b)).toBe(true);
    expect(stessiDoppioni(a, c)).toBe(false);
    expect(stessiDoppioni(a, [])).toBe(false);
  });
});

describe("pianoSpostamento — le regole", () => {
  it("1. nessun doppione: si riassegna solo il pasto", () => {
    const pane = voce("Pane", COLAZIONE, 50);
    const p = piano([pane], [voce("Pasta", PRANZO, 80)]);
    expect(p.scritture).toEqual([{ tipo: "aggiorna", id: pane.id, modifiche: { pasto_id: PRANZO } }]);
    expect(p.spostati).toEqual(["Pane"]);
    expect(p.esclusi).toEqual([]);
  });

  it("2. Somma: una riga sola, quella di destinazione, con i SUOI valori e il totale", () => {
    const arriva = voce("Yogurt", COLAZIONE, 125, { kcal_100g: 60 });
    const c_era = voce("Yogurt", PRANZO, 100, { kcal_100g: 75 });
    const p = piano([arriva], [c_era], { "alimento-Yogurt": { tipo: "somma" } });
    expect(p.scritture).toEqual([
      { tipo: "aggiorna", id: c_era.id, modifiche: { quantita_g: 225 } },
      { tipo: "elimina", id: arriva.id },
    ]);
    // Solo la quantità: kcal_100g (75) resta quello della destinazione.
    expect(p.scritture[0]).not.toHaveProperty("modifiche.kcal_100g");
    expect(p.spostati).toEqual(["Yogurt"]);
  });

  it("3. Tieni separati: si sposta accanto, la destinazione non si tocca", () => {
    const arriva = voce("Yogurt", COLAZIONE, 125);
    const c_era = voce("Yogurt", PRANZO, 100);
    const p = piano([arriva], [c_era], { "alimento-Yogurt": { tipo: "separati" } });
    expect(p.scritture).toEqual([{ tipo: "aggiorna", id: arriva.id, modifiche: { pasto_id: PRANZO } }]);
  });

  it("4. Scrivi quantità: il numero scritto, senza tener conto né della partenza né della destinazione", () => {
    const arriva = voce("Yogurt", COLAZIONE, 125);
    const c_era = voce("Yogurt", PRANZO, 100);
    const p = piano([arriva], [c_era], { "alimento-Yogurt": { tipo: "scrivi", grammi: 150 } });
    expect(p.scritture).toEqual([
      { tipo: "aggiorna", id: c_era.id, modifiche: { quantita_g: 150 } },
      { tipo: "elimina", id: arriva.id },
    ]);
  });

  it("5. Non spostarlo: quell'alimento resta, il resto del pasto si sposta", () => {
    const yogurt = voce("Yogurt", COLAZIONE, 125);
    const pane = voce("Pane", COLAZIONE, 50);
    const p = piano([yogurt, pane], [voce("Yogurt", PRANZO, 100)], {
      "alimento-Yogurt": { tipo: "escludi" },
    });
    expect(p.scritture).toEqual([{ tipo: "aggiorna", id: pane.id, modifiche: { pasto_id: PRANZO } }]);
    expect(p.spostati).toEqual(["Pane"]);
    expect(p.esclusi).toEqual(["Yogurt"]);
  });

  it("6. più righe dello stesso alimento: Somma le riduce tutte a una, col totale di tutte", () => {
    const a1 = voce("Yogurt", COLAZIONE, 125);
    const a2 = voce("Yogurt", COLAZIONE, 50);
    const d1 = voce("Yogurt", PRANZO, 100); // la più vecchia: resta lei
    const d2 = voce("Yogurt", PRANZO, 30);
    const p = piano([a1, a2], [d2, d1], { "alimento-Yogurt": { tipo: "somma" } });
    expect(p.scritture).toContainEqual({ tipo: "aggiorna", id: d1.id, modifiche: { quantita_g: 305 } });
    const eliminate = p.scritture.filter((s) => s.tipo === "elimina").map((s) => s.id);
    expect(eliminate.sort()).toEqual([a1.id, a2.id, d2.id].sort());
    // Un alimento solo, anche se le righe erano due.
    expect(p.spostati).toEqual(["Yogurt"]);
  });

  it("7. voce senza alimento_id: mai un doppione, si sposta e basta", () => {
    const senzaId = voce("Pane", COLAZIONE, 50, { alimento_id: null });
    const altraSenzaId = voce("Pane", PRANZO, 40, { alimento_id: null });
    expect(trovaDoppioni([senzaId], [altraSenzaId])).toEqual([]);
    const p = piano([senzaId], [altraSenzaId]);
    expect(p.scritture).toEqual([{ tipo: "aggiorna", id: senzaId.id, modifiche: { pasto_id: PRANZO } }]);
  });

  it("8. doppione per id, mai per nome: stesso nome con id diversi non è un doppione", () => {
    const arriva = voce("Yogurt", COLAZIONE, 125, { alimento_id: "yogurt-marca-a" });
    const c_era = voce("Yogurt", PRANZO, 100, { alimento_id: "yogurt-marca-b" });
    expect(trovaDoppioni([arriva], [c_era])).toEqual([]);
    expect(piano([arriva], [c_era]).scritture).toEqual([
      { tipo: "aggiorna", id: arriva.id, modifiche: { pasto_id: PRANZO } },
    ]);
  });
});

describe("pianoSpostamento — dettagli", () => {
  it("i grammi sommati restano a due decimali", () => {
    // 10,1 + 20,2 in virgola mobile fa 30,299999999999997.
    const p = piano([voce("Riso", COLAZIONE, 10.1)], [voce("Riso", PRANZO, 20.2)], {
      "alimento-Riso": { tipo: "somma" },
    });
    expect(p.scritture[0]).toMatchObject({ modifiche: { quantita_g: 30.3 } });
  });

  it("le righe già nel pasto di destinazione non si muovono", () => {
    expect(piano([voce("Pane", PRANZO, 50)], []).scritture).toEqual([]);
  });

  it("un doppione senza scelta è un errore di chi chiama, non una scelta inventata", () => {
    expect(() => piano([voce("Mela", COLAZIONE, 100)], [voce("Mela", PRANZO, 50)])).toThrow();
  });
});
