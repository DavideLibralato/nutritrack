// I controlli di Pasti e orari (PUNTO_DI_PARTENZA.md, sezione 3, "Pasti e
// orari"): test permanenti. Sbagliare qui non fa crashare niente, lascia
// due pasti con lo stesso nome o alla stessa ora in qualche giorno, e
// l'app non saprebbe più quale proporre.

import { describe, it, expect } from "vitest";
import {
  domandaPerNome,
  erroreNome,
  erroreOra,
  ERRORE_NOME_USATO,
  ERRORE_NOME_VUOTO,
  ERRORE_ORA_VUOTA,
  normalizzaNome,
  periodiInComune,
  prossimoOrdine,
  ERRORE_GIORNI_SENZA_PASTI,
  ERRORE_UNICO_PASTO,
  iniziaOggiODopo,
  periodoCoperto,
  regoleElimina,
} from "./controlliPasti";
import type { Pasto } from "../db/tipi";

const OGGI = "2026-10-09";

function pasto(id: string, nome: string, ora_inizio: string, altro: Partial<Pasto> = {}): Pasto {
  return {
    id, nome, ora_inizio, ordine: 0, user_id: "u1",
    updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null, ...altro,
  };
}

const SEMPRE = { dal: null, al: null };

describe("periodiInComune", () => {
  it("due periodi senza limiti si toccano sempre", () => {
    expect(periodiInComune(SEMPRE, SEMPRE)).toBe(true);
  });

  it("il confine è incluso: finire il 9 e cominciare il 9 vuol dire un giorno in comune, nei due versi", () => {
    const finisce = { dal: null, al: "2026-10-09" };
    const comincia = { dal: "2026-10-09", al: null };
    expect(periodiInComune(finisce, comincia)).toBe(true);
    expect(periodiInComune(comincia, finisce)).toBe(true);
  });

  it("finire l'8 e cominciare il 9 vuol dire nessun giorno in comune, nei due versi", () => {
    const chiuso = { dal: null, al: "2026-10-08" };
    const nuovo = { dal: "2026-10-09", al: null };
    expect(periodiInComune(chiuso, nuovo)).toBe(false);
    expect(periodiInComune(nuovo, chiuso)).toBe(false);
  });

  it("un periodo dentro l'altro ha giorni in comune", () => {
    expect(periodiInComune({ dal: "2026-10-01", al: "2026-10-31" }, { dal: "2026-10-10", al: "2026-10-12" })).toBe(true);
  });
});

describe("normalizzaNome", () => {
  it("toglie gli spazi ai bordi e riduce quelli doppi", () => {
    expect(normalizzaNome("  Pranzo   1 ")).toBe("Pranzo 1");
  });
});

describe("erroreNome", () => {
  const righe = [
    pasto("pranzo", "Pranzo", "12:30"),
    pasto("merenda-vecchia", "Merenda", "16:00", { valido_al: "2026-10-08" }),
    pasto("cancellato", "Spuntino", "10:00", { deleted_at: "2026-10-01T00:00:00.000Z" }),
  ];

  it("un nome vuoto, o fatto solo di spazi, non va", () => {
    expect(erroreNome("", SEMPRE, righe, [])).toBe(ERRORE_NOME_VUOTO);
    expect(erroreNome("   ", SEMPRE, righe, [])).toBe(ERRORE_NOME_VUOTO);
  });

  it("lo stesso nome con maiuscole o spazi diversi conta come uguale", () => {
    expect(erroreNome("pranzo", SEMPRE, righe, [])).toBe(ERRORE_NOME_USATO);
    expect(erroreNome("  PRANZO ", SEMPRE, righe, [])).toBe(ERRORE_NOME_USATO);
  });

  it("il pasto stesso non si confronta con sé: 'pranzo' → 'Pranzo' va bene", () => {
    expect(erroreNome("pranzo", SEMPRE, righe, ["pranzo"])).toBeNull();
  });

  it("un pasto chiuso ieri non blocca il suo nome da oggi, ma sì nei giorni passati", () => {
    expect(erroreNome("Merenda", { dal: OGGI, al: null }, righe, [])).toBeNull();
    expect(erroreNome("Merenda", SEMPRE, righe, [])).toBe(ERRORE_NOME_USATO);
  });

  it("un pasto cancellato non blocca niente", () => {
    expect(erroreNome("Spuntino", SEMPRE, righe, [])).toBeNull();
  });
});

