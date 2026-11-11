// Le medie settimanali e mensili della pagina Statistiche
// (PUNTO_DI_PARTENZA.md, sezione 3, "Statistiche"; sezione 10.5, funzione
// n. 2: "con giorni vuoti in mezzo, è il caso che sbaglia più facilmente e
// non se ne accorge nessuno").
//
// Le regole:
//   - la media conta solo i giorni con almeno una voce, fino a oggi: un
//     giorno vuoto non abbassa la media, una voce pianificata per domani
//     non conta;
//   - l'obiettivo medio si calcola sugli STESSI giorni contati, ognuno con
//     il suo target (targetDelGiorno);
//   - i totali non si memorizzano mai: si ricalcolano dalle voci.
// Funzioni pure.

import { sommaTotali } from "./totaliDiario";
import { targetDelGiorno } from "./targetGiorno";
import type { DatiObiettivi } from "./targetGiorno";
import type { TotaliNutrizionali } from "./totaliDiario";
import type { Grandezza } from "./esitoObiettivo";
import type { ObiettivoTarget, TipoGiorno, TipoObiettivo, VoceDiario } from "./db/tipi";

export interface GiornoStatistiche {
  data: string;
  // Dopo oggi: niente barra, non conta nelle medie (eFuturo, ma con l'oggi
  // passato da chi chiama, lo stesso di useGiornoCorrente).
  futuro: boolean;
  // null = nessuna voce quel giorno.
  totali: TotaliNutrizionali | null;
  target: ObiettivoTarget | null;
  tipoObiettivo: TipoObiettivo | null;
  tipoGiorno: TipoGiorno;
  tipoGiornoMostrato: TipoGiorno;
}

// Le voci vive raggruppate per giorno, in un passaggio solo: un mese sono 31
// giorni, rifiltrare tutta la lista per ognuno sarebbe 31 giri.
function vociPerGiorno(voci: VoceDiario[]): Map<string, VoceDiario[]> {
  const mappa = new Map<string, VoceDiario[]>();
  for (const voce of voci) {
    if (voce.deleted_at !== null) continue;
    const delGiorno = mappa.get(voce.data);
    if (delGiorno) delGiorno.push(voce);
    else mappa.set(voce.data, [voce]);
  }
  return mappa;
}

export function giorniStatistiche(
  giorniISO: string[],
  voci: VoceDiario[],
  dati: DatiObiettivi,
  oggi: string
): GiornoStatistiche[] {
  const perGiorno = vociPerGiorno(voci);
  return giorniISO.map((data) => {
    const delGiorno = perGiorno.get(data);
    return {
      data,
      futuro: data > oggi,
      totali: delGiorno ? sommaTotali(delGiorno) : null,
      ...targetDelGiorno(dati, data),
    };
  });
}

// Il giorno conta nelle medie: almeno una voce e non dopo oggi.
export function giornoContato(giorno: GiornoStatistiche): boolean {
  return !giorno.futuro && giorno.totali !== null;
}

export interface Media {
  valore: number; // non arrotondato: arrotonda chi mostra
  giorniContati: number;
  // La media dei target sugli stessi giorni. null se anche uno solo dei
  // giorni contati non ha target: una media su giorni diversi da quelli
  // della media vera direbbe un'altra cosa.
  obiettivo: number | null;
  // Tutti i giorni contati hanno lo stesso target: "obiettivo X" invece di
  // "obiettivo medio X".
  obiettivoUnico: boolean;
  // Il tipo di obiettivo dell'ultimo giorno contato: è il periodo in cui
  // sei (PUNTO §3, "Quattro riquadri").
  tipoObiettivo: TipoObiettivo | null;
}

export type MediePeriodo = Record<Grandezza, Media>;

const CAMPI: Record<
  Grandezza,
  { totale: keyof TotaliNutrizionali; target: keyof ObiettivoTarget }
> = {
  kcal: { totale: "kcal", target: "kcal" },
  grassi: { totale: "grassi", target: "grassi_g" },
  carboidrati: { totale: "carboidrati", target: "carboidrati_g" },
  proteine: { totale: "proteine", target: "proteine_g" },
};

// null = nessun giorno contato: "—" e "nessun giorno registrato", mai 0.
export function medieDelPeriodo(giorni: GiornoStatistiche[]): MediePeriodo | null {
  const contati = giorni.filter(giornoContato);
  if (contati.length === 0) return null;

  const ultimo = contati[contati.length - 1];
  const media = (grandezza: Grandezza): Media => {
    const { totale, target } = CAMPI[grandezza];
    const valori = contati.map((g) => g.totali![totale]);
    const obiettivi = contati.map((g) => (g.target ? (g.target[target] as number) : null));
    const tuttiConTarget = obiettivi.every((o) => o !== null);
    return {
      valore: valori.reduce((a, b) => a + b, 0) / contati.length,
      giorniContati: contati.length,
      obiettivo: tuttiConTarget
        ? (obiettivi as number[]).reduce((a, b) => a + b, 0) / contati.length
        : null,
      obiettivoUnico: tuttiConTarget && new Set(obiettivi).size === 1,
      tipoObiettivo: ultimo.tipoObiettivo,
    };
  };

  return {
    kcal: media("kcal"),
    grassi: media("grassi"),
    carboidrati: media("carboidrati"),
    proteine: media("proteine"),
  };
}

// Il segno dell'obiettivo sulle barre delle calorie (PUNTO §3, variante
// V1): lo decidono i dati, non l'interruttore dei giorni differenziati.
// Si guardano i giorni fino a oggi, quelli che possono avere una barra:
//   - "linea": tutti con lo stesso target kcal → linea continua con
//     l'etichetta "obiettivo N";
//   - "trattini": target diversi → un trattino sopra ogni barra;
//   - "nessuno": nessun target.
export type SegnoObiettivo =
  { tipo: "linea"; kcal: number } | { tipo: "trattini" } | { tipo: "nessuno" };

export function segnoObiettivo(giorni: GiornoStatistiche[]): SegnoObiettivo {
  const kcal = giorni.filter((g) => !g.futuro && g.target).map((g) => g.target!.kcal);
  if (kcal.length === 0) return { tipo: "nessuno" };
  return new Set(kcal).size === 1 ? { tipo: "linea", kcal: kcal[0] } : { tipo: "trattini" };
}

// Il giorno della prima voce viva fino a oggi: il limite della freccia ‹
// (periodiStatistiche.ts). null se non ce n'è.
export function primoGiornoConVoci(voci: VoceDiario[], oggi: string): string | null {
  let primo: string | null = null;
  for (const voce of voci) {
    if (voce.deleted_at !== null || voce.data > oggi) continue;
    if (primo === null || voce.data < primo) primo = voce.data;
  }
  return primo;
}

// Utente nuovo, per gli stati vuoti: nessuna voce viva, in assoluto (anche
// futura). Chi ha solo voci pianificate vede la pagina normale con
// "nessun giorno registrato" (PUNTO §3, "Stati vuoti").
export function senzaVoci(voci: VoceDiario[]): boolean {
  return voci.every((v) => v.deleted_at !== null);
}
