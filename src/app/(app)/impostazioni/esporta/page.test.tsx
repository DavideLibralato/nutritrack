// La pagina Impostazioni > Esporta i miei dati (mockup approvato
// docs/mockups/esporta.html, 08/11). Qui si controlla che, dato lo stato
// del telefono, la pagina mostri lo stato giusto con i suoi testi, e che i
// pulsanti facciano quello che dicono: il foglio di condivisione si apre
// subito al tocco, il promemoria cambia solo con il JSON salvato. Le regole
// di raccolta, foto, CSV e strade hanno i loro test in src/lib/esporta.
//
// Finti: l'utente, il router, la foto (fotoPerEsportazione) e il browser
// (ambienteBrowser). Dexie, la raccolta e il CSV sono quelli veri.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import EsportaPage from "./page";
import { db } from "@/lib/db/database";
import type { Alimento, Pasto, Profilo, VoceDiario } from "@/lib/db/tipi";
import { TABELLE_DISCESA } from "@/lib/sync/discesa";
import { segnaDiscesaCompleta } from "@/lib/sync/discesaCompleta";
import { azzeraStatoGiri, segnaFineGiro } from "@/lib/sync/statoSincronizzazione";
import { leggiUltimaEsportazione, segnaEsportazione } from "@/lib/esporta/ultimaEsportazione";
import type { AmbienteSalvataggio } from "@/lib/esporta/condividiFile";
import type { FotoPerEsportazione } from "@/lib/esporta/fotoEsportazione";

const USER_ID = "utente-test-esporta";

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => USER_ID,
}));

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: router.push, replace: () => {}, refresh: () => {} }),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

// La foto: si decide test per test, anche "non risponde ancora".
const foto = vi.hoisted(() => ({
  risposta: null as null | (() => Promise<FotoPerEsportazione>),
}));
vi.mock("@/lib/esporta/fotoEsportazione", () => ({
  fotoPerEsportazione: () =>
    foto.risposta ? foto.risposta() : Promise.resolve({ statoFoto: { stato: "assente" }, foto: null }),
}));

// Il browser: condivisione che riesce, salvo diversa indicazione.
const browser = vi.hoisted(() => ({ ambiente: null as unknown as AmbienteSalvataggio }));
vi.mock("@/lib/esporta/condividiFile", async (originale) => ({
  ...(await originale<typeof import("@/lib/esporta/condividiFile")>()),
  ambienteBrowser: () => browser.ambiente,
}));

let share: ReturnType<typeof vi.fn<(dati: { files: File[] }) => Promise<void>>>;

function errore(nome: string) {
  const e = new Error(nome);
  e.name = nome;
  return e;
}

// --- Il telefono --------------------------------------------------------------

function profilo(): Profilo {
  return {
    id: crypto.randomUUID(),
    user_id: USER_ID,
    updated_at: "2026-11-07T08:00:00.000Z",
    deleted_at: null,
    nome: null,
    sesso: "non_indicato",
    data_nascita: null,
    altezza_cm: 180,
    livello_attivita: "moderato",
    differenzia_giorni: false,
    giorni_allenamento_default: null,
  };
}

function pastoDiBase(): Pasto {
  return {
    id: crypto.randomUUID(),
    user_id: USER_ID,
    updated_at: "2026-11-07T08:00:00.000Z",
    deleted_at: null,
    nome: "Pranzo",
    ora_inizio: "12:30",
    ordine: 2,
  };
}

const MELA: Alimento = {
  id: crypto.randomUUID(),
  user_id: USER_ID,
  updated_at: "2026-11-07T08:00:00.000Z",
  deleted_at: null,
  nome: "Mela",
  marca: null,
  barcode: null,
  kcal_100g: 52,
  proteine_100g: 0.3,
  carboidrati_100g: 14,
  grassi_100g: 0.2,
  zuccheri_100g: null,
  fibre_100g: null,
  saturi_100g: null,
  sale_100g: null,
  porzione_default_g: 150,
  fonte: "manuale",
  verificato: false,
};

