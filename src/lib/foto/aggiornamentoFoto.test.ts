// Niente giri doppi dell'aggiornamento della propria foto
// (aggiornamentoFoto.ts). Errori che non fanno rumore: un ritorno in primo
// piano che fa partire due download insieme, o un giro fallito che blocca
// i tentativi per mezzo minuto. Casi fissati:
// - un giro in corso non ne fa partire un altro: stessa promessa;
// - dopo un giro riuscito, niente giri per l'intervallo minimo; poi sì;
// - un giro fallito (o un'eccezione) non conta: si riprova subito;
// - utenti diversi non si bloccano a vicenda.

import { describe, it, expect, vi } from "vitest";
import { creaAggiornatoreFoto, INTERVALLO_MINIMO_MS } from "./aggiornamentoFoto";
import type { EsitoAggiornaFoto } from "./fotoProfilo";

// Un aggiornamento finto che risponde quando lo si sblocca.
function aggiornamentoComandato() {
  const sblocchi: ((esito: EsitoAggiornaFoto) => void)[] = [];
  const aggiorna = vi.fn(() => new Promise<EsitoAggiornaFoto>((risolvi) => sblocchi.push(risolvi)));
  return { aggiorna, rispondi: (esito: EsitoAggiornaFoto) => sblocchi.shift()!(esito) };
}

describe("creaAggiornatoreFoto", () => {
  it("due ritorni in primo piano durante un giro: un solo giro, la stessa risposta", async () => {
    const { aggiorna, rispondi } = aggiornamentoComandato();
    const avvia = creaAggiornatoreFoto(aggiorna, () => 0);

    const primo = avvia("u");
    const secondo = avvia("u");
    expect(secondo).toBe(primo);
    expect(aggiorna).toHaveBeenCalledTimes(1);

    rispondi("aggiornata");
    expect(await primo).toBe("aggiornata");
    expect(await secondo).toBe("aggiornata");
  });

  it("dopo un giro riuscito, niente giri per l'intervallo minimo; scaduto, sì", async () => {
    let adesso = 1_000_000;
    const aggiorna = vi.fn(async (): Promise<EsitoAggiornaFoto> => "invariata");
    const avvia = creaAggiornatoreFoto(aggiorna, () => adesso);

    expect(await avvia("u")).toBe("invariata");
    adesso += INTERVALLO_MINIMO_MS - 1;
    expect(await avvia("u")).toBeNull();
    expect(aggiorna).toHaveBeenCalledTimes(1);

    adesso += 1;
    expect(await avvia("u")).toBe("invariata");
    expect(aggiorna).toHaveBeenCalledTimes(2);
  });

  it("un giro fallito non conta: il ritorno dopo riprova subito", async () => {
    const esiti: EsitoAggiornaFoto[] = ["non-letta", "non-scaricata", "aggiornata"];
    const aggiorna = vi.fn(async () => esiti.shift()!);
    const avvia = creaAggiornatoreFoto(aggiorna, () => 0);

    expect(await avvia("u")).toBe("non-letta");
    expect(await avvia("u")).toBe("non-scaricata");
    expect(await avvia("u")).toBe("aggiornata");
    expect(await avvia("u")).toBeNull();
    expect(aggiorna).toHaveBeenCalledTimes(3);
  });

  it("un'eccezione vale come giro fallito, senza bloccare i successivi", async () => {
    let lancia = true;
    const aggiorna = vi.fn(async (): Promise<EsitoAggiornaFoto> => {
      if (lancia) throw new Error("rotto");
      return "aggiornata";
    });
    const avvia = creaAggiornatoreFoto(aggiorna, () => 0);

    expect(await avvia("u")).toBe("non-letta");
    lancia = false;
    expect(await avvia("u")).toBe("aggiornata");
  });

  it("utenti diversi non si bloccano a vicenda", async () => {
    const { aggiorna, rispondi } = aggiornamentoComandato();
    const avvia = creaAggiornatoreFoto(aggiorna, () => 0);

    const a = avvia("a");
    const b = avvia("b");
    expect(b).not.toBe(a);
    expect(aggiorna).toHaveBeenCalledTimes(2);
    rispondi("aggiornata");
    rispondi("nessuna");
    expect(await a).toBe("aggiornata");
    expect(await b).toBe("nessuna");
  });
});
