// Il seed dei 5 pasti predefiniti: bug di logica sottile, test permanenti.
//
// Storia in breve (PUNTO_DI_PARTENZA.md, sezione 9.2, "Seed dei pasti
// predefiniti"):
// - 10 pasti invece di 5: il set creato due volte a un refresh di distanza,
//   con id casuali. Da allora l'id è deterministico (UUID v5 da utente +
//   nome canonico): due dispositivi che seminano producono le stesse righe.
// - Resurrezione (2026-09-25) e rinomina annullata (2026-10-07): il seed
//   creava le righe che mancavano IN DEXIE, e crea() le mandava intere al
//   server con i valori predefiniti. Su un dispositivo vuoto con la lettura
//   fallita, un pasto cancellato tornava vivo e uno rinominato riprendeva
//   il nome di fabbrica, su tutti i dispositivi.
// Regola di adesso: si crea solo se la lettura dal server riesce E il server
// non ha nessuna riga dell'utente in `pasti`, nemmeno cancellata.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  garantisciPastiPredefiniti,
  idPastoPredefinito,
  PASTI_PREDEFINITI,
} from "./pasti";
import { repositoryPasti } from "./index";
import { db } from "../db/database";
import type { Pasto } from "../db/tipi";

// --- Server finto -----------------------------------------------------------
//
// Risponde alle due letture che il seed fa: il conteggio
// (select con { count: "exact", head: true }) e lo scarico paginato di
// scaricaTabella (select("*") con gte sul cursore e range). Le scritture
// (upsert dalla coda outbox) falliscono sempre: il server non cambia mai, e
// le righe create restano nella coda, dove i test le contano.
const server = {
  righe: [] as Pasto[],
  // true = ogni lettura risponde con un errore (rete assente, sessione
  // rifiutata).
  fallisce: false,
  // true = il conteggio risponde, lo scarico delle righe no (la rete cade
  // fra le due letture).
  fallisceScarico: false,
  conteggi: 0,
};

function query() {
  const stato = {
    soloConteggio: false,
    userId: null as string | null,
    da: null as string | null,
    range: null as [number, number] | null,
    scrittura: false,
    soloVive: false,
  };
  const builder = {
    select: (_colonne: string, opzioni?: { count?: string; head?: boolean }) => {
      stato.soloConteggio = Boolean(opzioni?.head);
      return builder;
    },
    eq: (colonna: string, valore: string) => {
      if (colonna === "user_id") stato.userId = valore;
      return builder;
    },
    gte: (_colonna: string, valore: string) => {
      stato.da = valore;
      return builder;
    },
    // .is("deleted_at", null): solo le righe vive. Il seed non lo usa (deve
    // contare anche le cancellate); c'è perché chi lo aggiungesse per
    // sbaglio veda fallire il test "righe solo cancellate", invece di un
    // errore del server finto.
    is: (colonna: string, valore: null) => {
      if (colonna === "deleted_at" && valore === null) stato.soloVive = true;
      return builder;
    },
    order: () => builder,
    range: (da: number, a: number) => {
      stato.range = [da, a];
      return builder;
    },
    upsert: () => {
      stato.scrittura = true;
      return builder;
    },
    // `await query` lo risolve come una promise del client Supabase.
    then: (risolvi: (v: unknown) => void) => {
      if (stato.scrittura) {
        risolvi({ data: null, error: { message: "Server finto in sola lettura." } });
        return;
      }
      if (server.fallisce) {
        risolvi({ data: null, count: null, error: { message: "Rete non disponibile (finta)." } });
        return;
      }
      let righe = server.righe.filter(
        (r) => r.user_id === stato.userId && (!stato.soloVive || r.deleted_at === null)
      );
      if (stato.soloConteggio) {
        server.conteggi++;
        risolvi({ data: null, count: righe.length, error: null });
        return;
      }
      if (server.fallisceScarico) {
        risolvi({ data: null, error: { message: "Rete caduta durante lo scarico (finta)." } });
        return;
      }
      if (stato.da) {
        const da = new Date(stato.da).getTime();
        righe = righe.filter((r) => new Date(r.updated_at).getTime() >= da);
      }
      if (stato.range) righe = righe.slice(stato.range[0], stato.range[1] + 1);
      risolvi({ data: righe, error: null });
    },
  };
  return builder;
}

vi.mock("../supabase/client", () => ({
  createClient: () => ({ from: () => query() }),
}));

beforeEach(() => {
  server.righe = [];
  server.fallisce = false;
  server.fallisceScarico = false;
  server.conteggi = 0;
});

// --- Aiuti -------------------------------------------------------------------

function nuovoUtente() {
  return `utente-${crypto.randomUUID()}`;
}

