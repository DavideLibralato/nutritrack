import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import AlimentiPage from "./page";
import { db } from "@/lib/db/database";
import { repositoryAlimenti } from "@/lib/repository";
import type { Alimento } from "@/lib/db/tipi";

// Impostazioni > Alimenti e il codice a barre (PUNTO_DI_PARTENZA.md §3,
// "Codice a barre", "Nel catalogo" e "Il codice in modifica"; branch
// `alimenti-codice-a-barre`). Test permanenti per quello che sbaglierebbe
// in silenzio: un prodotto creato dal catalogo che apre lo sheet quantità
// (o non torna al catalogo); un codice già presente che apre "Nuovo
// alimento" (e diventa un secondo alimento con lo stesso codice) invece
// della modifica; un alimento che non si modifica aperto lo stesso; il
// codice aggiunto in modifica che non arriva in Dexie. Dexie è quello vero
// (in memoria), Open Food Facts è una fetch finta, la fotocamera in jsdom
// non c'è: si passa da "Scrivi il codice".

const USER_ID = "utente-test-catalogo-codice";
const KETCHIPS = "8008714001827";
const PATATINE = "8000500310427";

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => USER_ID,
  useNomeUtente: () => "Prova",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
  }),
}));

// Gli alimenti in arrivo dagli amici leggono il server: qui nessuno.
vi.mock("@/lib/amici/useAlimentiInArrivo", () => ({
  useAlimentiInArrivo: () => ({ stato: { esito: "errore" }, ricarica: async () => {} }),
}));

// Il lettore senza WebAssembly: in jsdom non c'è un video da leggere.
vi.mock("@/lib/barcode/lettoreCodice", () => ({
  preparaLettore: () => Promise.resolve({ leggi: async () => null }),
}));

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => true });
});

function creaAlimento(nome: string, marca: string | null, barcode: string | null): Promise<Alimento> {
  return repositoryAlimenti.crea({
    user_id: USER_ID, nome, marca, barcode,
    kcal_100g: 510, proteine_100g: 6.5, carboidrati_100g: 56, grassi_100g: 29,
    zuccheri_100g: null, fibre_100g: null, saturi_100g: null, sale_100g: null,
    porzione_default_g: 30, fonte: barcode ? "off" : "manuale", verificato: false,
  });
}

function risposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

// Apre la scansione con Scansiona e scrive il codice, come con la
// fotocamera negata.
async function scansionaScrivendo(codice: string) {
  fireEvent.click(await screen.findByRole("button", { name: "Scansiona il codice a barre" }));
  const scansione = await screen.findByRole("dialog", { name: "Scansione del codice a barre" });
  expect(within(scansione).getByText("Catalogo alimenti")).toBeTruthy();
  fireEvent.click(within(scansione).getByRole("button", { name: /Scrivi il codice/ }));
  fireEvent.change(within(scansione).getByLabelText("Il codice sotto le barre"), {
    target: { value: codice },
  });
  fireEvent.click(within(scansione).getByRole("button", { name: "Cerca" }));
  return scansione;
}

