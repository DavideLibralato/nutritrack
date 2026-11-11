// Il grafico del peso (PUNTO_DI_PARTENZA.md §3, "Peso"): l'etichetta
// "obiettivo N" non è mai attraversata dalla linea tratteggiata di "oggi",
// e accanto ai punti è scritto solo il valore dell'ultimo. Il grafico è
// largo 358 punti (viewBox); l'etichetta a 11,5 punti occupa al massimo
// circa 96 punti.

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import GraficoPeso, { posizioneEtichettaObiettivoPeso } from "./GraficoPeso";

afterEach(cleanup);

const LARGHEZZA = 358;
const LARGHEZZA_ETICHETTA = 96;

function estremi(x: number, ancora: string | null): [number, number] {
  return ancora === "end" ? [x - LARGHEZZA_ETICHETTA, x] : [x, x + LARGHEZZA_ETICHETTA];
}

function disegna(pesate: { data: string; valore: number }[], inizioAsse: string, fineAsse: string) {
  const { container } = render(
    <GraficoPeso pesate={pesate} inizioAsse={inizioAsse} fineAsse={fineAsse} pesoObiettivo={80} />
  );
  const oggi = container.querySelector('[data-segno="linea-oggi"]')!;
  const etichetta = container.querySelector('[data-segno="etichetta-obiettivo-peso"]')!;
  return {
    container,
    xOggi: Number(oggi.getAttribute("x1")),
    etichetta: estremi(Number(etichetta.getAttribute("x")), etichetta.getAttribute("text-anchor")),
    testo: etichetta.textContent,
  };
}

describe("etichetta del peso obiettivo e linea di oggi", () => {
  it("con le pesate di più settimane «oggi» sta a destra e non attraversa l'etichetta", () => {
    const r = disegna(
      [
        { data: "2026-09-20", valore: 83.3 },
        { data: "2026-10-24", valore: 82 },
      ],
      "2026-09-20",
      "2026-11-11"
    );
    expect(r.testo).toBe("obiettivo 80");
    expect(r.xOggi < r.etichetta[0] || r.xOggi > r.etichetta[1]).toBe(true);
    expect(r.etichetta[0]).toBeGreaterThanOrEqual(0);
    expect(r.etichetta[1]).toBeLessThanOrEqual(LARGHEZZA);
  });

  it("una pesata sola, fatta oggi: «oggi» in mezzo, l'etichetta resta libera", () => {
    const r = disegna([{ data: "2026-11-11", valore: 82 }], "2026-11-11", "2026-11-11");
    expect(r.xOggi < r.etichetta[0] || r.xOggi > r.etichetta[1]).toBe(true);
  });

  it("per qualunque posizione di «oggi» le due cose non si toccano e l'etichetta è intera", () => {
    for (let xOggi = 0; xOggi <= LARGHEZZA; xOggi += 0.5) {
      const { x, ancora } = posizioneEtichettaObiettivoPeso(xOggi);
      const [da, a] = estremi(x, ancora);
      expect(xOggi < da || xOggi > a, `oggi a ${xOggi}`).toBe(true);
      expect(da, `oggi a ${xOggi}`).toBeGreaterThanOrEqual(0);
      expect(a, `oggi a ${xOggi}`).toBeLessThanOrEqual(LARGHEZZA);
    }
  });
});

describe("valori scritti accanto ai punti", () => {
  it("solo l'ultimo: il primo non si ripete accanto al numero della scala", () => {
    const { container } = disegna(
      [
        { data: "2026-09-20", valore: 83.3 },
        { data: "2026-10-10", valore: 82.7 },
        { data: "2026-10-24", valore: 84.3 },
      ],
      "2026-09-20",
      "2026-11-11"
    );
    const testi = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(testi).toContain("84,3");
    expect(testi).not.toContain("83,3");
    expect(testi).not.toContain("82,7");
  });
});
