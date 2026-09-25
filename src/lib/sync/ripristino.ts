// "Ricarica i dati dal tuo account" (Profilo; PUNTO_DI_PARTENZA.md, sezione
// 9.2, "Ripristino dei dati locali"): sostituisce i dati di questo
// dispositivo con quelli di Supabase, senza uscire dall'account.
//
// È la via d'uscita generale quando il locale è incoerente in un modo che la
// sync non può riparare da sola — per esempio righe cancellate FISICAMENTE
// sul server, che la discesa non può rimuovere dai dispositivi (limite di
// §9.2). Unica via prima di questo pulsante: cancellare i dati del sito
// dalle impostazioni del browser, che su iPhone non ha funzionato.
//
// NON è ciò che ha risolto il caso che l'ha fatto nascere (10 pasti a
// schermo invece di 5, 2026-09-25): si pensava a pasti con id casuali
// rimasti solo in locale, invece erano ancora sul server (con 8 voci del
// Pranzo sotto il doppione). Ricaricare dal server li avrebbe riportati
// uguali; si correggono sul server, e la discesa porta la correzione su
// ogni dispositivo.
//
// PRIMA SCARICA, POI SOSTITUISCE — mai "cancella e riscarica":
// 1. scarica TUTTE le tabelle in memoria, complete (senza cursore). Se anche
//    una sola fallisce, non si tocca niente in locale;
// 2. in UNA transazione Dexie: controlla che le modifiche non inviate siano
//    esattamente quelle che l'utente ha accettato di perdere, cancella i
//    dati di QUESTO utente, scrive le righe scaricate, riscrive i cursori.
//    Niente rete dentro la transazione (vedi il commento in handleElimina,
//    src/components/CreaAlimentoForm.tsx: IndexedDB non tiene aperta una
//    transazione durante una chiamata di rete).
//
// Perché non "cancella e riscarica": scaricaTutto non segnala le tabelle
// fallite (resterebbero vuote); una discesa in background partita prima
// della pulizia potrebbe riscrivere il suo cursore dopo (e la riscarica
// diventerebbe incrementale, senza le righe vecchie); db.delete() chiude il
// database sotto le useLiveQuery aperte e si blocca con l'app aperta in
// un'altra scheda. Con lo scarico in memoria, una discesa in background che
// finisce dopo può solo scrivere righe del server più recenti di quelle
// locali (confronto riga per riga in discesa.ts) e al peggio riportare
// indietro un cursore — una riscarica in più, mai una riga persa.
//
// Nessun seed dei pasti predefiniti qui: i 5 canonici arrivano dal server
// con il resto.
//
// SOLO I DATI DI QUESTO UTENTE. Il dispositivo può contenere dati di un
// altro utente (i dati locali non si cancellano al logout, §9.6): le sue
// righe, le sue modifiche non inviate e i suoi cursori restano intatti.
// Il catalogo condiviso (alimenti con user_id null) non si cancella: si
// sovrascrive con le righe appena scaricate. Cancellarlo lascerebbe un
// altro utente con il cursore "alimenti" già avanti, e la sua discesa
// incrementale non lo riscaricherebbe mai più. Sono righe in sola lettura
// (RLS): non possono avere modifiche in sospeso da perdere.
//
// sostituisciDatiUtente è separata apposta: con zero righe da scrivere è
// la cancellazione dei dati locali al logout (§9.6), rimandata per scelta —
// quando arriverà userà questa stessa funzione.

import { db } from "../db/database";
import type { NomeTabella, RigaBase } from "../db/tipi";
import { TABELLE_DISCESA, pagineDaSupabase, millisecondiDi } from "./discesa";
import { sincronizzaOutbox } from "./sincronizza";
import type { VoceOutbox } from "./outbox";

// Come si chiamano i tipi di dato nella conferma: parole dell'utente, non
// nomi di tabella.
const ETICHETTE: Record<NomeTabella, string> = {
  voci_diario: "diario",
  alimenti: "alimenti",
  composizioni: "pasti salvati",
  composizioni_voci: "pasti salvati",
  pasti: "pasti",
  preferiti: "preferiti",
  profili: "profilo",
  obiettivi: "obiettivi",
  obiettivi_target: "obiettivi",
  giorni: "tipo di giornata",
  misurazioni: "misurazioni",
};

export interface GruppoModifiche {
  numero: number;
  // Tipi di dato coinvolti, senza ripetizioni, nell'ordine in cui compaiono.
  tipi: string[];
}

export interface ModificheNonInviate {
  // Ancora in coda: partirebbero alla prossima occasione.
  inAttesa: GruppoModifiche;
  // Accantonate dopo troppi tentativi falliti (sospesa_il): non partiranno
  // mai da sole — ma sono comunque dati dell'utente, e perderle va detto.
  nonRiuscite: GruppoModifiche;
  // Ciò che l'utente conferma di perdere, da ripassare a
  // ripristinaDatiLocali. Una "firma" per voce: id + creato_il. L'id da solo
  // non basta: una seconda modifica della stessa riga riusa lo stesso id
  // (outbox.ts), e sarebbe una modifica NUOVA che l'utente non ha visto.
  firme: string[];
}

function firma(voce: VoceOutbox): string {
  return `${voce.id}|${voce.creato_il}`;
}

