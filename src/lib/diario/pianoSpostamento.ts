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
//   sono; il resto si sposta comunque.
// Più righe dello stesso alimento (dopo un "Tieni separati", decisione 3):
// le quantità si sommano per alimento, e somma/scrivi riducono TUTTE le
// righe di quell'alimento, di partenza e di destinazione, a una sola.

import type { VoceDiario } from "../db/tipi";

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
  | { tipo: "elimina"; id: string };

export interface PianoSpostamento {
  scritture: Scrittura[];
  // Nomi degli alimenti che si sono spostati davvero (anche fusi in una
  // riga di destinazione), uno per alimento, nell'ordine delle righe.
  spostati: string[];
  // Nomi degli alimenti rimasti dov'erano per "Non spostarlo".
  esclusi: string[];
}

// I grammi hanno due decimali (numeric(7,2), src/lib/inserimento/grammi.ts):
// 10,1 + 20,2 in virgola mobile fa 30,299999999999997.
export function arrotondaGrammi(g: number): number {
  return Math.round(g * 100) / 100;
}

function sommaGrammi(voci: VoceDiario[]): number {
  return arrotondaGrammi(voci.reduce((t, v) => t + v.quantita_g, 0));
}

// Chiave di raggruppamento: l'alimento del catalogo. Le voci senza
// alimento_id non hanno chiave (null) e non sono mai doppioni.
function chiave(v: VoceDiario): string | null {
  return v.alimento_id;
}

function perAlimento(voci: VoceDiario[]): Map<string, VoceDiario[]> {
  const mappa = new Map<string, VoceDiario[]>();
  for (const v of voci) {
    const k = chiave(v);
    if (k === null) continue;
    mappa.set(k, [...(mappa.get(k) ?? []), v]);
  }
  return mappa;
}

// La riga di destinazione che resta, quando un doppione si riduce a una
// riga sola: la più vecchia (creato_il, poi id), così la scelta non dipende
// dall'ordine in cui Dexie restituisce le righe.
function rigaCheResta(voci: VoceDiario[]): VoceDiario {
  return [...voci].sort(
    (a, b) => a.creato_il.localeCompare(b.creato_il) || a.id.localeCompare(b.id)
  )[0];
}

// I doppioni fra le righe che si spostano e quelle della destinazione, nell'
// ordine in cui gli alimenti compaiono fra le righe che si spostano.
export function trovaDoppioni(partenza: VoceDiario[], destinazione: VoceDiario[]): Doppione[] {
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
export function pianoSpostamento({
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
  const esclusi: string[] = [];
  const inDestinazione = perAlimento(destinazione);
  const giaDecisi = new Set<string>();

  // Le righe che sono già nel pasto di destinazione non si muovono.
  const daSpostare = partenza.filter((v) => v.pasto_id !== pastoDestinazioneId);

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
        esclusi.push(voce.nome_alimento);
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
        const grammi =
          scelta.tipo === "somma"
            ? arrotondaGrammi(sommaGrammi(esistenti) + sommaGrammi(arrivano))
            : arrotondaGrammi(scelta.grammi);
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
