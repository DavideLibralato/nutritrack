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
  useSearchParams: () => parametriIndirizzo.valore,
}));

// I parametri dell'indirizzo (?scheda=catalogo&cerca=…), per i test di
// «Vedi tutto il catalogo» da Aggiungi.
const parametriIndirizzo = vi.hoisted(() => ({ valore: new URLSearchParams() }));

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

// "Apri" porta il codice (PUNTO §3, "«Apri» porta il codice"): nel
// catalogo il Salva torna all'elenco, come ogni modifica.
describe("Catalogo alimenti: «Apri» porta il codice", () => {
  function patatineSuOff() {
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
  }

  it("Open Food Facts trova un alimento uguale senza codice: «Apri» ne apre la modifica con il codice, Salva lo scrive e torna", async () => {
    const mia = await creaAlimento("Patatine classiche", "San Carlo", null);
    patatineSuOff();
    render(<AlimentiPage />);

    await scansionaScrivendo(PATATINE);
    fireEvent.click(await screen.findByRole("button", { name: "Apri «Patatine classiche»" }));

    expect(await screen.findByText("Modifica alimento")).toBeTruthy();
    expect(
      screen.getByText(
        "Questo alimento non aveva il codice: salvalo per ritrovarlo la prossima volta che scansioni."
      )
    ).toBeTruthy();
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe(PATATINE);
    expect((await db.alimenti.get(mia.id))?.barcode).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(async () => expect((await db.alimenti.get(mia.id))?.barcode).toBe(PATATINE));
    // La fonte resta quella della riga: i valori non vengono da OFF.
    expect((await db.alimenti.get(mia.id))?.fonte).toBe("manuale");
    expect(await screen.findByRole("searchbox", { name: "Cerca un alimento" })).toBeTruthy();
    expect(await repositoryAlimenti.ottieniTutti(USER_ID)).toHaveLength(1);
  });

  it("con la × il codice e il suo avviso spariscono, e torna «Aggiungi codice a barre»", async () => {
    await creaAlimento("Patatine classiche", "San Carlo", null);
    patatineSuOff();
    render(<AlimentiPage />);

    await scansionaScrivendo(PATATINE);
    fireEvent.click(await screen.findByRole("button", { name: "Apri «Patatine classiche»" }));
    expect(await screen.findByText(/Questo alimento non aveva il codice/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Togli il codice" }));

    expect(screen.queryByLabelText("Codice a barre")).toBeNull();
    expect(screen.queryByText(/Questo alimento non aveva il codice/)).toBeNull();
    expect(screen.getByRole("button", { name: "Aggiungi codice a barre" })).toBeTruthy();
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

// La scheda «Catalogo» (PUNTO_DI_PARTENZA.md §10.1; mockup
// docs/mockups/catalogo-precaricato.html). Test permanenti per quello che
// sbaglierebbe in silenzio: un prodotto che hai già (stesso codice) che si
// può aggiungere una seconda volta; «Aggiungi» che non crea la copia in
// Dexie, o «Annulla» che non la toglie; «Apri» che apre un altro
// alimento; «Nascondi quelli che hai» che non si ricorda.
describe("Catalogo precaricato: la scheda «Catalogo»", () => {
  async function apriCatalogo() {
    fireEvent.click(await screen.findByRole("button", { name: /^Catalogo/ }));
    return screen.findByRole("searchbox", { name: "Cerca nel catalogo" });
  }

  it("le Gocciole con lo stesso codice sono «Nei tuoi»: la scheda lo dice e «Apri» apre le tue", async () => {
    await creaAlimento("Gocciole chocolate", "Pavesi", "8013355999143");
    render(<AlimentiPage />);
    fireEvent.change(await apriCatalogo(), { target: { value: "gocciole" } });

    expect(screen.queryByRole("button", { name: "Aggiungi Gocciole chocolate · Pavesi ai tuoi alimenti" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Gocciole chocolate · Pavesi, 488 kcal per 100 g, già nei tuoi$/ }));
    const scheda = await screen.findByRole("dialog", { name: "Gocciole chocolate" });
    expect(within(scheda).getByText("Hai già un alimento con questo codice a barre: «Gocciole chocolate · Pavesi».")).toBeTruthy();
    expect(within(scheda).getByText("Per 100 g, nel catalogo")).toBeTruthy();
    expect(within(scheda).queryByRole("button", { name: "Aggiungi ai miei alimenti" })).toBeNull();

    fireEvent.click(within(scheda).getByRole("button", { name: "Apri «Gocciole chocolate»" }));
    expect(await screen.findByText("Modifica alimento")).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Gocciole chocolate");
  });

  it("«Aggiungi» crea la copia, la riga passa a «Nei tuoi», «Annulla» la toglie", async () => {
    render(<AlimentiPage />);
    fireEvent.change(await apriCatalogo(), { target: { value: "mandorle" } });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi Mandorle ai tuoi alimenti" }));

    expect(await screen.findByText("Aggiunto ai tuoi:")).toBeTruthy();
    const copie = await db.alimenti.filter((a) => a.catalogo_id === "ciqual:15000").toArray();
    expect(copie).toHaveLength(1);
    expect(copie[0]).toMatchObject({ user_id: USER_ID, nome: "Mandorle", fonte: "manuale", deleted_at: null });
    expect(await screen.findByRole("button", { name: /^Mandorle, \d+ kcal per 100 g, già nei tuoi$/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    await waitFor(async () => expect((await db.alimenti.get(copie[0].id))?.deleted_at).not.toBeNull());
    expect(await screen.findByRole("button", { name: "Aggiungi Mandorle ai tuoi alimenti" })).toBeTruthy();
  });

  it("«Apri» nella barra apre la modifica della copia; in «I miei» la copia dice «dal catalogo»", async () => {
    render(<AlimentiPage />);
    fireEvent.change(await apriCatalogo(), { target: { value: "mandorle" } });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi Mandorle ai tuoi alimenti" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apri" }));
    expect(await screen.findByText("Modifica alimento")).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Mandorle");

    fireEvent.click(screen.getAllByRole("button", { name: "Torna al catalogo" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /^I miei/ }));
    const riga = await screen.findByRole("button", { name: /Mandorle/ });
    expect(within(riga).getByText("dal catalogo")).toBeTruthy();
  });

  it("dalla scheda: «Aggiungi ai miei alimenti» crea la copia e la scheda si chiude", async () => {
    render(<AlimentiPage />);
    fireEvent.change(await apriCatalogo(), { target: { value: "spaghetti" } });
    fireEvent.click(screen.getByRole("button", { name: /^Spaghetti n\.5 · Barilla, / }));
    const scheda = await screen.findByRole("dialog", { name: "Spaghetti n.5" });
    expect(within(scheda).getByText("8076800195057")).toBeTruthy();
    expect(within(scheda).getByText(/Fonte: Open Food Facts$/)).toBeTruthy();
    fireEvent.click(within(scheda).getByRole("button", { name: "Aggiungi ai miei alimenti" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Spaghetti n.5" })).toBeNull());
    expect(await db.alimenti.filter((a) => a.catalogo_id === "off:8076800195057").count()).toBe(1);
  });

  it("«Nascondi quelli che hai»: toglie quelli che hai, il conteggio lo dice, e si ricorda", async () => {
    window.localStorage.removeItem("nutritrack:catalogo:nascondi-quelli-che-hai");
    await creaAlimento("Gocciole chocolate", "Pavesi", "8013355999143");
    render(<AlimentiPage />);
    await apriCatalogo();
    expect(screen.getByText("183 · 1 già nei tuoi")).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: "Nascondi quelli che hai" }));
    expect(screen.getByText("182 da aggiungere")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Gocciole chocolate · Pavesi, / })).toBeNull();
    expect(window.localStorage.getItem("nutritrack:catalogo:nascondi-quelli-che-hai")).toBe("1");

    cleanup();
    render(<AlimentiPage />);
    await apriCatalogo();
    expect(screen.getByRole("switch", { name: "Nascondi quelli che hai" }).getAttribute("aria-checked")).toBe("true");
    window.localStorage.removeItem("nutritrack:catalogo:nascondi-quelli-che-hai");
  });

  it("senza rete il catalogo si sfoglia e si aggiunge lo stesso", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => false });
    render(<AlimentiPage />);
    fireEvent.change(await apriCatalogo(), { target: { value: "carote" } });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi Carote ai tuoi alimenti" }));
    await waitFor(async () => expect(await db.alimenti.filter((a) => a.catalogo_id === "ciqual:20009").count()).toBe(1));
  });
});

describe("Catalogo precaricato: arrivo da «Vedi tutto il catalogo»", () => {
  it("?scheda=catalogo&cerca=latte apre la scheda «Catalogo» con la ricerca già scritta", async () => {
    parametriIndirizzo.valore = new URLSearchParams("scheda=catalogo&cerca=latte");
    try {
      render(<AlimentiPage />);
      const campo = (await screen.findByRole("searchbox", { name: "Cerca nel catalogo" })) as HTMLInputElement;
      expect(campo.value).toBe("latte");
      expect(screen.getByRole("button", { name: /^Latte senza lattosio · Zymil, / })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Mandorle, / })).toBeNull();
    } finally {
      parametriIndirizzo.valore = new URLSearchParams();
    }
  });
});

