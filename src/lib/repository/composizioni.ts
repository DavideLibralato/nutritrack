// Helper specifici per i pasti salvati, oltre al CRUD generico di
// repositoryComposizioni/repositoryComposizioniVoci. Solo `tipo:
// "pasto_salvato"` in questo pezzo — le ricette (stessa tabella, tipo
// "ricetta") sono un perimetro diverso, non ancora costruito.

import { db } from "../db/database";
import { repositoryAlimenti, repositoryComposizioni, repositoryComposizioniVoci } from "./index";
import { catalogoLocale, etichettaAlimento } from "./alimenti";
import { trovaDoppione } from "../catalogo/doppioniAlimenti";
import {
  pastoSalvatoVisibile,
  separaVociPerCatalogo,
  composizioniCorrispondenti,
  pastoSalvatoCoiSoliValidi,
} from "../inserimento/pastiSalvati";
import type { Alimento, Composizione, ComposizioneVoce, VoceDiario } from "../db/tipi";

// Un nome già usato da un altro pasto salvato (stesso confronto: trim, non
// case-insensitive — "Colazione" e "colazione" restano nomi diversi finché
// l'utente non li scrive uguali). Solo fra i "pasto_salvato": una ricetta con
// lo stesso nome non è un conflitto, sono cose diverse per l'utente.
// `escludiId`: nella rinomina il pasto non deve risultare "duplicato di se
// stesso" se il nome non cambia (o torna a essere quello di partenza).
//
// `pastoSalvatoVisibile` (stessa regola di pastiSalvati, sezione 4): un nome
// non è "già preso" da una composizione che in Preferiti non compare più
// (bug del 2026-09-22, vedi il commento su quella funzione).
export function esisteComposizioneConNome(
  nome: string,
  catalogo: Alimento[],
  composizioni: Composizione[],
  composizioniVoci: ComposizioneVoce[],
  escludiId?: string
): boolean {
  return composizioniConNome(nome, catalogo, composizioni, composizioniVoci, escludiId).length > 0;
}

function composizioniConNome(
  nome: string,
  catalogo: Alimento[],
  composizioni: Composizione[],
  composizioniVoci: ComposizioneVoce[],
  escludiId?: string
): Composizione[] {
  const nomeTrim = nome.trim();
  return composizioni.filter(
    (c) =>
      c.id !== escludiId &&
      c.tipo === "pasto_salvato" &&
      c.nome.trim() === nomeTrim &&
      pastoSalvatoVisibile(c.id, catalogo, composizioniVoci)
  );
}

// Come è andato un tentativo di salvare un pasto di giornata come pasto
// salvato. Solo "salvato" ha scritto qualcosa; tutti gli altri esiti
// lasciano il database com'era.
export type EsitoSalvataggioPasto =
  | { esito: "salvato" }
  // Nessuno degli alimenti è ancora nel catalogo: non c'è niente da salvare.
  | { esito: "senza-alimenti" }
  // Nome già usato da un pasto salvato con contenuto diverso.
  | { esito: "nome-duplicato" }
  // Le sole voci valide coincidono già con un pasto salvato: non è un
  // errore, quel contenuto è già salvato (regola "Alimenti cancellati",
  // punto 3). `nomePasto` è il nome di quel pasto, non per forza quello
  // digitato; `nomiEsclusi` per dire all'utente cosa manca.
  | { esito: "gia-salvato"; nomePasto: string; nomiEsclusi: string[] }
  // Le voci escluse non sono più quelle annunciate all'utente (un alimento
  // cancellato o ripristinato da un altro dispositivo mentre lo sheet era
  // aperto): non si salva, il chiamante mostra l'avviso aggiornato e chiede
  // di confermare di nuovo.
  | { esito: "esclusi-cambiati"; idVociEscluse: string[] };