function voce(data: string): VoceDiario {
  return {
    id: crypto.randomUUID(),
    user_id: USER_ID,
    updated_at: "2026-11-07T08:00:00.000Z",
    deleted_at: null,
    alimento_id: MELA.id,
    pasto_id: null,
    gruppo_id: null,
    quantita_g: 150,
    data,
    creato_il: `${data}T12:00:00.000Z`,
    consumato_alle: null,
    nome_alimento: "Mela",
    kcal_100g: 52,
    proteine_100g: 0.3,
    carboidrati_100g: 14,
    grassi_100g: 0.2,
  };
}

async function telefonoPronto({ voci = true }: { voci?: boolean } = {}) {
  await db.profili.put(profilo());
  await db.alimenti.put(MELA);
  if (voci) await db.voci_diario.bulkPut([voce("2026-09-21"), voce("2026-11-07")]);
  await db.misurazioni.put({
    id: crypto.randomUUID(),
    user_id: USER_ID,
    updated_at: "2026-11-07T08:00:00.000Z",
    deleted_at: null,
    tipo: "peso",
    valore: 78.4,
    unita: "kg",
    data: "2026-11-07",
  });
  segnaDiscesaCompleta(USER_ID);
}

beforeEach(async () => {
  window.localStorage.clear();
  azzeraStatoGiri();
  router.push.mockClear();
  foto.risposta = null;
  share = vi.fn<(dati: { files: File[] }) => Promise<void>>(async () => {});
  browser.ambiente = { canShare: () => true, share, installata: true };
  for (const { tabella } of TABELLE_DISCESA) await tabella.clear();
});

afterEach(cleanup);

const pulsanteJson = () => screen.getByRole("button", { name: /^(Esporta i miei dati|Riprova|Preparo il file…)$/ });
const rigaCsv = () => screen.getByRole("button", { name: /Esporta il diario per Excel/ });

async function aspettaPronta() {
  await waitFor(() => expect((pulsanteJson() as HTMLButtonElement).disabled).toBe(false));
}

// --- Gli stati ----------------------------------------------------------------

describe("Esporta — copia locale incompleta", () => {
  it("dati non ancora scaricati: il riquadro, «Vai a Sincronizzazione», il promemoria", async () => {
    await db.profili.put(profilo()); // il profilo c'è, il segno no
    render(<EsportaPage />);
    expect(await screen.findByText("Dati non ancora scaricati")).toBeTruthy();
    expect(screen.getByText(/Collegati a internet e tieni Libra aperta/)).toBeTruthy();
    expect(screen.getByText("Mai esportato")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Esporta i miei dati" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Vai a Sincronizzazione" }));
    expect(router.push).toHaveBeenCalledWith("/impostazioni/sincronizzazione");
  });

  it("manca il profilo (altre righe ci sono): un messaggio diverso, «Vai al profilo» apre Profilo", async () => {
    segnaDiscesaCompleta(USER_ID);
    await db.pasti.put(pastoDiBase());
    render(<EsportaPage />);
    expect(await screen.findByText("Manca il tuo profilo")).toBeTruthy();
    expect(screen.getByText("Per esportare serve il tuo profilo. Compilalo e torna qui.")).toBeTruthy();
    expect(screen.queryByText("Dati non ancora scaricati")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Vai al profilo" }));
    expect(router.push).toHaveBeenCalledWith("/impostazioni/profilo");
  });

  it("segno presente ma nessuna riga (Safari ha svuotato IndexedDB): «Dati non ancora scaricati», non «Manca il tuo profilo»", async () => {
    segnaDiscesaCompleta(USER_ID);
    render(<EsportaPage />);
    expect(await screen.findByText("Dati non ancora scaricati")).toBeTruthy();
    expect(screen.queryByText("Manca il tuo profilo")).toBeNull();
  });

  it("manca il profilo, poi arriva: alla fine del giro si prepara da sola", async () => {
    segnaDiscesaCompleta(USER_ID);
    await db.pasti.put(pastoDiBase());
    render(<EsportaPage />);
    expect(await screen.findByText("Manca il tuo profilo")).toBeTruthy();
    await db.profili.put(profilo());
    act(() => segnaFineGiro("salita", "ok", { parlatoColServer: true }));
    act(() => segnaFineGiro("discesa", "ok", { parlatoColServer: true }));
    await aspettaPronta();
    expect(screen.queryByText("Manca il tuo profilo")).toBeNull();
  });

  it("i dati arrivano mentre la pagina è aperta: alla fine del giro si prepara da sola", async () => {
    await db.profili.put(profilo());
    render(<EsportaPage />);
    expect(await screen.findByText("Dati non ancora scaricati")).toBeTruthy();
    segnaDiscesaCompleta(USER_ID);
    act(() => segnaFineGiro("discesa", "ok", { parlatoColServer: true }));
    await aspettaPronta();
    expect(screen.queryByText("Dati non ancora scaricati")).toBeNull();
  });
});

