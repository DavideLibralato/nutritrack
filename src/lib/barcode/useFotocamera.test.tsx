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
import { richiediFotocamera, statoDaErrore, useFotocamera } from "./useFotocamera";

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
  return {
    getUserMedia,
    rispondi: (s: MediaStream) => rispondi(s),
    rifiuta: (e: unknown) => rifiuta(e),
  };
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

// Dal difetto del 07/11 (app installata, iOS 18.7: sempre "permesso
// negato", senza che iOS lo chiedesse). La richiesta parte nel gestore del
// tocco e la schermata la riceve già partita; l'errore vero si legge sotto
// il messaggio. Proteggono quello che la prossima volta non si vedrebbe:
// una richiesta rifatta dall'hook (fuori dal tocco), e un errore tradotto
// male, o senza il suo nome.
describe("richiesta già partita al tocco", () => {
  it("richiediFotocamera chiama getUserMedia subito, in modo sincrono", () => {
    const permesso = permessoInSospeso();
    const richiesta = richiediFotocamera();
    expect(permesso.getUserMedia).toHaveBeenCalledTimes(1);
    expect(richiesta).toBeInstanceOf(Promise);
  });

  it("richiediFotocamera senza getUserMedia: null, e nessun errore", () => {
    expect(richiediFotocamera()).toBeNull();
  });

  it("avvia(richiesta) usa quella già partita e non ne chiede un'altra", async () => {
    const permesso = permessoInSospeso();
    const richiesta = richiediFotocamera();
    const hook = renderHook(() => useFotocamera());

    act(() => hook.result.current.avvia(richiesta));
    await act(async () => permesso.rispondi(streamFinto().stream));

    expect(permesso.getUserMedia).toHaveBeenCalledTimes(1);
    expect(hook.result.current.stato).toBe("attiva");
  });

  // Il percorso nuovo della corsa "permesso arrivato tardi": la richiesta
  // è partita nel tocco, fuori dall'hook, e risponde dopo la chiusura o il
  // secondo piano. Lo stream non deve restare acceso.
  it("richiesta già partita, schermata chiusa prima della risposta: lo stream si spegne", async () => {
    const permesso = permessoInSospeso();
    const richiesta = richiediFotocamera();
    const { stream, traccia } = streamFinto();
    const hook = renderHook(() => useFotocamera());
    act(() => hook.result.current.avvia(richiesta));

    hook.unmount();
    await act(async () => permesso.rispondi(stream));

    expect(traccia.stop).toHaveBeenCalled();
  });

  it("richiesta già partita, app in secondo piano prima della risposta: spento, in pausa", async () => {
    const permesso = permessoInSospeso();
    const richiesta = richiediFotocamera();
    const { stream, traccia } = streamFinto();
    const hook = renderHook(() => useFotocamera());
    act(() => hook.result.current.avvia(richiesta));

    act(() => impostaVisibilita("hidden"));
    await act(async () => permesso.rispondi(stream));

    expect(traccia.stop).toHaveBeenCalled();
    expect(hook.result.current.stato).toBe("in-pausa");
  });

  it("un rifiuto della richiesta già partita: stato e nome tecnico dell'errore", async () => {
    const permesso = permessoInSospeso();
    const richiesta = richiediFotocamera();
    const hook = renderHook(() => useFotocamera());

    act(() => hook.result.current.avvia(richiesta));
    await act(async () =>
      permesso.rifiuta(
        new DOMException("The request is not allowed by the user agent", "NotAllowedError")
      )
    );

    expect(hook.result.current.stato).toBe("negata");
    expect(hook.result.current.erroreTecnico).toBe(
      "NotAllowedError: The request is not allowed by the user agent"
    );
  });

  it("senza getUserMedia il nome tecnico lo dice", () => {
    const hook = renderHook(() => useFotocamera());
    act(() => hook.result.current.avvia(null));
    expect(hook.result.current.stato).toBe("non-disponibile");
    expect(hook.result.current.erroreTecnico).toBe("navigator.mediaDevices.getUserMedia assente");
  });

  it("un nuovo avvio cancella il nome tecnico di prima", async () => {
    const primo = permessoInSospeso();
    const hook = renderHook(() => useFotocamera());
    act(() => hook.result.current.avvia());
    await act(async () => primo.rifiuta(new DOMException("", "NotReadableError")));
    expect(hook.result.current.erroreTecnico).toBe("NotReadableError");

    permessoInSospeso();
    act(() => hook.result.current.avvia());
    expect(hook.result.current.erroreTecnico).toBeNull();
  });
});

describe("statoDaErrore", () => {
  it.each([
    ["NotAllowedError", "negata"],
    ["SecurityError", "negata"],
    ["NotFoundError", "non-disponibile"],
    ["NotReadableError", "non-disponibile"],
    ["OverconstrainedError", "non-disponibile"],
    ["AbortError", "non-disponibile"],
  ])("%s → %s, con il nome", (nome, stato) => {
    expect(statoDaErrore(new DOMException("", nome))).toEqual({ stato, tecnico: nome });
  });

  it("un TypeError (vincoli non validi) è «non disponibile», con nome e messaggio", () => {
    expect(statoDaErrore(new TypeError("facingMode non valido"))).toEqual({
      stato: "non-disponibile",
      tecnico: "TypeError: facingMode non valido",
    });
  });

  it("un rifiuto che non è un errore dice almeno di che tipo è", () => {
    expect(statoDaErrore("boh")).toEqual({ stato: "non-disponibile", tecnico: "string" });
    expect(statoDaErrore(undefined)).toEqual({ stato: "non-disponibile", tecnico: "undefined" });
  });
});
