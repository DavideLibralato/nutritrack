// Aggiungi offre i pasti che esistono nel giorno in cui si registra
// (PUNTO_DI_PARTENZA.md, sezione 3, "I pasti"), in ordine d'orario: un
// pasto chiuso o non ancora nato quel giorno non è fra le scelte del
// titolo, e il pasto proposto è sempre uno di quelli. Test permanente: se
// la pagina tornasse a leggere tutte le righe, si potrebbe registrare una
// voce in un pasto che quel giorno non esiste, e nessuno se ne accorgerebbe.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import AggiungiPage from "./page";
import {
  repositoryAlimenti,
  repositoryComposizioni,
  repositoryComposizioniVoci,
  repositoryPasti,
  repositoryVociDiario,
} from "@/lib/repository";
import { giornoPrecedente, giornoSuccessivo, oggiLocale } from "@/lib/dataGiorno";
import { prendiInserimento } from "@/lib/inserimento/ultimoInserimento";
import type { Alimento } from "@/lib/db/tipi";

// Il ritorno a Oggi (router.replace) si guarda da qui.
const navigazione = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

let utenteTest = "";
let parametri = new URLSearchParams();
beforeEach(() => {
  utenteTest = `utente-aggiungi-${crypto.randomUUID()}`;
  parametri = new URLSearchParams();
  navigazione.replace.mockReset();
  navigazione.push.mockReset();
  guasto.guasti = 0;
  prendiInserimento();
});

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => utenteTest,
  useNomeUtente: () => null,
  useEmailUtente: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigazione.push, replace: navigazione.replace, refresh: () => {}, back: () => {} }),
  useSearchParams: () => parametri,
}));

// aggiungiNelPasto vera, tranne quando un test chiede un guasto: allora
// le prossime `guasti` chiamate lanciano, senza scrivere niente.
const guasto = vi.hoisted(() => ({ guasti: 0 }));
vi.mock("@/lib/repository/vociDiario", async (importOriginal) => {
  const vero = await importOriginal<typeof import("@/lib/repository/vociDiario")>();
  return {
    ...vero,
    aggiungiNelPasto: (...argomenti: Parameters<typeof vero.aggiungiNelPasto>) => {
      if (guasto.guasti > 0) {
        guasto.guasti--;
        return Promise.reject(new Error("Guasto finto, nei test."));
      }
      return vero.aggiungiNelPasto(...argomenti);
    },
  };
});

// Il lettore dei codici a barre senza WebAssembly: in jsdom non c'è un
// video da leggere, e i test della scansione passano da "Scrivi il codice".
// `ordine` registra quando parte il caricamento del lettore, per il test
// "getUserMedia prima di tutto".
const ordineScansione = vi.hoisted(() => ({ eventi: [] as string[] }));
vi.mock("@/lib/barcode/lettoreCodice", () => ({
  preparaLettore: () => {
    ordineScansione.eventi.push("lettore");
    return Promise.resolve({ leggi: async () => null });
  },
}));

// Rete assente: si esercita solo la parte locale.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
  }),
}));

afterEach(cleanup);

async function preparaPasti() {
  const oggi = oggiLocale();
  const ieri = giornoPrecedente(oggi);
  await repositoryPasti.crea({ user_id: utenteTest, nome: "Pranzo", ora_inizio: "12:30", ordine: 0 });
  await repositoryPasti.crea({ user_id: utenteTest, nome: "Colazione", ora_inizio: "07:00", ordine: 1 });
  await repositoryPasti.crea({ user_id: utenteTest, nome: "Cena vecchia", ora_inizio: "19:00", ordine: 2, valido_al: ieri });
  await repositoryPasti.crea({ user_id: utenteTest, nome: "Cena", ora_inizio: "20:00", ordine: 3, valido_dal: oggi });
  await repositoryPasti.crea({ user_id: utenteTest, nome: "Merenda di domani", ora_inizio: "16:00", ordine: 4, valido_dal: giornoSuccessivo(oggi) });
  return { oggi, ieri };
}

async function sceltePasto() {
  const titolo = (await screen.findByRole("combobox", { name: "Pasto" })) as HTMLSelectElement;
  return { titolo, nomi: [...titolo.options].map((o) => o.textContent) };
}

describe("Aggiungi: i pasti del giorno in cui si registra", () => {
  it("oggi: solo i pasti di oggi, in ordine d'orario", async () => {
    await preparaPasti();
    render(<AggiungiPage />);
    const { titolo, nomi } = await sceltePasto();
    expect(nomi).toEqual(["Colazione", "Pranzo", "Cena"]);
    // Qualunque sia l'ora, il pasto proposto è uno di questi.
    expect(nomi).toContain(titolo.selectedOptions[0].textContent);
  });

  it("ieri: i pasti di ieri, e il primo vuoto proposto è il primo per orario", async () => {
    const { ieri } = await preparaPasti();
    parametri = new URLSearchParams({ giorno: ieri });
    render(<AggiungiPage />);
    const { titolo, nomi } = await sceltePasto();
    expect(nomi).toEqual(["Colazione", "Pranzo", "Cena vecchia"]);
    expect(titolo.selectedOptions[0].textContent).toBe("Colazione");
  });

  it("un giorno prima di tutti i pasti: «Nessun pasto in questo giorno.», non «Preparo…»", async () => {
    const oggi = oggiLocale();
    await repositoryPasti.crea({ user_id: utenteTest, nome: "Colazione", ora_inizio: "07:00", ordine: 0, valido_dal: oggi });
    parametri = new URLSearchParams({ giorno: giornoPrecedente(oggi) });
    render(<AggiungiPage />);
    expect(await screen.findByText("Nessun pasto in questo giorno.")).toBeTruthy();
    expect(screen.queryByText("Preparo i tuoi pasti…")).toBeNull();
  });
});

