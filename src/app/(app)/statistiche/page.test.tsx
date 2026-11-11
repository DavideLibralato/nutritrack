// Test permanente sulla pagina Statistiche (PUNTO_DI_PARTENZA.md §3,
// "Statistiche"): gli stati vuoti (utente nuovo, periodo senza voci), il
// tocco su una barra con il dettaglio e «Apri il giorno», l'indirizzo non
// valido che torna alla settimana in corso, e la regola "non scrive
// niente". Le medie e i colori hanno i loro test sulle funzioni pure; qui
// si controlla che la pagina le colleghi.
//
// I dati si mettono direttamente nelle tabelle di Dexie (finto,
// fake-indexeddb), senza passare dal repository: così l'outbox resta vuota e
// si vede se la pagina ci scrive qualcosa. Le date sono relative al giorno
// vero in cui gira il test (oggi e il lunedì della sua settimana).

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import StatistichePage from "./page";
import { db } from "@/lib/db/database";
import { formattaDataEstesa, lunediDi, oggiLocale, piuGiorni } from "@/lib/dataGiorno";
import type { Misurazione, Obiettivo, ObiettivoTarget, VoceDiario } from "@/lib/db/tipi";

let utenteTest = "";
beforeEach(() => {
  utenteTest = `utente-statistiche-${crypto.randomUUID()}`;
});

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => utenteTest,
  useNomeUtente: () => null,
  useEmailUtente: () => null,
}));

let parametri = new URLSearchParams();
beforeEach(() => {
  parametri = new URLSearchParams();
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => parametri,
  usePathname: () => "/statistiche",
}));

afterEach(cleanup);

const OGGI = oggiLocale();
const ADESSO = new Date().toISOString();

function base() {
  return { id: crypto.randomUUID(), user_id: utenteTest, updated_at: ADESSO, deleted_at: null };
}

function voce(data: string, kcal: number): VoceDiario {
  return {
    ...base(),
    alimento_id: null,
    pasto_id: null,
    gruppo_id: null,
    quantita_g: 100,
    data,
    creato_il: ADESSO,
    consumato_alle: null,
    nome_alimento: "Pasta",
    kcal_100g: kcal,
    proteine_100g: 100,
    carboidrati_100g: 250,
    grassi_100g: 60,
  };
}

async function conObiettivo(kcal: number) {
  const obiettivo: Obiettivo = {
    ...base(),
    valido_dal: "2026-01-01",
    tipo: "massa",
    kcal,
    proteine_g: 140,
    carboidrati_g: 250,
    grassi_g: 70,
    peso_obiettivo: null,
  };
  const target: ObiettivoTarget = {
    ...base(),
    obiettivo_id: obiettivo.id,
    tipo_giorno: "normale",
    kcal,
    proteine_g: 140,
    carboidrati_g: 250,
    grassi_g: 70,
  };
  await db.obiettivi.add(obiettivo);
  await db.obiettivi_target.add(target);
}

