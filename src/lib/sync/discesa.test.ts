// Bug di logica sottile che la discesa deve evitare fin dal primo giorno,
// non scoprire mesi dopo controllando Supabase a mano (CLAUDE.md, sezione
// test):
//
// 1. Perdita di righe silenziosa: senza ORDER BY + paginazione esplicita,
//    il tetto di righe per risposta di PostgREST (Settings -> API -> Max
//    Rows) restituisce un sottoinsieme arbitrario, il cursore avanza
//    comunque al massimo di quel sottoinsieme, e le righe più vecchie
//    rimaste fuori non vengono mai più richieste.
// 2. Il cursore che salta una riga per sempre. Il trigger set_updated_at
//    usa now() (inizio transazione, non commit): due upsert quasi
//    simultanee possono committare fuori ordine, e una query "> cursore"
//    esatta perderebbe la più lenta senza errore.
// 3. La discesa che sovrascrive una modifica locale più recente ancora in
//    coda outbox.
// 4. Una voce outbox in sospeso che resuscita silenziosamente una riga
//    cancellata sul server — anche quando il locale sembra "più recente"
//    (il caso vero: una modifica fatta offline DOPO che un altro
//    dispositivo ha cancellato, il cui updated_at locale è più recente
//    solo perché non si è ancora confrontato col server).
// 5. Confronto fra timestamp in formati diversi (PostgREST vs
//    new Date().toISOString() locale) fatto come stringhe invece che come
//    istanti — sbaglia in modo silenzioso quando i due coincidono al
//    millisecondo.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import { scaricaTabella, DIMENSIONE_PAGINA, millisecondiDi } from "./discesa";
import type { Pasto } from "../db/tipi";

interface RisultatoQuery {
  data: unknown[] | null;
  error: { message: string } | null;
}

function creaBuilderFinto(risultato: RisultatoQuery, chiamate: Record<string, unknown[]>) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn((...args: unknown[]) => {
      chiamate.eq = args;
      return builder;
    }),
    or: vi.fn((...args: unknown[]) => {
      chiamate.or = args;
      return builder;
    }),
    gte: vi.fn((...args: unknown[]) => {
      chiamate.gte = args;
      return builder;
    }),
    range: vi.fn((...args: unknown[]) => {
      chiamate.range = args;
      return builder;
    }),
    // Rende il builder "thenable": `await query` lo risolve come farebbe
    // una vera promise del client Supabase, senza bisogno di un metodo a
    // parte da chiamare esplicitamente.
    then: (risolvi: (v: RisultatoQuery) => void) => risolvi(risultato),
  };
  return builder;
}

const fromMock = vi.fn();

vi.mock("../supabase/client", () => ({
  createClient: () => ({ from: fromMock }),
}));

function pasto(parziale: Partial<Pasto> & Pick<Pasto, "id" | "updated_at">): Pasto {
  return {
    user_id: "u1",
    deleted_at: null,
    nome: "Pranzo",
    ora_inizio: "12:30",
    ordine: 0,
    ...parziale,
  };
}

function generaPagina(quantita: number, userId: string, orarioBaseMs: number): Pasto[] {
  return Array.from({ length: quantita }, (_, i) =>
    pasto({
      id: crypto.randomUUID(),
      user_id: userId,
      updated_at: new Date(orarioBaseMs + i * 1000).toISOString(),
    })
  );
}

