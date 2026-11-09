// Dove gira il proxy (src/proxy.ts): il `matcher` del suo `config`.
//
// Un errore qui non fa rumore. Se un file del service worker finisse sotto
// il proxy, chi non ha fatto l'accesso riceverebbe un redirect a /login al
// posto di sw.js e l'installazione del service worker fallirebbe in
// silenzio: niente app offline. Se invece una pagina restasse fuori,
// sarebbe aperta senza accesso.
//
// La verifica la fa Next con la sua logica di confronto, non una copia
// nostra: unstable_doesMiddlewareMatch. In Next 16.4.3 c'è ancora solo con
// il nome vecchio; la documentazione la chiama già unstable_doesProxyMatch.
// Quando Next la rinomina, si cambia qui.

import { describe, it, expect } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "./proxy";

function passaDalProxy(url: string): boolean {
  return unstable_doesMiddlewareMatch({ config, url });
}

describe("matcher del proxy", () => {
  it.each([
    "/sw.js",
    "/sw-strategia.js",
    "/offline.html",
    "/manifest.json",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    // Il WebAssembly del lettore dei codici a barre: un redirect a /login
    // al suo posto romperebbe la scansione.
    "/zxing/3.1.6/zxing_reader.wasm",
    // Il catalogo di Open Food Facts con la sua licenza: l'ODbL chiede di
    // offrirlo a chiunque, anche senza accesso.
    "/catalogo/catalogo-open-food-facts-odbl.json",
  ])("%s resta fuori", (url) => {
    expect(passaDalProxy(url)).toBe(false);
  });

  // Le pagine che contengono «catalogo» nel percorso restano protette:
  // fuori c'è solo la cartella /catalogo/ in cima.
  it.each(["/", "/login", "/reimposta-password", "/impostazioni/alimenti", "/catalogo"])("%s passa dal proxy", (url) => {
    expect(passaDalProxy(url)).toBe(true);
  });
});
