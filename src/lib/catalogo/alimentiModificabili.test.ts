// Il numero nella riga "Alimenti" di Impostazioni deve coincidere con le
// righe della pagina: tutti e due passano da alimentiModificabili. Un errore
// qui non fa rumore (il numero sembra giusto), si vede solo aprendo la
// pagina. I casi esclusi: alimenti del catalogo comune (user_id null), di
// un altro utente, verificati.

import { describe, it, expect } from "vitest";
import { alimentiModificabili, eModificabile, testoRigaAlimenti } from "./alimentiModificabili";
import type { Alimento } from "../db/tipi";

function alimento(id: string, altro: Partial<Alimento> = {}): Alimento {
  return {
    id,
    user_id: "u1",
    updated_at: "2026-10-15T00:00:00.000Z",
    deleted_at: null,
    nome: id,
    marca: null,
    barcode: null,
    kcal_100g: 100,
    proteine_100g: 5,
    carboidrati_100g: 10,
    grassi_100g: 2,
    zuccheri_100g: null,
    fibre_100g: null,
    saturi_100g: null,
    sale_100g: null,
    porzione_default_g: 100,
    fonte: "manuale",
    verificato: false,
    ...altro,
  };
}

describe("alimentiModificabili", () => {
  it("solo i propri e non verificati", () => {
    const catalogo = [
      alimento("mio"),
      alimento("comune", { user_id: null, verificato: true }),
      alimento("altrui", { user_id: "u2" }),
      alimento("verificato", { verificato: true }),
    ];
    expect(alimentiModificabili(catalogo, "u1").map((a) => a.id)).toEqual(["mio"]);
    expect(eModificabile(alimento("comune", { user_id: null }), "u1")).toBe(false);
  });
});

describe("testoRigaAlimenti", () => {
  it("Nessuno, singolare, plurale", () => {
    expect(testoRigaAlimenti(0)).toBe("Nessuno");
    expect(testoRigaAlimenti(1)).toBe("1 alimento");
    expect(testoRigaAlimenti(46)).toBe("46 alimenti");
  });
});
