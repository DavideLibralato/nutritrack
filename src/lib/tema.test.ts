import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHIAVE_TEMA,
  COLORI_BARRA,
  EVENTO_TEMA,
  SCRIPT_TEMA,
  leggiSceltaTema,
  salvaSceltaTema,
  temaEffettivo,
} from "./tema";

// Il tema da disegnare (PUNTO_DI_PARTENZA.md sezione 7). Due copie della
// stessa logica girano nel browser: SCRIPT_TEMA (generato da temaEffettivo
// e avviaTema, nell'<head> dell'app) e lo script ricopiato in
// public/offline.html. Qui girano tutte e due, in una pagina finta, sugli
// stessi casi: se la copia di offline.html si allontana dall'originale, un
// caso fallisce.

describe("temaEffettivo", () => {
  it("una scelta esplicita vince sul telefono", () => {
    expect(temaEffettivo("chiaro", true)).toBe("chiaro");
    expect(temaEffettivo("scuro", false)).toBe("scuro");
  });

  it("sistema, niente salvato o un valore sconosciuto: segue il telefono", () => {
    for (const scelta of ["sistema", null, "", "viola", "Scuro"]) {
      expect(temaEffettivo(scelta, false)).toBe("chiaro");
      expect(temaEffettivo(scelta, true)).toBe("scuro");
    }
  });
});

const radice = path.resolve(import.meta.dirname, "../..");
const offlineHtml = readFileSync(path.join(radice, "public/offline.html"), "utf8");

const META = `
  <meta name="theme-color" content="#faf7f2" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1b1815" media="(prefers-color-scheme: dark)">`;

// "app" esegue proprio la stringa SCRIPT_TEMA che layout.tsx mette in
// <head>, non le funzioni da cui è ricavata: se temaEffettivo o avviaTema
// usassero qualcosa di fuori (un import, una funzione del modulo), nel
// testo copiato non esisterebbe e questi casi fallirebbero (provato il
// 3/10 facendo chiamare a temaEffettivo una funzione esterna: 4 rossi).
const PAGINE = {
  app: `<!doctype html><html><head>${META}<script>${SCRIPT_TEMA}</script></head><body></body></html>`,
  "offline.html": offlineHtml,
};

// Apre una pagina finta con la scelta salvata e il tema del telefono dati.
// storageRotto: localStorage lancia un errore al solo accesso, come Safari
// in navigazione privata.
function apri(
  html: string,
  { scelta, sistemaScuro, storageRotto = false }: { scelta: string | null; sistemaScuro: boolean; storageRotto?: boolean }
) {
  const ascoltatori: (() => void)[] = [];
  const sistema = {
    matches: sistemaScuro,
    addEventListener: (_tipo: string, f: () => void) => ascoltatori.push(f),
  };
  const dom = new JSDOM(html, {
    url: "https://nutritrack.test/",
    runScripts: "dangerously",
    beforeParse(window) {
      window.matchMedia = (() => sistema) as unknown as typeof window.matchMedia;
      window.localStorage.clear();
      if (storageRotto) {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new window.DOMException("accesso negato", "SecurityError");
          },
        });
      } else if (scelta !== null) {
        window.localStorage.setItem(CHIAVE_TEMA, scelta);
      }
    },
  });
  const documento = dom.window.document;
  return {
    window: dom.window,
    tema: () => documento.documentElement.getAttribute("data-tema"),
    // Il browser usa il primo theme-color che vale: deve essere quello dello
    // script (senza media), uno solo, con i due della pagina intatti dopo.
    coloriBarra: () =>
      [...documento.querySelectorAll('meta[name="theme-color"]')].map(
        (m) => `${m.getAttribute("media") ?? "sempre"} ${m.getAttribute("content")}`
      ),
    cambiaSistema(scuro: boolean) {
      sistema.matches = scuro;
      ascoltatori.forEach((f) => f());
    },
  };
}

