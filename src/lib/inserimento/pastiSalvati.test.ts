// pastoGiaSalvato è un confronto per multiset (voce 3, correzioni al pezzo
// "pasti salvati"): ordine irrilevante, ma i duplicati contano — un bug qui
// (es. un confronto che collassa le righe uguali come farebbe un Set) non fa
// rumore: la stella del segnalibro resta semplicemente sbagliata finché
// qualcuno non se ne accorge per caso.

import { describe, it, expect } from "vitest";
import { pastoGiaSalvato, composizioniCorrispondenti } from "./pastiSalvati";
import type { Composizione, ComposizioneVoce } from "../db/tipi";

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

    expect(pastoGiaSalvato(vociPasto, composizioni, composizioniVoci)).toBe(true);
  });

  it("non corrisponde con una quantità anche di poco diversa", () => {
    const composizioni = [composizione("c1", "Colazione standard")];
    const composizioniVoci = [voce("c1", "yogurt", 250, 0)];
    const vociPasto = [{ alimento_id: "yogurt", quantita_g: 251 }];

    expect(pastoGiaSalvato(vociPasto, composizioni, composizioniVoci)).toBe(false);
  });

  it("non corrisponde se manca o avanza un alimento", () => {
    const composizioni = [composizione("c1", "Colazione standard")];
    const composizioniVoci = [
      voce("c1", "yogurt", 250, 0),
      voce("c1", "avena", 40, 1),
    ];
    const vociPasto = [{ alimento_id: "yogurt", quantita_g: 250 }];

    expect(pastoGiaSalvato(vociPasto, composizioni, composizioniVoci)).toBe(false);
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

    expect(pastoGiaSalvato(vociPasto, composizioni, composizioniVoci)).toBe(false);
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

    expect(pastoGiaSalvato(vociPasto, composizioni, composizioniVoci)).toBe(true);
  });

  it("ignora le composizioni di tipo diverso da pasto_salvato", () => {
    const composizioni: Composizione[] = [
      { ...composizione("c1", "Una ricetta"), tipo: "ricetta" },
    ];
    const composizioniVoci = [voce("c1", "yogurt", 250, 0)];
    const vociPasto = [{ alimento_id: "yogurt", quantita_g: 250 }];

    expect(pastoGiaSalvato(vociPasto, composizioni, composizioniVoci)).toBe(false);
  });

  it("pasto vuoto → non corrisponde mai", () => {
    const composizioni = [composizione("c1", "Colazione standard")];
    const composizioniVoci = [voce("c1", "yogurt", 250, 0)];

    expect(pastoGiaSalvato([], composizioni, composizioniVoci)).toBe(false);
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

    expect(pastoGiaSalvato(vociPasto, composizioni, composizioniVoci)).toBe(true);
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

    expect(composizioniCorrispondenti(vociPasto, composizioni, composizioniVoci)).toEqual(
      expect.arrayContaining(["c1", "c2"])
    );
    expect(composizioniCorrispondenti(vociPasto, composizioni, composizioniVoci)).toHaveLength(2);
  });

  it("array vuoto quando nessuna composizione corrisponde", () => {
    const composizioni = [composizione("c1", "Colazione A")];
    const composizioniVoci = [voce("c1", "yogurt", 250, 0)];
    const vociPasto = [{ alimento_id: "pasta", quantita_g: 100 }];

    expect(composizioniCorrispondenti(vociPasto, composizioni, composizioniVoci)).toEqual([]);
  });
});
