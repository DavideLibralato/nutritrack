import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup, within } from "@testing-library/react";
import PastiEOrariPage from "./page";
import { db } from "@/lib/db/database";
import type { Pasto, VoceDiario } from "@/lib/db/tipi";
import { formattaGiornoCorto, giornoPrecedente, giornoSuccessivo, oggiLocale, prossimoLunedi } from "@/lib/dataGiorno";
import { aggiungiPasto, cambiaDal, eliminaPasto } from "@/lib/repository/modifichePasti";

// La pagina Pasti e orari (passo 3, PUNTO_DI_PARTENZA.md sezione 3, "Pasti
// e orari"): qui si controlla che la pagina scelga giusto quando chiedere
// "da quando", cosa bloccare e cosa scrivere. Regole e scritture hanno i
// loro test in controlliPasti.test.ts e modifichePasti.test.ts.

const USER_ID = "utente-test-pasti-orari";
const OGGI = oggiLocale();
const IERI = giornoPrecedente(OGGI);

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => USER_ID,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

// Server irraggiungibile: le scritture restano in Dexie e in coda.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({ upsert: async () => ({ error: { message: "offline" } }) }),
  }),
}));

// L'oggi della pagina (useGiornoCorrente): il vero, salvo il test che fa
// arrivare la data di una scheda. Il hook ha i suoi test
// (useGiornoCorrente.test.tsx); qui serve solo cambiare il giorno.
const giornoFinto = vi.hoisted(() => ({ valore: null as string | null }));
vi.mock("@/lib/useGiornoCorrente", async () => {
  const { oggiLocale: oggiVero } = await import("@/lib/dataGiorno");
  return { useGiornoCorrente: () => giornoFinto.valore ?? oggiVero() };
});

afterEach(() => {
  cleanup();
  giornoFinto.valore = null;
});

function riga(id: string, nome: string, ora_inizio: string, altro: Partial<Pasto> = {}): Pasto {
  return {
    id, nome, ora_inizio, ordine: 0, user_id: USER_ID,
    updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null, valido_dal: null, valido_al: null, ...altro,
  };
}

function voce(id: string, pasto_id: string, data: string): VoceDiario {
  return {
    id, user_id: USER_ID, updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null,
    alimento_id: "a1", pasto_id, gruppo_id: null, quantita_g: 100, data,
    creato_il: "2026-10-01T00:00:00.000Z", consumato_alle: null,
    nome_alimento: "Mela", kcal_100g: 52, proteine_100g: 0.3, carboidrati_100g: 14, grassi_100g: 0.2,
  };
}

beforeEach(async () => {
  await Promise.all([db.pasti.clear(), db.voci_diario.clear(), db.outbox.clear()]);
  await db.pasti.bulkPut([
    riga("cena", "Cena", "19:30:00", { ordine: 4 }),
    riga("colazione", "Colazione", "06:00", { ordine: 0 }),
    riga("pranzo", "Pranzo", "12:30", { ordine: 2 }),
    // Chiuso ieri: non compare, ma il suo nome c'è nei giorni passati.
    riga("merenda", "Merenda", "16:00", { ordine: 3, valido_al: IERI }),
  ]);
  await db.voci_diario.bulkPut([voce("v-oggi", "pranzo", OGGI), voce("v-ieri", "pranzo", IERI)]);
});

