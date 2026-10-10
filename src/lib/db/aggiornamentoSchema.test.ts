// Checklist B.7 di CLAUDE.md, eseguita davvero: un database salvato sul
// telefono con uno schema Dexie vecchio, riaperto dall'app nuova, deve
// avere ancora tutte le sue righe, con la forma giusta. Rimandata dal 26/9
// per version(4) e version(5): sul telefono la prova non si può fare,
// perché anteprima e produzione sono indirizzi diversi, con database
// diversi. Qui IndexedDB è quello finto di fake-indexeddb
// (vitest.setup.mts), che segue le stesse regole di quello del browser.
//
// Come funziona: si apre un database con un nome suo, dichiarando SOLO lo
// schema di una versione vecchia (la copia fissa qui sotto), lo si riempie
// con righe realistiche in ogni tabella — compresa la coda outbox, l'unica
// copia di una modifica non ancora inviata — e lo si chiude. Poi lo si
// riapre con la classe vera dell'app (NutriTrackDatabase), che lo porta
// all'ultima versione come farebbe sul telefono.
//
// Le copie degli schemi sono FISSE apposta: sono quello che i telefoni
// hanno davvero salvato, e restano tali anche se un giorno database.ts
// cambiasse. Lette da database.ts, il test verificherebbe il codice contro
// se stesso. (Una modifica a una version(N) già pubblicata, vietata dalla
// regola B.1, questo test non la vede per forza: Dexie corregge da solo
// gli indici che non coincidono, con un avviso in console.)
//
// Quando nasce una version(9): si aggiunge qui SCHEMA_V8 (copia della 8
// com'è oggi), le sue righe se la forma cambia, e l'8 nel ciclo dei test.

import { describe, it, expect, vi, afterEach } from "vitest";
import Dexie from "dexie";
import { NutriTrackDatabase } from "./database";
import type { CursoreSync } from "../sync/discesa";
import type {
  Alimento,
  Composizione,
  ComposizioneVoce,
  Giorno,
  Misurazione,
  Obiettivo,
  ObiettivoTarget,
  Pasto,
  Preferito,
  Profilo,
  VoceDiario,
} from "./tipi";

// --- Gli schemi come erano sui telefoni --------------------------------------

const SCHEMA_V3: Record<string, string> = {
  profili: "id, user_id, deleted_at",
  obiettivi: "id, user_id, valido_dal, deleted_at",
  obiettivi_target: "id, user_id, obiettivo_id, tipo_giorno, deleted_at",
  giorni: "id, user_id, data, deleted_at",
  pasti: "id, user_id, ordine, deleted_at",
  alimenti: "id, user_id, nome, barcode, verificato, deleted_at",
  voci_diario: "id, user_id, data, pasto_id, gruppo_id, deleted_at",
  composizioni: "id, user_id, tipo, deleted_at",
  composizioni_voci: "id, user_id, composizione_id, deleted_at",
  misurazioni: "id, user_id, tipo, data, deleted_at",
  preferiti: "id, user_id, alimento_id, deleted_at",
  outbox: "id, tabella, creato_il",
};
// version(4): stessi indici della 3 (campo nuovo sospesa_il sull'outbox).
const SCHEMA_V4 = SCHEMA_V3;
// version(5): in più la tabella dei cursori della discesa.
const SCHEMA_V5: Record<string, string> = { ...SCHEMA_V3, sync_cursori: "id, tabella, user_id" };

// version(6): stessi indici della 5 (campi nuovi valido_dal / valido_al sui
// pasti).
const SCHEMA_V6 = SCHEMA_V5;

// version(7): stessi indici della 6 (campo nuovo eliminata_dal_cambio
// sulle voci di diario).
const SCHEMA_V7 = SCHEMA_V6;

const SCHEMI: Record<number, Record<string, string>> = {
  3: SCHEMA_V3, 4: SCHEMA_V4, 5: SCHEMA_V5, 6: SCHEMA_V6, 7: SCHEMA_V7,
};
const ULTIMA_VERSIONE = 8;

// --- Righe realistiche, come le aveva un telefono a quella versione ----------

const U = "11111111-1111-1111-1111-111111111111";
const ADESSO = "2026-09-20T20:11:00.000Z";
// Scaricata dal server: updated_at nel formato di PostgREST.
const DAL_SERVER = "2026-09-20T20:11:00.123456+00:00";

