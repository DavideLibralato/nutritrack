// Test permanenti per la classificazione dei giorni (PUNTO_DI_PARTENZA.md,
// sezione 3, "Giorni normali e giorni di allenamento"). Il pezzo di logica
// sottile che deve restare coperto per sempre è "La trappola": il tipo del
// giorno si scrive alla prima voce e non si ricalcola mai più dal pattern,
// nemmeno per un giorno che quel giorno era "normale" (regola 3 — cambiare
// il pattern non deve toccare nessuna giornata già scritta).

import { describe, it, expect, vi } from "vitest";
import {
  idGiorno,
  giornoScritto,
  tipoGiornoProposto,
  tipoGiornoEffettivo,
  garantisciGiornoPerPrimaVoce,
  scriviTipoGiornoScelto,
} from "./giorni";
import { repositoryGiorni } from "./index";
import { db } from "../db/database";
import { TIPO_GIORNO_NORMALE, TIPO_GIORNO_ALLENAMENTO } from "../db/tipi";
import type { Giorno, Profilo } from "../db/tipi";

function profilo(modifiche: Partial<Profilo> = {}): Profilo {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-09-01T10:00:00.000Z",
    deleted_at: null,
    nome: null,
    sesso: "non_indicato",
    data_nascita: null,
    altezza_cm: null,
    livello_attivita: "sedentario",
    differenzia_giorni: true,
    giorni_allenamento_default: null,
    ...modifiche,
  };
}

function giorno(modifiche: Partial<Giorno> = {}): Giorno {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-09-01T10:00:00.000Z",
    deleted_at: null,
    data: "2026-09-04",
    tipo_giorno: TIPO_GIORNO_NORMALE,
    ...modifiche,
  };
}

describe("idGiorno — determinismo", () => {
  it("stesso utente e stessa data producono sempre lo stesso id, letterale", () => {
    // Valore atteso scritto come stringa fissa (non ricalcolato qui): solo
    // così un cambio silenzioso del namespace, o un aggiornamento della
    // libreria uuid, verrebbe intercettato — vedi la stessa nota su
    // idPastoPredefinito in pasti.test.ts.
    const id = idGiorno("11111111-1111-1111-1111-111111111111", "2026-09-10");
    expect(id).toBe("c9e587b6-4bb1-5bd6-ac80-2459ae6e4cd8");
  });

  it("una data diversa produce un id diverso, anche letterale", () => {
    const id = idGiorno("11111111-1111-1111-1111-111111111111", "2026-09-11");
    expect(id).toBe("61fe27e9-f939-57ed-ae8d-cbfdbae7a7cb");
  });

  it("utenti diversi non collidono sulla stessa data", () => {
    const idA = idGiorno("11111111-1111-1111-1111-111111111111", "2026-09-10");
    const idB = idGiorno("22222222-2222-2222-2222-222222222222", "2026-09-10");
    expect(idA).not.toBe(idB);
  });
});

describe("tipoGiornoProposto", () => {
  it("senza differenziazione attiva propone sempre 'normale'", () => {
    const p = profilo({ differenzia_giorni: false, giorni_allenamento_default: ["mercoledi"] });
    expect(tipoGiornoProposto(p, "2026-09-09")).toBe(TIPO_GIORNO_NORMALE); // mercoledì
  });

  it("propone 'allenamento' solo per i giorni del pattern", () => {
    const p = profilo({ giorni_allenamento_default: ["mercoledi", "venerdi"] });
    expect(tipoGiornoProposto(p, "2026-09-09")).toBe(TIPO_GIORNO_ALLENAMENTO); // mercoledì
    expect(tipoGiornoProposto(p, "2026-09-10")).toBe(TIPO_GIORNO_NORMALE); // giovedì
  });

  it("senza profilo, o senza pattern impostato, propone 'normale'", () => {
    expect(tipoGiornoProposto(null, "2026-09-09")).toBe(TIPO_GIORNO_NORMALE);
    expect(tipoGiornoProposto(profilo({ giorni_allenamento_default: null }), "2026-09-09")).toBe(
      TIPO_GIORNO_NORMALE
    );
  });
});

