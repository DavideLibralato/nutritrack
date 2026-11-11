// Test permanenti per il lettore dei codici a barre (lettoreCodice.ts).
//
// Il più importante è il primo: il file .wasm in /public si copia a mano
// da node_modules. Se si aggiorna barcode-detector e ci si dimentica di
// copiarlo, l'app servirebbe il WebAssembly vecchio alla libreria nuova:
// la scansione si romperebbe solo sul telefono, senza nessun errore nel
// build. Qui l'impronta (SHA-256) del file deve essere quella che la
// libreria installata dichiara, e la versione nel percorso quella vera.
//
// Gli altri proteggono la scelta del codice in un fotogramma: una lettura
// sbagliata (cifra di controllo che non torna) o di un formato non
// richiesto non deve aprire un prodotto.

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ZXING_WASM_SHA256, ZXING_WASM_VERSION } from "barcode-detector/ponyfill";
import { FORMATI, PERCORSO_WASM, VERSIONE_ZXING, primoCodiceValido } from "./lettoreCodice";

describe("il WebAssembly servito da /public", () => {
  it("la versione nel percorso è quella di zxing-wasm installata", () => {
    expect(VERSIONE_ZXING).toBe(ZXING_WASM_VERSION);
    expect(PERCORSO_WASM).toBe(`/zxing/${ZXING_WASM_VERSION}/zxing_reader.wasm`);
  });

  it("il file in public/ è proprio quello della libreria installata (stessa impronta)", () => {
    const file = readFileSync(path.join(process.cwd(), "public", PERCORSO_WASM));
    expect(createHash("sha256").update(file).digest("hex")).toBe(ZXING_WASM_SHA256);
  });
});

describe("primoCodiceValido", () => {
  it("legge EAN-13, EAN-8 e UPC-A; l'UPC-A diventa 13 cifre", () => {
    expect(primoCodiceValido([{ format: "ean_13", rawValue: "3017620422003" }])).toBe(
      "3017620422003"
    );
    expect(primoCodiceValido([{ format: "ean_8", rawValue: "96385074" }])).toBe("96385074");
    expect(primoCodiceValido([{ format: "upc_a", rawValue: "036000291452" }])).toBe(
      "0036000291452"
    );
    expect(FORMATI).toEqual(["ean_13", "ean_8", "upc_a"]);
  });

  it("scarta una lettura con la cifra di controllo sbagliata e prende la valida dopo", () => {
    expect(
      primoCodiceValido([
        { format: "ean_13", rawValue: "3017620422004" },
        { format: "ean_8", rawValue: "96385074" },
      ])
    ).toBe("96385074");
  });

  it("ignora i formati non richiesti, anche se sono numeri validi", () => {
    expect(primoCodiceValido([{ format: "itf", rawValue: "3017620422003" }])).toBeNull();
    expect(primoCodiceValido([{ format: "qr_code", rawValue: "96385074" }])).toBeNull();
  });

  it("nessun codice nel fotogramma: null", () => {
    expect(primoCodiceValido([])).toBeNull();
  });
});
