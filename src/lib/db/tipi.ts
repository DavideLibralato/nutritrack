// Tipi TypeScript per le 9 tabelle del modello dati (PUNTO_DI_PARTENZA.md, sezione 4).
//
// Nota sui nomi dei campi: sono scritti come le colonne su Supabase
// (snake_case, in italiano) e non nello stile camelCase più comune in
// TypeScript. Non è una svista: l'outbox (src/lib/sync) manda questi oggetti
// a Supabase così come sono, senza tradurre i nomi.
//
// Allineati il 6 settembre 2026 allo schema reale (query su
// information_schema.columns), dopo che un nome sbagliato su "obiettivi"
// (proteine/carboidrati/grassi invece di *_g) ha fatto fallire la sync in
// silenzio finché non abbiamo controllato la coda outbox. Se in futuro serve
// aggiungere una colonna, il controllo da fare è lo stesso: confrontare il
// tipo qui con lo schema reale, non fidarsi solo del documento.

// Campi tecnici presenti su ogni tabella (sezione 4, "Campi tecnici obbligatori").
export interface RigaBase {
  id: string; // uuid generato dal client con crypto.randomUUID()
  user_id: string | null; // null solo per le righe condivise di "alimenti"
  updated_at: string; // ISO 8601. Il valore definitivo lo scrive un trigger sul server (sezione 11)
  deleted_at: string | null; // cancellazione logica: null = riga viva
}

export type NomeTabella =
  | "profili"
  | "obiettivi"
  | "obiettivi_target"
  | "giorni"
  | "pasti"
  | "alimenti"
  | "voci_diario"
  | "composizioni"
  | "composizioni_voci"
  | "misurazioni"
  | "preferiti";

export type Sesso = "maschio" | "femmina" | "non_indicato";

export type LivelloAttivita =
  | "sedentario"
  | "leggero"
  | "moderato"
  | "attivo"
  | "molto_attivo";

export type GiornoSettimana =
  | "lunedi"
  | "martedi"
  | "mercoledi"
  | "giovedi"
  | "venerdi"
  | "sabato"
  | "domenica";

export interface Profilo extends RigaBase {
  nome: string | null; // non ancora scritto da nessuna schermata
  sesso: Sesso;
  data_nascita: string | null; // "YYYY-MM-DD"
  altezza_cm: number | null;
  // NOT NULL sul database, a differenza degli altri tre campi anagrafici:
  // la pagina Profilo deve garantire un valore prima di salvare, non può
  // mandare null qui (sezione 3: "senza di loro il fabbisogno non è
  // calcolabile" — sul livello di attività il vincolo è già nello schema).
  livello_attivita: LivelloAttivita;
  // NOT NULL con default sul database (sezione 3: "Giorni differenziati").
  // Su un profilo locale salvato prima di questa modifica il campo può non
  // esistere finché non si tocca l'interruttore — leggere sempre con `?? false`.
  differenzia_giorni: boolean;
  // Proposta, non regola (sezione 3, "Giorni normali e giorni di
  // allenamento"): i giorni non ancora classificati in `giorni` ereditano
  // questo pattern, ma resta sempre correggibile giorno per giorno.
  giorni_allenamento_default: GiornoSettimana[] | null;
}

export type TipoObiettivo = "dimagrire" | "mantenere" | "massa";

export interface Obiettivo extends RigaBase {
  valido_dal: string; // "YYYY-MM-DD": cambiare obiettivo inserisce una riga nuova, non modifica questa
  tipo: TipoObiettivo;
  // kcal/proteine_g/carboidrati_g/grassi_g restano qui per ora: sono ancora
  // l'unica cosa che profilo/page.tsx legge e scrive. obiettivi_target (sotto)
  // esiste già ed è già popolata (backfill, tipo_giorno "normale"), ma il
  // codice applicativo non la usa ancora — passaggio rimandato a un giro
  // successivo, non a questa migration.
  kcal: number;
  proteine_g: number;
  carboidrati_g: number;
  grassi_g: number;
  peso_obiettivo: number | null;
}

