// Il grafico del peso della pagina Statistiche (PUNTO_DI_PARTENZA.md,
// sezione 3, "Statistiche", "Peso"). Non segue il selettore Settimana /
// Mese: le pesate delle ultime 12 settimane, o tutte se sono meno, su un
// asse di date vere che arriva fino a oggi. Funzioni pure.

import { formattaGiornoMese, giorniFra, piuGiorni } from "./dataGiorno";
import { millisecondiDi } from "./istanti";
import { chilogrammi } from "./profilo/testiPeso";
import type { Misurazione } from "./db/tipi";

export const SETTIMANE_PESO = 12;

export interface Pesata {
  data: string;
  valore: number;
}

// Le pesate vive di tipo peso fino a oggi, una per giorno, dalla più
// vecchia. Due pesate nello stesso giorno non dovrebbero esistere
// (registraPesoSenzaDuplicati), ma due telefoni offline possono crearle:
// vince la più recente per updated_at, confrontato come istante.
export function pesateVive(misurazioni: Misurazione[], oggi: string): Pesata[] {
  const perGiorno = new Map<string, Misurazione>();
  for (const m of misurazioni) {
    if (m.tipo !== "peso" || m.deleted_at !== null || m.data > oggi) continue;
    const presente = perGiorno.get(m.data);
    if (!presente || millisecondiDi(m.updated_at) > millisecondiDi(presente.updated_at)) {
      perGiorno.set(m.data, m);
    }
  }
  return [...perGiorno.values()]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((m) => ({ data: m.data, valore: m.valore }));
}

export type GraficoPeso =
  | { stato: "nessuna" }
  // Ci sono pesate, ma tutte più vecchie di 12 settimane.
  | { stato: "fuori-finestra"; ultima: Pesata }
  | { stato: "pesate"; pesate: Pesata[]; inizioAsse: string; fineAsse: string };

// L'asse parte dalla prima pesata mostrata se tutte le pesate stanno nelle
// 12 settimane; se ce ne sono di più vecchie, dall'inizio della finestra
// (così si vede che il grafico è tagliato). Finisce sempre oggi.
export function graficoPeso(misurazioni: Misurazione[], oggi: string): GraficoPeso {
  const tutte = pesateVive(misurazioni, oggi);
  if (tutte.length === 0) return { stato: "nessuna" };

  const inizioFinestra = piuGiorni(oggi, -7 * SETTIMANE_PESO);
  const pesate = tutte.filter((p) => p.data >= inizioFinestra);
  if (pesate.length === 0) return { stato: "fuori-finestra", ultima: tutte[tutte.length - 1] };

  const tagliate = pesate.length < tutte.length;
  return {
    stato: "pesate",
    pesate,
    inizioAsse: tagliate ? inizioFinestra : pesate[0].data,
    fineAsse: oggi,
  };
}

// "+1,0 kg dal 20 set", "−0,4 kg dal 3 ott": sempre un decimale (è una
// differenza, si confrontano i decimali), il meno tipografico come nel
// mockup. null con una pesata sola: non c'è niente da confrontare.
export function testoDifferenzaPeso(pesate: Pesata[]): string | null {
  if (pesate.length < 2) return null;
  const prima = pesate[0];
  const ultima = pesate[pesate.length - 1];
  // Arrotondata prima del segno: 84,3 − 83,3 in JavaScript fa 1,0000000000000142
  // e un -0,04 deve diventare 0,0, non "−0,0".
  const differenza = Math.round((ultima.valore - prima.valore) * 10) / 10;
  const segno = differenza > 0 ? "+" : differenza < 0 ? "−" : "";
  const numero = Math.abs(differenza).toFixed(1).replace(".", ",");
  return `${segno}${numero} kg dal ${formattaGiornoMese(prima.data)}`;
}

// "Ultima pesata 24 ott, 16 giorni fa"; "Ultima pesata oggi" e "Ultima
// pesata ieri" invece di 0 e 1 giorni. L'anno solo se non è quello di oggi.
export function testoUltimaPesataStatistiche(data: string, oggi: string): string {
  const giorni = giorniFra(data, oggi);
  if (giorni === 0) return "Ultima pesata oggi";
  if (giorni === 1) return "Ultima pesata ieri";
  const anno = data.slice(0, 4) === oggi.slice(0, 4) ? "" : ` ${data.slice(0, 4)}`;
  return `Ultima pesata ${formattaGiornoMese(data)}${anno}, ${giorni} giorni fa`;
}

// Il valore scritto accanto a un punto: "84", "84,3", come in tutta l'app.
export function testoValorePeso(valore: number): string {
  return chilogrammi(valore);
}