function maiuscola(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

describe("pagina Statistiche", () => {
  it("utente nuovo: riquadri «—», invito al primo pasto, nessuna pesata, frecce spente", async () => {
    render(<StatistichePage />);

    expect(await screen.findByText("Le medie e le barre compaiono dal primo pasto che registri.")).toBeTruthy();
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.getAllByText("nessun giorno registrato")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Registra il primo pasto" }).getAttribute("href")).toBe("/aggiungi");
    expect(screen.getByText("Nessuna pesata. Ogni pesata diventa un punto del grafico.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Registra peso" }).getAttribute("href")).toBe("/impostazioni/peso");
    expect((screen.getByRole("button", { name: "Periodo precedente" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Periodo successivo" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Questa settimana")).toBeTruthy();
  });

  it("un periodo senza voci: «—» nei riquadri e «nessun giorno registrato» sopra le barre", async () => {
    // Una voce sola, tre settimane fa: la settimana in corso è vuota.
    await db.voci_diario.add(voce(piuGiorni(lunediDi(OGGI), -21), 2000));
    render(<StatistichePage />);

    expect(await screen.findByRole("group", { name: "Calorie giornaliere" })).toBeTruthy();
    expect(screen.getAllByText("—")).toHaveLength(4);
    // 4 riquadri + la testata del grafico.
    expect(screen.getAllByText("nessun giorno registrato")).toHaveLength(5);
    expect(screen.queryByText("Le medie e le barre compaiono dal primo pasto che registri.")).toBeNull();
    // Si può tornare indietro fino alla settimana della voce; avanti no.
    expect((screen.getByRole("button", { name: "Periodo precedente" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Periodo successivo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("media, obiettivo, stato, e il tocco su una barra apre e chiude il dettaglio", async () => {
    await conObiettivo(2200);
    await db.voci_diario.add(voce(OGGI, 2250));
    render(<StatistichePage />);

    const barra = await screen.findByRole("button", {
      name: `${maiuscola(formattaDataEstesa(OGGI))}, 2250 kcal`,
    });
    expect(screen.getByText("2250")).toBeTruthy();
    expect(screen.getAllByText("su 1 giorno")).toHaveLength(4);
    // Nel riquadro kcal e sulla linea del grafico (stesso target ogni giorno).
    expect(screen.getAllByText("obiettivo 2200")).toHaveLength(2);
    expect(screen.getByText("Tocca una barra per vedere il giorno")).toBeTruthy();

    fireEvent.click(barra);
    const dettaglio = screen.getByRole("status");
    expect(within(dettaglio).getByText("2250 kcal")).toBeTruthy();
    expect(within(dettaglio).getByText("/ 2200")).toBeTruthy();
    // 2250 su 2200 con Massa: dentro la fascia del 5%.
    expect(within(dettaglio).getByText("in linea")).toBeTruthy();
    expect(within(dettaglio).getByRole("link", { name: "Apri il giorno" }).getAttribute("href")).toBe(
      `/?giorno=${OGGI}`
    );
    expect(barra.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(barra);
    expect(screen.getByText("Tocca una barra per vedere il giorno")).toBeTruthy();
    expect(barra.getAttribute("aria-pressed")).toBe("false");
  });

  it("un indirizzo non valido torna alla settimana in corso, senza errori", async () => {
    await db.voci_diario.add(voce(OGGI, 2000));
    parametri = new URLSearchParams("vista=anno&dal=2026-02-30");
    render(<StatistichePage />);
    expect(await screen.findByText("Questa settimana")).toBeTruthy();
  });

  it("il peso: differenza, ultima pesata e il link a Impostazioni > Peso", async () => {
    const pesata = (data: string, valore: number): Misurazione => ({ ...base(), tipo: "peso", valore, unita: "kg", data });
    await db.voci_diario.add(voce(OGGI, 2000));
    await db.misurazioni.bulkAdd([pesata(piuGiorni(OGGI, -20), 83.3), pesata(OGGI, 84.3)]);
    render(<StatistichePage />);

    expect(await screen.findByText(/^\+1,0 kg dal /)).toBeTruthy();
    expect(screen.getByText("Ultima pesata oggi")).toBeTruthy();
    expect(screen.getByRole("img", { name: /^Andamento del peso/ })).toBeTruthy();
  });

  it("non scrive niente: né righe nuove né scritture in attesa", async () => {
    await conObiettivo(2200);
    await db.voci_diario.add(voce(OGGI, 2250));
    const prima = {
      outbox: await db.outbox.count(),
      voci: await db.voci_diario.count(),
      giorni: await db.giorni.count(),
      misurazioni: await db.misurazioni.count(),
    };
    render(<StatistichePage />);
    fireEvent.click(await screen.findByRole("button", { name: /, 2250 kcal$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mese" }));

    expect({
      outbox: await db.outbox.count(),
      voci: await db.voci_diario.count(),
      giorni: await db.giorni.count(),
      misurazioni: await db.misurazioni.count(),
    }).toEqual(prima);
  });
});