describe("tipoGiornoEffettivo — la riga scritta vince sempre", () => {
  it("un giorno mai scritto segue la proposta del pattern attuale", () => {
    const p = profilo({ giorni_allenamento_default: ["mercoledi"] });
    expect(tipoGiornoEffettivo([], p, "2026-09-09")).toBe(TIPO_GIORNO_ALLENAMENTO);
  });

  it("un giorno già scritto ignora il pattern, anche se sono in contraddizione", () => {
    // Scritto "normale" un mercoledì che oggi il pattern classificherebbe
    // come allenamento: deve restare "normale" (regola 3).
    const p = profilo({ giorni_allenamento_default: ["mercoledi"] });
    const righe = [giorno({ data: "2026-09-09", tipo_giorno: TIPO_GIORNO_NORMALE })];
    expect(tipoGiornoEffettivo(righe, p, "2026-09-09")).toBe(TIPO_GIORNO_NORMALE);
  });

  it("una riga cancellata logicamente non conta come scritta", () => {
    const righe = [
      giorno({ data: "2026-09-09", tipo_giorno: TIPO_GIORNO_ALLENAMENTO, deleted_at: "2026-09-09T10:00:00.000Z" }),
    ];
    expect(tipoGiornoEffettivo(righe, profilo(), "2026-09-09")).toBe(TIPO_GIORNO_NORMALE);
  });
});

describe("giornoScritto", () => {
  it("trova la riga viva per la data richiesta, ignorando le altre date", () => {
    const righe = [giorno({ data: "2026-09-08" }), giorno({ data: "2026-09-09", tipo_giorno: TIPO_GIORNO_ALLENAMENTO })];
    expect(giornoScritto(righe, "2026-09-09")?.tipo_giorno).toBe(TIPO_GIORNO_ALLENAMENTO);
    expect(giornoScritto(righe, "2026-09-10")).toBeNull();
  });
});

// garantisciGiornoPerPrimaVoce/scriviTipoGiornoScelto scrivono su Dexie:
// stesso mock di rete assente di pasti.test.ts, per esercitare solo la
// logica locale (la discesa vera ha i suoi test in src/lib/sync).
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
  }),
}));

describe("garantisciGiornoPerPrimaVoce", () => {
  it("non scrive nulla se la differenziazione non è attiva", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    await garantisciGiornoPerPrimaVoce(userId, "2026-09-09", profilo({ differenzia_giorni: false }));
    expect(await repositoryGiorni.ottieniTutti(userId)).toHaveLength(0);
  });

  it("scrive 'normale' esplicitamente anche quando il pattern non propone allenamento", async () => {
    // È esattamente "la trappola": se questa riga non venisse scritta, un
    // futuro cambio di pattern che aggiunge questo giorno della settimana
    // riclassificherebbe la giornata già registrata, riscrivendo la storia.
    const userId = `utente-${crypto.randomUUID()}`;
    await garantisciGiornoPerPrimaVoce(
      userId,
      "2026-09-09", // mercoledì, non nel pattern
      profilo({ giorni_allenamento_default: ["venerdi"] })
    );
    const righe = await repositoryGiorni.ottieniTutti(userId);
    expect(righe).toHaveLength(1);
    expect(righe[0].tipo_giorno).toBe(TIPO_GIORNO_NORMALE);
  });

  it("scrive 'allenamento' quando il giorno è nel pattern", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    await garantisciGiornoPerPrimaVoce(
      userId,
      "2026-09-09",
      profilo({ giorni_allenamento_default: ["mercoledi"] })
    );
    const righe = await repositoryGiorni.ottieniTutti(userId);
    expect(righe[0].tipo_giorno).toBe(TIPO_GIORNO_ALLENAMENTO);
  });

  it("non tocca un giorno già scritto, anche se il pattern è cambiato nel frattempo", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    await garantisciGiornoPerPrimaVoce(
      userId,
      "2026-09-09",
      profilo({ giorni_allenamento_default: ["mercoledi"] })
    );
    const dopoPrimaVoce = await repositoryGiorni.ottieniTutti(userId);
    expect(dopoPrimaVoce[0].tipo_giorno).toBe(TIPO_GIORNO_ALLENAMENTO);

    // Pattern cambiato: mercoledì non è più un giorno di allenamento. Una
    // seconda voce nello stesso giorno (già scritto) non deve ricalcolarlo.
    await garantisciGiornoPerPrimaVoce(
      userId,
      "2026-09-09",
      profilo({ giorni_allenamento_default: ["venerdi"] })
    );
    const dopoSecondaVoce = await repositoryGiorni.ottieniTutti(userId);
    expect(dopoSecondaVoce).toHaveLength(1);
    expect(dopoSecondaVoce[0].tipo_giorno).toBe(TIPO_GIORNO_ALLENAMENTO);
  });

  it("un giorno già scritto 'normale' a mano (pastiglia) non cambia anche se il pattern proporrebbe 'allenamento' — legge Dexie direttamente, non uno stato passato dal chiamante", async () => {
    // Bug che questa funzione doveva evitare (segnalato prima del commit):
    // se ricevesse le righe già scritte come parametro invece di rileggerle
    // da Dexie, un chiamante con quella lista vecchia di un giro di
    // ridisegno (stesso identico modo di fallire del seed pasti) non
    // vedrebbe questa classificazione e la sovrascriverebbe con la proposta
    // del pattern — la regola 3 ("la pastiglia vince sempre") cadrebbe in
    // silenzio. Qui non c'è nessuna lista da passare: la funzione deve
    // trovare da sola, per id, la riga appena scritta.
    const userId = `utente-${crypto.randomUUID()}`;
    await scriviTipoGiornoScelto(userId, "2026-09-09", TIPO_GIORNO_NORMALE);

    await garantisciGiornoPerPrimaVoce(
      userId,
      "2026-09-09",
      profilo({ giorni_allenamento_default: ["mercoledi"] }) // proporrebbe allenamento
    );

    const righe = await repositoryGiorni.ottieniTutti(userId);
    expect(righe).toHaveLength(1);
    expect(righe[0].tipo_giorno).toBe(TIPO_GIORNO_NORMALE);
  });

  it("due chiamate sovrapposte per lo stesso giorno (due dispositivi offline) non creano un doppione", async () => {
    // Scenario reale della sezione 4: il vincolo unico su Supabase
    // (user_id, data) esiste apposta per questo — l'id deterministico è
    // quello che lo rende un aggiornamento della stessa riga, non un urto
    // contro il vincolo.
    const userId = `utente-${crypto.randomUUID()}`;
    const p = profilo({ giorni_allenamento_default: ["mercoledi"] });

    await Promise.all([
      garantisciGiornoPerPrimaVoce(userId, "2026-09-09", p),
      garantisciGiornoPerPrimaVoce(userId, "2026-09-09", p),
    ]);

    const righe = await repositoryGiorni.ottieniTutti(userId);
    expect(righe).toHaveLength(1);
  });
});