describe("Aggiungi: un giorno futuro, fino a oggi + 7", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Alle 13:00 di oggi: per orario si proporrebbe il Pranzo. Su un giorno
  // futuro l'ora non conta, come sui giorni passati.
  function alleTredici() {
    const d = new Date();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 13, 0, 0));
  }

  function traGiorni(n: number) {
    let d = oggiLocale();
    for (let i = 0; i < n; i++) d = giornoSuccessivo(d);
    return d;
  }

  it("dopodomani: i pasti di quel giorno, il primo vuoto proposto, la voce senza ora del consumo", async () => {
    alleTredici();
    const { ieri } = await preparaPasti();
    const colazione = (await repositoryPasti.ottieniTutti(utenteTest)).find((p) => p.nome === "Colazione")!;
    const mela = await repositoryAlimenti.crea({
      user_id: utenteTest, nome: "Mela", marca: null, barcode: null,
      kcal_100g: 52, proteine_100g: 0.3, carboidrati_100g: 14, grassi_100g: 0.2,
      zuccheri_100g: null, fibre_100g: null, saturi_100g: null, sale_100g: null,
      porzione_default_g: 150, fonte: "manuale", verificato: false,
    });
    // Una voce di ieri: così la Mela è fra i Recenti, con il suo "+".
    await repositoryVociDiario.crea({
      user_id: utenteTest, alimento_id: mela.id, pasto_id: colazione.id, gruppo_id: null,
      quantita_g: 150, data: ieri, creato_il: new Date().toISOString(), consumato_alle: null,
      nome_alimento: "Mela", kcal_100g: 52, proteine_100g: 0.3, carboidrati_100g: 14, grassi_100g: 0.2,
    });

    const dopodomani = traGiorni(2);
    parametri = new URLSearchParams({ giorno: dopodomani });
    render(<AggiungiPage />);
    const { titolo, nomi } = await sceltePasto();
    expect(nomi).toEqual(["Colazione", "Pranzo", "Merenda di domani", "Cena"]);
    expect(titolo.selectedOptions[0].textContent).toBe("Colazione");

    fireEvent.click(await screen.findByRole("button", { name: "Aggiungi Mela, 150 g" }));
    await waitFor(async () => {
      const voci = (await repositoryVociDiario.ottieniTutti(utenteTest)).filter((v) => v.data === dopodomani);
      expect(voci).toHaveLength(1);
      expect(voci[0].pasto_id).toBe(colazione.id);
      expect(voci[0].consumato_alle).toBeNull();
    });
  });

  it("oltre oggi + 7 si ripiega su oggi", async () => {
    await preparaPasti();
    parametri = new URLSearchParams({ giorno: traGiorni(8) });
    render(<AggiungiPage />);
    const { nomi } = await sceltePasto();
    // I pasti di oggi: senza la Merenda, che comincia domani.
    expect(nomi).toEqual(["Colazione", "Pranzo", "Cena"]);
  });
});

// Funzioni di preparazione comuni ai gruppi qui sotto (doppioni, ricerca
// nei pasti salvati).

// Un solo pasto, valido sempre: è quello proposto a qualunque ora.
async function preparaPranzo() {
  return repositoryPasti.crea({ user_id: utenteTest, nome: "Pranzo", ora_inizio: "12:30", ordine: 0 });
}

function creaAlimento(nome: string, kcal: number): Promise<Alimento> {
  return repositoryAlimenti.crea({
    user_id: utenteTest, nome, marca: null, barcode: null,
    kcal_100g: kcal, proteine_100g: 1, carboidrati_100g: 10, grassi_100g: 1,
    zuccheri_100g: null, fibre_100g: null, saturi_100g: null, sale_100g: null,
    porzione_default_g: 100, fonte: "manuale", verificato: false,
  });
}

function creaVoce(alimento: Alimento, pastoId: string, data: string, grammi: number) {
  return repositoryVociDiario.crea({
    user_id: utenteTest, alimento_id: alimento.id, pasto_id: pastoId, gruppo_id: null,
    quantita_g: grammi, data, creato_il: new Date().toISOString(), consumato_alle: null,
    nome_alimento: alimento.nome, kcal_100g: alimento.kcal_100g, proteine_100g: 1,
    carboidrati_100g: 10, grassi_100g: 1,
  });
}

async function vociDiOggi() {
  const oggi = oggiLocale();
  return (await repositoryVociDiario.ottieniTutti(utenteTest)).filter((v) => v.data === oggi);
}