async function apriPasto(nome: string) {
  render(<PastiEOrariPage />);
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${nome}`) }));
  return screen.getByRole("dialog");
}

function scrivi(sheet: HTMLElement, etichetta: string, valore: string) {
  fireEvent.change(within(sheet).getByLabelText(etichetta), { target: { value: valore } });
}

describe("Pagina Pasti e orari", () => {
  it("mostra i pasti di oggi in ordine d'orario, con l'ora sui primi 5 caratteri", async () => {
    render(<PastiEOrariPage />);
    await screen.findByRole("button", { name: /^Colazione/ });
    const righe = screen.getAllByRole("button").map((b) => b.textContent);
    expect(righe.slice(0, 3)).toEqual(["Colazione06:00", "Pranzo12:30", "Cena19:30"]);
    expect(screen.queryByText("Merenda")).toBeNull();
  });

  it("solo l'ora: domanda «Subito» o «Da una data»; Subito si scrive su tutta la riga, e Annulla la rimette", async () => {
    const sheet = await apriPasto("Cena");
    scrivi(sheet, "Inizia alle", "20:00");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));

    const domanda = await screen.findByRole("dialog", { name: "«Cena» alle 20:00" });
    expect(within(domanda).getByRole("button", { name: /^Subito/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(domanda).getByRole("button", { name: /^Da una data/ })).toBeTruthy();
    fireEvent.click(within(domanda).getByRole("button", { name: "Cambia orario" }));

    await waitFor(async () => expect((await db.pasti.get("cena"))?.ora_inizio).toBe("20:00"));
    expect((await db.pasti.get("cena"))?.valido_al ?? null).toBeNull();
    // L'"Annulla" della barra, non quello dello sheet: la scrittura in
    // Dexie finisce un attimo prima che lo sheet si chiuda, e cercare il
    // pulsante per nome in quell'attimo trovava quello dello sheet (test
    // instabile, 2 volte su 5).
    const barra = await screen.findByRole("status");
    expect(barra.textContent).toContain("Orario cambiato:");
    fireEvent.click(within(barra).getByRole("button", { name: "Annulla" }));
    await waitFor(async () => expect((await db.pasti.get("cena"))?.ora_inizio).toBe("19:30:00"));
  });

  it("un'ora già usata resta nello sheet con l'errore sotto il campo", async () => {
    const sheet = await apriPasto("Cena");
    scrivi(sheet, "Inizia alle", "12:30");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));
    expect(await within(sheet).findByText("Alle 12:30 inizia già Pranzo.")).toBeTruthy();
    expect((await db.pasti.get("cena"))?.ora_inizio).toBe("19:30:00");
  });

  it("nome nuovo: chiede da quando, con Da oggi già scelto, e sposta le voci di oggi", async () => {
    const sheet = await apriPasto("Pranzo");
    scrivi(sheet, "Nome", "Pranzo 1");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));

    const domanda = await screen.findByRole("dialog", { name: "«Pranzo» diventa «Pranzo 1»" });
    expect(within(domanda).getByRole("button", { name: /^Da oggi/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(domanda).getByRole("button", { name: "Rinomina" }));

    await waitFor(async () => expect((await db.pasti.get("pranzo"))?.valido_al).toBe(IERI));
    const nuovo = (await db.pasti.toArray()).find((p) => p.nome === "Pranzo 1");
    expect(nuovo).toMatchObject({ valido_dal: OGGI, valido_al: null });
    expect((await db.voci_diario.get("v-oggi"))?.pasto_id).toBe(nuovo?.id);
    expect((await db.voci_diario.get("v-ieri"))?.pasto_id).toBe("pranzo");
  });

  it("Correggi è bloccato se il nome nuovo c'è già nei giorni passati", async () => {
    const sheet = await apriPasto("Pranzo");
    scrivi(sheet, "Nome", "merenda");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));

    const domanda = await screen.findByRole("dialog", { name: /diventa/ });
    const correggi = within(domanda).getByRole("button", { name: /^Correggi/ }) as HTMLButtonElement;
    expect(correggi.disabled).toBe(true);
    expect(within(domanda).getByText("Nei giorni passati c'è già un pasto con questo nome.")).toBeTruthy();
  });

  it("solo maiuscole, o pasto nato oggi: si corregge senza domanda", async () => {
    await db.pasti.put(riga("spuntino", "Spuntino", "10:00", { ordine: 1, valido_dal: OGGI }));
    const sheet = await apriPasto("Spuntino");
    scrivi(sheet, "Nome", "Spuntino mattina");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));
    await waitFor(async () => expect((await db.pasti.get("spuntino"))?.nome).toBe("Spuntino mattina"));
    expect(screen.queryByText("Da quando vale?")).toBeNull();
    cleanup();

    const sheet2 = await apriPasto("Cena");
    scrivi(sheet2, "Nome", "cena");
    fireEvent.click(within(sheet2).getByRole("button", { name: "Salva" }));
    await waitFor(async () => expect((await db.pasti.get("cena"))?.nome).toBe("cena"));
    expect(screen.queryByText("Da quando vale?")).toBeNull();
  });

  it("Aggiungi pasto: nessuna ora proposta, e 'giorni passati' bloccato se lì il nome c'è già", async () => {
    render(<PastiEOrariPage />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Aggiungi pasto" }));
    const sheet = screen.getByRole("dialog");
    expect((within(sheet).getByLabelText("Inizia alle") as HTMLInputElement).value).toBe("");

    scrivi(sheet, "Nome", "Merenda");
    scrivi(sheet, "Inizia alle", "16:30");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));

    const domanda = await screen.findByRole("dialog", { name: "Da quando c'è «Merenda»?" });
    expect((within(domanda).getByRole("button", { name: /^Anche nei giorni passati/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(domanda).getByRole("button", { name: "Aggiungi pasto" }));

    await waitFor(async () => {
      const nuovo = (await db.pasti.toArray()).find((p) => p.nome === "Merenda" && p.id !== "merenda");
      expect(nuovo).toMatchObject({ ora_inizio: "16:30", valido_dal: OGGI, valido_al: null, ordine: 5 });
    });
  });
});

// Passo 4, Elimina pasto. Nel beforeEach: Colazione, Pranzo e Cena da
// sempre (Merenda chiusa ieri); Pranzo ha una voce oggi e una ieri, da 52
// kcal l'una.
describe("Pagina Pasti e orari — Elimina pasto", () => {
  async function eliminaDalloSheet(nome: string) {
    const sheet = await apriPasto(nome);
    // Spento finché le voci del pasto non sono lette (inAttesa).
    const pulsante = within(sheet).getByRole("button", { name: "Elimina pasto" }) as HTMLButtonElement;
    await waitFor(() => expect(pulsante.disabled).toBe(false));
    fireEvent.click(pulsante);
  }

  it("appena aperto lo sheet, Elimina resta spento finché le voci del pasto non sono lette", async () => {
    const sheet = await apriPasto("Pranzo");
    const pulsante = within(sheet).getByRole("button", { name: "Elimina pasto" }) as HTMLButtonElement;
    // Subito: la lettura delle voci non è ancora arrivata. Con "nessuna
    // lettura = nessuna voce", un tocco qui salterebbe la conferma.
    expect(pulsante.disabled).toBe(true);
    await waitFor(() => expect(pulsante.disabled).toBe(false));
  });

  it("l'unico pasto di oggi: pulsante spento, con il motivo", async () => {
    await db.pasti.bulkPut([
      riga("colazione", "Colazione", "06:00", { deleted_at: "2026-10-01T00:00:00.000Z" }),
      riga("cena", "Cena", "19:30", { deleted_at: "2026-10-01T00:00:00.000Z" }),
    ]);
    const sheet = await apriPasto("Pranzo");
    expect((within(sheet).getByRole("button", { name: "Elimina pasto" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(sheet).getByText("È l'unico pasto: almeno uno deve restare.")).toBeTruthy();
  });

  it("senza voci, da oggi: niente conferma, il pasto si chiude ieri", async () => {
    await eliminaDalloSheet("Cena");
    const domanda = await screen.findByRole("dialog", { name: "Eliminare «Cena»?" });
    expect(within(domanda).getByRole("button", { name: /^Da oggi/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(domanda).getByRole("button", { name: "Elimina pasto" }));

    await waitFor(async () => expect((await db.pasti.get("cena"))?.valido_al).toBe(IERI));
    expect(screen.queryByText(/Eliminare anche/)).toBeNull();
    expect((await screen.findByRole("status")).textContent).toContain("Eliminato da oggi:");
  });

  it("anche nei giorni passati, con voci: conferma con voci, giorni e kcal, poi Annulla rimette tutto", async () => {
    await eliminaDalloSheet("Pranzo");
    const domanda = await screen.findByRole("dialog", { name: "Eliminare «Pranzo»?" });
    expect(within(domanda).getByText("I giorni passati restano come sono. Le voci di oggi vengono eliminate.")).toBeTruthy();
    fireEvent.click(within(domanda).getByRole("button", { name: /^Anche nei giorni passati/ }));
    fireEvent.click(within(domanda).getByRole("button", { name: "Continua" }));

    const conferma = await screen.findByRole("alertdialog", { name: "Eliminare anche 2 voci?" });
    expect(conferma.textContent).toContain(
      "«Pranzo» ha 2 voci in 2 giorni, per 104 kcal. Verranno eliminate e i totali di quei giorni scenderanno."
    );
    expect(conferma.textContent).not.toContain("Non si può annullare");
    // Arrivata subito, non dopo un tentativo di scrittura rimandato
    // indietro da eliminaPasto ("cambiate").
    expect(conferma.textContent).not.toContain("Nel frattempo");
    expect(await db.outbox.count()).toBe(0);
    fireEvent.click(within(conferma).getByRole("button", { name: "Elimina pasto e 2 voci" }));

    await waitFor(async () => expect((await db.pasti.get("pranzo"))?.deleted_at).not.toBeNull());
    expect((await db.voci_diario.get("v-oggi"))?.deleted_at).not.toBeNull();
    expect((await db.voci_diario.get("v-ieri"))?.deleted_at).not.toBeNull();

    const barra = await screen.findByRole("status");
    expect(barra.textContent).toContain("Eliminato:");
    expect(barra.textContent).toContain("(2 voci)");
    fireEvent.click(within(barra).getByRole("button", { name: "Annulla" }));
    await waitFor(async () => {
      const ricreato = (await db.pasti.toArray()).find((p) => p.nome === "Pranzo" && p.deleted_at === null);
      expect(ricreato).toBeDefined();
      expect((await db.voci_diario.toArray()).filter((v) => v.pasto_id === ricreato?.id && v.deleted_at === null)).toHaveLength(2);
    });
  });

  it("un pasto nato oggi, senza voci: niente domanda, eliminato del tutto", async () => {
    await db.pasti.put(riga("brunch", "Brunch", "11:00", { ordine: 5, valido_dal: OGGI }));
    await eliminaDalloSheet("Brunch");

    await waitFor(async () => expect((await db.pasti.get("brunch"))?.deleted_at).not.toBeNull());
    expect(screen.queryByText(/Eliminare «Brunch»/)).toBeNull();
  });

  it("'Anche nei giorni passati' spento se un giorno passato resterebbe senza pasti", async () => {
    // Colazione e Cena da oggi, Merenda tolta: nei giorni passati resta
    // solo Pranzo. (La Merenda chiusa ieri coprirebbe il passato.)
    await db.pasti.bulkPut([
      riga("colazione", "Colazione", "06:00", { valido_dal: OGGI }),
      riga("cena", "Cena", "19:30:00", { ordine: 4, valido_dal: OGGI }),
      riga("merenda", "Merenda", "16:00", { ordine: 3, valido_al: IERI, deleted_at: "2026-10-01T00:00:00.000Z" }),
    ]);
    await eliminaDalloSheet("Pranzo");
    const domanda = await screen.findByRole("dialog", { name: "Eliminare «Pranzo»?" });
    const passati = within(domanda).getByRole("button", { name: /^Anche nei giorni passati/ }) as HTMLButtonElement;
    expect(passati.disabled).toBe(true);
    expect(within(domanda).getByText("Alcuni giorni passati resterebbero senza pasti.")).toBeTruthy();
  });

  it("Annulla in conflitto: la barra dice perché, niente scritto", async () => {
    await eliminaDalloSheet("Cena");
    const domanda = await screen.findByRole("dialog", { name: "Eliminare «Cena»?" });
    fireEvent.click(within(domanda).getByRole("button", { name: /^Anche nei giorni passati/ }));
    fireEvent.click(within(domanda).getByRole("button", { name: "Elimina pasto" }));
    await waitFor(async () => expect((await db.pasti.get("cena"))?.deleted_at).not.toBeNull());

    // Nel frattempo (un altro dispositivo) nasce un'altra "Cena".
    await db.pasti.put(riga("cena-2", "Cena", "20:00", { ordine: 6 }));
    const barra = await screen.findByRole("status");
    fireEvent.click(within(barra).getByRole("button", { name: "Annulla" }));

    expect(await screen.findByText("Non annullato: c'è già un pasto chiamato «Cena».")).toBeTruthy();
    expect((await db.pasti.toArray()).filter((p) => p.nome === "Cena" && p.deleted_at === null)).toHaveLength(1);
  });

  it("da oggi, con voci solo oggi: i testi dicono «di oggi»", async () => {
    await eliminaDalloSheet("Pranzo");
    const domanda = await screen.findByRole("dialog", { name: "Eliminare «Pranzo»?" });
    fireEvent.click(within(domanda).getByRole("button", { name: "Continua" }));

    const conferma = await screen.findByRole("alertdialog", { name: "Eliminare anche 1 voce?" });
    expect(conferma.textContent).toContain(
      "«Pranzo» ha 1 voce oggi, per 52 kcal. Verranno eliminate e i totali di oggi scenderanno."
    );
    fireEvent.click(within(conferma).getByRole("button", { name: "Elimina pasto e 1 voce" }));

    const barra = await screen.findByRole("status");
    await waitFor(() => expect(barra.textContent).toContain("(1 voce di oggi)"));
  });

  it("da oggi, con voci nei giorni futuri: le conta, le elimina, e Annulla le rimette", async () => {
    // Diario fino a oggi + 7: il Pranzo ha anche due voci pianificate.
    const domani = giornoSuccessivo(OGGI);
    const traTre = giornoSuccessivo(giornoSuccessivo(domani));
    await db.voci_diario.bulkPut([voce("v-domani", "pranzo", domani), voce("v-tra-tre", "pranzo", traTre)]);

    await eliminaDalloSheet("Pranzo");
    const domanda = await screen.findByRole("dialog", { name: "Eliminare «Pranzo»?" });
    expect(within(domanda).getByText("I giorni passati restano come sono. Le voci da oggi in poi vengono eliminate.")).toBeTruthy();
    fireEvent.click(within(domanda).getByRole("button", { name: "Continua" }));

    const conferma = await screen.findByRole("alertdialog", { name: "Eliminare anche 3 voci?" });
    expect(conferma.textContent).toContain(
      "«Pranzo» ha 3 voci in 3 giorni, da oggi in poi, per 156 kcal. Verranno eliminate e i totali di quei giorni scenderanno."
    );
    fireEvent.click(within(conferma).getByRole("button", { name: "Elimina pasto e 3 voci" }));

    await waitFor(async () => expect((await db.pasti.get("pranzo"))?.valido_al).toBe(IERI));
    for (const id of ["v-oggi", "v-domani", "v-tra-tre"]) {
      expect((await db.voci_diario.get(id))?.deleted_at).not.toBeNull();
    }
    expect((await db.voci_diario.get("v-ieri"))?.deleted_at).toBeNull();

    const barra = await screen.findByRole("status");
    expect(barra.textContent).toContain("(3 voci da oggi in poi)");
    fireEvent.click(within(barra).getByRole("button", { name: "Annulla" }));
    await waitFor(async () => {
      const vive = (await db.voci_diario.toArray()).filter((v) => v.pasto_id === "pranzo" && v.deleted_at === null);
      expect(vive.map((v) => v.data).sort()).toEqual([IERI, OGGI, domani, traTre]);
    });
  });
});

// Passo 5: "Da una data" nella domanda (PUNTO_DI_PARTENZA.md, sezione 3,
// "Date future e cambi programmati"). Le date si contano da oggi: il test
// gira in qualunque giorno.
describe("Pagina Pasti e orari — Da una data", () => {
  const DOMANI = giornoSuccessivo(OGGI);
  const DOPODOMANI = giornoSuccessivo(DOMANI);
  const TRA_TRE = giornoSuccessivo(DOPODOMANI);

  async function scegliData(domanda: HTMLElement, data: string) {
    fireEvent.click(within(domanda).getByRole("button", { name: /^Da una data/ }));
    const campo = within(domanda).getByLabelText("Dal giorno") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: data } });
    return campo;
  }

  it("rinomina: la data proposta è il prossimo lunedì; scelto un giorno, nome e ora nuovi valgono da lì", async () => {
    const sheet = await apriPasto("Pranzo");
    scrivi(sheet, "Nome", "Pranzo 1");
    scrivi(sheet, "Inizia alle", "14:30");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));
    const domanda = await screen.findByRole("dialog", { name: "«Pranzo» diventa «Pranzo 1»" });

    fireEvent.click(within(domanda).getByRole("button", { name: /^Da una data/ }));
    const campo = within(domanda).getByLabelText("Dal giorno") as HTMLInputElement;
    expect(campo.value).toBe(prossimoLunedi(OGGI));
    expect(campo.min).toBe(DOMANI);
    fireEvent.change(campo, { target: { value: DOPODOMANI } });
    expect(
      within(domanda).getByText(`Per un cambio dieta già deciso. Fino a ${formattaGiornoCorto(DOMANI)} resta «Pranzo».`)
    ).toBeTruthy();
    fireEvent.click(within(domanda).getByRole("button", { name: "Rinomina" }));

    await waitFor(async () => expect((await db.pasti.get("pranzo"))?.valido_al).toBe(DOMANI));
    expect((await db.pasti.get("pranzo"))?.ora_inizio).toBe("12:30");
    const nuovo = (await db.pasti.toArray()).find((p) => p.nome === "Pranzo 1");
    expect(nuovo).toMatchObject({ valido_dal: DOPODOMANI, valido_al: null, ora_inizio: "14:30", ordine: 2 });
    const barra = await screen.findByRole("status");
    expect(barra.textContent).toContain(`Programmato dal ${formattaGiornoCorto(DOPODOMANI)}:`);
    expect(barra.textContent).toContain("Pranzo → Pranzo 1");
  });

  it("solo l'ora da una data: fino al giorno prima resta l'ora di prima", async () => {
    const sheet = await apriPasto("Cena");
    scrivi(sheet, "Inizia alle", "20:00");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));
    const domanda = await screen.findByRole("dialog", { name: "«Cena» alle 20:00" });
    await scegliData(domanda, DOPODOMANI);
    expect(within(domanda).getByText(`Fino a ${formattaGiornoCorto(DOMANI)} inizia alle 19:30.`)).toBeTruthy();
    fireEvent.click(within(domanda).getByRole("button", { name: "Cambia orario" }));

    await waitFor(async () => expect((await db.pasti.get("cena"))?.valido_al).toBe(DOMANI));
    expect((await db.pasti.get("cena"))?.ora_inizio).toBe("19:30:00");
    const nuova = (await db.pasti.toArray()).find((p) => p.nome === "Cena" && p.id !== "cena");
    expect(nuova).toMatchObject({ valido_dal: DOPODOMANI, ora_inizio: "20:00" });
    expect((await screen.findByRole("status")).textContent).toContain("inizierà alle 20:00.");
  });

  it("aggiungi da una data: il pasto compare da quel giorno", async () => {
    render(<PastiEOrariPage />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Aggiungi pasto" }));
    const sheet = screen.getByRole("dialog");
    scrivi(sheet, "Nome", "Spuntino sera");
    scrivi(sheet, "Inizia alle", "21:30");
    fireEvent.click(within(sheet).getByRole("button", { name: /^(Continua|Salva)$/ }));
    const domanda = await screen.findByRole("dialog", { name: "Da quando c'è «Spuntino sera»?" });
    await scegliData(domanda, TRA_TRE);
    fireEvent.click(within(domanda).getByRole("button", { name: "Aggiungi pasto" }));

    await waitFor(async () =>
      expect((await db.pasti.toArray()).find((p) => p.nome === "Spuntino sera")).toMatchObject({ valido_dal: TRA_TRE })
    );
    expect((await screen.findByRole("status")).textContent).toContain(`Programmato dal ${formattaGiornoCorto(TRA_TRE)}:`);
  });

  it("elimina da una data: le voci da quel giorno in poi nella spiegazione, nella conferma e nella barra", async () => {
    await db.voci_diario.put(voce("v-futura", "pranzo", TRA_TRE));
    const sheet = await apriPasto("Pranzo");
    const pulsante = within(sheet).getByRole("button", { name: "Elimina pasto" }) as HTMLButtonElement;
    await waitFor(() => expect(pulsante.disabled).toBe(false));
    fireEvent.click(pulsante);
    const domanda = await screen.findByRole("dialog", { name: "Eliminare «Pranzo»?" });
    await scegliData(domanda, DOPODOMANI);
    expect(
      within(domanda).getByText(
        `Resta fino a ${formattaGiornoCorto(DOMANI)}, poi non compare più. Le voci dal ${formattaGiornoCorto(DOPODOMANI)} vengono eliminate.`
      )
    ).toBeTruthy();
    fireEvent.click(within(domanda).getByRole("button", { name: "Continua" }));

    const conferma = await screen.findByRole("alertdialog", { name: "Eliminare anche 1 voce?" });
    expect(conferma.textContent).toContain(
      `«Pranzo» ha 1 voce in 1 giorno, dal ${formattaGiornoCorto(DOPODOMANI)}, per 52 kcal.`
    );
    fireEvent.click(within(conferma).getByRole("button", { name: "Elimina pasto e 1 voce" }));

    await waitFor(async () => expect((await db.pasti.get("pranzo"))?.valido_al).toBe(DOMANI));
    expect((await db.voci_diario.get("v-futura"))?.deleted_at).not.toBeNull();
    expect((await db.voci_diario.get("v-oggi"))?.deleted_at).toBeNull();
    const barra = await screen.findByRole("status");
    expect(barra.textContent).toContain(`non ci sarà più dal ${formattaGiornoCorto(DOPODOMANI)} (1 voce).`);
  });

  it("con un cambio già programmato la data arriva fino a quel giorno: oltre, errore e pulsante spento", async () => {
    await cambiaDal({ id: "pranzo", nome: "Pranzo 1", ora: "12:30", dal: DOPODOMANI, oggi: OGGI });
    const sheet = await apriPasto("Pranzo");
    scrivi(sheet, "Nome", "Pranzo X");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));
    const domanda = await screen.findByRole("dialog", { name: "«Pranzo» diventa «Pranzo X»" });
    const campo = await scegliData(domanda, TRA_TRE);

    expect(campo.max).toBe(DOPODOMANI);
    expect(
      within(domanda).getByText(`Scegli un giorno fra ${formattaGiornoCorto(DOMANI)} e ${formattaGiornoCorto(DOPODOMANI)}.`)
    ).toBeTruthy();
    expect(
      within(domanda).getByText(`Il ${formattaGiornoCorto(DOPODOMANI)} è già programmato un cambio: scegliendo quel giorno lo modifichi.`)
    ).toBeTruthy();
    expect((within(domanda).getByRole("button", { name: "Rinomina" }) as HTMLButtonElement).disabled).toBe(true);

    // Lo stesso giorno del cambio: lo sostituisce.
    fireEvent.change(campo, { target: { value: DOPODOMANI } });
    expect(within(domanda).getByText(`Il ${formattaGiornoCorto(DOPODOMANI)} c'è già un cambio programmato: lo sostituisce.`)).toBeTruthy();
    fireEvent.click(within(domanda).getByRole("button", { name: "Rinomina" }));
    await waitFor(async () => expect((await db.pasti.toArray()).some((p) => p.nome === "Pranzo X")).toBe(true));
    expect((await db.pasti.toArray()).some((p) => p.nome === "Pranzo 1" && p.deleted_at === null)).toBe(false);
    expect((await screen.findByRole("status")).textContent).toContain(`Cambio del ${formattaGiornoCorto(DOPODOMANI)} modificato:`);
  });

  it("un pasto nato oggi: cambiando l'ora nessuna domanda, si scrive subito", async () => {
    await db.pasti.put(riga("brunch", "Brunch", "11:00", { ordine: 5, valido_dal: OGGI }));
    const sheet = await apriPasto("Brunch");
    scrivi(sheet, "Inizia alle", "11:15");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));

    await waitFor(async () => expect((await db.pasti.get("brunch"))?.ora_inizio).toBe("11:15"));
    expect(screen.queryByText("Da quando vale?")).toBeNull();
  });
});

