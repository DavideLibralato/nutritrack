import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import OnboardingPage from "./page";
import { db } from "@/lib/db/database";
import { repositoryMisurazioni, repositoryProfili } from "@/lib/repository";
import { oggiLocale } from "@/lib/dataGiorno";
import type { StatoSegno } from "@/lib/onboarding/statoOnboarding";

// La pagina dell'onboarding, passi 1-3 (PUNTO_DI_PARTENZA.md, sezione 3,
// "Onboarding"). Sbaglia in silenzio: chi non deve vederla ci resta
// (l'utente di prima davanti al Benvenuto), il passo salta da solo dopo un
// salvataggio, "Dopo" salva a metà, il peso arriva con la virgola sbagliata.
// Finti: lo stato del segno, l'utente, il router, la rete, la chiusura
// dell'onboarding e la pesata. Dexie è quello di fake-indexeddb.

const USER_ID = "utente-test-onboarding";

const finti = vi.hoisted(() => ({
  stato: undefined as StatoSegno | undefined,
  nome: null as string | null,
  query: "",
  online: true,
  replace: vi.fn(),
  concludi: vi.fn(async () => "in-sospeso"),
  registraPeso: vi.fn(async () => {}),
}));

vi.mock("@/lib/onboarding/useStatoOnboarding", () => ({ useStatoOnboarding: () => finti.stato }));
vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => USER_ID,
  useNomeUtente: () => finti.nome,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: finti.replace, push: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(finti.query),
}));
vi.mock("@/lib/useOnline", () => ({ useOnline: () => finti.online }));
vi.mock("@/lib/onboarding/segnoOnboarding", () => ({
  concludiOnboarding: (...args: unknown[]) => finti.concludi(...(args as [])),
}));
vi.mock("@/lib/repository/misurazioni", async (originale) => ({
  ...(await originale<typeof import("@/lib/repository/misurazioni")>()),
  registraPesoSenzaDuplicati: (...args: unknown[]) => finti.registraPeso(...(args as [])),
}));

function stato(campi: Partial<StatoSegno>): StatoSegno {
  return { segno: "da_fare", mostraOnboarding: true, mostraScheda: false, attendiDiscesa: false, ...campi };
}

async function profiloCompleto() {
  await repositoryProfili.crea({
    user_id: USER_ID,
    nome: null,
    sesso: "femmina",
    data_nascita: "1994-05-12",
    altezza_cm: 165,
    livello_attivita: "leggero",
    differenzia_giorni: false,
    giorni_allenamento_default: null,
  });
}

beforeEach(async () => {
  finti.stato = stato({});
  finti.nome = null;
  finti.query = "";
  finti.online = true;
  finti.replace.mockReset();
  finti.concludi.mockClear();
  finti.registraPeso.mockClear();
  await Promise.all([db.profili.clear(), db.misurazioni.clear(), db.obiettivi.clear(), db.outbox.clear()]);
});

afterEach(cleanup);

const avanti = () => screen.getByRole("button", { name: "Avanti" });

// Riempie i tre campi del passo 2 diversi dal sesso.
function riempiSuDiTeTranneSesso() {
  fireEvent.change(screen.getByLabelText("Data di nascita"), { target: { value: "1990-01-10" } });
  fireEvent.change(screen.getByLabelText("Altezza"), { target: { value: "172,5" } });
  fireEvent.change(screen.getByLabelText("Quanto ti muovi"), { target: { value: "moderato" } });
}

