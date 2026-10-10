// Aggiungi offre i pasti che esistono nel giorno in cui si registra
// (PUNTO_DI_PARTENZA.md, sezione 3, "I pasti"), in ordine d'orario: un
// pasto chiuso o non ancora nato quel giorno non è fra le scelte del
// titolo, e il pasto proposto è sempre uno di quelli. Test permanente: se
// la pagina tornasse a leggere tutte le righe, si potrebbe registrare una
// voce in un pasto che quel giorno non esiste, e nessuno se ne accorgerebbe.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import AggiungiPage from "./page";
import { repositoryAlimenti, repositoryPasti, repositoryVociDiario } from "@/lib/repository";
import { giornoPrecedente, giornoSuccessivo, oggiLocale } from "@/lib/dataGiorno";

let utenteTest = "";
let parametri = new URLSearchParams();
beforeEach(() => {
  utenteTest = `utente-aggiungi-${crypto.randomUUID()}`;
  parametri = new URLSearchParams();
});

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => utenteTest,
  useNomeUtente: () => null,
  useEmailUtente: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
  useSearchParams: () => parametri,
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
