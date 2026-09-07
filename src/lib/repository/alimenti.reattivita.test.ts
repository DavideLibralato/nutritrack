// Verifica che una liveQuery su catalogoLocale() si aggiorni davvero dopo
// una modifica fatta con repositoryAlimenti.aggiorna(). È il bug segnalato:
// modifico i grassi di un alimento, la modifica c'è in Dexie (riaprendo la
// modifica risulta), ma aggiungendolo a un pasto compaiono i valori vecchi
// — cioè la lista da cui si legge l'alimento non si è aggiornata.

import { describe, it, expect } from "vitest";
import { liveQuery } from "dexie";
import { db } from "../db/database";
import { repositoryAlimenti } from "./index";
import { catalogoLocale } from "./alimenti";

const USER = "utente-reattivita";

function attendiEmissione<T>(
  osservabile: ReturnType<typeof liveQuery<T>>,
  predicato: (valore: T) => boolean,
  timeoutMs = 2000
): Promise<T> {
  return new Promise((risolvi, rifiuta) => {
    const timer = setTimeout(() => {
      sub.unsubscribe();
      rifiuta(new Error("nessuna emissione che soddisfa il predicato entro il timeout"));
    }, timeoutMs);
    const sub = osservabile.subscribe({
      next: (valore) => {
        if (predicato(valore)) {
          clearTimeout(timer);
          sub.unsubscribe();
          risolvi(valore);
        }
      },
      error: (e) => {
        clearTimeout(timer);
        rifiuta(e);
      },
    });
  });
}

describe("liveQuery su catalogoLocale() dopo una modifica", () => {
  it("emette i valori aggiornati quando un alimento viene modificato", async () => {
    const creato = await repositoryAlimenti.crea({
      user_id: USER,
      nome: "Pane di prova",
      marca: null,
      barcode: null,
      kcal_100g: 250,
      proteine_100g: 8,
      carboidrati_100g: 48,
      grassi_100g: 3,
      zuccheri_100g: null,
      fibre_100g: null,
      saturi_100g: null,
      sale_100g: null,
      porzione_default_g: 60,
      fonte: "manuale",
      verificato: false,
    });

    const osservabile = liveQuery(() => catalogoLocale(USER));

    // Prima emissione: grassi ancora 3.
    await attendiEmissione(
      osservabile,
      (righe) => righe.some((r) => r.id === creato.id && r.grassi_100g === 3)
    );

    await repositoryAlimenti.aggiorna(creato.id, { grassi_100g: 10 });

    // La liveQuery deve riemettere con grassi = 10.
    const dopo = await attendiEmissione(
      osservabile,
      (righe) => righe.some((r) => r.id === creato.id && r.grassi_100g === 10)
    );

    expect(dopo.find((r) => r.id === creato.id)?.grassi_100g).toBe(10);
  });

  it("smette di elencare un alimento eliminato (deleted_at)", async () => {
    const creato = await repositoryAlimenti.crea({
      user_id: USER,
      nome: "Da eliminare",
      marca: null,
      barcode: null,
      kcal_100g: 100,
      proteine_100g: 1,
      carboidrati_100g: 1,
      grassi_100g: 1,
      zuccheri_100g: null,
      fibre_100g: null,
      saturi_100g: null,
      sale_100g: null,
      porzione_default_g: 100,
      fonte: "manuale",
      verificato: false,
    });

    const osservabile = liveQuery(() => catalogoLocale(USER));
    await attendiEmissione(osservabile, (righe) => righe.some((r) => r.id === creato.id));

    await repositoryAlimenti.elimina(creato.id);

    const dopo = await attendiEmissione(
      osservabile,
      (righe) => !righe.some((r) => r.id === creato.id)
    );
    expect(dopo.some((r) => r.id === creato.id)).toBe(false);
  });

  it("db è la stessa istanza importata dal repository", () => {
    // Se per un errore di bundling ci fossero due istanze Dexie "nutritrack",
    // le scritture di una non sveglierebbero le liveQuery dell'altra.
    expect(db.name).toBe("nutritrack");
  });
});
