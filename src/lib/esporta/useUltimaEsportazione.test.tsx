// L'hook del promemoria (useUltimaEsportazione.ts) da solo, senza una
// pagina intorno: nelle pagine altri ridisegni (le letture di Dexie)
// nascondono un hook che non si aggiorna. Qui l'unico motivo per
// ridisegnare è l'avviso di segnaEsportazione / togliUltimaEsportazione.

import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useUltimaEsportazione } from "./useUltimaEsportazione";
import { segnaEsportazione, togliUltimaEsportazione } from "./ultimaEsportazione";

beforeEach(() => {
  window.localStorage.clear();
});

describe("useUltimaEsportazione", () => {
  it("si aggiorna da solo quando la data viene segnata o tolta", () => {
    const { result } = renderHook(() => useUltimaEsportazione("u1"));
    expect(result.current).toBe("Mai esportato");

    act(() => segnaEsportazione("u1"));
    expect(result.current).toBe("Ultima esportazione: oggi");

    act(() => togliUltimaEsportazione("u1"));
    expect(result.current).toBe("Mai esportato");
  });

  it("segue il cambio di utente; senza utente, niente", () => {
    segnaEsportazione("u1");
    const { result, rerender } = renderHook(({ userId }) => useUltimaEsportazione(userId), {
      initialProps: { userId: "u1" as string | null },
    });
    expect(result.current).toBe("Ultima esportazione: oggi");
    rerender({ userId: "u2" });
    expect(result.current).toBe("Mai esportato");
    rerender({ userId: null });
    expect(result.current).toBeUndefined();
  });
});