describe("Catalogo alimenti: Scansiona", () => {
  it("trovato su Open Food Facts: modulo precompilato, Salva torna al catalogo senza sheet quantità", async () => {
    await creaAlimento("Banana", null, null);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        risposta({
          product: {
            product_name_it: "Patatine classiche",
            brands: "San Carlo",
            nutriments: { "energy-kcal_100g": 537, proteins_100g: 6, carbohydrates_100g: 52, fat_100g: 33 },
          },
        })
      )
    );
    render(<AlimentiPage />);

    await scansionaScrivendo(PATATINE);

    expect(await screen.findByText(/Valori trovati su Open Food Facts/)).toBeTruthy();
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe(PATATINE);
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    // Di nuovo nel catalogo, con la barra «Creato:», e nessuno sheet.
    expect(await screen.findByText("Creato:")).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Cerca un alimento" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/Quantità/)).toBeNull();
    const salvato = (await repositoryAlimenti.ottieniTutti(USER_ID)).find((a) => a.barcode === PATATINE);
    expect(salvato).toMatchObject({ nome: "Patatine classiche", marca: "San Carlo", fonte: "off" });
  });

  it("codice già nel catalogo: la sua modifica con l'avviso, e Open Food Facts non si chiama", async () => {
    await creaAlimento("Ketchips", "Amica Chips", KETCHIPS);
    const fetchFinta = vi.fn(async () => risposta({ product: { product_name: "Altro" } }));
    vi.stubGlobal("fetch", fetchFinta);
    render(<AlimentiPage />);

    await scansionaScrivendo(KETCHIPS);

    expect(await screen.findByText("Modifica alimento")).toBeTruthy();
    expect(screen.getByText("Questo codice è già nel tuo catalogo.")).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Ketchips");
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe(KETCHIPS);
    expect(screen.queryByText("Nuovo alimento")).toBeNull();
    expect(fetchFinta).not.toHaveBeenCalled();
  });

  it("codice di un alimento del catalogo comune: la modifica non si apre, la scansione lo dice", async () => {
    await creaAlimento("Banana", null, null);
    await db.alimenti.put({
      id: "comune-passata",
      user_id: null,
      updated_at: "2026-11-01T00:00:00.000Z",
      deleted_at: null,
      nome: "Passata di pomodoro",
      marca: "Mutti",
      barcode: KETCHIPS,
      kcal_100g: 36, proteine_100g: 1.6, carboidrati_100g: 5.6, grassi_100g: 0.2,
      zuccheri_100g: null, fibre_100g: null, saturi_100g: null, sale_100g: null,
      porzione_default_g: 100, fonte: "off", verificato: true,
    });
    render(<AlimentiPage />);

    const scansione = await scansionaScrivendo(KETCHIPS);

    expect(
      await within(scansione).findByText(
        "È nel catalogo comune: «Passata di pomodoro · Mutti». Non si modifica, ma lo trovi in Aggiungi."
      )
    ).toBeTruthy();
    expect(within(scansione).getByRole("button", { name: "Scansiona un altro codice" })).toBeTruthy();
    expect(screen.queryByText("Modifica alimento")).toBeNull();
  });

  it("rete che cade su Open Food Facts: il messaggio, «Crea a mano», e Salva torna al catalogo senza sheet quantità", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Load failed");
      })
    );
    render(<AlimentiPage />);

    const scansione = await scansionaScrivendo(PATATINE);

    expect(await within(scansione).findByText(/Non riesco a raggiungere Open Food Facts/)).toBeTruthy();
    fireEvent.click(within(scansione).getByRole("button", { name: "Crea a mano" }));

    expect(await screen.findByText("Nuovo alimento")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Scansione del codice a barre" })).toBeNull();
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe(PATATINE);
    for (const [etichetta, valore] of [
      ["Nome", "Patatine"],
      ["Calorie (kcal)", "537"],
      ["Grassi (g)", "33"],
      ["Carboidrati (g)", "52"],
      ["Proteine (g)", "6"],
    ]) {
      fireEvent.change(screen.getByLabelText(etichetta), { target: { value: valore } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    expect(await screen.findByText("Creato:")).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Cerca un alimento" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/Quantità/)).toBeNull();
    const salvato = (await repositoryAlimenti.ottieniTutti(USER_ID)).find((a) => a.barcode === PATATINE);
    // Valori scritti a mano: fonte 'barcode'.
    expect(salvato).toMatchObject({ nome: "Patatine", fonte: "barcode" });
  });

  it("in selezione multipla Scansiona non c'è, e torna uscendo", async () => {
    await creaAlimento("Banana", null, null);
    await creaAlimento("Mela", null, null);
    render(<AlimentiPage />);
    expect(await screen.findByRole("button", { name: "Scansiona il codice a barre" })).toBeTruthy();

    // Tieni premuto fermo su una riga (useTieniPremuto, come in Oggi): dopo
    // il tempo del gesto si entra in selezione. Si aspetta la barra invece
    // di un tempo fisso: con tutti i file in esecuzione i timer di jsdom
    // possono scattare in ritardo.
    const riga = screen.getByText("Banana");
    fireEvent(
      riga,
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        isPrimary: true,
        pointerType: "touch",
        button: 0,
        clientX: 50,
        clientY: 50,
      })
    );
    const barra = await screen.findByRole("toolbar", { name: "Alimenti selezionati" }, { timeout: 3000 });

    expect(screen.queryByRole("button", { name: "Scansiona il codice a barre" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Scansione non disponibile senza connessione" })).toBeNull();

    fireEvent.click(within(barra).getByRole("button", { name: "Annulla" }));
    expect(await screen.findByRole("button", { name: "Scansiona il codice a barre" })).toBeTruthy();
  });

  it("non trovato su Open Food Facts: «Nuovo alimento» con il solo codice", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => risposta({ result: { id: "product_not_found" } }, 404)));
    render(<AlimentiPage />);

    await scansionaScrivendo(PATATINE);

    expect(await screen.findByText("Nuovo alimento")).toBeTruthy();
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe(PATATINE);
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("");
  });

  it("senza rete Scansiona è spento, e la riga dice perché", async () => {
    await creaAlimento("Banana", null, null);
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => false });
    render(<AlimentiPage />);

    const spento = (await screen.findByRole("button", {
      name: "Scansione non disponibile senza connessione",
    })) as HTMLButtonElement;
    expect(spento.disabled).toBe(true);
    expect(screen.getByText("Senza connessione la scansione non è disponibile")).toBeTruthy();
  });

  it("catalogo vuoto: la ricerca resta, spenta, con Scansiona accanto e il testo che lo dice", async () => {
    render(<AlimentiPage />);

    expect(await screen.findByText("Ancora nessun alimento")).toBeTruthy();
    expect(
      (screen.getByRole("searchbox", { name: "Cerca un alimento" }) as HTMLInputElement).disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Scansiona il codice a barre" }) as HTMLButtonElement).disabled
    ).toBe(false);
    expect(
      screen.getByText(
        "Crea il primo con il + qui sotto, oppure scansiona una confezione con il pulsante accanto alla ricerca."
      )
    ).toBeTruthy();
  });
});

