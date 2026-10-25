// I campi dell'onboarding che ripartono da un valore salvato (passo 2
// riaperto con Indietro o dopo la chiusura dell'app): con la virgola, come
// in Profilo. Un "172.5" si rileggeva giusto ma si vedeva sbagliato; un Avanti
// senza toccare deve trovare "Dati personali" non modificato, così non
// riscrive il profilo.

import { describe, it, expect, vi } from "vitest";
import {
  obiettivoCompleto,
  pesoDaRegistrare,
  pesoIniziale,
  salvaObiettivo,
  suDiTeIniziale,
} from "./passiOnboarding";
import { modifiche, numeroDaCampo, valoriDaDati } from "../profilo/salvataggioProfilo";
import { db } from "../db/database";
import type { Misurazione, Profilo } from "../db/tipi";
import { TIPO_GIORNO_ALLENAMENTO, TIPO_GIORNO_NORMALE } from "../db/tipi";

// Il repository prova subito a inviare l'outbox a Supabase: qui la rete
// "non c'è", come in salvataggioProfilo.test.ts.
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  }),
}));

const PROFILO: Profilo = {
  id: "profilo-1",
  user_id: "u1",
  updated_at: "2026-10-17T10:00:00.000Z",
  deleted_at: null,
  nome: null,
  sesso: "femmina",
  data_nascita: "1990-01-10",
  altezza_cm: 172.5,
  livello_attivita: "moderato",
  differenzia_giorni: false,
  giorni_allenamento_default: [],
};

describe("suDiTeIniziale", () => {
  it("l'altezza salvata si apre con la virgola e si rilegge uguale", () => {
    const valori = suDiTeIniziale(PROFILO);
    expect(valori.altezzaCm).toBe("172,5");
    expect(numeroDaCampo(valori.altezzaCm)).toBe(172.5);
    expect(suDiTeIniziale({ ...PROFILO, altezza_cm: 180 }).altezzaCm).toBe("180");
  });

  it("Avanti senza toccare: «Dati personali» non risulta modificato", () => {
    const caricati = valoriDaDati(PROFILO, null, []);
    const valori = suDiTeIniziale(PROFILO);
    // Lo stesso modulo che costruisce salvaSuDiTe.
    const attuali = { ...caricati, datiPersonali: { ...valori, sesso: valori.sesso! } };
    expect(modifiche(caricati, attuali).datiPersonali).toBe(false);
  });
});

describe("pesoIniziale", () => {
  it("la pesata di oggi con la virgola, senza zeri inutili", () => {
    const pesata = (valore: number): Misurazione => ({
      id: "m1",
      user_id: "u1",
      updated_at: "2026-10-17T10:00:00.000Z",
      deleted_at: null,
      tipo: "peso",
      data: "2026-10-17",
      valore,
      unita: "kg",
    });
    expect(pesoIniziale([pesata(78.4)], "2026-10-17")).toBe("78,4");
    expect(pesoIniziale([pesata(78)], "2026-10-17")).toBe("78");
  });
});

describe("pesoDaRegistrare e peso obiettivo", () => {
  it("la pesata del passo 3 arrotondata a un decimale prima di scrivere", () => {
    expect(pesoDaRegistrare("78,46")).toBe(78.5);
    expect(pesoDaRegistrare("78,44")).toBe(78.4);
    expect(pesoDaRegistrare("78")).toBe(78);
  });

  it("un peso che arrotondato fa 0 non vale, né come pesata né come obiettivo", () => {
    expect(pesoDaRegistrare("0,04")).toBeNull();
    expect(obiettivoCompleto("dimagrire", "0,04")).toBe(false);
    expect(obiettivoCompleto("dimagrire", "72,55")).toBe(true);
  });
});

// Difetto del 25/10 (creaPeriodo in salvataggioProfilo.ts): al passo 5 i
// target di allenamento non si vedono. Con i giorni differenziati già
// accesi nel profilo (accesi in Impostazioni dopo "Lo faccio dopo"), "Inizia
// a usare Libra" scriveva la riga "allenamento" con NaN. Ora copia il
// normale appena scelto.
describe("salvaObiettivo con i giorni differenziati già accesi", () => {
  it("la riga «allenamento» nasce uguale al target normale", async () => {
    await Promise.all([db.profili.clear(), db.obiettivi.clear(), db.obiettivi_target.clear(), db.outbox.clear()]);
    await db.profili.put({ ...PROFILO, differenzia_giorni: true, giorni_allenamento_default: ["lunedi"] });

    const esito = await salvaObiettivo("u1", {
      tipo: "dimagrire",
      pesoObiettivo: "",
      target: { kcal: "1800", grassi: "60", carboidrati: "180", proteine: "135" },
    });
    expect(esito.esito).toBe("salvato");

    const righe = await db.obiettivi_target.toArray();
    const numeri = (tipo: string) => {
      const t = righe.find((r) => r.tipo_giorno === tipo)!;
      return [t.kcal, t.proteine_g, t.carboidrati_g, t.grassi_g];
    };
    expect(numeri(TIPO_GIORNO_NORMALE)).toEqual([1800, 135, 180, 60]);
    expect(numeri(TIPO_GIORNO_ALLENAMENTO)).toEqual([1800, 135, 180, 60]);
  });
});