// Una riga qualsiasi: basta che abbia il suo id.
type Riga = { id: string };

function righe(versione: number): Record<string, Riga[]> {
  const profilo: Profilo = {
    id: "p-1", user_id: U, updated_at: DAL_SERVER, deleted_at: null,
    nome: null, sesso: "maschio", data_nascita: "1990-05-01", altezza_cm: 180,
    livello_attivita: "moderato", differenzia_giorni: true,
    giorni_allenamento_default: ["lunedi", "giovedi"],
  };
  const obiettivo: Obiettivo = {
    id: "o-1", user_id: U, updated_at: ADESSO, deleted_at: null,
    valido_dal: "2026-09-01", tipo: "dimagrire",
    kcal: 2200, proteine_g: 150, carboidrati_g: 230, grassi_g: 70, peso_obiettivo: 78,
  };
  const target: ObiettivoTarget = {
    id: "t-1", user_id: U, updated_at: ADESSO, deleted_at: null,
    obiettivo_id: "o-1", tipo_giorno: "allenamento",
    kcal: 2600, proteine_g: 160, carboidrati_g: 300, grassi_g: 75,
  };
  const giorno: Giorno = {
    id: "g-1", user_id: U, updated_at: ADESSO, deleted_at: null,
    data: "2026-09-19", tipo_giorno: "allenamento",
  };
  // Un pasto senza valido_dal / valido_al: com'erano tutti prima della 6.
  // Dalla 6 Pasti e orari scrive le due date sempre, anche null.
  const pranzo: Pasto = {
    id: "pasto-pranzo", user_id: U, updated_at: DAL_SERVER, deleted_at: null,
    nome: "Pranzo", ora_inizio: "12:30:00", ordine: 2,
    ...(versione >= 6 ? { valido_dal: null, valido_al: null } : {}),
  };
  // Dalla 6, una riga chiusa da "Elimina da oggi": il periodo deve restare.
  const cenaCancellata: Pasto = {
    id: "pasto-cena", user_id: U, updated_at: ADESSO, deleted_at: ADESSO,
    nome: "Cena", ora_inizio: "19:30", ordine: 4,
    ...(versione >= 6 ? { valido_dal: "2026-09-01", valido_al: "2026-09-18" } : {}),
  };
  const alimento: Alimento = {
    id: "a-1", user_id: U, updated_at: ADESSO, deleted_at: null,
    nome: "Yogurt magro", marca: "Marca", barcode: null,
    kcal_100g: 56, proteine_100g: 10, carboidrati_100g: 4, grassi_100g: 0.2,
    zuccheri_100g: 4, fibre_100g: null, saturi_100g: null, sale_100g: 0.1,
    porzione_default_g: 125, fonte: "manuale", verificato: false,
  };
  const condiviso: Alimento = { ...alimento, id: "a-condiviso", user_id: null, nome: "Mela", verificato: true };
  const voce: VoceDiario = {
    id: "v-1", user_id: U, updated_at: ADESSO, deleted_at: null,
    alimento_id: "a-1", pasto_id: "pasto-pranzo", gruppo_id: null,
    quantita_g: 125, data: "2026-09-19", creato_il: ADESSO, consumato_alle: null,
    nome_alimento: "Yogurt magro", kcal_100g: 56, proteine_100g: 10,
    carboidrati_100g: 4, grassi_100g: 0.2,
  };
  // Una voce su un pasto cancellato: la rete di sicurezza di Oggi la mostra.
  // Dalla 7 una voce cancellata da un cambio programmato ha il suo segno.
  const voceSuCena: VoceDiario = {
    ...voce, id: "v-2", pasto_id: "pasto-cena", gruppo_id: "gr-1",
    ...(versione >= 7 ? { eliminata_dal_cambio: null } : {}),
  };
  const composizione: Composizione = {
    id: "c-1", user_id: U, updated_at: ADESSO, deleted_at: null,
    nome: "Colazione standard", tipo: "pasto_salvato", alimento_id: null,
  };
  const composizioneVoce: ComposizioneVoce = {
    id: "cv-1", user_id: U, updated_at: ADESSO, deleted_at: null,
    composizione_id: "c-1", alimento_id: "a-1", quantita_g: 125, ordine: 0,
  };
  const misurazione: Misurazione = {
    id: "m-1", user_id: U, updated_at: ADESSO, deleted_at: null,
    tipo: "peso", valore: 82.4, unita: "kg", data: "2026-09-19",
  };
  const preferito: Preferito = {
    id: "pr-1", user_id: U, updated_at: ADESSO, deleted_at: null, alimento_id: "a-1",
  };

  // La coda outbox: una modifica non ancora inviata (la voce di diario) e,
  // dalla version(4), una accantonata dopo troppi tentativi. Prima della 4
  // il campo sospesa_il non esisteva proprio.
  const inAttesa = {
    id: "voci_diario:v-1", tabella: "voci_diario", record_id: "v-1", dati: voce,
    creato_il: ADESSO, tentativi: 2, ultimo_errore: "Failed to fetch",
  };
  const outbox: (Riga & Record<string, unknown>)[] =
    versione < 4
      ? [inAttesa]
      : [
          { ...inAttesa, sospesa_il: null },
          {
            id: "pasti:pasto-cena", tabella: "pasti", record_id: "pasto-cena", dati: cenaCancellata,
            creato_il: ADESSO, tentativi: 5, ultimo_errore: "violazione", sospesa_il: ADESSO,
          },
        ];

  const tabelle: Record<string, Riga[]> = {
    profili: [profilo],
    obiettivi: [obiettivo],
    obiettivi_target: [target],
    giorni: [giorno],
    pasti: [pranzo, cenaCancellata],
    alimenti: [alimento, condiviso],
    voci_diario: [voce, voceSuCena],
    composizioni: [composizione],
    composizioni_voci: [composizioneVoce],
    misurazioni: [misurazione],
    preferiti: [preferito],
    outbox,
  };
  if (versione >= 5) {
    const cursore: CursoreSync = {
      id: `pasti:${U}`, tabella: "pasti", user_id: U, ultimo_aggiornamento: DAL_SERVER,
    };
    tabelle.sync_cursori = [cursore];
  }
  return tabelle;
}