describe("Esporta — preparazione e riepilogo", () => {
  it("mentre la foto è in verifica: «Preparo il file…» spento, «Controllo…», CSV spento", async () => {
    await telefonoPronto();
    let rispondi!: (f: FotoPerEsportazione) => void;
    foto.risposta = () => new Promise((r) => (rispondi = r));
    render(<EsportaPage />);

    const pulsante = await screen.findByRole("button", { name: "Preparo il file…" });
    expect((pulsante as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Controllo…")).toBeTruthy();
    expect((rigaCsv() as HTMLButtonElement).disabled).toBe(true);

    await act(async () => rispondi({ statoFoto: { stato: "assente" }, foto: null }));
    await aspettaPronta();
    expect(screen.getByText("Non hai una foto")).toBeTruthy();
  });

  it("pronta: i numeri, la nota, nome e peso del file, il promemoria", async () => {
    await telefonoPronto();
    segnaEsportazione(USER_ID, new Date(Date.now() - 3 * 86_400_000));
    render(<EsportaPage />);
    await aspettaPronta();

    expect(screen.getByText("2 voci")).toBeTruthy();
    expect(screen.getByText("dal 21/09 al 07/11")).toBeTruthy();
    expect(screen.getByText(/^Sono i dati di questo telefono\./)).toBeTruthy();
    expect(screen.getByText(/^libra-dati-\d{4}-\d{2}-\d{2}\.json$/)).toBeTruthy();
    expect(screen.getByText(/^circa \d+ KB$/)).toBeTruthy();
    expect(screen.getByText("Ultima esportazione: 3 giorni fa")).toBeTruthy();
    expect(screen.getByText(/Il file contiene dati personali e di salute:/)).toBeTruthy();
    expect((rigaCsv() as HTMLButtonElement).disabled).toBe(false);
  });

  it("foto dalla copia del telefono: «Inclusa» e la sua nota al posto di quella dei dati", async () => {
    await telefonoPronto();
    foto.risposta = async () => ({
      statoFoto: { stato: "inclusa", origine: "telefono" },
      foto: { tipo: "image/jpeg", base64: "/9j/" },
    });
    render(<EsportaPage />);
    await aspettaPronta();
    expect(screen.getByText("Inclusa")).toBeTruthy();
    expect(screen.getByText(/La foto è quella salvata su questo telefono/)).toBeTruthy();
    expect(screen.queryByText(/^Sono i dati di questo telefono\./)).toBeNull();
  });

  it("foto non inclusa: «Non inclusa» in colore di avviso e la sua nota", async () => {
    await telefonoPronto();
    foto.risposta = async () => ({ statoFoto: { stato: "non-inclusa" }, foto: null });
    render(<EsportaPage />);
    await aspettaPronta();
    expect(screen.getByText("Non inclusa").className).toContain("text-warning");
    expect(screen.getByText(/Senza rete non so se hai una foto aggiornata/)).toBeTruthy();
  });

  it("diario vuoto: «Nessuna voce», la riga del CSV spenta con «Il diario è vuoto.»", async () => {
    await telefonoPronto({ voci: false });
    render(<EsportaPage />);
    await aspettaPronta();
    expect(screen.getByText("Nessuna voce")).toBeTruthy();
    expect(screen.getByText("Il diario è vuoto.")).toBeTruthy();
    expect((rigaCsv() as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Esporta — al tocco", () => {
  it("il foglio si apre subito al tocco, con il file JSON", async () => {
    await telefonoPronto();
    render(<EsportaPage />);
    await aspettaPronta();

    fireEvent.click(pulsanteJson());
    // Nessuna attesa fra il tocco e share: già chiamato qui.
    expect(share).toHaveBeenCalledTimes(1);
    const [file] = share.mock.calls[0][0].files;
    expect(file.type).toBe("application/json");
    expect(JSON.parse(await file.text()).intestazione.user_id).toBe(USER_ID);
  });

  it("salvato: «File salvato» e il promemoria passa a oggi", async () => {
    await telefonoPronto();
    render(<EsportaPage />);
    await aspettaPronta();
    expect(screen.getByText("Mai esportato")).toBeTruthy();

    fireEvent.click(pulsanteJson());
    expect(await screen.findByText("File salvato")).toBeTruthy();
    expect(screen.getByText("Ultima esportazione: oggi")).toBeTruthy();
    expect(leggiUltimaEsportazione(USER_ID)).not.toBeNull();
  });

  it("foglio annullato: nessun messaggio, il promemoria non cambia", async () => {
    await telefonoPronto();
    share.mockImplementation(() => Promise.reject(errore("AbortError")));
    render(<EsportaPage />);
    await aspettaPronta();

    fireEvent.click(pulsanteJson());
    await waitFor(() => expect(share).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByText("File salvato")).toBeNull();
    expect(screen.queryByText("Il file non è stato salvato.")).toBeNull();
    expect(screen.getByText("Mai esportato")).toBeTruthy();
    expect(leggiUltimaEsportazione(USER_ID)).toBeNull();
  });

  it("errore: il messaggio e «Riprova»; al secondo tentativo riuscito il messaggio sparisce", async () => {
    await telefonoPronto();
    share.mockImplementationOnce(() => Promise.reject(errore("NotAllowedError")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<EsportaPage />);
    await aspettaPronta();

    fireEvent.click(pulsanteJson());
    expect(await screen.findByText("Il file non è stato salvato.")).toBeTruthy();
    expect(pulsanteJson().textContent).toBe("Riprova");
    expect(leggiUltimaEsportazione(USER_ID)).toBeNull();

    fireEvent.click(pulsanteJson());
    expect(await screen.findByText("File salvato")).toBeTruthy();
    expect(screen.queryByText("Il file non è stato salvato.")).toBeNull();
    expect(pulsanteJson().textContent).toBe("Esporta i miei dati");
  });

  it("dopo un errore, un foglio annullato non cambia niente: il messaggio e «Riprova» restano", async () => {
    await telefonoPronto();
    share
      .mockImplementationOnce(() => Promise.reject(errore("NotAllowedError")))
      .mockImplementationOnce(() => Promise.reject(errore("AbortError")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<EsportaPage />);
    await aspettaPronta();

    fireEvent.click(pulsanteJson());
    expect(await screen.findByText("Il file non è stato salvato.")).toBeTruthy();
    fireEvent.click(pulsanteJson());
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.getByText("Il file non è stato salvato.")).toBeTruthy();
    expect(pulsanteJson().textContent).toBe("Riprova");
    expect(screen.queryByText("File salvato")).toBeNull();
  });

  it("app installata senza condivisione: il messaggio con l'indirizzo da aprire in Safari", async () => {
    await telefonoPronto();
    browser.ambiente = { canShare: () => false, share, installata: true };
    render(<EsportaPage />);
    await aspettaPronta();

    fireEvent.click(pulsanteJson());
    expect(await screen.findByText("Da qui non riesco a salvare il file.")).toBeTruthy();
    expect(screen.getByText("app-libra.vercel.app")).toBeTruthy();
    expect(share).not.toHaveBeenCalled();
    expect(leggiUltimaEsportazione(USER_ID)).toBeNull();
  });

  it("CSV: il foglio con il file CSV, «File salvato», ma il promemoria non cambia", async () => {
    await telefonoPronto();
    render(<EsportaPage />);
    await aspettaPronta();

    fireEvent.click(rigaCsv());
    expect(share).toHaveBeenCalledTimes(1);
    const [file] = share.mock.calls[0][0].files;
    expect(file.type).toBe("text/csv");
    expect(file.name).toMatch(/^libra-diario-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(await screen.findByText("File salvato")).toBeTruthy();
    expect(screen.getByText("Mai esportato")).toBeTruthy();
    expect(leggiUltimaEsportazione(USER_ID)).toBeNull();
  });
});
