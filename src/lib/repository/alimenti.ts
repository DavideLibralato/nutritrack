// Helper specifici per il catalogo alimenti, oltre al CRUD generico di
// repositoryAlimenti.
//
// `alimenti` è l'unica tabella con `user_id` nullable (sezione 4): NULL =
// riga del catalogo condiviso, visibile a tutti; valorizzato = alimento
// privato di quell'utente. Il CRUD generico filtra per `user_id` esatto,
// quindi escluderebbe le righe condivise: per il catalogo serve l'unione
// delle due cose.

import { db } from "../db/database";
import type { Alimento, FonteAlimento } from "../db/tipi";
import { normalizzaSpazi, testoConfronto, trovaDoppione } from "../catalogo/doppioniAlimenti";
import { campiDiversi, valoriDi, type ValoriAlimento } from "../catalogo/alimentiInArrivo";
import { eModificabile } from "../catalogo/alimentiModificabili";
import type { AlimentoCatalogo } from "../catalogo/catalogoPrecaricato";
import { statoNelCatalogo } from "../catalogo/neiTuoi";
import { repositoryAlimenti } from "./index";

// Il catalogo locale visibile all'utente: i suoi alimenti privati più quelli
// condivisi. Qui c'è solo IndexedDB: Open Food Facts (livello 3 della
// sezione 9.4) oggi si cerca solo per codice a barre, dopo questo catalogo
// (src/lib/barcode/ricercaCodice.ts); il livello 2 oggi non serve (§9.4).
export async function catalogoLocale(userId: string): Promise<Alimento[]> {
  return db.alimenti
    .filter((a) => a.deleted_at === null && (a.user_id === userId || a.user_id === null))
    .toArray();
}

// Fra gli alimenti con uno stesso codice a barre, quello che l'utente
// vede nel catalogo (PUNTO_DI_PARTENZA.md §3, "Codice a barre", "Il
// percorso"): solo i vivi, prima i suoi, poi quelli del catalogo comune.
// Un alimento cancellato non conta: è ritirato dal futuro (§4, "Alimenti
// cancellati"). Due suoi con lo stesso codice non dovrebbero esistere
// (regola dei doppioni), ma due telefoni offline possono crearli: vince
// il più recente. Funzione pura, per i test.
export function sceltoPerCodice(conCodice: Alimento[], userId: string): Alimento | null {
  const vivi = conCodice.filter((a) => a.deleted_at === null);
  const piuRecente = (lista: Alimento[]) =>
    lista.reduce<Alimento | null>(
      (scelto, a) => (scelto === null || a.updated_at > scelto.updated_at ? a : scelto),
      null
    );
  return (
    piuRecente(vivi.filter((a) => a.user_id === userId)) ??
    piuRecente(vivi.filter((a) => a.user_id === null))
  );
}

// L'alimento del catalogo locale con questo codice (già normalizzato da
// leggiCodice), se c'è. Usa l'indice `barcode` di Dexie, che esiste dalla
// version(1): legge solo le righe con quel codice, non tutto il catalogo.
export async function alimentoPerCodice(userId: string, codice: string): Promise<Alimento | null> {
  const conCodice = await db.alimenti.where("barcode").equals(codice).toArray();
  return sceltoPerCodice(conCodice, userId);
}

// I campi che "Nuovo alimento" e "Modifica alimento" scrivono
// (CreaAlimentoForm). Il resto (fonte, verificato, barcode, i quattro
// valori facoltativi) lo decide salvaAlimento: in creazione i valori di un
// alimento scritto a mano (o, con `origine`, codice e fonte di un codice a
// barre), in modifica quelli che la riga aveva già (tranne un codice da
// aggiungere, `codiceDaAggiungere`).
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
  // Nome e marca (o il codice a barre) sono di un altro alimento vivo
  // dell'utente: niente scritto. `doppione` è quello che c'è già (per
  // "Hai già «…»" e "Apri").
  | { esito: "doppione"; doppione: Alimento }
  // Solo con `codiceDaAggiungere`: intanto la riga ha ricevuto un altro
  // codice (la sync da un altro telefono). Niente scritto, nemmeno i
  // valori: il codice salvato non si sovrascrive. `barcode` è quello
  // che la riga ha ora.
  | { esito: "ha-gia-codice"; barcode: string };