// Una riga di `pasti` com'è sul server (formato PostgREST per l'ora e
// per updated_at).
function rigaServer(userId: string, nomeCanonico: string, modifiche: Partial<Pasto> = {}): Pasto {
  const predefinito = PASTI_PREDEFINITI.find((p) => p.nome === nomeCanonico)!;
  return {
    id: idPastoPredefinito(userId, nomeCanonico),
    user_id: userId,
    nome: predefinito.nome,
    ora_inizio: `${predefinito.ora_inizio}:00`,
    ordine: predefinito.ordine,
    updated_at: "2026-09-20T20:11:00.000000+00:00",
    deleted_at: null,
    ...modifiche,
  };
}

function setServer(userId: string, modifiche: Record<string, Partial<Pasto>> = {}): Pasto[] {
  return PASTI_PREDEFINITI.map((p) => rigaServer(userId, p.nome, modifiche[p.nome]));
}

async function pastiInDexie(userId: string) {
  return db.pasti.where("user_id").equals(userId).toArray();
}

async function vociOutboxPasti(userId: string) {
  return (await db.outbox.toArray()).filter(
    (v) => v.tabella === "pasti" && v.dati.user_id === userId
  );
}

// --- idPastoPredefinito ------------------------------------------------------

describe("idPastoPredefinito — determinismo", () => {
  it("stesso utente e stesso nome producono sempre lo stesso id, letterale", () => {
    // Valore atteso scritto come stringa fissa, non ricalcolato nel test:
    // un "stesso input -> stesso output entro la stessa esecuzione" non
    // si accorgerebbe se qualcuno cambia il namespace o se un aggiornamento
    // della libreria uuid altera l'algoritmo — resterebbe comunque coerente
    // con sé stesso. Solo un valore letterale, fissato una volta e mai
    // ricalcolato dal codice sotto test, intercetta quel giorno.
    const id = idPastoPredefinito(
      "11111111-1111-1111-1111-111111111111",
      "Colazione"
    );
    expect(id).toBe("e706dea9-94e8-5663-a1f7-d48cde562824");
  });

  it("un nome diverso produce un id diverso, anche letterale", () => {
    const id = idPastoPredefinito(
      "11111111-1111-1111-1111-111111111111",
      "Cena"
    );
    expect(id).toBe("57b89487-8ac7-58de-a343-28a856405c56");
  });

  it("utenti diversi non collidono sullo stesso nome", () => {
    const idA = idPastoPredefinito("11111111-1111-1111-1111-111111111111", "Cena");
    const idB = idPastoPredefinito("22222222-2222-2222-2222-222222222222", "Cena");
    expect(idA).not.toBe(idB);
  });
});

// --- garantisciPastiPredefiniti ---------------------------------------------

