// Il form dell'alimento in modifica parte dai valori salvati: con
// String() un alimento con 0,9 g di proteine si apriva con "0.9". Qui: i
// campi si aprono con la virgola, e un Salva senza toccare niente scrive
// gli stessi numeri di prima, non 9 né 0.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CreaAlimentoForm from "./CreaAlimentoForm";
import type { Alimento } from "@/lib/db/tipi";
import type { ProdottoOpenFoodFacts } from "@/lib/barcode/valoriOpenFoodFacts";

const salvaAlimento = vi.fn();

// Niente Dexie: il catalogo è quello che il test mette qui (di solito
// vuoto, nessun doppione) e il Salva si spia. vi.hoisted: vi.mock sale in
// cima al file, prima delle altre righe, e la variabile deve esistere già.
const finto = vi.hoisted(() => ({ catalogo: [] as unknown[] }));
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => finto.catalogo }));
vi.mock("@/lib/repository/alimenti", () => ({
  catalogoLocale: async () => [],
  salvaAlimento: (...argomenti: unknown[]) => salvaAlimento(...argomenti),
}));
vi.mock("@/lib/repository/composizioni", () => ({ eliminaAlimenti: vi.fn() }));
// La scansione del solo codice, aperta da «Aggiungi codice a barre»: il
// lettore senza WebAssembly (in jsdom non c'è un video), si passa da
// "Scrivi il codice".
vi.mock("@/lib/barcode/lettoreCodice", () => ({
  preparaLettore: () => Promise.resolve({ leggi: async () => null }),
}));

afterEach(() => {
  cleanup();
  salvaAlimento.mockReset();
  finto.catalogo = [];
});

const MELA: Alimento = {
  id: "mela",
  user_id: "u1",
  updated_at: "2026-10-01T00:00:00.000Z",
  deleted_at: null,
  nome: "Mela",
  marca: null,
  barcode: null,
  kcal_100g: 52.5,
  proteine_100g: 0.9,
  carboidrati_100g: 12.25,
  grassi_100g: 0.2,
  zuccheri_100g: null,
  fibre_100g: null,
  saturi_100g: null,
  sale_100g: null,
  porzione_default_g: 12500.5,
  fonte: "manuale",
  verificato: false,
};

function valore(etichetta: string) {
  return (screen.getByLabelText(etichetta) as HTMLInputElement).value;
}

describe("CreaAlimentoForm, valori precompilati in modifica", () => {
  it("si apre con la virgola e un Salva senza toccare riscrive gli stessi numeri", async () => {
    salvaAlimento.mockResolvedValue({ esito: "salvato", alimento: MELA });
    const onModificato = vi.fn();
    render(
      <CreaAlimentoForm
        userId="u1"
        nomeIniziale=""
        etichettaIndietro="Alimenti"
        etichettaCrea="Crea"
        onAnnulla={() => {}}
        onCreato={() => {}}
        onApriEsistente={() => {}}
        puoAprire={() => true}
        alimentoDaModificare={MELA}
        onModificato={onModificato}
      />
    );

    expect(valore("Calorie (kcal)")).toBe("52,5");
    expect(valore("Grassi (g)")).toBe("0,2");
    expect(valore("Carboidrati (g)")).toBe("12,25");
    expect(valore("Proteine (g)")).toBe("0,9");
    // Niente punto delle migliaia: "12.500,5" non si rileggerebbe.
    expect(valore("Porzione predefinita (g)")).toBe("12500,5");

    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(onModificato).toHaveBeenCalled());
    expect(salvaAlimento).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        kcal_100g: 52.5,
        grassi_100g: 0.2,
        carboidrati_100g: 12.25,
        proteine_100g: 0.9,
        porzione_default_g: 12500.5,
      }),
      "mela",
      // In Modifica nessuna origine da codice a barre: codice e fonte
      // restano quelli della riga. E nessun codice da aggiungere.
      undefined,
      undefined
    );
  });

  it("valori interi: identici a prima", () => {
    render(
      <CreaAlimentoForm
        userId="u1"
        nomeIniziale=""
        etichettaIndietro="Alimenti"
        etichettaCrea="Crea"
        onAnnulla={() => {}}
        onCreato={() => {}}
        onApriEsistente={() => {}}
        puoAprire={() => true}
        alimentoDaModificare={{ ...MELA, kcal_100g: 52, proteine_100g: 1, porzione_default_g: 100 }}
      />
    );
    expect(valore("Calorie (kcal)")).toBe("52");
    expect(valore("Proteine (g)")).toBe("1");
    expect(valore("Porzione predefinita (g)")).toBe("100");
  });
});

