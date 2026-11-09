// Test permanenti per i due usi di SchermataScansione (PUNTO_DI_PARTENZA.md
// §3, "Codice a barre", "Il codice in modifica"). Il percorso "cerca"
// completo è provato in src/app/aggiungi/page.test.tsx; qui conta quello
// che sbaglierebbe in silenzio nell'uso "solo-codice", da «Aggiungi codice
// a barre»: un codice che parte per Open Food Facts (serve la rete, e il
// risultato non serve a niente) invece di tornare al modulo, o che torna a
// 12 cifre (un UPC-A salvato così non si ritrova mai, nel catalogo è a 13).

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import SchermataScansione from "./SchermataScansione";
import { TESTO_DA_SOLO, TESTO_TORNA_NEL_MODULO } from "@/lib/barcode/testiScansione";

// Il lettore senza WebAssembly: in jsdom non c'è un video da leggere, i
// test passano da "Scrivi il codice" (come in Aggiungi).
vi.mock("@/lib/barcode/lettoreCodice", () => ({
  preparaLettore: () => Promise.resolve({ leggi: async () => null }),
}));

const ricerca = vi.hoisted(() => ({ cercaCodice: vi.fn() }));
vi.mock("@/lib/barcode/ricercaCodice", () => ricerca);

// Una richiesta della fotocamera che non risponde mai: la schermata resta
// in "avvio", con il mirino e le sue due righe.
const inAttesa = () => new Promise<MediaStream>(() => {});

afterEach(() => {
  cleanup();
  ricerca.cercaCodice.mockReset();
});

function scriviCodice(codice: string, pulsante: string) {
  fireEvent.click(screen.getByRole("button", { name: /Scrivi il codice/ }));
  fireEvent.change(screen.getByLabelText("Il codice sotto le barre"), { target: { value: codice } });
  fireEvent.click(screen.getByRole("button", { name: pulsante }));
}

describe("SchermataScansione, uso solo-codice", () => {
  it("il codice scritto torna a chi l'ha aperta, a 13 cifre, senza cercarlo", async () => {
    const onCodice = vi.fn();
    render(
      <SchermataScansione
        userId="utente"
        richiestaFotocamera={inAttesa()}
        titolo="Codice per «Patatine»"
        onChiudi={() => {}}
        uso={{ tipo: "solo-codice", onCodice }}
      />
    );

    // UPC-A a 12 cifre: torna come EAN-13, con lo 0 davanti.
    scriviCodice("036000291452", "Usa questo codice");

    expect(onCodice).toHaveBeenCalledExactlyOnceWith("0036000291452");
    expect(ricerca.cercaCodice).not.toHaveBeenCalled();
    expect(screen.queryByText("Cerco il prodotto…")).toBeNull();
  });

  it("titolo di chi l'apre, e sotto il mirino la riga del modulo", async () => {
    render(
      <SchermataScansione
        userId="utente"
        richiestaFotocamera={inAttesa()}
        titolo="Codice per «Patatine»"
        onChiudi={() => {}}
        uso={{ tipo: "solo-codice", onCodice: () => {} }}
      />
    );

    expect(screen.getByText("Codice per «Patatine»")).toBeTruthy();
    expect(screen.getByText(TESTO_TORNA_NEL_MODULO)).toBeTruthy();
    expect(screen.queryByText(TESTO_DA_SOLO)).toBeNull();
  });
});

// Il tasto Invio della tastiera dell'iPhone prende il nome da
// enterKeyHint: «Cerca» dove non si cerca niente sarebbe falso.
describe("SchermataScansione, il tasto Invio di \"Scrivi il codice\"", () => {
  it("dice Fine in solo-codice e Cerca in cerca", () => {
    const { unmount } = render(
      <SchermataScansione
        userId="utente"
        richiestaFotocamera={inAttesa()}
        titolo="Codice per «Patatine»"
        onChiudi={() => {}}
        uso={{ tipo: "solo-codice", onCodice: () => {} }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Scrivi il codice/ }));
    expect(screen.getByLabelText("Il codice sotto le barre").getAttribute("enterkeyhint")).toBe("done");
    unmount();

    render(
      <SchermataScansione
        userId="utente"
        richiestaFotocamera={inAttesa()}
        titolo="Catalogo alimenti"
        onChiudi={() => {}}
        uso={{ tipo: "cerca", onNelCatalogo: () => {}, onModulo: () => {}, onPortaCodice: () => {}, catalogo: { tipo: "apri", onApri: () => {} } }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Scrivi il codice/ }));
    expect(screen.getByLabelText("Il codice sotto le barre").getAttribute("enterkeyhint")).toBe("search");
  });
});

describe("SchermataScansione, uso cerca", () => {
  it("il codice si cerca, e l'esito va a chi l'ha aperta", async () => {
    const alimento = { id: "ketchips", nome: "Ketchips" };
    ricerca.cercaCodice.mockResolvedValue({ esito: "nel-catalogo", alimento });
    const onNelCatalogo = vi.fn();
    render(
      <SchermataScansione
        userId="utente"
        richiestaFotocamera={inAttesa()}
        titolo="Catalogo alimenti"
        onChiudi={() => {}}
        uso={{ tipo: "cerca", onNelCatalogo, onModulo: () => {}, onPortaCodice: () => {}, catalogo: { tipo: "apri", onApri: () => {} } }}
      />
    );
    expect(screen.getByText("Catalogo alimenti")).toBeTruthy();
    expect(screen.getByText(TESTO_DA_SOLO)).toBeTruthy();

    scriviCodice("8008714001827", "Cerca");

    await vi.waitFor(() => expect(onNelCatalogo).toHaveBeenCalledExactlyOnceWith(alimento));
    expect(ricerca.cercaCodice).toHaveBeenCalledWith("utente", "8008714001827", expect.anything());
  });
});