// Promuove le voci di un pasto già registrato oggi a una composizione
// riutilizzabile (PUNTO_DI_PARTENZA.md, sezione 3: "Salvare un pasto
// intero" — non si costruisce in una schermata apposta, si promuove da una
// giornata già registrata). Copia alimento_id e quantita_g delle voci
// **al momento del salvataggio**, non un riferimento che seguirebbe
// eventuali modifiche fatte dopo alle voci di oggi.
//
// Le voci il cui alimento non è più nel catalogo si escludono (regola
// "Alimenti cancellati": un pasto salvato è uno stampo per inserire in
// futuro, e un alimento ritirato dal catalogo non ne fa più parte). Ma non
// in silenzio: il chiamante le ha già mostrate all'utente nello sheet, e
// passa qui `idVociEsclusePreviste` — gli id delle voci che l'utente ha visto
// annunciate come escluse. Se, rileggendo il catalogo, le escluse non sono
// più esattamente quelle, non si salva niente ("esclusi-cambiati"): la
// conferma dell'utente valeva per un altro elenco.
//
// Tutte le decisioni si prendono rileggendo Dexie qui dentro, mai da uno
// stato React del chiamante che potesse essere di un giro di ridisegno fa:
// catalogo, nomi già usati, pasti già salvati. Ordine dei controlli, voluto:
// 1. nessuna voce valida → "senza-alimenti" (non si crea una composizione
//    vuota, sarebbe un fantasma fin dalla nascita: bug del 2026-09-24,
//    composizione 74a9b00f su Supabase);
// 2. ci sono voci escluse e le sole valide coincidono con un pasto salvato
//    (con qualunque nome) → "gia-salvato";
//    nome già usato → "gia-salvato" se quel pasto coincide con le voci
//    valide, altrimenti "nome-duplicato". Prima del controllo sugli esclusi:
//    se il contenuto è già salvato, il messaggio informativo vince
//    sull'avviso (punto E della regola);
// 3. escluse diverse da quelle annunciate → "esclusi-cambiati";
// 4. si scrive.
export async function salvaPastoComeComposizione(
  userId: string,
  nome: string,
  vociPasto: VoceDiario[],
  idVociEsclusePreviste: string[]
): Promise<EsitoSalvataggioPasto> {
  const [catalogo, composizioni, composizioniVoci] = await Promise.all([
    catalogoLocale(userId),
    repositoryComposizioni.ottieniTutti(userId),
    repositoryComposizioniVoci.ottieniTutti(userId),
  ]);

  const { valide, escluse } = separaVociPerCatalogo(vociPasto, catalogo);

  if (valide.length === 0) return { esito: "senza-alimenti" };

  const nomiEsclusi = escluse.map((v) => v.nome_alimento);

  // Contenuto già salvato sotto un altro nome: stessa regola del tocco della
  // stella in Oggi (pastoSalvatoCoiSoliValidi), ripetuta qui come rete di
  // sicurezza — di norma lo sheet non si apre nemmeno, ma i dati possono
  // essere cambiati (sync) mentre era aperto.
  const giaSalvato = pastoSalvatoCoiSoliValidi(vociPasto, catalogo, composizioni, composizioniVoci);
  if (giaSalvato) return { esito: "gia-salvato", nomePasto: giaSalvato.nome, nomiEsclusi };

  const conStessoNome = composizioniConNome(nome, catalogo, composizioni, composizioniVoci);
  if (conStessoNome.length > 0) {
    const coincide =
      composizioniCorrispondenti(valide, catalogo, conStessoNome, composizioniVoci).length > 0;
    return coincide
      ? { esito: "gia-salvato", nomePasto: conStessoNome[0].nome, nomiEsclusi }
      : { esito: "nome-duplicato" };
  }

  const idEscluse = escluse.map((v) => v.id);
  const previste = new Set(idVociEsclusePreviste);
  if (idEscluse.length !== previste.size || idEscluse.some((id) => !previste.has(id))) {
    return { esito: "esclusi-cambiati", idVociEscluse: idEscluse };
  }

  const composizione = await repositoryComposizioni.crea({
    user_id: userId,
    nome,
    tipo: "pasto_salvato",
    alimento_id: null,
  });

  await Promise.all(
    valide.map((v, indice) =>
      repositoryComposizioniVoci.crea({
        user_id: userId,
        composizione_id: composizione.id,
        alimento_id: v.alimento_id,
        quantita_g: v.quantita_g,
        ordine: indice,
      })
    )
  );

  return { esito: "salvato" };
}

