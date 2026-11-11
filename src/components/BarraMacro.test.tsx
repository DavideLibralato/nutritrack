// I colori delle barre macro di Oggi con la regola unica (PUNTO_DI_PARTENZA.md
// §7, "La regola dei colori"), dal commit 4 del branch `statistiche`: la
// fascia ±5% vale per proteine, carboidrati e grassi con qualunque
// obiettivo, Dimagrire compreso. Fino all'11/11 una barra era verde solo se
// esattamente uguale al target e arancio da 1 g sopra.

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import BarraMacro from "./BarraMacro";
import type { TipoObiettivo } from "@/lib/db/tipi";

afterEach(cleanup);

function disegna(
  grandezza: "grassi" | "carboidrati" | "proteine",
  valore: number,
  obiettivo: number | null,
  tipo: TipoObiettivo | null
) {
  const { container } = render(
    <BarraMacro nome="Macro" grandezza={grandezza} valore={valore} obiettivo={obiettivo} tipoObiettivo={tipo} />
  );
  const barra = container.querySelector(`[data-segno="barra-${grandezza}"]`) as HTMLElement;
  const r = {
    colore: (barra.getAttribute("class") ?? "").split(" ").find((c) => c.startsWith("bg-")),
    larghezza: barra.style.width,
    testo: container.textContent,
  };
  cleanup();
  return r;
}

describe("BarraMacro: colori", () => {
  it("proteine 151 su 150: ora «in linea» (prima arancio)", () => {
    expect(disegna("proteine", 151, 150, "massa").colore).toBe("bg-accent");
  });

  it("Massa: neutro sotto la fascia, verde dentro, arancio sopra (150 g: da 143 a 157)", () => {
    expect(disegna("proteine", 100, 150, "massa").colore).toBe("bg-neutral");
    expect(disegna("proteine", 142, 150, "massa").colore).toBe("bg-neutral");
    expect(disegna("proteine", 143, 150, "massa").colore).toBe("bg-accent");
    expect(disegna("proteine", 157, 150, "massa").colore).toBe("bg-accent");
    expect(disegna("proteine", 158, 150, "massa").colore).toBe("bg-warning");
  });

  it("con Dimagrire grassi e carboidrati hanno la fascia, non il tetto", () => {
    expect(disegna("grassi", 20, 70, "dimagrire").colore).toBe("bg-neutral");
    expect(disegna("grassi", 72, 70, "dimagrire").colore).toBe("bg-accent");
    expect(disegna("carboidrati", 260, 250, "dimagrire").colore).toBe("bg-accent");
    expect(disegna("carboidrati", 263, 250, "dimagrire").colore).toBe("bg-warning");
  });

  it("i numeri e la lunghezza della barra non cambiano", () => {
    const r = disegna("proteine", 151.4, 150, "massa");
    expect(r.testo).toBe("Macro151 / 150 g");
    expect(r.larghezza).toBe("100%");
    expect(disegna("proteine", 75, 150, "massa").larghezza).toBe("50%");
  });

  it("senza obiettivo: neutro, barra vuota, solo i grammi", () => {
    const r = disegna("grassi", 40, null, null);
    expect(r.colore).toBe("bg-neutral");
    expect(r.larghezza).toBe("0%");
    expect(r.testo).toBe("Macro40 g");
  });
});