describe("garantisciPastiPredefiniti — crea solo con il server vuoto", () => {
  it("server vuoto e lettura riuscita: i 5 predefiniti, con gli id deterministici", async () => {
    const userId = nuovoUtente();

    expect(await garantisciPastiPredefiniti(userId)).toBe("creati");

    const pasti = await pastiInDexie(userId);
    expect(pasti.map((p) => p.id).sort()).toEqual(
      PASTI_PREDEFINITI.map((p) => idPastoPredefinito(userId, p.nome)).sort()
    );
    expect(pasti.every((p) => p.deleted_at === null)).toBe(true);
    expect(await vociOutboxPasti(userId)).toHaveLength(PASTI_PREDEFINITI.length);
  });

  it("lettura fallita: nessuna creazione, né in Dexie né nella coda outbox", async () => {
    const userId = nuovoUtente();
    server.fallisce = true;

    expect(await garantisciPastiPredefiniti(userId)).toBe("lettura-fallita");

    expect(await pastiInDexie(userId)).toHaveLength(0);
    expect(await vociOutboxPasti(userId)).toHaveLength(0);
  });

  it("conteggio riuscito ma scarico fallito: «lettura-fallita», nessuna creazione", async () => {
    // Il server ha i pasti (conteggio 5), poi la rete cade prima dello
    // scarico: Dexie resta vuota. L'esito deve dire "fallita" — è quello che
    // fa comparire "Serve la connessione" (usePastiIniziali). Con "scaricati"
    // Oggi resterebbe su "Preparo i tuoi pasti…" all'infinito, senza Riprova
    // e senza riprovare al ritorno della rete.
    const userId = nuovoUtente();
    server.righe = setServer(userId);
    server.fallisceScarico = true;

    expect(await garantisciPastiPredefiniti(userId)).toBe("lettura-fallita");

    expect(server.conteggi).toBe(1);
    expect(await pastiInDexie(userId)).toHaveLength(0);
    expect(await vociOutboxPasti(userId)).toHaveLength(0);
  });

  it("server con righe solo cancellate: nessuna creazione", async () => {
    const userId = nuovoUtente();
    const cancellato = "2026-09-25T10:00:00.000000+00:00";
    server.righe = PASTI_PREDEFINITI.map((p) =>
      rigaServer(userId, p.nome, { deleted_at: cancellato })
    );

    expect(await garantisciPastiPredefiniti(userId)).toBe("scaricati");

    // In Dexie arrivano le righe del server, cancellate com'erano: nessuna
    // viva, nessuna scritta da qui.
    const pasti = await pastiInDexie(userId);
    expect(pasti).toHaveLength(PASTI_PREDEFINITI.length);
    expect(pasti.every((p) => p.deleted_at === cancellato)).toBe(true);
    expect(await vociOutboxPasti(userId)).toHaveLength(0);
  });

  it("server con un predefinito rinominato: nessuna sovrascrittura", async () => {
    const userId = nuovoUtente();
    server.righe = setServer(userId, { Pranzo: { nome: "Pranzo 1" } });

    expect(await garantisciPastiPredefiniti(userId)).toBe("scaricati");

    const pranzo = await db.pasti.get(idPastoPredefinito(userId, "Pranzo"));
    expect(pranzo?.nome).toBe("Pranzo 1");
    // Niente in coda: "Pranzo" non riparte mai verso il server.
    expect(await vociOutboxPasti(userId)).toHaveLength(0);
  });

  it("Dexie con pasti già presenti: nessuna scrittura, nemmeno una lettura dal server", async () => {
    const userId = nuovoUtente();
    // Un solo pasto, cancellato e non predefinito: basta che ci sia una riga.
    await db.pasti.put({
      id: crypto.randomUUID(),
      user_id: userId,
      nome: "Merenda",
      ora_inizio: "17:00",
      ordine: 0,
      updated_at: new Date().toISOString(),
      deleted_at: new Date().toISOString(),
    });

    expect(await garantisciPastiPredefiniti(userId)).toBe("gia-in-locale");

    expect(await pastiInDexie(userId)).toHaveLength(1);
    expect(await vociOutboxPasti(userId)).toHaveLength(0);
    expect(server.conteggi).toBe(0);
  });

  it("cursore già avanti (la discesa incrementale porterebbe 0 righe) ma righe sul server: nessuna creazione", async () => {
    // "0 righe scaricate" non vuol dire "server vuoto": con il cursore già
    // oltre l'ultimo updated_at, scaricaTabella non riceve niente anche se
    // il server ha tutti i pasti. Qui il cursore è avanti e Dexie non ha
    // pasti: se il seed decidesse dallo scarico incrementale, li creerebbe
    // e sovrascriverebbe il "Pranzo 1" del server.
    const userId = nuovoUtente();
    server.righe = setServer(userId, { Pranzo: { nome: "Pranzo 1" } });
    await db.sync_cursori.put({
      id: `pasti:${userId}`,
      tabella: "pasti",
      user_id: userId,
      ultimo_aggiornamento: "2026-10-01T00:00:00.000Z",
    });

    expect(await garantisciPastiPredefiniti(userId)).toBe("scaricati");

    expect(await vociOutboxPasti(userId)).toHaveLength(0);
    // Il cursore vecchio è stato tolto prima dello scarico: le righe del
    // server arrivano tutte, con la rinomina.
    const pasti = await pastiInDexie(userId);
    expect(pasti).toHaveLength(PASTI_PREDEFINITI.length);
    expect(pasti.find((p) => p.id === idPastoPredefinito(userId, "Pranzo"))?.nome).toBe(
      "Pranzo 1"
    );
  });

  it("due chiamate sovrapposte: una sola lettura, un solo set, stesso esito", async () => {
    const userId = nuovoUtente();

    const esiti = await Promise.all([
      garantisciPastiPredefiniti(userId),
      garantisciPastiPredefiniti(userId),
    ]);

    expect(esiti).toEqual(["creati", "creati"]);
    expect(server.conteggi).toBe(1);
    expect(await repositoryPasti.ottieniTutti(userId)).toHaveLength(PASTI_PREDEFINITI.length);
  });

  it("dopo il primo seed, le chiamate successive non scrivono niente", async () => {
    const userId = nuovoUtente();
    await garantisciPastiPredefiniti(userId);
    const primaScrittura = (await pastiInDexie(userId)).map((p) => p.updated_at);

    expect(await garantisciPastiPredefiniti(userId)).toBe("gia-in-locale");

    expect((await pastiInDexie(userId)).map((p) => p.updated_at)).toEqual(primaScrittura);
  });
});