function vociOutboxDellUtente(voci: VoceOutbox[], userId: string): VoceOutbox[] {
  return voci.filter((v) => v.dati.user_id === userId);
}

function gruppo(voci: VoceOutbox[]): GruppoModifiche {
  return {
    numero: voci.length,
    tipi: [...new Set(voci.map((v) => ETICHETTE[v.tabella]))],
  };
}

export async function modificheNonInviate(userId: string): Promise<ModificheNonInviate> {
  const voci = vociOutboxDellUtente(await db.outbox.toArray(), userId);
  return {
    inAttesa: gruppo(voci.filter((v) => !v.sospesa_il)),
    nonRiuscite: gruppo(voci.filter((v) => v.sospesa_il)),
    firme: voci.map(firma),
  };
}

// Primo passo, prima della conferma: prova a inviare ciò che è in coda
// (spesso basta a svuotarla), poi conta ciò che resta. Senza rete l'invio
// fallisce in silenzio e il conteggio riflette tutto ciò che è in coda —
// il ripristino fallirà comunque allo scarico, senza toccare niente.
export async function preparaRipristino(userId: string): Promise<ModificheNonInviate> {
  await sincronizzaOutbox().catch(() => {});
  return modificheNonInviate(userId);
}

export type EsitoRipristino =
  | { esito: "ripristinato" }
  // Almeno una tabella non è stata scaricata: in locale non è cambiato niente.
  | { esito: "scarico-fallito" }
  // Fra la conferma e la sostituzione è comparsa una modifica non inviata
  // che l'utente non ha visto: in locale non è cambiato niente.
  | { esito: "modifiche-cambiate" };

export async function ripristinaDatiLocali(
  userId: string,
  firmeConfermate: string[]
): Promise<EsitoRipristino> {
  let righe: Map<NomeTabella, RigaBase[]>;
  try {
    righe = await scaricaTuttoInMemoria(userId);
  } catch (errore) {
    console.error("Ripristino: scarico fallito, dati locali non toccati.", errore);
    return { esito: "scarico-fallito" };
  }

  const sostituito = await sostituisciDatiUtente(userId, righe, firmeConfermate);
  return sostituito ? { esito: "ripristinato" } : { esito: "modifiche-cambiate" };
}

// Tutte le tabelle, complete, in parallelo. Promise.all (non allSettled come
// scaricaTutto): basta un fallimento per rifiutare tutto — una tabella
// mancante qui diventerebbe una tabella svuotata in locale.
export async function scaricaTuttoInMemoria(
  userId: string
): Promise<Map<NomeTabella, RigaBase[]>> {
  const tabelle = await Promise.all(
    TABELLE_DISCESA.map(async (t) => {
      const righe: RigaBase[] = [];
      for await (const pagina of pagineDaSupabase<RigaBase>(userId, t.nome, {
        daData: null,
        includiCondivisi: t.includiCondivisi,
      })) {
        righe.push(...pagina);
      }
      return [t.nome, righe] as const;
    })
  );
  return new Map(tabelle);
}

// La transazione. Restituisce false — senza aver scritto niente — se fra le
// modifiche non inviate dell'utente ce n'è una che non è fra quelle
// confermate. Le firme confermate che non ci sono più (inviate nel
// frattempo) non sono un problema: non c'è più niente da perdere.
//
// Con `righe` vuota cancella e basta (il futuro logout, §9.6).
export async function sostituisciDatiUtente(
  userId: string,
  righe: Map<NomeTabella, RigaBase[]>,
  firmeConfermate: string[]
): Promise<boolean> {
  const confermate = new Set(firmeConfermate);

  return db.transaction(
    "rw",
    [...TABELLE_DISCESA.map((t) => t.tabella), db.outbox, db.sync_cursori],
    async () => {
      // Riletta DENTRO la transazione: una modifica fatta durante lo
      // scarico (l'utente cambia pagina e aggiunge qualcosa) è qui.
      const vociUtente = vociOutboxDellUtente(await db.outbox.toArray(), userId);
      if (vociUtente.some((v) => !confermate.has(firma(v)))) return false;

      // Solo le righe di questo utente. Le righe con user_id null (catalogo
      // condiviso) non sono indicizzate da IndexedDB, quindi where() non le
      // tocca: restano, e bulkPut qui sotto le sovrascrive.
      for (const t of TABELLE_DISCESA) {
        await t.tabella.where("user_id").equals(userId).delete();
      }
      await db.outbox.bulkDelete(vociUtente.map((v) => v.id));
      await db.sync_cursori.where("user_id").equals(userId).delete();

      for (const t of TABELLE_DISCESA) {
        const righeTabella = righe.get(t.nome) ?? [];
        if (righeTabella.length === 0) continue;
        await t.tabella.bulkPut(righeTabella);

        // Il cursore al massimo updated_at scaricato, come lo lascerebbe una
        // discesa completa: la prossima discesa riparte incrementale da qui
        // (con la sua finestra di sicurezza).
        const massimo = righeTabella.reduce((max, r) =>
          millisecondiDi(r.updated_at) > millisecondiDi(max.updated_at) ? r : max
        ).updated_at;
        await db.sync_cursori.put({
          id: `${t.nome}:${userId}`,
          tabella: t.nome,
          user_id: userId,
          ultimo_aggiornamento: massimo,
        });
      }

      return true;
    }
  );
}
