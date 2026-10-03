import { describe, expect, it } from "vitest";
import { testoRigaPeso, testoUltimaPesata } from "./testiPeso";
import type { Misurazione } from "../db/tipi";

// I testi del peso in Impostazioni (elenco e pagina Peso). Sbagliano in
// silenzio sui numeri (punto invece della virgola, decimali spariti) e
// sulle date (fuso orario che sposta il giorno).

function pesata(valore: number, data: string): Misurazione {
  return {
    id: `peso-${data}`,
    user_id: "u",
    updated_at: `${data}T08:00:00.000Z`,
    deleted_at: null,
    tipo: "peso",
    valore,
    unita: "kg",
    data,
  };
}

describe("testoRigaPeso", () => {
  it("senza pesate: «Da registrare»", () => {
    expect(testoRigaPeso(null)).toBe("Da registrare");
  });

  it("intero senza decimali, decimale con la virgola", () => {
    expect(testoRigaPeso(pesata(85, "2026-10-02"))).toBe("85 kg");
    expect(testoRigaPeso(pesata(78.4, "2026-10-02"))).toBe("78,4 kg");
  });
});

describe("testoUltimaPesata", () => {
  const OGGI = "2026-10-03";

  it("senza pesate: «Nessuna pesata registrata»", () => {
    expect(testoUltimaPesata(null, OGGI)).toBe("Nessuna pesata registrata");
  });

  it("decimale solo se c'è, come nella riga; data senza anno se è l'anno in corso", () => {
    expect(testoUltimaPesata(pesata(85, "2026-10-02"), OGGI)).toBe("85 kg · 2 ottobre");
    expect(testoUltimaPesata(pesata(78.4, "2026-01-01"), OGGI)).toBe("78,4 kg · 1 gennaio");
  });

  it("l'anno compare se la pesata è di un altro anno", () => {
    expect(testoUltimaPesata(pesata(80, "2025-12-31"), OGGI)).toBe("80 kg · 31 dicembre 2025");
  });
});