// Toglie un pasto salvato dai preferiti (sezione 3, punto 3 delle
// correzioni: ripremere la stella già piena lo rimuove). Cancellazione
// logica su composizione e sue voci insieme — altrimenti le voci restano
// "vive" ma orfane, invisibili nella UI ma comunque righe in giro.
// Le righe si rileggono da Dexie qui dentro, non da uno stato React del
// chiamante: una riga aggiunta un istante prima (sync, o un Salva appena
// fatto) resterebbe fuori e viva, orfana. Prima le righe, per ultima la
// composizione (vedi salvaModificaPasto per il perché di quest'ordine).
export async function eliminaComposizione(userId: string, composizioneId: string): Promise<void> {
  const composizioniVoci = await repositoryComposizioniVoci.ottieniTutti(userId);
  const voci = composizioniVoci.filter((v) => v.composizione_id === composizioneId);
  await Promise.all(voci.map((v) => repositoryComposizioniVoci.elimina(v.id)));
  await repositoryComposizioni.elimina(composizioneId);
}

// Cosa ha cancellato DAVVERO una chiamata a rimuoviAlimentoDaPastiSalvati:
// serve a ripristinaAlimentoEliminato per annullare quella cancellazione e
// nient'altro. Righe già cancellate prima non ci sono, quindi non possono
// tornare a galla con l'Annulla.
export interface TracciaRimozione {
  idComposizioniVoci: string[];
  idComposizioni: string[];
}

// Cancellare un alimento dal catalogo (eliminaAlimenti, qui sotto) lo toglie
// anche da ogni pasto salvato che lo conteneva (regola "Alimenti cancellati"
// in PUNTO_DI_PARTENZA.md: ritirato dal futuro, non dal passato — il diario
// non si tocca). L'utente può annullare per qualche secondo subito dopo
// (BarraAnnulla in /aggiungi), per questo la funzione restituisce cosa ha
// toccato:
// - resta almeno un altro alimento nel pasto → si cancella solo la riga di
//   composizioni_voci di quell'alimento, il pasto resta con gli altri;
// - era l'ultimo alimento del pasto → si cancella (logicamente) anche il
//   pasto salvato, altrimenti resta un guscio vuoto: esiste ancora
//   (deleted_at null) ma pastiSalvati() non lo mostra più a nessuno, e il
//   suo nome resta bloccato per sempre — è esattamente il bug del
//   2026-09-22 ("Colazione" non risalvabile), corretto a mano una volta su
//   Supabase; questa funzione impedisce che si ripeta.
//
// Solo `tipo: "pasto_salvato"` (le ricette sono un perimetro diverso, non
// ancora costruito: oggi non hanno mai righe in composizioni_voci, quindi
// questo filtro non le tocca comunque).
//
// Rilegge composizioni/composizioni_voci da sola invece di riceverle come
// parametro: chi cancella un alimento (CreaAlimentoForm) non le ha già in
// mano, e prenderle da uno stato React rischierebbe un giro vecchio (stesso
// motivo di garantisciGiornoPerPrimaVoce in src/lib/repository/giorni.ts).
// ottieniTutti restituisce solo righe vive: le righe già cancellate prima
// non entrano mai nella traccia.
export async function rimuoviAlimentoDaPastiSalvati(
  userId: string,
  alimentoId: string
): Promise<TracciaRimozione> {
  return rimuoviAlimentiDaPastiSalvati(userId, new Set([alimentoId]));
}

