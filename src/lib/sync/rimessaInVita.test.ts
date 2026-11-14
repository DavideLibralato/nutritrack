// Una riga rimessa in vita (deleted_at → null) prima che la sua voce in
// coda sia salita al server (audit del 14/11, A2). La discesa fa vincere
// sempre una cancellazione che arriva dal server (discesa.ts): prima della
// correzione vinceva anche la cancellazione che l'utente aveva appena
// annullato, e il server la rimanda a ogni discesa finché è l'ultima
// modifica della tabella (finestra di 60 s sul cursore). Risultato: la
// stella rimessa offline, o l'Annulla di un alimento con la rete caduta,
// sparivano di nuovo, con solo un console.error.
//
// La regola (PUNTO_DI_PARTENZA.md §9.2): la voce ricorda QUALE
// cancellazione annulla (cancellazioni_annullate, il valore di deleted_at
// che la riga aveva), e la discesa rispetta solo quella, per uguaglianza
// dell'istante. Una cancellazione diversa, fatta altrove, vince come
// sempre. Nessun confronto più recente/più vecchio: l'orologio del
// telefono non è affidabile.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import { scaricaTabella } from "./discesa";
import { repositoryPreferiti } from "../repository/index";
import { togglePreferito } from "../repository/preferiti";
import { eliminaAlimenti, ripristinaAlimenti } from "../repository/composizioni";
import type { Alimento, Composizione, ComposizioneVoce, Preferito } from "../db/tipi";

// La salita non parte: le voci restano in coda, dove i test le guardano.
vi.mock("./sincronizza", () => ({
  sincronizzaOutbox: async () => ({ inviate: 0, fallite: 0, sospese: 0 }),
}));

// Il server finto della discesa: per ogni tabella, le righe che rimanda.
const righeServer: Record<string, unknown[]> = {};

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: (tabella: string) => {
      const builder = {
        select: () => builder,
        order: () => builder,
        eq: () => builder,
        or: () => builder,
        gte: () => builder,
        range: () => builder,
        then: (risolvi: (v: unknown) => void) =>
          risolvi({ data: righeServer[tabella] ?? [], error: null, status: 200 }),
      };
      return builder;
    },
  }),
}));

// Lo stesso istante nel formato di PostgREST (6 decimali, "+00:00"), come
// arriva davvero dal server: l'uguaglianza deve reggere fra i due formati.
function comePostgrest(iso: string): string {
  return iso.replace(/\.(\d{3})Z$/, ".$1000+00:00");
}

// La cancellazione che il telefono ha visto (fatta da lui o scaricata).
const D1 = "2026-11-10T10:00:00.000Z";
// Una cancellazione diversa, fatta da un altro dispositivo.
const D2 = "2026-11-12T08:30:00.000Z";

function preferito(id: string, userId: string, alimentoId: string, deletedAt: string | null) {
  return {
    id,
    user_id: userId,
    alimento_id: alimentoId,
    updated_at: deletedAt ?? D1,
    deleted_at: deletedAt,
  } as Preferito;
}

// Un preferito tolto, la cui cancellazione D1 è già sul server.
async function preferitoTolto() {
  const userId = `utente-${crypto.randomUUID()}`;
  const id = crypto.randomUUID();
  const alimentoId = crypto.randomUUID();
  await db.preferiti.put(preferito(id, userId, alimentoId, D1));
  return { userId, id, alimentoId };
}

function cancellazioneSulServer(id: string, userId: string, alimentoId: string, deletedAt: string) {
  righeServer.preferiti = [
    {
      ...preferito(id, userId, alimentoId, null),
      updated_at: comePostgrest(deletedAt),
      deleted_at: comePostgrest(deletedAt),
    },
  ];
}