function barraAttesa(tema: "chiaro" | "scuro") {
  return [
    `sempre ${COLORI_BARRA[tema]}`,
    "(prefers-color-scheme: light) #faf7f2",
    "(prefers-color-scheme: dark) #1b1815",
  ];
}

describe.each(Object.entries(PAGINE))("script del tema: %s", (_nome, html) => {
  it("prima del disegno scrive data-tema e il colore della barra secondo scelta e telefono", () => {
    for (const scelta of [null, "chiaro", "scuro", "sistema", "viola"]) {
      for (const sistemaScuro of [false, true]) {
        const pagina = apri(html, { scelta, sistemaScuro });
        const atteso = temaEffettivo(scelta, sistemaScuro);
        expect(pagina.tema(), `${scelta} / telefono scuro: ${sistemaScuro}`).toBe(atteso);
        expect(pagina.coloriBarra()).toEqual(barraAttesa(atteso));
      }
    }
  });

  it("senza localStorage (Safari privato) fa come sistema, senza errori", () => {
    expect(apri(html, { scelta: null, sistemaScuro: false, storageRotto: true }).tema()).toBe("chiaro");
    expect(apri(html, { scelta: null, sistemaScuro: true, storageRotto: true }).tema()).toBe("scuro");
  });

  it("con sistema segue il telefono quando cambia; con una scelta esplicita no", () => {
    const sistema = apri(html, { scelta: "sistema", sistemaScuro: false });
    sistema.cambiaSistema(true);
    expect(sistema.tema()).toBe("scuro");
    expect(sistema.coloriBarra()).toEqual(barraAttesa("scuro"));
    sistema.cambiaSistema(false);
    expect(sistema.tema()).toBe("chiaro");

    const chiaro = apri(html, { scelta: "chiaro", sistemaScuro: false });
    chiaro.cambiaSistema(true);
    expect(chiaro.tema()).toBe("chiaro");
  });

  it("una scelta cambiata in un'altra scheda si applica (evento storage)", () => {
    const pagina = apri(html, { scelta: "chiaro", sistemaScuro: false });
    pagina.window.localStorage.setItem(CHIAVE_TEMA, "scuro");
    pagina.window.dispatchEvent(new pagina.window.StorageEvent("storage", { key: CHIAVE_TEMA }));
    expect(pagina.tema()).toBe("scuro");
  });
});

describe("pagina Aspetto: leggiSceltaTema e salvaSceltaTema", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("salva la scelta, la rilegge e avvisa lo script con l'evento", () => {
    const avvisi = vi.fn();
    window.addEventListener(EVENTO_TEMA, avvisi);
    expect(leggiSceltaTema()).toBe("sistema");
    salvaSceltaTema("scuro");
    expect(window.localStorage.getItem(CHIAVE_TEMA)).toBe("scuro");
    expect(leggiSceltaTema()).toBe("scuro");
    salvaSceltaTema("sistema");
    expect(leggiSceltaTema()).toBe("sistema");
    expect(avvisi).toHaveBeenCalledTimes(2);
    window.removeEventListener(EVENTO_TEMA, avvisi);
  });

  it("un valore sconosciuto si legge come sistema", () => {
    window.localStorage.setItem(CHIAVE_TEMA, "viola");
    expect(leggiSceltaTema()).toBe("sistema");
  });

  it("senza localStorage: sistema, e salvare non lancia errori", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("accesso negato", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("accesso negato", "SecurityError");
    });
    expect(leggiSceltaTema()).toBe("sistema");
    expect(() => salvaSceltaTema("scuro")).not.toThrow();
    expect(leggiSceltaTema()).toBe("sistema");
  });

  it("lo script dell'app riapplica il tema quando la pagina Aspetto salva", () => {
    const pagina = apri(PAGINE.app, { scelta: null, sistemaScuro: false });
    pagina.window.localStorage.setItem(CHIAVE_TEMA, "scuro");
    pagina.window.dispatchEvent(new pagina.window.Event(EVENTO_TEMA));
    expect(pagina.tema()).toBe("scuro");
  });
});