// La stessa cascata per un insieme di alimenti cancellati insieme
// (Impostazioni > Alimenti, selezione multipla). Non è la funzione sopra
// ripetuta per ogni alimento: la domanda "il pasto è rimasto vuoto?" va
// fatta sull'insieme. Con due alimenti dello stesso pasto salvato, fatta
// un alimento alla volta su un elenco letto all'inizio, ciascun giro
// vedrebbe ancora viva la riga dell'altro e nessuno dei due cancellerebbe
// il pasto: il guscio vuoto del bug del 22/09.
async function rimuoviAlimentiDaPastiSalvati(
  userId: string,
  alimentoIds: Set<string>
): Promise<TracciaRimozione> {
  const [composizioni, composizioniVoci] = await Promise.all([
    repositoryComposizioni.ottieniTutti(userId),
    repositoryComposizioniVoci.ottieniTutti(userId),
  ]);

  const vociDaEliminare = composizioniVoci.filter((v) => alimentoIds.has(v.alimento_id));
  if (vociDaEliminare.length === 0) return { idComposizioniVoci: [], idComposizioni: [] };

  await Promise.all(vociDaEliminare.map((v) => repositoryComposizioniVoci.elimina(v.id)));

  const idVociEliminate = new Set(vociDaEliminare.map((v) => v.id));
  const idComposizioniToccate = new Set(vociDaEliminare.map((v) => v.composizione_id));

  const composizioniDaEliminare = composizioni.filter(
    (c) =>
      c.tipo === "pasto_salvato" &&
      idComposizioniToccate.has(c.id) &&
      // Nessuna voce le resta, a parte quelle appena cancellate qui sopra.
      !composizioniVoci.some(
        (v) => v.composizione_id === c.id && !idVociEliminate.has(v.id)
      )
  );

  await Promise.all(composizioniDaEliminare.map((c) => repositoryComposizioni.elimina(c.id)));

  return {
    idComposizioniVoci: vociDaEliminare.map((v) => v.id),
    idComposizioni: composizioniDaEliminare.map((c) => c.id),
  };
}

// Cosa ha cancellato DAVVERO una chiamata a eliminaAlimenti: gli alimenti,
// più la traccia della cascata sui pasti salvati. Serve all'Annulla
// (ripristinaAlimenti), che rimette in vita questo e nient'altro.
export interface TracciaEliminazioneAlimenti extends TracciaRimozione {
  idAlimenti: string[];
}

// Cancellare uno o più alimenti dal catalogo (PUNTO_DI_PARTENZA.md,
// sezione 3, "Alimenti"; regola "Alimenti cancellati" in sezione 4): la
// cascata sui pasti salvati e poi gli alimenti, **tutto o niente**, in una
// sola transazione Dexie. Se una scrittura fallisce a metà, IndexedDB
// annulla anche quelle già fatte, compresa la coda outbox: niente pasto
// salvato con un ingrediente in meno per un alimento che poi è rimasto nel
// catalogo. Possibile dal 9/10: le scritture del repository fanno partire
// la sync FUORI dalla transazione (src/lib/repository/repository.ts).
//
// Dentro la transazione si aspettano solo letture e scritture di Dexie,
// mai altro (rete, timer): IndexedDB chiuderebbe la transazione.
//
// Un alimento già cancellato (da un altro dispositivo, via sync, o da un
// secondo tocco) si salta e non entra nella traccia: l'Annulla non deve
// ripristinare una cancellazione che non è sua. Un alimento che non è
// dell'utente (catalogo comune, user_id null) non si cancella mai di qui:
// la pagina non lo mostra, quindi se arriva è un errore del chiamante, e
// si annulla tutto.
//
// Le righe di `preferiti` non si toccano: restano vive e nascoste finché
// l'alimento è cancellato (alimentiPreferiti guarda il catalogo), e tornano
// da sole con l'Annulla.
export async function eliminaAlimenti(
  userId: string,
  alimentoIds: string[]
): Promise<TracciaEliminazioneAlimenti> {
  return db.transaction(
    "rw",
    [db.alimenti, db.composizioni, db.composizioni_voci, db.outbox],
    async () => {
      const idAlimenti: string[] = [];
      for (const id of new Set(alimentoIds)) {
        const alimento = await repositoryAlimenti.ottieniPerId(id);
        if (!alimento || alimento.deleted_at !== null) continue;
        if (alimento.user_id !== userId) {
          throw new Error(`L'alimento ${id} non è dell'utente: non si cancella`);
        }
        idAlimenti.push(id);
      }
      if (idAlimenti.length === 0) {
        return { idAlimenti, idComposizioniVoci: [], idComposizioni: [] };
      }

      // Stesso ordine di quando le scritture non erano in una transazione:
      // prima i pasti salvati, poi gli alimenti. Dentro la transazione
      // l'ordine non cambia l'esito (tutto o niente), ma resta lo stesso
      // ragionamento da leggere in un posto solo.
      const traccia = await rimuoviAlimentiDaPastiSalvati(userId, new Set(idAlimenti));
      for (const id of idAlimenti) await repositoryAlimenti.elimina(id);
      return { idAlimenti, ...traccia };
    }
  );
}

