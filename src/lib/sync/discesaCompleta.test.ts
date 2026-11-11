// Il segno "discesa completa" (discesaCompleta.ts, dal 07/11, branch
// esporta). Sbaglia in silenzio: acceso con una tabella mancante, Esporta
// salverebbe un backup a cui manca un pezzo, e l'utente lo scoprirebbe solo
// il giorno in cui gli serve; acceso su una copia vuota (IndexedDB
// cancellato da Safari, localStorage rimasto), il backup sarebbe vuoto. Si
// prova con la discesa vera (scaricaTutto): finto è solo il client
// Supabase, come in discesaRiuscita.test.ts.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { scaricaTutto, TABELLE_DISCESA } from "./discesa";
import { azzeraStatoGiri, discesaRiuscitaPer, leggiStatoGiri } from "./statoSincronizzazione";
import {
  chiaveDiscesaCompleta,
  copiaLocaleCompleta,
  segnaDiscesaCompleta,
  segnoDiscesaCompleta,
  statoCopiaLocale,
  TABELLE_DATI,
  togliSegnoDiscesaCompleta,
} from "./discesaCompleta";
import { db } from "../db/database";
import type { Pasto, Profilo } from "../db/tipi";

// --- Client Supabase finto ---------------------------------------------------
// Ogni tabella risponde vuota, salvo quelle in `rispostePerTabella`.
const server = vi.hoisted(() => ({
  rispostePerTabella: {} as Record<string, { error: { message: string }; status: number }>,
}));

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
          risolvi(server.rispostePerTabella[tabella] ?? { data: [], error: null, status: 200 }),
      };
      return builder;
    },
  }),
}));

const SENZA_RETE = { error: { message: "FetchError: Load failed" }, status: 0 };

function profilo(userId: string, deletedAt: string | null = null): Profilo {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: "2026-11-07T08:00:00.000Z",
    deleted_at: deletedAt,
    nome: null,
    sesso: "non_indicato",
    data_nascita: null,
    altezza_cm: null,
    livello_attivita: "moderato",
    differenzia_giorni: false,
    giorni_allenamento_default: null,
  };
}

function pasto(userId: string, deletedAt: string | null = null): Pasto {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: "2026-11-07T08:00:00.000Z",
    deleted_at: deletedAt,
    nome: "Pranzo",
    ora_inizio: "12:30",
    ordine: 2,
  };
}

beforeEach(async () => {
  server.rispostePerTabella = {};
  window.localStorage.clear();
  azzeraStatoGiri();
  for (const { tabella } of TABELLE_DISCESA) await tabella.clear();
  await db.sync_cursori.clear();
});

describe("il segno si accende solo con tutte le tabelle", () => {
  it("un giro senza errori lo accende, anche con il server vuoto", async () => {
    expect(segnoDiscesaCompleta("u1")).toBe(false);
    await scaricaTutto("u1");
    expect(segnoDiscesaCompleta("u1")).toBe(true);
  });

  it("se fallisce una tabella qualunque di TABELLE_DISCESA resta spento", async () => {
    for (const { nome } of TABELLE_DISCESA) {
      window.localStorage.clear();
      azzeraStatoGiri();
      server.rispostePerTabella = { [nome]: SENZA_RETE };
      await scaricaTutto("u1");
      expect(segnoDiscesaCompleta("u1"), nome).toBe(false);
    }
  });

  it("acceso, un giro fallito dopo non lo spegne", async () => {
    await scaricaTutto("u1");
    server.rispostePerTabella = { voci_diario: SENZA_RETE, profili: SENZA_RETE };
    await scaricaTutto("u1");
    expect(segnoDiscesaCompleta("u1")).toBe(true);
  });

  it("vale per un utente solo", async () => {
    await scaricaTutto("u1");
    expect(segnoDiscesaCompleta("u2")).toBe(false);
    expect(window.localStorage.getItem(chiaveDiscesaCompleta("u1"))).not.toBeNull();
  });

  it("acceso di nuovo, tiene l'ora della prima volta", () => {
    segnaDiscesaCompleta("u1", new Date("2026-11-07T10:00:00.000Z"));
    segnaDiscesaCompleta("u1", new Date("2026-11-08T10:00:00.000Z"));
    expect(window.localStorage.getItem(chiaveDiscesaCompleta("u1"))).toBe(
      "2026-11-07T10:00:00.000Z"
    );
  });

  it("togliSegnoDiscesaCompleta toglie solo quello dell'utente indicato", () => {
    segnaDiscesaCompleta("u1");
    segnaDiscesaCompleta("u2");
    togliSegnoDiscesaCompleta("u1");
    expect(segnoDiscesaCompleta("u1")).toBe(false);
    expect(segnoDiscesaCompleta("u2")).toBe(true);
  });
});

