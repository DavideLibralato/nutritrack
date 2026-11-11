// La linea dell'obiettivo nel grafico delle calorie (PUNTO_DI_PARTENZA.md
// §3, "Barre"): finisce all'ultima colonna non futura, perché sopra i
// giorni futuri l'obiettivo non lo sappiamo ancora; l'etichetta resta
// intera e dentro il grafico. Il grafico è largo 358 punti (viewBox),
// quindi una colonna della settimana è 358 / 7 ≈ 51,14.

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import GraficoCalorie, { posizioneLineaObiettivo } from "./GraficoCalorie";
import { giorniStatistiche, segnoObiettivo } from "@/lib/medieStatistiche";
import { giorniDelPeriodo } from "@/lib/periodiStatistiche";
import type { DatiObiettivi } from "@/lib/targetGiorno";

afterEach(cleanup);

const LARGHEZZA = 358;
const COLONNA = LARGHEZZA / 7;
const LARGHEZZA_ETICHETTA = 96;

const DATI: DatiObiettivi = {
  obiettivi: [
    {
      id: "o1",
      user_id: "u1",
      updated_at: "2026-09-01T10:00:00.000Z",
      deleted_at: null,
      valido_dal: "2026-09-01",
      tipo: "massa",
      kcal: 2200,
      proteine_g: 140,
      carboidrati_g: 250,
      grassi_g: 70,
      peso_obiettivo: null,
    },
  ],
  obiettiviTarget: [
    {
      id: "t1",
      user_id: "u1",
      updated_at: "2026-09-01T10:00:00.000Z",
      deleted_at: null,
      obiettivo_id: "o1",
      tipo_giorno: "normale",
      kcal: 2200,
      proteine_g: 140,
      carboidrati_g: 250,
      grassi_g: 70,
    },
  ],
  giorni: [],
  profilo: null,
};

// Disegna la settimana del 9–15 novembre 2026 con `oggi` dato e restituisce
// la linea e l'etichetta dell'obiettivo.
function disegna(oggi: string) {
  const giorni = giorniStatistiche(giorniDelPeriodo("settimana", "2026-11-09"), [], DATI, oggi);
  const { container } = render(
    <GraficoCalorie
      giorni={giorni}
      modo="settimana"
      oggi={oggi}
      segno={segnoObiettivo(giorni)}
      selezionato={null}
      onTocca={() => {}}
    />
  );
  const linea = container.querySelector('[data-segno="linea-obiettivo"]')!;
  const etichetta = container.querySelector('[data-segno="etichetta-obiettivo"]')!;
  return {
    x2: Number(linea.getAttribute("x2")),
    etichettaX: Number(etichetta.getAttribute("x")),
    ancora: etichetta.getAttribute("text-anchor"),
    testo: etichetta.textContent,
  };
}

// Dove sta l'etichetta, da sinistra a destra, sapendo l'ancora.
function estremi(x: number, ancora: string | null) {
  return ancora === "end" ? [x - LARGHEZZA_ETICHETTA, x] : [x, x + LARGHEZZA_ETICHETTA];
}

describe("linea dell'obiettivo", () => {
  it("settimana in corso con oggi lunedì: la linea finisce alla prima colonna", () => {
    const r = disegna("2026-11-09");
    expect(r.x2).toBeCloseTo(COLONNA, 5);
    expect(r.testo).toBe("obiettivo 2200");
    // L'etichetta sta dopo la linea, sopra i giorni futuri, intera nel grafico.
    expect(r.ancora).toBe("start");
    const [da, a] = estremi(r.etichettaX, r.ancora);
    expect(da).toBeGreaterThan(r.x2);
    expect(a).toBeLessThanOrEqual(LARGHEZZA);
  });

  it("oggi sabato: non c'è posto dopo la linea, l'etichetta sta sopra, alla sua fine", () => {
    const r = disegna("2026-11-14");
    expect(r.x2).toBeCloseTo(6 * COLONNA, 5);
    expect(r.ancora).toBe("end");
    const [da, a] = estremi(r.etichettaX, r.ancora);
    expect(da).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(r.x2);
  });

  it("una settimana passata: la linea arriva in fondo", () => {
    const r = disegna("2026-11-20");
    expect(r.x2).toBeCloseTo(LARGHEZZA, 5);
    expect(r.ancora).toBe("end");
    expect(r.etichettaX).toBeCloseTo(LARGHEZZA, 5);
  });

  it("l'etichetta è sempre intera e dentro, per ogni giorno del mese", () => {
    for (const totali of [7, 28, 29, 30, 31]) {
      for (let n = 1; n <= totali; n++) {
        const { fine, etichetta } = posizioneLineaObiettivo(n, totali);
        const [da, a] = estremi(etichetta.x, etichetta.ancora);
        expect(da, `${n}/${totali}`).toBeGreaterThanOrEqual(0);
        expect(a, `${n}/${totali}`).toBeLessThanOrEqual(LARGHEZZA);
        // Dopo la linea, o sopra la linea: mai a cavallo della sua fine.
        expect(etichetta.ancora === "start" ? da > fine : a <= fine, `${n}/${totali}`).toBe(true);
      }
    }
  });
});
