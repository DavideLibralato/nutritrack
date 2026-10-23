// La pagina Registrati (dal 17/10, onboarding). Dopo "Crea account" con la
// sessione si va a /onboarding con un caricamento COMPLETO della pagina,
// non con la navigazione interna di Next.js: la sessione nasce sul server,
// nei cookie, e i componenti del layout radice montati qui senza utente
// (la sincronizzazione, le riprese) non ricevono nessun evento. Con la
// navigazione interna restavano senza utente, la discesa non riusciva mai
// e /onboarding restava su "Caricamento..." (prove su iPhone del 17/10).
// Finti: la Server Action, il caricamento completo, il router (spia, non
// deve servire). Dal branch username-dopo-accesso la pagina non ha più il
// campo Username: con lui sono spariti il controllo mentre si scrive e il
// test "username preso all'invio".

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import RegisterPage from "./page";
import type { StatoRegistrazione } from "@/lib/actions/auth";

const finti = vi.hoisted(() => ({
  risposta: null as unknown as StatoRegistrazione,
  registrati: vi.fn(),
  carica: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/actions/auth", () => ({
  registrati: async (...args: unknown[]) => {
    finti.registrati(...args);
    return finti.risposta;
  },
}));
vi.mock("@/lib/caricamentoCompleto", () => ({ caricaPaginaDaCapo: (p: string) => finti.carica(p) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: finti.push, replace: finti.replace, refresh: () => {} }),
}));

const VALORI = { nome: "Giulia", email: "giulia@esempio.it" };

beforeEach(() => {
  finti.registrati.mockReset();
  finti.carica.mockReset();
  finti.push.mockReset();
  finti.replace.mockReset();
});

afterEach(cleanup);

function creaAccount() {
  fireEvent.click(screen.getByRole("button", { name: "Crea account" }));
}

describe("Registrati", () => {
  it("registrato con la sessione: caricamento completo di /onboarding, niente router di Next", async () => {
    finti.risposta = { errore: null, messaggio: null, valori: VALORI, registrato: true };
    render(<RegisterPage />);

    creaAccount();

    await waitFor(() => expect(finti.carica).toHaveBeenCalledWith("/onboarding"));
    expect(finti.carica).toHaveBeenCalledTimes(1);
    expect(finti.push).not.toHaveBeenCalled();
    expect(finti.replace).not.toHaveBeenCalled();
    // Mentre la pagina si ricarica non si può inviare di nuovo.
    expect((screen.getByRole("button", { name: "Attendere..." }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("senza sessione: il messaggio, e nessun caricamento", async () => {
    finti.risposta = {
      errore: null,
      messaggio: "Account creato: controlla la tua email per confermarlo prima di accedere.",
      valori: VALORI,
    };
    render(<RegisterPage />);

    creaAccount();

    expect(
      await screen.findByText("Account creato: controlla la tua email per confermarlo prima di accedere.")
    ).toBeTruthy();
    expect(finti.carica).not.toHaveBeenCalled();
  });

  it("con un errore: il messaggio, e nessun caricamento", async () => {
    finti.risposta = { errore: "Codice di invito non valido.", messaggio: null, valori: VALORI };
    render(<RegisterPage />);

    creaAccount();

    expect(await screen.findByText("Codice di invito non valido.")).toBeTruthy();
    expect(finti.carica).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crea account" })).toBeTruthy();
  });
});