// Un alimento nato da un codice a barre (PUNTO_DI_PARTENZA.md §3, "Codice
// a barre", "`fonte` e `barcode`"): il codice, già nella forma di
// leggiCodice, e la fonte — 'off' se almeno un valore viene da Open Food
// Facts (anche se poi corretto), 'barcode' se i valori li ha scritti
// l'utente.
export interface OrigineCodice {
  barcode: string;
  fonte: Extract<FonteAlimento, "off" | "barcode">;
}

// I valori nascosti (zuccheri, fibre, saturi, sale: salvati ma non nel
// modulo) che una modifica deve togliere, perché non descrivono più
// l'alimento corretto (Davide, 08/11; PUNTO_DI_PARTENZA.md §10.1, "I
// valori nascosti in modifica"):
// - cambiano i carboidrati → zuccheri e fibre null (gli zuccheri ne sono
//   una parte, e il modulo non può dire «zuccheri oltre i carboidrati»
//   su un campo che non mostra);
// - cambiano i grassi → saturi null;
// - il sale resta sempre; kcal, proteine, nome, marca e porzione non
//   toccano niente.
// Vale per ogni alimento, non solo per le copie dal catalogo: anche uno
// arrivato da un amico ha i quattro valori. Il confronto è sui valori già
// arrotondati del modulo e su quelli della riga, esatti: risalvare senza
// cambiare non toglie niente. Funzione pura.
export function valoriNascostiDaTogliere(
  prima: Pick<Alimento, "carboidrati_100g" | "grassi_100g">,
  dopo: Pick<CampiForm, "carboidrati_100g" | "grassi_100g">
): Partial<Pick<Alimento, "zuccheri_100g" | "fibre_100g" | "saturi_100g">> {
  return {
    ...(dopo.carboidrati_100g !== prima.carboidrati_100g
      ? { zuccheri_100g: null, fibre_100g: null }
      : {}),
    ...(dopo.grassi_100g !== prima.grassi_100g ? { saturi_100g: null } : {}),
  };
}

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
//
// `origine` (solo in creazione): l'alimento nasce da un codice a barre.
// Si scrivono il codice e la fonte, e il doppione si cerca anche per
// codice, nella stessa transazione. In modifica si ignora: la `fonte`
// resta quella della riga.
//
// `codiceDaAggiungere` (solo in modifica; PUNTO_DI_PARTENZA.md §3,
// "Codice a barre", "Il codice in modifica"): il codice letto per un
// alimento che non ce l'aveva, già nella forma di leggiCodice. Il codice
// in modifica non si cambia e non si toglie, si può solo aggiungere:
// - si scrive con gli altri campi, in un solo aggiornamento; la fonte
//   non cambia;
// - è un codice che sta per nascere, quindi si confronta (trovaDoppione
//   con il codice): se è di un altro alimento vivo, niente scritto;
// - se intanto la riga ha già un codice (sync), quello non si
//   sovrascrive: "ha-gia-codice" se è un altro, e se è lo stesso si
//   salva normalmente.
// Senza `codiceDaAggiungere` il codice in modifica non si confronta: non
// cambia, quindi non può far nascere un doppione (e due alimenti con lo
// stesso codice nati da due telefoni offline non devono bloccare per
// sempre la modifica di uno dei due). In creazione si ignora.
export async function salvaAlimento(
  userId: string,
  campi: CampiForm,
  idDaModificare?: string,
  origine?: OrigineCodice,
  codiceDaAggiungere?: string
): Promise<EsitoSalvataggioAlimento> {
  const puliti: CampiForm = {
    ...campi,
    nome: normalizzaSpazi(campi.nome),
    marca: normalizzaSpazi(campi.marca ?? "") || null,
  };
  const codice = idDaModificare ? null : (origine ?? null);
  // Un codice vuoto non è un codice (stessoCodice lo tratta allo stesso
  // modo).
  const daAggiungere = idDaModificare && codiceDaAggiungere ? codiceDaAggiungere : null;
  return db.transaction(
    "rw",
    [db.alimenti, db.outbox],
    // async/await anche qui: senza, Dexie perde la transazione dopo la
    // prima scrittura (vedi ripristinaAlimenti in composizioni.ts).
    async (): Promise<EsitoSalvataggioAlimento> => {
      if (daAggiungere) {
        const riga = await db.alimenti.get(idDaModificare!);
        const giaSalvato = riga?.barcode ?? "";
        if (giaSalvato !== "" && giaSalvato !== daAggiungere) {
          return { esito: "ha-gia-codice", barcode: giaSalvato };
        }
      }

      const catalogo = await catalogoLocale(userId);
      const doppione = trovaDoppione(
        catalogo,
        { ...puliti, barcode: codice?.barcode ?? daAggiungere },
        { userId, escludiId: idDaModificare }
      );
      if (doppione) return { esito: "doppione", doppione };

      if (idDaModificare) {
        // Stessa riga (stesso id): `verificato`, `fonte` e `catalogo_id`
        // restano quelli che erano; `barcode` anche, tranne il codice da
        // aggiungere. I valori nascosti che non tornano più con i valori
        // nuovi diventano null (valoriNascostiDaTogliere), letti dalla riga
        // nella stessa transazione.
        const prima = await db.alimenti.get(idDaModificare);
        const alimento = await repositoryAlimenti.aggiorna(idDaModificare, {
          ...puliti,
          ...(prima ? valoriNascostiDaTogliere(prima, puliti) : {}),
          ...(daAggiungere ? { barcode: daAggiungere } : {}),
        });
        return { esito: "salvato", alimento };
      }
      const alimento = await repositoryAlimenti.crea({
        user_id: userId,
        barcode: codice?.barcode ?? null,
        ...puliti,
        zuccheri_100g: null,
        fibre_100g: null,
        saturi_100g: null,
        sale_100g: null,
        fonte: codice?.fonte ?? "manuale",
        verificato: false,
        // Sempre scritto, anche null: una riga nuova ha tutte le chiavi
        // (tipi.ts, Alimento.catalogo_id).
        catalogo_id: null,
      });
      return { esito: "salvato", alimento };
    }
  );
}

