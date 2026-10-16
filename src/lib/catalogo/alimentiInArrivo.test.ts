// Test permanenti per il confronto degli alimenti in arrivo
// (alimentiInArrivo.ts). Un errore qui non fa rumore: un "valori identici"
// sbagliato fa chiudere con Ok una condivisione che aveva valori diversi
// (persi senza che nessuno li abbia visti), e una selezione che ammette due
// alimenti uguali ne mette due nel catalogo, contro la regola "mai due
// alimenti uguali".

import { describe, expect, it } from "vitest";
import type { Alimento, AlimentoCondiviso } from "../db/tipi";
import {
  campiDiversi,
  confrontaInArrivo,
  inCentesimi,
  righeConfronto,
  selezionaTutti,
  selezioneValida,
  spunta,
  usernameMittenti,
  valoriIdentici,
  type VoceInArrivo,
} from "./alimentiInArrivo";

const IO = "io";

const VALORI = {
  kcal_100g: 57,
  proteine_100g: 10,
  carboidrati_100g: 3.9,
  grassi_100g: 0.4,
  zuccheri_100g: null,
  fibre_100g: null,
  saturi_100g: null,
  sale_100g: null,
  porzione_default_g: 150,
};

function mio(id: string, nome: string, marca: string | null, altro: Partial<Alimento> = {}): Alimento {
  return {
    id,
    user_id: IO,
    updated_at: "2026-10-16T00:00:00.000Z",
    deleted_at: null,
    nome,
    marca,
    barcode: null,
    ...VALORI,
    fonte: "manuale",
    verificato: false,
    ...altro,
  };
}

function inArrivo(
  id: string,
  nome: string,
  marca: string | null,
  altro: Partial<AlimentoCondiviso> = {}
): AlimentoCondiviso {
  return {
    id,
    user_id: "sara",
    destinatario_id: IO,
    alimento_origine_id: `orig-${id}`,
    updated_at: "2026-10-16T00:00:00.000Z",
    deleted_at: null,
    nome,
    marca,
    barcode: null,
    ...VALORI,
    fonte: "manuale",
    stato: "in_attesa",
    risposta_il: null,
    creato_il: "2026-10-16T00:00:00.000Z",
    ...altro,
  };
}

describe("inCentesimi", () => {
  it("arrotonda a due decimali come numeric(7,2), senza l'errore della virgola mobile", () => {
    expect(inCentesimi(3.3)).toBe(330);
    expect(inCentesimi(0.29)).toBe(29); // 0.29 * 100 = 28.999999999999996
    expect(inCentesimi(380.555)).toBe(38056); // 380.555 * 100 = 38055.49999…
    expect(inCentesimi(1.005)).toBe(101);
    expect(inCentesimi(0)).toBe(0);
    expect(inCentesimi(null)).toBeNull();
  });
});

describe("valoriIdentici e campiDiversi", () => {
  it("uguali quando i nove valori coincidono in centesimi", () => {
    expect(valoriIdentici(mio("m", "Yogurt", null), inArrivo("a", "Yogurt", null))).toBe(true);
    // 3.9 contro 3.90 scritto in un altro modo: stesso valore.
    expect(
      valoriIdentici(mio("m", "Y", null, { carboidrati_100g: 3.9 }), inArrivo("a", "Y", null, { carboidrati_100g: 3.900000001 }))
    ).toBe(true);
  });

  it("una differenza al secondo decimale conta", () => {
    expect(campiDiversi(mio("m", "Y", null, { grassi_100g: 3.3 }), inArrivo("a", "Y", null, { grassi_100g: 3.31 }))).toEqual([
      "grassi_100g",
    ]);
  });

  it("contano anche zuccheri, fibre, saturi, sale e la porzione, non solo i quattro valori", () => {
    expect(campiDiversi(mio("m", "Y", null), inArrivo("a", "Y", null, { zuccheri_100g: 4 }))).toEqual(["zuccheri_100g"]);
    expect(campiDiversi(mio("m", "Y", null), inArrivo("a", "Y", null, { sale_100g: 0.1 }))).toEqual(["sale_100g"]);
    expect(campiDiversi(mio("m", "Y", null), inArrivo("a", "Y", null, { porzione_default_g: 170 }))).toEqual([
      "porzione_default_g",
    ]);
  });

  it("un valore assente non è uguale a 0", () => {
    expect(valoriIdentici(mio("m", "Y", null, { fibre_100g: null }), inArrivo("a", "Y", null, { fibre_100g: 0 }))).toBe(false);
    expect(valoriIdentici(mio("m", "Y", null, { fibre_100g: 0 }), inArrivo("a", "Y", null, { fibre_100g: 0 }))).toBe(true);
  });

  it("nome, marca, barcode e fonte non contano", () => {
    expect(
      valoriIdentici(
        mio("m", "Yogurt", "Fage", { barcode: "123", fonte: "etichetta" }),
        inArrivo("a", "YOGURT", "fage", { barcode: null, fonte: "ricetta" })
      )
    ).toBe(true);
  });
});

