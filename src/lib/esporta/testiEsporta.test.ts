// I testi della pagina Esporta (testiEsporta.ts). Regole sulle date e sui
// numeri che si sbagliano in silenzio: il periodo del diario con le date
// in disordine, «ieri» contato a 24 ore, l'anno che manca a cavallo di
// capodanno, il peso del file in byte invece che in KB.

import { describe, it, expect } from "vitest";
import { notaRiepilogo, testoDiario, testoFoto, testoPeso } from "./testiEsporta";

describe("testoDiario", () => {
  it("nessuna voce, una voce, un solo giorno, un periodo", () => {
    expect(testoDiario([])).toEqual({ numero: "Nessuna voce", periodo: null });
    expect(testoDiario([{ data: "2026-11-07" }])).toEqual({ numero: "1 voce", periodo: "del 07/11" });
    expect(testoDiario([{ data: "2026-11-07" }, { data: "2026-11-07" }])).toEqual({
      numero: "2 voci",
      periodo: "del 07/11",
    });
  });

  it("prima e ultima data anche con le voci in disordine", () => {
    const voci = [{ data: "2026-10-15" }, { data: "2026-11-07" }, { data: "2026-09-21" }];
    expect(testoDiario(voci)).toEqual({ numero: "3 voci", periodo: "dal 21/09 al 07/11" });
  });

  it("a cavallo di due anni, l'anno su tutte e due le date", () => {
    expect(testoDiario([{ data: "2026-12-30" }, { data: "2027-01-02" }]).periodo).toBe(
      "dal 30/12/2026 al 02/01/2027"
    );
  });
});

describe("testoFoto", () => {
  it("in verifica, inclusa (da server o telefono), assente, non inclusa", () => {
    expect(testoFoto(null)).toBe("Controllo…");
    expect(testoFoto({ stato: "inclusa", origine: "server" })).toBe("Inclusa");
    expect(testoFoto({ stato: "inclusa", origine: "telefono" })).toBe("Inclusa");
    expect(testoFoto({ stato: "assente" })).toBe("Non hai una foto");
    expect(testoFoto({ stato: "non-inclusa" })).toBe("Non inclusa");
  });
});

describe("notaRiepilogo", () => {
  const adesso = new Date("2026-11-08T08:00:00+01:00");
  const verificata = { stato: "inclusa", origine: "server" } as const;

  it("l'ultimo collegamento: oggi, ieri, un altro giorno, sconosciuto", () => {
    expect(notaRiepilogo(verificata, "2026-11-08T06:52:00.000Z", adesso)).toBe(
      "Sono i dati di questo telefono. Ultimo collegamento al server: oggi alle 07:52."
    );
    // 23:50 di ieri, guardato alle 08:00: ieri, anche se sono meno di 24 ore.
    expect(notaRiepilogo(verificata, "2026-11-07T22:50:00.000Z", adesso)).toBe(
      "Sono i dati di questo telefono. Ultimo collegamento al server: ieri alle 23:50."
    );
    expect(notaRiepilogo(verificata, "2026-11-05T17:05:00.000Z", adesso)).toBe(
      "Sono i dati di questo telefono. Ultimo collegamento al server: il 05/11 alle 18:05."
    );
    expect(notaRiepilogo(verificata, null, adesso)).toBe("Sono i dati di questo telefono.");
    expect(notaRiepilogo({ stato: "assente" }, "non una data", adesso)).toBe("Sono i dati di questo telefono.");
  });

  it("la foto dalla copia del telefono o non inclusa prende il posto della nota", () => {
    expect(notaRiepilogo({ stato: "inclusa", origine: "telefono" }, "2026-11-08T06:52:00.000Z", adesso)).toBe(
      "La foto è quella salvata su questo telefono: senza rete non ho potuto controllare che sia l'ultima."
    );
    expect(notaRiepilogo({ stato: "non-inclusa" }, null, adesso)).toBe(
      "Senza rete non so se hai una foto aggiornata, quindi resta fuori. Tutto il resto è nel file. Con la rete, riapri questa pagina."
    );
  });
});

describe("testoPeso", () => {
  it("KB arrotondati, almeno 1; MB con un decimale e la virgola", () => {
    expect(testoPeso(0)).toBe("circa 1 KB");
    expect(testoPeso(240_400)).toBe("circa 240 KB");
    expect(testoPeso(999_499)).toBe("circa 999 KB");
    expect(testoPeso(1_234_567)).toBe("circa 1,2 MB");
  });
});
