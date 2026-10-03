import { describe, expect, it } from "vitest";
import { testoRigaObiettivi } from "./rigaObiettivi";
import type { Obiettivo, ObiettivoTarget } from "../db/tipi";

// Il testo della riga "Obiettivi" in Impostazioni (decisione A, sezione 3).
// Sbaglia in silenzio se legge il periodo o la riga sbagliati: l'elenco
// mostrerebbe un numero diverso da quello che usa Oggi.

function periodo(modifiche: Partial<Obiettivo> = {}): Obiettivo {
  return {
    id: "periodo-1",
    user_id: "u",
    updated_at: "2026-09-21T10:00:00.000Z",
    deleted_at: null,
    valido_dal: "2026-09-21",
    tipo: "mantenere",
    kcal: 2400,
    proteine_g: 150,
    carboidrati_g: 300,
    grassi_g: 60,
    peso_obiettivo: null,
    ...modifiche,
  };
}

function target(tipo: string, kcal: number, obiettivoId = "periodo-1"): ObiettivoTarget {
  return {
    id: `${obiettivoId}-${tipo}`,
    user_id: "u",
    updated_at: "2026-09-21T10:00:00.000Z",
    deleted_at: null,
    obiettivo_id: obiettivoId,
    tipo_giorno: tipo,
    kcal,
    proteine_g: 150,
    carboidrati_g: 300,
    grassi_g: 60,
  };
}

describe("testoRigaObiettivi", () => {
  it("nessun periodo: «Da impostare»", () => {
    expect(testoRigaObiettivi(null, [], false)).toBe("Da impostare");
    expect(testoRigaObiettivi(null, [], true)).toBe("Da impostare");
  });

  it("giorni differenziati spenti: solo il normale, anche se esiste il target di allenamento", () => {
    const righe = [target("normale", 2500), target("allenamento", 2950)];
    expect(testoRigaObiettivi(periodo(), righe, false)).toBe("2500 kcal");
  });

  it("accesi: normale · allenamento", () => {
    const righe = [target("normale", 2500), target("allenamento", 2950)];
    expect(testoRigaObiettivi(periodo(), righe, true)).toBe("2500 · 2950 kcal");
  });

  it("accesi senza target di allenamento: ripiega sul normale, come Oggi", () => {
    expect(testoRigaObiettivi(periodo(), [target("normale", 2500)], true)).toBe("2500 · 2500 kcal");
  });

  it("senza la riga «normale» usa le colonne del periodo", () => {
    expect(testoRigaObiettivi(periodo({ kcal: 2400 }), [], false)).toBe("2400 kcal");
    expect(testoRigaObiettivi(periodo({ kcal: 2400 }), [target("allenamento", 2900)], true)).toBe(
      "2400 · 2900 kcal"
    );
  });

  it("legge solo le righe del periodo passato, non quelle di altri periodi", () => {
    const righe = [
      target("normale", 2100, "periodo-vecchio"),
      target("allenamento", 2600, "periodo-vecchio"),
      target("normale", 2500),
    ];
    expect(testoRigaObiettivi(periodo(), righe, true)).toBe("2500 · 2500 kcal");
  });
});
