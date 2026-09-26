// Modifica di un pasto salvato: nome, alimenti e grammi (PUNTO_DI_PARTENZA.md,
// sezione 3, "Salvare un pasto intero").
//
// Stesso schema del Salva unico di Profilo (src/lib/profilo/salvataggioProfilo.ts):
// la schermata (src/components/ModificaPastoSalvato.tsx) tiene due copie del
// modulo — quella caricata da Dexie all'apertura ("caricati") e quella sullo
// schermo ("attuali") — e niente si scrive finché non si preme Salva. Qui
// niente React: è logica che sbaglia in silenzio (una riga riscritta che
// l'utente non ha toccato, una riga viva rimasta senza pasto), quindi ha i
// suoi test permanenti in modificaPastoSalvato.test.ts.
//
// Il diario non si tocca mai: le voci di diario hanno la loro copia dei
// valori (sezione 4), la modifica vale da adesso in avanti. Un giorno che
// conteneva il pasto nella versione vecchia vede spegnersi la stella in
// Oggi, perché non coincide più: è corretto.

import { repositoryComposizioni, repositoryComposizioniVoci } from "../repository";
import { catalogoLocale } from "../repository/alimenti";
import { esisteComposizioneConNome } from "../repository/composizioni";
import { leggiGrammi } from "./grammi";
import type { Alimento, Composizione, ComposizioneVoce } from "../db/tipi";

// --- Il modulo --------------------------------------------------------------

export interface RigaModulo {
  // Identità della riga a schermo: l'id della riga di composizioni_voci per
  // una riga già salvata, un uuid temporaneo per una riga aggiunta qui.
  chiave: string;
  // null = riga nuova, ancora da creare al Salva.
  voceId: string | null;
  alimentoId: string;
  // Solo per mostrarla: se nel frattempo l'alimento sparisce dal catalogo,
  // la schermata ha ancora un nome da scrivere accanto all'avviso.
  nomeAlimento: string;
  // Stringa, come nel campo: "" vuol dire vuoto. Numero solo al Salva.
  grammi: string;
}

export interface ModuloPasto {
  nome: string;
  righe: RigaModulo[];
}

// Il modulo a partire da Dexie. Solo le righe vive il cui alimento è ancora
// nel catalogo, in ordine di `ordine`: stessa regola di
// vociValidePerComposizione in pastiSalvati.ts, così la schermata mostra
// esattamente il pasto che si vede in Preferiti.
export function moduloDaDati(
  composizione: Composizione,
  catalogo: Alimento[],
  composizioniVoci: ComposizioneVoce[]
): ModuloPasto {
  const perId = new Map(catalogo.map((a) => [a.id, a]));
  const righe = composizioniVoci
    .filter((v) => v.composizione_id === composizione.id && v.deleted_at === null)
    .sort((a, b) => a.ordine - b.ordine)
    .flatMap((v): RigaModulo[] => {
      const alimento = perId.get(v.alimento_id);
      if (!alimento) return [];
      return [
        {
          chiave: v.id,
          voceId: v.id,
          alimentoId: v.alimento_id,
          nomeAlimento: alimento.nome,
          grammi: String(v.quantita_g),
        },
      ];
    });
  return { nome: composizione.nome, righe };
}

// Il modulo come è ora in Dexie; null se il pasto non esiste più.
export async function caricaModuloPasto(
  userId: string,
  composizioneId: string
): Promise<ModuloPasto | null> {
  const stato = await leggiStato(userId, composizioneId);
  return stato.composizione
    ? moduloDaDati(stato.composizione, stato.catalogo, stato.composizioniVoci)
    : null;
}

// --- Operazioni sul modulo (solo memoria, niente Dexie) ---------------------