describe("erroreOra", () => {
  const righe = [
    pasto("pranzo", "Pranzo", "12:30:00"),
    pasto("merenda-vecchia", "Merenda", "16:00", { valido_al: "2026-10-08" }),
    pasto("cena-futura", "Cena tardi", "21:00", { valido_dal: "2026-10-12" }),
    pasto("cancellato", "Spuntino", "10:00", { deleted_at: "2026-10-01T00:00:00.000Z" }),
  ];

  it("un'ora vuota non va", () => {
    expect(erroreOra("", SEMPRE, righe, [], OGGI)).toBe(ERRORE_ORA_VUOTA);
  });

  it("'12:30' e '12:30:00' sono la stessa ora, e il messaggio nomina il pasto", () => {
    expect(erroreOra("12:30", SEMPRE, righe, [], OGGI)).toBe("Alle 12:30 inizia già Pranzo.");
  });

  it("il pasto stesso non si confronta con sé", () => {
    expect(erroreOra("12:30", SEMPRE, righe, ["pranzo"], OGGI)).toBeNull();
  });

  it("stessa ora senza giorni in comune va bene", () => {
    expect(erroreOra("16:00", { dal: OGGI, al: null }, righe, [], OGGI)).toBeNull();
  });

  it("un pasto chiuso nel passato blocca, e il messaggio dice fino a quando c'era", () => {
    expect(erroreOra("16:00", SEMPRE, righe, [], OGGI)).toBe("Alle 16:00 iniziava già Merenda (fino all'8 ott).");
  });

  it("un pasto che comincerà più avanti blocca, e il messaggio dice da quando", () => {
    expect(erroreOra("21:00", SEMPRE, righe, [], OGGI)).toBe("Alle 21:00 inizierà Cena tardi (dal 12 ott).");
  });

  it("un pasto cancellato non blocca niente", () => {
    expect(erroreOra("10:00", SEMPRE, righe, [], OGGI)).toBeNull();
  });
});

describe("domandaPerNome", () => {
  const pranzo = pasto("pranzo", "Pranzo", "12:30");

  it("nome uguale, o diverso solo per gli spazi ai bordi: niente", () => {
    expect(domandaPerNome(pranzo, "Pranzo", OGGI)).toBe("niente");
    expect(domandaPerNome(pranzo, " Pranzo ", OGGI)).toBe("niente");
  });

  it("diverso solo nelle maiuscole: si corregge senza domanda", () => {
    expect(domandaPerNome(pranzo, "PRANZO", OGGI)).toBe("correggi");
  });

  it("un nome nuovo davvero: la domanda 'da quando'", () => {
    expect(domandaPerNome(pranzo, "Pranzo 1", OGGI)).toBe("chiedi");
    expect(domandaPerNome({ ...pranzo, valido_dal: "2026-10-01" }, "Pranzo 1", OGGI)).toBe("chiedi");
  });

  it("un pasto nato oggi, o che comincia più avanti, si corregge e basta", () => {
    expect(domandaPerNome({ ...pranzo, valido_dal: OGGI }, "Pranzo 1", OGGI)).toBe("correggi");
    expect(domandaPerNome({ ...pranzo, valido_dal: "2026-10-12" }, "Pranzo 1", OGGI)).toBe("correggi");
  });
});

describe("prossimoOrdine", () => {
  it("il più alto più uno, cancellate comprese; 0 senza righe", () => {
    expect(prossimoOrdine([])).toBe(0);
    expect(prossimoOrdine([{ ordine: 4 }, { ordine: 7 }, { ordine: 2 }])).toBe(8);
  });
});