describe("righeConfronto", () => {
  it("le cinque righe fisse, nell'ordine, con i diversi segnati", () => {
    const righe = righeConfronto(
      mio("m", "Y", null),
      inArrivo("a", "Y", null, { kcal_100g: 59, grassi_100g: 0.2, carboidrati_100g: 3.6, porzione_default_g: 170 })
    );
    expect(righe.map((r) => [r.campo, r.mio, r.inArrivo, r.diverso])).toEqual([
      ["kcal_100g", 57, 59, true],
      ["grassi_100g", 0.4, 0.2, true],
      ["carboidrati_100g", 3.9, 3.6, true],
      ["proteine_100g", 10, 10, false],
      ["porzione_default_g", 150, 170, true],
    ]);
  });

  it("zuccheri, fibre, saturi e sale compaiono sotto solo quando sono diversi", () => {
    const righe = righeConfronto(
      mio("m", "Y", null, { zuccheri_100g: 3, sale_100g: 0.1, fibre_100g: 1 }),
      inArrivo("a", "Y", null, { zuccheri_100g: 3, sale_100g: 0.2, fibre_100g: null, saturi_100g: null })
    );
    expect(righe.map((r) => r.campo)).toEqual([
      "kcal_100g",
      "grassi_100g",
      "carboidrati_100g",
      "proteine_100g",
      "porzione_default_g",
      "fibre_100g",
      "sale_100g",
    ]);
    expect(righe.slice(5).every((r) => r.diverso)).toBe(true);
  });
});

describe("confrontaInArrivo", () => {
  const catalogo = [
    mio("yogurt", "Yogurt greco 0%", "Fage"),
    mio("banana", "Banana", null),
    mio("cancellato", "Pane", "Mulino", { deleted_at: "2026-10-15T00:00:00.000Z" }),
    mio("altrui", "Riso", null, { user_id: "altro" }),
    mio("comune", "Mela", null, { user_id: null }),
  ];

  it("nuovo quando nel catalogo non c'è lo stesso nome con la stessa marca", () => {
    expect(confrontaInArrivo(catalogo, inArrivo("a", "Yogurt greco 0%", "Müller"), IO)).toEqual({ tipo: "nuovo" });
    expect(confrontaInArrivo(catalogo, inArrivo("a", "Hummus", null), IO)).toEqual({ tipo: "nuovo" });
  });

  it("i cancellati, gli alimenti di altri e il catalogo comune non sono doppioni", () => {
    expect(confrontaInArrivo(catalogo, inArrivo("a", "Pane", "Mulino"), IO).tipo).toBe("nuovo");
    expect(confrontaInArrivo(catalogo, inArrivo("a", "Riso", null), IO).tipo).toBe("nuovo");
    expect(confrontaInArrivo(catalogo, inArrivo("a", "Mela", null), IO).tipo).toBe("nuovo");
  });

  it("uguale: stesso nome e marca (maiuscole, accenti e spazi indifferenti) e gli stessi valori", () => {
    const c = confrontaInArrivo(catalogo, inArrivo("a", "  yogurt GRECO 0% ", "fage"), IO);
    expect(c.tipo).toBe("uguale");
    if (c.tipo === "uguale") expect(c.mio.id).toBe("yogurt");
  });

  it("due senza marca con lo stesso nome sono doppioni", () => {
    expect(confrontaInArrivo(catalogo, inArrivo("a", "Banana", null), IO).tipo).toBe("uguale");
    // Marca vuota o di soli spazi vale come nessuna marca.
    expect(confrontaInArrivo(catalogo, inArrivo("a", "Banana", "  "), IO).tipo).toBe("uguale");
  });

  it("diverso: il proprio alimento, le righe del confronto e se si può aggiornare", () => {
    const c = confrontaInArrivo(catalogo, inArrivo("a", "Yogurt greco 0%", "Fage", { kcal_100g: 59 }), IO);
    expect(c.tipo).toBe("diverso");
    if (c.tipo !== "diverso") return;
    expect(c.mio.id).toBe("yogurt");
    expect(c.modificabile).toBe(true);
    expect(c.righe.find((r) => r.campo === "kcal_100g")?.diverso).toBe(true);
  });

  it("un doppione verificato non si aggiorna: resta solo Tieni i miei", () => {
    const verificato = [mio("v", "Latte", null, { verificato: true })];
    const c = confrontaInArrivo(verificato, inArrivo("a", "Latte", null, { kcal_100g: 64 }), IO);
    expect(c.tipo === "diverso" && c.modificabile).toBe(false);
  });
});

