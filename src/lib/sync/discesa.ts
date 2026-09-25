// Discesa incrementale (PUNTO_DI_PARTENZA.md, sezione 9.2): la metà della
// sincronizzazione che mancava. outbox.ts + sincronizza.ts spingono da Dexie
// verso Supabase; questo file legge da Supabase e scrive in Dexie. Senza
// questo file Supabase era solo una destinazione, mai una fonte — un
// dispositivo nuovo (o dopo reinstallo) non vedeva mai i dati già presenti
// sul server, e due dispositivi divergevano senza mai riallinearsi.
//
// Una tabella per volta, incrementale: interroga solo le righe cambiate
// dopo l'ultimo scarico riuscito per quella tabella, non l'intera tabella
// ogni volta. Il riferimento (il "cursore") si tiene in una tabella Dexie
// locale, sync_cursori — mai sincronizzata a sua volta.

import type { Table } from "dexie";
import { createClient } from "../supabase/client";
import { db } from "../db/database";
import type { NomeTabella, RigaBase } from "../db/tipi";

export interface CursoreSync {
  // "<tabella>:<user_id>": stessa convenzione di outbox.ts. Per-utente
  // anche se oggi un solo utente alla volta usa questo Dexie: i dati
  // locali non vengono ancora cancellati al logout (PUNTO_DI_PARTENZA.md,
  // sezione 9.6, non ancora implementato), quindi un cursore senza
  // user_id potrebbe far leggere a un utente il "già scaricato" di un
  // altro su un dispositivo condiviso.
  id: string;
  tabella: NomeTabella;
  user_id: string;
  // ISO 8601: il valore massimo di updated_at fra le righe scaricate finora
  // per questa tabella e questo utente.
  ultimo_aggiornamento: string;
}

// Margine di sicurezza sul cursore. Il trigger che assegna updated_at sul
// server (set_updated_at) usa now(), cioè l'istante di INIZIO della
// transazione, non quello del commit. Due upsert quasi simultanee possono
// quindi committare in un ordine diverso da quello in cui sono partite: se
// la transazione A parte alle 10:00:00.000 ma il commit arriva alle
// 10:00:00.300, mentre B parte alle 10:00:00.100 e fa commit subito, B
// arriva prima con un updated_at (10:00:00.100) più recente di quello con
// cui la discesa sposta il cursore in avanti — e quando A commit,
// updated_at=10:00:00.000 è ORMAI PRIMA del cursore. Una query
// "updated_at > cursore" non la troverebbe mai più: la riga sparirebbe per
// sempre dalla discesa, senza errore, senza che nessuno se ne accorga.
//
// Interrogando da (cursore - questo margine) con >= invece di >, quella
// riga rientra comunque nella finestra della query successiva. Le righe
// già viste vengono ri-scaricate insieme a quella persa, ma tabella.put()
// per id è idempotente: ri-scaricare qualcosa di già noto non fa danno,
// perdere una riga per sempre sì.
//
// Un minuto è un margine ampio per come sono fatte oggi le scritture:
// ogni mutazione qui è un upsert a riga singola via PostgREST, una
// transazione che dura millisecondi — non ore. Se in futuro si
// introducono transazioni multi-riga più lunghe (un batch di più voci
// insieme, per esempio), questo margine va rivisto: potrebbe non bastare
// più a coprire la distanza reale fra inizio-transazione e commit.
const FINESTRA_SICUREZZA_MS = 60_000;

// Dimensione di ogni pagina scaricata. DEVE restare <= al "Max Rows"
// configurato su Supabase (Dashboard -> Settings -> API -> Max Rows,
// default tipico 1000 — non è leggibile da SQL, è un parametro della
// piattaforma PostgREST, non una riga di Postgres: verificarlo a mano nel
// dashboard, non dedurlo dal codice). Sotto quella soglia, PostgREST
// clippa silenziosamente la risposta senza segnalare che c'erano altre
// righe — motivo per cui questo file non si fida di un'unica select():
// vedi il ciclo qui sotto.
export const DIMENSIONE_PAGINA = 500;

// Esportata solo per il test: verifica che due timestamp dello stesso
// istante ma in formati diversi (locale, PostgREST) producano lo stesso
// valore numerico — il confronto fra stringhe non lo garantisce (vedi il
// commento sul confronto riga-per-riga più sotto).
export function millisecondiDi(iso: string): number {
  return new Date(iso).getTime();
}

