// I cambi programmati di Pasti e orari (passo 5, PUNTO_DI_PARTENZA.md,
// sezione 3, "Date future"): test permanenti. Le schede per data e i loro
// Annulla si basano solo su quello che queste funzioni riconoscono nelle
// righe di `pasti`: un errore qui mostra un cambio che non c'è (o ne
// nasconde uno vero), e l'Annulla toccherebbe le righe sbagliate.

import { describe, it, expect } from "vitest";
import type { Pasto } from "../db/tipi";
import {
  cambiProgrammati,
  dateProgrammate,
  filoDi,
  idCambio,
  limitiDaUnaData,
  schedaDi,
} from "./cambiProgrammati";

const OGGI = "2026-10-10"; // sabato

function pasto(id: string, nome: string, ora_inizio: string, ordine: number, altro: Partial<Pasto> = {}): Pasto {
  return {
    id, nome, ora_inizio, ordine, user_id: "u1",
    updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null,
    valido_dal: null, valido_al: null, ...altro,
  };
}

const COLAZIONE = pasto("colazione", "Colazione", "07:00", 0);
const CENA = pasto("cena", "Cena", "19:30", 4);

// In tutto il file, i tipi dei cambi in forma leggibile.
function riassunto(righe: Pasto[], oggi = OGGI) {
  return cambiProgrammati(righe, oggi).map(
    (c) => `${c.data} ${c.tipo}: ${c.vecchia?.nome ?? "—"} → ${c.nuova?.nome ?? "—"}`
  );
}

describe("filoDi", () => {
  const pranzo = pasto("pranzo", "Pranzo", "12:30", 2, { valido_al: "2026-10-11" });
  const pranzo1 = pasto("pranzo-1", "Pranzo 1", "12:30", 2, { valido_dal: "2026-10-12" });
  const cancellata = pasto("pranzo-x", "Pranzo X", "12:30", 2, { deleted_at: "2026-10-05T00:00:00.000Z" });
  const altroUtente = { ...pasto("altro", "Pranzo", "12:30", 2), user_id: "u2" };
  const righe = [COLAZIONE, pranzo, pranzo1, cancellata, altroUtente, CENA];

  it("le righe vive con lo stesso ordine dello stesso utente", () => {
    expect(filoDi(pranzo, righe).map((r) => r.id)).toEqual(["pranzo", "pranzo-1"]);
  });

  it("con `cancellate`, anche quelle cancellate", () => {
    expect(filoDi(pranzo, righe, { cancellate: true }).map((r) => r.id)).toEqual(["pranzo", "pranzo-1", "pranzo-x"]);
  });
});

describe("idCambio", () => {
  it("sempre lo stesso per la stessa riga e data, diverso se cambia una delle due", () => {
    expect(idCambio("pranzo", "2026-10-12")).toBe(idCambio("pranzo", "2026-10-12"));
    expect(idCambio("pranzo", "2026-10-12")).not.toBe(idCambio("pranzo", "2026-10-14"));
    expect(idCambio("pranzo", "2026-10-12")).not.toBe(idCambio("cena", "2026-10-12"));
    expect(idCambio("pranzo", "2026-10-12")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-/);
  });
});

