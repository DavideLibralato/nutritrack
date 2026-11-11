// Il target di una giornata (PUNTO_DI_PARTENZA.md, sezione 10.5, funzione
// n. 3): il periodo valido quel giorno, dentro il periodo il set di target
// del tipo di giorno giusto, con il ripiego su "normale".
//
// Sono tre funzioni che esistevano già (obiettivoValidoPer,
// tipoGiornoEffettivo, targetEffettivo) e che Oggi combinava a mano. Qui
// stanno insieme una volta sola, così Statistiche e Oggi passano dalla
// stessa strada e mostrano gli stessi numeri per lo stesso giorno.
// Funzione pura: le liste le passa chi chiama (già lette da Dexie).

import { obiettivoValidoPer } from "./totaliDiario";
import { tipoGiornoEffettivo } from "./repository/giorni";
import { targetEffettivo, targetPerTipo } from "./repository/obiettiviTarget";
import { TIPO_GIORNO_NORMALE } from "./db/tipi";
import type {
  Giorno,
  Obiettivo,
  ObiettivoTarget,
  Profilo,
  TipoGiorno,
  TipoObiettivo,
} from "./db/tipi";

export interface DatiObiettivi {
  obiettivi: Obiettivo[];
  obiettiviTarget: ObiettivoTarget[];
  giorni: Giorno[];
  profilo: Profilo | null;
}

export interface TargetDelGiorno {
  // I numeri del giorno. null solo se non esiste nessun obiettivo (o, per
  // un periodo rotto, nemmeno la riga "normale").
  target: ObiettivoTarget | null;
  // Dimagrire / mantenere / massa: quello del periodo valido QUEL giorno,
  // serve alla regola dei colori (esitoObiettivo.ts).
  tipoObiettivo: TipoObiettivo | null;
  // La classificazione vera del giorno: la riga scritta in `giorni`, o la
  // proposta della settimana tipo per un giorno mai scritto.
  tipoGiorno: TipoGiorno;
  // Cosa si mostra: se manca il target del tipo scritto, "normale", come la
  // pastiglia di Oggi, per non scrivere "Allenamento" sopra numeri che sono
  // quelli di "Normale".
  tipoGiornoMostrato: TipoGiorno;
}

export function targetDelGiorno(dati: DatiObiettivi, iso: string): TargetDelGiorno {
  const obiettivo = obiettivoValidoPer(dati.obiettivi, iso);
  const tipoGiorno = tipoGiornoEffettivo(dati.giorni, dati.profilo, iso);

  if (!obiettivo) {
    return { target: null, tipoObiettivo: null, tipoGiorno, tipoGiornoMostrato: tipoGiorno };
  }

  const haTargetDelTipo = targetPerTipo(dati.obiettiviTarget, obiettivo.id, tipoGiorno) !== null;
  return {
    target: targetEffettivo(dati.obiettiviTarget, obiettivo.id, tipoGiorno),
    tipoObiettivo: obiettivo.tipo,
    tipoGiorno,
    tipoGiornoMostrato: haTargetDelTipo ? tipoGiorno : TIPO_GIORNO_NORMALE,
  };
}