describe("scaricaTabella — paginazione", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("più righe della dimensione di pagina: le scarica tutte, il cursore arriva all'ultima", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const orarioBase = Date.parse("2026-09-20T08:00:00.000Z");
    // Prima pagina esattamente piena: è il segnale che ce n'è (probabilmente)
    // un'altra, non la prova che i dati finiscono lì.
    const pagina1 = generaPagina(DIMENSIONE_PAGINA, userId, orarioBase);
    const pagina2 = generaPagina(3, userId, orarioBase + DIMENSIONE_PAGINA * 1000);

    fromMock
      .mockReturnValueOnce(creaBuilderFinto({ data: pagina1, error: null }, {}))
      .mockReturnValueOnce(creaBuilderFinto({ data: pagina2, error: null }, {}));

    await scaricaTabella(userId, db.pasti, "pasti");

    // Due pagine interrogate: una da sola (senza paginazione) si sarebbe
    // fermata alla prima, lasciando le ultime 3 righe scoperte per sempre.
    expect(fromMock).toHaveBeenCalledTimes(2);

    const tutte = await db.pasti.where("user_id").equals(userId).toArray();
    expect(tutte).toHaveLength(DIMENSIONE_PAGINA + 3);

    const cursore = await db.sync_cursori.get(`pasti:${userId}`);
    expect(cursore?.ultimo_aggiornamento).toBe(pagina2[2].updated_at);
  });

  it("una sola pagina, più corta della dimensione richiesta: si ferma al primo giro", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    fromMock.mockReturnValue(
      creaBuilderFinto(
        { data: [pasto({ id: crypto.randomUUID(), user_id: userId, updated_at: "2026-09-20T09:00:00.000Z" })], error: null },
        {}
      )
    );

    await scaricaTabella(userId, db.pasti, "pasti");

    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});

describe("scaricaTabella — finestra di sicurezza sul cursore", () => {
  beforeEach(async () => {
    fromMock.mockReset();
    await db.sync_cursori.clear();
  });

  it("interroga da (cursore - 1 minuto) con >=, non dal cursore esatto", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    await db.sync_cursori.put({
      id: `pasti:${userId}`,
      tabella: "pasti",
      user_id: userId,
      ultimo_aggiornamento: "2026-09-20T10:05:00.000Z",
    });

    const chiamate: Record<string, unknown[]> = {};
    fromMock.mockReturnValue(creaBuilderFinto({ data: [], error: null }, chiamate));

    await scaricaTabella(userId, db.pasti, "pasti");

    expect(chiamate.gte).toEqual(["updated_at", "2026-09-20T10:04:00.000Z"]);
  });

  it("senza un cursore precedente non filtra per data (scarico completo, dispositivo nuovo)", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const chiamate: Record<string, unknown[]> = {};
    fromMock.mockReturnValue(creaBuilderFinto({ data: [], error: null }, chiamate));

    await scaricaTabella(userId, db.pasti, "pasti");

    expect(chiamate.gte).toBeUndefined();
  });

  it("il cursore avanza al massimo updated_at scaricato, non a metà del ciclo", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    fromMock.mockReturnValue(
      creaBuilderFinto(
        {
          data: [
            pasto({ id: crypto.randomUUID(), updated_at: "2026-09-20T09:00:00.000Z" }),
            pasto({ id: crypto.randomUUID(), updated_at: "2026-09-20T11:30:00.000Z" }),
          ],
          error: null,
        },
        {}
      )
    );

    await scaricaTabella(userId, db.pasti, "pasti");

    const cursore = await db.sync_cursori.get(`pasti:${userId}`);
    expect(cursore?.ultimo_aggiornamento).toBe("2026-09-20T11:30:00.000Z");
  });
});

describe("scaricaTabella — non sovrascrive una modifica locale più recente", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("una riga scaricata più vecchia della copia locale viene ignorata", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const id = crypto.randomUUID();
    await db.pasti.put(
      pasto({ id, user_id: userId, nome: "Modificato in locale", updated_at: "2026-09-20T12:00:00.000Z" })
    );

    fromMock.mockReturnValue(
      creaBuilderFinto(
        {
          data: [pasto({ id, user_id: userId, nome: "Versione vecchia dal server", updated_at: "2026-09-20T11:00:00.000Z" })],
          error: null,
        },
        {}
      )
    );

    await scaricaTabella(userId, db.pasti, "pasti");

    const locale = await db.pasti.get(id);
    expect(locale?.nome).toBe("Modificato in locale");
  });

  it("una riga scaricata più recente della copia locale la sovrascrive", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const id = crypto.randomUUID();
    await db.pasti.put(
      pasto({ id, user_id: userId, nome: "Versione locale vecchia", updated_at: "2026-09-20T11:00:00.000Z" })
    );

    fromMock.mockReturnValue(
      creaBuilderFinto(
        {
          data: [pasto({ id, user_id: userId, nome: "Versione nuova dal server", updated_at: "2026-09-20T12:00:00.000Z" })],
          error: null,
        },
        {}
      )
    );

    await scaricaTabella(userId, db.pasti, "pasti");

    const locale = await db.pasti.get(id);
    expect(locale?.nome).toBe("Versione nuova dal server");
  });

});