// L'"Annulla" dopo la cancellazione di un alimento: rimette in vita
// (deleted_at di nuovo null, via repository, così la sync lo propaga) solo
// ciò che quella cancellazione aveva toccato — l'alimento e le righe della
// `traccia`. Né più né meno.
//
// ORDINE VOLUTO, speculare a eliminaAlimenti: prima l'alimento, poi i pasti
// salvati, poi le righe di composizioni_voci. In nessun momento esiste una
// riga viva che punta a un alimento cancellato o a un pasto cancellato. Dal
// 15/10 i passi stanno in una transazione (ripristinaAlimenti), quindi un
// guasto a metà non lascia niente; l'ordine resta perché i controlli dei
// passi dopo leggono ciò che i passi prima hanno già rimesso in vita.
//
// Casi in cui qualcosa NON si ripristina:
// - un alimento, se nel frattempo ne è nato un altro con lo stesso nome e
//   la stessa marca (regola del doppione, src/lib/catalogo/doppioniAlimenti.ts;
//   decisa il 16/10): mai due alimenti uguali nel catalogo. Resta
//   cancellato, e torna in `alimentiNonRipristinati` perché il chiamante
//   lo dica. Con lui restano
//   cancellate le sue righe dei pasti salvati (punterebbero a un alimento
//   cancellato), e un pasto salvato che senza di lui sarebbe vuoto non torna:
//   niente guscio vuoto (il bug del 22/09). Quel pasto non va in
//   `pastiNonRipristinati`: il motivo è l'alimento, già detto;
//
// e due decisi il 2026-09-25:
// - un pasto salvato cancellato perché era rimasto vuoto, se nel frattempo
//   è nato un altro pasto salvato con lo stesso nome: niente doppione
//   silenzioso e niente nome inventato ("Cena (2)"). Resta cancellato, e il
//   suo nome torna in `pastiNonRipristinati` perché il chiamante lo dica;
// - una riga di composizioni_voci il cui pasto salvato non è vivo (cancellato
//   dall'utente durante la finestra dell'Annulla, o non ripristinato per il
//   caso sopra): rimetterla in vita creerebbe una riga orfana.
//
// Tutto riletto da Dexie qui dentro, non da stato React.
export async function ripristinaAlimentoEliminato(
  userId: string,
  alimentoId: string,
  traccia: TracciaRimozione
): Promise<EsitoRipristino> {
  return ripristinaAlimenti(userId, { ...traccia, idAlimenti: [alimentoId] });
}

// Cosa non è tornato, per la barra (messaggioDopoRipristino).
export interface EsitoRipristino {
  // Gli alimenti rimasti cancellati perché ne esiste già uno uguale: il
  // nome (per toglierlo dall'elenco dei ripristinati) e l'etichetta
  // ("Pane · Mulino") da scrivere nella barra.
  alimentiNonRipristinati: { nome: string; etichetta: string }[];
  // Nomi dei pasti salvati rimasti cancellati perché il nome è già preso.
  pastiNonRipristinati: string[];
}

// L'"Annulla" dopo eliminaAlimenti, per uno o più alimenti: le stesse
// regole di ripristinaAlimentoEliminato qui sopra, con prima TUTTI gli
// alimenti della traccia, poi i pasti salvati, poi le righe. In una sola
// transazione, come la cancellazione: o torna tutto ciò che si può
// ripristinare, o niente (e la barra ripropone l'Annulla).
//
// Un alimento che non c'è più o è già vivo si salta: rimetterlo in vita non
// serve, e aggiornarlo sposterebbe solo il suo updated_at.
export async function ripristinaAlimenti(
  userId: string,
  traccia: TracciaEliminazioneAlimenti
): Promise<EsitoRipristino> {
  return db.transaction(
    "rw",
    [db.alimenti, db.composizioni, db.composizioni_voci, db.outbox],
    // `async` e `await` qui NON sono superflui. Dexie segue la transazione
    // attraverso gli await solo se la funzione che riceve è async: con
    // `() => ripristinaNellaTransazione(...)` (una funzione normale che
    // restituisce la promise) la transazione si perdeva dopo la prima
    // scrittura, le altre finivano fuori, e Dexie chiudeva con
    // PrematureCommitError. Trovato dai test il 15/10.
    async () => await ripristinaNellaTransazione(userId, traccia)
  );
}

