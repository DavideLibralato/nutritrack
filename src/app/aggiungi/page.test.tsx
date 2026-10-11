// Aggiungi offre i pasti che esistono nel giorno in cui si registra
// (PUNTO_DI_PARTENZA.md, sezione 3, "I pasti"), in ordine d'orario: un
// pasto chiuso o non ancora nato quel giorno non è fra le scelte del
// titolo, e il pasto proposto è sempre uno di quelli. Test permanente: se
// la pagina tornasse a leggere tutte le righe, si potrebbe registrare una
// voce in un pasto che quel giorno non esiste, e nessuno se ne accorgerebbe.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
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
const navigazione = vi.hoisted(() => ({ replace: vi.fn() }));

let utenteTest = "";
let parametri = new URLSearchParams();
beforeEach(() => {
  utenteTest = `utente-aggiungi-${crypto.randomUUID()}`;
  parametri = new URLSearchParams();
  navigazione.replace.mockReset();
  guasto.guasti = 0;
  prendiInserimento();
});

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => utenteTest,
  useNomeUtente: () => null,
  useEmailUtente: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: navigazione.replace, refresh: () => {}, back: () => {} }),
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

// I doppioni in /aggiungi (sezione 3, "Doppioni"): i tre percorsi passano
// da aggiungiNelPasto, con il foglio quando l'alimento c'è già nel pasto, e
// un blocco "aggiunta in corso" preso subito al tocco. Test permanenti: un
// doppio tocco che scrive due righe, o un blocco che resta preso dopo un
// "Non aggiungerlo" (il "+" smette di rispondere, in silenzio), sono
// esattamente i bug che non fanno rumore.
describe("Aggiungi: doppioni e aggiunta in corso", () => {
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
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
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
