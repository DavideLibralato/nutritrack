// Test permanente sulla pagina Oggi: "Elimina" dallo sheet quantità deve
// passare dalla stessa fotografia di Elimina dal menu contestuale
// (PUNTO_DI_PARTENZA.md, sezione 3, "Tieni premuto"), cioè mostrare la
// barra con "Annulla" e, al tocco, riportare la voce identica. Prima del
// passo B lo sheet cancellava e basta: niente barra, niente modo di
// tornare indietro. Il test passa dalla pagina vera (tocco sulla voce,
// Elimina, Annulla) e non solo dalla funzione sotto, perché quello
// che si può rompere in silenzio è il collegamento fra i due.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import OggiPage from "./page";
import { repositoryPasti, repositoryVociDiario } from "@/lib/repository";
import { idVoceRicreata } from "@/lib/repository/vociDiario";
import { SCADENZA_BLOCCO_CLICK_MS } from "@/lib/decisioneSwipe";
import { formattaDataEstesa, formattaGiornoCorto, giornoPrecedente, giornoSuccessivo, oggiLocale } from "@/lib/dataGiorno";
import type { VoceDiario } from "@/lib/db/tipi";

// Un utente nuovo per ogni test: il database finto è lo stesso per tutto il
// file, e i test contano le voci dell'utente.
let utenteTest = "";
beforeEach(() => {
  utenteTest = `utente-oggi-${crypto.randomUUID()}`;
});

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => utenteTest,
  useNomeUtente: () => null,
  useEmailUtente: () => null,
}));

// Il router di Next.js fuori dall'app vera non esiste: qui un finto vuoto.
// `parametri` è il ?giorno= con cui si apre la pagina: vuoto, salvo nei
// test della navigazione che lo impostano.
let parametri = new URLSearchParams();
beforeEach(() => {
  parametri = new URLSearchParams();
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => parametri,
}));

// Rete assente: si esercita solo la parte locale (Dexie + outbox).
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
  }),
}));

// Senza `globals` in vitest.config la pulizia automatica di Testing Library
// non parte: si smonta a mano.
afterEach(cleanup);

// Il testo intero della barra in basso, come lo legge chi la guarda (e lo
// screen reader): verbo, nome e dettaglio con i loro spazi, senza i
// pulsanti. Prima del 6/10 le parti erano separate solo da spazio grafico.
async function testoBarra(atteso: string) {
  await waitFor(() =>
    expect(screen.getByRole("status").querySelector("p")?.textContent).toBe(atteso)
  );
}

function contenutoVisibile(v: VoceDiario) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, updated_at, deleted_at, ...resto } = v;
  return resto;
}