async function ripristinaNellaTransazione(
  userId: string,
  traccia: TracciaEliminazioneAlimenti
): Promise<EsitoRipristino> {
  // Il controllo del doppione guarda il catalogo vivo PIÙ gli alimenti
  // rimessi in vita qui, uno dopo l'altro: due alimenti uguali nella
  // stessa traccia (possibile solo con dati vecchi) non tornano entrambi.
  const alimentiNonRipristinati: EsitoRipristino["alimentiNonRipristinati"] = [];
  const catalogoPrima = await catalogoLocale(userId);
  for (const id of traccia.idAlimenti) {
    const alimento = await repositoryAlimenti.ottieniPerId(id);
    if (!alimento || alimento.deleted_at === null) continue;
    if (trovaDoppione(catalogoPrima, alimento, { userId, escludiId: id })) {
      alimentiNonRipristinati.push({ nome: alimento.nome, etichetta: etichettaAlimento(alimento) });
      continue;
    }
    const ripristinato = await repositoryAlimenti.aggiorna(id, { deleted_at: null });
    catalogoPrima.push(ripristinato);
  }

  const pastiNonRipristinati: string[] = [];
  const [catalogo, composizioniVive, vociVive] = await Promise.all([
    catalogoLocale(userId),
    repositoryComposizioni.ottieniTutti(userId),
    repositoryComposizioniVoci.ottieniTutti(userId),
  ]);
  const idAlimentiVivi = new Set(catalogo.map((a) => a.id));

  // Le righe della traccia, lette una volta: servono sia per sapere se un
  // pasto salvato tornerebbe vuoto, sia al passo delle righe.
  const righeTraccia = (
    await Promise.all(traccia.idComposizioniVoci.map((id) => repositoryComposizioniVoci.ottieniPerId(id)))
  ).filter((v): v is ComposizioneVoce => v !== undefined && v.deleted_at !== null);
  // Una riga torna solo se il suo alimento è vivo (ripristinato, o mai
  // toccato): mai una riga viva che punta a un alimento cancellato.
  const righeDaRipristinare = righeTraccia.filter((v) => idAlimentiVivi.has(v.alimento_id));

  // In sequenza, non in parallelo: due pasti da ripristinare con lo stesso
  // nome (possibile solo con dati vecchi) non devono passare entrambi il
  // controllo del nome guardando lo stesso elenco.
  // I pasti ripristinati qui non hanno ancora righe vive (tornano solo al
  // passo dopo), quindi esisteComposizioneConNome non li vedrebbe: i loro
  // nomi si tengono a parte.
  const nomiRipristinati = new Set<string>();
  const idComposizioniVive = new Set(composizioniVive.map((c) => c.id));
  for (const id of traccia.idComposizioni) {
    const composizione = await repositoryComposizioni.ottieniPerId(id);
    if (!composizione || composizione.deleted_at === null) continue;
    // Era stato cancellato perché rimasto vuoto: torna solo se almeno una
    // delle sue righe torna (vedi sopra, alimenti non ripristinati).
    if (!righeDaRipristinare.some((v) => v.composizione_id === id)) continue;

    const nome = composizione.nome.trim();
    if (
      nomiRipristinati.has(nome) ||
      esisteComposizioneConNome(nome, catalogo, composizioniVive, vociVive)
    ) {
      pastiNonRipristinati.push(composizione.nome);
      continue;
    }
    await repositoryComposizioni.aggiorna(id, { deleted_at: null });
    nomiRipristinati.add(nome);
    idComposizioniVive.add(id);
  }

  await Promise.all(
    righeDaRipristinare.map(async (voce) => {
      if (!idComposizioniVive.has(voce.composizione_id)) return;
      await repositoryComposizioniVoci.aggiorna(voce.id, { deleted_at: null });
    })
  );

  return { alimentiNonRipristinati, pastiNonRipristinati };
}
