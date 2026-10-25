// Dove gira il proxy (src/proxy.ts): il `matcher` del suo `config`.
//
// Un errore qui non fa rumore. Se un file del service worker finisse sotto
// il proxy, chi non ha fatto l'accesso riceverebbe un redirect a /login al
// posto di sw.js e l'installazione del service worker fallirebbe in
// silenzio: niente app offline. Se invece una pagina restasse fuori,
// sarebbe aperta senza accesso.
//
// La verifica la fa Next con la sua logica di confronto, non una copia
// nostra: unstable_doesMiddlewareMatch. In Next 16.3.3 c'è solo con il
// nome vecchio; la documentazione la chiama già unstable_doesProxyMatch.
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
  ])("%s resta fuori", (url) => {
    expect(passaDalProxy(url)).toBe(false);
  });

  it.each(["/", "/login", "/reimposta-password"])("%s passa dal proxy", (url) => {
    expect(passaDalProxy(url)).toBe(true);
  });
});