// "Aggiungi alimento" dalla ricerca. Se l'alimento è già nel pasto, i grammi
// della sua (prima) riga si SOSTITUISCONO con quelli confermati, non si
// sommano: lo sheet si apre coi grammi attuali di quella riga, e il numero
// confermato è quello che finisce nel pasto (deciso il 2026-09-26 — con la
// somma, chi scrive "150" pensando al totale si ritroverebbe 250 senza
// accorgersene). Altrimenti riga nuova in fondo.
export function aggiungiAlimento(
  modulo: ModuloPasto,
  alimento: Alimento,
  grammi: number
): ModuloPasto {
  const indice = modulo.righe.findIndex((r) => r.alimentoId === alimento.id);
  if (indice >= 0) {
    const righe = [...modulo.righe];
    righe[indice] = { ...righe[indice], grammi: String(grammi) };
    return { ...modulo, righe };
  }
  return {
    ...modulo,
    righe: [
      ...modulo.righe,
      {
        chiave: crypto.randomUUID(),
        voceId: null,
        alimentoId: alimento.id,
        nomeAlimento: alimento.nome,
        grammi: String(grammi),
      },
    ],
  };
}

// Grammi dell'alimento già nel pasto (la prima riga, se sono più d'una),
// per aprire lo sheet con quel valore. null se non c'è o il campo non è un
// numero valido.
export function grammiNelModulo(modulo: ModuloPasto, alimentoId: string): number | null {
  const riga = modulo.righe.find((r) => r.alimentoId === alimentoId);
  return riga ? grammiValidi(riga.grammi) : null;
}

// --- Confronto e validazione -------------------------------------------------

// Stessa validazione dello sheet quantità (src/lib/inserimento/grammi.ts):
// limiti di numeric(7,2) e arrotondamento a due decimali. Tutto quello che
// si confronta o si scrive passa da qui, mai dal numero grezzo del campo:
// Dexie deve tenere lo stesso valore che terrà il server.
export function erroreGrammi(valore: string): string | null {
  return leggiGrammi(valore).errore;
}

// I grammi del campo, già arrotondati; null se il campo non è valido.
export function grammiValidi(valore: string): number | null {
  return leggiGrammi(valore).grammi;
}

export function erroreNome(valore: string): string | null {
  return valore.trim() === "" ? "Inserisci un nome" : null;
}

// Grammi uguali una volta arrotondati ("150" e "150,0", "12,345" e
// "12,35"); un campo non valido si confronta come testo.
function stessiGrammi(a: string, b: string): boolean {
  const na = grammiValidi(a);
  const nb = grammiValidi(b);
  if (na === null || nb === null) return a.trim() === b.trim();
  return na === nb;
}

// Lo schermo è diverso da quanto caricato? Decide se Salva e "Annulla
// modifiche" sono attivi e se uscire va avvisato.
export function moduloModificato(caricati: ModuloPasto, attuali: ModuloPasto): boolean {
  if (caricati.nome.trim() !== attuali.nome.trim()) return true;
  if (caricati.righe.length !== attuali.righe.length) return true;
  return caricati.righe.some((c, i) => {
    const a = attuali.righe[i];
    return a.chiave !== c.chiave || !stessiGrammi(a.grammi, c.grammi);
  });
}

// Righe con i grammi non validi (chiave → messaggio), per scrivere il
// messaggio accanto a ciascuna.
export function erroriRighe(modulo: ModuloPasto): Record<string, string> {
  const errori: Record<string, string> = {};
  for (const r of modulo.righe) {
    const e = erroreGrammi(r.grammi);
    if (e) errori[r.chiave] = e;
  }
  return errori;
}

// Stesso contenuto salvato: nome, e per ogni riga id, alimento e grammi,
// nello stesso ordine.
function stessoContenuto(a: ModuloPasto, b: ModuloPasto): boolean {
  if (a.nome !== b.nome || a.righe.length !== b.righe.length) return false;
  return a.righe.every((r, i) => {
    const s = b.righe[i];
    return r.voceId === s.voceId && r.alimentoId === s.alimentoId && stessiGrammi(r.grammi, s.grammi);
  });
}

// --- Salvataggio ---------------------------------------------------------------

