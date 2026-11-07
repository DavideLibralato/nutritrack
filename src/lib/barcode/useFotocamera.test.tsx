// Test permanenti per useFotocamera (useFotocamera.ts), con una
// getUserMedia finta. Una fotocamera rimasta accesa non dà nessun errore:
// consuma batteria e tiene accesa la spia verde dell'iPhone, e nessun test
// visivo lo vede. Qui:
// - si spegne (tutti i track fermati) alla chiusura e in secondo piano;
// - al ritorno in primo piano NON si riaccende da sola;
// - un permesso che arriva dopo la chiusura, o dopo un ferma(), non lascia
//   una fotocamera accesa che nessuno vede (la corsa più insidiosa: il
//   popup del permesso resta aperto secondi);
// - permesso negato e fotocamera assente danno i loro stati.

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFotocamera } from "./useFotocamera";

interface TracciaFinta {
  stop: ReturnType<typeof vi.fn>;
  getCapabilities: () => { torch?: boolean };
  applyConstraints: ReturnType<typeof vi.fn>;
}

function streamFinto(torcia = false) {
  const traccia: TracciaFinta = {
    stop: vi.fn(),
    getCapabilities: () => (torcia ? { torch: true } : {}),
    applyConstraints: vi.fn(async () => {}),
  };
  const stream = {
    getTracks: () => [traccia],
    getVideoTracks: () => [traccia],
  } as unknown as MediaStream;
  return { stream, traccia };
}

// getUserMedia che risponde quando il test lo decide.
function permessoInSospeso() {
  let rispondi!: (s: MediaStream) => void;
  let rifiuta!: (e: unknown) => void;
  const getUserMedia = vi.fn(
    () =>
      new Promise<MediaStream>((ok, ko) => {
        rispondi = ok;
        rifiuta = ko;
      })
  );
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  return { getUserMedia, rispondi: (s: MediaStream) => rispondi(s), rifiuta: (e: unknown) => rifiuta(e) };
}

function impostaVisibilita(stato: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => stato });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});

async function accesa() {
  const permesso = permessoInSospeso();
  const { stream, traccia } = streamFinto();
  const hook = renderHook(() => useFotocamera());
  act(() => hook.result.current.avvia());
  expect(hook.result.current.stato).toBe("avvio");
  await act(async () => permesso.rispondi(stream));
  expect(hook.result.current.stato).toBe("attiva");
  return { hook, traccia, permesso };
}

describe("useFotocamera", () => {
  it("chiede la fotocamera posteriore, senza audio", async () => {
    const { permesso } = await accesa();
    expect(permesso.getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
  });

  it("alla chiusura della schermata si spegne", async () => {
    const { hook, traccia } = await accesa();
    hook.unmount();
    expect(traccia.stop).toHaveBeenCalled();
  });

  it("in secondo piano si spegne e resta in pausa; al ritorno non si riaccende da sola", async () => {
    const { hook, traccia, permesso } = await accesa();

    act(() => impostaVisibilita("hidden"));
    expect(traccia.stop).toHaveBeenCalled();
    expect(hook.result.current.stato).toBe("in-pausa");

    act(() => impostaVisibilita("visible"));
    expect(hook.result.current.stato).toBe("in-pausa");
    expect(permesso.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("anche pagehide (l'app che si chiude) la spegne", async () => {
    const { traccia } = await accesa();
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(traccia.stop).toHaveBeenCalled();
  });

  it("permesso arrivato dopo la chiusura della schermata: lo stream si spegne subito", async () => {
    const permesso = permessoInSospeso();
    const { stream, traccia } = streamFinto();
    const hook = renderHook(() => useFotocamera());
    act(() => hook.result.current.avvia());

    hook.unmount();
    await act(async () => permesso.rispondi(stream));

    expect(traccia.stop).toHaveBeenCalled();
  });

  it("permesso arrivato dopo il secondo piano: spento, e lo stato resta in pausa", async () => {
    const permesso = permessoInSospeso();
    const { stream, traccia } = streamFinto();
    const hook = renderHook(() => useFotocamera());
    act(() => hook.result.current.avvia());

    act(() => impostaVisibilita("hidden"));
    await act(async () => permesso.rispondi(stream));

    expect(traccia.stop).toHaveBeenCalled();
    expect(hook.result.current.stato).toBe("in-pausa");
  });

  it("dopo una pausa, avvia() (il tocco su Riattiva) la riaccende", async () => {
    const { hook } = await accesa();
    act(() => hook.result.current.ferma());
    expect(hook.result.current.stato).toBe("in-pausa");

    const permesso = permessoInSospeso();
    act(() => hook.result.current.avvia());
    await act(async () => permesso.rispondi(streamFinto().stream));
    expect(hook.result.current.stato).toBe("attiva");
  });

  it("permesso negato: negata, e un ferma() non la fa diventare «in pausa»", async () => {
    const permesso = permessoInSospeso();
    const hook = renderHook(() => useFotocamera());
    act(() => hook.result.current.avvia());
    await act(async () => permesso.rifiuta(new DOMException("no", "NotAllowedError")));
    expect(hook.result.current.stato).toBe("negata");

    act(() => hook.result.current.ferma());
    expect(hook.result.current.stato).toBe("negata");
  });

  it("senza fotocamera (o senza getUserMedia): non disponibile", async () => {
    const hook = renderHook(() => useFotocamera());
    act(() => hook.result.current.avvia());
    expect(hook.result.current.stato).toBe("non-disponibile");

    const permesso = permessoInSospeso();
    act(() => hook.result.current.avvia());
    await act(async () => permesso.rifiuta(new DOMException("nessuna", "NotFoundError")));
    expect(hook.result.current.stato).toBe("non-disponibile");
  });

  it("la torcia c'è solo se la fotocamera la offre", async () => {
    const { hook } = await accesa();
    expect(hook.result.current.torciaDisponibile).toBe(false);

    const permesso = permessoInSospeso();
    const { stream, traccia } = streamFinto(true);
    act(() => hook.result.current.avvia());
    await act(async () => permesso.rispondi(stream));
    expect(hook.result.current.torciaDisponibile).toBe(true);

    await act(async () => hook.result.current.cambiaTorcia());
    expect(traccia.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    expect(hook.result.current.torciaAccesa).toBe(true);
  });
});
