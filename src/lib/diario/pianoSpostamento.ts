// Sposta un alimento o un pasto intero in un altro pasto dello stesso
// giorno (PUNTO_DI_PARTENZA.md, sezione 3, "Tieni premuto: sposta, duplica,
// elimina"): le decisioni, senza database e senza React. Righe dentro,
// elenco di scritture fuori — così ogni regola si testa con una manciata di
// righe finte. Chi legge le righe da Dexie e applica le scritture è
// spostaNelPasto in src/lib/repository/vociDiario.ts.
//
// Doppione: lo STESSO alimento del catalogo (stesso `alimento_id`) presente
// sia nelle righe che si spostano sia nel pasto di destinazione. Mai un
// confronto per nome; una voce senza `alimento_id` non è mai un doppione.
// Per ogni doppione c'è una scelta:
// - somma: una riga sola, con il totale dei grammi. Resta la riga di
//   destinazione con i SUOI valori copiati (decisione 4 del piano: se nel
//   frattempo l'alimento è stato corretto nel catalogo, le due righe possono
//   avere valori per 100 g diversi); le altre si cancellano;
// - separati: le righe che arrivano si spostano e basta, accanto a quelle
//   che c'erano;
// - scrivi: una riga sola con i grammi scritti a mano, che non tengono
//   conto né della partenza né della destinazione;
// - escludi ("Non spostarlo"): le righe di quell'alimento restano dove
//   sono; il resto si sposta comunque. Vale anche se alla conferma non è
//   più un doppione (togliEsclusi).
// Più righe dello stesso alimento (dopo un "Tieni separati", decisione 3):
// le quantità si sommano per alimento, e somma/scrivi riducono TUTTE le
// righe di quell'alimento, di partenza e di destinazione, a una sola.

import type { VoceDiario } from "../db/tipi";
import { arrotondaDecimali } from "../numeriDecimali";
import { GRAMMI_MASSIMI } from "../inserimento/grammi";

export type SceltaDoppione =
  | { tipo: "somma" }
  | { tipo: "separati" }
  | { tipo: "scrivi"; grammi: number }
  | { tipo: "escludi" };

export interface Doppione {
  alimentoId: string;
  nome: string;
  // Somma delle righe di quell'alimento già nel pasto di destinazione...
  grammiEsistenti: number;
  // ...e di quelle che arrivano.
  grammiInArrivo: number;
  // Quante righe per parte (di solito una e una; di più dopo un "Tieni
  // separati", decisione 3): servono a dire bene cosa fa "Tieni separati".
  righeEsistenti: number;
  righeInArrivo: number;
}

export type Scrittura =
  | { tipo: "aggiorna"; id: string; modifiche: Partial<Pick<VoceDiario, "pasto_id" | "quantita_g">> }
  | { tipo: "elimina"; id: string }
  // Una riga nuova (Duplica, src/lib/diario/pianoDuplica.ts).
  | { tipo: "crea"; dati: Omit<VoceDiario, "id" | "updated_at" | "deleted_at"> };

export interface PianoSpostamento {
  scritture: Scrittura[];
  // Nomi degli alimenti che si sono spostati davvero (anche fusi in una
  // riga di destinazione), uno per alimento, nell'ordine delle righe.
  spostati: string[];
  // Nomi degli alimenti rimasti dov'erano per "Non spostarlo".
  esclusi: string[];
}

// I grammi hanno due decimali (numeric(7,2), src/lib/inserimento/grammi.ts):
// 10,1 + 20,2 in virgola mobile fa 30,299999999999997. Stessa regola di
// ogni numero scritto (arrotondaDecimali).
export function arrotondaGrammi(g: number): number {
  return arrotondaDecimali(g, 2);
}

// Quello che serve per raggruppare e sommare: va bene sia una riga già
// salvata sia una riga nuova non ancora scritta (pianoInserimento.ts).
type RigaPerAlimento = Pick<VoceDiario, "alimento_id" | "quantita_g" | "nome_alimento">;

export function sommaGrammi(voci: RigaPerAlimento[]): number {
  return arrotondaGrammi(voci.reduce((t, v) => t + v.quantita_g, 0));
}

// Il totale di "Somma" per un doppione: quello che il foglio mostra
// ("Somma (150 g)", SheetDoppioni) e quello che i piani scrivono. Una
// funzione sola, così i due numeri non possono divergere.
export function totaleSomma(grammiEsistenti: number, grammiInArrivo: number): number {
  return arrotondaGrammi(grammiEsistenti + grammiInArrivo);
}

// Oltre 99999,99 g (numeric(7,2), GRAMMI_MASSIMI): Dexie salverebbe la
// riga, il server la rifiuterebbe e la sync la accantonerebbe dopo 5
// tentativi.
export function oltreIlMassimo(grammi: number): boolean {
  return grammi > GRAMMI_MASSIMI;
}