describe("Pagina Pasti e orari — Schede per data", () => {
  const DOMANI = giornoSuccessivo(OGGI);
  const DOPODOMANI = giornoSuccessivo(DOMANI);
  const TRA_TRE = giornoSuccessivo(DOPODOMANI);

  // La riga di un cambio: il testo accanto al suo Annulla.
  function rigaCambio(descrizione: string): string {
    const pulsante = screen.getByRole("button", { name: `Annulla: ${descrizione}` });
    return pulsante.previousElementSibling?.textContent ?? "";
  }

  it("senza cambi programmati non ci sono schede", async () => {
    render(<PastiEOrariPage />);
    await screen.findByRole("button", { name: /^Colazione/ });
    expect(screen.queryByRole("group", { name: "Pasti per data" })).toBeNull();
  });

  it("la scheda di una data mostra i pasti di quel giorno, cosa cambia e i cambi; Oggi resta com'è", async () => {
    await cambiaDal({ id: "pranzo", nome: "Pranzo 1", ora: "14:30", dal: DOPODOMANI, oggi: OGGI });
    await cambiaDal({ id: "colazione", nome: "Colazione", ora: "07:00", dal: DOPODOMANI, oggi: OGGI });
    await aggiungiPasto({ userId: USER_ID, nome: "Spuntino", ora: "16:30", dal: DOPODOMANI, oggi: OGGI });
    await db.voci_diario.put(voce("v-cena", "cena", TRA_TRE));
    await eliminaPasto({ id: "cena", modo: "data", oggi: OGGI, dal: DOPODOMANI, idVociConfermate: ["v-cena"] });

    render(<PastiEOrariPage />);
    const schede = await screen.findByRole("group", { name: "Pasti per data" });
    const tab = within(schede).getAllByRole("button");
    expect(tab.map((b) => b.textContent)).toEqual(["Oggi", `Dal ${formattaGiornoCorto(DOPODOMANI)}`]);
    expect(tab[0].getAttribute("aria-pressed")).toBe("true");
    // In Oggi, i pasti di oggi come sempre, sotto il titolo con la data.
    expect(screen.getByText(`Oggi, ${formattaGiornoCorto(OGGI)}`)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Pranzo12:30/ })).toBeTruthy();

    fireEvent.click(tab[1]);
    expect(
      await screen.findByText(`Così saranno i tuoi pasti dal ${formattaGiornoCorto(DOPODOMANI)}. Si modificano dalla scheda Oggi.`)
    ).toBeTruthy();
    // I pasti di quel giorno, in ordine d'orario e non toccabili.
    expect(screen.queryByRole("button", { name: /^Pranzo 1/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "+ Aggiungi pasto" })).toBeNull();
    const pasti = screen.getByText(`Dal ${formattaGiornoCorto(DOPODOMANI)}`, { selector: "h2" }).closest("section")!;
    expect(pasti.textContent).toBe(
      "Dal " + formattaGiornoCorto(DOPODOMANI) +
        "Colazioneora nuovaprima: 06:0007:00" +
        "Pranzo 1nome nuovoprima: Pranzo14:30" +
        "Spuntinonuovo16:30" +
        "Non ci sarà più: Cena"
    );
    expect(rigaCambio("Colazione 06:00 → 07:00")).toBe("Colazione 06:00 → 07:00ora nuova");
    expect(rigaCambio("Pranzo → Pranzo 1")).toBe("Pranzo → Pranzo 1nome nuovo, alle 14:30");
    expect(rigaCambio("nuovo pasto Spuntino")).toBe("Nuovo pasto: Spuntinoinizia alle 16:30");
    await waitFor(() =>
      expect(rigaCambio("Cena non ci sarà più")).toBe(
        `Cena non ci sarà più1 voce eliminata, del ${formattaGiornoCorto(TRA_TRE)}`
      )
    );
  });

  it("Annulla dalla scheda: l'eliminazione si annulla con le sue voci, e senza altri cambi le schede spariscono", async () => {
    await db.voci_diario.put(voce("v-cena", "cena", TRA_TRE));
    await eliminaPasto({ id: "cena", modo: "data", oggi: OGGI, dal: DOPODOMANI, idVociConfermate: ["v-cena"] });

    render(<PastiEOrariPage />);
    fireEvent.click(await screen.findByRole("button", { name: `Dal ${formattaGiornoCorto(DOPODOMANI)}` }));
    const annulla = await screen.findByRole("button", { name: "Annulla: Cena non ci sarà più" });
    await waitFor(() => expect(rigaCambio("Cena non ci sarà più")).toContain("1 voce eliminata"));
    fireEvent.click(annulla);

    await waitFor(async () => expect((await db.pasti.get("cena"))?.valido_al ?? null).toBeNull());
    // Ricreata (id nuovo, mai una riga rimessa in vita), sul suo giorno.
    const vive = (await db.voci_diario.toArray()).filter((v) => v.pasto_id === "cena" && v.deleted_at === null);
    expect(vive.map((v) => v.data)).toEqual([TRA_TRE]);
    const barra = await screen.findByRole("status");
    expect(barra.textContent).toContain("Cambio annullato:");
    expect(barra.textContent).toContain("(tornano 1 voce)");
    // La barra non ha un altro Annulla: il cambio si riprogramma da Oggi.
    expect(within(barra).queryByRole("button", { name: "Annulla" })).toBeNull();
    // Nessun cambio rimasto: niente schede, si torna a Oggi.
    await waitFor(() => expect(screen.queryByRole("group", { name: "Pasti per data" })).toBeNull());
    expect(screen.getByRole("button", { name: /^Cena19:30/ })).toBeTruthy();
  });

  it("Annulla dalla scheda in conflitto: la barra dice perché, niente scritto", async () => {
    await cambiaDal({ id: "pranzo", nome: "Pranzo 1", ora: "12:30", dal: DOPODOMANI, oggi: OGGI });
    // Da tra tre giorni c'è un altro «Pranzo»: la vecchia riga, riaperta
    // senza fine, si scontrerebbe con lui.
    await aggiungiPasto({ userId: USER_ID, nome: "Spuntino", ora: "11:00", dal: TRA_TRE, oggi: OGGI });
    const altro = (await db.pasti.toArray()).find((p) => p.nome === "Spuntino")!;
    await db.pasti.update(altro.id, { nome: "Pranzo" });

    render(<PastiEOrariPage />);
    fireEvent.click(await screen.findByRole("button", { name: `Dal ${formattaGiornoCorto(DOPODOMANI)}` }));
    fireEvent.click(await screen.findByRole("button", { name: "Annulla: Pranzo → Pranzo 1" }));

    const barra = await screen.findByRole("status");
    expect(barra.textContent).toMatch(/^Non annullato/);
    expect((await db.pasti.toArray()).some((p) => p.nome === "Pranzo 1" && p.deleted_at === null)).toBe(true);
  });

  it("quando la data arriva la sua scheda sparisce, e i pasti nuovi sono quelli di Oggi", async () => {
    await cambiaDal({ id: "pranzo", nome: "Pranzo 1", ora: "12:30", dal: DOMANI, oggi: OGGI });
    const { rerender } = render(<PastiEOrariPage />);
    fireEvent.click(await screen.findByRole("button", { name: `Dal ${formattaGiornoCorto(DOMANI)}` }));
    await screen.findByText(/^Così saranno i tuoi pasti/);

    giornoFinto.valore = DOMANI;
    rerender(<PastiEOrariPage />);

    expect(screen.queryByRole("group", { name: "Pasti per data" })).toBeNull();
    expect(screen.queryByText(/^Così saranno i tuoi pasti/)).toBeNull();
    expect(screen.getByRole("button", { name: /^Pranzo 112:30/ })).toBeTruthy();
  });
});
