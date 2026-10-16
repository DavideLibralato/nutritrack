// I testi della pagina Amici (PUNTO_DI_PARTENZA.md §3 "Amici"; mockup
// docs/mockups/amici.html, "Testi degli esiti"). Test permanente: un esito
// nuovo della funzione del database senza testo, o con il nome scritto come
// l'ha digitato l'utente invece che come lo vede l'altro, non fa rumore.

import { describe, expect, it } from "vitest";
import type { EsitoChiediAmicizia } from "./amicizie";
import {
  etichettaAmico,
  testiConfermaRimozione,
  testoEsitoChiedi,
  testoNovitaRiga,
  testoNovitaTab,
  testoRigaAmici,
} from "./testiAmici";

describe("testoEsitoChiedi", () => {
  it("i testi del mockup, con il nome normalizzato", () => {
    expect(testoEsitoChiedi("inviata", "  Marco_B ")).toEqual({
      testo: "Richiesta inviata a @marco_b.",
      tono: "ok",
    });
    expect(testoEsitoChiedi("gia_chiesta", "MARCO_B")).toEqual({
      testo: "Hai già mandato una richiesta a @marco_b.",
      tono: "avviso",
    });
    expect(testoEsitoChiedi("accettata", "marco_b")).toEqual({ testo: "Ora siete amici.", tono: "ok" });
    expect(testoEsitoChiedi("non_trovato", "x").testo).toBe(
      "Nessun utente con questo username. Controlla come è scritto."
    );
    expect(testoEsitoChiedi("gia_amici", "x").testo).toBe("Siete già amici.");
    expect(testoEsitoChiedi("troppo_presto", "x").testo).toBe("Puoi riprovare tra qualche giorno.");
    expect(testoEsitoChiedi("sei_tu", "x").testo).toBe("Questo è il tuo username.");
    expect(testoEsitoChiedi("senza_username", "x").testo).toBe("Prima scegli il tuo username.");
  });

  it("in verde solo ciò che è andato a buon fine", () => {
    const tutti: EsitoChiediAmicizia[] = [
      "inviata",
      "accettata",
      "non_trovato",
      "gia_amici",
      "gia_chiesta",
      "troppo_presto",
      "sei_tu",
      "senza_username",
      "errore",
    ];
    const verdi = tutti.filter((e) => testoEsitoChiedi(e, "x").tono === "ok");
    expect(verdi).toEqual(["inviata", "accettata"]);
    for (const e of tutti) expect(testoEsitoChiedi(e, "x").testo, e).not.toBe("");
  });
});

describe("testoNovitaRiga e testoNovitaTab", () => {
  it("nella riga Amici: singolare e plurale", () => {
    expect(testoNovitaRiga(1)).toBe("1 nuova");
    expect(testoNovitaRiga(2)).toBe("2 nuove");
  });

  it("sulla tab, per lo screen reader: 'novità' non cambia", () => {
    expect(testoNovitaTab(1)).toBe("1 novità in Amici");
    expect(testoNovitaTab(2)).toBe("2 novità in Amici");
  });
});

describe("testoRigaAmici", () => {
  it("singolare, plurale e nessuno", () => {
    expect(testoRigaAmici(0)).toBe("Nessuno");
    expect(testoRigaAmici(1)).toBe("1 amico");
    expect(testoRigaAmici(2)).toBe("2 amici");
  });
});

describe("testiConfermaRimozione", () => {
  it("con lo username nel titolo", () => {
    expect(testiConfermaRimozione("sara_c")).toEqual({
      titolo: "Rimuovere @sara_c dagli amici?",
      testo: "Gli alimenti che vi siete già mandati restano.",
    });
  });

  it("senza username, un titolo che non lo inventa", () => {
    expect(testiConfermaRimozione(null).titolo).toBe("Rimuovere questo amico?");
  });
});

describe("etichettaAmico", () => {
  it("@nome, o il ripiego", () => {
    expect(etichettaAmico("sara_c")).toBe("@sara_c");
    expect(etichettaAmico(null)).toBe("Nome non disponibile");
  });
});
