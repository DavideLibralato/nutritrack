// Helper specifici per il catalogo alimenti, oltre al CRUD generico di
// repositoryAlimenti.
//
// `alimenti` è l'unica tabella con `user_id` nullable (sezione 4): NULL =
// riga del catalogo condiviso, visibile a tutti; valorizzato = alimento
// privato di quell'utente. Il CRUD generico filtra per `user_id` esatto,
// quindi escluderebbe le righe condivise: per il catalogo serve l'unione
// delle due cose.

import { db } from "../db/database";
import type { Alimento } from "../db/tipi";
import { normalizzaSpazi, testoConfronto, trovaDoppione } from "../catalogo/doppioniAlimenti";
import { repositoryAlimenti } from "./index";

// Il catalogo locale visibile all'utente: i suoi alimenti privati più quelli
// condivisi. Il livello 2 (catalogo condiviso via Supabase) e il livello 3
// (Open Food Facts) della sezione 9.4 arrivano in fase 4 — qui c'è solo
// IndexedDB.
export async function catalogoLocale(userId: string): Promise<Alimento[]> {
  return db.alimenti
    .filter(
      (a) => a.deleted_at === null && (a.user_id === userId || a.user_id === null)
    )
    .toArray();
}

// I campi che "Nuovo alimento" e "Modifica alimento" scrivono
// (CreaAlimentoForm). Il resto (fonte, verificato, barcode, i quattro
// valori facoltativi) lo decide salvaAlimento: in creazione i valori di un
// alimento scritto a mano, in modifica quelli che la riga aveva già.
export type CampiForm = Pick<
  Alimento,
  | "nome"
  | "marca"
  | "kcal_100g"
  | "grassi_100g"
  | "carboidrati_100g"
  | "proteine_100g"
  | "porzione_default_g"
>;

export type EsitoSalvataggioAlimento =
  | { esito: "salvato"; alimento: Alimento }
  // Nome e marca sono di un altro alimento vivo dell'utente: niente
  // scritto. `doppione` è quello che c'è già (per "Hai già «…»" e "Apri").
  | { esito: "doppione"; doppione: Alimento };

// Crea un alimento (senza `idDaModificare`) o aggiorna quello esistente,
// solo se non nasce un doppione (src/lib/catalogo/doppioniAlimenti.ts).
//
// Il form controlla già mentre si scrive, ma su ciò che aveva letto a
// quel giro. Qui si rilegge il catalogo da Dexie e si scrive **nella
// stessa transazione**: fra la lettura e la scrittura non può entrare
// nient'altro. Così si fermano due casi:
// - un altro dispositivo ha creato lo stesso alimento, arrivato con la
//   sync dopo l'ultimo ridisegno del form;
// - il doppio tocco su Salva: il pulsante si spegne solo al ridisegno
//   dopo, quindi due tocchi ravvicinati arrivano qui tutti e due. Le due
//   transazioni vanno una dopo l'altra: la seconda trova la riga della
//   prima e non scrive.
//
// Nome e marca si salvano con gli spazi normalizzati (normalizzaSpazi);
// una marca vuota diventa null.
export async function salvaAlimento(
  userId: string,
  campi: CampiForm,
  idDaModificare?: string
): Promise<EsitoSalvataggioAlimento> {
  const puliti: CampiForm = {
    ...campi,
    nome: normalizzaSpazi(campi.nome),
    marca: normalizzaSpazi(campi.marca ?? "") || null,
  };
  return db.transaction(
    "rw",
    [db.alimenti, db.outbox],
    // async/await anche qui: senza, Dexie perde la transazione dopo la
    // prima scrittura (vedi ripristinaAlimenti in composizioni.ts).
    async (): Promise<EsitoSalvataggioAlimento> => {
      const catalogo = await catalogoLocale(userId);
      const doppione = trovaDoppione(catalogo, puliti, { userId, escludiId: idDaModificare });
      if (doppione) return { esito: "doppione", doppione };

      if (idDaModificare) {
        // Stessa riga (stesso id): `verificato`, `fonte`, `barcode`
        // restano quelli che erano.
        const alimento = await repositoryAlimenti.aggiorna(idDaModificare, puliti);
        return { esito: "salvato", alimento };
      }
      const alimento = await repositoryAlimenti.crea({
        user_id: userId,
        barcode: null,
        ...puliti,
        zuccheri_100g: null,
        fibre_100g: null,
        saturi_100g: null,
        sale_100g: null,
        fonte: "manuale",
        verificato: false,
      });
      return { esito: "salvato", alimento };
    }
  );
}

// Ricerca per sottostringa nel nome, indifferente a maiuscole e accenti
// ("però" trova "pero", "PANE" trova "pane"). Ordina i risultati per nome.
// Il confronto è testoConfronto, lo stesso della regola dei doppioni
// (src/lib/catalogo/doppioniAlimenti.ts): una normalizzazione sola.
export function cercaPerNome(alimenti: Alimento[], query: string): Alimento[] {
  if (!testoConfronto(query)) return [];
  return filtraPerNome(alimenti, query).sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

// Lo stesso confronto di cercaPerNome, ma senza ordinare e con una
// differenza: a ricerca vuota restituisce tutto, non niente. Serve a
// Impostazioni > Alimenti, dove l'elenco c'è anche prima di cercare e
// l'ordine lo sceglie l'utente (ordinaCatalogo).
export function filtraPerNome(alimenti: Alimento[], query: string): Alimento[] {
  const q = testoConfronto(query);
  if (!q) return alimenti;
  return alimenti.filter((a) => testoConfronto(a.nome).includes(q));
}

// Etichetta di un alimento in una lista (ricerca, in futuro recenti e
// preferiti): il nome, e — se la marca è valorizzata — "Nome · Marca", per
// distinguere due prodotti omonimi di marche diverse con valori nutrizionali
// differenti (PUNTO_DI_PARTENZA.md §4, `alimenti`). Nel diario non si usa:
// `voci_diario` copia solo il nome, non la marca.
export function etichettaAlimento(a: {
  nome: string;
  marca: string | null;
}): string {
  const marca = a.marca?.trim();
  return marca ? `${a.nome} · ${marca}` : a.nome;
}
