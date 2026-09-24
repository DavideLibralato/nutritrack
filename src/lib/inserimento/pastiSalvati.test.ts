// pastoGiaSalvato è un confronto per multiset (voce 3, correzioni al pezzo
// "pasti salvati"): ordine irrilevante, ma i duplicati contano — un bug qui
// (es. un confronto che collassa le righe uguali come farebbe un Set) non fa
// rumore: la stella del segnalibro resta semplicemente sbagliata finché
// qualcuno non se ne accorge per caso.

import { describe, it, expect } from "vitest";
import { pastoGiaSalvato, composizioniCorrispondenti, pastiSalvati } from "./pastiSalvati";
import type { Alimento, Composizione, ComposizioneVoce } from "../db/tipi";

function composizione(id: string, nome: string): Composizione {
  return {
    id,
    user_id: "u1",
    updated_at: "2026-09-13T00:00:00.000Z",
    deleted_at: null,
    nome,
    tipo: "pasto_salvato",
    alimento_id: null,
  };
}

function voce(
  composizioneId: string,
  alimentoId: string,
  quantitaG: number,
  ordine: number
): ComposizioneVoce {
  return {
    id: `${composizioneId}-${ordine}`,
    user_id: "u1",
    updated_at: "2026-09-13T00:00:00.000Z",
    deleted_at: null,
    composizione_id: composizioneId,
    alimento_id: alimentoId,
    quantita_g: quantitaG,
    ordine,
  };
}

function alimento(id: string): Alimento {
  return {
    id,
    user_id: "u1",
    updated_at: "2026-09-13T00:00:00.000Z",
    deleted_at: null,
    nome: id,
    marca: null,
    barcode: null,
    kcal_100g: 100,
    proteine_100g: 5,
    carboidrati_100g: 10,
    grassi_100g: 2,
    zuccheri_100g: null,
    fibre_100g: null,
    saturi_100g: null,
    sale_100g: null,
    porzione_default_g: 100,
    fonte: "manuale",
    verificato: false,
  };
}

// Catalogo con tutti gli alimenti usati nei test qui sotto — nessuno
// cancellato, salvo dove un test lo toglie apposta per simulare la
// cancellazione.
const catalogo = [
  alimento("yogurt"),
  alimento("avena"),
  alimento("pane"),
  alimento("pasta"),
];

describe("pastoGiaSalvato", () => {
  it("corrisponde quando alimenti e quantità sono gli stessi, in ordine diverso", () => {
    const composizioni = [composizione("c1", "Colazione standard")];
    const composizioniVoci = [
      voce("c1", "yogurt", 250, 0),
      voce("c1", "avena", 40, 1),
    ];
    const vociPasto = [
      { alimento_id: "avena", quantita_g: 40 },
      { alimento_id: "yogurt", quantita_g: 250 },
    ];

    expect(pastoGiaSalvato(vociPasto, catalogo, composizioni, composizioniVoci)).toBe(true);
  });

  it("non corrisponde con una quantità anche di poco diversa", () => {
    const composizioni = [composizione("c1", "Colazione standard")];
    const composizioniVoci = [voce("c1", "yogurt", 250, 0)];
    const vociPasto = [{ alimento_id: "yogurt", quantita_g: 251 }];

    expect(pastoGiaSalvato(vociPasto, catalogo, composizioni, composizioniVoci)).toBe(false);
  });

  it("non corrisponde se manca o avanza un alimento", () => {
    const composizioni = [composizione("c1", "Colazione standard")];
    const composizioniVoci = [
      voce("c1", "yogurt", 250, 0),
      voce("c1", "avena", 40, 1),
    ];
    const vociPasto = [{ alimento_id: "yogurt", quantita_g: 250 }];

    expect(pastoGiaSalvato(vociPasto, catalogo, composizioni, composizioniVoci)).toBe(false);
  });

  it("distingue le ripetizioni: stesso alimento due volte non è lo stesso di due alimenti diversi", () => {
    const composizioni = [composizione("c1", "Doppio")];
    // La composizione ha due volte "yogurt" da 250 g.
    const composizioniVoci = [
      voce("c1", "yogurt", 250, 0),
      voce("c1", "yogurt", 250, 1),
    ];
    // Il pasto di oggi ha invece un alimento diverso, stesso numero di righe.
    const vociPasto = [
      { alimento_id: "yogurt", quantita_g: 250 },
      { alimento_id: "avena", quantita_g: 250 },
    ];

    expect(pastoGiaSalvato(vociPasto, catalogo, composizioni, composizioniVoci)).toBe(false);
  });

  it("corrisponde anche con ripetizioni identiche su entrambi i lati", () => {
    const composizioni = [composizione("c1", "Doppio yogurt")];
    const composizioniVoci = [
      voce("c1", "yogurt", 250, 0),
      voce("c1", "yogurt", 250, 1),
    ];
    const vociPasto = [
      { alimento_id: "yogurt", quantita_g: 250 },
      { alimento_id: "yogurt", quantita_g: 250 },
    ];

    expect(pastoGiaSalvato(vociPasto, catalogo, composizioni, composizioniVoci)).toBe(true);
  });

  it("ignora le composizioni di tipo diverso da pasto_salvato", () => {
    const composizioni: Composizione[] = [
      { ...composizione("c1", "Una ricetta"), tipo: "ricetta" },
    ];
    const composizioniVoci = [voce("c1", "yogurt", 250, 0)];
    const vociPasto = [{ alimento_id: "yogurt", quantita_g: 250 }];

    expect(pastoGiaSalvato(vociPasto, catalogo, composizioni, composizioniVoci)).toBe(false);
  });

  it("pasto vuoto → non corrisponde mai", () => {
    const composizioni = [composizione("c1", "Colazione standard")];
    const composizioniVoci = [voce("c1", "yogurt", 250, 0)];

    expect(pastoGiaSalvato([], catalogo, composizioni, composizioniVoci)).toBe(false);
  });

  it("corrisponde se almeno una fra più composizioni coincide", () => {
    const composizioni = [
      composizione("c1", "Colazione A"),
      composizione("c2", "Colazione B"),
    ];
    const composizioniVoci = [
      voce("c1", "pane", 50, 0),
      voce("c2", "yogurt", 250, 0),
    ];
    const vociPasto = [{ alimento_id: "yogurt", quantita_g: 250 }];

    expect(pastoGiaSalvato(vociPasto, catalogo, composizioni, composizioniVoci)).toBe(true);
  });
});

