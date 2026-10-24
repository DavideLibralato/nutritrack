import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import {
  ATTRIBUTO_APERTURA,
  CHIAVE_APERTURA,
  SCRIPT_APERTURA,
  decidiApertura,
} from "./animazioneApertura";

// Quando mostrare l'animazione di apertura (PUNTO_DI_PARTENZA.md, sezione
// 7, "Animazione di apertura"): solo al primo caricamento di Oggi, mai
// tornando su Oggi da un'altra scheda, e se sessionStorage non funziona
// semplicemente non compare (mai un errore). È una regola che non fa
// rumore se si rompe: o l'animazione ricompare a ogni cambio scheda
// offline, o sparisce per sempre.

// Un sessionStorage finto, che si può rompere in lettura o in scrittura.
function memoriaFinta({
  segno = false,
  rottaInLettura = false,
  rottaInScrittura = false,
} = {}) {
  const dati = new Map<string, string>();
  if (segno) dati.set(CHIAVE_APERTURA, "1");
  return {
    dati,
    getItem(chiave: string) {
      if (rottaInLettura) throw new Error("accesso negato");
      return dati.get(chiave) ?? null;
    },
    setItem(chiave: string, valore: string) {
      if (rottaInScrittura) throw new Error("quota superata");
      dati.set(chiave, valore);
    },
  };
}

describe("decidiApertura", () => {
  it("primo caricamento di Oggi: la mostra e scrive il segno", () => {
    const memoria = memoriaFinta();
    expect(decidiApertura("/", "navigate", memoria, CHIAVE_APERTURA)).toBe("mostra");
    expect(memoria.dati.get(CHIAVE_APERTURA)).toBe("1");
  });

  it("segno già presente (cambio scheda offline = navigazione completa): non la mostra", () => {
    expect(decidiApertura("/", "navigate", memoriaFinta({ segno: true }), CHIAVE_APERTURA)).toBe(
      "salta"
    );
    // Anche "indietro" con ricarica completa.
    expect(
      decidiApertura("/", "back_forward", memoriaFinta({ segno: true }), CHIAVE_APERTURA)
    ).toBe("salta");
  });

  it("ricarica: la mostra anche con il segno", () => {
    expect(decidiApertura("/", "reload", memoriaFinta({ segno: true }), CHIAVE_APERTURA)).toBe(
      "mostra"
    );
  });

  it("browser che non dice il tipo di navigazione: decide il segno", () => {
    expect(decidiApertura("/", null, memoriaFinta(), CHIAVE_APERTURA)).toBe("mostra");
    expect(decidiApertura("/", null, memoriaFinta({ segno: true }), CHIAVE_APERTURA)).toBe("salta");
  });

  it("sessionStorage che lancia un errore, in lettura o in scrittura: non la mostra, senza eccezioni", () => {
    for (const tipo of ["navigate", "reload"]) {
      expect(
        decidiApertura("/", tipo, memoriaFinta({ rottaInLettura: true }), CHIAVE_APERTURA)
      ).toBe("salta");
      expect(
        decidiApertura("/", tipo, memoriaFinta({ rottaInScrittura: true }), CHIAVE_APERTURA)
      ).toBe("salta");
      // Il solo accesso a sessionStorage ha già lanciato: arriva null.
      expect(decidiApertura("/", tipo, null, CHIAVE_APERTURA)).toBe("salta");
    }
  });

  it("fuori da Oggi non decide e non scrive il segno", () => {
    for (const percorso of ["/login", "/impostazioni", "/aggiungi", "/onboarding"]) {
      const memoria = memoriaFinta();
      expect(decidiApertura(percorso, "navigate", memoria, CHIAVE_APERTURA)).toBeNull();
      expect(memoria.dati.size).toBe(0);
    }
  });
});

// La stringa vera che layout.tsx mette in <head>, eseguita in una pagina
// finta: se decidiApertura o avviaApertura usassero qualcosa di fuori (un
// import, una costante del modulo), nel testo copiato non esisterebbe e
// questi casi fallirebbero.
function apri({
  percorso = "/",
  tipo = "navigate" as string | null,
  segno = false,
  storageRotto = false,
} = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head><script>${SCRIPT_APERTURA}</script></head><body></body></html>`,
    {
      url: `https://nutritrack.test${percorso}`,
      runScripts: "dangerously",
      beforeParse(window) {
        window.sessionStorage.clear();
        if (segno) window.sessionStorage.setItem(CHIAVE_APERTURA, "1");
        if (storageRotto) {
          Object.defineProperty(window, "sessionStorage", {
            get() {
              throw new window.DOMException("accesso negato", "SecurityError");
            },
          });
        }
        window.performance.getEntriesByType = ((nome: string) =>
          nome === "navigation" && tipo !== null
            ? [{ type: tipo }]
            : []) as unknown as typeof window.performance.getEntriesByType;
      },
    }
  );
  return {
    attributo: () => dom.window.document.documentElement.getAttribute(ATTRIBUTO_APERTURA),
    segno: () => (storageRotto ? null : dom.window.sessionStorage.getItem(CHIAVE_APERTURA)),
  };
}

describe("SCRIPT_APERTURA in <head>", () => {
  it("primo caricamento: data-apertura=\"mostra\" e segno scritto", () => {
    const pagina = apri();
    expect(pagina.attributo()).toBe("mostra");
    expect(pagina.segno()).toBe("1");
  });

  it("segno presente: nessun attributo (il CSS tiene nascosto lo strato)", () => {
    expect(apri({ segno: true }).attributo()).toBeNull();
  });

  it("ricarica con il segno: mostra", () => {
    expect(apri({ segno: true, tipo: "reload" }).attributo()).toBe("mostra");
  });

  it("sessionStorage rotto: nessun attributo, la pagina va avanti", () => {
    expect(apri({ storageRotto: true }).attributo()).toBeNull();
  });

  it("fuori da Oggi: nessun attributo e nessun segno", () => {
    const pagina = apri({ percorso: "/login" });
    expect(pagina.attributo()).toBeNull();
    expect(pagina.segno()).toBeNull();
  });
});

describe("secondo livello: cambio scheda senza ricaricare", () => {
  it("falsa al primo montaggio, vera dopo segnaAperturaPassata", async () => {
    // Modulo fresco, come dopo un caricamento completo.
    vi.resetModules();
    const modulo = await import("./animazioneApertura");
    expect(modulo.aperturaGiaPassata()).toBe(false);
    // Leggere non cambia niente (React può fare due volte il primo disegno).
    expect(modulo.aperturaGiaPassata()).toBe(false);
    modulo.segnaAperturaPassata();
    expect(modulo.aperturaGiaPassata()).toBe(true);
  });
});
