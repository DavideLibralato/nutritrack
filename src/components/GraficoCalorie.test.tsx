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
import type { VoceDiario } from "@/lib/db/tipi";

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

// Una voce da 100 g con le kcal date, per i casi con una barra.
function voce(data: string, kcal: number): VoceDiario {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-11-01T10:00:00.000Z",
    deleted_at: null,
    alimento_id: null,
    pasto_id: null,
    gruppo_id: null,
    quantita_g: 100,
    data,
    creato_il: "2026-11-01T10:00:00.000Z",
    consumato_alle: null,
    nome_alimento: "Pasta",
    kcal_100g: kcal,
    proteine_100g: 10,
    carboidrati_100g: 20,
    grassi_100g: 5,
  };
}

function disegnaPeriodo(
  modo: "settimana" | "mese",
  inizio: string,
  oggi: string,
  voci: VoceDiario[],
  selezionato: string | null = null
) {
  const giorni = giorniStatistiche(giorniDelPeriodo(modo, inizio), voci, DATI, oggi);
  return render(
    <GraficoCalorie
      giorni={giorni}
      modo={modo}
      oggi={oggi}
      segno={segnoObiettivo(giorni)}
      selezionato={selezionato}
      onTocca={() => {}}
    />
  ).container;
}

describe("valore sopra la barra toccata", () => {
  it("nella settimana c'è", () => {
    const c = disegnaPeriodo(
      "settimana",
      "2026-11-09",
      "2026-11-20",
      [voce("2026-11-10", 577)],
      "2026-11-10"
    );
    expect(c.querySelector('[data-segno="valore-toccato"]')?.textContent).toBe("577");
  });

  it("nel mese no: la colonna è più stretta del numero", () => {
    const c = disegnaPeriodo(
      "mese",
      "2026-11-01",
      "2026-11-20",
      [voce("2026-11-10", 577)],
      "2026-11-10"
    );
    expect(c.querySelector('[data-segno="valore-toccato"]')).toBeNull();
    // La colonna resta evidenziata come toccata.
    expect(c.querySelector('[data-giorno="2026-11-10"]')?.getAttribute("aria-pressed")).toBe(
      "true"
    );
  });
});

describe("giorni senza voci", () => {
  it("un giorno passato senza voci ha una lineetta di 2–3 punti, non un rettangolo", () => {
    const c = disegnaPeriodo("settimana", "2026-11-09", "2026-11-11", []);
    const segno = c.querySelector('[data-giorno="2026-11-10"] [data-segno="senza-dati"]');
    expect(segno).not.toBeNull();
    const altezza = Number(segno!.getAttribute("height"));
    expect(altezza).toBeGreaterThanOrEqual(2);
    expect(altezza).toBeLessThanOrEqual(3);
  });

  it("oggi senza voci: nessun segno sopra la base, solo l'etichetta in grassetto, non sbiadita", () => {
    const c = disegnaPeriodo("settimana", "2026-11-09", "2026-11-11", []);
    const oggi = c.querySelector('[data-giorno="2026-11-11"]')!;
    // Nessun rettangolo (né barra, né lineetta, né evidenza) e nessuna linea.
    expect(oggi.querySelectorAll("rect, line")).toHaveLength(0);
    const etichetta = oggi.querySelector("text")!;
    expect(etichetta.textContent).toBe("M");
    expect(etichetta.getAttribute("font-weight")).toBe("600");
    expect(etichetta.getAttribute("opacity")).toBe("1");
    expect(oggi.querySelector("circle")).not.toBeNull(); // il pallino di oggi
  });
});