describe("composizioniCorrispondenti", () => {
  // È la funzione da cui dipende "togli dai preferiti": se restituisse solo
  // il primo id invece di tutti, ripremere la stella su un pasto salvato due
  // volte con nomi diversi ne rimuoverebbe uno solo — la stella resterebbe
  // piena com'era prima, sembrando che l'azione non abbia fatto niente.
  it("restituisce TUTTI gli id corrispondenti, non solo il primo", () => {
    const composizioni = [
      composizione("c1", "Colazione A"),
      composizione("c2", "Colazione B"),
      composizione("c3", "Pranzo diverso"),
    ];
    const composizioniVoci = [
      voce("c1", "yogurt", 250, 0),
      voce("c2", "yogurt", 250, 0),
      voce("c3", "pasta", 100, 0),
    ];
    const vociPasto = [{ alimento_id: "yogurt", quantita_g: 250 }];

    expect(
      composizioniCorrispondenti(vociPasto, catalogo, composizioni, composizioniVoci)
    ).toEqual(expect.arrayContaining(["c1", "c2"]));
    expect(
      composizioniCorrispondenti(vociPasto, catalogo, composizioni, composizioniVoci)
    ).toHaveLength(2);
  });

  it("array vuoto quando nessuna composizione corrisponde", () => {
    const composizioni = [composizione("c1", "Colazione A")];
    const composizioniVoci = [voce("c1", "yogurt", 250, 0)];
    const vociPasto = [{ alimento_id: "pasta", quantita_g: 100 }];

    expect(
      composizioniCorrispondenti(vociPasto, catalogo, composizioni, composizioniVoci)
    ).toEqual([]);
  });

  // Bug del 2026-09-24 (visto su Supabase, composizione cbd1ae1a): questa
  // funzione confrontava le voci grezze, senza escludere quelle il cui
  // alimento è stato cancellato dal catalogo, mentre pastiSalvati() le
  // escludeva già — la stessa composizione risultava "di 2 alimenti" qui e
  // "di 1" nell'elenco. Ora entrambe passano da vociValidePerComposizione,
  // quindi devono sempre concordare sul numero di alimenti.
  it("una voce con l'alimento cancellato dal catalogo non conta, in accordo con pastiSalvati()", () => {
    const catalogoConUnAlimentoCancellato = catalogo.filter((a) => a.id !== "avena");
    const composizioni = [composizione("c1", "Colazione")];
    // Nel database la composizione ha ancora 2 voci: una viva (yogurt), una
    // morta (avena, cancellato dal catalogo).
    const composizioniVoci = [
      voce("c1", "yogurt", 250, 0),
      voce("c1", "avena", 40, 1),
    ];

    // pastiSalvati(): la composizione compare con un solo alimento.
    const elenco = pastiSalvati(catalogoConUnAlimentoCancellato, composizioni, composizioniVoci);
    expect(elenco.find((p) => p.composizioneId === "c1")?.voci).toHaveLength(1);

    // Il pasto di oggi ha solo yogurt: deve corrispondere. Se il confronto
    // guardasse ancora le 2 voci grezze, non corrisponderebbe mai (2 contro
    // 1), disaccordo esattamente col numero mostrato in Preferiti.
    const vociPasto = [{ alimento_id: "yogurt", quantita_g: 250 }];
    expect(
      pastoGiaSalvato(vociPasto, catalogoConUnAlimentoCancellato, composizioni, composizioniVoci)
    ).toBe(true);
  });
});