beforeEach(async () => {
  for (const chiave of Object.keys(righeServer)) delete righeServer[chiave];
  await db.outbox.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Rimessa in vita — la discesa rispetta la cancellazione annullata", () => {
  it("1. stella rimessa offline: la discesa non la ricancella e la voce resta in coda", async () => {
    const { userId, id, alimentoId } = await preferitoTolto();

    await togglePreferito(userId, [], alimentoId);
    cancellazioneSulServer(id, userId, alimentoId, D1);
    await scaricaTabella(userId, db.preferiti, "preferiti");

    expect((await db.preferiti.get(id))?.deleted_at).toBeNull();
    const voce = await db.outbox.get(`preferiti:${id}`);
    expect(voce?.dati.deleted_at).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
    // Il cursore avanza come per ogni riga scaricata (verifica 1): la riga
    // non scritta conta lo stesso.
    const cursore = await db.sync_cursori.get(`preferiti:${userId}`);
    expect(cursore?.ultimo_aggiornamento).toBe(comePostgrest(D1));
  });

  it("2. Annulla di un alimento eliminato: alimento, pasto salvato e riga restano vivi", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const base = { user_id: userId, updated_at: D1, deleted_at: null };
    const idAlimento = crypto.randomUUID();
    const idPasto = crypto.randomUUID();
    const idRiga = crypto.randomUUID();
    await db.alimenti.put({
      ...base,
      id: idAlimento,
      nome: `Avena ${idAlimento}`,
      marca: null,
      barcode: null,
      kcal_100g: 370,
      proteine_100g: 13,
      carboidrati_100g: 60,
      grassi_100g: 7,
      zuccheri_100g: null,
      fibre_100g: null,
      saturi_100g: null,
      sale_100g: null,
      porzione_default_g: 40,
      fonte: "manuale",
      verificato: false,
    } as Alimento);
    await db.composizioni.put({
      ...base,
      id: idPasto,
      nome: `Colazione ${idPasto}`,
      tipo: "pasto_salvato",
      alimento_id: null,
    } as Composizione);
    await db.composizioni_voci.put({
      ...base,
      id: idRiga,
      composizione_id: idPasto,
      alimento_id: idAlimento,
      quantita_g: 40,
      ordine: 0,
    } as ComposizioneVoce);

    const traccia = await eliminaAlimenti(userId, [idAlimento]);
    // Le cancellazioni sono arrivate al server, che le rimanda così.
    for (const [tabella, id] of [
      ["alimenti", idAlimento],
      ["composizioni", idPasto],
      ["composizioni_voci", idRiga],
    ] as const) {
      const cancellata = await db.table(tabella).get(id);
      expect(cancellata.deleted_at).not.toBeNull();
      righeServer[tabella] = [
        {
          ...cancellata,
          updated_at: comePostgrest(cancellata.deleted_at),
          deleted_at: comePostgrest(cancellata.deleted_at),
        },
      ];
    }

    await ripristinaAlimenti(userId, traccia);
    await scaricaTabella(userId, db.alimenti, "alimenti", { includiCondivisi: true });
    await scaricaTabella(userId, db.composizioni, "composizioni");
    await scaricaTabella(userId, db.composizioni_voci, "composizioni_voci");

    for (const [tabella, id] of [
      ["alimenti", idAlimento],
      ["composizioni", idPasto],
      ["composizioni_voci", idRiga],
    ] as const) {
      expect((await db.table(tabella).get(id)).deleted_at).toBeNull();
      expect((await db.outbox.get(`${tabella}:${id}`))?.dati.deleted_at).toBeNull();
    }
  });

  it("3. Annulla ripetuto (rimetti, togli, rimetti) prima della salita: vale ancora D1", async () => {
    const { userId, id, alimentoId } = await preferitoTolto();

    await togglePreferito(userId, [], alimentoId);
    // Togli di nuovo: una cancellazione nuova, solo sul telefono.
    await togglePreferito(userId, await repositoryPreferiti.ottieniTutti(userId), alimentoId);
    // Rimetti: la riga ha ora la cancellazione locale, non D1.
    await togglePreferito(userId, [], alimentoId);
    cancellazioneSulServer(id, userId, alimentoId, D1);
    await scaricaTabella(userId, db.preferiti, "preferiti");

    expect((await db.preferiti.get(id))?.deleted_at).toBeNull();
    expect((await db.outbox.get(`preferiti:${id}`))?.dati.deleted_at).toBeNull();
  });

  it("4. una cancellazione diversa, fatta altrove, vince come sempre", async () => {
    const { userId, id, alimentoId } = await preferitoTolto();

    await togglePreferito(userId, [], alimentoId);
    cancellazioneSulServer(id, userId, alimentoId, D2);
    await scaricaTabella(userId, db.preferiti, "preferiti");

    expect(await db.outbox.get(`preferiti:${id}`)).toBeUndefined();
    expect((await db.preferiti.get(id))?.deleted_at).toBe(comePostgrest(D2));
    expect(console.error).toHaveBeenCalled();
  });

  it("5. voce accantonata: la discesa scrive la cancellazione in locale e la voce resta com'è", async () => {
    const { userId, id, alimentoId } = await preferitoTolto();

    await togglePreferito(userId, [], alimentoId);
    const sospesaIl = "2026-11-13T09:00:00.000Z";
    await db.outbox.update(`preferiti:${id}`, { sospesa_il: sospesaIl });
    cancellazioneSulServer(id, userId, alimentoId, D1);
    await scaricaTabella(userId, db.preferiti, "preferiti");

    expect((await db.preferiti.get(id))?.deleted_at).toBe(comePostgrest(D1));
    const voce = await db.outbox.get(`preferiti:${id}`);
    expect(voce?.sospesa_il).toBe(sospesaIl);
    expect(voce?.dati.deleted_at).toBeNull();
  });
});