// Dal branch `codice-a-barre` (PUNTO_DI_PARTENZA.md §3, "Codice a barre",
// "Il modulo precompilato" e "`fonte` e `barcode`"). Proteggono quello che
// sbaglierebbe in silenzio: un modulo che salva da solo i valori dei
// volontari, una fonte 'barcode' per valori presi da Open Food Facts (o
// 'off' per valori scritti a mano), il codice perso al Salva, la riga
// "calcolate dai kJ" rimasta dopo che l'utente le ha corrette.
describe("CreaAlimentoForm da un codice a barre", () => {
  const NUTELLA = "3017620422003";
  const PRODOTTO: ProdottoOpenFoodFacts = {
    nome: "Nutella",
    marca: "Ferrero",
    kcal_100g: 539,
    proteine_100g: 6.3,
    carboidrati_100g: 57.5,
    grassi_100g: 30.9,
    kcalDaKj: false,
  };

  function apri(daCodice: { barcode: string; prodotto: ProdottoOpenFoodFacts | null }) {
    const onCreato = vi.fn();
    render(
      <CreaAlimentoForm
        userId="u1"
        nomeIniziale=""
        etichettaIndietro="Torna alla ricerca"
        etichettaCrea="Crea e scegli la quantità"
        onAnnulla={() => {}}
        onCreato={onCreato}
        onApriEsistente={() => {}}
        puoAprire={() => true}
        daCodice={daCodice}
      />
    );
    return { onCreato };
  }

  function salva() {
    fireEvent.click(screen.getByRole("button", { name: "Crea e scegli la quantità" }));
  }

  function scrivi(etichetta: string, testo: string) {
    fireEvent.change(screen.getByLabelText(etichetta), { target: { value: testo } });
  }

  it("prodotto trovato: campi compilati, avviso, codice in sola lettura, licenza, e niente salvato da solo", () => {
    apri({ barcode: NUTELLA, prodotto: PRODOTTO });

    expect(valore("Nome")).toBe("Nutella");
    expect(valore("Marca (facoltativa)")).toBe("Ferrero");
    expect(valore("Calorie (kcal)")).toBe("539");
    expect(valore("Proteine (g)")).toBe("6,3");
    expect(valore("Grassi (g)")).toBe("30,9");
    const codice = screen.getByLabelText("Codice a barre") as HTMLInputElement;
    expect(codice.value).toBe(NUTELLA);
    expect(codice.readOnly).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Valori trovati su Open Food Facts");
    expect(screen.getByText("Dati da Open Food Facts · licenza ODbL")).toBeTruthy();
    expect(salvaAlimento).not.toHaveBeenCalled();
  });

  it("al Salva passa il codice e la fonte 'off', anche se un valore è stato corretto", async () => {
    salvaAlimento.mockResolvedValue({ esito: "salvato", alimento: MELA });
    const { onCreato } = apri({ barcode: NUTELLA, prodotto: PRODOTTO });

    scrivi("Calorie (kcal)", "540");
    salva();

    await waitFor(() => expect(onCreato).toHaveBeenCalled());
    expect(salvaAlimento).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ nome: "Nutella", kcal_100g: 540 }),
      undefined,
      { barcode: NUTELLA, fonte: "off" },
      // In creazione nessun codice da aggiungere: vale l'origine.
      undefined
    );
  });

  it("prodotto non trovato: modulo vuoto con il codice, niente avviso né licenza, fonte 'barcode'", async () => {
    salvaAlimento.mockResolvedValue({ esito: "salvato", alimento: MELA });
    const { onCreato } = apri({ barcode: "96385074", prodotto: null });

    expect(valore("Nome")).toBe("");
    expect(valore("Calorie (kcal)")).toBe("");
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe("96385074");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Dati da Open Food Facts · licenza ODbL")).toBeNull();

    scrivi("Nome", "Crackers");
    scrivi("Calorie (kcal)", "430");
    scrivi("Grassi (g)", "10");
    scrivi("Carboidrati (g)", "70");
    scrivi("Proteine (g)", "10");
    salva();

    await waitFor(() => expect(onCreato).toHaveBeenCalled());
    expect(salvaAlimento.mock.calls[0][3]).toEqual({ barcode: "96385074", fonte: "barcode" });
  });

  it("prodotto trovato senza valori: lo dice, con la licenza, e i valori scritti a mano danno fonte 'barcode'", async () => {
    salvaAlimento.mockResolvedValue({ esito: "salvato", alimento: MELA });
    const { onCreato } = apri({
      barcode: NUTELLA,
      prodotto: {
        ...PRODOTTO,
        kcal_100g: null,
        proteine_100g: null,
        carboidrati_100g: null,
        grassi_100g: null,
      },
    });

    expect(screen.getByRole("status").textContent).toContain("senza valori");
    // Nome e marca vengono comunque da Open Food Facts: la licenza si
    // dice anche qui (decisione di Davide, 07/11). La fonte resta 'barcode'.
    expect(valore("Nome")).toBe("Nutella");
    expect(screen.getByText("Dati da Open Food Facts · licenza ODbL")).toBeTruthy();
    scrivi("Calorie (kcal)", "539");
    scrivi("Grassi (g)", "30,9");
    scrivi("Carboidrati (g)", "57,5");
    scrivi("Proteine (g)", "6,3");
    salva();

    await waitFor(() => expect(onCreato).toHaveBeenCalled());
    expect(salvaAlimento.mock.calls[0][3]).toEqual({ barcode: NUTELLA, fonte: "barcode" });
  });

  it("kcal calcolate dai kJ: la riga c'è finché le kcal sono quelle calcolate", () => {
    apri({ barcode: NUTELLA, prodotto: { ...PRODOTTO, kcal_100g: 538.24, kcalDaKj: true } });

    const riga = "Calcolate dai kJ di Open Food Facts: controlla l'etichetta";
    expect(valore("Calorie (kcal)")).toBe("538,24");
    expect(screen.getByText(riga)).toBeTruthy();

    scrivi("Calorie (kcal)", "539");
    expect(screen.queryByText(riga)).toBeNull();
  });

  it("stesso codice di un alimento che c'è già: il messaggio dice il codice, segnato il codice e non il nome", () => {
    finto.catalogo = [{ ...MELA, id: "mia-nutella", nome: "Crema", marca: null, barcode: NUTELLA }];
    apri({ barcode: NUTELLA, prodotto: PRODOTTO });

    expect(
      screen.getByText("Hai già un alimento con questo codice a barre: «Crema».")
    ).toBeTruthy();
    expect(screen.getByLabelText("Codice a barre").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Nome").getAttribute("aria-invalid")).toBe("false");
    expect(
      (screen.getByRole("button", { name: "Crea e scegli la quantità" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("in Modifica il codice si ignora: niente campo del codice, nessuna origine al Salva", async () => {
    salvaAlimento.mockResolvedValue({ esito: "salvato", alimento: MELA });
    const onModificato = vi.fn();
    render(
      <CreaAlimentoForm
        userId="u1"
        nomeIniziale=""
        etichettaIndietro="Alimenti"
        etichettaCrea="Crea"
        onAnnulla={() => {}}
        onCreato={() => {}}
        onApriEsistente={() => {}}
        puoAprire={() => true}
        alimentoDaModificare={MELA}
        onModificato={onModificato}
        daCodice={{ barcode: NUTELLA, prodotto: PRODOTTO }}
      />
    );

    expect(screen.queryByLabelText("Codice a barre")).toBeNull();
    expect(valore("Nome")).toBe("Mela");
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(onModificato).toHaveBeenCalled());
    expect(salvaAlimento.mock.calls[0][3]).toBeUndefined();
  });
});

// Il codice in modifica (PUNTO_DI_PARTENZA.md §3, "Codice a barre", "Il
// codice in modifica"; branch `alimenti-codice-a-barre`). Proteggono
// quello che sbaglierebbe in silenzio: un codice letto che si salva da
// solo (anche per un submit che dalla scansione risale al Salva); un
// codice già di un altro alimento che si può salvare lo stesso; un codice
// arrivato da un altro dispositivo che si perde, o che fa perdere i valori
// scritti; la riga «Aggiungi codice a barre» nella matita di Aggiungi.
describe("CreaAlimentoForm, il codice in modifica", () => {
  const PATATINE = "8000500310427";
  const KETCHIPS = "8008714001827";
  const SAN_CARLO: Alimento = { ...MELA, id: "patatine", nome: "Patatine", marca: "San Carlo" };

  function apriModifica(alimento: Alimento, aggiungiCodice: boolean) {
    const onModificato = vi.fn();
    const onApriEsistente = vi.fn();
    render(
      <CreaAlimentoForm
        userId="u1"
        nomeIniziale=""
        etichettaIndietro="Torna al catalogo"
        etichettaCrea="Salva"
        onAnnulla={() => {}}
        onCreato={() => {}}
        onApriEsistente={onApriEsistente}
        puoAprire={() => true}
        alimentoDaModificare={alimento}
        onModificato={onModificato}
        aggiungiCodice={aggiungiCodice}
      />
    );
    return { onModificato, onApriEsistente };
  }

  // «Aggiungi codice a barre» → scansione → "Scrivi il codice" → «Usa
  // questo codice», come con la fotocamera negata.
  function leggiCodice(codice: string) {
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi codice a barre" }));
    const scansione = screen.getByRole("dialog", { name: "Scansione del codice a barre" });
    expect(within(scansione).getByText("Codice per «Patatine»")).toBeTruthy();
    fireEvent.click(within(scansione).getByRole("button", { name: /Scrivi il codice/ }));
    fireEvent.change(within(scansione).getByLabelText("Il codice sotto le barre"), {
      target: { value: codice },
    });
    fireEvent.click(within(scansione).getByRole("button", { name: "Usa questo codice" }));
  }

  const salvaPulsante = () => screen.getByRole("button", { name: "Salva" }) as HTMLButtonElement;

  it("con il codice: in sola lettura, senza × né «Aggiungi», e il Salva non passa codici", async () => {
    salvaAlimento.mockResolvedValue({ esito: "salvato", alimento: SAN_CARLO });
    const { onModificato } = apriModifica({ ...SAN_CARLO, barcode: PATATINE }, true);

    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe(PATATINE);
    expect(screen.queryByRole("button", { name: "Togli il codice" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Aggiungi codice a barre" })).toBeNull();

    fireEvent.click(salvaPulsante());
    await waitFor(() => expect(onModificato).toHaveBeenCalled());
    expect(salvaAlimento.mock.calls[0][4]).toBeUndefined();
  });

  it("senza codice, dalla matita di Aggiungi: niente campo e niente «Aggiungi codice a barre»", () => {
    apriModifica(SAN_CARLO, false);

    expect(screen.queryByLabelText("Codice a barre")).toBeNull();
    expect(screen.queryByRole("button", { name: "Aggiungi codice a barre" })).toBeNull();
  });

  it("il codice letto torna nel campo con la ×, non si salva da solo, e Salva lo passa a 13 cifre", async () => {
    salvaAlimento.mockResolvedValue({ esito: "salvato", alimento: SAN_CARLO });
    const { onModificato } = apriModifica(SAN_CARLO, true);

    // UPC-A a 12 cifre: arriva come EAN-13.
    leggiCodice("036000291452");

    expect(screen.queryByRole("dialog", { name: "Scansione del codice a barre" })).toBeNull();
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe(
      "0036000291452"
    );
    expect(screen.getByRole("button", { name: "Togli il codice" })).toBeTruthy();
    expect(screen.getByText("Una volta salvato, il codice non si cambia più.")).toBeTruthy();
    expect(salvaAlimento).not.toHaveBeenCalled();

    fireEvent.click(salvaPulsante());
    await waitFor(() => expect(onModificato).toHaveBeenCalled());
    expect(salvaAlimento.mock.calls[0][2]).toBe("patatine");
    expect(salvaAlimento.mock.calls[0][4]).toBe("0036000291452");
  });

  it("la × toglie il codice: torna «Aggiungi codice a barre», e Salva non passa codici", async () => {
    salvaAlimento.mockResolvedValue({ esito: "salvato", alimento: SAN_CARLO });
    const { onModificato } = apriModifica(SAN_CARLO, true);
    leggiCodice(PATATINE);

    fireEvent.click(screen.getByRole("button", { name: "Togli il codice" }));

    expect(screen.queryByLabelText("Codice a barre")).toBeNull();
    expect(screen.getByRole("button", { name: "Aggiungi codice a barre" })).toBeTruthy();
    fireEvent.click(salvaPulsante());
    await waitFor(() => expect(onModificato).toHaveBeenCalled());
    expect(salvaAlimento.mock.calls[0][4]).toBeUndefined();
  });

  it("codice già di un altro alimento: messaggio sotto il codice con «Apri «Ketchips»», e Salva spento", () => {
    const ketchips = {
      ...MELA,
      id: "ketchips",
      nome: "Ketchips",
      marca: "Amica Chips",
      barcode: KETCHIPS,
    };
    finto.catalogo = [ketchips, SAN_CARLO];
    const { onApriEsistente } = apriModifica(SAN_CARLO, true);

    leggiCodice(KETCHIPS);

    expect(
      screen.getByText("Hai già un alimento con questo codice a barre: «Ketchips · Amica Chips».")
    ).toBeTruthy();
    expect(screen.getByLabelText("Codice a barre").getAttribute("aria-invalid")).toBe("true");
    expect(salvaPulsante().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Apri «Ketchips»" }));
    // In modifica non si porta nessun codice: "Apri" come sempre.
    expect(onApriEsistente).toHaveBeenCalledWith(ketchips, undefined);
  });

  it("codice arrivato da un altro dispositivo al Salva: lo dice, campo senza ×, valori restano, il secondo Salva salva", async () => {
    salvaAlimento
      .mockResolvedValueOnce({ esito: "ha-gia-codice", barcode: KETCHIPS })
      .mockResolvedValueOnce({ esito: "salvato", alimento: SAN_CARLO });
    const { onModificato } = apriModifica(SAN_CARLO, true);
    leggiCodice(PATATINE);
    fireEvent.change(screen.getByLabelText("Calorie (kcal)"), { target: { value: "537" } });

    fireEvent.click(salvaPulsante());

    expect(
      await screen.findByText(
        `Intanto questo alimento ha ricevuto il codice ${KETCHIPS} da un altro dispositivo.`
      )
    ).toBeTruthy();
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe(KETCHIPS);
    expect(screen.queryByRole("button", { name: "Togli il codice" })).toBeNull();
    expect(valore("Calorie (kcal)")).toBe("537");
    expect(onModificato).not.toHaveBeenCalled();

    fireEvent.click(salvaPulsante());
    await waitFor(() => expect(onModificato).toHaveBeenCalled());
    expect(salvaAlimento.mock.calls[1][4]).toBeUndefined();
    expect(salvaAlimento.mock.calls[1][1]).toMatchObject({ kcal_100g: 537 });
  });
});

// "Apri" è un pulsante sotto «Hai già …», con il solo nome (Davide, 07/11):
// vale per ogni doppione, qui per nome e marca in creazione.
describe("CreaAlimentoForm, «Apri «nome»»", () => {
  it("è un pulsante con il nome dell'alimento che c'è già, e lo apre", () => {
    const pane = { ...MELA, id: "pane", nome: "Pane", marca: "Mulino" };
    finto.catalogo = [pane];
    const onApriEsistente = vi.fn();
    render(
      <CreaAlimentoForm
        userId="u1"
        nomeIniziale="Pane"
        etichettaIndietro="Torna alla ricerca"
        etichettaCrea="Crea e scegli la quantità"
        onAnnulla={() => {}}
        onCreato={() => {}}
        onApriEsistente={onApriEsistente}
        puoAprire={() => true}
      />
    );
    fireEvent.change(screen.getByLabelText(/Marca/), { target: { value: "Mulino" } });

    expect(
      screen.getByText("Hai già un alimento con questo nome e questa marca: «Pane · Mulino».")
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apri «Pane»" }));
    // Un modulo che non nasce da un codice non ne porta nessuno.
    expect(onApriEsistente).toHaveBeenCalledWith(pane, undefined);
  });
});

// "Apri" porta il codice (PUNTO_DI_PARTENZA.md §3, "«Apri» porta il
// codice"): solo da un modulo nato da un codice, solo per un doppione per
// nome e marca, solo verso un alimento senza codice.
describe("CreaAlimentoForm, «Apri» porta il codice", () => {
  const NUTELLA = "3017620422003";
  const PRODOTTO: ProdottoOpenFoodFacts = {
    nome: "Nutella",
    marca: null,
    kcal_100g: 539,
    proteine_100g: 6.3,
    carboidrati_100g: 57.5,
    grassi_100g: 30.9,
    kcalDaKj: false,
  };

  function apriDaCodice() {
    const onApriEsistente = vi.fn();
    render(
      <CreaAlimentoForm
        userId="u1"
        nomeIniziale=""
        etichettaIndietro="Torna alla ricerca"
        etichettaCrea="Crea e scegli la quantità"
        onAnnulla={() => {}}
        onCreato={() => {}}
        onApriEsistente={onApriEsistente}
        puoAprire={() => true}
        daCodice={{ barcode: NUTELLA, prodotto: PRODOTTO }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Apri «Nutella»" }));
    return onApriEsistente;
  }

  it("uguale per nome e marca, senza codice: il codice va con «Apri»", () => {
    const mia = { ...MELA, id: "mia", nome: "Nutella", barcode: null };
    finto.catalogo = [mia];

    expect(apriDaCodice()).toHaveBeenCalledWith(mia, NUTELLA);
  });

  it("uguale per nome e marca ma con un altro codice: «Apri» senza codice", () => {
    const mia = { ...MELA, id: "mia", nome: "Nutella", barcode: "96385074" };
    finto.catalogo = [mia];

    expect(apriDaCodice()).toHaveBeenCalledWith(mia, undefined);
  });

  it("codiceIniziale, «Salva e scegli la quantità» e niente Elimina: Salva passa il codice", async () => {
    salvaAlimento.mockResolvedValue({ esito: "salvato", alimento: MELA });
    const onModificato = vi.fn();
    render(
      <CreaAlimentoForm
        userId="u1"
        nomeIniziale=""
        etichettaIndietro="Torna alla ricerca"
        etichettaCrea="Crea e scegli la quantità"
        onAnnulla={() => {}}
        onCreato={() => {}}
        onApriEsistente={() => {}}
        puoAprire={() => true}
        alimentoDaModificare={MELA}
        onModificato={onModificato}
        codiceIniziale={NUTELLA}
        etichettaSalva="Salva e scegli la quantità"
        senzaElimina
      />
    );

    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe(NUTELLA);
    expect(screen.getByRole("button", { name: "Togli il codice" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Elimina" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Salva e scegli la quantità" }));
    await waitFor(() => expect(onModificato).toHaveBeenCalledWith(MELA));
    expect(salvaAlimento.mock.calls[0][4]).toBe(NUTELLA);
  });
});