describe("Catalogo precaricato: Scansiona con un codice del catalogo", () => {
  it("apre la scheda «Catalogo» con la scheda del prodotto, senza Open Food Facts", async () => {
    await creaAlimento("Banana", null, null);
    const fetchFinta = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchFinta);
    render(<AlimentiPage />);

    const scansione = await scansionaScrivendo("3017620422003");
    await waitFor(() => expect(scansione.isConnected).toBe(false));
    const scheda = await screen.findByRole("dialog", { name: "Nutella" });
    expect(within(scheda).getByText("Ferrero · Dolci e snack")).toBeTruthy();
    expect(within(scheda).getByRole("button", { name: "Aggiungi ai miei alimenti" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Catalogo/ }).getAttribute("aria-pressed")).toBe("true");
    expect(fetchFinta).not.toHaveBeenCalled();
  });
});

describe("Catalogo precaricato: Scansiona un prodotto che hai già senza codice", () => {
  // Il caso Doriano (09/11): «Crackers integrali · Doriano» tuo, senza
  // codice; nel catalogo con 8000605830745. La scansione apre la modifica
  // del tuo con il codice pronto; Salva torna al catalogo e il codice è
  // salvato.
  it("Doriano: la modifica con il codice, Salva torna qui, il codice è salvato", async () => {
    const mio = await creaAlimento("Crackers integrali", "Doriano", null);
    const fetchFinta = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchFinta);
    render(<AlimentiPage />);

    await scansionaScrivendo("8000605830745");
    expect(await screen.findByText("Modifica alimento")).toBeTruthy();
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe("8000605830745");
    expect(screen.getByText("Questo alimento non aveva il codice: salvalo per ritrovarlo la prossima volta che scansioni.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(async () => expect((await db.alimenti.get(mio.id))?.barcode).toBe("8000605830745"));
    expect(await screen.findByRole("searchbox", { name: "Cerca un alimento" })).toBeTruthy();
    expect(fetchFinta).not.toHaveBeenCalled();
  });
});
