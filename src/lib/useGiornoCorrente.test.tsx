// useGiornoCorrente: l'oggi del calendario si aggiorna da solo a mezzanotte
// e al ritorno in primo piano (PUNTO_DI_PARTENZA.md, sezione 3,
// "Inserimento retroattivo"). Test permanente: se il timer o l'ascolto di
// `visibilitychange` si rompono non lo dice nessuno, la pagina resta
// semplicemente su ieri finché qualcosa la ridisegna per altri motivi.

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useGiornoCorrente } from "./useGiornoCorrente";
import { msAllaMezzanotte } from "./dataGiorno";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// jsdom non mostra la pagina: lo stato di visibilità si finge a mano.
function visibilita(stato: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: stato, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("msAllaMezzanotte", () => {
  it("conta fino alla mezzanotte locale, anche nei giorni del cambio d'ora", () => {
    expect(msAllaMezzanotte(new Date(2026, 9, 10, 23, 59, 30))).toBe(30_000);
    // 25/10/2026: il giorno ha 25 ore. Alle 00:30 alla mezzanotte mancano
    // 24 h e 30 min, non 23 h e 30 min.
    expect(msAllaMezzanotte(new Date(2026, 9, 25, 0, 30, 0))).toBe((24 * 60 + 30) * 60_000);
  });
});

describe("useGiornoCorrente", () => {
  it("a mezzanotte passa al giorno nuovo da solo, e così anche la notte dopo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10, 23, 59, 30));
    const { result } = renderHook(() => useGiornoCorrente());
    expect(result.current).toBe("2026-10-10");

    act(() => vi.advanceTimersByTime(29_000));
    expect(result.current).toBe("2026-10-10");
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe("2026-10-11");

    // Il timer si è riprogrammato: la mezzanotte dopo scatta di nuovo.
    act(() => vi.advanceTimersByTime(24 * 60 * 60_000));
    expect(result.current).toBe("2026-10-12");
  });

  it("al ritorno in primo piano si accorge del giorno cambiato in background", () => {
    // Solo l'orologio: i timer veri non scattano nel test, come quelli di
    // un'app sospesa da iOS.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 10, 22, 0, 0));
    const { result } = renderHook(() => useGiornoCorrente());
    visibilita("hidden");

    vi.setSystemTime(new Date(2026, 9, 11, 7, 30, 0));
    expect(result.current).toBe("2026-10-10");
    act(() => visibilita("visible"));
    expect(result.current).toBe("2026-10-11");
  });

  it("andando in background non cambia niente", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 10, 22, 0, 0));
    const { result } = renderHook(() => useGiornoCorrente());

    vi.setSystemTime(new Date(2026, 9, 11, 7, 30, 0));
    act(() => visibilita("hidden"));
    expect(result.current).toBe("2026-10-10");
  });
});
