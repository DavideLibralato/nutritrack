// La proposta di target dal fabbisogno, con i controlli che vengono prima
// del calcolo (PUNTO_DI_PARTENZA.md, sezione 3, "Obiettivi" e
// "Onboarding"): "Calcola proposta" in Impostazioni > Obiettivi e il passo
// 5 dell'onboarding usano la stessa regola.
//
// Funzione pura: i dati entrano come parametri, niente Dexie. Restituisce
// la proposta oppure il motivo per cui non c'è; i testi dei messaggi li
// sceglie chi chiama. Test in propostaObiettivi.test.ts.

import { calcolaEta, calcolaFabbisogno, type PropostaFabbisogno } from "../fabbisogno";
import { numeroDaCampo, type ValoriModulo } from "./salvataggioProfilo";
import type { TipoObiettivo } from "../db/tipi";

// I dati personali che servono al calcolo e possono mancare.
export type DatoMancante = "dataNascita" | "altezza" | "livelloAttivita";

export type EsitoProposta =
  | { esito: "proposta"; proposta: PropostaFabbisogno }
  // Nessuna pesata registrata: il calcolo usa il peso.
  | { esito: "senza-pesata" }
  // Mifflin-St Jeor richiede il sesso (sezione "Il calcolo del fabbisogno").
  | { esito: "sesso-non-indicato" }
  // Almeno un dato personale vuoto (o un'altezza che non è un numero
  // maggiore di zero); `mancano` li elenca tutti, nell'ordine dei campi.
  | { esito: "dati-mancanti"; mancano: DatoMancante[] };

// L'ordine dei controlli è quello di "Calcola proposta" prima del 17/10:
// pesata, poi sesso, poi gli altri dati.
//
// `oggi`: il giorno per l'età (calcolaEta); parametro solo per i test.
export function propostaObiettivi(
  dati: ValoriModulo["datiPersonali"],
  pesoKg: number | null,
  tipoObiettivo: TipoObiettivo,
  oggi: Date = new Date()
): EsitoProposta {
  if (pesoKg === null) return { esito: "senza-pesata" };
  if (dati.sesso === "non_indicato") return { esito: "sesso-non-indicato" };

  const altezza = numeroDaCampo(dati.altezzaCm);
  const mancano: DatoMancante[] = [];
  if (!dati.dataNascita) mancano.push("dataNascita");
  if (Number.isNaN(altezza) || altezza <= 0) mancano.push("altezza");
  if (!dati.livelloAttivita) mancano.push("livelloAttivita");
  // `!dati.livelloAttivita` ripetuto qui, e non solo `mancano.length > 0`:
  // così TypeScript sa che sotto il livello non è più "".
  if (mancano.length > 0 || !dati.livelloAttivita) return { esito: "dati-mancanti", mancano };

  return {
    esito: "proposta",
    proposta: calcolaFabbisogno({
      sesso: dati.sesso,
      eta: calcolaEta(dati.dataNascita, oggi),
      altezzaCm: altezza,
      pesoKg,
      livelloAttivita: dati.livelloAttivita,
      tipoObiettivo,
    }),
  };
}
