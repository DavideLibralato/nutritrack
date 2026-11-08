// Il promemoria «Ultima esportazione» (ultimaEsportazione.ts e
// salvaEsportazione.ts; PUNTO_DI_PARTENZA.md §10.4). Regole sulle date che
// sbagliano in silenzio: «ieri» contato per blocchi di 24 ore, l'ora legale
// che sposta un giorno, un foglio annullato che fa credere di avere un
// backup che non c'è, o il CSV contato come backup.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  chiaveUltimaEsportazione,
  giorniDiCalendarioFra,
  leggiUltimaEsportazione,
  segnaEsportazione,
  testoPromemoria,
  togliUltimaEsportazione,
} from "./ultimaEsportazione";
import { salvaCsv, salvaJson } from "./salvaEsportazione";
import type { AmbienteSalvataggio } from "./condividiFile";

const U = "utente-io";
const ALTRO = "utente-altro";

// Ore di Roma (i test girano con TZ=Europe/Rome, vitest.config.ts).
const roma = (testo: string) => new Date(testo);

beforeEach(() => {
  window.localStorage.clear();
});

describe("testoPromemoria", () => {
  const adesso = roma("2026-11-08T10:00:00+01:00");

  it("mai esportato, o un valore illeggibile", () => {
    expect(testoPromemoria(null, adesso)).toBe("Mai esportato");
    expect(testoPromemoria("non una data", adesso)).toBe("Mai esportato");
  });

  it("oggi, ieri, N giorni fa", () => {
    expect(testoPromemoria(roma("2026-11-08T00:05:00+01:00").toISOString(), adesso)).toBe("Ultima esportazione: oggi");
    expect(testoPromemoria(roma("2026-11-07T09:00:00+01:00").toISOString(), adesso)).toBe("Ultima esportazione: ieri");
    expect(testoPromemoria(roma("2026-11-06T22:00:00+01:00").toISOString(), adesso)).toBe(
      "Ultima esportazione: 2 giorni fa"
    );
    expect(testoPromemoria(roma("2026-10-09T12:00:00+02:00").toISOString(), adesso)).toBe(
      "Ultima esportazione: 30 giorni fa"
    );
  });

  it("si contano i giorni del calendario, non le 24 ore: 23:50 di ieri guardato alle 00:10 è ieri", () => {
    const ultima = roma("2026-11-07T23:50:00+01:00").toISOString();
    expect(testoPromemoria(ultima, roma("2026-11-08T00:10:00+01:00"))).toBe("Ultima esportazione: ieri");
    // E 00:10 guardato alle 23:50 dello stesso giorno è ancora oggi.
    expect(testoPromemoria(roma("2026-11-08T00:10:00+01:00").toISOString(), roma("2026-11-08T23:50:00+01:00"))).toBe(
      "Ultima esportazione: oggi"
    );
  });

  it("a cavallo dell'ora legale (25/10/2026) i giorni restano giusti", () => {
    // Il giorno del cambio dura 25 ore.
    expect(giorniDiCalendarioFra(roma("2026-10-24T23:30:00+02:00"), roma("2026-10-26T00:30:00+01:00"))).toBe(2);
    expect(giorniDiCalendarioFra(roma("2026-10-25T00:30:00+02:00"), roma("2026-10-25T23:30:00+01:00"))).toBe(0);
    // E a marzo (29/03/2026), quando dura 23 ore.
    expect(giorniDiCalendarioFra(roma("2026-03-28T23:30:00+01:00"), roma("2026-03-30T00:30:00+02:00"))).toBe(2);
  });

  it("una data nel futuro (orologio spostato) vale oggi", () => {
    expect(testoPromemoria(roma("2026-11-10T10:00:00+01:00").toISOString(), adesso)).toBe("Ultima esportazione: oggi");
  });
});

describe("la data salvata, per utente", () => {
  it("segna, leggi e togli valgono solo per l'utente indicato", () => {
    segnaEsportazione(U, roma("2026-11-08T10:00:00+01:00"));
    segnaEsportazione(ALTRO, roma("2026-11-01T10:00:00+01:00"));
    expect(leggiUltimaEsportazione(U)).toBe("2026-11-08T09:00:00.000Z");
    togliUltimaEsportazione(U);
    expect(leggiUltimaEsportazione(U)).toBeNull();
    expect(leggiUltimaEsportazione(ALTRO)).toBe("2026-11-01T09:00:00.000Z");
    expect(window.localStorage.getItem(chiaveUltimaEsportazione(ALTRO))).not.toBeNull();
  });
});

describe("quando si aggiorna", () => {
  const adesso = () => roma("2026-11-08T10:00:00+01:00");

  function ambiente(share: () => Promise<void>, condivisibili = true): AmbienteSalvataggio {
    return {
      canShare: () => condivisibili,
      share: vi.fn(share),
      installata: true,
      scarica: vi.fn(),
    };
  }

  function rifiuto(nome: string) {
    const e = new Error(nome);
    e.name = nome;
    return () => Promise.reject(e);
  }

  it("JSON salvato: il promemoria passa a oggi", async () => {
    await salvaJson(ambiente(async () => {}), U, "libra-dati.json", "{}", adesso);
    expect(testoPromemoria(leggiUltimaEsportazione(U), adesso())).toBe("Ultima esportazione: oggi");
  });

  it("JSON, foglio annullato: il promemoria non cambia", async () => {
    segnaEsportazione(U, roma("2026-11-01T10:00:00+01:00"));
    expect((await salvaJson(ambiente(rifiuto("AbortError")), U, "libra-dati.json", "{}", adesso)).esito).toBe("annullato");
    expect(testoPromemoria(leggiUltimaEsportazione(U), adesso())).toBe("Ultima esportazione: 7 giorni fa");
  });

  it("JSON, condivisione rifiutata o impossibile: il promemoria non cambia", async () => {
    await salvaJson(ambiente(rifiuto("NotAllowedError")), U, "libra-dati.json", "{}", adesso);
    expect(leggiUltimaEsportazione(U)).toBeNull();
    // App installata, nessun tipo condivisibile: impossibile.
    await salvaJson(ambiente(async () => {}, false), U, "libra-dati.json", "{}", adesso);
    expect(leggiUltimaEsportazione(U)).toBeNull();
  });

  it("CSV salvato: il promemoria non cambia (il CSV non è un backup)", async () => {
    const esito = await salvaCsv(ambiente(async () => {}), "libra-diario.csv", "a;b");
    expect(esito.esito).toBe("salvato");
    expect(leggiUltimaEsportazione(U)).toBeNull();
  });
});