describe("è solo un'aggiunta: il resto del giro non cambia", () => {
  it("una tabella fallita: stesso esito, stesse tabelle non scaricate, onboarding acceso", async () => {
    server.rispostePerTabella = { pasti: SENZA_RETE };
    const nonScaricate = await scaricaTutto("u1");
    expect(nonScaricate.map((t) => t.tabella)).toEqual(["pasti"]);
    expect(leggiStatoGiri().discesa.esito).toBe("rete");
    expect(leggiStatoGiri().discesa.tabelleNonScaricate).toEqual(["pasti"]);
    // pasti non è una tabella dell'onboarding: il suo segno si accende.
    expect(discesaRiuscitaPer("u1")).toBe(true);
    expect(segnoDiscesaCompleta("u1")).toBe(false);
  });

  it("un giro riuscito: esito ok, nessuna tabella non scaricata, i due segni accesi", async () => {
    const nonScaricate = await scaricaTutto("u1");
    expect(nonScaricate).toEqual([]);
    expect(leggiStatoGiri().discesa.esito).toBe("ok");
    expect(discesaRiuscitaPer("u1")).toBe(true);
    expect(segnoDiscesaCompleta("u1")).toBe(true);
  });

  it("azzeraStatoGiri spegne quello dell'onboarding, non questo (lo tolgono Esci ed Elimina)", async () => {
    await scaricaTutto("u1");
    azzeraStatoGiri();
    expect(discesaRiuscitaPer("u1")).toBe(false);
    expect(segnoDiscesaCompleta("u1")).toBe(true);
  });
});

describe("copiaLocaleCompleta: il segno più il profilo vivo in Dexie", () => {
  it("segno e profilo vivo: completa", async () => {
    await db.profili.put(profilo("u1"));
    await scaricaTutto("u1");
    expect(await copiaLocaleCompleta("u1")).toBe(true);
  });

  it("segno acceso ma profilo assente (IndexedDB cancellato): non completa", async () => {
    await scaricaTutto("u1");
    expect(segnoDiscesaCompleta("u1")).toBe(true);
    expect(await copiaLocaleCompleta("u1")).toBe(false);
  });

  it("solo un profilo cancellato: non completa", async () => {
    await db.profili.put(profilo("u1", "2026-11-07T09:00:00.000Z"));
    await scaricaTutto("u1");
    expect(await copiaLocaleCompleta("u1")).toBe(false);
  });

  it("senza segno: non-scaricata, anche con il profilo vivo in Dexie", async () => {
    expect(await statoCopiaLocale("u1")).toBe("non-scaricata");
    await db.profili.put(profilo("u1"));
    expect(await statoCopiaLocale("u1")).toBe("non-scaricata");
  });

  it("segno e profilo vivo: completa", async () => {
    segnaDiscesaCompleta("u1");
    await db.profili.put(profilo("u1"));
    expect(await statoCopiaLocale("u1")).toBe("completa");
  });

  it("segno ma nessuna riga viva dell'utente (Safari ha svuotato IndexedDB): non-scaricata, non senza-profilo", async () => {
    segnaDiscesaCompleta("u1");
    expect(await statoCopiaLocale("u1")).toBe("non-scaricata");
    // Righe cancellate dell'utente e righe vive di un altro utente non
    // contano: la copia di u1 è comunque vuota.
    await db.profili.put(profilo("u1", "2026-11-07T09:00:00.000Z"));
    await db.pasti.put(pasto("u1", "2026-11-07T09:00:00.000Z"));
    await db.profili.put(profilo("u2"));
    await db.pasti.put(pasto("u2"));
    expect(await statoCopiaLocale("u1")).toBe("non-scaricata");
  });

  it("segno, niente profilo, ma altre righe vive dell'utente: senza-profilo", async () => {
    segnaDiscesaCompleta("u1");
    await db.pasti.put(pasto("u1"));
    expect(await statoCopiaLocale("u1")).toBe("senza-profilo");
    // Anche con un profilo solo cancellato.
    await db.profili.put(profilo("u1", "2026-11-07T09:00:00.000Z"));
    expect(await statoCopiaLocale("u1")).toBe("senza-profilo");
  });

  it("senza-profilo vale per una riga viva in qualunque tabella di TABELLE_DISCESA", async () => {
    for (const { nome, tabella } of TABELLE_DISCESA) {
      if (nome === "profili") continue;
      for (const { tabella: t } of TABELLE_DISCESA) await t.clear();
      window.localStorage.clear();
      segnaDiscesaCompleta("u1");
      await tabella.put({
        id: crypto.randomUUID(),
        user_id: "u1",
        updated_at: "2026-11-07T08:00:00.000Z",
        deleted_at: null,
      });
      expect(await statoCopiaLocale("u1"), nome).toBe("senza-profilo");
    }
  });

  it("le tabelle guardate sono esattamente quelle di TABELLE_DISCESA", () => {
    expect(Object.keys(TABELLE_DATI).sort()).toEqual(TABELLE_DISCESA.map((t) => t.nome).sort());
  });

  it("profilo vivo ma niente segno: non completa", async () => {
    await db.profili.put(profilo("u1"));
    expect(await copiaLocaleCompleta("u1")).toBe(false);
  });

  it("utente diverso: il segno e il profilo di u1 non valgono per u2", async () => {
    await db.profili.put(profilo("u1"));
    await scaricaTutto("u1");
    expect(await copiaLocaleCompleta("u2")).toBe(false);

    // u2 con il suo profilo ma senza il suo segno: ancora no.
    await db.profili.put(profilo("u2"));
    expect(await copiaLocaleCompleta("u2")).toBe(false);

    // u2 con il suo segno ma il profilo vivo è solo di u1: no.
    await db.profili.where("user_id").equals("u2").delete();
    segnaDiscesaCompleta("u2");
    expect(await copiaLocaleCompleta("u2")).toBe(false);
  });
});
