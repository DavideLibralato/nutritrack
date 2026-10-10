// Righe NUOVE che entrano in un pasto, con i doppioni (PUNTO_DI_PARTENZA.md,
// sezione 3, "Doppioni"): le decisioni, senza database e senza React, come
// pianoSpostamento.ts. È il cuore comune di Duplica (pianoDuplica.ts, che
// prepara le copie e poi chiama questa) e dell'inserimento da /aggiungi.
//
// Chi chiama passa le righe già pronte (`nuove`: pasto, giorno, creato_il,
// consumato_alle, gruppo_id e valori nutrizionali decisi da lui) e le righe
// che sono già nel pasto di destinazione. Qui si decide solo cosa si crea,
// cosa si aggiorna e cosa si cancella.
//
// Doppione: un'altra riga dello stesso alimento (stesso `alimento_id`, mai
// il nome) già nel pasto di destinazione. Le righe nuove non sono mai
// doppioni fra loro: due Mela in un pasto salvato restano due righe, se
// nella destinazione non c'è già una Mela. Per ogni doppione c'è una scelta:
// - somma: la riga di destinazione prende il totale (sua quantità + quella
//   in arrivo), con i SUOI valori; nessuna riga nuova;
// - scrivi: la riga di destinazione prende i grammi scritti; nessuna riga
//   nuova;
// - separati: le righe nuove si creano accanto;
// - escludi ("Non duplicarlo", "Non aggiungerlo"): niente.
// Più righe dello stesso alimento a destinazione: somma e scrivi le
// riducono a una (la più vecchia, rigaCheResta), come in Sposta.

import type { VoceDiario } from "../db/tipi";
import {
  arrotondaGrammi,
  rigaCheResta,
  sommaGrammi,
  trovaDoppioni,
  type Doppione,
  type SceltaDoppione,
  type Scrittura,
} from "./pianoSpostamento";

// Una riga nuova, senza i campi tecnici che crea() assegna da sé.
export type DatiVoce = Omit<VoceDiario, "id" | "updated_at" | "deleted_at">;

export interface PianoInserimento {
  scritture: Scrittura[];
  // Nomi degli alimenti entrati davvero (con una riga nuova, o sommati in
  // una riga di destinazione), uno per alimento.
  inseriti: string[];
  // Nomi degli alimenti lasciati fuori con la quarta scelta.
  esclusi: string[];
}

export function doppioniInserimento(nuove: DatiVoce[], destinazione: VoceDiario[]): Doppione[] {
  return trovaDoppioni(nuove, destinazione);
}

export function pianoInserimento({
  nuove,
  destinazione,
  scelte,
}: {
  nuove: DatiVoce[];
  destinazione: VoceDiario[];
  scelte: Record<string, SceltaDoppione>;
}): PianoInserimento {
  const scritture: Scrittura[] = [];
  const inseriti: string[] = [];
  const esclusi: string[] = [];
  const giaDecisi = new Set<string>();

  for (const dati of nuove) {
    const k = dati.alimento_id;
    const esistenti = k === null ? [] : destinazione.filter((v) => v.alimento_id === k);

    if (esistenti.length === 0) {
      scritture.push({ tipo: "crea", dati });
      if (k === null || !giaDecisi.has(k)) inseriti.push(dati.nome_alimento);
      if (k !== null) giaDecisi.add(k);
      continue;
    }

    // Doppione: si decide una volta per alimento, su tutte le sue righe.
    if (giaDecisi.has(k!)) continue;
    giaDecisi.add(k!);
    const scelta = scelte[k!];
    if (!scelta) throw new Error(`Manca la scelta per il doppione ${k}`);
    const arrivano = nuove.filter((n) => n.alimento_id === k);

    switch (scelta.tipo) {
      case "escludi":
        esclusi.push(dati.nome_alimento);
        break;
      case "separati":
        for (const n of arrivano) scritture.push({ tipo: "crea", dati: n });
        inseriti.push(dati.nome_alimento);
        break;
      case "somma":
      case "scrivi": {
        const resta = rigaCheResta(esistenti);
        const grammi =
          scelta.tipo === "somma"
            ? arrotondaGrammi(sommaGrammi(esistenti) + sommaGrammi(arrivano))
            : arrotondaGrammi(scelta.grammi);
        scritture.push({ tipo: "aggiorna", id: resta.id, modifiche: { quantita_g: grammi } });
        for (const v of esistenti) {
          if (v.id !== resta.id) scritture.push({ tipo: "elimina", id: v.id });
        }
        inseriti.push(dati.nome_alimento);
        break;
      }
    }
  }

  return { scritture, inseriti, esclusi };
}
