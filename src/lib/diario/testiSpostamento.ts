// I messaggi della barra dopo "Sposta" (PUNTO_DI_PARTENZA.md, sezione 3,
// "Tieni premuto"). Dicono cosa è successo DAVVERO: se non si è mosso
// niente, la parola "Spostato" non compare mai (bug già trovato sul mockup:
// l'unico alimento escluso con "Non spostarlo" faceva dire "Spostato").
//
// Cosa si accorcia e cosa resta sempre visibile (la barra è larga al
// massimo quanto lo schermo, BarraAnnulla):
// - restano sempre interi: il verbo e le parole che danno il senso
//   ("Spostato:", "→", "tranne", "resta in", "non spostato", "Nessuno
//   spostamento:") e i numeri ("e altri 2");
// - i nomi dei pasti si accorciano con "…" oltre MASSIMO_PASTO caratteri:
//   sono scelti dall'utente e di solito brevi, è solo una cintura;
// - i nomi degli alimenti sono la parte lunga e variabile:
//   - nei messaggi brevi (spostamento riuscito senza esclusioni) un nome
//     solo sta nel campo `nome` della barra, che lo tronca con "…" su una
//     riga lasciando visibili verbo e pasto di arrivo;
//   - nelle frasi lunghe (esclusioni) la barra va a capo, e ogni nome di
//     alimento si accorcia oltre MASSIMO_ALIMENTO; oltre due nomi si dice
//     quanti altri ("«Yogurt», «Mela» e altri 2").

import type { MessaggioBarra } from "../inserimento/testiBarra";

export const MASSIMO_PASTO = 16;
export const MASSIMO_ALIMENTO = 22;

// "Yogurt greco intero biologico" → "Yogurt greco intero b…"
export function accorcia(testo: string, massimo: number): string {
  return testo.length <= massimo ? testo : `${testo.slice(0, massimo - 1).trimEnd()}…`;
}

const pasto = (nome: string) => `«${accorcia(nome, MASSIMO_PASTO)}»`;
const alimento = (nome: string) => `«${accorcia(nome, MASSIMO_ALIMENTO)}»`;

// «a» / «a» e «b» / «a», «b» e altri N.
export function elencoAlimenti(nomi: string[]): string {
  const unici = [...new Set(nomi)];
  if (unici.length === 1) return alimento(unici[0]);
  if (unici.length === 2) return `${alimento(unici[0])} e ${alimento(unici[1])}`;
  return `${alimento(unici[0])}, ${alimento(unici[1])} e altri ${unici.length - 2}`;
}

export interface EsitoSpostamento {
  tipo: "voce" | "pasto";
  // Nome dell'alimento spostato, solo per tipo "voce".
  nomeAlimento?: string;
  pastoPartenza: string;
  pastoDestinazione: string;
  // Quanti alimenti si sono spostati davvero (anche fusi in destinazione).
  spostati: number;
  // Nomi degli alimenti rimasti dov'erano ("Non spostarlo").
  esclusi: string[];
}

export function messaggioSpostamento(e: EsitoSpostamento): MessaggioBarra {
  const plurale = new Set(e.esclusi).size > 1;

  if (e.tipo === "voce") {
    // Escluso l'unico alimento: non si è mosso niente.
    if (e.spostati === 0) {
      return {
        testo: `${alimento(e.nomeAlimento ?? e.esclusi[0] ?? "")} resta in ${pasto(e.pastoPartenza)}, non spostato.`,
        icona: "info",
      };
    }
    return {
      testo: "Spostato:",
      nome: e.nomeAlimento ?? "",
      coda: `→ ${accorcia(e.pastoDestinazione, MASSIMO_PASTO)}`,
      icona: "spunta",
    };
  }

  // Pasto intero, tutti esclusi: nessuno spostamento.
  if (e.spostati === 0) {
    return {
      testo: `Nessuno spostamento: ${elencoAlimenti(e.esclusi)} ${plurale ? "restano" : "resta"} in ${pasto(e.pastoPartenza)}.`,
      icona: "info",
    };
  }
  // Pasto intero con esclusioni: frase lunga, va a capo.
  if (e.esclusi.length > 0) {
    return {
      testo:
        `Spostato: ${pasto(e.pastoPartenza)} → ${pasto(e.pastoDestinazione)} ` +
        `(tranne ${elencoAlimenti(e.esclusi)}, ${plurale ? "rimasti" : "rimasto"} in ${pasto(e.pastoPartenza)}).`,
      icona: "spunta",
    };
  }
  // Pasto intero, tutto spostato.
  return {
    testo: "Spostato:",
    nome: e.pastoPartenza,
    coda: `→ ${accorcia(e.pastoDestinazione, MASSIMO_PASTO)}`,
    icona: "spunta",
  };
}

// La riga di esito sotto ogni alimento del foglio dei doppioni
// (SheetDoppioni), come nel mockup del 5/10: dice cosa succederà con la
// scelta fatta, prima di confermare.
// - somma:    "→ Una riga da 150 g"
// - separati: "→ Due righe: 100 g e 50 g" (con più righe per parte, dopo
//             un "Tieni separati" precedente: "→ 3 righe separate")
// - scrivi:   "→ Una riga da 120 g (scritta a mano)"; campo ancora vuoto o
//             non valido: "→ Una riga con la quantità che scrivi"
// - escludi:  `testoEscluso`, passato da chi chiama ("Resta in Cena, non si
//             sposta"; per Duplica sarà un'altra frase)
export function testoEsitoDoppione(
  d: { grammiEsistenti: number; grammiInArrivo: number; righeEsistenti: number; righeInArrivo: number },
  tipo: "somma" | "separati" | "scrivi" | "escludi",
  grammiScritti: number | null,
  testoEscluso: string
): string {
  const g = (n: number) => `${n.toLocaleString("it-IT", { maximumFractionDigits: 2 })} g`;
  switch (tipo) {
    case "somma":
      return `→ Una riga da ${g(Math.round((d.grammiEsistenti + d.grammiInArrivo) * 100) / 100)}`;
    case "separati": {
      const righe = d.righeEsistenti + d.righeInArrivo;
      return righe === 2
        ? `→ Due righe: ${g(d.grammiEsistenti)} e ${g(d.grammiInArrivo)}`
        : `→ ${righe} righe separate`;
    }
    case "scrivi":
      return grammiScritti === null
        ? "→ Una riga con la quantità che scrivi"
        : `→ Una riga da ${g(grammiScritti)} (scritta a mano)`;
    case "escludi":
      return `→ ${testoEscluso}`;
  }
}