describe("Oggi: Elimina dallo sheet quantità", () => {
  it("mostra «Eliminato» con Annulla, e Annulla riporta la voce identica", async () => {
    const pasto = await repositoryPasti.crea({
      user_id: utenteTest,
      nome: "Pranzo",
      ora_inizio: "12:30",
      ordine: 0,
    });
    const voce = await repositoryVociDiario.crea({
      user_id: utenteTest,
      alimento_id: "alimento-pane",
      pasto_id: pasto.id,
      gruppo_id: null,
      quantita_g: 80,
      data: oggiLocale(),
      creato_il: "2026-10-06T12:00:00.000Z",
      consumato_alle: "2026-10-06T12:05:00.000Z",
      nome_alimento: "Pane",
      kcal_100g: 250,
      proteine_100g: 8,
      carboidrati_100g: 50,
      grassi_100g: 1,
    });

    render(<OggiPage />);

    // Tocco sulla voce: si apre lo sheet in modifica.
    fireEvent.click((await screen.findByText("Pane")).closest("button")!);
    // Un tocco solo: niente conferma, c'è "Annulla" dopo.
    fireEvent.click(await screen.findByRole("button", { name: "Elimina" }));
    expect(screen.queryByRole("button", { name: "Sì, elimina" })).toBeNull();

    // La barra, come per Elimina dal menu.
    await testoBarra("Eliminato: Pane");
    await waitFor(async () => {
      expect(await repositoryVociDiario.ottieniTutti(utenteTest)).toHaveLength(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));

    await screen.findByText("Annullato.");
    const vive = await repositoryVociDiario.ottieniTutti(utenteTest);
    expect(vive).toHaveLength(1);
    // Stesso contenuto (quantità, pasto, giorno, valori), riga ricreata
    // con l'id deterministico dell'annullo.
    expect(contenutoVisibile(vive[0])).toEqual(contenutoVisibile(voce));
    expect(vive[0].id).toBe(idVoceRicreata(voce.id));
  });
});

// Bug del 6/10 su iPhone: tieni premuto un alimento, si apre il menu, un
// tocco fuori lo chiude — e da lì la lista non scorreva più e il
// tieni-premuto non riapriva il menu, fino a ricaricare la pagina. Lo stato
// che dà esattamente questo: il gesto rimasto "aperto" nell'hook (touchmove
// bloccati, lista con overflow hidden, ogni nuovo tocco scartato come
// "secondo dito"), perché la fine del tocco che aveva aperto il menu —
// comparso sotto il dito ancora appoggiato — non arrivava alla lista.
// Qui la fine di quel tocco non arriva mai, come su Safari: dopo il tocco
// fuori tutto deve tornare a funzionare lo stesso.
describe("Oggi: menu del tieni-premuto chiuso con un tocco fuori", () => {
  function puntatore(tipo: string, el: Element, pointerId: number) {
    fireEvent(
      el,
      new PointerEvent(tipo, {
        bubbles: true,
        cancelable: true,
        pointerId,
        isPrimary: true,
        pointerType: "touch",
        button: 0,
        clientX: 50,
        clientY: 50,
      })
    );
  }

  async function preparaPane() {
    const pasto = await repositoryPasti.crea({
      user_id: utenteTest,
      nome: "Pranzo",
      ora_inizio: "12:30",
      ordine: 0,
    });
    await repositoryVociDiario.crea({
      user_id: utenteTest,
      alimento_id: "alimento-pane",
      pasto_id: pasto.id,
      gruppo_id: null,
      quantita_g: 80,
      data: oggiLocale(),
      creato_il: "2026-10-06T12:00:00.000Z",
      consumato_alle: null,
      nome_alimento: "Pane",
      kcal_100g: 250,
      proteine_100g: 8,
      carboidrati_100g: 50,
      grassi_100g: 1,
    });
    render(<OggiPage />);
    const riga = (await screen.findByText("Pane")).closest("button")!;
    // La lista che scorre: quella con gli ascoltatori del gesto.
    const lista = riga.closest("ul")!.parentElement!.closest("ul")!;
    return { riga, lista };
  }

  // Tieni premuto fermo: dopo 450 + 160 ms il menu si apre, dito ancora giù.
  // Si aspetta che compaia invece di un tempo fisso: con tutto il file in
  // esecuzione i timer di jsdom possono scattare in ritardo.
  async function tieniPremuto(riga: Element, pointerId: number) {
    puntatore("pointerdown", riga, pointerId);
    await screen.findByRole("menu", undefined, { timeout: 3000 });
  }

  async function toccaFuori() {
    const sfondo = screen.getByRole("menu").parentElement!;
    puntatore("pointerdown", sfondo, 99);
    puntatore("pointerup", sfondo, 99);
    fireEvent.click(sfondo, { detail: 1 });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  }

  function touchmoveBloccato(el: Element): boolean {
    const ev = new Event("touchmove", { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  }

  it("la fine del tocco non arriva: dopo il tocco fuori lista e gesto tornano liberi", async () => {
    const { riga, lista } = await preparaPane();

    await tieniPremuto(riga, 1);
    // Nessun pointerup per il dito 1: è il caso di Safari.

    await toccaFuori();

    expect(lista.style.overflowY).toBe("");
    expect(touchmoveBloccato(riga)).toBe(false);

    // Un nuovo tieni-premuto riapre il menu.
    await tieniPremuto(riga, 2);
    puntatore("pointerup", lista, 2);
  });

  it("la fine del tocco arriva (il caso normale): stesso risultato", async () => {
    const { riga, lista } = await preparaPane();

    await tieniPremuto(riga, 1);
    puntatore("pointerup", lista, 1);

    await toccaFuori();

    expect(lista.style.overflowY).toBe("");
    expect(touchmoveBloccato(riga)).toBe(false);
    await tieniPremuto(riga, 2);
    puntatore("pointerup", lista, 2);
  });
});

// Il giro completo di "Sposta" dal menu, sulla pagina vera: menu → scelta del
// pasto → foglio dei doppioni → barra → Annulla. I test delle regole
// (pianoSpostamento) e dei testi non vedono il collegamento fra i pezzi:
// qui si controlla che sia quello giusto. Due doppioni con due scelte
// diverse: le scelte sono una PER ALIMENTO (mockup del 5/10), e un foglio
// che applicasse la stessa scelta a tutti farebbe fallire il test.
describe("Oggi: Sposta dal menu con due doppioni", () => {
  async function prepara() {
    const colazione = await repositoryPasti.crea({ user_id: utenteTest, nome: "Colazione", ora_inizio: "07:00", ordine: 0 });
    const pranzo = await repositoryPasti.crea({ user_id: utenteTest, nome: "Pranzo", ora_inizio: "12:30", ordine: 1 });
    const voce = (nome: string, pastoId: string, quantita_g: number) =>
      repositoryVociDiario.crea({
        user_id: utenteTest,
        alimento_id: `alimento-${nome}`,
        pasto_id: pastoId,
        gruppo_id: null,
        quantita_g,
        data: oggiLocale(),
        creato_il: "2026-10-06T08:00:00.000Z",
        consumato_alle: null,
        nome_alimento: nome,
        kcal_100g: 60,
        proteine_100g: 4,
        carboidrati_100g: 5,
        grassi_100g: 2,
      });
    await voce("Yogurt", colazione.id, 125);
    await voce("Mela", colazione.id, 150);
    await voce("Yogurt", pranzo.id, 100);
    await voce("Mela", pranzo.id, 80);
    const diario = async () =>
      (await repositoryVociDiario.ottieniTutti(utenteTest))
        .map((v) => `${v.pasto_id === pranzo.id ? "Pranzo" : "Colazione"} ${v.nome_alimento} ${v.quantita_g}`)
        .sort();

    render(<OggiPage />);
    // Il menu da tasto destro / tastiera, sul nome del pasto: niente timer.
    const titolo = (await screen.findAllByText("Colazione")).find((el) => el.closest("[data-tieni-premuto]"))!;
    fireEvent.contextMenu(titolo.closest("button")!);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sposta" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Pranzo" }));
    await screen.findByText("2 alimenti ci sono già in «Pranzo»");
    return { diario };
  }

  it("Somma sullo yogurt, Non spostarlo sulla mela; Annulla riporta tutto com'era", async () => {
    const { diario } = await prepara();
    const prima = await diario();

    const yogurt = screen.getByRole("group", { name: "Yogurt" });
    const mela = screen.getByRole("group", { name: "Mela" });
    expect(within(yogurt).getByRole("radio", { name: "Somma (225 g)" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(mela).getByRole("radio", { name: "Non spostarlo" }));
    within(mela).getByText("→ Resta in Colazione, non si sposta");
    within(yogurt).getByText("→ Una riga da 225 g");
    expect(await diario()).toEqual(prima); // finché non si conferma, niente

    fireEvent.click(screen.getByRole("button", { name: "Sposta" }));

    await screen.findByText("Spostato: «Colazione» → «Pranzo» (tranne «Mela», rimasto in «Colazione»).");
    await waitFor(async () =>
      expect(await diario()).toEqual(["Colazione Mela 150", "Pranzo Mela 80", "Pranzo Yogurt 225"])
    );

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    await screen.findByText("Annullato.");
    expect(await diario()).toEqual(prima);
  });

  it("Scrivi quantità vuoto: bottone spento e «Per salvare mancano» col nome", async () => {
    await prepara();
    fireEvent.click(within(screen.getByRole("group", { name: "Mela" })).getByRole("radio", { name: "Scrivi quantità" }));
    expect((screen.getByRole("button", { name: "Sposta" }) as HTMLButtonElement).disabled).toBe(true);
    screen.getByText("Per salvare mancano: Mela.");
    fireEvent.change(screen.getByLabelText("Quantità"), { target: { value: "120" } });
    expect((screen.getByRole("button", { name: "Sposta" }) as HTMLButtonElement).disabled).toBe(false);
    within(screen.getByRole("group", { name: "Mela" })).getByText("→ Una riga da 120 g (scritta a mano)");
  });

  it("chiudere il foglio dei doppioni non scrive niente", async () => {
    await prepara();
    const prima = (await repositoryVociDiario.ottieniTutti(utenteTest)).map((v) => v.updated_at).sort();

    // Tocco fuori: lo sfondo scurito.
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const dopo = (await repositoryVociDiario.ottieniTutti(utenteTest)).map((v) => v.updated_at).sort();
    expect(dopo).toEqual(prima);
    expect(screen.queryByText(/Spostato/)).toBeNull();
  });
});

// Il trascinamento (passo D) sulla pagina vera. jsdom non calcola il layout
// (ogni elemento è largo e alto 0): i rettangoli dei pasti, della lista e
// della fascia di "+ Aggiungi" li diamo noi. Colazione da y 100 a 200,
// Pranzo da 200 a 300, lista visibile da 50 a 650, "+ Aggiungi" da 700.
describe("Oggi: trascinare un alimento su un altro pasto", () => {
  const rettangoli: Record<string, { top: number; bottom: number }> = {};
  afterEach(async () => {
    vi.restoreAllMocks();
    // Ogni rilascio ferma il click seguente per SCADENZA_BLOCCO_CLICK_MS su
    // tutta la pagina (bloccaClickFantasma): voluto nell'app, ma il blocco
    // sta su window e sopravvive alla pulizia, e si mangerebbe il primo
    // click del test dopo. Si aspetta che scada.
    await new Promise((r) => setTimeout(r, SCADENZA_BLOCCO_CLICK_MS + 50));
  });

  async function prepara() {
    const colazione = await repositoryPasti.crea({ user_id: utenteTest, nome: "Colazione", ora_inizio: "07:00", ordine: 0 });
    const pranzo = await repositoryPasti.crea({ user_id: utenteTest, nome: "Pranzo", ora_inizio: "12:30", ordine: 1 });
    // Cena è più in basso, in parte sotto la fine della lista visibile:
    // ci si arriva solo con lo scorrimento automatico.
    const cena = await repositoryPasti.crea({ user_id: utenteTest, nome: "Cena", ora_inizio: "19:30", ordine: 2 });
    rettangoli[colazione.id] = { top: 100, bottom: 200 };
    rettangoli[pranzo.id] = { top: 200, bottom: 300 };
    rettangoli[cena.id] = { top: 640, bottom: 900 };
    const comune = {
      user_id: utenteTest,
      alimento_id: "alimento-yogurt",
      gruppo_id: null,
      data: oggiLocale(),
      creato_il: "2026-10-06T08:00:00.000Z",
      consumato_alle: null,
      nome_alimento: "Yogurt",
      kcal_100g: 60,
      proteine_100g: 4,
      carboidrati_100g: 5,
      grassi_100g: 2,
    };
    await repositoryVociDiario.crea({ ...comune, pasto_id: colazione.id, quantita_g: 125 });
    await repositoryVociDiario.crea({ ...comune, pasto_id: pranzo.id, quantita_g: 100 });

    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const r = (top: number, bottom: number) =>
        ({ top, bottom, left: 16, right: 374, width: 358, height: bottom - top, x: 16, y: top }) as DOMRect;
      const el = this as HTMLElement;
      if (el.dataset.pastoId && rettangoli[el.dataset.pastoId]) {
        const { top, bottom } = rettangoli[el.dataset.pastoId];
        return r(top, bottom);
      }
      if (el.hasAttribute("data-pulsante-aggiungi")) return r(700, 800);
      if (el.tagName === "UL" && el.querySelector(":scope > [data-pasto-id]")) return r(50, 650);
      return r(0, 0);
    });

    render(<OggiPage />);
    const righe = await screen.findAllByText("Yogurt");
    const riga = righe.map((el) => el.closest("button")!).find((b) =>
      b.closest(`[data-pasto-id="${colazione.id}"]`)
    )!;
    const lista = riga.closest("ul")!.parentElement!.closest("ul")!;
    const firme = async () =>
      (await repositoryVociDiario.ottieniTutti(utenteTest)).map((v) => v.updated_at).sort();
    return { riga, lista, pranzo, cena, firme };
  }

  function puntatore(tipo: string, el: Element, x: number, y: number) {
    fireEvent(
      el,
      new PointerEvent(tipo, {
        bubbles: true,
        cancelable: true,
        pointerId: 5,
        isPrimary: true,
        pointerType: "touch",
        button: 0,
        clientX: x,
        clientY: y,
      })
    );
  }

  // Tieni premuto finché la riga si solleva, poi muovi subito: ramo
  // "trascina" (dentro la finestra di 160 ms).
  async function iniziaTrascinamento(riga: Element, lista: Element) {
    puntatore("pointerdown", riga, 100, 150);
    await waitFor(() => expect(riga.hasAttribute("data-sollevato")).toBe(true), {
      interval: 5,
      timeout: 3000,
    });
    puntatore("pointermove", lista, 100, 170);
  }

  it("rilascio su un pasto con lo stesso alimento: si apre il foglio dei doppioni", async () => {
    const { riga, lista, pranzo, firme } = await prepara();
    const prima = await firme();

    await iniziaTrascinamento(riga, lista);
    puntatore("pointermove", lista, 100, 250);
    // Il pasto sotto il dito è evidenziato.
    await waitFor(() =>
      expect(document.querySelector(`[data-pasto-id="${pranzo.id}"]`)!.hasAttribute("data-bersaglio-attivo")).toBe(
        true
      )
    );
    puntatore("pointerup", lista, 100, 250);

    await screen.findByText("«Yogurt» c'è già in «Pranzo»");
    expect(await firme()).toEqual(prima); // il foglio non ha scritto niente
  });

  it("rilascio fuori da un pasto (sopra la zona di + Aggiungi): niente si scrive", async () => {
    const { riga, lista, firme } = await prepara();
    const prima = await firme();

    await iniziaTrascinamento(riga, lista);
    puntatore("pointermove", lista, 100, 720);
    puntatore("pointerup", lista, 100, 720);

    await waitFor(() => expect(document.querySelector("[data-bersaglio]")).toBeNull());
    // Un foglio aperto per errore arriverebbe dopo una lettura da Dexie:
    // si aspetta un po' prima di dire che non c'è.
    await expect(screen.findByRole("dialog", undefined, { timeout: 500 })).rejects.toThrow();
    expect(await firme()).toEqual(prima);
  });

  it("gesto interrotto dal sistema sopra un pasto valido: niente si scrive", async () => {
    const { riga, lista, firme } = await prepara();
    const prima = await firme();

    await iniziaTrascinamento(riga, lista);
    puntatore("pointermove", lista, 100, 250);
    puntatore("pointercancel", lista, 100, 250);

    await waitFor(() => expect(document.querySelector("[data-bersaglio]")).toBeNull());
    // Un foglio aperto per errore arriverebbe dopo una lettura da Dexie:
    // si aspetta un po' prima di dire che non c'è.
    await expect(screen.findByRole("dialog", undefined, { timeout: 500 })).rejects.toThrow();
    expect(await firme()).toEqual(prima);
  });

  it("dito fermo nella fascia bassa: la lista scorre da sola e il pasto sotto il dito cambia", async () => {
    const { riga, lista, cena } = await prepara();
    // jsdom non calcola le altezze: contenuto di 2000 px in una lista di 600.
    Object.defineProperty(lista, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(lista, "clientHeight", { configurable: true, value: 600 });
    const elCena = document.querySelector(`[data-pasto-id="${cena.id}"]`)!;

    await iniziaTrascinamento(riga, lista);
    // y = 620: dentro la fascia bassa (la zona finisce a 650), fra Pranzo
    // (fino a 300) e Cena (da 640). Sotto il dito non c'è nessun pasto.
    puntatore("pointermove", lista, 100, 620);
    expect(elCena.hasAttribute("data-bersaglio-attivo")).toBe(false);

    // Il dito non si muove più: è la lista che scorre e porta Cena sotto.
    await waitFor(() => expect(elCena.hasAttribute("data-bersaglio-attivo")).toBe(true), {
      timeout: 3000,
    });
    expect(lista.scrollTop).toBeGreaterThan(0);

    // Rilascio lì: Cena è vuota, niente doppioni, lo yogurt si sposta.
    puntatore("pointerup", lista, 100, 620);
    await testoBarra("Spostato: Yogurt → Cena");
  });
});

// Duplica su un altro giorno, sulla pagina vera (passo E): il messaggio dice
// il giorno, la barra ha "Vedi". Dopo "Vedi" si guarda quel giorno, la barra
// resta con "Annulla" ancora valido e "Vedi" sparisce; Annulla toglie solo
// la copia.
describe("Oggi: Duplica su un altro giorno", () => {
  it("«di …» nel messaggio, Vedi porta là, Annulla toglie solo la copia", async () => {
    const pranzo = await repositoryPasti.crea({ user_id: utenteTest, nome: "Pranzo", ora_inizio: "12:30", ordine: 0 });
    const oggi = oggiLocale();
    const ieri = giornoPrecedente(oggi);
    await repositoryVociDiario.crea({
      user_id: utenteTest,
      alimento_id: "alimento-mela",
      pasto_id: pranzo.id,
      gruppo_id: null,
      quantita_g: 150,
      data: oggi,
      creato_il: "2026-10-06T12:00:00.000Z",
      consumato_alle: null,
      nome_alimento: "Mela",
      kcal_100g: 52,
      proteine_100g: 0.3,
      carboidrati_100g: 14,
      grassi_100g: 0.2,
    });
    const diario = async () =>
      (await repositoryVociDiario.ottieniTutti(utenteTest)).map((v) => `${v.data} ${v.nome_alimento}`).sort();

    render(<OggiPage />);
    fireEvent.contextMenu((await screen.findByText("Mela")).closest("button")!);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplica" }));
    const foglio = await screen.findByRole("dialog", { name: "Duplica «Mela»" });
    fireEvent.change(within(foglio).getByLabelText("Giorno"), { target: { value: ieri } });
    fireEvent.click(within(foglio).getByRole("button", { name: "Duplica" }));

    await testoBarra(`Duplicato: Mela in Pranzo di ${formattaGiornoCorto(ieri)}`);
    await waitFor(async () => expect(await diario()).toEqual([`${ieri} Mela`, `${oggi} Mela`]));

    fireEvent.click(screen.getByRole("button", { name: "Vedi" }));
    // Si guarda ieri: la copia è lì, la barra c'è ancora, "Vedi" no.
    await waitFor(() => expect(screen.queryByRole("button", { name: "Vedi" })).toBeNull());
    await waitFor(() =>
      expect(document.querySelector('[data-tieni-premuto="voce"]')?.textContent).toContain("Mela")
    );
    expect(screen.getByRole("button", { name: "Annulla" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    await screen.findByText("Annullato.");
    expect(await diario()).toEqual([`${oggi} Mela`]);
  });
});

// I messaggi del pasto intero, sulla pagina vera: il testo della barra con
// tutti i nomi (bug del 6/10: il nome spariva e la coda veniva tagliata).
describe("Oggi: messaggi di Sposta e Duplica per un pasto intero", () => {
  async function prepara() {
    const colazione = await repositoryPasti.crea({ user_id: utenteTest, nome: "Colazione", ora_inizio: "07:00", ordine: 0 });
    const pranzo = await repositoryPasti.crea({ user_id: utenteTest, nome: "Pranzo", ora_inizio: "12:30", ordine: 1 });
    await repositoryVociDiario.crea({
      user_id: utenteTest,
      alimento_id: "alimento-pane",
      pasto_id: colazione.id,
      gruppo_id: null,
      quantita_g: 50,
      data: oggiLocale(),
      creato_il: "2026-10-06T08:00:00.000Z",
      consumato_alle: null,
      nome_alimento: "Pane",
      kcal_100g: 250,
      proteine_100g: 8,
      carboidrati_100g: 50,
      grassi_100g: 1,
    });
    render(<OggiPage />);
    const titolo = (await screen.findAllByText("Colazione")).find((el) => el.closest("[data-tieni-premuto]"))!;
    fireEvent.contextMenu(titolo.closest("button")!);
    return { pranzo };
  }

  it("Sposta: «Spostato: Colazione → Pranzo»", async () => {
    await prepara();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sposta" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Pranzo" }));
    await testoBarra("Spostato: Colazione → Pranzo");
  });

  it("Duplica su ieri: «Duplicato: Colazione in Pranzo di …»", async () => {
    const { pranzo } = await prepara();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplica" }));
    const foglio = await screen.findByRole("dialog", { name: "Duplica «Colazione»" });
    const ieri = giornoPrecedente(oggiLocale());
    fireEvent.change(within(foglio).getByLabelText("Giorno"), { target: { value: ieri } });
    fireEvent.change(within(foglio).getByLabelText("Pasto"), { target: { value: pranzo.id } });
    fireEvent.click(within(foglio).getByRole("button", { name: "Duplica" }));
    await testoBarra(`Duplicato: Colazione in Pranzo di ${formattaGiornoCorto(ieri)}`);
  });
});

// Rete di sicurezza (sezione 3, "I pasti"): un pasto che quel giorno non
// vale più (chiuso prima, o cancellato) ma ha ancora voci si mostra lo
// stesso, con "Non più in uso", così ogni voce che conta nei totali ha la
// sua riga. Non riceve voci: non è un bersaglio del trascinamento né una
// destinazione di Sposta.
describe("Oggi: pasti non più in uso con voci in quel giorno", () => {
  async function prepara() {
    const ieri = giornoPrecedente(oggiLocale());
    const colazione = await repositoryPasti.crea({ user_id: utenteTest, nome: "Colazione", ora_inizio: "07:00", ordine: 0 });
    const pranzo = await repositoryPasti.crea({ user_id: utenteTest, nome: "Pranzo", ora_inizio: "12:30", ordine: 1 });
    // Chiusa ieri: oggi non vale più.
    const merenda = await repositoryPasti.crea({
      user_id: utenteTest, nome: "Merenda", ora_inizio: "16:00", ordine: 2, valido_al: ieri,
    });
    // Chiusa ieri, e senza voci oggi: non deve comparire.
    await repositoryPasti.crea({
      user_id: utenteTest, nome: "Spuntino sera", ora_inizio: "21:30", ordine: 3, valido_al: ieri,
    });
    const voce = (nome: string, pastoId: string) =>
      repositoryVociDiario.crea({
        user_id: utenteTest,
        alimento_id: `alimento-${nome}`,
        pasto_id: pastoId,
        gruppo_id: null,
        quantita_g: 100,
        data: oggiLocale(),
        creato_il: "2026-10-09T08:00:00.000Z",
        consumato_alle: null,
        nome_alimento: nome,
        kcal_100g: 100,
        proteine_100g: 4,
        carboidrati_100g: 5,
        grassi_100g: 2,
      });
    await voce("Yogurt", colazione.id);
    await voce("Biscotti", merenda.id);
    render(<OggiPage />);
    await screen.findByText("Biscotti");
    return { colazione, pranzo, merenda };
  }

  it("si mostra con «Non più in uso», al suo posto per orario; senza voci no", async () => {
    const { merenda } = await prepara();
    const titoli = [...document.querySelectorAll("li.pasto-trascinamento")].map(
      (li) => li.querySelector("span.truncate, span.text-lg")?.textContent
    );
    expect(titoli).toEqual(["Colazione", "Pranzo", "Merenda"]);
    expect(screen.queryByText("Spuntino sera")).toBeNull();

    const liMerenda = screen.getByText("Merenda").closest("li")!;
    expect(within(liMerenda).getByText("Non più in uso")).toBeTruthy();
    expect(within(liMerenda).getByText("100 kcal")).toBeTruthy();
    // Non è un bersaglio del trascinamento.
    expect(document.querySelector(`[data-pasto-id="${merenda.id}"]`)).toBeNull();
  });

  it("non è una destinazione di Sposta, ma da lì le voci si portano via", async () => {
    await prepara();
    const yogurt = screen.getByText("Yogurt").closest("button")!;
    fireEvent.contextMenu(yogurt);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sposta" }));
    const foglio = await screen.findByRole("dialog");
    expect(within(foglio).queryByRole("button", { name: "Merenda" })).toBeNull();
    expect(within(foglio).getByRole("button", { name: "Pranzo" })).toBeTruthy();
    fireEvent.click(within(foglio).getByRole("button", { name: "Annulla" }));

    const biscotti = screen.getByText("Biscotti").closest("button")!;
    fireEvent.contextMenu(biscotti);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sposta" }));
    const foglio2 = await screen.findByRole("dialog");
    expect(within(foglio2).getByRole("button", { name: "Colazione" })).toBeTruthy();
  });

  it("nello sheet della voce il menu mostra il suo pasto, con l'etichetta, e i pasti di oggi", async () => {
    await prepara();
    fireEvent.click(screen.getByText("Biscotti").closest("button")!);
    const menu = (await screen.findByLabelText("Pasto")) as HTMLSelectElement;
    expect([...menu.options].map((o) => o.textContent)).toEqual([
      "Colazione",
      "Pranzo",
      "Merenda · non più in uso",
    ]);
    expect(menu.selectedOptions[0].textContent).toBe("Merenda · non più in uso");
  });
});

describe("Oggi: navigazione fino a oggi + 7", () => {
  // Il giorno a "n" giorni da oggi, con le funzioni dell'app.
  function traGiorni(n: number) {
    let d = oggiLocale();
    for (let i = 0; i < n; i++) d = giornoSuccessivo(d);
    return d;
  }

  async function apri(giorno?: string) {
    if (giorno) parametri = new URLSearchParams({ giorno });
    if ((await repositoryPasti.ottieniTutti(utenteTest)).length === 0) {
      await repositoryPasti.crea({ user_id: utenteTest, nome: "Pranzo", ora_inizio: "12:30", ordine: 0 });
    }
    render(<OggiPage />);
    await screen.findByText("Pranzo");
    return {
      avanti: screen.getByRole("button", { name: "Giorno successivo" }) as HTMLButtonElement,
      calendario: document.querySelector('input[type="date"]') as HTMLInputElement,
    };
  }

  // Il giorno mostrato, dall'etichetta per esteso del titolo-data.
  function giornoMostrato(iso: string) {
    return screen.getByRole("button", { name: `Cambia data, ${formattaDataEstesa(iso)}` });
  }

  it("da oggi si va avanti; a oggi + 7 la freccia si spegne", async () => {
    const { avanti } = await apri();
    for (let n = 1; n <= 7; n++) {
      expect(avanti.disabled).toBe(false);
      fireEvent.click(avanti);
      giornoMostrato(traGiorni(n));
    }
    expect(avanti.disabled).toBe(true);
    // Su un giorno futuro c'è il pulsante per tornare a oggi.
    fireEvent.click(screen.getByRole("button", { name: "Oggi" }));
    giornoMostrato(oggiLocale());
  });

  it("?giorno= fino a oggi + 7 apre quel giorno; oltre, oggi", async () => {
    await apri(traGiorni(7));
    giornoMostrato(traGiorni(7));
    cleanup();

    await apri(traGiorni(8));
    giornoMostrato(oggiLocale());
  });

  it("il calendario arriva a oggi + 7 e ignora una data oltre, digitata a mano", async () => {
    const { calendario } = await apri();
    expect(calendario.max).toBe(traGiorni(7));
    fireEvent.change(calendario, { target: { value: traGiorni(8) } });
    giornoMostrato(oggiLocale());
    fireEvent.change(calendario, { target: { value: traGiorni(3) } });
    giornoMostrato(traGiorni(3));
  });
});

describe("Oggi: il giorno cambia mentre la pagina è aperta", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function visibilita(stato: "visible" | "hidden") {
    Object.defineProperty(document, "visibilityState", { value: stato, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }

  function giornoMostrato(iso: string) {
    return screen.getByRole("button", { name: `Cambia data, ${formattaDataEstesa(iso)}` });
  }

  // Sabato 10/10 alle 22, guardando giovedì 8 (o un altro giorno).
  async function apri(giorno: string) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 10, 22, 0, 0));
    parametri = new URLSearchParams({ giorno });
    const pranzo = await repositoryPasti.crea({ user_id: utenteTest, nome: "Pranzo", ora_inizio: "12:30", ordine: 0 });
    await repositoryVociDiario.crea({
      user_id: utenteTest, alimento_id: "alimento-mela", pasto_id: pranzo.id, gruppo_id: null,
      quantita_g: 150, data: giorno, creato_il: "2026-10-10T08:00:00.000Z", consumato_alle: null,
      nome_alimento: "Mela", kcal_100g: 52, proteine_100g: 0.3, carboidrati_100g: 14, grassi_100g: 0.2,
    });
    render(<OggiPage />);
    await screen.findByText("Mela");
    giornoMostrato(giorno);
  }

  it("riaperta il giorno dopo: va sul nuovo oggi, da un giorno passato", async () => {
    await apri("2026-10-08");
    act(() => visibilita("hidden"));
    vi.setSystemTime(new Date(2026, 9, 11, 7, 30, 0));
    act(() => visibilita("visible"));

    await waitFor(() => giornoMostrato("2026-10-11"));
    // È oggi: niente pulsante "Oggi".
    expect(screen.queryByRole("button", { name: "Oggi" })).toBeNull();
  });

  it("anche da un giorno futuro", async () => {
    await apri("2026-10-14");
    vi.setSystemTime(new Date(2026, 9, 11, 7, 30, 0));
    act(() => visibilita("visible"));
    await waitFor(() => giornoMostrato("2026-10-11"));
  });

  it("con lo sheet di una voce aperto: lo chiude e salta subito", async () => {
    await apri("2026-10-08");
    fireEvent.click(screen.getByText("Mela").closest("button")!);
    await screen.findByLabelText("Pasto");

    vi.setSystemTime(new Date(2026, 9, 11, 7, 30, 0));
    act(() => visibilita("visible"));

    await waitFor(() => giornoMostrato("2026-10-11"));
    expect(screen.queryByLabelText("Pasto")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("con il foglio di Sposta aperto: lo chiude e salta, e la voce di giovedì non si muove", async () => {
    await apri("2026-10-08");
    fireEvent.contextMenu(screen.getByText("Mela").closest("button")!);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sposta" }));
    await screen.findByRole("dialog");

    vi.setSystemTime(new Date(2026, 9, 11, 7, 30, 0));
    act(() => visibilita("visible"));

    await waitFor(() => giornoMostrato("2026-10-11"));
    expect(screen.queryByRole("dialog")).toBeNull();
    // Niente è stato scritto: la Mela è ancora giovedì, nel suo pasto.
    const voci = await repositoryVociDiario.ottieniTutti(utenteTest);
    expect(voci.map((v) => v.data)).toEqual(["2026-10-08"]);
  });

  it("con il menu del tieni-premuto aperto: lo chiude e salta", async () => {
    await apri("2026-10-08");
    fireEvent.contextMenu(screen.getByText("Mela").closest("button")!);
    await screen.findByRole("menu");

    vi.setSystemTime(new Date(2026, 9, 11, 7, 30, 0));
    act(() => visibilita("visible"));

    await waitFor(() => giornoMostrato("2026-10-11"));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
