// Il passo "Scegli il tuo nome su Libra" dell'onboarding (PUNTO_DI_PARTENZA.md
// §3, Amici, "Lo username dopo l'accesso"): quando compare, dove porta
// Indietro, che puntino accende la barra.
//
// Funzioni pure, testate in passoUsername.test.ts. Sono logica che sbaglia
// in silenzio: chi ha già uno username che si vede chiedere di nuovo il
// nome, chi è offline bloccato su un passo che non può finire, un puntino
// in più o in meno.
//
// Il passo sta fuori dalla numerazione 1-5 di statoOnboarding.ts: quella
// viene dai dati in Dexie (profilo, pesate, obiettivi), lo username sta
// solo sul server (nomi_utente). Per la pagina è un passo in più, fra il
// Benvenuto (1) e "Su di te" (2).

import type { StatoMioUsername } from "../amici/useMioUsername";
import type { PassoOnboarding } from "./statoOnboarding";

export type PassoPagina = PassoOnboarding | "username";

// Si decide al tocco su "Iniziamo" del Benvenuto.
//   - già comparso in questo giro della pagina (anche con il nome salvato)
//     → resta: tornando al Benvenuto e rifacendo "Iniziamo" non sparisce;
//   - altrimenti solo con la risposta "nessuno username". Con lo username
//     già scelto mai; con la risposta non ancora arrivata o un errore
//     (offline già all'apertura) si salta, e lo chiede Amici alla prima
//     apertura.
// La rete in quel momento NON conta (deciso il 23/10, dopo la prova 9 su
// iPhone): navigator.onLine su Safari non è una fotografia dell'istante.
// Il passo compariva o no a seconda di quando Safari si accorgeva della
// modalità aereo. Se si è offline, il passo lo dice da sé, con "Lo scelgo
// dopo" (PassoUsername).
export function mostraPassoUsername(lettura: StatoMioUsername, giaNelGiro: boolean): boolean {
  if (giaNelGiro) return true;
  return lettura.esito === "ok" && lettura.username === null;
}

// Il passo prima di questo, per Indietro. Dal Benvenuto non si torna
// indietro (non ha la barra): resta dov'è.
export function passoPrecedente(passo: PassoPagina, conUsername: boolean): PassoPagina {
  if (passo === "username" || passo === 1) return 1;
  if (passo === 2) return conUsername ? "username" : 1;
  return (passo - 1) as PassoOnboarding;
}

// Il puntino acceso e quanti sono: 6 con il passo dello username, 5 senza.
export function posizioneNellaBarra(
  passo: PassoPagina,
  conUsername: boolean
): { posizione: number; totale: number } {
  const totale = conUsername ? 6 : 5;
  if (passo === "username") return { posizione: 2, totale };
  if (passo === 1) return { posizione: 1, totale };
  return { posizione: passo + (conUsername ? 1 : 0), totale };
}
