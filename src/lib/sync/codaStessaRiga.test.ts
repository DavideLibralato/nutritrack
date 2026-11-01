// La stessa riga riaccodata mentre il suo invio è in viaggio (audit #1,
// 01/11/2026; seAncoraQuella in src/lib/sync/sincronizza.ts). L'id della
// voce in coda è "<tabella>:<id riga>", quindi la seconda scrittura
// sovrascrive la prima: prima della correzione, a fine invio il giro
// cancellava (o aggiornava) per id la versione NUOVA, che il server non
// aveva mai visto. Caso tipico: "+" e poi "Annulla" con rete lenta.
//
// Il server finto si ferma sul primo invio finché il test non apre la
// barriera: così la seconda scrittura arriva di sicuro "durante l'invio".

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import { sincronizzaOutbox } from "./sincronizza";
import { accodaMutazione } from "./outbox";

const USER = "utente-stessa-riga";
const ID_VOCE = "voci_diario:v1";

interface Risposta {
  error: { message: string } | null;
  status: number;
}
const OK: Risposta = { error: null, status: 201 };
const RIFIUTO: Risposta = { error: { message: "rifiutata dal server" }, status: 400 };
const RETE: Risposta = { error: { message: "Failed to fetch" }, status: 0 };

// Ciò che il server finto ha ricevuto, copiato al momento dell'invio.
const inviati: { tabella: string; dati: { id: string; deleted_at: string | null } }[] = [];
let risposta: Risposta = OK;

// La barriera: il primo invio dopo trattieniIlProssimo() avvisa che è
// partito (partito) e aspetta apri().
let trattieni = false;
let segnalaPartito: () => void = () => {};
let apri: () => void = () => {};
let barriera: Promise<void> = Promise.resolve();
let partito: Promise<void> = Promise.resolve();

function trattieniIlProssimo(): void {
  trattieni = true;
  partito = new Promise((r) => (segnalaPartito = r));
  barriera = new Promise((r) => (apri = r));
}

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: USER } } } }) },
    from: (tabella: string) => ({
      upsert: async (dati: { id: string; deleted_at: string | null }) => {
        inviati.push({ tabella, dati: structuredClone(dati) });
        if (trattieni) {
          trattieni = false;
          segnalaPartito();
          await barriera;
        }
        return risposta;
      },
    }),
  }),
}));

function riga(deleted_at: string | null) {
  return { id: "v1", user_id: USER, updated_at: "2026-11-01T10:00:00.000Z", deleted_at };
}

// v1 in coda, parte il giro A; a invio in viaggio la stessa riga si
// riaccoda con deleted_at (v2). `faiPartireGiro`: come fa il repository
// dopo ogni scrittura, si chiama sincronizzaOutbox, che prenota il giro B.
async function v2DuranteLInvio(faiPartireGiro: boolean) {
  trattieniIlProssimo();
  const giroA = sincronizzaOutbox();
  await partito;
  // creato_il al millisecondo: due accodamenti nello stesso millisecondo
  // sono il limite accettato della correzione, non il caso da provare.
  await new Promise((r) => setTimeout(r, 2));
  await accodaMutazione("voci_diario", riga("2026-11-01T10:00:01.000Z"));
  const giroB = faiPartireGiro ? sincronizzaOutbox() : null;
  apri();
  const risultatoA = await giroA;
  await giroB;
  return risultatoA;
}

beforeEach(async () => {
  inviati.length = 0;
  risposta = OK;
  trattieni = false;
  await db.outbox.clear();
  await accodaMutazione("voci_diario", riga(null));
});

describe("sincronizzaOutbox — stessa riga riaccodata durante l'invio", () => {
  it("invio riuscito: la versione nuova resta in coda e la manda il giro dopo", async () => {
    await v2DuranteLInvio(true);

    expect(inviati.map((i) => i.dati.deleted_at)).toEqual([null, "2026-11-01T10:00:01.000Z"]);
    expect(await db.outbox.count()).toBe(0);
  });

  it("rifiuto: la versione nuova non eredita il tentativo della vecchia", async () => {
    risposta = RIFIUTO;
    await v2DuranteLInvio(true);

    // Un solo tentativo, il suo (giro B): quello di v1 resta a v1.
    const voce = await db.outbox.get(ID_VOCE);
    expect(voce?.dati.deleted_at).toBe("2026-11-01T10:00:01.000Z");
    expect(voce?.tentativi).toBe(1);
    expect(voce?.ultimo_status).toBe(400);
    expect(inviati).toHaveLength(2);
  });

  it("soglia raggiunta: la versione nuova non si accantona, e il giro dopo la prova da zero", async () => {
    await db.outbox.update(ID_VOCE, { tentativi: 4 });
    risposta = RIFIUTO;
    const risultatoA = await v2DuranteLInvio(true);

    expect(risultatoA.sospese).toBe(0);
    const voce = await db.outbox.get(ID_VOCE);
    expect(voce?.dati.deleted_at).toBe("2026-11-01T10:00:01.000Z");
    expect(voce?.sospesa_il).toBeNull();
    expect(voce?.tentativi).toBe(1);
  });

  it("rete assente (status 0): l'errore dell'invio non finisce sulla versione nuova", async () => {
    risposta = RETE;
    // Senza giro B: un giro dopo proverebbe v2 e scriverebbe il SUO errore,
    // e non si vedrebbe più da chi viene.
    const risultatoA = await v2DuranteLInvio(false);

    expect(risultatoA.fallite).toBe(1);
    const voce = await db.outbox.get(ID_VOCE);
    expect(voce?.dati.deleted_at).toBe("2026-11-01T10:00:01.000Z");
    expect(voce?.ultimo_errore).toBeNull();
    expect(voce?.ultimo_status).toBeNull();
  });
});
