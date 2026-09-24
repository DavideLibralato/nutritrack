// Helper specifici per i pasti salvati, oltre al CRUD generico di
// repositoryComposizioni/repositoryComposizioniVoci. Solo `tipo:
// "pasto_salvato"` in questo pezzo — le ricette (stessa tabella, tipo
// "ricetta") sono un perimetro diverso, non ancora costruito.

import { repositoryComposizioni, repositoryComposizioniVoci } from "./index";
import { catalogoLocale } from "./alimenti";
import { pastoSalvatoVisibile } from "../inserimento/pastiSalvati";
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
  const nomeTrim = nome.trim();
  return composizioni.some(
    (c) =>
      c.id !== escludiId &&
      c.tipo === "pasto_salvato" &&
      c.nome.trim() === nomeTrim &&
      pastoSalvatoVisibile(c.id, catalogo, composizioniVoci)
  );
}

// Promuove le voci di un pasto già registrato oggi a una composizione
// riutilizzabile (PUNTO_DI_PARTENZA.md, sezione 3: "Salvare un pasto
// intero" — non si costruisce in una schermata apposta, si promuove da una
// giornata già registrata). Copia alimento_id e quantita_g delle voci
// **al momento del salvataggio**, non un riferimento che seguirebbe
// eventuali modifiche fatte dopo alle voci di oggi.
//
// Restituisce false (e non scrive niente) se dopo il filtro qui sotto non
// resta nessuna voce da salvare — il chiamante lo mostra come errore
// all'utente invece di creare una composizione vuota, che sarebbe un
// fantasma fin dalla nascita (vedi il filtro sull'alimento più sotto).
export async function salvaPastoComeComposizione(
  userId: string,
  nome: string,
  vociPasto: VoceDiario[]
): Promise<boolean> {
  // Rilegge il catalogo da sola invece di riceverlo come parametro: stesso
  // motivo di rimuoviAlimentoDaPastiSalvati qui sotto — questa è una
  // scrittura che decide se creare o no un riferimento morto, non un
  // dettaglio di visualizzazione, quindi non si fida di un catalogo React
  // che potesse essere di un giro di ridisegno fa.
  const catalogo = await catalogoLocale(userId);
  const idAlimentiValidi = new Set(catalogo.map((a) => a.id));

  // Due condizioni, non una sola:
  // - alimento_id non null: in pratica sempre valorizzato (ogni percorso di
  //   inserimento lo imposta), ma il tipo lo ammette nullable, e una voce
  //   senza alimento non ha nulla da copiare in composizioni_voci, che
  //   invece lo richiede;
  // - l'alimento è ancora nel catalogo: le voci di diario sopravvivono alla
  //   cancellazione del loro alimento (conservano la copia dei valori
  //   nutrizionali, sezione 4), ma un pasto SALVATO deve poter essere
  //   riaggiunto in futuro con i valori vivi dell'alimento — un alimento
  //   già cancellato va escluso qui, altrimenti si crea subito un pasto
  //   salvato "fantasma" con un riferimento morto dentro (bug del
  //   2026-09-24, visto su Supabase: composizione 74a9b00f).
  const vociConAlimento = vociPasto.filter(
    (v): v is VoceDiario & { alimento_id: string } =>
      v.alimento_id !== null && idAlimentiValidi.has(v.alimento_id)
  );

  if (vociConAlimento.length === 0) return false;

  const composizione = await repositoryComposizioni.crea({
    user_id: userId,
    nome,
    tipo: "pasto_salvato",
    alimento_id: null,
  });

  await Promise.all(
    vociConAlimento.map((v, indice) =>
      repositoryComposizioniVoci.crea({
        user_id: userId,
        composizione_id: composizione.id,
        alimento_id: v.alimento_id,
        quantita_g: v.quantita_g,
        ordine: indice,
      })
    )
  );

  return true;
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

// Cancellare un alimento dal catalogo (CreaAlimentoForm, "Elimina") lo toglie
// anche da ogni pasto salvato che lo conteneva — regola decisa, senza
// avviso all'utente (già valutato e scartato, non riproporlo):
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
export async function rimuoviAlimentoDaPastiSalvati(
  userId: string,
  alimentoId: string
): Promise<void> {
  const [composizioni, composizioniVoci] = await Promise.all([
    repositoryComposizioni.ottieniTutti(userId),
    repositoryComposizioniVoci.ottieniTutti(userId),
  ]);

  const vociDaEliminare = composizioniVoci.filter((v) => v.alimento_id === alimentoId);
  if (vociDaEliminare.length === 0) return;

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
}