// I tipi di giorno non sono cablati nel codice (sezione 3, "Giorni normali e
// giorni di allenamento"): sono i set di target che l'utente ha definito in
// obiettivi_target, un terzo tipo è una riga in più, non una migration. Per
// questo TipoGiorno è "string" e non un union type chiuso — e per lo stesso
// motivo il database non ha più un CHECK sui valori ammessi (tolto insieme a
// questa modifica: un CHECK con l'elenco chiuso sarebbe la "modifica allo
// schema" che la sezione 3 dice di non dover mai fare).
//
// Regola di scrittura: tipo_giorno non si scrive mai come stringa a mano nel
// codice, solo tramite queste costanti (o un valore letto da una riga
// esistente). Senza CHECK sul database, un refuso in una stringa a mano
// creerebbe un tipo fantasma con target introvabili — con le costanti lo
// stesso errore diventa un errore di compilazione TypeScript, non un dato
// sporco su Supabase.
export type TipoGiorno = string;
export const TIPO_GIORNO_NORMALE: TipoGiorno = "normale";
export const TIPO_GIORNO_ALLENAMENTO: TipoGiorno = "allenamento";

// Target per tipo di giorno, legati a un obiettivo (sezione 4 aggiornata:
// giorni differenziati allenamento/normale). Ogni obiettivo ha una riga qui
// per tipo_giorno "normale" e, quando la UI la introdurrà, una per
// "allenamento".
export interface ObiettivoTarget extends RigaBase {
  obiettivo_id: string;
  tipo_giorno: TipoGiorno;
  kcal: number;
  proteine_g: number;
  carboidrati_g: number;
  grassi_g: number;
}

// Tabella sparsa: una riga solo per i giorni il cui tipo è stato deciso
// (prima voce del giorno, o tocco esplicito dell'utente sulla pastiglia).
// Nessuna riga per una data = giorno "normale" per convenzione applicativa,
// non per un default scritto nel database.
export interface Giorno extends RigaBase {
  data: string; // "YYYY-MM-DD"
  tipo_giorno: TipoGiorno;
}

export interface Pasto extends RigaBase {
  nome: string; // "Colazione", "Pranzo 1", ... — le fasce sono dell'utente, non fisse nel codice
  ora_inizio: string; // "HH:mm": dura fino all'inizio del pasto successivo
  ordine: number;
}

export type FonteAlimento =
  | "manuale"
  | "etichetta"
  | "barcode"
  | "off"
  | "ai"
  | "ricetta";

export interface Alimento extends RigaBase {
  nome: string;
  marca: string | null;
  barcode: string | null;
  // Valori per 100 g (sezione 9.3: la quantità è sempre in grammi).
  kcal_100g: number;
  proteine_100g: number;
  carboidrati_100g: number;
  grassi_100g: number;
  zuccheri_100g: number | null;
  fibre_100g: number | null;
  saturi_100g: number | null;
  sale_100g: number | null;
  porzione_default_g: number; // NOT NULL sul database
  fonte: FonteAlimento;
  verificato: boolean;
}

export interface VoceDiario extends RigaBase {
  alimento_id: string | null;
  pasto_id: string | null;
  gruppo_id: string | null; // righe inserite insieme da un pasto salvato/ricetta
  quantita_g: number;
  data: string; // "YYYY-MM-DD": il giorno logico (vedi PUNTO_DI_PARTENZA.md)
  creato_il: string; // ISO 8601: quando è stata scritta la riga
  consumato_alle: string | null; // ISO 8601: quando è stata mangiata

  // Copia dei valori nutrizionali dell'alimento al momento dell'inserimento:
  // se l'alimento viene corretto nel catalogo dopo, la storia non cambia.
  nome_alimento: string;
  kcal_100g: number;
  proteine_100g: number;
  carboidrati_100g: number;
  grassi_100g: number;
}

export type TipoComposizione = "pasto_salvato" | "ricetta";

export interface Composizione extends RigaBase {
  nome: string;
  tipo: TipoComposizione;
  // Valorizzato solo per tipo "ricetta": punta alla riga in alimenti con i
  // valori nutrizionali calcolati dagli ingredienti (sezione 4).
  alimento_id: string | null;
}

export interface ComposizioneVoce extends RigaBase {
  composizione_id: string;
  alimento_id: string;
  quantita_g: number;
  ordine: number;
}

export interface Misurazione extends RigaBase {
  tipo: string; // "peso" | "vita" | "fianchi" | ... — elenco aperto (sezione 4, categoria 2)
  valore: number;
  unita: string; // "kg", "cm", ...
  data: string; // "YYYY-MM-DD"
}

export interface Preferito extends RigaBase {
  alimento_id: string;
}