describe("Catalogo alimenti: «Aggiungi codice a barre»", () => {
  it("dalla modifica di un alimento senza codice: il codice letto si scrive in Dexie con Salva, la fonte non cambia", async () => {
    const patatine = await creaAlimento("Patatine", "San Carlo", null);
    render(<AlimentiPage />);

    fireEvent.click(await screen.findByText("Patatine · San Carlo"));
    fireEvent.click(await screen.findByRole("button", { name: "Aggiungi codice a barre" }));
    const scansione = await screen.findByRole("dialog", { name: "Scansione del codice a barre" });
    fireEvent.click(within(scansione).getByRole("button", { name: /Scrivi il codice/ }));
    fireEvent.change(within(scansione).getByLabelText("Il codice sotto le barre"), {
      target: { value: PATATINE },
    });
    fireEvent.click(within(scansione).getByRole("button", { name: "Usa questo codice" }));

    expect((await screen.findByLabelText("Codice a barre") as HTMLInputElement).value).toBe(PATATINE);
    expect((await db.alimenti.get(patatine.id))?.barcode).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(async () => expect((await db.alimenti.get(patatine.id))?.barcode).toBe(PATATINE));
    expect((await db.alimenti.get(patatine.id))?.fonte).toBe("manuale");
    expect(await screen.findByRole("searchbox", { name: "Cerca un alimento" })).toBeTruthy();
  });
});
