// La pagina Accedi: dopo l'accesso si torna alla pagina da cui il
// middleware ci ha mandato qui (?redirectTo=/impostazioni), ma solo se è
// una pagina dell'app. Difetto trovato in revisione il 18/10, già in
// produzione: bastava che redirectTo iniziasse con "/", quindi passava
// anche "//esempio.com", che il browser legge come un altro sito.
// router.push di Next (16.3.3, app-router-instance.js) risolve l'indirizzo
// con new URL(href, location.href) e, se l'origine è diversa da quella
// dell'app, esce con una navigazione completa (location.assign). Qui il
// router è finto: la destinazione si calcola nello stesso modo.
// Finti anche il client Supabase (accesso sempre riuscito) e i parametri
// dell'indirizzo.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import LoginPage from "./page";

const finti = vi.hoisted(() => ({
  query: "",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: finti.push, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(finti.query),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword: async () => ({ error: null }) } }),
}));

beforeEach(() => {
  finti.push.mockReset();
});

afterEach(cleanup);

async function accediCon(query: string): Promise<URL> {
  finti.query = query;
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "giulia@esempio.it" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "segreta123" } });
  fireEvent.click(screen.getByRole("button", { name: "Accedi" }));
  await waitFor(() => expect(finti.push).toHaveBeenCalledTimes(1));
  return new URL(finti.push.mock.calls[0][0], window.location.href);
}

// Il riquadro "Account eliminato" (avvisoEliminato.ts): il testo giusto per
// chi ha eliminato da qui e per chi è stato eliminato da un altro
// dispositivo, la riga sulle modifiche perse solo quando c'erano, e il
// segno tolto dall'indirizzo appena letto (un ricaricamento non lo rimostra).
describe("Accedi, riquadro Account eliminato", () => {
  const TESTO_QUI = "I tuoi dati sono stati cancellati dal server e da questo telefono.";
  const TESTO_ALTROVE = "Questo account non esiste più. I suoi dati sono stati tolti anche da questo telefono.";
  const RIGA_PERSE = "Le modifiche non ancora salvate sul server sono andate perse.";

  function apri(percorso: string) {
    window.history.replaceState(null, "", percorso);
    finti.query = new URL(percorso, window.location.origin).search.slice(1);
    render(<LoginPage />);
  }

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("?eliminato=1: il testo di chi ha eliminato da qui, segno tolto", async () => {
    apri("/login?eliminato=1");
    expect(await screen.findByText(TESTO_QUI)).toBeTruthy();
    expect(screen.queryByText(TESTO_ALTROVE)).toBeNull();
    expect(screen.queryByText(RIGA_PERSE)).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("?eliminato=altrove senza modifiche: il testo nuovo, senza la riga delle modifiche", async () => {
    apri("/login?eliminato=altrove");
    expect(await screen.findByText(TESTO_ALTROVE)).toBeTruthy();
    expect(screen.getByText("Account eliminato")).toBeTruthy();
    expect(screen.queryByText(RIGA_PERSE)).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("?eliminato=altrove&perse=1: anche la riga delle modifiche perse, tutti e due i segni tolti", async () => {
    apri("/login?eliminato=altrove&perse=1");
    expect(await screen.findByText(TESTO_ALTROVE)).toBeTruthy();
    expect(screen.getByText(RIGA_PERSE)).toBeTruthy();
    expect(window.location.search).toBe("");
  });

  it("senza segno: nessun riquadro", async () => {
    apri("/login");
    await screen.findByRole("button", { name: "Accedi" });
    expect(screen.queryByText("Account eliminato")).toBeNull();
  });
});

describe("Accedi, destinazione dopo l'accesso", () => {
  it("torna alla pagina protetta da cui arrivava", async () => {
    const dest = await accediCon("redirectTo=%2Fimpostazioni");
    expect(dest.origin).toBe(window.location.origin);
    expect(dest.pathname).toBe("/impostazioni");
  });

  it("senza redirectTo va alla home", async () => {
    const dest = await accediCon("");
    expect(dest.origin).toBe(window.location.origin);
    expect(dest.pathname).toBe("/");
  });

  it.each(["//esempio.com", "/\\esempio.com", "https://esempio.com"])(
    "redirectTo=%s non porta fuori dall'app",
    async (redirectTo) => {
      const dest = await accediCon(`redirectTo=${encodeURIComponent(redirectTo)}`);
      expect(dest.origin).toBe(window.location.origin);
      expect(dest.pathname).toBe("/");
    }
  );
});