// --- Aiuti -------------------------------------------------------------------

const aperti: Dexie[] = [];
afterEach(async () => {
  for (const d of aperti.splice(0)) {
    d.close();
    await Dexie.delete(d.name);
  }
  vi.restoreAllMocks();
});

// Un database alla versione indicata, con lo schema di allora e le sue
// righe. Restituito aperto: chi lo vuole chiuso (il telefono che si
// aggiorna) lo chiude.
async function databaseVecchio(nome: string, versione: number) {
  const vecchio = new Dexie(nome);
  vecchio.version(versione).stores(SCHEMI[versione]);
  await vecchio.open();
  const contenuto = righe(versione);
  for (const [tabella, elenco] of Object.entries(contenuto)) {
    await vecchio.table(tabella).bulkPut(elenco);
  }
  aperti.push(vecchio);
  return { vecchio, contenuto };
}

function nomeNuovo() {
  return `aggiornamento-${crypto.randomUUID()}`;
}

// --- I test ------------------------------------------------------------------

describe("Aggiornamento dello schema Dexie (checklist B.7)", () => {
  for (const da of [3, 4, 5, 6, 7]) {
    it(`dalla version(${da}) all'ultima: tutte le righe, identiche, con gli indici che funzionano`, async () => {
      const nome = nomeNuovo();
      const { vecchio, contenuto } = await databaseVecchio(nome, da);
      vecchio.close();

      const nuovo = new NutriTrackDatabase(nome);
      aperti.push(nuovo);
      await nuovo.open();

      expect(nuovo.verno).toBe(ULTIMA_VERSIONE);

      // Ogni tabella: le stesse righe, campo per campo (né perse né
      // trasformate: nessuna versione ha un .upgrade che riscrive righe).
      for (const [tabella, elenco] of Object.entries(contenuto)) {
        const dopo = await nuovo.table(tabella).orderBy("id").toArray();
        const attese = [...elenco].sort((a, b) => a.id.localeCompare(b.id));
        expect(dopo, `tabella ${tabella}`).toEqual(attese);
      }
      // Le tabelle nate dopo la versione di partenza esistono, vuote.
      if (da < 5) expect(await nuovo.sync_cursori.count()).toBe(0);

      // Gli indici funzionano sulle righe vecchie.
      expect(await nuovo.voci_diario.where("pasto_id").equals("pasto-cena").count()).toBe(1);
      expect(await nuovo.voci_diario.where("data").equals("2026-09-19").count()).toBe(2);
      expect(await nuovo.pasti.where("user_id").equals(U).count()).toBe(2);
      expect(await nuovo.obiettivi.where("valido_dal").belowOrEqual("2026-09-19").count()).toBe(1);
      expect(await nuovo.outbox.orderBy("creato_il").count()).toBe(contenuto.outbox.length);

      // La forma: i campi nati dopo non ci sono, e il ripiego li legge
      // come previsto — un pasto senza date vale da sempre e per sempre,
      // una voce outbox senza sospesa_il non è accantonata, una voce senza
      // eliminata_dal_cambio non è stata cancellata da un cambio.
      const pranzo = await nuovo.pasti.get("pasto-pranzo");
      expect(pranzo).toBeDefined();
      expect(pranzo!.valido_dal ?? null).toBeNull();
      expect(pranzo!.valido_al ?? null).toBeNull();
      const inAttesa = await nuovo.outbox.get("voci_diario:v-1");
      expect(Boolean(inAttesa!.sospesa_il)).toBe(false);
      const voce = await nuovo.voci_diario.get("v-1");
      expect("eliminata_dal_cambio" in voce!).toBe(false);
      expect(voce!.eliminata_dal_cambio ?? null).toBeNull();
      // Le date dei pasti scritte alla 6 restano quelle.
      if (da >= 6) {
        expect(await nuovo.pasti.get("pasto-cena")).toMatchObject({ valido_dal: "2026-09-01", valido_al: "2026-09-18" });
      }

      // Il campo nuovo si scrive e si rilegge sulla riga vecchia.
      await nuovo.voci_diario.update("v-2", { deleted_at: ADESSO, eliminata_dal_cambio: "c-1" });
      expect(await nuovo.voci_diario.get("v-2")).toMatchObject({ deleted_at: ADESSO, eliminata_dal_cambio: "c-1" });

      // version(8): una voce outbox di prima non ha ultimo_status, e il
      // ripiego lo legge "non noto"; si scrive e si rilegge come gli altri.
      expect("ultimo_status" in inAttesa!).toBe(false);
      expect(inAttesa!.ultimo_status ?? null).toBeNull();
      await nuovo.outbox.update("voci_diario:v-1", { ultimo_status: 0, tentativi: 3 });
      expect(await nuovo.outbox.get("voci_diario:v-1")).toMatchObject({ ultimo_status: 0, tentativi: 3 });
    });
  }

  it("la version(8) apre anche con una seconda scheda ancora aperta alla version(7), che continua a funzionare", async () => {
    // Due schede dello stesso browser: quella vecchia ha ancora in memoria il
    // codice di prima (version(7)), quella nuova apre con la 8. IndexedDB
    // chiede alla vecchia di chiudersi ("versionchange"): se non lo
    // facesse, la nuova resterebbe bloccata. Dexie la chiude da solo, con
    // un avviso in console, e la riapre alla prima operazione.
    const avvisi = vi.spyOn(console, "warn").mockImplementation(() => {});
    const nome = nomeNuovo();
    const { vecchio: schedaVecchia } = await databaseVecchio(nome, 7);

    const schedaNuova = new NutriTrackDatabase(nome);
    aperti.push(schedaNuova);
    // Se la scheda vecchia la bloccasse, open() non finirebbe mai: un
    // limite di tempo trasforma il blocco in un errore leggibile.
    await Promise.race([
      schedaNuova.open(),
      new Promise((_, rifiuta) => setTimeout(() => rifiuta(new Error("version(8) bloccata")), 2000)),
    ]);
    expect(schedaNuova.verno).toBe(ULTIMA_VERSIONE);
    expect(avvisi).toHaveBeenCalledWith(expect.stringContaining("Another connection wants to upgrade"));

    // La scheda vecchia legge e scrive ancora: Dexie la riapre alla
    // versione che trova (gli indici sono gli stessi della 7).
    expect(await schedaVecchia.table("pasti").count()).toBe(2);
    await schedaVecchia.table("misurazioni").put({
      id: "m-dalla-scheda-vecchia", user_id: U, updated_at: ADESSO, deleted_at: null,
      tipo: "peso", valore: 82.1, unita: "kg", data: "2026-09-20",
    });
    expect(await schedaNuova.misurazioni.get("m-dalla-scheda-vecchia")).toBeDefined();
  });
});
