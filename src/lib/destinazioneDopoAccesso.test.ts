// Test permanenti sulla destinazione dopo l'accesso (difetto del 18/10:
// Accedi accettava qualunque redirectTo che iniziasse con "/", anche
// "//esempio.com", e dopo l'accesso portava fuori dall'app).

import { describe, it, expect } from "vitest";
import { destinazioneDopoAccesso } from "./destinazioneDopoAccesso";

const ORIGINE = "https://app-libra.vercel.app";

describe("destinazioneDopoAccesso", () => {
  it.each([
    ["/impostazioni", "/impostazioni"],
    ["/aggiungi?giorno=2026-10-23", "/aggiungi?giorno=2026-10-23"],
    ["/impostazioni#tema", "/impostazioni#tema"],
  ])("pagina dell'app %s → %s", (redirectTo, atteso) => {
    expect(destinazioneDopoAccesso(redirectTo, ORIGINE)).toBe(atteso);
  });

  it.each([
    "//esempio.com",
    "/\\esempio.com",
    "https://esempio.com",
    "javascript:alert(1)",
    "",
    null,
  ])("%s → home", (redirectTo) => {
    expect(destinazioneDopoAccesso(redirectTo, ORIGINE)).toBe("/");
  });
});