describe("onboarding — chi entra", () => {
  it("utente senza segno: torna a Oggi", async () => {
    finti.stato = stato({ segno: null, mostraOnboarding: false });
    render(<OnboardingPage />);
    await waitFor(() => expect(finti.replace).toHaveBeenCalledWith("/"));
  });

  it("segno fatto: torna a Oggi", async () => {
    finti.stato = stato({ segno: "fatto", mostraOnboarding: false });
    render(<OnboardingPage />);
    await waitFor(() => expect(finti.replace).toHaveBeenCalledWith("/"));
  });

  it("rimandato senza ?continua=1: torna a Oggi", async () => {
    finti.stato = stato({ segno: "rimandato", mostraOnboarding: false, mostraScheda: true });
    render(<OnboardingPage />);
    await waitFor(() => expect(finti.replace).toHaveBeenCalledWith("/"));
  });

  it("rimandato con ?continua=1: entra dal primo passo da fare, non dal Benvenuto", async () => {
    finti.stato = stato({ segno: "rimandato", mostraOnboarding: false, mostraScheda: true });
    finti.query = "continua=1";
    render(<OnboardingPage />);
    expect(await screen.findByRole("heading", { name: "Parlami un po' di te" })).toBeTruthy();
    expect(finti.replace).not.toHaveBeenCalled();
  });

  it("stato non ancora noto: «Caricamento...», e nessun redirect", async () => {
    finti.stato = undefined;
    render(<OnboardingPage />);
    expect(await screen.findByText("Caricamento...")).toBeTruthy();
    expect(finti.replace).not.toHaveBeenCalled();
  });

  it("in attesa della discesa: con la rete «Caricamento...», senza il testo della connessione", async () => {
    finti.stato = stato({ attendiDiscesa: true });
    const { unmount } = render(<OnboardingPage />);
    expect(await screen.findByText("Caricamento...")).toBeTruthy();
    unmount();

    finti.online = false;
    render(<OnboardingPage />);
    expect(
      await screen.findByText(
        "Per continuare serve la connessione: prima devono arrivare i tuoi dati su questo dispositivo."
      )
    ).toBeTruthy();
    expect(finti.replace).not.toHaveBeenCalled();
  });
});

describe("onboarding — passo 1", () => {
  it("niente salvato: il Benvenuto, «Ciao!» senza nome, mai «Ciao .»", async () => {
    render(<OnboardingPage />);
    expect(await screen.findByRole("heading", { name: "Ciao!" })).toBeTruthy();
    // Il Benvenuto non ha la barra.
    expect(screen.queryByRole("button", { name: "Dopo" })).toBeNull();
  });

  it("con il nome: «Ciao Giulia.»", async () => {
    finti.nome = "Giulia";
    render(<OnboardingPage />);
    expect(await screen.findByRole("heading", { name: "Ciao Giulia." })).toBeTruthy();
  });
});