export type EsitoModificaPasto =
  // `esclusi`: nomi degli alimenti che l'utente aveva a schermo ma che non
  // sono più nel catalogo (cancellati mentre la schermata era aperta, anche
  // da un altro dispositivo): non sono finiti nel pasto (regola "Alimenti
  // cancellati"). Di norma vuoto.
  | { esito: "salvato"; esclusi: string[] }
  // Nessun alimento valido rimasto (tutti quelli a schermo sono spariti dal
  // catalogo nel frattempo): il pasto è stato cancellato, come quando si
  // toglie l'ultimo alimento. Un pasto salvato vuoto non deve esistere
  // (bug dei pasti fantasma del 2026-09-22).
  | { esito: "eliminato"; esclusi: string[] }
  // Il pasto non c'è più (cancellato da un altro dispositivo). Niente scritto.
  | { esito: "pasto-eliminato" }
  // Nome o righe salvate diversi da quelli caricati all'apertura (modificati
  // da un altro dispositivo). Niente scritto: le modifiche a schermo erano
  // pensate su un'altra versione. `caricati` è la versione riletta, da cui la
  // schermata riparte. Nessuna unione delle due versioni (deciso il
  // 2026-09-26): unire righe aggiunte e tolte da due parti è logica sottile
  // per un caso raro.
  | { esito: "pasto-cambiato"; caricati: ModuloPasto }
  // Nome già usato da un altro pasto salvato. Niente scritto.
  | { esito: "nome-duplicato" }
  // Nome vuoto o grammi non validi: la schermata non dovrebbe permetterlo
  // (Salva disattivato), ma il controllo vero sta qui. Niente scritto.
  | { esito: "da-correggere" };

interface Stato {
  composizione: Composizione | null;
  catalogo: Alimento[];
  composizioniVoci: ComposizioneVoce[];
  composizioni: Composizione[];
}

async function leggiStato(userId: string, composizioneId: string): Promise<Stato> {
  const [composizioni, composizioniVoci, catalogo] = await Promise.all([
    repositoryComposizioni.ottieniTutti(userId),
    repositoryComposizioniVoci.ottieniTutti(userId),
    catalogoLocale(userId),
  ]);
  const composizione =
    composizioni.find((c) => c.id === composizioneId && c.tipo === "pasto_salvato") ?? null;
  return { composizione, catalogo, composizioniVoci, composizioni };
}

