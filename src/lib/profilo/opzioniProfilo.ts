// Le scelte dei dati personali e dell'obiettivo, con le etichette che vede
// l'utente. Una sola definizione per Impostazioni > Profilo, Impostazioni >
// Obiettivi e l'onboarding (PUNTO_DI_PARTENZA.md, sezione 3, "Onboarding":
// stessi campi, valori ed etichette di Profilo e Obiettivi).

import type { LivelloAttivita, Sesso, TipoObiettivo } from "../db/tipi";

// "Non indicato" a schermo, per stare nel selettore a tre segmenti; lo
// screen reader legge la frase intera.
export const OPZIONI_SESSO: { valore: Sesso; etichetta: string; etichettaAccessibile?: string }[] = [
  { valore: "maschio", etichetta: "Uomo" },
  { valore: "femmina", etichetta: "Donna" },
  {
    valore: "non_indicato",
    etichetta: "Non indicato",
    etichettaAccessibile: "Preferisco non indicarlo",
  },
];

export const OPZIONI_ATTIVITA: { valore: LivelloAttivita; etichetta: string }[] = [
  { valore: "sedentario", etichetta: "Sedentario" },
  { valore: "leggero", etichetta: "Leggero (1-3 allenamenti a settimana)" },
  { valore: "moderato", etichetta: "Moderato (3-5 allenamenti a settimana)" },
  { valore: "attivo", etichetta: "Attivo (6-7 allenamenti a settimana)" },
  { valore: "molto_attivo", etichetta: "Molto attivo (lavoro fisico o due allenamenti al giorno)" },
];

export const OPZIONI_OBIETTIVO: { valore: TipoObiettivo; etichetta: string }[] = [
  { valore: "dimagrire", etichetta: "Dimagrire" },
  { valore: "mantenere", etichetta: "Mantenere" },
  { valore: "massa", etichetta: "Massa" },
];