describe("millisecondiDi — confronto per istante, non come stringhe", () => {
  it("lo stesso istante in formato PostgREST e in formato locale produce lo stesso numero", () => {
    // Caso reale osservato: PostgREST restituisce "...619969+00:00" (6
    // decimali, offset esplicito), new Date().toISOString() locale produce
    // "...619Z" (3 decimali). Sono lo stesso istante (getTime() tronca al
    // millisecondo, 619969 microsecondi -> 619 millisecondi) ma come
    // stringhe "969+00:00" ordina PRIMA di "Z" (le cifre stanno sotto "Z"
    // nell'alfabeto ASCII): un confronto `>` fra stringhe considererebbe il
    // server sistematicamente "più vecchio" anche quando non lo è.
    const locale = millisecondiDi("2026-09-20T07:21:33.619Z");
    const daPostgrest = millisecondiDi("2026-09-20T07:21:33.619969+00:00");

    expect(daPostgrest).toBe(locale);
    // Il confronto a stringhe, per lo stesso identico istante, direbbe
    // l'opposto di un confronto corretto (che qui è "né l'uno né l'altro",
    // essendo lo stesso istante).
    expect("2026-09-20T07:21:33.619969+00:00" < "2026-09-20T07:21:33.619Z").toBe(true);
  });

  it("un istante genuinamente successivo resta maggiore indipendentemente dal formato", () => {
    const primaLocale = millisecondiDi("2026-09-20T07:21:33.619Z");
    const dopoDaPostgrest = millisecondiDi("2026-09-20T07:21:34.000100+00:00");

    expect(dopoDaPostgrest).toBeGreaterThan(primaLocale);
  });
});

