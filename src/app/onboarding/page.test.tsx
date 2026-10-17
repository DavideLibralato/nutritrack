import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import OnboardingPage from "./page";
import { db } from "@/lib/db/database";
import { repositoryMisurazioni, repositoryProfili } from "@/lib/repository";
import { oggiLocale } from "@/lib/dataGiorno";
import type { StatoSegno } from "@/lib/onboarding/statoOnboarding";
import { salvaProfilo } from "@/lib/profilo/salvataggioProfilo";
import { calcolaEta, calcolaFabbisogno } from "@/lib/fabbisogno";
import { repositoryObiettivi } from "@/lib/repository";

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
  // Se c'è, sostituisce salvaProfilo (per i salvataggi falliti); altrimenti
  // salvaProfilo vero, spiato.
  salvaProfilo: null as null | (() => Promise<never>),
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
vi.mock("@/lib/profilo/salvataggioProfilo", async (originale) => {
  const vero = await originale<typeof import("@/lib/profilo/salvataggioProfilo")>();
  return {
    ...vero,
    salvaProfilo: vi.fn((...args: Parameters<typeof vero.salvaProfilo>) =>
      finti.salvaProfilo ? finti.salvaProfilo() : vero.salvaProfilo(...args)
    ),
  };
});
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
  finti.salvaProfilo = null;
  vi.mocked(salvaProfilo).mockClear();
  await Promise.all([
    db.profili.clear(),
    db.misurazioni.clear(),
    db.obiettivi.clear(),
    db.obiettivi_target.clear(),
    db.outbox.clear(),
  ]);
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
    expect(await screen.findByRole("heading", { name: "Cosa vuoi ottenere?" })).toBeTruthy();
  });

  it("con la pesata di oggi, il campo parte da quella", async () => {
    await profiloCompleto();
    await repositoryMisurazioni.crea({ user_id: USER_ID, tipo: "peso", valore: 62.5, unita: "kg", data: oggiLocale() });
    finti.query = "continua=1";
    finti.stato = stato({ segno: "rimandato", mostraOnboarding: false });
    render(<OnboardingPage />);
    // Profilo e pesata ci sono: si parte dal passo 4; il 3 è dietro.
    await screen.findByRole("heading", { name: "Cosa vuoi ottenere?" });
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
    expect(screen.queryByRole("heading", { name: "Cosa vuoi ottenere?" })).toBeNull();
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

// --- Passi 4 e 5 -------------------------------------------------------------

const PESO = 62;

// Profilo completo e la pesata di oggi: si entra dal passo 4.
async function finoAlPasso4(sesso: "femmina" | "non_indicato" = "femmina") {
  await profiloCompleto();
  if (sesso !== "femmina") {
    const [p] = await repositoryProfili.ottieniTutti(USER_ID);
    await repositoryProfili.aggiorna(p.id, { sesso });
  }
  await repositoryMisurazioni.crea({ user_id: USER_ID, tipo: "peso", valore: PESO, unita: "kg", data: oggiLocale() });
  finti.query = "continua=1";
  finti.stato = stato({ segno: "rimandato", mostraOnboarding: false });
  render(<OnboardingPage />);
  await screen.findByRole("heading", { name: "Cosa vuoi ottenere?" });
}

async function finoAlPasso5(obiettivo = "Mantenere", sesso: "femmina" | "non_indicato" = "femmina") {
  await finoAlPasso4(sesso);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${obiettivo}`) }));
  fireEvent.click(avanti());
  await screen.findByText("Giorni di allenamento, pasti e orari e colore dell'app li trovi in Impostazioni.");
}

// I numeri di calcolaFabbisogno per il profilo di prova (donna, nata il
// 12/5/1994, 165 cm, attività leggera, 62 kg).
function attesa(tipoObiettivo: "dimagrire" | "mantenere" | "massa") {
  return calcolaFabbisogno({
    sesso: "femmina",
    eta: calcolaEta("1994-05-12"),
    altezzaCm: 165,
    pesoKg: PESO,
    livelloAttivita: "leggero",
    tipoObiettivo,
  });
}

const campo = (nome: string) => screen.getByLabelText(nome) as HTMLInputElement;
const inizia = () => screen.getByRole("button", { name: "Inizia a usare Libra" }) as HTMLButtonElement;

function valoriCampi() {
  return {
    kcal: campo("Calorie").value,
    grassi: campo("Grassi g").value,
    carboidrati: campo("Carboidrati g").value,
    proteine: campo("Proteine g").value,
  };
}

function comeCampi(p: { kcal: number; grassi: number; carboidrati: number; proteine: number }) {
  return {
    kcal: String(p.kcal),
    grassi: String(p.grassi),
    carboidrati: String(p.carboidrati),
    proteine: String(p.proteine),
  };
}

const VUOTI = { kcal: "", grassi: "", carboidrati: "", proteine: "" };

describe("onboarding — passo 4", () => {
  it("si parte senza scelta, con Avanti spento; il peso obiettivo è facoltativo ma, se c'è, valido", async () => {
    await finoAlPasso4();
    const gruppo = screen.getByRole("group", { name: "Obiettivo" });
    expect(gruppo.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect((avanti() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /^Dimagrire/ }));
    expect((avanti() as HTMLButtonElement).disabled).toBe(false);

    const peso = campo("Peso obiettivo (facoltativo)");
    const casi: [string, boolean][] = [
      ["0", false],
      ["600", false],
      ["", true],
      ["58,5", true],
    ];
    for (const [valore, acceso] of casi) {
      fireEvent.change(peso, { target: { value: valore } });
      expect((avanti() as HTMLButtonElement).disabled, valore).toBe(!acceso);
    }
  });

  it("le righe sotto gli obiettivi vengono dai numeri del calcolo", async () => {
    await finoAlPasso4();
    expect(screen.getByText("Circa 500 kcal sotto il tuo fabbisogno")).toBeTruthy();
    expect(screen.getByText("Quanto consumi in una giornata normale")).toBeTruthy();
    expect(screen.getByText("Circa 300 kcal sopra il tuo fabbisogno")).toBeTruthy();
  });

  it("Avanti non salva niente", async () => {
    await finoAlPasso5();
    expect(vi.mocked(salvaProfilo)).not.toHaveBeenCalled();
    expect(await repositoryObiettivi.ottieniTutti(USER_ID)).toEqual([]);
  });

  it("si entra dal passo 4 anche alla ripresa", async () => {
    await profiloCompleto();
    await repositoryMisurazioni.crea({ user_id: USER_ID, tipo: "peso", valore: PESO, unita: "kg", data: oggiLocale() });
    render(<OnboardingPage />);
    expect(await screen.findByRole("heading", { name: "Cosa vuoi ottenere?" })).toBeTruthy();
  });
});

describe("onboarding — passo 5", () => {
  it("la proposta ha i numeri di calcolaFabbisogno", async () => {
    await finoAlPasso5("Mantenere");
    expect(screen.getByRole("heading", { name: "Ecco la tua proposta" })).toBeTruthy();
    expect(screen.getByText("Calcolato dai tuoi dati. Tocca un numero per cambiarlo.")).toBeTruthy();
    expect(valoriCampi()).toEqual(comeCampi(attesa("mantenere")));
  });

  it("cambiando obiettivo la proposta si ricalcola; dopo una modifica a mano, no", async () => {
    await finoAlPasso5("Mantenere");
    fireEvent.click(screen.getByRole("button", { name: "Indietro" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Dimagrire/ }));
    fireEvent.click(avanti());
    await screen.findByRole("heading", { name: "Ecco la tua proposta" });
    expect(valoriCampi()).toEqual(comeCampi(attesa("dimagrire")));

    fireEvent.change(campo("Calorie"), { target: { value: "1800" } });
    expect(screen.getByRole("heading", { name: "I tuoi obiettivi" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Indietro" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Massa/ }));
    fireEvent.click(avanti());
    await screen.findByRole("heading", { name: "I tuoi obiettivi" });
    expect(campo("Calorie").value).toBe("1800");
  });

  it("«Torna alla proposta» rimette i numeri", async () => {
    await finoAlPasso5("Mantenere");
    fireEvent.change(campo("Proteine g"), { target: { value: "200" } });
    expect(screen.getByText(/Hai cambiato la proposta\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Torna alla proposta" }));
    expect(valoriCampi()).toEqual(comeCampi(attesa("mantenere")));
    expect(screen.getByRole("heading", { name: "Ecco la tua proposta" })).toBeTruthy();
  });

  it("«Ho già i miei valori» svuota i campi e mette il fuoco sulle calorie", async () => {
    await finoAlPasso5("Mantenere");
    fireEvent.click(screen.getByRole("button", { name: "Ho già i miei valori" }));
    expect(valoriCampi()).toEqual(VUOTI);
    expect(document.activeElement).toBe(campo("Calorie"));
  });

  it("sesso non indicato: campi vuoti, il suo testo, niente link", async () => {
    await finoAlPasso5("Mantenere", "non_indicato");
    expect(screen.getByRole("heading", { name: "I tuoi obiettivi" })).toBeTruthy();
    expect(
      screen.getByText(
        "Con il sesso non indicato non posso calcolare una proposta: scrivi i tuoi valori, per esempio quelli del nutrizionista."
      )
    ).toBeTruthy();
    expect(valoriCampi()).toEqual(VUOTI);
    expect(screen.queryByRole("button", { name: "Ho già i miei valori" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Torna alla proposta" })).toBeNull();
  });

  it("il pulsante è spento finché manca un numero; anche lo zero lo accende", async () => {
    await finoAlPasso5("Mantenere", "non_indicato");
    expect(inizia().disabled).toBe(true);
    fireEvent.change(campo("Calorie"), { target: { value: "2000" } });
    fireEvent.change(campo("Grassi g"), { target: { value: "0" } });
    fireEvent.change(campo("Carboidrati g"), { target: { value: "250" } });
    expect(inizia().disabled).toBe(true);
    fireEvent.change(campo("Proteine g"), { target: { value: "0" } });
    expect(inizia().disabled).toBe(false);
  });
});

describe("onboarding — la fine", () => {
  it("salvataggio riuscito: salvaProfilo con la sezione obiettivo, poi concludiOnboarding «fatto», poi Oggi", async () => {
    await finoAlPasso4();
    fireEvent.click(screen.getByRole("button", { name: /^Dimagrire/ }));
    fireEvent.change(campo("Peso obiettivo (facoltativo)"), { target: { value: "58,5" } });
    fireEvent.click(avanti());
    await screen.findByRole("heading", { name: "Ecco la tua proposta" });

    fireEvent.click(inizia());
    await waitFor(() => expect(finti.replace).toHaveBeenCalledWith("/"));

    const spia = vi.mocked(salvaProfilo);
    expect(spia).toHaveBeenCalledTimes(1);
    const richiesta = spia.mock.calls[0][0];
    expect(richiesta.attuali.obiettivo).toEqual({
      tipo: "dimagrire",
      pesoObiettivo: "58,5",
      target: comeCampi(attesa("dimagrire")),
    });
    // Le altre sezioni restano quelle caricate: si scrive solo l'obiettivo.
    expect(richiesta.attuali.datiPersonali).toEqual(richiesta.caricati.datiPersonali);
    expect(richiesta.attuali.giorni).toEqual(richiesta.caricati.giorni);
    expect(richiesta).toMatchObject({ periodoVistoId: null, scelta: null });

    expect(finti.concludi).toHaveBeenCalledWith(USER_ID, "fatto");
    expect(spia.mock.invocationCallOrder[0]).toBeLessThan(finti.concludi.mock.invocationCallOrder[0]);
    expect(finti.concludi.mock.invocationCallOrder[0]).toBeLessThan(finti.replace.mock.invocationCallOrder[0]);

    const [periodo] = await repositoryObiettivi.ottieniTutti(USER_ID);
    expect(periodo).toMatchObject({ tipo: "dimagrire", peso_obiettivo: 58.5, kcal: attesa("dimagrire").kcal });
  });

  it("salvataggio fallito: il messaggio, nessuna conclusione, si resta sul passo", async () => {
    await finoAlPasso5("Mantenere");
    finti.salvaProfilo = async () => {
      throw new Error("scrittura in Dexie non riuscita");
    };
    fireEvent.click(inizia());

    expect(await screen.findByText("Salvataggio non riuscito. Riprova.")).toBeTruthy();
    expect(finti.concludi).not.toHaveBeenCalled();
    expect(finti.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Ecco la tua proposta" })).toBeTruthy();
  });

  it("obiettivo arrivato nel frattempo da un altro dispositivo: niente scritto, il messaggio, «fatto», Oggi al tocco", async () => {
    await finoAlPasso5("Mantenere");
    await repositoryObiettivi.crea({
      user_id: USER_ID,
      valido_dal: oggiLocale(),
      tipo: "massa",
      kcal: 2900,
      proteine_g: 200,
      carboidrati_g: 300,
      grassi_g: 90,
      peso_obiettivo: null,
    });

    fireEvent.click(inizia());

    expect(await screen.findByText("I tuoi obiettivi sono già stati impostati da un altro dispositivo.")).toBeTruthy();
    expect(finti.concludi).toHaveBeenCalledWith(USER_ID, "fatto");
    expect(finti.replace).not.toHaveBeenCalled();
    // Non è stato scritto niente: resta l'obiettivo dell'altro dispositivo.
    expect(await repositoryObiettivi.ottieniTutti(USER_ID)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Vai a Oggi" }));
    expect(finti.replace).toHaveBeenCalledWith("/");
  });
});
