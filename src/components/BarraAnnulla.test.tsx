// Il comportamento della BarraAnnulla non deve cambiare con l'aspetto: si
// chiude da sola dopo `durataMs`, ma non mentre il dito (o il fuoco) è sopra;
// quando se ne va il conto riprende da quanto restava (non da capo), e la
// linea del tempo con lui, dallo stesso punto.

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

  it("senza durataMs: 3 s con un'azione, 2,5 s senza (DURATE_BARRA)", () => {
    const conAzione = vi.fn();
    render(
      <BarraAnnulla
        testo="Aggiunto:"
        nome="Pane"
        azione={{ etichetta: "Annulla", onClick: () => {} }}
        onChiudi={conAzione}
      />
    );
    expect(screen.getByRole("status").style.getPropertyValue("--durata-barra")).toBe("3000ms");
    act(() => vi.advanceTimersByTime(2999));
    expect(conAzione).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(conAzione).toHaveBeenCalledTimes(1);
    cleanup();

    const frase = vi.fn();
    render(<BarraAnnulla testo="«Colazione» è già tra i preferiti." onChiudi={frase} />);
    expect(screen.getByRole("status").style.getPropertyValue("--durata-barra")).toBe("2500ms");
    act(() => vi.advanceTimersByTime(2499));
    expect(frase).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(frase).toHaveBeenCalledTimes(1);
  });

  it("in pausa timer e linea si fermano; dopo riprendono da quanto restava, insieme", () => {
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

    // In pausa la linea è ferma al punto in cui era: 600 ms già passati.
    expect(linea()).not.toBe(primaLinea);
    expect(linea().style.animationDelay).toBe("-600ms");

    fireEvent.pointerLeave(barra);
    expect(linea().style.animationPlayState).toBe("running");
    // La linea riparte dallo stesso punto (ritardo negativo di 600 ms su
    // 1000): le restano 400 ms, come al timer.
    expect(linea().style.animationDelay).toBe("-600ms");
    act(() => vi.advanceTimersByTime(399));
    expect(onChiudi).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onChiudi).toHaveBeenCalledTimes(1);
  });

  it("tocchi ripetuti non tengono aperta la barra", () => {
    const onChiudi = vi.fn();
    render(<BarraAnnulla testo="Salvato." icona="spunta" durataMs={1000} onChiudi={onChiudi} />);
    const barra = screen.getByRole("status");

    // Cinque tocchi brevi, 100 ms di dito ciascuno, ogni 200 ms.
    for (let i = 0; i < 5; i++) {
      act(() => vi.advanceTimersByTime(100));
      fireEvent.pointerEnter(barra);
      act(() => vi.advanceTimersByTime(100));
      fireEvent.pointerLeave(barra);
    }
    // 1000 ms passati, 500 in pausa: ne restano 500, non 1000.
    act(() => vi.advanceTimersByTime(499));
    expect(onChiudi).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onChiudi).toHaveBeenCalledTimes(1);
  });

  it("dito e fuoco insieme: riprende solo quando sono andati via tutti e due", () => {
    const onChiudi = vi.fn();
    render(
      <BarraAnnulla
        testo="Aggiunto:"
        nome="Pane"
        azione={{ etichetta: "Annulla", onClick: () => {} }}
        durataMs={1000}
        onChiudi={onChiudi}
      />
    );
    const barra = screen.getByRole("status");
    fireEvent.pointerEnter(barra);
    fireEvent.focus(screen.getByRole("button", { name: "Annulla" }));
    fireEvent.pointerLeave(barra);
    act(() => vi.advanceTimersByTime(5000));
    expect(onChiudi).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByRole("button", { name: "Annulla" }));
    act(() => vi.advanceTimersByTime(1000));
    expect(onChiudi).toHaveBeenCalledTimes(1);
  });

  it("la linea del tempo dura quanto la barra", () => {
    render(<BarraAnnulla testo="Annullato." icona="annulla" durataMs={8000} onChiudi={() => {}} />);
    const barra = screen.getByRole("status");
    expect(barra.style.getPropertyValue("--durata-barra")).toBe("8000ms");
  });
});

// Bug del 6/10 su iPhone, con "Vedi" e "Annulla" nella barra: il testo
// stava su una riga che non andava mai a capo e solo il nome poteva
// restringersi. Il nome spariva (larghezza zero) e la coda finiva sotto i
// pulsanti, tagliata: "Duplicato:  in Pranzo di lun 5". jsdom non misura i
// pixel, quindi qui si controlla come è fatta la barra: frase intera con
// spazi veri, che può andare a capo; nome accorciato solo oltre la
// larghezza del testo; pulsanti fuori dal testo, che non si restringono.
describe("BarraAnnulla: testo lungo con due pulsanti", () => {
  function barraLunga() {
    render(
      <BarraAnnulla
        testo="Duplicato:"
        nome="Yogurt greco intero biologico"
        coda="in Pranzo di lun 5 ott"
        azione={{ etichetta: "Annulla", onClick: () => {} }}
        azioneSecondaria={{ etichetta: "Vedi", onClick: () => {} }}
        onChiudi={() => {}}
      />
    );
    return screen.getByRole("status").querySelector("p")!;
  }

  it("la frase è intera, con gli spazi veri fra le parti (anche per lo screen reader)", () => {
    expect(barraLunga().textContent).toBe("Duplicato: Yogurt greco intero biologico in Pranzo di lun 5 ott");
  });

  it("il testo può andare a capo e il nome non può restringersi a zero", () => {
    const testo = barraLunga();
    expect(testo.className).not.toMatch(/whitespace-nowrap|\bflex\b/);
    const nome = testo.querySelector("span")!;
    expect(nome.textContent).toBe("Yogurt greco intero biologico");
    // inline-block largo al massimo quanto il testo: va a capo intero, e si
    // accorcia con "…" solo se da solo è più lungo di una riga.
    expect(nome.className).toMatch(/\binline-block\b/);
    expect(nome.className).toMatch(/\bmax-w-full\b/);
    expect(nome.className).toMatch(/\btruncate\b/);
  });

  it("«Vedi» e «Annulla» stanno fuori dal testo e non si restringono", () => {
    const testo = barraLunga();
    for (const nomePulsante of ["Vedi", "Annulla"]) {
      const pulsante = screen.getByRole("button", { name: nomePulsante });
      expect(testo.contains(pulsante)).toBe(false);
      expect(pulsante.className).toMatch(/\bshrink-0\b/);
    }
  });
});