describe("usernameMittenti", () => {
  it("uno per mittente, nell'ordine dell'elenco, null se il nome manca", () => {
    const righe = [
      inArrivo("a", "Pane", null, { user_id: "sara" }),
      inArrivo("b", "Skyr", null, { user_id: "paolo" }),
      inArrivo("c", "Hummus", null, { user_id: "sara" }),
      inArrivo("d", "Riso", null, { user_id: "senza_nome" }),
    ];
    expect(usernameMittenti(righe, { sara: "sara_c", paolo: "paolo_a" })).toEqual(["sara_c", "paolo_a", null]);
  });
});

describe("selezione multipla nel foglio", () => {
  function voce(riga: AlimentoCondiviso, tipo: "nuovo" | "uguale" = "nuovo"): VoceInArrivo {
    return {
      riga,
      confronto: tipo === "nuovo" ? { tipo } : { tipo, mio: mio("m", riga.nome, riga.marca) },
    };
  }
  const voci = [
    voce(inArrivo("pane-sara", "Pane", "Mulino")),
    voce(inArrivo("hummus", "Hummus", null)),
    voce(inArrivo("pane-paolo", "PANE", "mulino", { user_id: "paolo" })),
    voce(inArrivo("tonno", "Tonno", "Rio Mare"), "uguale"),
  ];

  it("spunta e toglie la spunta", () => {
    const una = spunta(new Set(), voci, "hummus");
    expect([...una]).toEqual(["hummus"]);
    expect([...spunta(una, voci, "hummus")]).toEqual([]);
  });

  it("i doppioni e gli uguali non si spuntano", () => {
    const prima = new Set<string>();
    expect(spunta(prima, voci, "tonno")).toBe(prima);
    expect(spunta(prima, voci, "inesistente")).toBe(prima);
  });

  it("due in arrivo con lo stesso nome e marca: la spunta passa da uno all'altro, mai tutti e due", () => {
    const sara = spunta(new Set(["hummus"]), voci, "pane-sara");
    const paolo = spunta(sara, voci, "pane-paolo");
    expect([...paolo].sort()).toEqual(["hummus", "pane-paolo"]);
  });

  it("Seleziona tutti: solo i selezionabili, uno per nome e marca (il primo dell'elenco)", () => {
    expect([...selezionaTutti(voci)].sort()).toEqual(["hummus", "pane-sara"]);
  });

  it("dopo una rilettura restano solo gli id ancora selezionabili", () => {
    const dopo = [voce(inArrivo("hummus", "Hummus", null)), voce(inArrivo("pane-paolo", "Pane", "Mulino"), "uguale")];
    expect([...selezioneValida(new Set(["hummus", "pane-paolo", "sparito"]), dopo)]).toEqual(["hummus"]);
  });
});