// Le tabelle dati che la discesa scarica, una volta sola per tutti: la
// discesa normale (scaricaTutto) e il ripristino dei dati locali
// (src/lib/sync/ripristino.ts) devono scaricare esattamente lo stesso
// insieme. `includiCondivisi` serve solo ad "alimenti": è l'unica tabella
// con righe a user_id null (il catalogo condiviso, sezione 9.6) che vanno
// scaricate insieme alle proprie.
export const TABELLE_DISCESA: {
  nome: NomeTabella;
  tabella: Table<RigaBase, string>;
  includiCondivisi?: boolean;
}[] = [
  { nome: "profili", tabella: db.profili as unknown as Table<RigaBase, string> },
  { nome: "obiettivi", tabella: db.obiettivi as unknown as Table<RigaBase, string> },
  { nome: "obiettivi_target", tabella: db.obiettivi_target as unknown as Table<RigaBase, string> },
  { nome: "giorni", tabella: db.giorni as unknown as Table<RigaBase, string> },
  { nome: "pasti", tabella: db.pasti as unknown as Table<RigaBase, string> },
  {
    nome: "alimenti",
    tabella: db.alimenti as unknown as Table<RigaBase, string>,
    includiCondivisi: true,
  },
  { nome: "voci_diario", tabella: db.voci_diario as unknown as Table<RigaBase, string> },
  { nome: "composizioni", tabella: db.composizioni as unknown as Table<RigaBase, string> },
  {
    nome: "composizioni_voci",
    tabella: db.composizioni_voci as unknown as Table<RigaBase, string>,
  },
  { nome: "misurazioni", tabella: db.misurazioni as unknown as Table<RigaBase, string> },
  { nome: "preferiti", tabella: db.preferiti as unknown as Table<RigaBase, string> },
];

// La lettura da Supabase, pagina per pagina — l'unico posto dove è scritta
// la paginazione (vedi il lungo commento dentro). La usano la discesa
// incrementale qui sotto, che scrive ogni pagina in Dexie man mano, e il
// ripristino dei dati locali, che le accumula tutte in memoria prima di
// toccare qualunque cosa.
//
// Concetto nuovo: `async function*` è un "generatore asincrono". Invece di
// restituire un valore solo alla fine, ne consegna uno alla volta con
// `yield`, e chi lo usa li riceve con `for await (const pagina of ...)`. Qui
// ogni `yield` è una pagina appena arrivata: il chiamante decide cosa
// farne prima che parta la richiesta della successiva. Un errore di rete o
// di Supabase interrompe il ciclo del chiamante con un'eccezione.
//
// `daData` null = tutte le righe, senza cursore.
export async function* pagineDaSupabase<T extends RigaBase>(
  userId: string,
  nomeTabella: NomeTabella,
  opzioni: { daData: string | null; includiCondivisi?: boolean }
): AsyncGenerator<T[]> {
  const supabase = createClient();

  // PostgREST applica un tetto di righe per risposta (vedi DIMENSIONE_PAGINA):
  // senza ORDER BY + paginazione esplicita, una tabella più grande del tetto
  // (un diario supera facilmente le mille voci in pochi mesi) restituirebbe
  // un sottoinsieme arbitrario, il cursore avanzerebbe comunque al massimo
  // di quel sottoinsieme, e le righe più vecchie rimaste fuori non
  // verrebbero mai più richieste — perse in silenzio, non solo in ritardo.
  // Si pagina con .range(), in ordine crescente di updated_at (più un
  // ordinamento secondario su id, per un ordine totale stabile fra pagine
  // anche quando due righe hanno lo stesso updated_at), finché una pagina
  // torna più corta della dimensione richiesta.
  //
  // Assunzione accettata: .range() pagina per SCOSTAMENTO (offset), non per
  // chiave. Se una riga già scaricata cambia updated_at mentre il ciclo è a
  // metà, si sposta più avanti nell'ordinamento — può scivolare dalla
  // pagina che non ha ancora raggiunto a una successiva già passata, e in
  // quella finestra risulterebbe scaricata due volte o (raro, ma possibile)
  // saltata in questo giro. La finestra di sicurezza sul cursore ne
  // recupera gran parte al giro dopo, e oggi il caso reale è
  // mono-dispositivo: un ciclo di discesa che dura abbastanza da
  // sovrapporsi a una scrittura concorrente sulla stessa tabella è raro
  // quanto le transazioni fuori ordine di cui sopra. Non si passa a una
  // paginazione per chiave (range su updated_at/id invece che su scostamento,
  // stabile per costruzione anche con scritture concorrenti) finché resta
  // un'ipotesi teorica: è un cambiamento reale, da fare quando smette di
  // esserlo, non preventivamente.
  let scarico = 0;
  for (;;) {
    let query = supabase
      .from(nomeTabella)
      .select("*")
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true });
    query = opzioni.includiCondivisi
      ? query.or(`user_id.is.null,user_id.eq.${userId}`)
      : query.eq("user_id", userId);
    if (opzioni.daData) {
      query = query.gte("updated_at", opzioni.daData);
    }
    query = query.range(scarico, scarico + DIMENSIONE_PAGINA - 1);

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const pagina = (data ?? []) as T[];
    yield pagina;

    if (pagina.length < DIMENSIONE_PAGINA) return;
    scarico += DIMENSIONE_PAGINA;
  }
}

