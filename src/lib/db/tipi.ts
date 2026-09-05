// Tipi TypeScript per le 9 tabelle del modello dati (PUNTO_DI_PARTENZA.md, sezione 4).
//
// Nota sui nomi dei campi: sono scritti come le colonne su Supabase
// (snake_case, in italiano) e non nello stile camelCase più comune in
// TypeScript. Non è una svista: l'outbox (src/lib/sync) manda questi oggetti
// a Supabase così come sono, senza tradurre i nomi. Se in futuro un nome qui
// non corrisponde esattamente alla colonna reale sul database, il sync di
// quella tabella fallisce con un errore chiaro finché non si allinea il nome
// — è un controllo da fare quando l'outbox verrà collegato per davvero
// (serve un utente loggato, quindi dopo l'auth).

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

export interface Profilo extends RigaBase {
  sesso: Sesso;
  data_nascita: string | null; // "YYYY-MM-DD"
  altezza_cm: number | null;
  livello_attivita: LivelloAttivita | null;
}

export type TipoObiettivo = "dimagrire" | "mantenere" | "massa";

export interface Obiettivo extends RigaBase {
  valido_dal: string; // "YYYY-MM-DD": cambiare obiettivo inserisce una riga nuova, non modifica questa
  tipo: TipoObiettivo;
  kcal: number;
  proteine: number;
  carboidrati: number;
  grassi: number;
  peso_obiettivo: number | null;
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
  porzione_default_g: number | null;
  fonte: FonteAlimento;
  verificato: boolean;
}

export interface VoceDiario extends RigaBase {
  alimento_id: string;
  pasto_id: string;
  gruppo_id: string | null; // righe inserite insieme da un pasto salvato/ricetta
  quantita_g: number;
  data: string; // "YYYY-MM-DD": il giorno logico (vedi PUNTO_DI_PARTENZA.md)
  creato_il: string; // ISO 8601: quando è stata scritta la riga
  consumato_alle: string | null; // ISO 8601: quando è stata mangiata

  // Copia dei valori nutrizionali dell'alimento al momento dell'inserimento:
  // se l'alimento viene corretto nel catalogo dopo, la storia non cambia.
  alimento_nome: string;
  kcal_100g: number;
  proteine_100g: number;
  carboidrati_100g: number;
  grassi_100g: number;
}

export type TipoComposizione = "pasto_salvato" | "ricetta";

export interface Composizione extends RigaBase {
  nome: string;
  tipo: TipoComposizione;
}

export interface ComposizioneVoce extends RigaBase {
  composizione_id: string;
  alimento_id: string;
  quantita_g: number;
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
