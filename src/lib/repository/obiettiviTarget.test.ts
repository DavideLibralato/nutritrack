// Test permanente per il fallback "manca il target del tipo scritto"
// (PUNTO_DI_PARTENZA.md, sezione 4, "obiettivi_target"): caso reale — la
// riga "allenamento" può mancare per un periodo (creato prima del Salva
// unico del Profilo, o differenziazione accesa senza mai toccare i target di
// allenamento), mentre un giorno è già scritto o proposto come
// "allenamento".

import { describe, it, expect } from "vitest";
import { targetPerTipo, targetEffettivo } from "./obiettiviTarget";
import { TIPO_GIORNO_NORMALE, TIPO_GIORNO_ALLENAMENTO } from "../db/tipi";
import type { ObiettivoTarget } from "../db/tipi";

function target(modifiche: Partial<ObiettivoTarget> = {}): ObiettivoTarget {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-09-01T10:00:00.000Z",
    deleted_at: null,
    obiettivo_id: "ob1",
    tipo_giorno: TIPO_GIORNO_NORMALE,
    kcal: 2200,
    proteine_g: 140,
    carboidrati_g: 230,
    grassi_g: 70,
    ...modifiche,
  };
}

describe("targetEffettivo", () => {
  it("usa la riga esatta quando esiste", () => {
    const righe = [
      target({ tipo_giorno: TIPO_GIORNO_NORMALE, kcal: 2200 }),
      target({ tipo_giorno: TIPO_GIORNO_ALLENAMENTO, kcal: 2600 }),
    ];
    expect(targetEffettivo(righe, "ob1", TIPO_GIORNO_ALLENAMENTO)?.kcal).toBe(2600);
  });

  it("ripiega su 'normale' se il tipo scritto non ha una riga per l'obiettivo corrente", () => {
    // Obiettivo nuovo: solo "normale" è stato ricreato, "allenamento" non è
    // stato ancora risalvato per questo periodo.
    const righe = [target({ obiettivo_id: "ob2", tipo_giorno: TIPO_GIORNO_NORMALE, kcal: 1800 })];
    expect(targetEffettivo(righe, "ob2", TIPO_GIORNO_ALLENAMENTO)?.kcal).toBe(1800);
  });

  it("non ripiega su un target 'normale' di un ALTRO obiettivo", () => {
    const righe = [
      target({ obiettivo_id: "ob1", tipo_giorno: TIPO_GIORNO_NORMALE, kcal: 2200 }),
    ];
    expect(targetEffettivo(righe, "ob2", TIPO_GIORNO_ALLENAMENTO)).toBeNull();
  });

  it("targetPerTipo (senza fallback) non trova nulla nello stesso scenario: la differenza è intenzionale", () => {
    const righe = [target({ obiettivo_id: "ob2", tipo_giorno: TIPO_GIORNO_NORMALE })];
    expect(targetPerTipo(righe, "ob2", TIPO_GIORNO_ALLENAMENTO)).toBeNull();
    expect(targetEffettivo(righe, "ob2", TIPO_GIORNO_ALLENAMENTO)).not.toBeNull();
  });
});
