// Calcolo del fabbisogno (PUNTO_DI_PARTENZA.md, "Il calcolo del fabbisogno").
// Funzione pura: nessun accesso a Dexie o Supabase qui dentro, solo numeri
// dentro e numeri fuori — così si testa senza dover avviare un database.
//
// Il risultato è sempre e solo una *proposta*: chi chiama questa funzione
// decide se e quando salvarla, e l'utente può correggere ogni numero prima
// di farlo. Questo modulo non salva niente da solo.

import type { LivelloAttivita, TipoObiettivo } from "./db/tipi";

export interface DatiCalcoloFabbisogno {
  // "non_indicato" è escluso a livello di tipo: se il sesso non è indicato,
  // Mifflin-St Jeor non si applica (sezione 3) — è la UI a doverlo
  // controllare prima di chiamare questa funzione, non questa funzione.
  sesso: "maschio" | "femmina";
  eta: number;
  altezzaCm: number;
  pesoKg: number;
  livelloAttivita: LivelloAttivita;
  tipoObiettivo: TipoObiettivo;
}

export interface PropostaFabbisogno {
  kcal: number;
  proteine: number;
  carboidrati: number;
  grassi: number;
}

// Fattore di attività di Mifflin-St Jeor, dal metabolismo basale al
// fabbisogno di mantenimento. Valori standard, non nel documento.
const MOLTIPLICATORE_ATTIVITA: Record<LivelloAttivita, number> = {
  sedentario: 1.2,
  leggero: 1.375,
  moderato: 1.55,
  attivo: 1.725,
  molto_attivo: 1.9,
};

// Correzione del mantenimento in base all'obiettivo. -500/+300 kcal al
// giorno sono valori comuni (circa 0,4-0,5 kg a settimana in deficit), non
// numeri presenti nel documento: modificabili, qui e a mano dopo il calcolo.
const AGGIUSTAMENTO_KCAL_OBIETTIVO: Record<TipoObiettivo, number> = {
  dimagrire: -500,
  mantenere: 0,
  massa: 300,
};

// Percentuali di macro sulle kcal finali. Anche queste sono un default
// ragionevole (non del documento): proteine e grassi a parità, il resto
// carboidrati. 4 kcal/g per proteine e carboidrati, 9 kcal/g per i grassi
// sono invece un fatto, non una scelta (fattori di Atwater).
const QUOTA_PROTEINE = 0.3;
const QUOTA_GRASSI = 0.3;
const QUOTA_CARBOIDRATI = 0.4;

export function calcolaFabbisogno(dati: DatiCalcoloFabbisogno): PropostaFabbisogno {
  const basale =
    dati.sesso === "maschio"
      ? 10 * dati.pesoKg + 6.25 * dati.altezzaCm - 5 * dati.eta + 5
      : 10 * dati.pesoKg + 6.25 * dati.altezzaCm - 5 * dati.eta - 161;

  const mantenimento = basale * MOLTIPLICATORE_ATTIVITA[dati.livelloAttivita];

  // Un input assurdo (età/peso/altezza fuori scala) non deve produrre kcal
  // negative: non è un giudizio nutrizionale, è solo evitare un numero senza
  // senso a schermo.
  const kcal = Math.max(0, Math.round(mantenimento + AGGIUSTAMENTO_KCAL_OBIETTIVO[dati.tipoObiettivo]));

  return {
    kcal,
    proteine: Math.round((kcal * QUOTA_PROTEINE) / 4),
    grassi: Math.round((kcal * QUOTA_GRASSI) / 9),
    carboidrati: Math.round((kcal * QUOTA_CARBOIDRATI) / 4),
  };
}

// Età in anni compiuti a una certa data (oggi, se non specificata).
// Serve perché il profilo salva la data di nascita, non l'età: l'età di
// oggi non è (annoCorrente - annoNascita) quando il compleanno non è
// ancora passato quest'anno.
export function calcolaEta(dataNascitaISO: string, oggi: Date = new Date()): number {
  const nascita = new Date(dataNascitaISO);

  let eta = oggi.getFullYear() - nascita.getFullYear();

  const compleannoNonAncoraPassato =
    oggi.getMonth() < nascita.getMonth() ||
    (oggi.getMonth() === nascita.getMonth() && oggi.getDate() < nascita.getDate());

  if (compleannoNonAncoraPassato) {
    eta -= 1;
  }

  return eta;
}
