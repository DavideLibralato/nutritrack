// Una sincronizzazione per volta (src/lib/sync/sincronizza.ts, dal
// 9/10/2026). Prima ogni chiamata faceva un giro suo: le 14 scritture di
// un pasto eliminato con 13 voci facevano partire 14 giri in parallelo,
// ognuno con tutta la coda. Qui il server finto conta gli invii e quanti
// sono in corso nello stesso momento: con un giro per volta, mai più di uno.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import { sincronizzaOutbox } from "./sincronizza";
import { sincronizzaBidirezionale } from "./orchestratore";
import { accodaMutazione } from "./outbox";
import { repositoryPasti } from "../repository";

const inviati: string[] = [];
let inCorsoAdesso = 0;
let massimoInParallelo = 0;

// Ogni invio "viaggia" per qualche millisecondo, come una rete vera.
// I guasti a comando: `imprevisti` giri fanno lanciare un'eccezione a
// createClient (un errore che unGiro non cattura: il giro intero
// fallisce); `retiCadute` invii falliscono come una rete che cade (unGiro
// li cattura, la voce resta in coda).
const guasti = { imprevisti: 0, retiCadute: 0 };

vi.mock("../supabase/client", () => ({
  createClient: () => {
    if (guasti.imprevisti > 0) {
      guasti.imprevisti--;
      throw new Error("guasto imprevisto");
    }
    return {
      from: (tabella: string) => ({
        upsert: async (dati: { id: string }) => {
          inCorsoAdesso++;
          massimoInParallelo = Math.max(massimoInParallelo, inCorsoAdesso);
          await new Promise((r) => setTimeout(r, 5));
          inCorsoAdesso--;
          if (guasti.retiCadute > 0) {
            guasti.retiCadute--;
            throw new Error("Failed to fetch");
          }
          inviati.push(`${tabella}:${dati.id}`);
          return { error: null };
        },
      }),
    };
  },
}));

// La discesa non c'entra: qui interessa solo che l'innesco di `online` e
// del ritorno in primo piano (sincronizzaBidirezionale) finisca nella
// stessa salita, una per volta.
vi.mock("./discesa", () => ({
  scaricaTutto: async () => {},
}));

const USER = "utente-una-per-volta";

function riga(id: string) {
  return { id, user_id: USER, updated_at: "2026-10-09T10:00:00.000Z", deleted_at: null };
}

// Aspetta che la coda sia vuota e che nessun invio sia in viaggio.
async function attendiCodaVuota(timeoutMs = 3000): Promise<void> {
  const inizio = Date.now();
  while ((await db.outbox.count()) > 0 || inCorsoAdesso > 0) {
    if (Date.now() - inizio > timeoutMs) throw new Error("coda mai vuota entro il timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
  // Un attimo in più: un giro di troppo partirebbe adesso.
  await new Promise((r) => setTimeout(r, 50));
}

beforeEach(async () => {
  inviati.length = 0;
  inCorsoAdesso = 0;
  massimoInParallelo = 0;
  guasti.imprevisti = 0;
  guasti.retiCadute = 0;
  await Promise.all([db.outbox.clear(), db.pasti.clear()]);
});

describe("sincronizzaOutbox — una per volta", () => {
  it("14 scritture in una transazione: ogni riga va al server una volta sola", async () => {
    await db.transaction("rw", [db.pasti, db.outbox], async () => {
      for (let i = 0; i < 14; i++) {
        await repositoryPasti.crea({
          user_id: USER, nome: `Pasto ${i}`, ora_inizio: "12:00", ordine: i, valido_dal: null, valido_al: null,
        });
      }
    });
    await attendiCodaVuota();

    expect(inviati).toHaveLength(14);
    expect(new Set(inviati).size).toBe(14);
    expect(massimoInParallelo).toBe(1);
  });

  it("una chiamata arrivata a giro iniziato riceve la fine del giro dopo, che manda anche le sue voci", async () => {
    await accodaMutazione("misurazioni", riga("m1"));
    const primo = sincronizzaOutbox();

    // Il primo giro ha già letto la coda: questa voce arriva dopo.
    await new Promise((r) => setTimeout(r, 1));
    await accodaMutazione("misurazioni", riga("m2"));
    const secondo = await sincronizzaOutbox();

    expect(secondo.inviate).toBe(1);
    expect(inviati).toEqual(["misurazioni:m1", "misurazioni:m2"]);
    expect(await db.outbox.count()).toBe(0);
    await primo;
  });

  it("le chiamate arrivate durante un giro ne prenotano UNO solo, condiviso", async () => {
    await accodaMutazione("misurazioni", riga("m1"));
    const primo = sincronizzaOutbox();
    await new Promise((r) => setTimeout(r, 1));
    const prenotati = [sincronizzaOutbox(), sincronizzaOutbox(), sincronizzaOutbox()];
    expect(prenotati[1]).toBe(prenotati[0]);
    expect(prenotati[2]).toBe(prenotati[0]);
    await Promise.all([primo, ...prenotati]);
    expect(inviati).toEqual(["misurazioni:m1"]);
  });

  it("anche l'innesco di online / primo piano si mette in fila, non apre un giro in parallelo", async () => {
    for (let i = 0; i < 5; i++) await accodaMutazione("misurazioni", riga(`m${i}`));
    const daScrittura = sincronizzaOutbox();
    const daOnline = sincronizzaBidirezionale(USER);
    const daPrimoPiano = sincronizzaBidirezionale(USER);
    await Promise.all([daScrittura, daOnline, daPrimoPiano]);

    expect(inviati).toHaveLength(5);
    expect(massimoInParallelo).toBe(1);
  });
});

// Un giro che fallisce non deve lasciare la sincronizzazione bloccata:
// se "giro in corso" restasse occupato, nessun giro partirebbe più e la
// coda non arriverebbe mai al server, in silenzio.
describe("sincronizzaOutbox — dopo un giro fallito", () => {
  it("un'eccezione imprevista libera il giro: la chiamata dopo manda la coda", async () => {
    await accodaMutazione("misurazioni", riga("m1"));
    guasti.imprevisti = 1;
    await expect(sincronizzaOutbox()).rejects.toThrow("guasto imprevisto");

    const dopo = await sincronizzaOutbox();
    expect(dopo.inviate).toBe(1);
    expect(inviati).toEqual(["misurazioni:m1"]);
    expect(await db.outbox.count()).toBe(0);
  });

  it("un giro prenotato durante un giro che fallisce parte lo stesso", async () => {
    await accodaMutazione("misurazioni", riga("m1"));
    guasti.imprevisti = 1;
    const primo = sincronizzaOutbox();
    const prenotato = sincronizzaOutbox();

    await expect(primo).rejects.toThrow("guasto imprevisto");
    expect((await prenotato).inviate).toBe(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it("una rete che cade a metà non blocca: la voce resta in coda e parte al giro dopo", async () => {
    await accodaMutazione("misurazioni", riga("m1"));
    guasti.retiCadute = 1;
    const primo = await sincronizzaOutbox();
    expect(primo).toEqual({ inviate: 0, fallite: 1, sospese: 0 });
    expect(await db.outbox.count()).toBe(1);

    const dopo = await sincronizzaOutbox();
    expect(dopo.inviate).toBe(1);
    expect(await db.outbox.count()).toBe(0);
  });
});