// Passo 4, Elimina pasto: nessun giorno deve restare senza pasti, nemmeno
// nel passato (da un giorno senza pasti non si registra niente).
describe("periodoCoperto", () => {
  const sempre = pasto("sempre", "Colazione", "06:00");
  const finoAll8 = pasto("vecchio", "Pranzo", "12:30", { valido_al: "2026-10-08" });
  const dal9 = pasto("nuovo", "Pranzo 1", "12:30", { valido_dal: "2026-10-09" });
  const dal10 = pasto("dopo", "Cena", "19:30", { valido_dal: "2026-10-10" });

  it("un pasto da sempre e per sempre copre qualunque periodo", () => {
    expect(periodoCoperto(SEMPRE, [sempre])).toBe(true);
    expect(periodoCoperto({ dal: OGGI, al: null }, [sempre])).toBe(true);
  });

  it("nessun altro pasto: non coperto", () => {
    expect(periodoCoperto(SEMPRE, [])).toBe(false);
  });

  it("due pasti che si danno il cambio senza buchi coprono tutto", () => {
    expect(periodoCoperto(SEMPRE, [finoAll8, dal9])).toBe(true);
  });

  it("un buco di un giorno (fino all'8, poi dal 10): non coperto", () => {
    expect(periodoCoperto(SEMPRE, [finoAll8, dal10])).toBe(false);
    expect(periodoCoperto({ dal: "2026-10-01", al: "2026-10-08" }, [finoAll8, dal10])).toBe(true);
    expect(periodoCoperto({ dal: "2026-10-09", al: "2026-10-09" }, [finoAll8, dal10])).toBe(false);
  });

  it("un pasto che comincia più tardi non copre i giorni prima", () => {
    expect(periodoCoperto(SEMPRE, [dal9])).toBe(false);
    expect(periodoCoperto({ dal: "2026-10-09", al: null }, [dal9])).toBe(true);
  });

  it("un pasto cancellato non copre niente", () => {
    expect(periodoCoperto(SEMPRE, [{ ...sempre, deleted_at: "2026-10-01T00:00:00.000Z" }])).toBe(false);
  });
});

describe("iniziaOggiODopo", () => {
  it("vero solo se valido_dal è oggi o dopo", () => {
    expect(iniziaOggiODopo({ valido_dal: OGGI }, OGGI)).toBe(true);
    expect(iniziaOggiODopo({ valido_dal: "2026-10-12" }, OGGI)).toBe(true);
    expect(iniziaOggiODopo({ valido_dal: "2026-10-08" }, OGGI)).toBe(false);
    expect(iniziaOggiODopo({ valido_dal: null }, OGGI)).toBe(false);
    expect(iniziaOggiODopo({}, OGGI)).toBe(false);
  });
});

describe("regoleElimina", () => {
  const colazione = pasto("colazione", "Colazione", "06:00");
  const pranzo = pasto("pranzo", "Pranzo", "12:30");

  it("con un altro pasto da sempre: tutto permesso, con la domanda", () => {
    expect(regoleElimina(pranzo, [colazione, pranzo], OGGI)).toEqual({
      motivoSpento: null, senzaDomanda: false, motivoPassatiSpento: null,
    });
  });

  it("l'unico pasto valido oggi: pulsante spento", () => {
    const vecchio = pasto("vecchio", "Colazione", "06:00", { valido_al: "2026-10-08" });
    expect(regoleElimina(pranzo, [vecchio, pranzo], OGGI).motivoSpento).toBe(ERRORE_UNICO_PASTO);
    expect(regoleElimina(pranzo, [pranzo], OGGI).motivoSpento).toBe(ERRORE_UNICO_PASTO);
  });

  it("oggi c'è un altro pasto, ma nei giorni passati no: solo 'Anche nei giorni passati' è spento", () => {
    const natoOggi = pasto("brunch", "Brunch", "11:00", { valido_dal: OGGI });
    expect(regoleElimina(pranzo, [natoOggi, pranzo], OGGI)).toEqual({
      motivoSpento: null, senzaDomanda: false, motivoPassatiSpento: ERRORE_GIORNI_SENZA_PASTI,
    });
  });

  it("un pasto nato oggi si elimina senza domanda", () => {
    const natoOggi = pasto("brunch", "Brunch", "11:00", { valido_dal: OGGI });
    expect(regoleElimina(natoOggi, [colazione, natoOggi], OGGI)).toEqual({
      motivoSpento: null, senzaDomanda: true, motivoPassatiSpento: null,
    });
  });
});