// I grammi della riga che resta con Somma o Scrivi quantità, comuni a
// pianoSpostamento e pianoInserimento. Il foglio spegne già Somma oltre il
// massimo e "Scrivi quantità" non lo accetta, ma alla conferma le righe si
// rileggono da Dexie e possono essere cambiate (un altro dispositivo): qui
// è la rete di sicurezza. Oltre il massimo è un errore, e il piano non
// produce scritture: la pagina mostra il suo messaggio d'errore e alla
// sync non arriva niente.
export function grammiRigaCheResta(
  scelta: Extract<SceltaDoppione, { tipo: "somma" | "scrivi" }>,
  esistenti: RigaPerAlimento[],
  arrivano: RigaPerAlimento[]
): number {
  const grammi =
    scelta.tipo === "somma"
      ? totaleSomma(sommaGrammi(esistenti), sommaGrammi(arrivano))
      : arrotondaGrammi(scelta.grammi);
  if (oltreIlMassimo(grammi)) {
    throw new Error(`Quantità oltre il massimo di ${GRAMMI_MASSIMI} g: ${grammi} g`);
  }
  return grammi;
}

// Chiave di raggruppamento: l'alimento del catalogo. Le voci senza
// alimento_id non hanno chiave (null) e non sono mai doppioni.
function chiave(v: RigaPerAlimento): string | null {
  return v.alimento_id;
}

function perAlimento<T extends RigaPerAlimento>(voci: T[]): Map<string, T[]> {
  const mappa = new Map<string, T[]>();
  for (const v of voci) {
    const k = chiave(v);
    if (k === null) continue;
    mappa.set(k, [...(mappa.get(k) ?? []), v]);
  }
  return mappa;
}

// Toglie le righe degli alimenti con "Non spostarlo" / "Non duplicarlo" /
// "Non aggiungerlo" PRIMA del piano, e ne restituisce i nomi (uno per
// alimento, nell'ordine delle righe). Va fatto sempre, non solo per gli
// alimenti che alla conferma sono ancora doppioni: se il doppione sparisce
// fra il foglio e la conferma (cancellato da un altro dispositivo), un "no"
// esplicito dell'utente vale più di un cambiamento arrivato da altrove
// (regola del 10/10). La usano pianoSpostamento e pianoInserimento (quindi
// anche Duplica): Sposta, Duplica e Aggiungi seguono la stessa regola.
export function togliEsclusi<T extends RigaPerAlimento>(
  righe: T[],
  scelte: Record<string, SceltaDoppione>
): { restano: T[]; esclusi: string[] } {
  const escluso = (v: T) => v.alimento_id !== null && scelte[v.alimento_id]?.tipo === "escludi";
  return {
    restano: righe.filter((v) => !escluso(v)),
    esclusi: [...new Set(righe.filter(escluso).map((v) => v.nome_alimento))],
  };
}

// La riga di destinazione che resta, quando un doppione si riduce a una
// riga sola: la più vecchia (creato_il, poi id), così la scelta non dipende
// dall'ordine in cui Dexie restituisce le righe.
export function rigaCheResta(voci: VoceDiario[]): VoceDiario {
  return [...voci].sort(
    (a, b) => a.creato_il.localeCompare(b.creato_il) || a.id.localeCompare(b.id)
  )[0];
}

// I doppioni fra le righe che si spostano e quelle della destinazione, nell'
// ordine in cui gli alimenti compaiono fra le righe che si spostano.
export function trovaDoppioni(partenza: RigaPerAlimento[], destinazione: RigaPerAlimento[]): Doppione[] {
  const inDestinazione = perAlimento(destinazione);
  const inArrivo = perAlimento(partenza);
  const doppioni: Doppione[] = [];
  for (const [alimentoId, arrivano] of inArrivo) {
    const esistenti = inDestinazione.get(alimentoId);
    if (!esistenti) continue;
    doppioni.push({
      alimentoId,
      nome: arrivano[0].nome_alimento,
      grammiEsistenti: sommaGrammi(esistenti),
      grammiInArrivo: sommaGrammi(arrivano),
      righeEsistenti: esistenti.length,
      righeInArrivo: arrivano.length,
    });
  }
  return doppioni;
}

// Gli stessi alimenti in doppione (le quantità possono essere cambiate,
// conta solo quali sono): serve a capire se le scelte fatte nel foglio
// valgono ancora per le righe rilette al momento della conferma.
export function stessiDoppioni(a: Doppione[], b: Doppione[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((d) => d.alimentoId));
  return b.every((d) => ids.has(d.alimentoId));
}

