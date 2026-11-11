// I colori dell'anello di Oggi con la regola unica (PUNTO_DI_PARTENZA.md
// §7, "La regola dei colori"), dal commit 4 del branch `statistiche`. Con
// obiettivo 2200 e fascia ±5% "in linea" va da 2090 a 2310.

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import AnelloCalorie from "./AnelloCalorie";
import type { TipoObiettivo } from "@/lib/db/tipi";

afterEach(cleanup);

function coloreArco(consumate: number, obiettivo: number | null, tipo: TipoObiettivo | null) {
  const { container } = render(<AnelloCalorie consumate={consumate} obiettivo={obiettivo} tipoObiettivo={tipo} />);
  const arco = container.querySelector('[data-segno="arco-calorie"]')!;
  const classe = arco.getAttribute("class") ?? "";
  cleanup();
  return classe;
}

describe("AnelloCalorie: colori", () => {
  it("Massa: neutro sotto la fascia, verde dentro, arancio sopra", () => {
    expect(coloreArco(1500, 2200, "massa")).toBe("stroke-neutral");
    expect(coloreArco(2089, 2200, "massa")).toBe("stroke-neutral");
    expect(coloreArco(2090, 2200, "massa")).toBe("stroke-accent");
    expect(coloreArco(2310, 2200, "massa")).toBe("stroke-accent");
    expect(coloreArco(2311, 2200, "massa")).toBe("stroke-warning");
  });

  it("Mantenere: come Massa", () => {
    expect(coloreArco(1500, 2200, "mantenere")).toBe("stroke-neutral");
    expect(coloreArco(2250, 2200, "mantenere")).toBe("stroke-accent");
    expect(coloreArco(2400, 2200, "mantenere")).toBe("stroke-warning");
  });

  it("Dimagrire: verde fino all'obiettivo, arancio da 1 kcal sopra", () => {
    expect(coloreArco(0, 2200, "dimagrire")).toBe("stroke-accent");
    expect(coloreArco(1500, 2200, "dimagrire")).toBe("stroke-accent");
    expect(coloreArco(2200, 2200, "dimagrire")).toBe("stroke-accent");
    expect(coloreArco(2201, 2200, "dimagrire")).toBe("stroke-warning");
  });

  it("i numeri al centro non cambiano", () => {
    const { container } = render(<AnelloCalorie consumate={2249.6} obiettivo={2200} tipoObiettivo="massa" />);
    expect(container.textContent).toBe("2250/ 2200");
  });

  it("senza obiettivo: arco vuoto e «/ —»", () => {
    const { container } = render(<AnelloCalorie consumate={800} obiettivo={null} tipoObiettivo={null} />);
    const arco = container.querySelector('[data-segno="arco-calorie"]')!;
    expect(arco.getAttribute("stroke-dasharray")?.startsWith("0 ")).toBe(true);
    expect(container.textContent).toBe("800/ —");
  });
});
