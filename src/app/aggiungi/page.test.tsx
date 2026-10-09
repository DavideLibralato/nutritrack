// Aggiungi offre i pasti che esistono nel giorno in cui si registra
// (PUNTO_DI_PARTENZA.md, sezione 3, "I pasti"), in ordine d'orario: un
// pasto chiuso o non ancora nato quel giorno non è fra le scelte del
// titolo, e il pasto proposto è sempre uno di quelli. Test permanente: se
// la pagina tornasse a leggere tutte le righe, si potrebbe registrare una
// voce in un pasto che quel giorno non esiste, e nessuno se ne accorgerebbe.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import AggiungiPage from "./page";
import { repositoryPasti } from "@/lib/repository";
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
