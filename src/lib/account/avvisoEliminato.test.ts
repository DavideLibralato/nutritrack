// Il segno ?eliminato= su Accedi (avvisoEliminato.ts): quale avviso, e
// l'indirizzo senza il segno, con il resto com'era.

import { describe, it, expect } from "vitest";
import { leggiAvvisoEliminato } from "./avvisoEliminato";

const ORIGINE = "https://app-libra.vercel.app";
const leggi = (percorso: string) => leggiAvvisoEliminato(ORIGINE + percorso);

describe("leggiAvvisoEliminato", () => {
  it("?eliminato=1: eliminato da qui, segno tolto", () => {
    expect(leggi("/login?eliminato=1")).toEqual({ avviso: { tipo: "qui" }, senzaSegno: "/login" });
  });

  it("?eliminato=altrove: eliminato da un altro dispositivo, senza modifiche perse", () => {
    expect(leggi("/login?eliminato=altrove")).toEqual({
      avviso: { tipo: "altrove", perse: false },
      senzaSegno: "/login",
    });
  });

  it("?eliminato=altrove&perse=1: con modifiche perse, tolti tutti e due", () => {
    expect(leggi("/login?eliminato=altrove&perse=1")).toEqual({
      avviso: { tipo: "altrove", perse: true },
      senzaSegno: "/login",
    });
  });

  it("gli altri parametri e il frammento restano", () => {
    expect(leggi("/login?redirectTo=%2Fimpostazioni&eliminato=1#x").senzaSegno).toBe(
      "/login?redirectTo=%2Fimpostazioni#x"
    );
  });

  it("perse vale solo con altrove", () => {
    expect(leggi("/login?eliminato=1&perse=1").avviso).toEqual({ tipo: "qui" });
  });

  it.each(["/login?eliminato=boh", "/login?eliminato=", "/login?perse=1"])(
    "%s: nessun avviso, ma il segno si toglie",
    (percorso) => {
      expect(leggi(percorso)).toEqual({ avviso: null, senzaSegno: "/login" });
    }
  );

  it("senza segno: niente da mostrare e niente da togliere", () => {
    expect(leggi("/login?redirectTo=%2F")).toEqual({ avviso: null, senzaSegno: null });
  });
});
