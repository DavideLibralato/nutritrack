// Il conteggio della riga "Preferiti" in Impostazioni. Un
// errore qui non fa rumore: il numero sembra giusto, e solo aprendo la
// pagina si vedrebbe che non coincide con l'elenco. I tre casi sottili:
// - un alimento uscito dal catalogo resta in `preferiti` (riga viva), ma
//   non si vede da nessuna parte (regola "Alimenti cancellati");
// - un pasto salvato i cui alimenti sono tutti usciti dal catalogo esiste
//   ancora in `composizioni`, ma è invisibile (pastoSalvatoVisibile; i
//   "pasti fantasma" del 22/9);
// - due righe vive di `preferiti` per lo stesso alimento (due dispositivi
//   offline) sono un alimento solo.

import { describe, it, expect } from "vitest";
import { contaPreferiti, testoRigaPreferiti } from "./rigaPreferiti";
import type { Alimento, Composizione, ComposizioneVoce, Preferito } from "../db/tipi";

const BASE = { user_id: "u1", updated_at: "2026-10-11T00:00:00.000Z", deleted_at: null };

function alimento(id: string): Alimento {
  return {
    ...BASE,
    id,
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

function preferito(id: string, alimentoId: string): Preferito {
  return { ...BASE, id, alimento_id: alimentoId };
}

function composizione(id: string): Composizione {
  return { ...BASE, id, nome: id, tipo: "pasto_salvato", alimento_id: null };
}

function voce(composizioneId: string, alimentoId: string, ordine: number): ComposizioneVoce {
  return {
    ...BASE,
    id: `${composizioneId}-${ordine}`,
    composizione_id: composizioneId,
    alimento_id: alimentoId,
    quantita_g: 100,
    ordine,
  };
}

// "ritirato" non è nel catalogo: è stato cancellato.
const catalogo = [alimento("mela"), alimento("pane"), alimento("yogurt")];

describe("contaPreferiti", () => {
  it("non conta un alimento uscito dal catalogo", () => {
    const preferiti = [preferito("p1", "mela"), preferito("p2", "ritirato")];
    expect(contaPreferiti(catalogo, preferiti, [], [])).toEqual({ alimenti: 1, pasti: 0 });
  });

  it("conta una volta sola un alimento con due righe vive in preferiti", () => {
    const preferiti = [preferito("p1", "mela"), preferito("p2", "mela"), preferito("p3", "pane")];
    expect(contaPreferiti(catalogo, preferiti, [], [])).toEqual({ alimenti: 2, pasti: 0 });
  });

  it("non conta un pasto salvato rimasto senza alimenti validi, conta quello con almeno uno", () => {
    const composizioni = [composizione("fantasma"), composizione("colazione")];
    const composizioniVoci = [
      voce("fantasma", "ritirato", 0),
      voce("colazione", "yogurt", 0),
      voce("colazione", "ritirato", 1),
    ];
    expect(contaPreferiti(catalogo, [], composizioni, composizioniVoci)).toEqual({
      alimenti: 0,
      pasti: 1,
    });
  });

  it("non conta le ricette, che stanno nella stessa tabella", () => {
    const ricetta = { ...composizione("ragù"), tipo: "ricetta" as const };
    expect(contaPreferiti(catalogo, [], [ricetta], [voce("ragù", "pane", 0)])).toEqual({
      alimenti: 0,
      pasti: 0,
    });
  });
});

describe("testoRigaPreferiti", () => {
  it("tutti e due, con singolare e plurale", () => {
    expect(testoRigaPreferiti({ alimenti: 12, pasti: 3 })).toBe("12 alimenti · 3 pasti");
    expect(testoRigaPreferiti({ alimenti: 1, pasti: 1 })).toBe("1 alimento · 1 pasto");
  });

  it("un gruppo a zero: solo l'altro, con la sua parola", () => {
    expect(testoRigaPreferiti({ alimenti: 4, pasti: 0 })).toBe("4 alimenti");
    expect(testoRigaPreferiti({ alimenti: 1, pasti: 0 })).toBe("1 alimento");
    expect(testoRigaPreferiti({ alimenti: 0, pasti: 3 })).toBe("3 pasti");
    expect(testoRigaPreferiti({ alimenti: 0, pasti: 1 })).toBe("1 pasto");
  });

  it("nessuno dei due: «Nessuno»", () => {
    expect(testoRigaPreferiti({ alimenti: 0, pasti: 0 })).toBe("Nessuno");
  });
});
