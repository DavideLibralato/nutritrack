import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";

// Lo swipe indietro chiude la schermata a tutto schermo (useChiudiConIndietro;
// PUNTO_DI_PARTENZA.md §3, "Alimenti"). Test permanenti: la cronologia
// sbagliata non fa rumore. Un passo di troppo è un "indietro" che non fa
// niente; un ritorno di troppo porta fuori dalla pagina, magari dopo che
// la pagina stessa ha già navigato altrove.
//
// La cronologia è quella vera di jsdom: history.go() arriva con un
// popstate, un attimo dopo, come nel browser. Lo stato dell'hook è del
// modulo (condiviso fra le pagine): ogni test lo ricarica da capo, come un
// documento nuovo.

type Modulo = typeof import("./useChiudiConIndietro");
let modulo: Modulo;

beforeEach(async () => {
  vi.resetModules();
  modulo = await import("./useChiudiConIndietro");
  vi.spyOn(window.history, "go");
  vi.spyOn(window.history, "pushState");
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  // Ogni test parte da una voce senza segno: quelle rimaste si saltano
  // all'indietro, una alla volta, senza nessun hook montato.
  while (segno().length > 0) {
    const arrivo = popstate();
    window.history.back();
    await arrivo;
  }
});

function segno(): string[] {
  return window.history.state?.[modulo.CHIAVE_SEGNO] ?? [];
}

// Il prossimo popstate, registrato prima di provocarlo: arriva dopo quello
// dell'hook, che è registrato da prima.
function popstate() {
  return new Promise<void>((risolvi) =>
    window.addEventListener("popstate", () => risolvi(), { once: true })
  );
}

// Lascia passare il giro del setTimeout delle chiusure dall'app.
async function unGiro() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

// Uno swipe indietro: il browser torna alla voce precedente.
async function swipe() {
  const arrivo = popstate();
  await act(async () => {
    window.history.back();
    await arrivo;
  });
}

// Il ritorno partito dall'hook (history.go), fino al suo popstate.
async function ritornoDellHook() {
  const arrivo = popstate();
  await unGiro();
  await act(async () => {
    await arrivo;
  });
}

function Schermata({ aperto, chiudi }: { aperto: boolean; chiudi: () => void }) {
  modulo.useChiudiConIndietro(aperto, chiudi);
  return null;
}

// Una schermata dentro l'altra, come la ricerca dentro il pasto salvato.
function DueLivelli({
  pasto,
  ricerca,
  chiudiPasto,
  chiudiRicerca,
}: {
  pasto: boolean;
  ricerca: boolean;
  chiudiPasto: () => void;
  chiudiRicerca: () => void;
}) {
  modulo.useChiudiConIndietro(pasto, chiudiPasto);
  return pasto ? <Schermata aperto={ricerca} chiudi={chiudiRicerca} /> : null;
}

