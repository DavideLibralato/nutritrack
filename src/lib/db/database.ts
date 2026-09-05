// Database locale (IndexedDB), fonte di verità dell'app (PUNTO_DI_PARTENZA.md,
// sezione 9.2). Dexie è una libreria che rende IndexedDB — l'archivio del
// browser che sopravvive a refresh e riavvii, anche offline — comodo da usare
// come se fosse un piccolo database con tabelle e query, invece della sua API
// nativa molto più scomoda.
//
// La UI non importa mai questo file direttamente: legge e scrive sempre
// passando dal livello repository (src/lib/repository), come richiesto da
// CLAUDE.md.

import Dexie, { type Table } from "dexie";
import type {
  Profilo,
  Obiettivo,
  Pasto,
  Alimento,
  VoceDiario,
  Composizione,
  ComposizioneVoce,
  Misurazione,
  Preferito,
} from "./tipi";
import type { VoceOutbox } from "../sync/outbox";

// Table<T, string>, non EntityTable: EntityTable presuppone una chiave che
// Dexie può generare da sola (auto-increment) e quindi opzionale in
// inserimento. Da noi l'id è sempre un uuid già pronto, scritto dal client
// (sezione 4) — non c'è niente da generare in automatico sul lato Dexie.
class NutriTrackDatabase extends Dexie {
  profili!: Table<Profilo, string>;
  obiettivi!: Table<Obiettivo, string>;
  pasti!: Table<Pasto, string>;
  alimenti!: Table<Alimento, string>;
  voci_diario!: Table<VoceDiario, string>;
  composizioni!: Table<Composizione, string>;
  composizioni_voci!: Table<ComposizioneVoce, string>;
  misurazioni!: Table<Misurazione, string>;
  preferiti!: Table<Preferito, string>;

  // Coda delle mutazioni non ancora inviate a Supabase (src/lib/sync).
  outbox!: Table<VoceOutbox, string>;

  constructor() {
    super("nutritrack");

    // .stores() dichiara, per ogni tabella, quali campi sono indicizzati:
    // il primo è la chiave primaria, gli altri sono i campi su cui la app
    // farà ricerche/filtri veloci (es. le voci di un giorno, i pasti in
    // ordine). Un campo non elencato qui esiste comunque sulla riga, si può
    // solo leggere e non usare come filtro rapido — per il volume di dati di
    // un diario personale non serve indicizzare tutto.
    this.version(1).stores({
      profili: "id, user_id, deleted_at",
      obiettivi: "id, user_id, valido_dal, deleted_at",
      pasti: "id, user_id, ordine, deleted_at",
      alimenti: "id, user_id, nome, barcode, verificato, deleted_at",
      voci_diario: "id, user_id, data, pasto_id, gruppo_id, deleted_at",
      composizioni: "id, user_id, tipo, deleted_at",
      composizioni_voci: "id, user_id, composizione_id, deleted_at",
      misurazioni: "id, user_id, tipo, data, deleted_at",
      preferiti: "id, user_id, alimento_id, deleted_at",
      outbox: "id, tabella, creato_il",
    });
  }
}

export const db = new NutriTrackDatabase();
