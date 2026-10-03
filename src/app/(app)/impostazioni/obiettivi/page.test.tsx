import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { useState, useEffect } from "react";
import { render, screen, waitFor, fireEvent, cleanup, within } from "@testing-library/react";
import ObiettiviPage from "./page";
import { repositoryObiettivi, repositoryObiettiviTarget, repositoryProfili } from "@/lib/repository";
import { db } from "@/lib/db/database";
import { TIPO_GIORNO_NORMALE, TIPO_GIORNO_ALLENAMENTO } from "@/lib/db/tipi";
import { giornoPrecedente, oggiLocale } from "@/lib/dataGiorno";

// La pagina Obiettivi (passo "obiettivi", PUNTO_DI_PARTENZA.md sezione 3,
// "Impostazioni"). Il bivio e gli esiti erano in Profilo: qui si controlla
// che la pagina nuova li colleghi giusti. La logica di scrittura ha i suoi
// test in src/lib/profilo/salvataggioProfilo.test.ts.

const USER_ID = "utente-test-obiettivi";

// Come nel test di Profilo: useUtenteId al primo render torna undefined e si
// risolve un giro di microtask dopo, come la vera supabase.auth.getUser().
// È questo ritardo a scoprire un modulo inizializzato vuoto prima che i dati
// veri arrivino da Dexie.
vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => {
    const [id, setId] = useState<string | undefined>(undefined);
    useEffect(() => {
      Promise.resolve().then(() => setId(USER_ID));
    }, []);
    return id;
  },
  useNomeUtente: () => null,
  useEmailUtente: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

afterEach(cleanup);

// Un periodo con il target normale 2500 kcal, iniziato ieri (o `giorniFa`
// giorni fa): il bivio al Salva è possibile in tutte e due le forme (cambio
// vero o correzione). Con `allenamento`, anche la riga "allenamento".
async function preparaPeriodo(
  differenzia: boolean,
  { giorniFa = 1, allenamento = false }: { giorniFa?: number; allenamento?: boolean } = {}
) {
  await Promise.all([db.profili.clear(), db.obiettivi.clear(), db.obiettivi_target.clear()]);
  await repositoryProfili.crea({
    user_id: USER_ID,
    nome: null,
    sesso: "maschio",
    data_nascita: "1990-05-05",
    altezza_cm: 180,
    livello_attivita: "moderato",
    differenzia_giorni: differenzia,
    giorni_allenamento_default: differenzia ? ["lunedi", "giovedi"] : null,
  });
  const periodo = await repositoryObiettivi.crea({
    user_id: USER_ID,
    valido_dal: indietro(giorniFa),
    tipo: "mantenere",
    kcal: 2500,
    proteine_g: 150,
    carboidrati_g: 340,
    grassi_g: 60,
    peso_obiettivo: null,
  });
  await repositoryObiettiviTarget.crea({
    user_id: USER_ID,
    obiettivo_id: periodo.id,
    tipo_giorno: TIPO_GIORNO_NORMALE,
    kcal: 2500,
    proteine_g: 150,
    carboidrati_g: 340,
    grassi_g: 60,
  });
  if (allenamento) {
    await repositoryObiettiviTarget.crea({
      user_id: USER_ID,
      obiettivo_id: periodo.id,
      tipo_giorno: TIPO_GIORNO_ALLENAMENTO,
      kcal: 2950,
      proteine_g: 160,
      carboidrati_g: 450,
      grassi_g: 65,
    });
  }
  return periodo;
}

function indietro(giorni: number): string {
  let data = oggiLocale();
  for (let i = 0; i < giorni; i++) data = giornoPrecedente(data);
  return data;
}