// Scarica una singola tabella per l'utente indicato, in modo incrementale
// (dal cursore). `opzioni.includiCondivisi`: vedi TABELLE_DISCESA.
export async function scaricaTabella<T extends RigaBase>(
  userId: string,
  tabella: Table<T, string>,
  nomeTabella: NomeTabella,
  opzioni?: { includiCondivisi?: boolean }
): Promise<void> {
  const idCursore = `${nomeTabella}:${userId}`;

  const cursore = await db.sync_cursori.get(idCursore);
  const daData = cursore
    ? new Date(
        new Date(cursore.ultimo_aggiornamento).getTime() - FINESTRA_SICUREZZA_MS
      ).toISOString()
    : null;

  // Cursore aggiornato solo a fine funzione (mai dentro il ciclo sotto):
  // se una pagina a metà fallisse, il cursore non deve avanzare oltre
  // quello che è stato davvero scritto in Dexie.
  let massimoVisto = cursore?.ultimo_aggiornamento ?? null;

  for await (const pagina of pagineDaSupabase<T>(userId, nomeTabella, {
    daData,
    includiCondivisi: opzioni?.includiCondivisi,
  })) {
    for (const rigaScaricata of pagina) {
      if (rigaScaricata.deleted_at) {
        // Una cancellazione dal server vince sempre, senza eccezioni sui
        // timestamp: se il locale ha un updated_at "più recente" solo
        // perché è una modifica fatta offline non ancora confrontata col
        // server, è comunque la stessa modifica la cui voce outbox viene
        // scartata qui sotto — lasciarla visibile e viva in locale
        // mostrerebbe per sempre una riga che altrove non esiste più.
        await tabella.put(rigaScaricata);

        const idOutbox = `${nomeTabella}:${rigaScaricata.id}`;
        const voceInSospeso = await db.outbox.get(idOutbox);
        if (voceInSospeso && !voceInSospeso.sospesa_il) {
          await db.outbox.delete(idOutbox);
          console.error(
            `Discesa: voce outbox scartata (${idOutbox}) — la riga risulta ` +
              `cancellata sul server, non la resuscitiamo con una modifica in sospeso.`
          );
        }
      } else {
        // Confronto riga per riga: diverso dal >= della query sopra (che
        // serve solo alla finestra di ri-scaricamento). Qui decide se
        // QUESTA riga scaricata deve sovrascrivere quello che Dexie ha
        // già — non lo fa se il locale è più recente, così una modifica
        // locale ancora in coda outbox (non ancora confermata dal server)
        // non viene riportata indietro sullo schermo da una discesa che
        // gira prima che l'outbox sia partito. Confronto numerico
        // (getTime()), non fra stringhe: PostgREST restituisce
        // "...619969+00:00" (6 decimali, offset esplicito) mentre
        // new Date().toISOString() locale produce "...619Z" (3 decimali) —
        // un confronto fra stringhe ordina male quando i due coincidono al
        // millisecondo, e sbaglia sistematicamente con un orologio locale
        // avanti.
        const locale = await tabella.get(rigaScaricata.id);
        if (
          !locale ||
          millisecondiDi(rigaScaricata.updated_at) > millisecondiDi(locale.updated_at)
        ) {
          await tabella.put(rigaScaricata);
        }
      }

      if (
        !massimoVisto ||
        millisecondiDi(rigaScaricata.updated_at) > millisecondiDi(massimoVisto)
      ) {
        massimoVisto = rigaScaricata.updated_at;
      }
    }
  }

  if (massimoVisto && massimoVisto !== cursore?.ultimo_aggiornamento) {
    await db.sync_cursori.put({
      id: idCursore,
      tabella: nomeTabella,
      user_id: userId,
      ultimo_aggiornamento: massimoVisto,
    });
  }
}

// Scarica tutte le tabelle dell'utente. In parallelo e senza fermarsi al
// primo errore (Promise.allSettled): a differenza della salita, qui non
// c'è un ordine da rispettare fra tabelle collegate da una foreign key
// (obiettivi/obiettivi_target, pasti/voci_diario...) — Dexie non impone
// vincoli di integrità referenziale, quindi scrivere una tabella figlia
// prima della sua genitrice non genera un errore locale, e per ciascuna
// tabella il cursore avanza in modo indipendente. Ogni fallimento viene
// però loggato con la tabella coinvolta: senza questo, una tabella che
// fallisce sempre (permessi, colonna sbagliata) scomparirebbe nel
// Promise.allSettled senza che nessuno se ne accorga.
export async function scaricaTutto(userId: string): Promise<void> {
  const risultati = await Promise.allSettled(
    TABELLE_DISCESA.map((t) =>
      scaricaTabella(userId, t.tabella, t.nome, { includiCondivisi: t.includiCondivisi })
    )
  );

  risultati.forEach((risultato, indice) => {
    if (risultato.status === "rejected") {
      console.error(
        `Discesa: scarico fallito per "${TABELLE_DISCESA[indice].nome}".`,
        risultato.reason
      );
    }
  });
}
