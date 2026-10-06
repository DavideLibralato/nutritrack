// Test permanenti sull'hook del tieni-premuto (tieniPremuto.ts), su una
// lista minima e con l'orologio finto: niente attese vere, niente casualità.
// Due bug trovati il 6/10 cercando quello del menu chiuso con un tocco fuori
// (che ha il suo test sulla pagina Oggi, src/app/(app)/page.test.tsx):
// 1. un gesto rimasto aperto perché la fine del tocco non è mai arrivata
//    (Safari) spegneva il tieni-premuto per sempre: ogni nuovo tocco veniva
//    scartato come "secondo dito";
// 2. un timer scattato una frazione di millisecondo prima della scadenza
//    lasciava il gesto fermo: la riga non si sollevava, o il menu non si
//    apriva, finché il dito non si alzava.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { useTieniPremuto, type RigaPremuta } from "./tieniPremuto";
import { DURATA_PRESSIONE_MS, FINESTRA_DECISIONE_MS } from "./decisioneTieniPremuto";

function Lista({ onMenu }: { onMenu: (riga: RigaPremuta) => void }) {
  const { rif } = useTieniPremuto({ attivo: true, onMenu });
  return (
    <ul ref={rif}>
      <li>
        <button type="button" data-tieni-premuto="voce" data-id="voce-1">
          Pane
        </button>
      </li>
    </ul>
  );
}

// L'orologio del gesto (performance.now) segue quello finto dei timer, più
// uno scarto regolabile per simulare un timer in anticipo.
let scarto = 0;
beforeEach(() => {
  vi.useFakeTimers();
  scarto = 0;
  vi.spyOn(performance, "now").mockImplementation(() => Date.now() - scarto);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function puntatore(tipo: string, el: Element, pointerId: number, x = 50, y = 50) {
  fireEvent(
    el,
    new PointerEvent(tipo, {
      bubbles: true,
      cancelable: true,
      pointerId,
      isPrimary: true,
      pointerType: "touch",
      button: 0,
      clientX: x,
      clientY: y,
    })
  );
}

function avanza(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function prepara() {
  const onMenu = vi.fn();
  const { container } = render(<Lista onMenu={onMenu} />);
  const riga = container.querySelector("button")!;
  const lista = container.querySelector("ul")!;
  return { onMenu, riga, lista };
}

describe("un gesto rimasto aperto non blocca il tocco dopo", () => {
  it("trascinamento senza fine del tocco: il nuovo tieni-premuto apre il menu", () => {
    const { onMenu, riga, lista } = prepara();

    // Tieni premuto, poi muovi: ramo trascinamento. Il pointerup non arriva.
    puntatore("pointerdown", riga, 1);
    avanza(DURATA_PRESSIONE_MS);
    puntatore("pointermove", lista, 1, 50, 80);
    expect(lista.style.overflowY).toBe("hidden");

    // Un nuovo primo dito: quello di prima è finito per forza.
    puntatore("pointerdown", riga, 2);
    expect(lista.style.overflowY).toBe("");
    avanza(DURATA_PRESSIONE_MS + FINESTRA_DECISIONE_MS);

    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it("un secondo dito con il primo ancora giù resta ignorato", () => {
    const { onMenu, riga } = prepara();

    puntatore("pointerdown", riga, 1);
    fireEvent(
      riga,
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 2,
        isPrimary: false,
        pointerType: "touch",
        button: 0,
      })
    );
    avanza(DURATA_PRESSIONE_MS + FINESTRA_DECISIONE_MS);

    // Il gesto del primo dito va avanti e apre il menu una volta sola.
    expect(onMenu).toHaveBeenCalledTimes(1);
  });
});

describe("timer in anticipo", () => {
  it("la riga si solleva e il menu si apre anche se il timer scatta 0,5 ms prima", () => {
    const { onMenu, riga, lista } = prepara();

    puntatore("pointerdown", riga, 1);
    // Il timer scatta quando l'orologio del gesto segna 449,5 ms.
    scarto = 0.5;
    avanza(DURATA_PRESSIONE_MS);
    scarto = 0;
    avanza(1);
    expect(lista.style.overflowY).toBe("hidden"); // sollevata

    scarto = 0.5;
    avanza(FINESTRA_DECISIONE_MS);
    scarto = 0;
    avanza(1);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });
});