describe("cambiProgrammati", () => {
  it("senza date future, nessun cambio (nemmeno una rinomina «da oggi» già fatta)", () => {
    const vecchio = pasto("pranzo", "Pranzo", "12:30", 2, { valido_al: "2026-10-09" });
    const nuovo = pasto("pranzo-1", "Pranzo 1", "12:30", 2, { valido_dal: OGGI });
    expect(riassunto([COLAZIONE, vecchio, nuovo, CENA])).toEqual([]);
  });

  it("rinomina: una riga finisce il giorno prima, una dello stesso filo comincia quel giorno", () => {
    const righe = [
      COLAZIONE,
      pasto("pranzo", "Pranzo", "12:30", 2, { valido_al: "2026-10-11" }),
      pasto("pranzo-1", "Pranzo 1", "14:30", 2, { valido_dal: "2026-10-12" }),
    ];
    expect(riassunto(righe)).toEqual(["2026-10-12 rinomina: Pranzo → Pranzo 1"]);
  });

  it("solo orario: stesso nome (anche con maiuscole diverse), ora diversa", () => {
    const righe = [
      pasto("pranzo", "Pranzo", "12:30:00", 2, { valido_al: "2026-10-12" }),
      pasto("pranzo-b", "pranzo", "14:30", 2, { valido_dal: "2026-10-13" }),
    ];
    expect(riassunto(righe)).toEqual(["2026-10-13 orario: Pranzo → pranzo"]);
  });

  it("stessa ora scritta in due forme (da Postgres «12:30:00»): non è un cambio d'orario", () => {
    // Nome e ora uguali non li crea nessuna scrittura; se capitano (due
    // telefoni) si mostrano come rinomina, mai come "12:30 → 12:30".
    const righe = [
      pasto("pranzo", "Pranzo", "12:30:00", 2, { valido_al: "2026-10-12" }),
      pasto("pranzo-b", "Pranzo", "12:30", 2, { valido_dal: "2026-10-13" }),
    ];
    expect(riassunto(righe)).toEqual(["2026-10-13 rinomina: Pranzo → Pranzo"]);
  });

  it("elimina: una riga che finisce da oggi in avanti senza niente dopo; anche una che finisce oggi", () => {
    const righe = [
      pasto("pranzo", "Pranzo", "12:30", 2, { valido_al: "2026-10-11" }),
      pasto("merenda", "Merenda", "16:00", 3, { valido_al: OGGI }),
      // Finita ieri: non è un cambio programmato, è già successo.
      pasto("spuntino", "Spuntino", "10:00", 1, { valido_al: "2026-10-09" }),
    ];
    expect(riassunto(righe)).toEqual([
      "2026-10-11 elimina: Merenda → —",
      "2026-10-12 elimina: Pranzo → —",
    ]);
  });

  it("nuovo: una riga che comincia dopo oggi senza niente prima nel suo filo", () => {
    expect(riassunto([COLAZIONE, pasto("merenda", "Merenda", "16:00", 7, { valido_dal: "2026-10-15" })])).toEqual([
      "2026-10-15 nuovo: — → Merenda",
    ]);
  });

  it("le righe cancellate non contano: senza la riga che continua, è un'eliminazione", () => {
    const righe = [
      pasto("pranzo", "Pranzo", "12:30", 2, { valido_al: "2026-10-11" }),
      pasto("pranzo-1", "Pranzo 1", "12:30", 2, { valido_dal: "2026-10-12", deleted_at: "2026-10-10T08:00:00.000Z" }),
    ];
    expect(riassunto(righe)).toEqual(["2026-10-12 elimina: Pranzo → —"]);
  });

  it("due cambi sullo stesso filo in date diverse, e l'ordine: per data, poi per orario", () => {
    const righe = [
      pasto("pranzo", "Pranzo", "12:30", 2, { valido_al: "2026-10-11" }),
      pasto("pranzo-1", "Pranzo 1", "12:30", 2, { valido_dal: "2026-10-12", valido_al: "2026-10-14" }),
      pasto("colazione", "Colazione", "07:00", 0, { valido_al: "2026-10-11" }),
      pasto("brunch", "Brunch", "10:30", 9, { valido_dal: "2026-10-12" }),
    ];
    expect(riassunto(righe)).toEqual([
      "2026-10-12 elimina: Colazione → —",
      "2026-10-12 nuovo: — → Brunch",
      "2026-10-12 rinomina: Pranzo → Pranzo 1",
      "2026-10-15 elimina: Pranzo 1 → —",
    ]);
    expect(dateProgrammate(righe, OGGI)).toEqual(["2026-10-12", "2026-10-15"]);
  });

  it("quando la data arriva il cambio non è più programmato: la sua scheda sparisce", () => {
    const righe = [
      pasto("pranzo", "Pranzo", "12:30", 2, { valido_al: "2026-10-11" }),
      pasto("pranzo-1", "Pranzo 1", "12:30", 2, { valido_dal: "2026-10-12", valido_al: "2026-10-14" }),
    ];
    expect(dateProgrammate(righe, "2026-10-11")).toEqual(["2026-10-12", "2026-10-15"]);
    expect(dateProgrammate(righe, "2026-10-12")).toEqual(["2026-10-15"]);
    expect(dateProgrammate(righe, "2026-10-15")).toEqual([]);
  });
});

