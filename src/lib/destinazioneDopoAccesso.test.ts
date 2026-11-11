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
    // Solo /login e le sue sottopagine tornano alla home (test sotto), non
    // ogni percorso che inizia con le stesse lettere.
    ["/loginx", "/loginx"],
  ])("pagina dell'app %s → %s", (redirectTo, atteso) => {
    expect(destinazioneDopoAccesso(redirectTo, ORIGINE)).toBe(atteso);
  });

  // Dal 01/11/2026: dopo il blocco del doppio invio (login/page.tsx), il
  // pulsante si riattiva solo con un errore. Una navigazione verso Accedi
  // stessa lascerebbe la pagina dov'è, con "Attendere..." per sempre.
  it.each(["/login", "/login?redirectTo=/login", "/login/", "/login#x", `${ORIGINE}/login`])(
    "%s (Accedi stessa) → home",
    (redirectTo) => {
      expect(destinazioneDopoAccesso(redirectTo, ORIGINE)).toBe("/");
    }
  );

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