// I doppioni in /aggiungi (sezione 3, "Doppioni"): i tre percorsi passano
// da aggiungiNelPasto, con il foglio quando l'alimento c'è già nel pasto, e
// un blocco "aggiunta in corso" preso subito al tocco. Test permanenti: un
// doppio tocco che scrive due righe, o un blocco che resta preso dopo un
// "Non aggiungerlo" (il "+" smette di rispondere, in silenzio), sono
// esattamente i bug che non fanno rumore.
describe("Aggiungi: doppioni e aggiunta in corso", () => {
  it("doppio tocco sul «+»: una riga sola, e nessun foglio dei doppioni", async () => {
    const pranzo = await preparaPranzo();
    const mela = await creaAlimento("Mela", 52);
    await creaVoce(mela, pranzo.id, giornoPrecedente(oggiLocale()), 150);
    render(<AggiungiPage />);

    const piu = await screen.findByRole("button", { name: "Aggiungi Mela, 150 g" });
    fireEvent.click(piu);
    fireEvent.click(piu);

    await waitFor(() => expect(navigazione.replace).toHaveBeenCalledTimes(1));
    const voci = await vociDiOggi();
    expect(voci).toHaveLength(1);
    expect(voci[0].quantita_g).toBe(150);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("errore alla prima chiamata: messaggio, niente scritto, e il «+» funziona di nuovo", async () => {
    const pranzo = await preparaPranzo();
    const mela = await creaAlimento("Mela", 52);
    await creaVoce(mela, pranzo.id, giornoPrecedente(oggiLocale()), 150);
    render(<AggiungiPage />);

    guasto.guasti = 1;
    const piu = await screen.findByRole("button", { name: "Aggiungi Mela, 150 g" });
    fireEvent.click(piu);
    expect(await screen.findByText("Non è stato possibile aggiungere. Riprova.")).toBeTruthy();
    expect(navigazione.replace).not.toHaveBeenCalled();
    expect(await vociDiOggi()).toHaveLength(0);

    // Il blocco si è liberato: il secondo tocco aggiunge davvero.
    fireEvent.click(piu);
    await waitFor(() => expect(navigazione.replace).toHaveBeenCalledTimes(1));
    expect(await vociDiOggi()).toHaveLength(1);
    expect(screen.queryByText("Non è stato possibile aggiungere. Riprova.")).toBeNull();
  });

  it("alimento già nel pasto: foglio, un tocco su «Aggiungi» → Somma", async () => {
    const pranzo = await preparaPranzo();
    const mela = await creaAlimento("Mela", 52);
    await creaVoce(mela, pranzo.id, oggiLocale(), 100);
    render(<AggiungiPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Aggiungi Mela, 100 g" }));
    const foglio = await screen.findByRole("dialog", { name: "«Mela» c'è già in «Pranzo»" });
    expect(within(foglio).getByText("Pranzo 100 g · in arrivo 100 g")).toBeTruthy();
    // Finché il foglio è aperto non si è scritto niente.
    expect(await vociDiOggi()).toHaveLength(1);

    fireEvent.click(within(foglio).getByRole("button", { name: "Aggiungi" }));
    await waitFor(() => expect(navigazione.replace).toHaveBeenCalledWith(`/?giorno=${oggiLocale()}`));
    const voci = await vociDiOggi();
    expect(voci).toHaveLength(1);
    expect(voci[0].quantita_g).toBe(200);
    expect(prendiInserimento()?.messaggio).toMatchObject({ testo: "Sommato:", nome: "Mela", coda: "→ 200 g" });
  });

  // Caso 5 dei "doppioni rimasti" (18/10) sul percorso della prova 14 su
  // iPhone: tocco sul NOME (sheet quantità, non il "+" rapido), un alimento
  // già nel pasto da 50.000 g e un secondo inserimento da 50.000 g. Somma
  // farebbe 100.000 g, oltre il massimo di numeric(7,2): il foglio la
  // spegne e parte da "Tieni separati".
  it("sheet quantità, 50.000 + 50.000 g: Somma spenta, Tieni separati, due righe da 50.000 g", async () => {
    const pranzo = await preparaPranzo();
    const pane = await creaAlimento("Pane", 270);
    await creaVoce(pane, pranzo.id, oggiLocale(), 50000);
    render(<AggiungiPage />);

    // Il nome in Recenti apre lo sheet quantità.
    fireEvent.click((await screen.findByText("Pane")).closest("button")!);
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("Quantità (g)"), { target: { value: "50000" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Aggiungi" }));

    const foglio = await screen.findByRole("dialog", { name: "«Pane» c'è già in «Pranzo»" });
    const somma = within(foglio).getByRole("radio", { name: "Somma (100.000 g)" }) as HTMLButtonElement;
    expect(somma.disabled).toBe(true);
    expect(within(foglio).getByRole("radio", { name: "Tieni separati" }).getAttribute("aria-checked")).toBe("true");
    expect(within(foglio).getByText("La somma supera 99999,99 g: scegli un'altra opzione.")).toBeTruthy();
    expect(await vociDiOggi()).toHaveLength(1);

    fireEvent.click(within(foglio).getByRole("button", { name: "Aggiungi" }));
    await waitFor(() => expect(navigazione.replace).toHaveBeenCalledWith(`/?giorno=${oggiLocale()}`));
    expect((await vociDiOggi()).map((v) => v.quantita_g)).toEqual([50000, 50000]);
  });

  it("«Non aggiungerlo»: si resta su /aggiungi, niente scritto, e il «+» risponde di nuovo subito", async () => {
    const pranzo = await preparaPranzo();
    const mela = await creaAlimento("Mela", 52);
    await creaVoce(mela, pranzo.id, oggiLocale(), 100);
    const primaVoci = await vociDiOggi();
    render(<AggiungiPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Aggiungi Mela, 100 g" }));
    let foglio = await screen.findByRole("dialog");
    fireEvent.click(within(foglio).getByRole("radio", { name: "Non aggiungerlo" }));
    expect(within(foglio).getByText("→ Resta quello che c'è, non si aggiunge")).toBeTruthy();
    fireEvent.click(within(foglio).getByRole("button", { name: "Aggiungi" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(navigazione.replace).not.toHaveBeenCalled();
    expect(prendiInserimento()).toBeNull();
    // Nessuna barra qui ("Aggiunto" mai, se non è entrato niente).
    expect(screen.queryByText(/Aggiunto/)).toBeNull();
    expect(await vociDiOggi()).toEqual(primaVoci);

    // Il blocco si è liberato: il "+" riapre il foglio.
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi Mela, 100 g" }));
    foglio = await screen.findByRole("dialog");
    // Anche Esc chiude senza scrivere, e libera il blocco.
    //
    // Esc si preme dentro waitFor, cioè di nuovo a ogni controllo finché il
    // foglio non si chiude, e solo se è ancora aperto: a foglio chiuso non
    // parte un Esc in più verso la pagina. Il foglio ascolta Esc da un
    // useEffect, che React fa partire un attimo dopo averlo mostrato (con
    // setImmediate). findByRole invece riprende dopo un setTimeout(0), e in
    // Node quale dei due arrivi prima non è garantito: con il PC carico Esc
    // arrivava prima dell'ascolto, il foglio restava aperto e il waitFor
    // scadeva (23/10). Riprodotto ritardando di 3 ms lo scheduler di React:
    // fallito 3 volte su 3 con un Esc solo, passato con questo.
    await waitFor(() => {
      if (screen.queryByRole("dialog")) fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi Mela, 100 g" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(await vociDiOggi()).toEqual(primaVoci);
  });

  it("pasto salvato con un doppione e un alimento nuovo: un blocco solo, il nuovo entra", async () => {
    const pranzo = await preparaPranzo();
    const mela = await creaAlimento("Mela", 52);
    const pane = await creaAlimento("Pane", 260);
    await creaVoce(mela, pranzo.id, oggiLocale(), 100);
    const composizione = await repositoryComposizioni.crea({
      user_id: utenteTest, nome: "Merenda salvata", tipo: "pasto_salvato", alimento_id: null,
    });
    const righe: [Alimento, number][] = [[mela, 50], [pane, 80]];
    for (const [ordine, [alimento, grammi]] of righe.entries()) {
      await repositoryComposizioniVoci.crea({
        user_id: utenteTest, composizione_id: composizione.id, alimento_id: alimento.id,
        quantita_g: grammi, ordine,
      });
    }
    render(<AggiungiPage />);

    fireEvent.click(await screen.findByRole("button", { name: /^Aggiungi Merenda salvata, / }));
    const foglio = await screen.findByRole("dialog", { name: "«Mela» c'è già in «Pranzo»" });
    expect(within(foglio).getAllByRole("group")).toHaveLength(1);
    expect(within(foglio).getByText("Pranzo 100 g · in arrivo 50 g")).toBeTruthy();

    fireEvent.click(within(foglio).getByRole("button", { name: "Aggiungi" }));
    await waitFor(() => expect(navigazione.replace).toHaveBeenCalledTimes(1));
    const voci = await vociDiOggi();
    expect(voci.map((v) => [v.nome_alimento, v.quantita_g]).sort()).toEqual([
      ["Mela", 150],
      ["Pane", 80],
    ]);
    // Il Pane è entrato con un gruppo, quello del pasto salvato.
    expect(voci.find((v) => v.nome_alimento === "Pane")!.gruppo_id).not.toBeNull();
    expect(prendiInserimento()?.messaggio).toMatchObject({
      testo: "Aggiunto:",
      nome: "Merenda salvata",
      coda: "(2 alimenti)",
    });
  });
});

// La ricerca anche nei pasti salvati (PUNTO §3, "Ricerca nei pasti
// salvati"). Qui la pagina: dove compaiono, cosa fa il tocco, e che
// "Nessun risultato" e Invio → Crea guardino anche i pasti. Le regole del
// confronto ("Contiene", il primo alimento) sono nei test di
// cercaPastiSalvati. Test permanenti: un Invio che apre "Nuovo alimento"
// mentre c'è un pasto trovato, o i pasti sopra gli alimenti, non fanno
// nessun errore.
describe("Aggiungi: ricerca nei pasti salvati", () => {
  async function creaPastoSalvato(nome: string, righe: [Alimento, number][]) {
    const composizione = await repositoryComposizioni.crea({
      user_id: utenteTest, nome, tipo: "pasto_salvato", alimento_id: null,
    });
    for (const [ordine, [alimento, grammi]] of righe.entries()) {
      await repositoryComposizioniVoci.crea({
        user_id: utenteTest, composizione_id: composizione.id, alimento_id: alimento.id,
        quantita_g: grammi, ordine,
      });
    }
  }

  async function cerca(testo: string) {
    // Il campo si trova per l'etichetta dei lettori di schermo; il
    // segnaposto ha lo stesso testo.
    const campo = await screen.findByRole("searchbox", { name: "Cerca alimento o pasto" });
    expect(campo.getAttribute("placeholder")).toBe("Cerca alimento o pasto");
    fireEvent.change(campo, { target: { value: testo } });
    return campo;
  }

  it("solo un pasto trovato: nessun «Nessun risultato», Invio non apre «Nuovo alimento», il tocco lo aggiunge", async () => {
    await preparaPranzo();
    const mela = await creaAlimento("Mela", 52);
    await creaPastoSalvato("Merenda salvata", [[mela, 150]]);
    render(<AggiungiPage />);

    const campo = await cerca("merenda");
    const sezione = screen.getByRole("heading", { name: "Pasti salvati" }).closest("section")!;
    expect(screen.queryByRole("heading", { name: "Alimenti" })).toBeNull();
    expect(screen.queryByText(/Nessun risultato/)).toBeNull();
    // Trovato per il nome: niente "Contiene".
    expect(within(sezione).queryByText(/Contiene/)).toBeNull();

    fireEvent.keyDown(campo, { key: "Enter" });
    expect(screen.queryByRole("heading", { name: "Nuovo alimento" })).toBeNull();
    expect(campo.getAttribute("enterkeyhint")).toBe("search");

    // Come nei Preferiti: il tocco sul nome aggiunge subito il pasto.
    fireEvent.click(within(sezione).getByRole("button", { name: /^Merenda salvata/ }));
    await waitFor(() => expect(navigazione.replace).toHaveBeenCalledTimes(1));
    const voci = await vociDiOggi();
    expect(voci.map((v) => [v.nome_alimento, v.quantita_g])).toEqual([["Mela", 150]]);
    expect(voci[0].gruppo_id).not.toBeNull();
  });

  it("parola in un alimento e in un pasto che lo contiene: prima gli alimenti, poi il pasto con «Contiene»", async () => {
    await preparaPranzo();
    const yogurt = await creaAlimento("Yogurt greco", 60);
    const gallette = await creaAlimento("Gallette di riso", 380);
    await creaPastoSalvato("Colazione proteica", [[yogurt, 170], [gallette, 20]]);
    render(<AggiungiPage />);

    await cerca("GALLETTE");
    const titoli = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titoli).toEqual(["Alimenti", "Pasti salvati"]);

    const alimenti = screen.getByRole("heading", { name: "Alimenti" }).closest("section")!;
    expect(within(alimenti).getByText("Gallette di riso")).toBeTruthy();
    const pasti = screen.getByRole("heading", { name: "Pasti salvati" }).closest("section")!;
    expect(within(pasti).getByText("Colazione proteica")).toBeTruthy();
    expect(within(pasti).getByText(/Contiene Gallette di riso/)).toBeTruthy();
  });

  it("niente in alimenti né pasti: «Nessun risultato», e Invio apre «Nuovo alimento» con il nome scritto", async () => {
    await preparaPranzo();
    const mela = await creaAlimento("Mela", 52);
    await creaPastoSalvato("Merenda salvata", [[mela, 150]]);
    render(<AggiungiPage />);

    // Una parola che non è neanche nel catalogo precaricato: con il kiwi
    // (che c'è) comparirebbe il riquadro «Nel catalogo».
    const campo = await cerca("papaya");
    expect(screen.getByText("Nessun risultato per «papaya»")).toBeTruthy();
    expect(campo.getAttribute("enterkeyhint")).toBe("go");

    fireEvent.keyDown(campo, { key: "Enter" });
    expect(await screen.findByRole("heading", { name: "Nuovo alimento" })).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("papaya");
  });
});

// La scansione del codice a barre (PUNTO_DI_PARTENZA.md §3, "Codice a
// barre"). Test permanenti per quello che sbaglierebbe in silenzio: il
// pulsante acceso senza rete; un prodotto già nel catalogo che apre
// "Nuovo alimento" (e diventa un secondo alimento con lo stesso codice)
// invece dello sheet; un UPC-A cercato a 12 cifre (mai trovato nel
// catalogo, dove è a 13); un errore di rete senza "Crea a mano". La rete è
// finta (fetch sostituita), la fotocamera in jsdom non c'è.
describe("Aggiungi: scansione del codice a barre", () => {
  const NUTELLA = "3017620422003";

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => true });
    Object.defineProperty(window.navigator, "mediaDevices", { configurable: true, value: undefined });
    ordineScansione.eventi = [];
  });

  function risposta(corpo: unknown, status = 200) {
    return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
  }

  // Apre la scansione e scrive il codice a mano, come si farebbe con la
  // fotocamera negata.
  async function scriviCodice(codice: string) {
    fireEvent.click(await screen.findByRole("button", { name: "Scansiona il codice a barre" }));
    const scansione = await screen.findByRole("dialog", { name: "Scansione del codice a barre" });
    fireEvent.click(within(scansione).getByRole("button", { name: /Scrivi il codice/ }));
    fireEvent.change(within(scansione).getByLabelText("Il codice sotto le barre"), {
      target: { value: codice },
    });
    fireEvent.click(within(scansione).getByRole("button", { name: "Cerca" }));
    return scansione;
  }

  // Difetto del 07/11: nell'app installata dalla Home (iOS 18.7) sempre
  // "permesso negato", senza la domanda di iOS; in Safari funzionava.
  // Prima getUserMedia partiva da un useEffect della schermata, dopo il
  // ridisegno, fuori dal tocco. Ora deve partire DENTRO il gestore del
  // tocco, prima di aprire la schermata e prima del lettore. Il tocco si
  // misura con due ascoltatori: uno che si accende all'inizio dell'evento
  // (fase di cattura sul document, prima di React) e uno che si spegne
  // alla fine (risalita sulla window, dopo React).
  it("getUserMedia parte dentro il tocco su Scansiona, prima del lettore, e una volta sola", async () => {
    await preparaPranzo();
    render(<AggiungiPage />);
    const pulsante = await screen.findByRole("button", { name: "Scansiona il codice a barre" });

    let nelTocco = false;
    const getUserMedia = vi.fn(() => {
      ordineScansione.eventi.push(nelTocco ? "fotocamera nel tocco" : "fotocamera fuori dal tocco");
      return new Promise<MediaStream>(() => {});
    });
    Object.defineProperty(window.navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    const inizio = () => {
      nelTocco = true;
    };
    const fine = () => {
      nelTocco = false;
    };
    document.addEventListener("click", inizio, true);
    window.addEventListener("click", fine);
    try {
      fireEvent.click(pulsante);
    } finally {
      document.removeEventListener("click", inizio, true);
      window.removeEventListener("click", fine);
    }

    await screen.findByRole("dialog", { name: "Scansione del codice a barre" });
    expect(ordineScansione.eventi[0]).toBe("fotocamera nel tocco");
    expect(ordineScansione.eventi).toContain("lettore");
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  // La richiesta parte nel tocco, quindi può rispondere quando la schermata
  // è già chiusa o Aggiungi è già lasciata: lo stream arrivato dopo deve
  // spegnersi, altrimenti la fotocamera resta accesa senza che nessuno la
  // veda (spia verde, batteria).
  function fotocameraInSospeso() {
    let rispondi!: (s: MediaStream) => void;
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((ok) => {
          rispondi = ok;
        })
    );
    Object.defineProperty(window.navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    const traccia = { stop: vi.fn(), getCapabilities: () => ({}) };
    const stream = { getTracks: () => [traccia], getVideoTracks: () => [traccia] } as unknown as MediaStream;
    return { traccia, rispondi: () => rispondi(stream) };
  }

  it("permesso arrivato dopo la chiusura della scansione: lo stream si spegne", async () => {
    await preparaPranzo();
    const fotocamera = fotocameraInSospeso();
    render(<AggiungiPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Scansiona il codice a barre" }));
    const scansione = await screen.findByRole("dialog", { name: "Scansione del codice a barre" });
    fireEvent.click(within(scansione).getByRole("button", { name: "Chiudi la scansione" }));
    expect(screen.queryByRole("dialog", { name: "Scansione del codice a barre" })).toBeNull();

    await act(async () => fotocamera.rispondi());
    expect(fotocamera.traccia.stop).toHaveBeenCalled();
  });

  it("permesso arrivato dopo aver lasciato Aggiungi: lo stream si spegne", async () => {
    await preparaPranzo();
    const fotocamera = fotocameraInSospeso();
    const { unmount } = render(<AggiungiPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Scansiona il codice a barre" }));
    await screen.findByRole("dialog", { name: "Scansione del codice a barre" });
    unmount();

    await act(async () => fotocamera.rispondi());
    expect(fotocamera.traccia.stop).toHaveBeenCalled();
  });

  it("permesso rifiutato: il messaggio, e sotto il nome tecnico dell'errore", async () => {
    await preparaPranzo();
    const getUserMedia = vi.fn(() =>
      Promise.reject(new DOMException("The request is not allowed by the user agent", "NotAllowedError"))
    );
    Object.defineProperty(window.navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    render(<AggiungiPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Scansiona il codice a barre" }));

    const scansione = await screen.findByRole("dialog", { name: "Scansione del codice a barre" });
    expect(await within(scansione).findByText(/Non hai dato il permesso per la fotocamera/)).toBeTruthy();
    expect(
      within(scansione).getByText("NotAllowedError: The request is not allowed by the user agent")
    ).toBeTruthy();
  });

  it("con la rete il pulsante è acceso, senza è spento e la riga dice perché", async () => {
    await preparaPranzo();
    const { unmount } = render(<AggiungiPage />);
    const acceso = (await screen.findByRole("button", { name: "Scansiona il codice a barre" })) as HTMLButtonElement;
    expect(acceso.disabled).toBe(false);
    expect(screen.queryByText("Senza connessione la scansione non è disponibile")).toBeNull();
    unmount();

    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => false });
    render(<AggiungiPage />);
    const spento = (await screen.findByRole("button", {
      name: "Scansione non disponibile senza connessione",
    })) as HTMLButtonElement;
    expect(spento.disabled).toBe(true);
    expect(screen.getByText("Senza connessione la scansione non è disponibile")).toBeTruthy();
  });

  it("codice di un alimento già nel catalogo: sheet quantità, Open Food Facts non si chiama", async () => {
    await preparaPranzo();
    const nutella = await creaAlimento("Nutella", 539);
    await repositoryAlimenti.aggiorna(nutella.id, { barcode: NUTELLA });
    const fetchFinta = vi.fn(async () => risposta({ product: { product_name: "Altro" } }));
    vi.stubGlobal("fetch", fetchFinta);
    render(<AggiungiPage />);

    await scriviCodice(NUTELLA);

    expect(await screen.findByRole("dialog", { name: "Quantità di Nutella" })).toBeTruthy();
    expect(screen.queryByText("Nuovo alimento")).toBeNull();
    expect(fetchFinta).not.toHaveBeenCalled();
  });

  it("un UPC-A a 12 cifre si cerca e si compila a 13; non trovato su OFF: modulo vuoto con il codice", async () => {
    await preparaPranzo();
    const fetchFinta = vi.fn<typeof fetch>(async () => risposta({ result: { id: "product_not_found" } }, 404));
    vi.stubGlobal("fetch", fetchFinta);
    render(<AggiungiPage />);

    await scriviCodice("036000291452");

    expect(await screen.findByText("Nuovo alimento")).toBeTruthy();
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe("0036000291452");
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("");
    expect(String(fetchFinta.mock.calls[0][0])).toContain("/product/0036000291452?");
  });

  it("trovato su Open Food Facts: modulo precompilato, niente salvato da solo", async () => {
    await preparaPranzo();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        risposta({
          product: {
            product_name_it: "Nutella",
            brands: "Nutella, Ferrero",
            nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
          },
        })
      )
    );
    render(<AggiungiPage />);

    await scriviCodice(NUTELLA);

    expect(await screen.findByText(/Valori trovati su Open Food Facts/)).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Nutella");
    expect((screen.getByLabelText("Calorie (kcal)") as HTMLInputElement).value).toBe("539");
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe(NUTELLA);
    expect(await repositoryAlimenti.ottieniTutti(utenteTest)).toHaveLength(0);
  });

  it("rete assente anche se il telefono dice di no: messaggio, e «Crea a mano» apre il modulo con il codice", async () => {
    await preparaPranzo();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Load failed");
      })
    );
    render(<AggiungiPage />);

    const scansione = await scriviCodice(NUTELLA);

    expect(await within(scansione).findByText(/Non riesco a raggiungere Open Food Facts/)).toBeTruthy();
    fireEvent.click(within(scansione).getByRole("button", { name: "Crea a mano" }));
    expect(await screen.findByText("Nuovo alimento")).toBeTruthy();
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe(NUTELLA);
    expect(screen.queryByRole("dialog", { name: "Scansione del codice a barre" })).toBeNull();
  });

  it("un codice scritto della lunghezza sbagliata: il messaggio, e nessuna ricerca", async () => {
    await preparaPranzo();
    const fetchFinta = vi.fn(async () => risposta({}, 404));
    vi.stubGlobal("fetch", fetchFinta);
    render(<AggiungiPage />);

    const scansione = await scriviCodice("1234567");

    // Testo del 07/11 (Davide): "deve avere", non "ha".
    expect(within(scansione).getByText("Il codice deve avere 8, 12 o 13 cifre.")).toBeTruthy();
    expect(fetchFinta).not.toHaveBeenCalled();
  });

  it("un codice scritto con la cifra di controllo sbagliata: il messaggio, e nessuna ricerca", async () => {
    await preparaPranzo();
    const fetchFinta = vi.fn(async () => risposta({}, 404));
    vi.stubGlobal("fetch", fetchFinta);
    render(<AggiungiPage />);

    const scansione = await scriviCodice("3017620422004");

    expect(within(scansione).getByText("Il codice non torna: controlla le cifre.")).toBeTruthy();
    expect(screen.queryByText("Nuovo alimento")).toBeNull();
    expect(fetchFinta).not.toHaveBeenCalled();
  });

  // "Apri" porta il codice (sezione 3, "«Apri» porta il codice"; strada A,
  // Davide, 07/11). Il rischio è silenzioso: senza, il codice si perde, e
  // a ogni scansione di quel prodotto si ricomincia da Open Food Facts.
  function nutellaSuOff() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        risposta({
          product: {
            product_name_it: "Nutella",
            nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
          },
        })
      )
    );
  }

  it("«Apri» su un alimento uguale senza codice: la sua modifica con il codice, poi lo sheet quantità", async () => {
    await preparaPranzo();
    const mia = await creaAlimento("Nutella", 530);
    nutellaSuOff();
    render(<AggiungiPage />);

    await scriviCodice(NUTELLA);
    expect(await screen.findByText("Hai già «Nutella», senza marca.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apri «Nutella»" }));

    expect(await screen.findByText("Modifica alimento")).toBeTruthy();
    expect(
      screen.getByText(
        "Questo alimento non aveva il codice: salvalo per ritrovarlo la prossima volta che scansioni."
      )
    ).toBeTruthy();
    expect((screen.getByLabelText("Codice a barre") as HTMLInputElement).value).toBe(NUTELLA);
    expect(screen.getByRole("button", { name: "Togli il codice" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Elimina" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Aggiungi codice a barre" })).toBeNull();
    // Niente salvato finché non si tocca il pulsante.
    expect((await repositoryAlimenti.ottieniPerId(mia.id))?.barcode).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Salva e scegli la quantità" }));

    expect(await screen.findByRole("dialog", { name: "Quantità di Nutella" })).toBeTruthy();
    expect(await repositoryAlimenti.ottieniPerId(mia.id)).toMatchObject({
      barcode: NUTELLA,
      kcal_100g: 530,
      fonte: "manuale",
    });
    expect(await repositoryAlimenti.ottieniTutti(utenteTest)).toHaveLength(1);
  });

  it("dalla modifica con il codice, «Torna alla ricerca» non salva niente, e la matita dopo parte senza codice", async () => {
    await preparaPranzo();
    const mia = await creaAlimento("Nutella", 530);
    nutellaSuOff();
    render(<AggiungiPage />);

    await scriviCodice(NUTELLA);
    fireEvent.click(await screen.findByRole("button", { name: "Apri «Nutella»" }));
    fireEvent.click(await screen.findByRole("button", { name: "Torna alla ricerca" }));

    const ricerca = await screen.findByRole("searchbox", { name: "Cerca alimento o pasto" });
    expect((await repositoryAlimenti.ottieniPerId(mia.id))?.barcode).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Quantità di Nutella" })).toBeNull();

    // Il codice portato non resta appeso: la matita è una modifica normale.
    fireEvent.change(ricerca, { target: { value: "Nutella" } });
    fireEvent.click(await screen.findByRole("button", { name: "Modifica Nutella" }));
    expect(await screen.findByText("Modifica alimento")).toBeTruthy();
    expect(screen.queryByLabelText("Codice a barre")).toBeNull();
    expect(screen.getByRole("button", { name: "Elimina" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salva" })).toBeTruthy();
  });

  it("con la × il codice e il suo avviso spariscono, e in Aggiungi nessuna riga «Aggiungi codice a barre»", async () => {
    await preparaPranzo();
    await creaAlimento("Nutella", 530);
    nutellaSuOff();
    render(<AggiungiPage />);

    await scriviCodice(NUTELLA);
    fireEvent.click(await screen.findByRole("button", { name: "Apri «Nutella»" }));
    expect(await screen.findByText(/Questo alimento non aveva il codice/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Togli il codice" }));

    expect(screen.queryByLabelText("Codice a barre")).toBeNull();
    expect(screen.queryByText(/Questo alimento non aveva il codice/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Aggiungi codice a barre" })).toBeNull();
    expect(screen.getByRole("button", { name: "Salva e scegli la quantità" })).toBeTruthy();
  });

  it("un alimento uguale ma con un altro codice: «Apri» porta allo sheet quantità, come prima", async () => {
    await preparaPranzo();
    const mia = await creaAlimento("Nutella", 530);
    await repositoryAlimenti.aggiorna(mia.id, { barcode: "96385074" });
    nutellaSuOff();
    render(<AggiungiPage />);

    await scriviCodice(NUTELLA);
    fireEvent.click(await screen.findByRole("button", { name: "Apri «Nutella»" }));

    expect(await screen.findByRole("dialog", { name: "Quantità di Nutella" })).toBeTruthy();
    expect(screen.queryByText("Modifica alimento")).toBeNull();
    expect((await repositoryAlimenti.ottieniPerId(mia.id))?.barcode).toBe("96385074");
  });
});

// Il riquadro «Nel catalogo» (PUNTO_DI_PARTENZA.md §10.1; mockup
// docs/mockups/catalogo-precaricato.html, schermata 3). Test permanenti per
// quello che sbaglierebbe in silenzio: il riquadro anche quando fra i tuoi
// c'è un risultato (la ricerca di Aggiungi deve restare sui tuoi); un
// alimento che hai già proposto di nuovo (un doppione); il «+» che non
// crea la copia, o apre i grammi con un'altra porzione; «Vedi tutto» che
// non porta la ricerca.
describe("Aggiungi: il riquadro «Nel catalogo»", () => {
  async function cerca(testo: string) {
    const campo = await screen.findByRole("searchbox", { name: "Cerca alimento o pasto" });
    fireEvent.change(campo, { target: { value: testo } });
    return campo;
  }

  function riquadro() {
    return screen.queryByRole("heading", { name: "Nel catalogo" })?.closest("section") ?? null;
  }

  it("niente fra i tuoi: il riquadro, al massimo 3, in ordine di nome, e «Crea «…»» resta", async () => {
    await preparaPranzo();
    render(<AggiungiPage />);
    await cerca("latte");

    expect(screen.getByText("Nessun alimento tuo con «latte»")).toBeTruthy();
    const r = riquadro()!;
    const nomi = within(r)
      .getAllByRole("button", { name: /ai tuoi alimenti e scegli i grammi$/ })
      .map((b) => b.getAttribute("aria-label"));
    expect(nomi).toEqual([
      "Aggiungi Fiocchi di latte (cottage) · Milbona ai tuoi alimenti e scegli i grammi",
      "Aggiungi Latte parzialmente scremato · Parmalat ai tuoi alimenti e scegli i grammi",
      "Aggiungi Latte parzialmente scremato UHT · Granarolo ai tuoi alimenti e scegli i grammi",
    ]);
    expect(screen.queryByText(/Nessun risultato/)).toBeNull();
    expect(screen.getByRole("button", { name: "Crea «latte»" })).toBeTruthy();
  });

  it("con anche un solo risultato tuo il riquadro non c'è", async () => {
    await preparaPranzo();
    await creaAlimento("Latte di soia", 33);
    render(<AggiungiPage />);
    await cerca("latte");
    expect(await screen.findByText("Latte di soia")).toBeTruthy();
    expect(riquadro()).toBeNull();
  });

  it("toglie quelli che hai già, anche con un altro nome (stesso codice): qui non resta niente", async () => {
    await preparaPranzo();
    await repositoryAlimenti.crea({
      user_id: utenteTest, nome: "Biscotti della nonna", marca: null, barcode: "8013355999143",
      kcal_100g: 480, proteine_100g: 6, carboidrati_100g: 65, grassi_100g: 21,
      zuccheri_100g: null, fibre_100g: null, saturi_100g: null, sale_100g: null,
      porzione_default_g: 30, fonte: "barcode", verificato: false,
    });
    render(<AggiungiPage />);
    await cerca("gocciole");
    expect(screen.getByText("Nessun risultato per «gocciole»")).toBeTruthy();
    expect(riquadro()).toBeNull();
  });

  it("il «+»: la copia nasce, lo sheet si apre con la porzione del catalogo e la conferma; Aggiungi scrive la voce", async () => {
    await preparaPranzo();
    render(<AggiungiPage />);
    await cerca("mandorle");
    fireEvent.click(within(riquadro()!).getByRole("button", { name: "Aggiungi Mandorle ai tuoi alimenti e scegli i grammi" }));

    const sheet = await screen.findByRole("dialog", { name: "Quantità di Mandorle" });
    expect((within(sheet).getByLabelText("Quantità (g)") as HTMLInputElement).value).toBe("30");
    expect(within(sheet).getByText("Aggiunto ai tuoi alimenti: Mandorle")).toBeTruthy();
    const copie = (await repositoryAlimenti.ottieniTutti(utenteTest)).filter((a) => a.catalogo_id === "ciqual:15000");
    expect(copie).toHaveLength(1);

    fireEvent.click(within(sheet).getByRole("button", { name: "Aggiungi" }));
    await waitFor(() => expect(navigazione.replace).toHaveBeenCalledTimes(1));
    const voci = await vociDiOggi();
    expect(voci.map((v) => [v.nome_alimento, v.quantita_g, v.alimento_id])).toEqual([["Mandorle", 30, copie[0].id]]);
  });

  it("«Vedi tutto il catalogo» apre Alimenti sulla scheda «Catalogo» con la ricerca scritta", async () => {
    await preparaPranzo();
    render(<AggiungiPage />);
    await cerca("  latte ");
    fireEvent.click(within(riquadro()!).getByRole("button", { name: "Vedi tutto il catalogo" }));
    expect(navigazione.push).toHaveBeenCalledWith("/impostazioni/alimenti?scheda=catalogo&cerca=latte");
  });
});
