import { describe, expect, it } from "vitest";
import { avviaTempo, pausaTempo, riprendiTempo, tempoRimasto } from "./tempoBarra";

// La pausa della barra dei messaggi (BarraAnnulla): ferma il conto e lo fa
// riprendere da dove era, mai da capo. Regola: la barra resta visibile al
// massimo per la sua durata più il tempo passato in pausa, mai di più.

describe("tempoBarra", () => {
  it("senza pause scende fino a zero e non va sotto", () => {
    const t = avviaTempo(3000, 1000);
    expect(tempoRimasto(t, 1000)).toBe(3000);
    expect(tempoRimasto(t, 2500)).toBe(1500);
    expect(tempoRimasto(t, 4000)).toBe(0);
    expect(tempoRimasto(t, 9000)).toBe(0);
  });

  it("pausa a metà: il tempo resta fermo finché dura", () => {
    let t = avviaTempo(3000, 0);
    t = pausaTempo(t, 1500);
    expect(tempoRimasto(t, 1500)).toBe(1500);
    expect(tempoRimasto(t, 60_000)).toBe(1500);
  });

  it("ripresa: riparte da quanto restava, non da capo", () => {
    let t = avviaTempo(3000, 0);
    t = pausaTempo(t, 1500);
    t = riprendiTempo(t, 10_000);
    expect(tempoRimasto(t, 10_000)).toBe(1500);
    expect(tempoRimasto(t, 11_000)).toBe(500);
    expect(tempoRimasto(t, 11_500)).toBe(0);
  });

  it("pausa o ripresa ripetute non cambiano niente", () => {
    let t = avviaTempo(3000, 0);
    t = pausaTempo(t, 1000);
    expect(pausaTempo(t, 5000)).toBe(t);
    t = riprendiTempo(t, 6000);
    expect(riprendiTempo(t, 7000)).toBe(t);
    expect(tempoRimasto(t, 7000)).toBe(1000);
  });

  it("più pause di fila: visibile al massimo durata + tempo in pausa", () => {
    // Una sequenza di tocchi brevi e lunghi, come chi tocca la barra più
    // volte mentre inserisce altri alimenti.
    const durata = 3000;
    const inizio = 0;
    const tocchi = [
      [200, 260],
      [500, 900],
      [1200, 1210],
      [2000, 4000],
      [4300, 4350],
    ];
    let t = avviaTempo(durata, inizio);
    let inPausaMs = 0;
    for (const [giu, su] of tocchi) {
      t = pausaTempo(t, giu);
      t = riprendiTempo(t, su);
      inPausaMs += su - giu;
      // Ogni tocco non aggiunge mai più del tempo in cui il dito è rimasto.
      expect(tempoRimasto(t, su)).toBeLessThanOrEqual(durata - (su - inizio - inPausaMs));
    }
    // La barra si chiude quando il tempo arriva a zero.
    const chiusura = t.partitoAlle! + t.rimanenteMs;
    expect(chiusura - inizio).toBeLessThanOrEqual(durata + inPausaMs);
    // Ed esattamente lì: il tempo non in pausa è proprio la durata.
    expect(chiusura - inizio - inPausaMs).toBe(durata);
    expect(tempoRimasto(t, chiusura)).toBe(0);
  });

  it("una pausa che inizia dopo lo scadere non fa ricomparire tempo", () => {
    let t = avviaTempo(3000, 0);
    t = pausaTempo(t, 5000);
    t = riprendiTempo(t, 6000);
    expect(tempoRimasto(t, 6000)).toBe(0);
  });
});
