// Helper specifici per i pasti salvati, oltre al CRUD generico di
// repositoryComposizioni/repositoryComposizioniVoci. Solo `tipo:
// "pasto_salvato"` in questo pezzo — le ricette (stessa tabella, tipo
// "ricetta") sono un perimetro diverso, non ancora costruito.

import { repositoryAlimenti, repositoryComposizioni, repositoryComposizioniVoci } from "./index";
import { catalogoLocale } from "./alimenti";
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

// Rinomina un pasto salvato. Il controllo duplicati (esisteComposizioneConNome
// con escludiId) va fatto dal chiamante prima di invocarla — qui si scrive e
// basta, come per il resto del CRUD generico.
export async function rinominaComposizione(id: string, nome: string): Promise<void> {
  await repositoryComposizioni.aggiorna(id, { nome });
}

// Toglie un pasto salvato dai preferiti (sezione 3, punto 3 delle
// correzioni: ripremere la stella già piena lo rimuove). Cancellazione
// logica su composizione e sue voci insieme — altrimenti le voci restano
// "vive" ma orfane, invisibili nella UI ma comunque righe in giro.
export async function eliminaComposizione(
  composizioneId: string,
  composizioniVoci: ComposizioneVoce[]
): Promise<void> {
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

// Cancellare un alimento dal catalogo (CreaAlimentoForm, "Elimina") lo toglie
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
  const [composizioni, composizioniVoci] = await Promise.all([
    repositoryComposizioni.ottieniTutti(userId),
    repositoryComposizioniVoci.ottieniTutti(userId),
  ]);

  const vociDaEliminare = composizioniVoci.filter((v) => v.alimento_id === alimentoId);
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

// L'"Annulla" dopo la cancellazione di un alimento: rimette in vita
// (deleted_at di nuovo null, via repository, così la sync lo propaga) solo
// ciò che quella cancellazione aveva toccato — l'alimento e le righe della
// `traccia`. Né più né meno.
//
// ORDINE VOLUTO, speculare a handleElimina in CreaAlimentoForm: prima
// l'alimento, poi i pasti salvati, poi le righe di composizioni_voci. In
// nessun momento esiste una riga viva che punta a un alimento cancellato o
// a un pasto cancellato — se un passo fallisce a metà restano al più un
// alimento ripristinato senza tutti i suoi pasti (stato corretto, solo
// incompleto), mai un riferimento morto.
//
// Due casi in cui qualcosa NON si ripristina, decisi il 2026-09-25:
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
): Promise<{ pastiNonRipristinati: string[] }> {
  await repositoryAlimenti.aggiorna(alimentoId, { deleted_at: null });

  const pastiNonRipristinati: string[] = [];
  const [catalogo, composizioniVive, vociVive] = await Promise.all([
    catalogoLocale(userId),
    repositoryComposizioni.ottieniTutti(userId),
    repositoryComposizioniVoci.ottieniTutti(userId),
  ]);

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
    traccia.idComposizioniVoci.map(async (id) => {
      const voce = await repositoryComposizioniVoci.ottieniPerId(id);
      if (!voce || voce.deleted_at === null) return;
      if (!idComposizioniVive.has(voce.composizione_id)) return;
      await repositoryComposizioniVoci.aggiorna(id, { deleted_at: null });
    })
  );

  return { pastiNonRipristinati };
}