describe("onboarding — passo 2", () => {
  it("Avanti spento finché il sesso non è toccato, anche con gli altri tre campi pieni", async () => {
    finti.query = "continua=1";
    finti.stato = stato({ segno: "rimandato", mostraOnboarding: false });
    render(<OnboardingPage />);
    await screen.findByRole("heading", { name: "Parlami un po' di te" });

    riempiSuDiTeTranneSesso();
    expect((avanti() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Preferisco non indicarlo" }));
    expect((avanti() as HTMLButtonElement).disabled).toBe(false);
  });

  it("Avanti salva il profilo e va al passo 3; Indietro ritrova i valori scritti", async () => {
    render(<OnboardingPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Iniziamo" }));
    await screen.findByRole("heading", { name: "Parlami un po' di te" });
    riempiSuDiTeTranneSesso();
    fireEvent.click(screen.getByRole("button", { name: "Uomo" }));
    fireEvent.click(avanti());

    expect(await screen.findByRole("heading", { name: "Quanto pesi oggi?" })).toBeTruthy();
    const [profilo] = await repositoryProfili.ottieniTutti(USER_ID);
    expect(profilo).toMatchObject({
      sesso: "maschio",
      data_nascita: "1990-01-10",
      altezza_cm: 172.5,
      livello_attivita: "moderato",
    });

    fireEvent.click(screen.getByRole("button", { name: "Indietro" }));
    await screen.findByRole("heading", { name: "Parlami un po' di te" });
    expect((screen.getByLabelText("Altezza") as HTMLInputElement).value).toBe("172,5");
    expect(screen.getByRole("button", { name: "Uomo" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("con un profilo già salvato si parte dal suo sesso", async () => {
    await profiloCompleto();
    finti.query = "continua=1";
    finti.stato = stato({ segno: "rimandato", mostraOnboarding: false });
    render(<OnboardingPage />);
    // Profilo completo: si parte dal passo 3; si torna al 2 con Indietro.
    await screen.findByRole("heading", { name: "Quanto pesi oggi?" });
    fireEvent.click(screen.getByRole("button", { name: "Indietro" }));
    await screen.findByRole("heading", { name: "Parlami un po' di te" });
    expect(screen.getByRole("button", { name: "Donna" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("onboarding — passo 3", () => {
  it("Avanti registra il peso con la virgola letta giusta: «78,4» → 78.4", async () => {
    await profiloCompleto();
    render(<OnboardingPage />);
    await screen.findByRole("heading", { name: "Quanto pesi oggi?" });
    expect((avanti() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Peso in kg"), { target: { value: "78,4" } });
    fireEvent.click(avanti());

    await waitFor(() => expect(finti.registraPeso).toHaveBeenCalledWith(USER_ID, 78.4));
    expect(await screen.findByRole("heading", { name: "Il tuo obiettivo" })).toBeTruthy();
  });

  it("con la pesata di oggi, il campo parte da quella", async () => {
    await profiloCompleto();
    await repositoryMisurazioni.crea({ user_id: USER_ID, tipo: "peso", valore: 62.5, unita: "kg", data: oggiLocale() });
    finti.query = "continua=1";
    finti.stato = stato({ segno: "rimandato", mostraOnboarding: false });
    render(<OnboardingPage />);
    // Profilo e pesata ci sono: si parte dal passo 4; il 3 è dietro.
    await screen.findByRole("heading", { name: "Il tuo obiettivo" });
    fireEvent.click(screen.getByRole("button", { name: "Indietro" }));
    await screen.findByRole("heading", { name: "Quanto pesi oggi?" });
    expect((screen.getByLabelText("Peso in kg") as HTMLInputElement).value).toBe("62,5");
  });
});

describe("onboarding — Dopo", () => {
  it("chiama concludiOnboarding con «rimandato» e torna a Oggi, senza salvare il passo", async () => {
    finti.query = "continua=1";
    finti.stato = stato({ segno: "rimandato", mostraOnboarding: false });
    render(<OnboardingPage />);
    await screen.findByRole("heading", { name: "Parlami un po' di te" });
    riempiSuDiTeTranneSesso();
    fireEvent.click(screen.getByRole("button", { name: "Uomo" }));

    fireEvent.click(screen.getByRole("button", { name: "Dopo" }));

    expect(finti.concludi).toHaveBeenCalledWith(USER_ID, "rimandato");
    expect(finti.replace).toHaveBeenCalledWith("/");
    // Si aspetta: un salvataggio partito per sbaglio finirebbe dopo il tocco.
    await new Promise((fine) => setTimeout(fine, 100));
    expect(await repositoryProfili.ottieniTutti(USER_ID)).toEqual([]);
  });
});

describe("onboarding — il passo di partenza si decide una volta", () => {
  it("Dexie che cambia dopo l'ingresso non sposta il passo", async () => {
    render(<OnboardingPage />);
    await screen.findByRole("heading", { name: "Ciao!" });

    // Arrivano profilo e pesata (da un salvataggio, o dalla discesa): con
    // questi dati il passo di partenza sarebbe il 4.
    await profiloCompleto();
    await repositoryMisurazioni.crea({ user_id: USER_ID, tipo: "peso", valore: 70, unita: "kg", data: oggiLocale() });
    await new Promise((fine) => setTimeout(fine, 50));

    expect(screen.getByRole("heading", { name: "Ciao!" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Il tuo obiettivo" })).toBeNull();
  });

  it("salvato il passo 2 si va al 3, non al passo calcolato di nuovo", async () => {
    await repositoryMisurazioni.crea({ user_id: USER_ID, tipo: "peso", valore: 70, unita: "kg", data: oggiLocale() });
    finti.query = "continua=1";
    finti.stato = stato({ segno: "rimandato", mostraOnboarding: false });
    render(<OnboardingPage />);
    await screen.findByRole("heading", { name: "Parlami un po' di te" });
    riempiSuDiTeTranneSesso();
    fireEvent.click(screen.getByRole("button", { name: "Donna" }));
    fireEvent.click(avanti());

    // Con profilo e pesata salvati, ricalcolando si salterebbe al 4.
    expect(await screen.findByRole("heading", { name: "Quanto pesi oggi?" })).toBeTruthy();
  });
});