describe("Pagina Obiettivi", () => {
  beforeEach(async () => {
    await db.outbox.clear();
  });

  it("dopo un refresh precompila i target, anche se userId arriva con un tick di ritardo", async () => {
    await preparaPeriodo(false);
    render(<ObiettiviPage />);

    expect(screen.getByText("Caricamento...")).toBeTruthy();
    const calorie = (await screen.findByLabelText("Calorie")) as HTMLInputElement;
    await waitFor(() => expect(calorie.value).toBe("2500"));
    expect((screen.getByLabelText("Grassi") as HTMLInputElement).value).toBe("60");

    // Interruttore spento: niente selettore Normale | Allenamento, niente giorni.
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByRole("button", { name: "Normale" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lunedì" })).toBeNull();
  });

  it("cambiare un target di un periodo esistente chiede «cambio vero o correzione?»; la correzione aggiorna il periodo", async () => {
    const periodo = await preparaPeriodo(false);
    render(<ObiettiviPage />);
    const calorie = (await screen.findByLabelText("Calorie")) as HTMLInputElement;
    await waitFor(() => expect(calorie.value).toBe("2500"));

    fireEvent.change(calorie, { target: { value: "2400" } });
    expect(screen.getByText("Prima: 2500")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    // Il bivio, una volta sola, al Salva.
    const sheet = await screen.findByRole("dialog", { name: "Com'è cambiato l'obiettivo?" });
    fireEvent.click(within(sheet).getByRole("button", { name: /Avevo sbagliato a inserirlo/ }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(screen.getAllByText("Salvato.")).toHaveLength(1));
    // Correzione: stesso periodo (nessuno nuovo), target normale aggiornato.
    const periodi = await db.obiettivi.filter((o) => o.user_id === USER_ID).toArray();
    expect(periodi).toHaveLength(1);
    expect(periodi[0].kcal).toBe(2400);
    const normale = await db.obiettivi_target
      .filter((t) => t.obiettivo_id === periodo.id && t.tipo_giorno === TIPO_GIORNO_NORMALE)
      .first();
    expect(normale?.kcal).toBe(2400);
  }, 10000);

  it("con l'interruttore acceso: giorni e selettore; la scheda Allenamento parte dal normale e segna le sue modifiche", async () => {
    await preparaPeriodo(false);
    render(<ObiettiviPage />);
    const calorie = (await screen.findByLabelText("Calorie")) as HTMLInputElement;
    await waitFor(() => expect(calorie.value).toBe("2500"));

    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByRole("button", { name: "Lunedì" })).toBeTruthy();
    expect(screen.getByText(/Da oggi i giorni segnati partono come Allenamento/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Allenamento" }));
    const calorieAllenamento = screen.getByLabelText("Calorie") as HTMLInputElement;
    // Senza riga "allenamento" si parte dai valori del giorno normale.
    expect(calorieAllenamento.value).toBe("2500");

    fireEvent.change(calorieAllenamento, { target: { value: "2950" } });
    // Il pallino (testo nascosto "(modificato)") sulla scheda Allenamento.
    expect(screen.getByRole("button", { name: /Allenamento.*modificato/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Normale.*modificato/ })).toBeNull();

    // Tornando a Normale, il valore normale è rimasto quello di prima.
    fireEvent.click(screen.getByRole("button", { name: /^Normale/ }));
    expect((screen.getByLabelText("Calorie") as HTMLInputElement).value).toBe("2500");

    // Senza riga allenamento esistente il periodo nasce con quella nuova al
    // Salva (correzione): controlliamo che venga scritta.
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    const sheet = await screen.findByRole("dialog", { name: "Com'è cambiato l'obiettivo?" });
    fireEvent.click(within(sheet).getByRole("button", { name: /Avevo sbagliato a inserirlo/ }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));
    await waitFor(async () => {
      const allenamento = await db.obiettivi_target
        .filter((t) => t.tipo_giorno === TIPO_GIORNO_ALLENAMENTO)
        .first();
      expect(allenamento?.kcal).toBe(2950);
    });
    const profilo = await db.profili.filter((p) => p.user_id === USER_ID).first();
    expect(profilo?.differenzia_giorni).toBe(true);
  }, 10000);

  // "È un cambio vero" non si prova su iPhone con i dati veri (creerebbe un
  // secondo periodo in produzione): lo copre questo test. Interruttore
  // acceso, il periodo ha target normale e allenamento, cambia SOLO il
  // normale: il periodo nuovo deve nascere con tutti e due, il normale
  // cambiato e l'allenamento copiato uguale (creaPeriodo in
  // salvataggioProfilo.ts). Il periodo vecchio resta com'era.
  it("«È un cambio vero» con una data: il periodo nuovo ha il normale cambiato e l'allenamento copiato uguale", async () => {
    const vecchio = await preparaPeriodo(true, { giorniFa: 3, allenamento: true });
    render(<ObiettiviPage />);
    const calorie = (await screen.findByLabelText("Calorie")) as HTMLInputElement;
    await waitFor(() => expect(calorie.value).toBe("2500"));
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");

    fireEvent.change(calorie, { target: { value: "2300" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    const sheet = await screen.findByRole("dialog", { name: "Com'è cambiato l'obiettivo?" });
    // "È un cambio vero" è la scelta predefinita: la si tocca lo stesso.
    fireEvent.click(within(sheet).getByRole("button", { name: /È un cambio vero/ }));
    const ieri = indietro(1);
    fireEvent.change(within(sheet).getByLabelText("Valido dal"), { target: { value: ieri } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(screen.getAllByText("Salvato.")).toHaveLength(1));

    const periodi = await db.obiettivi.filter((o) => o.user_id === USER_ID).toArray();
    expect(periodi).toHaveLength(2);
    const nuovo = periodi.find((o) => o.id !== vecchio.id)!;
    expect(nuovo.valido_dal).toBe(ieri);
    expect(nuovo.kcal).toBe(2300);

    const righeNuovo = await db.obiettivi_target.filter((t) => t.obiettivo_id === nuovo.id).toArray();
    expect(righeNuovo).toHaveLength(2);
    const normaleNuovo = righeNuovo.find((t) => t.tipo_giorno === TIPO_GIORNO_NORMALE);
    const allenamentoNuovo = righeNuovo.find((t) => t.tipo_giorno === TIPO_GIORNO_ALLENAMENTO);
    expect(normaleNuovo).toMatchObject({ kcal: 2300, proteine_g: 150, carboidrati_g: 340, grassi_g: 60 });
    expect(allenamentoNuovo).toMatchObject({ kcal: 2950, proteine_g: 160, carboidrati_g: 450, grassi_g: 65 });

    // Il periodo vecchio non cambia: i giorni prima di ieri restano con i
    // target di prima.
    const righeVecchio = await db.obiettivi_target.filter((t) => t.obiettivo_id === vecchio.id).toArray();
    expect(righeVecchio.find((t) => t.tipo_giorno === TIPO_GIORNO_NORMALE)?.kcal).toBe(2500);
    expect(righeVecchio.find((t) => t.tipo_giorno === TIPO_GIORNO_ALLENAMENTO)?.kcal).toBe(2950);
    expect((await db.obiettivi.get(vecchio.id))?.kcal).toBe(2500);
  }, 10000);
});
