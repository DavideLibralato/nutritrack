// Test permanenti per Duplica (PUNTO_DI_PARTENZA.md, sezione 3, "Tieni
// premuto", passo E). Le due regole che non devono mai cadere in silenzio:
// l'originale non si tocca, e le righe che si duplicano non sono doppioni
// di se stesse.

import { describe, it, expect } from "vitest";
import { doppioniDuplica, pianoDuplica } from "./pianoDuplica";
import type { SceltaDoppione } from "./pianoSpostamento";
import type { VoceDiario } from "../db/tipi";

const OGGI = "2026-10-06";
const IERI = "2026-10-05";
const ADESSO = "2026-10-06T13:00:00.000Z";

let contatore = 0;
function voce(nome: string, pasto: string, grammi: number, extra: Partial<VoceDiario> = {}): VoceDiario {
  contatore++;
  return {
    id: `v${contatore}`,
    user_id: "u",
    alimento_id: `alimento-${nome}`,
    pasto_id: pasto,
    gruppo_id: "gruppo-vecchio",
    quantita_g: grammi,
    data: OGGI,
    creato_il: `2026-10-06T08:00:${String(contatore).padStart(2, "0")}.000Z`,
    consumato_alle: "2026-10-06T08:05:00.000Z",
    nome_alimento: nome,
    kcal_100g: 52,
    proteine_100g: 0.3,
    carboidrati_100g: 14,
    grassi_100g: 0.2,
    updated_at: "2026-10-06T08:00:00.000Z",
    deleted_at: null,
    ...extra,
  };
}

function piano(
  originali: VoceDiario[],
  destinazione: VoceDiario[],
  {
    data = OGGI,
    pasto = "pranzo",
    scelte = {},
    gruppoId = null,
  }: { data?: string; pasto?: string; scelte?: Record<string, SceltaDoppione>; gruppoId?: string | null } = {}
) {
  return pianoDuplica({
    originali,
    destinazione,
    dataDestinazione: data,
    pastoDestinazioneId: pasto,
    scelte,
    adesso: ADESSO,
    oggi: OGGI,
    gruppoId,
  });
}

describe("pianoDuplica — l'originale non si tocca mai", () => {
  const scelte: SceltaDoppione[] = [
    { tipo: "somma" },
    { tipo: "separati" },
    { tipo: "scrivi", grammi: 120 },
    { tipo: "escludi" },
  ];
  for (const scelta of scelte) {
    it(`con «${scelta.tipo}» nessuna scrittura punta all'originale`, () => {
      const mela = voce("Mela", "colazione", 150);
      const altraMela = voce("Mela", "pranzo", 100);
      const p = piano([mela], [altraMela], { scelte: { "alimento-Mela": scelta } });
      for (const s of p.scritture) {
        if (s.tipo !== "crea") expect(s.id).not.toBe(mela.id);
      }
    });
  }
});

describe("pianoDuplica — le righe che si duplicano non sono doppioni di se stesse", () => {
  it("la Mela nel suo stesso pasto e giorno: nessun doppione, una seconda riga", () => {
    const mela = voce("Mela", "pranzo", 150);
    // La destinazione (letta da Dexie) contiene anche la Mela stessa.
    expect(doppioniDuplica([mela], [mela])).toEqual([]);
    const p = piano([mela], [mela]);
    expect(p.scritture).toHaveLength(1);
    expect(p.scritture[0]).toMatchObject({ tipo: "crea", dati: { nome_alimento: "Mela", quantita_g: 150 } });
  });

  it("un'ALTRA riga dello stesso alimento nel pasto di destinazione sì che è un doppione", () => {
    const mela = voce("Mela", "pranzo", 150);
    const altraMela = voce("Mela", "pranzo", 80);
    expect(doppioniDuplica([mela], [mela, altraMela])).toEqual([
      expect.objectContaining({ alimentoId: "alimento-Mela", grammiEsistenti: 80, grammiInArrivo: 150 }),
    ]);
  });
});

describe("pianoDuplica — le scelte toccano solo l'altra riga", () => {
  it("Somma: l'altra riga prende il totale, nessuna copia", () => {
    const mela = voce("Mela", "colazione", 150);
    const altraMela = voce("Mela", "pranzo", 100);
    const p = piano([mela], [altraMela], { scelte: { "alimento-Mela": { tipo: "somma" } } });
    expect(p.scritture).toEqual([{ tipo: "aggiorna", id: altraMela.id, modifiche: { quantita_g: 250 } }]);
    expect(p.duplicati).toEqual(["Mela"]);
  });

  it("Scrivi quantità: l'altra riga prende i grammi scritti, nessuna copia", () => {
    const mela = voce("Mela", "colazione", 150);
    const altraMela = voce("Mela", "pranzo", 100);
    const p = piano([mela], [altraMela], { scelte: { "alimento-Mela": { tipo: "scrivi", grammi: 120 } } });
    expect(p.scritture).toEqual([{ tipo: "aggiorna", id: altraMela.id, modifiche: { quantita_g: 120 } }]);
  });

  it("Tieni separati: la copia accanto; Non duplicarlo: niente", () => {
    const mela = voce("Mela", "colazione", 150);
    const altraMela = voce("Mela", "pranzo", 100);
    const separati = piano([mela], [altraMela], { scelte: { "alimento-Mela": { tipo: "separati" } } });
    expect(separati.scritture).toHaveLength(1);
    expect(separati.scritture[0].tipo).toBe("crea");
    const escluso = piano([mela], [altraMela], { scelte: { "alimento-Mela": { tipo: "escludi" } } });
    expect(escluso.scritture).toEqual([]);
    expect(escluso.esclusi).toEqual(["Mela"]);
  });
});

describe("pianoDuplica — com'è fatta la copia", () => {
  it("stesso alimento e valori dell'originale; pasto, giorno, creato_il nuovi", () => {
    const mela = voce("Mela", "colazione", 150, { kcal_100g: 52 });
    const [s] = piano([mela], [], { data: IERI }).scritture;
    expect(s).toEqual({
      tipo: "crea",
      dati: {
        user_id: "u",
        alimento_id: "alimento-Mela",
        pasto_id: "pranzo",
        gruppo_id: null,
        quantita_g: 150,
        data: IERI,
        creato_il: ADESSO,
        // Un giorno passato: come in /aggiungi, niente ora inventata.
        consumato_alle: null,
        nome_alimento: "Mela",
        kcal_100g: 52,
        proteine_100g: 0.3,
        carboidrati_100g: 14,
        grassi_100g: 0.2,
      },
    });
  });

  it("su oggi consumato_alle è adesso", () => {
    const [s] = piano([voce("Mela", "colazione", 150)], [], { data: OGGI }).scritture;
    expect(s).toMatchObject({ dati: { consumato_alle: ADESSO } });
  });

  it("un pasto intero: tutte le copie con lo stesso gruppo nuovo", () => {
    const p = piano([voce("Pane", "colazione", 50), voce("Burro", "colazione", 10)], [], {
      gruppoId: "gruppo-nuovo",
    });
    expect(p.scritture.map((s) => (s.tipo === "crea" ? s.dati.gruppo_id : null))).toEqual([
      "gruppo-nuovo",
      "gruppo-nuovo",
    ]);
  });
});