describe("scriviTipoGiornoScelto — il tocco della pastiglia vince sempre", () => {
  it("crea la riga se il giorno non era ancora scritto", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    await scriviTipoGiornoScelto(userId, "2026-09-09", TIPO_GIORNO_ALLENAMENTO);
    const righe = await repositoryGiorni.ottieniTutti(userId);
    expect(righe).toHaveLength(1);
    expect(righe[0].tipo_giorno).toBe(TIPO_GIORNO_ALLENAMENTO);
  });

  it("corregge la riga già scritta invece di crearne una seconda (esempio del documento: mercoledì auto-classificato 'allenamento', poi corretto a mano)", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    await garantisciGiornoPerPrimaVoce(
      userId,
      "2026-09-09",
      profilo({ giorni_allenamento_default: ["mercoledi"] })
    );
    const dopoAuto = await repositoryGiorni.ottieniTutti(userId);
    expect(dopoAuto[0].tipo_giorno).toBe(TIPO_GIORNO_ALLENAMENTO);

    await scriviTipoGiornoScelto(userId, "2026-09-09", TIPO_GIORNO_NORMALE);

    const dopoTocco = await repositoryGiorni.ottieniTutti(userId);
    expect(dopoTocco).toHaveLength(1);
    expect(dopoTocco[0].id).toBe(dopoAuto[0].id); // stessa riga (id deterministico), sovrascritta
    expect(dopoTocco[0].tipo_giorno).toBe(TIPO_GIORNO_NORMALE);
  });

  it("non risuscita una riga cancellata: idGiorno resta lo stesso, ma il tocco crea di nuovo", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const id = idGiorno(userId, "2026-09-09");
    await db.giorni.delete(id); // stato pulito, difensivo

    await scriviTipoGiornoScelto(userId, "2026-09-09", TIPO_GIORNO_ALLENAMENTO);
    const riga = await repositoryGiorni.ottieniPerId(id);
    expect(riga?.id).toBe(id);
    expect(riga?.deleted_at).toBeNull();
  });
});