// --- «Aggiungi» dal catalogo precaricato (PUNTO_DI_PARTENZA.md §10.1) ---

export type EsitoAggiuntaDalCatalogo =
  | { esito: "aggiunto"; alimento: Alimento }
  // Era già fra i suoi (una copia, anche rinominata, o un doppione per
  // codice o per nome e marca: statoNelCatalogo). Niente scritto;
  // `alimento` è quello che «Apri» apre.
  | { esito: "nei-tuoi"; alimento: Alimento };

// Crea un alimento dell'utente dall'alimento del catalogo: una riga nuova a
// ogni aggiunta (id nuovo, mai uno calcolato), con `catalogo_id` che dice
// da dove viene. Così una copia cancellata e poi riaggiunta nasce di nuovo
// invece di tornare in vita, che la discesa potrebbe annullare (§10.1, §9.2).
//
// Come salvaAlimento: si rilegge il catalogo dell'utente e si scrive nella
// stessa transazione (`alimenti` + `outbox`). Un doppio tocco su «Aggiungi»
// fa due transazioni una dopo l'altra: la seconda trova la copia della
// prima e non scrive. La copia sale con la sync di sempre.
//
// Cosa si copia: nome, marca, codice, porzione, i quattro valori e anche
// zuccheri, fibre, saturi e sale (si salvano, non si mostrano). `fonte`
// 'off' per i prodotti di Open Food Facts, 'manuale' per gli sfusi di
// Ciqual: nessun valore nuovo nel vincolo del database, l'origine vera la
// dice `catalogo_id`. Privato, non verificato: si modifica come ogni altro
// alimento suo.
//
// L'Annulla dopo «Aggiungi» è l'eliminazione di sempre
// (eliminaAlimenti in composizioni.ts, con il solo id della copia).
export async function aggiungiDalCatalogo(
  userId: string,
  voce: AlimentoCatalogo
): Promise<EsitoAggiuntaDalCatalogo> {
  return db.transaction(
    "rw",
    [db.alimenti, db.outbox],
    // async/await: vedi salvaAlimento.
    async (): Promise<EsitoAggiuntaDalCatalogo> => {
      const stato = statoNelCatalogo(voce, await catalogoLocale(userId), userId);
      if (stato.stato === "nei-tuoi") return { esito: "nei-tuoi", alimento: stato.alimento };
      const alimento = await repositoryAlimenti.crea({
        user_id: userId,
        nome: voce.nome,
        marca: voce.marca,
        barcode: voce.barcode,
        kcal_100g: voce.kcal_100g,
        proteine_100g: voce.proteine_100g,
        carboidrati_100g: voce.carboidrati_100g,
        grassi_100g: voce.grassi_100g,
        zuccheri_100g: voce.zuccheri_100g,
        fibre_100g: voce.fibre_100g,
        saturi_100g: voce.saturi_100g,
        sale_100g: voce.sale_100g,
        porzione_default_g: voce.porzione_default_g,
        fonte: voce.origine === "off" ? "off" : "manuale",
        verificato: false,
        catalogo_id: voce.id,
      });
      return { esito: "aggiunto", alimento };
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
export function etichettaAlimento(a: { nome: string; marca: string | null }): string {
  const marca = a.marca?.trim();
  return marca ? `${a.nome} · ${marca}` : a.nome;
}

// --- "Usa questi valori" e il suo Annulla (PUNTO_DI_PARTENZA.md §3
// "Amici", "Condividere un alimento", "L'ordine delle due scritture") ---
//
// Due scritture in due posti: il proprio alimento in Dexie (con la coda,
// come ogni modifica) e la condivisione sul server. Non possono stare in
// una transazione sola, quindi l'ordine decide cosa resta se la rete cade
// fra le due:
// - "Usa questi valori": PRIMA Dexie, POI il server. Se la chiusura non
//   arriva, i valori sono già aggiornati e la condivisione resta in
//   attesa: alla rilettura il foglio la mostra come "valori identici", con
//   solo Ok, e si sistema da sola;
// - Annulla: PRIMA il server (riapre la condivisione), POI Dexie (rimette i
//   valori di prima). Se la riapertura non risponde non si tocca niente, e
//   si può riprovare: riaprire una condivisione già riaperta risponde ok.
//
// Le chiamate al server le passa chi chiama (`chiudi`, `riapri`): qui si
// decide solo l'ordine, e i test lo provano senza rete.

export type EsitoChiusuraInArrivo = "ok" | "non_trovata" | "errore";

// Cosa serve all'Annulla: l'alimento, i valori di prima e come è andata la
// chiusura (per il messaggio della barra).
export interface TracciaValoriInArrivo {
  idAlimento: string;
  precedenti: ValoriAlimento;
  chiusura: EsitoChiusuraInArrivo;
}

export type EsitoUsaValori =
  | { esito: "fatto"; traccia: TracciaValoriInArrivo }
  // Il proprio alimento non c'è più o non si può modificare: non si è
  // scritto niente e il server non è stato chiamato.
  | { esito: "non_trovato" };

export async function usaValoriInArrivo(
  userId: string,
  idAlimento: string,
  valori: ValoriAlimento,
  chiudi: () => Promise<EsitoChiusuraInArrivo>
): Promise<EsitoUsaValori> {
  const precedenti = await db.transaction(
    "rw",
    [db.alimenti, db.outbox],
    async (): Promise<ValoriAlimento | null> => {
      const mio = await db.alimenti.get(idAlimento);
      if (!mio || mio.deleted_at !== null || !eModificabile(mio, userId)) return null;
      const prima = valoriDi(mio);
      // Già uguali (un tentativo precedente ha scritto, poi la chiusura non
      // è arrivata): niente da scrivere, si chiude e basta.
      if (campiDiversi(prima, valori).length > 0) {
        await repositoryAlimenti.aggiorna(idAlimento, valoriDi(valori));
      }
      return prima;
    }
  );
  if (!precedenti) return { esito: "non_trovato" };
  const chiusura = await chiudi();
  return { esito: "fatto", traccia: { idAlimento, precedenti, chiusura } };
}

export type EsitoAnnullaValori = "ripristinato" | "errore";

// La riapertura si chiede SEMPRE, anche se la chiusura sembrava fallita:
// con la risposta persa il server potrebbe averla chiusa lo stesso, e
// riaprire una condivisione già in attesa risponde ok. "non_trovata"
// (l'amicizia è finita, o è arrivato un invio più recente) non ferma il
// ripristino dei valori: la condivisione non si può riaprire, ma l'utente
// ha chiesto i suoi valori di prima.
export async function annullaValoriInArrivo(
  userId: string,
  traccia: TracciaValoriInArrivo,
  riapri: () => Promise<"ok" | "non_trovata" | "errore">
): Promise<EsitoAnnullaValori> {
  if ((await riapri()) === "errore") return "errore";
  await db.transaction("rw", [db.alimenti, db.outbox], async () => {
    const mio = await db.alimenti.get(traccia.idAlimento);
    if (!mio || mio.deleted_at !== null || !eModificabile(mio, userId)) return;
    if (campiDiversi(mio, traccia.precedenti).length > 0) {
      await repositoryAlimenti.aggiorna(traccia.idAlimento, valoriDi(traccia.precedenti));
    }
  });
  return "ripristinato";
}