describe("scaricaTabella — cancellazioni scaricate scartano le modifiche in sospeso", () => {
  beforeEach(async () => {
    fromMock.mockReset();
    await db.outbox.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("una voce outbox non ancora inviata viene scartata e loggata se la riga risulta cancellata", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const id = crypto.randomUUID();
    const idOutbox = `pasti:${id}`;
    await db.outbox.put({
      id: idOutbox,
      tabella: "pasti",
      record_id: id,
      dati: pasto({ id, user_id: userId, updated_at: "2026-09-20T11:00:00.000Z" }),
      creato_il: "2026-09-20T11:00:00.000Z",
      tentativi: 0,
      ultimo_errore: null,
      sospesa_il: null,
    });

    fromMock.mockReturnValue(
      creaBuilderFinto(
        {
          data: [
            pasto({
              id,
              user_id: userId,
              updated_at: "2026-09-20T12:00:00.000Z",
              deleted_at: "2026-09-20T12:00:00.000Z",
            }),
          ],
          error: null,
        },
        {}
      )
    );

    await scaricaTabella(userId, db.pasti, "pasti");

    expect(await db.outbox.get(idOutbox)).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("riga cancellata sul server ma con copia locale PIÙ RECENTE: la voce outbox viene scartata comunque", async () => {
    // Il caso vero, non solo quello più facile da immaginare: A cancella,
    // B modifica offline DOPO (quindi con un updated_at locale successivo
    // a quello della cancellazione), B si riconnette. La riga scaricata
    // (la cancellazione di A) ha un updated_at PIÙ VECCHIO della copia
    // locale di B — è esattamente l'unico caso in cui una voce outbox non
    // ancora inviata esiste davvero, perché esiste in quanto la modifica
    // locale è successiva. La guardia deve scattare comunque, senza
    // eccezioni sul confronto dei timestamp.
    const userId = `utente-${crypto.randomUUID()}`;
    const id = crypto.randomUUID();
    const idOutbox = `pasti:${id}`;

    await db.pasti.put(
      pasto({ id, user_id: userId, nome: "Modifica locale offline", updated_at: "2026-09-20T13:00:00.000Z" })
    );
    await db.outbox.put({
      id: idOutbox,
      tabella: "pasti",
      record_id: id,
      dati: pasto({ id, user_id: userId, nome: "Modifica locale offline", updated_at: "2026-09-20T13:00:00.000Z" }),
      creato_il: "2026-09-20T13:00:00.000Z",
      tentativi: 0,
      ultimo_errore: null,
      sospesa_il: null,
    });

    fromMock.mockReturnValue(
      creaBuilderFinto(
        {
          data: [
            pasto({
              id,
              user_id: userId,
              updated_at: "2026-09-20T12:00:00.000Z", // più vecchia della copia locale
              deleted_at: "2026-09-20T12:00:00.000Z",
            }),
          ],
          error: null,
        },
        {}
      )
    );

    await scaricaTabella(userId, db.pasti, "pasti");

    expect(await db.outbox.get(idOutbox)).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
    // La cancellazione vince anche in locale: lasciare la riga viva
    // mostrerebbe per sempre un pasto che altrove non esiste più, con la
    // sua voce outbox ormai scartata (non ripartirà mai a "risorgerlo").
    const locale = await db.pasti.get(id);
    expect(locale?.deleted_at).not.toBeNull();
  });

  it("una voce outbox già accantonata non viene toccata né ri-loggata", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const id = crypto.randomUUID();
    const idOutbox = `pasti:${id}`;
    await db.outbox.put({
      id: idOutbox,
      tabella: "pasti",
      record_id: id,
      dati: pasto({ id, user_id: userId, updated_at: "2026-09-20T11:00:00.000Z" }),
      creato_il: "2026-09-20T11:00:00.000Z",
      tentativi: 5,
      ultimo_errore: "errore precedente",
      sospesa_il: "2026-09-20T11:05:00.000Z",
    });

    fromMock.mockReturnValue(
      creaBuilderFinto(
        {
          data: [
            pasto({
              id,
              user_id: userId,
              updated_at: "2026-09-20T12:00:00.000Z",
              deleted_at: "2026-09-20T12:00:00.000Z",
            }),
          ],
          error: null,
        },
        {}
      )
    );

    await scaricaTabella(userId, db.pasti, "pasti");

    expect(await db.outbox.get(idOutbox)).toBeDefined();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("una riga scaricata non cancellata non tocca una voce outbox in sospeso per lo stesso id", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const id = crypto.randomUUID();
    const idOutbox = `pasti:${id}`;
    await db.outbox.put({
      id: idOutbox,
      tabella: "pasti",
      record_id: id,
      dati: pasto({ id, user_id: userId, updated_at: "2026-09-20T11:00:00.000Z" }),
      creato_il: "2026-09-20T11:00:00.000Z",
      tentativi: 0,
      ultimo_errore: null,
      sospesa_il: null,
    });

    fromMock.mockReturnValue(
      creaBuilderFinto(
        {
          data: [pasto({ id, user_id: userId, updated_at: "2026-09-20T12:00:00.000Z" })],
          error: null,
        },
        {}
      )
    );

    await scaricaTabella(userId, db.pasti, "pasti");

    expect(await db.outbox.get(idOutbox)).toBeDefined();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("scaricaTabella — alimenti include le righe condivise", () => {
  it("con includiCondivisi usa .or() invece di .eq() per non perdere le righe a user_id null", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const chiamate: Record<string, unknown[]> = {};
    fromMock.mockReset();
    fromMock.mockReturnValue(creaBuilderFinto({ data: [], error: null }, chiamate));

    await scaricaTabella(userId, db.alimenti, "alimenti", { includiCondivisi: true });

    expect(chiamate.or).toEqual([`user_id.is.null,user_id.eq.${userId}`]);
    expect(chiamate.eq).toBeUndefined();
  });
});