describe("useChiudiConIndietro", () => {
  it("aprire aggiunge un passo solo, con lo stesso indirizzo", () => {
    const indirizzo = window.location.href;
    const { rerender } = render(<Schermata aperto={false} chiudi={() => {}} />);
    expect(window.history.pushState).not.toHaveBeenCalled();

    rerender(<Schermata aperto chiudi={() => {}} />);
    rerender(<Schermata aperto chiudi={() => {}} />);

    expect(window.history.pushState).toHaveBeenCalledTimes(1);
    expect(segno()).toHaveLength(1);
    expect(window.location.href).toBe(indirizzo);
  });

  it("lo swipe chiude la schermata, una volta sola, e poi nessun ritorno", async () => {
    const chiudi = vi.fn();
    const { rerender } = render(<Schermata aperto chiudi={chiudi} />);

    await swipe();
    expect(chiudi).toHaveBeenCalledTimes(1);
    expect(segno()).toEqual([]);

    // La pagina chiude davvero (il suo setState): niente da togliere.
    rerender(<Schermata aperto={false} chiudi={chiudi} />);
    await unGiro();
    expect(window.history.go).not.toHaveBeenCalled();
    expect(chiudi).toHaveBeenCalledTimes(1);
  });

  it("chiusa dall'app (freccia, Salva): un ritorno solo, anche chiamata due volte, e niente si richiude", async () => {
    const chiudi = vi.fn();
    const { rerender } = render(<Schermata aperto chiudi={chiudi} />);

    rerender(<Schermata aperto={false} chiudi={chiudi} />);
    rerender(<Schermata aperto={false} chiudi={() => {}} />);
    await ritornoDellHook();

    expect(window.history.go).toHaveBeenCalledTimes(1);
    expect(window.history.go).toHaveBeenCalledWith(-1);
    expect(segno()).toEqual([]);
    // Il popstate del ritorno non è uno swipe: non chiama `chiudi`.
    expect(chiudi).not.toHaveBeenCalled();
  });

  it("schermate che si danno il cambio: nessun passo nuovo, e lo swipe usa l'ultima `chiudi`", async () => {
    const chiudiScansione = vi.fn();
    const chiudiModulo = vi.fn();
    const { rerender } = render(<Schermata aperto chiudi={chiudiScansione} />);
    rerender(<Schermata aperto chiudi={chiudiModulo} />);
    expect(window.history.pushState).toHaveBeenCalledTimes(1);

    await swipe();
    expect(chiudiModulo).toHaveBeenCalledTimes(1);
    expect(chiudiScansione).not.toHaveBeenCalled();
  });

  it("due livelli: lo swipe chiude solo quella di sopra, il secondo il pasto", async () => {
    const chiudiPasto = vi.fn();
    const chiudiRicerca = vi.fn();
    const props = { chiudiPasto, chiudiRicerca };
    const { rerender } = render(<DueLivelli pasto ricerca={false} {...props} />);
    rerender(<DueLivelli pasto ricerca {...props} />);
    expect(window.history.pushState).toHaveBeenCalledTimes(2);
    expect(segno()).toHaveLength(2);

    await swipe();
    expect(chiudiRicerca).toHaveBeenCalledTimes(1);
    expect(chiudiPasto).not.toHaveBeenCalled();
    expect(segno()).toHaveLength(1);
    rerender(<DueLivelli pasto ricerca={false} {...props} />);
    await unGiro();
    expect(window.history.go).not.toHaveBeenCalled();

    await swipe();
    expect(chiudiPasto).toHaveBeenCalledTimes(1);
    expect(segno()).toEqual([]);
  });

  it("due livelli: il pasto chiuso dall'app con la ricerca aperta toglie tutti e due i passi", async () => {
    const props = { chiudiPasto: vi.fn(), chiudiRicerca: vi.fn() };
    const { rerender } = render(<DueLivelli pasto ricerca={false} {...props} />);
    rerender(<DueLivelli pasto ricerca {...props} />);

    rerender(<DueLivelli pasto={false} ricerca={false} {...props} />);
    await ritornoDellHook();

    expect(window.history.go).toHaveBeenCalledTimes(1);
    expect(window.history.go).toHaveBeenCalledWith(-2);
    expect(segno()).toEqual([]);
    expect(props.chiudiPasto).not.toHaveBeenCalled();
    expect(props.chiudiRicerca).not.toHaveBeenCalled();
  });

  it("chiusa dall'app e subito dopo la pagina naviga (Next riscrive il segno): nessun ritorno", async () => {
    const { rerender } = render(<Schermata aperto chiudi={() => {}} />);

    rerender(<Schermata aperto={false} chiudi={() => {}} />);
    // Come router.replace: Next riscrive la voce corrente senza il segno.
    window.history.replaceState({ __NA: true }, "");
    await unGiro();

    expect(window.history.go).not.toHaveBeenCalled();
  });

  it("chiusa dall'app e la pagina si smonta prima del ritorno: nessun ritorno", async () => {
    const { rerender, unmount } = render(<Schermata aperto chiudi={() => {}} />);

    rerender(<Schermata aperto={false} chiudi={() => {}} />);
    unmount();
    await unGiro();

    expect(window.history.go).not.toHaveBeenCalled();
  });

  it("pagina smontata con la schermata aperta: l'hook non tocca la cronologia", async () => {
    const { unmount } = render(<Schermata aperto chiudi={() => {}} />);

    unmount();
    await unGiro();

    expect(window.history.go).not.toHaveBeenCalled();
  });

  it("chiusa e riaperta prima del ritorno: resta lo stesso passo", async () => {
    const { rerender } = render(<Schermata aperto chiudi={() => {}} />);

    rerender(<Schermata aperto={false} chiudi={() => {}} />);
    rerender(<Schermata aperto chiudi={() => {}} />);
    await unGiro();

    expect(window.history.go).not.toHaveBeenCalled();
    expect(window.history.pushState).toHaveBeenCalledTimes(1);
    expect(segno()).toHaveLength(1);
  });

  it("riaperta mentre il ritorno è in corso: il passo nuovo arriva dopo, uno solo", async () => {
    const chiudi = vi.fn();
    const { rerender } = render(<Schermata aperto chiudi={chiudi} />);

    rerender(<Schermata aperto={false} chiudi={chiudi} />);
    const arrivo = popstate();
    await unGiro(); // parte il ritorno
    rerender(<Schermata aperto chiudi={chiudi} />);
    await act(async () => {
      await arrivo;
    });

    expect(segno()).toHaveLength(1);
    expect(chiudi).not.toHaveBeenCalled();
    // E lo swipe chiude la schermata riaperta.
    await swipe();
    expect(chiudi).toHaveBeenCalledTimes(1);
  });

  it("pagina smontata mentre il ritorno è in corso: alla pagina dopo il passo si aggiunge", async () => {
    const { rerender, unmount } = render(<Schermata aperto chiudi={() => {}} />);
    rerender(<Schermata aperto={false} chiudi={() => {}} />);
    const arrivo = popstate();
    await unGiro(); // parte il ritorno
    unmount();
    await act(async () => {
      await arrivo;
    });

    render(<Schermata aperto chiudi={() => {}} />);

    expect(window.history.pushState).toHaveBeenCalledTimes(2);
    expect(segno()).toHaveLength(1);
  });

  it("dopo un ricaricamento la voce col segno rimasta si salta, una volta", async () => {
    // La voce lasciata dal documento di prima, con il modulo aperto.
    window.history.pushState({ [modulo.CHIAVE_SEGNO]: ["s-vecchio"] }, "");

    const arrivo = popstate();
    render(<Schermata aperto={false} chiudi={() => {}} />);
    render(<Schermata aperto={false} chiudi={() => {}} />);
    await act(async () => {
      await arrivo;
    });

    expect(window.history.go).toHaveBeenCalledTimes(1);
    expect(window.history.go).toHaveBeenCalledWith(-1);
    expect(segno()).toEqual([]);
  });

  it("senza segno, montare l'hook non tocca la cronologia", async () => {
    render(<Schermata aperto={false} chiudi={() => {}} />);
    await unGiro();

    expect(window.history.go).not.toHaveBeenCalled();
  });

  it("swipe in avanti su un passo di una schermata chiusa: si torna giù", async () => {
    const chiudi = vi.fn();
    const { rerender } = render(<Schermata aperto chiudi={chiudi} />);
    await swipe();
    rerender(<Schermata aperto={false} chiudi={chiudi} />);
    await unGiro();

    const avanti = popstate();
    const ritorno = new Promise<void>((risolvi) => {
      avanti.then(() => popstate().then(risolvi));
    });
    await act(async () => {
      window.history.forward();
      await ritorno;
    });

    expect(window.history.go).toHaveBeenCalledWith(-1);
    expect(segno()).toEqual([]);
    expect(chiudi).toHaveBeenCalledTimes(1);
  });
});
