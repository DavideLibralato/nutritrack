import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup, fireEvent } from "@testing-library/react";
import { RIDISEGNI_DI_CONTROLLO, useRitornoScorrimento } from "./useRitornoScorrimento";

// Il ritorno al punto dell'elenco dopo una schermata a tutto schermo
// (useRitornoScorrimento; PUNTO_DI_PARTENZA.md §3, "Alimenti"). Test
// permanenti: nell'app installata su iPhone l'elenco ripartiva dall'inizio
// in silenzio (12/11). jsdom non calcola le altezze e non scorre: qui
// `scrollY` è finto, `scrollTo` lo cambia, e i ridisegni
// (requestAnimationFrame) si fanno avanzare a mano. Si controlla la
// logica; lo schermo vero si prova sull'iPhone.

let posizione = 0;
// Ogni scrollTo, con l'elenco presente o no nel documento in quel momento.
let chiamate: { y: number; elencoPresente: boolean }[] = [];
let ridisegniInCoda: FrameRequestCallback[] = [];

function scorri(y: number) {
  posizione = y;
  fireEvent.scroll(window);
}

function ridisegna(volte = 1) {
  for (let i = 0; i < volte; i++) {
    const coda = ridisegniInCoda;
    ridisegniInCoda = [];
    act(() => coda.forEach((f) => f(performance.now())));
  }
}

beforeEach(() => {
  posizione = 0;
  chiamate = [];
  ridisegniInCoda = [];
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => posizione });
  vi.spyOn(window, "scrollTo").mockImplementation(((x: number, y: number) => {
    chiamate.push({ y, elencoPresente: document.querySelector("[data-elenco]") !== null });
    posizione = y;
  }) as typeof window.scrollTo);
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => {
    ridisegniInCoda.push(f);
    return ridisegniInCoda.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    ridisegniInCoda = [];
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Come le pagine: con la schermata aperta l'elenco non c'è.
function Pagina({ aperto }: { aperto: boolean }) {
  useRitornoScorrimento(aperto);
  return aperto ? <div>schermata</div> : <ul data-elenco />;
}

describe("useRitornoScorrimento", () => {
  it("alla chiusura rimette il punto annotato, con l'elenco già nel documento", () => {
    const { rerender } = render(<Pagina aperto={false} />);
    scorri(1200);

    rerender(<Pagina aperto />);
    rerender(<Pagina aperto={false} />);

    expect(chiamate[0]).toEqual({ y: 1200, elencoPresente: true });
  });

  it("lo 0 dell'accorciamento all'apertura non cancella il punto", () => {
    const { rerender } = render(<Pagina aperto={false} />);
    scorri(1200);

    rerender(<Pagina aperto />);
    // Il documento si è accorciato: il browser porta lo scorrimento a 0.
    scorri(0);
    rerender(<Pagina aperto={false} />);

    expect(chiamate[0].y).toBe(1200);
  });

  it("al tocco `scrollY` vale già 0 (iOS): conta l'ultimo punto annotato", () => {
    const { rerender } = render(<Pagina aperto={false} />);
    scorri(800);
    // Lo scorrimento torna a 0 senza nessun evento, prima del tocco.
    posizione = 0;

    rerender(<Pagina aperto />);
    rerender(<Pagina aperto={false} />);

    expect(chiamate[0].y).toBe(800);
  });

  it("se qualcosa rimette a 0 subito dopo il recupero, il ricontrollo lo rimette", () => {
    const { rerender } = render(<Pagina aperto={false} />);
    scorri(1200);
    rerender(<Pagina aperto />);
    rerender(<Pagina aperto={false} />);

    posizione = 0; // come fa l'app installata su iPhone
    ridisegna();

    expect(chiamate).toHaveLength(2);
    expect(chiamate[1].y).toBe(1200);
    expect(window.scrollY).toBe(1200);
  });

  it("il ricontrollo si ferma al primo tocco dell'utente", () => {
    const { rerender } = render(<Pagina aperto={false} />);
    scorri(1200);
    rerender(<Pagina aperto />);
    rerender(<Pagina aperto={false} />);

    fireEvent.touchStart(window);
    posizione = 300; // l'utente scorre
    ridisegna(3);

    expect(chiamate).toHaveLength(1);
    expect(window.scrollY).toBe(300);
  });

  it("il ricontrollo dura un numero fisso di ridisegni, poi smette", () => {
    const { rerender } = render(<Pagina aperto={false} />);
    scorri(1200);
    rerender(<Pagina aperto />);
    rerender(<Pagina aperto={false} />);

    ridisegna(RIDISEGNI_DI_CONTROLLO);
    expect(ridisegniInCoda).toHaveLength(0);
    posizione = 0;
    ridisegna(3);

    expect(chiamate).toHaveLength(1);
  });

  it("senza una schermata aperta non tocca lo scorrimento", () => {
    const { rerender } = render(<Pagina aperto={false} />);
    scorri(1200);
    rerender(<Pagina aperto={false} />);
    ridisegna(3);

    expect(chiamate).toHaveLength(0);
  });
});
