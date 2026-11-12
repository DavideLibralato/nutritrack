import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef } from "react";
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

// Con `zona`: scorre un elemento, non il documento, e alla chiusura è un
// elemento NUOVO (Aggiungi: la zona sotto la ricerca rinasce dopo il
// modulo). jsdom non tiene scrollTop: qui è finto, uno per elemento, e
// ogni scrittura si annota con l'elemento che l'ha ricevuta.
describe("useRitornoScorrimento con una zona che scorre", () => {
  const scorrimenti = new WeakMap<Element, number>();
  let scritture: { y: number; elemento: Element }[] = [];

  beforeEach(() => {
    scritture = [];
    Object.defineProperty(HTMLElement.prototype, "scrollTop", {
      configurable: true,
      get(this: HTMLElement) {
        return scorrimenti.get(this) ?? 0;
      },
      set(this: HTMLElement, y: number) {
        scorrimenti.set(this, y);
        scritture.push({ y, elemento: this });
      },
    });
  });

  afterEach(() => {
    delete (HTMLElement.prototype as { scrollTop?: number }).scrollTop;
  });

  function PaginaConZona({ aperto }: { aperto: boolean }) {
    const zona = useRef<HTMLDivElement | null>(null);
    useRitornoScorrimento(aperto, zona);
    // Le `key` diverse: la zona rinasce come elemento nuovo, come in
    // Aggiungi (senza, React riuserebbe lo stesso <div>).
    return aperto ? <div key="modulo">modulo</div> : <div key="zona" ref={zona} data-zona />;
  }

  function zona() {
    return document.querySelector("[data-zona]") as HTMLElement;
  }

  function scorriZona(y: number) {
    zona().scrollTop = y;
    fireEvent.scroll(zona());
    scritture = [];
  }

  it("rimette il punto sulla zona nuova, non sul documento", () => {
    const { rerender } = render(<PaginaConZona aperto={false} />);
    const vecchia = zona();
    scorriZona(600);

    rerender(<PaginaConZona aperto />);
    rerender(<PaginaConZona aperto={false} />);

    expect(zona()).not.toBe(vecchia);
    expect(scritture[0]).toEqual({ y: 600, elemento: zona() });
    expect(zona().scrollTop).toBe(600);
    expect(chiamate).toHaveLength(0);
  });

  // Come Aggiungi, che si apre con «Caricamento...»: la zona arriva al
  // secondo ridisegno, e l'ascolto deve agganciarsi lì (trovato scrivendo
  // il test di Aggiungi, 12/11: prima si cercava la zona solo quando
  // cambiava `aperto`).
  it("la zona arrivata dopo il primo ridisegno si annota lo stesso", () => {
    function PaginaCheCarica({ pronta, aperto }: { pronta: boolean; aperto: boolean }) {
      const zona = useRef<HTMLDivElement | null>(null);
      useRitornoScorrimento(aperto, zona);
      if (!pronta) return <p>Caricamento...</p>;
      return aperto ? <div key="modulo">modulo</div> : <div key="zona" ref={zona} data-zona />;
    }
    const { rerender } = render(<PaginaCheCarica pronta={false} aperto={false} />);
    rerender(<PaginaCheCarica pronta aperto={false} />);
    scorriZona(600);

    rerender(<PaginaCheCarica pronta aperto />);
    rerender(<PaginaCheCarica pronta aperto={false} />);

    expect(zona().scrollTop).toBe(600);
  });

  it("lo scroll della finestra non conta: si annota quello della zona", () => {
    const { rerender } = render(<PaginaConZona aperto={false} />);
    scorriZona(600);
    scorri(2000);

    rerender(<PaginaConZona aperto />);
    rerender(<PaginaConZona aperto={false} />);

    expect(zona().scrollTop).toBe(600);
  });

  it("il ricontrollo rimette la zona, e si ferma al tocco", () => {
    const { rerender } = render(<PaginaConZona aperto={false} />);
    scorriZona(600);
    rerender(<PaginaConZona aperto />);
    rerender(<PaginaConZona aperto={false} />);

    scorrimenti.set(zona(), 0);
    ridisegna();
    expect(zona().scrollTop).toBe(600);

    fireEvent.touchStart(window);
    scorrimenti.set(zona(), 150);
    ridisegna(3);
    expect(zona().scrollTop).toBe(150);
  });
});
