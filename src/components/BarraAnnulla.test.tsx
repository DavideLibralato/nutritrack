// Il comportamento della BarraAnnulla non deve cambiare con l'aspetto: si
// chiude da sola dopo `durataMs`, ma non mentre il dito (o il fuoco) è sopra;
// quando se ne va il conto riparte da capo, e la linea del tempo con lui.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import BarraAnnulla from "./BarraAnnulla";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function linea(): HTMLElement {
  return document.querySelector(".linea-tempo") as HTMLElement;
}

describe("BarraAnnulla", () => {
  it("si chiude da sola dopo durataMs", () => {
    const onChiudi = vi.fn();
    render(<BarraAnnulla testo="Salvato." icona="spunta" durataMs={2500} onChiudi={onChiudi} />);

    act(() => vi.advanceTimersByTime(2499));
    expect(onChiudi).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onChiudi).toHaveBeenCalledTimes(1);
  });

  it("senza durataMs: 5 s con un'azione, 4 s senza (DURATE_BARRA)", () => {
    const conAzione = vi.fn();
    render(
      <BarraAnnulla
        testo="Aggiunto:"
        nome="Pane"
        azione={{ etichetta: "Annulla", onClick: () => {} }}
        onChiudi={conAzione}
      />
    );
    expect(screen.getByRole("status").style.getPropertyValue("--durata-barra")).toBe("5000ms");
    act(() => vi.advanceTimersByTime(4999));
    expect(conAzione).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(conAzione).toHaveBeenCalledTimes(1);
    cleanup();

    const frase = vi.fn();
    render(<BarraAnnulla testo="«Colazione» è già tra i preferiti." onChiudi={frase} />);
    expect(screen.getByRole("status").style.getPropertyValue("--durata-barra")).toBe("4000ms");
    act(() => vi.advanceTimersByTime(3999));
    expect(frase).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(frase).toHaveBeenCalledTimes(1);
  });

  it("in pausa il timer e la linea si fermano; dopo, ripartono da capo", () => {
    const onChiudi = vi.fn();
    render(
      <BarraAnnulla
        testo="Aggiunto:"
        nome="Gallette di mais"
        icona="spunta"
        azione={{ etichetta: "Annulla", onClick: () => {} }}
        durataMs={1000}
        onChiudi={onChiudi}
      />
    );
    const barra = screen.getByRole("status");
    const primaLinea = linea();

    act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerEnter(barra);
    expect(linea().style.animationPlayState).toBe("paused");
    act(() => vi.advanceTimersByTime(5000));
    expect(onChiudi).not.toHaveBeenCalled();

    fireEvent.pointerLeave(barra);
    expect(linea().style.animationPlayState).toBe("running");
    // Una linea nuova (la `key` è cambiata): riparte da piena.
    expect(linea()).not.toBe(primaLinea);
    // Il conto riparte da capo: non bastano i 400 ms che mancavano prima.
    act(() => vi.advanceTimersByTime(999));
    expect(onChiudi).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onChiudi).toHaveBeenCalledTimes(1);
  });

  it("la linea del tempo dura quanto la barra", () => {
    render(<BarraAnnulla testo="Annullato." icona="annulla" durataMs={8000} onChiudi={() => {}} />);
    const barra = screen.getByRole("status");
    expect(barra.style.getPropertyValue("--durata-barra")).toBe("8000ms");
  });
});