// Il Salva. Tutte le decisioni si prendono rileggendo Dexie qui dentro, mai
// dallo stato React della schermata (stesso motivo di salvaProfilo e
// salvaPastoComeComposizione). Controlli, in quest'ordine, prima di
// scrivere qualsiasi cosa:
// 1. il pasto non esiste più → "pasto-eliminato";
// 2. nome/righe salvate diversi da quelli caricati → "pasto-cambiato".
//    Le righe il cui alimento è uscito dal catalogo nel frattempo non
//    contano nel confronto: cancellare un alimento toglie già la sua riga
//    (rimuoviAlimentoDaPastiSalvati), e questo caso ha la sua regola al
//    punto 4, non deve buttare via le altre modifiche;
// 3. nome vuoto o grammi non validi → "da-correggere"; nome già usato da un
//    altro pasto salvato → "nome-duplicato";
// 4. le righe a schermo con l'alimento non più nel catalogo si scartano
//    (tornano in `esclusi`); se non resta niente, il pasto si cancella;
// 5. si scrive.
//
// ORDINE DELLE SCRITTURE, pensato per un guasto a metà (stesso ragionamento
// di handleElimina in CreaAlimentoForm): nome → grammi cambiati → righe
// nuove → cancellazione delle righe tolte. Prima si crea e si aggiorna, poi
// si cancella: finché il pasto conserva almeno un alimento, in nessun
// momento esiste la composizione viva senza righe vive — un guasto a metà
// lascia un pasto con qualche riga in più di quelle volute (visibile,
// correggibile), mai un pasto vuoto.
// Se invece non resta nessun alimento: prima le righe, per ultima la
// composizione (come eliminaComposizione). L'attimo con la composizione
// viva e senza righe qui è inevitabile — l'ordine inverso lascerebbe righe
// vive attaccate a un pasto cancellato, che è peggio. Se il guasto cade lì,
// il pasto resta vivo ma vuoto: invisibile in Preferiti e senza bloccare il
// nome (pastoSalvatoVisibile, correzione del 2026-09-22).
export async function salvaModificaPasto(r: {
  userId: string;
  composizioneId: string;
  caricati: ModuloPasto;
  attuali: ModuloPasto;
}): Promise<EsitoModificaPasto> {
  const stato = await leggiStato(r.userId, r.composizioneId);
  if (!stato.composizione) return { esito: "pasto-eliminato" };

  const riletti = moduloDaDati(stato.composizione, stato.catalogo, stato.composizioniVoci);
  const idCatalogo = new Set(stato.catalogo.map((a) => a.id));
  const caricatiAncoraValidi: ModuloPasto = {
    ...r.caricati,
    righe: r.caricati.righe.filter((riga) => idCatalogo.has(riga.alimentoId)),
  };
  if (!stessoContenuto(caricatiAncoraValidi, riletti)) {
    return { esito: "pasto-cambiato", caricati: riletti };
  }

  const nome = r.attuali.nome.trim();
  if (erroreNome(nome) || Object.keys(erroriRighe(r.attuali)).length > 0) {
    return { esito: "da-correggere" };
  }
  if (
    esisteComposizioneConNome(
      nome,
      stato.catalogo,
      stato.composizioni,
      stato.composizioniVoci,
      r.composizioneId
    )
  ) {
    return { esito: "nome-duplicato" };
  }

  const finali = r.attuali.righe.filter((riga) => idCatalogo.has(riga.alimentoId));
  const esclusi = r.attuali.righe
    .filter((riga) => !idCatalogo.has(riga.alimentoId))
    .map((riga) => riga.nomeAlimento);

  // Tutte le righe vive del pasto, anche quelle con l'alimento fuori dal
  // catalogo che la schermata non mostra: servono per l'ordine delle righe
  // nuove e, se il pasto si cancella, per non lasciarne nessuna orfana.
  const righeVive = stato.composizioniVoci.filter((v) => v.composizione_id === r.composizioneId);

  if (finali.length === 0) {
    await Promise.all(righeVive.map((v) => repositoryComposizioniVoci.elimina(v.id)));
    await repositoryComposizioni.elimina(r.composizioneId);
    return { esito: "eliminato", esclusi };
  }

  // 1. Nome.
  if (nome !== stato.composizione.nome) {
    await repositoryComposizioni.aggiorna(r.composizioneId, { nome });
  }

  // 2. Grammi cambiati, solo sulle righe davvero cambiate: le altre non si
  // riscrivono (un updated_at nuovo senza motivo vincerebbe, in sync, su una
  // modifica fatta altrove a quella riga).
  const grammiRiletti = new Map(riletti.righe.map((riga) => [riga.voceId, riga.grammi]));
  const daAggiornare = finali.filter(
    (riga) =>
      riga.voceId !== null &&
      grammiRiletti.has(riga.voceId) &&
      !stessiGrammi(riga.grammi, grammiRiletti.get(riga.voceId)!)
  );
  await Promise.all(
    daAggiornare.map((riga) =>
      repositoryComposizioniVoci.aggiorna(riga.voceId!, { quantita_g: grammiValidi(riga.grammi)! })
    )
  );

  // 3. Righe nuove, in fondo, nell'ordine in cui sono state aggiunte.
  const ordineMassimo = righeVive.reduce((max, v) => Math.max(max, v.ordine), -1);
  const nuove = finali.filter((riga) => riga.voceId === null);
  await Promise.all(
    nuove.map((riga, i) =>
      repositoryComposizioniVoci.crea({
        user_id: r.userId,
        composizione_id: r.composizioneId,
        alimento_id: riga.alimentoId,
        quantita_g: grammiValidi(riga.grammi)!,
        ordine: ordineMassimo + 1 + i,
      })
    )
  );

  // 4. Righe tolte: quelle salvate (e mostrate) che a schermo non ci sono più.
  const idRimaste = new Set(finali.map((riga) => riga.voceId));
  const daCancellare = riletti.righe.filter((riga) => !idRimaste.has(riga.voceId));
  await Promise.all(daCancellare.map((riga) => repositoryComposizioniVoci.elimina(riga.voceId!)));

  return { esito: "salvato", esclusi };
}
