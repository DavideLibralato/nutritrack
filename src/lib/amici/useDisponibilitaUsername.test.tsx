// useDisponibilitaUsername: "Disponibile / già in uso" mentre si scrive.
// Test permanente (CLAUDE.md, race condition): con le risposte fuori ordine
// un "Disponibile" vecchio potrebbe coprire un "già in uso" nuovo, e
// l'utente scoprirebbe il problema solo all'invio. Il "server" è finto e
// risponde quando decide il test.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { ATTESA_MS, useDisponibilitaUsername } from "./useDisponibilitaUsername";
import type { Disponibilita } from "./nomiUtente";

// Un "server" che tiene in sospeso ogni domanda finché il test non risponde.
function serverFinto() {
  const domande: { nome: string; rispondi: (e: Disponibilita) => void }[] = [];
  const controlla = vi.fn(
    (nome: string) =>
      new Promise<Disponibilita>((resolve) => {
        domande.push({ nome, rispondi: resolve });
      })
  );
  return { controlla, domande };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useDisponibilitaUsername", () => {
  it("campo vuoto: nessuna domanda al server", () => {
    const { controlla } = serverFinto();
    const { result } = renderHook(() => useDisponibilitaUsername("  ", controlla));
    act(() => vi.advanceTimersByTime(ATTESA_MS * 2));
    expect(result.current).toBe("vuoto");
    expect(controlla).not.toHaveBeenCalled();
  });

  it("formato sbagliato: subito non_valido, senza chiedere al server", () => {
    const { controlla } = serverFinto();
    const { result } = renderHook(() => useDisponibilitaUsername("1ab", controlla));
    expect(result.current).toBe("non_valido");
    act(() => vi.advanceTimersByTime(ATTESA_MS * 2));
    expect(controlla).not.toHaveBeenCalled();
  });

  it("chiede il nome normalizzato dopo l'attesa e mostra la risposta", async () => {
    const { controlla, domande } = serverFinto();
    const { result } = renderHook(() => useDisponibilitaUsername(" Mario_T", controlla));
    expect(result.current).toBe("controllo");
    act(() => vi.advanceTimersByTime(ATTESA_MS - 1));
    expect(controlla).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(controlla).toHaveBeenCalledWith("mario_t");
    await act(async () => domande[0].rispondi("disponibile"));
    expect(result.current).toBe("disponibile");
  });

  it("mentre si scrive chiede una volta sola, per l'ultimo nome", () => {
    const { controlla } = serverFinto();
    const { rerender } = renderHook(({ v }) => useDisponibilitaUsername(v, controlla), {
      initialProps: { v: "mar" },
    });
    act(() => vi.advanceTimersByTime(ATTESA_MS / 2));
    rerender({ v: "mari" });
    act(() => vi.advanceTimersByTime(ATTESA_MS / 2));
    rerender({ v: "mario" });
    act(() => vi.advanceTimersByTime(ATTESA_MS));
    expect(controlla).toHaveBeenCalledTimes(1);
    expect(controlla).toHaveBeenCalledWith("mario");
  });

  it("una risposta vecchia arrivata tardi non copre quella del nome attuale", async () => {
    const { controlla, domande } = serverFinto();
    const { result, rerender } = renderHook(({ v }) => useDisponibilitaUsername(v, controlla), {
      initialProps: { v: "abc" },
    });
    act(() => vi.advanceTimersByTime(ATTESA_MS)); // domanda 0: "abc", lenta
    rerender({ v: "abcd" });
    act(() => vi.advanceTimersByTime(ATTESA_MS)); // domanda 1: "abcd"
    expect(domande.map((d) => d.nome)).toEqual(["abc", "abcd"]);

    await act(async () => domande[1].rispondi("in_uso"));
    expect(result.current).toBe("in_uso");
    await act(async () => domande[0].rispondi("disponibile"));
    expect(result.current).toBe("in_uso");
  });

  it("cambiato il nome, l'esito del precedente non resta a schermo", async () => {
    const { controlla, domande } = serverFinto();
    const { result, rerender } = renderHook(({ v }) => useDisponibilitaUsername(v, controlla), {
      initialProps: { v: "abc" },
    });
    act(() => vi.advanceTimersByTime(ATTESA_MS));
    await act(async () => domande[0].rispondi("disponibile"));
    expect(result.current).toBe("disponibile");
    rerender({ v: "abcd" });
    expect(result.current).toBe("controllo");
  });

  it("senza risposta dal server: errore, né libero né preso", async () => {
    const { controlla, domande } = serverFinto();
    const { result } = renderHook(() => useDisponibilitaUsername("mario", controlla));
    act(() => vi.advanceTimersByTime(ATTESA_MS));
    await act(async () => domande[0].rispondi("errore"));
    expect(result.current).toBe("errore");
  });
});