// Il piano: quali righe aggiornare e quali cancellare. `scelte` per
// alimentoId; un doppione senza scelta è un errore di chi chiama (le scelte
// vengono dal foglio, che le chiede tutte).
//
// `idGrammiNuovi` (cambio di pasto dallo sheet di modifica in Oggi, caso 1
// dei "doppioni rimasti", 18/10): quella riga di `partenza` porta già i
// grammi scritti nello sheet, diversi da quelli salvati, e vanno scritti
// anche loro. Una scrittura sola per riga, mai una su una riga che poi si
// cancella:
// - si sposta (nessun doppione, Tieni separati): lo stesso `aggiorna` porta
//   pasto e grammi;
// - Somma o Scrivi quantità: la riga si cancella, e i suoi grammi nuovi
//   sono già nel totale della riga che resta;
// - Non spostarlo: resta dov'è con i grammi nuovi, un `aggiorna` dei soli
//   grammi (decisione di Davide del 18/10).
export function pianoSpostamento({
  partenza,
  destinazione,
  pastoDestinazioneId,
  scelte,
  idGrammiNuovi = null,
}: {
  partenza: VoceDiario[];
  destinazione: VoceDiario[];
  pastoDestinazioneId: string;
  scelte: Record<string, SceltaDoppione>;
  idGrammiNuovi?: string | null;
}): PianoSpostamento {
  const piano = pianoSenzaGrammiNuovi({ partenza, destinazione, pastoDestinazioneId, scelte });
  const conGrammi = idGrammiNuovi === null ? undefined : partenza.find((v) => v.id === idGrammiNuovi);
  if (!conGrammi) return piano;

  const sua = piano.scritture.find((s) => s.tipo !== "crea" && s.id === conGrammi.id);
  if (!sua) {
    piano.scritture.unshift({ tipo: "aggiorna", id: conGrammi.id, modifiche: { quantita_g: conGrammi.quantita_g } });
  } else if (sua.tipo === "aggiorna") {
    sua.modifiche = { ...sua.modifiche, quantita_g: conGrammi.quantita_g };
  }
  return piano;
}

// I grammi con cui una voce spostata si ritrova nel pasto di destinazione,
// letti dal piano: quelli dell'aggiorna che la sposta (pasto e grammi
// insieme), o quelli della riga che resta con Somma o Scrivi quantità.
// null se il piano non scrive grammi in destinazione (Non spostarlo, o
// spostamento dei soli pasti). Serve al messaggio della barra.
export function grammiInDestinazione(piano: PianoSpostamento, idVoce: string): number | null {
  for (const s of piano.scritture) {
    if (s.tipo !== "aggiorna" || s.modifiche.quantita_g === undefined) continue;
    // La voce stessa con i soli grammi è "Non spostarlo": resta dov'era.
    if (s.id === idVoce && s.modifiche.pasto_id === undefined) continue;
    return s.modifiche.quantita_g;
  }
  return null;
}

function pianoSenzaGrammiNuovi({
  partenza,
  destinazione,
  pastoDestinazioneId,
  scelte,
}: {
  partenza: VoceDiario[];
  destinazione: VoceDiario[];
  pastoDestinazioneId: string;
  scelte: Record<string, SceltaDoppione>;
}): PianoSpostamento {
  const scritture: Scrittura[] = [];
  const spostati: string[] = [];
  const { restano, esclusi } = togliEsclusi(partenza, scelte);
  const inDestinazione = perAlimento(destinazione);
  const giaDecisi = new Set<string>();

  // Le righe che sono già nel pasto di destinazione non si muovono.
  const daSpostare = restano.filter((v) => v.pasto_id !== pastoDestinazioneId);

  for (const voce of daSpostare) {
    const k = chiave(voce);
    const esistenti = k === null ? undefined : inDestinazione.get(k);

    if (!esistenti) {
      // Nessun doppione: si riassegna il pasto.
      scritture.push({ tipo: "aggiorna", id: voce.id, modifiche: { pasto_id: pastoDestinazioneId } });
      if (k === null || !giaDecisi.has(k)) spostati.push(voce.nome_alimento);
      if (k !== null) giaDecisi.add(k);
      continue;
    }

    // Doppione: si decide una volta per alimento, su tutte le sue righe.
    if (giaDecisi.has(k!)) continue;
    giaDecisi.add(k!);
    const scelta = scelte[k!];
    if (!scelta) throw new Error(`Manca la scelta per il doppione ${k}`);
    const arrivano = daSpostare.filter((v) => v.alimento_id === k);

    switch (scelta.tipo) {
      case "escludi":
        // Non arriva qui: le righe escluse le ha già tolte togliEsclusi.
        break;
      case "separati":
        for (const v of arrivano) {
          scritture.push({ tipo: "aggiorna", id: v.id, modifiche: { pasto_id: pastoDestinazioneId } });
        }
        spostati.push(voce.nome_alimento);
        break;
      case "somma":
      case "scrivi": {
        const resta = rigaCheResta(esistenti);
        const grammi = grammiRigaCheResta(scelta, esistenti, arrivano);
        scritture.push({ tipo: "aggiorna", id: resta.id, modifiche: { quantita_g: grammi } });
        for (const v of [...esistenti, ...arrivano]) {
          if (v.id !== resta.id) scritture.push({ tipo: "elimina", id: v.id });
        }
        spostati.push(voce.nome_alimento);
        break;
      }
    }
  }

  return { scritture, spostati, esclusi };
}