describe("schedaDi", () => {
  const righe = [
    COLAZIONE,
    pasto("spuntino", "Spuntino", "10:00", 1, { valido_al: "2026-10-11" }),
    pasto("pranzo", "Pranzo", "12:30", 2, { valido_al: "2026-10-11" }),
    pasto("pranzo-1", "Pranzo 1", "12:30", 2, { valido_dal: "2026-10-12" }),
    // Dal 12 la Merenda passa dalle 16:00 alle 20:00: dopo la Cena.
    pasto("merenda", "Merenda", "16:00", 3, { valido_al: "2026-10-11" }),
    pasto("merenda-b", "Merenda", "20:00", 3, { valido_dal: "2026-10-12" }),
    pasto("brunch", "Brunch", "11:00", 9, { valido_dal: "2026-10-12" }),
    CENA,
  ];

  it("i pasti come saranno quel giorno, in ordine con le ore di quel giorno, con le etichette", () => {
    const scheda = schedaDi(righe, "2026-10-12", OGGI);
    expect(scheda.righe.map((r) => [r.pasto.nome, r.pasto.ora_inizio, r.etichetta, r.prima])).toEqual([
      ["Colazione", "07:00", null, null],
      ["Brunch", "11:00", "nuovo", null],
      ["Pranzo 1", "12:30", "nome nuovo", "Pranzo"],
      ["Cena", "19:30", null, null],
      ["Merenda", "20:00", "ora nuova", "16:00"],
    ]);
    expect(scheda.tolti.map((p) => p.nome)).toEqual(["Spuntino"]);
    expect(scheda.cambi.map((c) => c.tipo)).toEqual(["elimina", "nuovo", "rinomina", "orario"]);
  });

  it("una scheda più avanti mostra lo stato di quel giorno, ma solo i cambi di quella data", () => {
    const conDopo = [...righe, pasto("cena-x", "Cena tardi", "21:30", 10, { valido_dal: "2026-10-15" })];
    const scheda = schedaDi(conDopo, "2026-10-15", OGGI);
    expect(scheda.righe.find((r) => r.pasto.nome === "Pranzo 1")?.etichetta).toBeNull();
    expect(scheda.righe.find((r) => r.pasto.nome === "Cena tardi")?.etichetta).toBe("nuovo");
    expect(scheda.tolti).toEqual([]);
    expect(scheda.cambi.map((c) => c.tipo)).toEqual(["nuovo"]);
  });
});

describe("limitiDaUnaData", () => {
  it("senza cambi programmati: da domani, senza massimo", () => {
    const pranzo = pasto("pranzo", "Pranzo", "12:30", 2);
    expect(limitiDaUnaData(pranzo, [pranzo], OGGI)).toEqual({
      min: "2026-10-11", max: null, disponibile: true, cambioSuccessivo: null,
    });
  });

  it("con una rinomina programmata: fino al giorno di quel cambio, compreso (la stessa data lo modifica)", () => {
    const pranzo = pasto("pranzo", "Pranzo", "12:30", 2, { valido_al: "2026-10-13" });
    const pranzo1 = pasto("pranzo-1", "Pranzo 1", "12:30", 2, { valido_dal: "2026-10-14" });
    const limiti = limitiDaUnaData(pranzo, [pranzo, pranzo1], OGGI);
    expect(limiti).toMatchObject({ min: "2026-10-11", max: "2026-10-14", disponibile: true });
    expect(limiti.cambioSuccessivo).toMatchObject({ tipo: "rinomina", data: "2026-10-14" });
  });

  it("con un'eliminazione programmata: fino al suo ultimo giorno, dopo il pasto non c'è più", () => {
    const pranzo = pasto("pranzo", "Pranzo", "12:30", 2, { valido_al: "2026-10-13" });
    const limiti = limitiDaUnaData(pranzo, [pranzo], OGGI);
    expect(limiti).toMatchObject({ max: "2026-10-13", disponibile: true });
    expect(limiti.cambioSuccessivo).toMatchObject({ tipo: "elimina", data: "2026-10-14" });
  });

  it("un pasto che finisce oggi: nessun giorno da scegliere", () => {
    const pranzo = pasto("pranzo", "Pranzo", "12:30", 2, { valido_al: OGGI });
    expect(limitiDaUnaData(pranzo, [pranzo], OGGI)).toMatchObject({ max: OGGI, disponibile: false });
  });

  it("un pasto che finisce oggi ma continua domani con un altro nome: domani è la stessa data", () => {
    const pranzo = pasto("pranzo", "Pranzo", "12:30", 2, { valido_al: OGGI });
    const pranzo1 = pasto("pranzo-1", "Pranzo 1", "12:30", 2, { valido_dal: "2026-10-11" });
    expect(limitiDaUnaData(pranzo, [pranzo, pranzo1], OGGI)).toMatchObject({
      min: "2026-10-11", max: "2026-10-11", disponibile: true,
    });
  });
});
