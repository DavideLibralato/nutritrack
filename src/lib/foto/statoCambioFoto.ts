// La macchina degli stati del cambio della foto profilo in Profilo
// (PUNTO_DI_PARTENZA.md §3, "La foto profilo"; mockup
// docs/mockups/foto-profilo.html, schermate 1-7). Funzione pura, con test:
// lo stato decide quale foglio è aperto, cosa mostra l'intestazione e
// quali pulsanti sono spenti. Le chiamate vere le fa useCambioFoto.
//
// Il percorso del cambio:
//   riposo → (tocco) scelta [con la foto] → ritaglio → preparazione →
//   caricamento → fatto | caricamento-fallito → (Riprova) caricamento
// La foto ritagliata e compressa sta nello stato da "caricamento" in poi:
// Riprova ricarica QUELLA, senza rifare ritaglio e compressione.
//
// Un evento che non c'entra con la fase di adesso si ignora (per esempio
// una risposta arrivata quando lo stato è già cambiato): lo stato resta
// com'è.

import type { EsitoPreparazioneFoto } from "./ritaglioFoto";
import type { EsitoCambioFoto, EsitoEliminaFoto } from "./fotoProfilo";
import { TESTO_ELIMINA_FALLITA, TESTO_NON_PREPARATA, TESTO_NON_SI_APRE } from "./testiFoto";

export type StatoFoto =
  | { fase: "riposo" }
  // Il tocco offline: il riquadro "Serve la connessione".
  | { fase: "senza-rete" }
  // Il foglio "Foto profilo" (Modifica / Elimina / Annulla).
  | { fase: "scelta" }
  // Il foglio "La tua foto" con la foto scelta.
  | { fase: "ritaglio"; file: Blob }
  // "Usa foto" toccato: si disegna e si comprime (foglio aperto, spento).
  | { fase: "preparazione"; file: Blob }
  // La foto pronta va al server: in Profilo si vede sbiadita.
  | { fase: "caricamento"; foto: Blob }
  // Non arrivata: errore e Riprova con la stessa foto.
  | { fase: "caricamento-fallito"; foto: Blob }
  // La foto non si è aperta o non si è preparata: errore, senza Riprova.
  | { fase: "foto-non-valida"; testo: string }
  // Il foglio "Eliminare la foto?", con l'errore di un tentativo fallito.
  | { fase: "conferma-elimina"; errore: string | null }
  | { fase: "eliminazione" }
  // Il messaggio breve in basso.
  | { fase: "fatto"; cosa: "aggiornata" | "eliminata" };

export type EventoFoto =
  | { tipo: "senza-rete" }
  | { tipo: "apri-scelta" }
  | { tipo: "file-scelto"; file: Blob }
  | { tipo: "annulla" }
  | { tipo: "usa-foto" }
  | { tipo: "preparata"; esito: EsitoPreparazioneFoto }
  | { tipo: "caricata"; esito: EsitoCambioFoto }
  | { tipo: "riprova" }
  | { tipo: "chiedi-elimina" }
  | { tipo: "conferma-elimina" }
  | { tipo: "eliminata"; esito: EsitoEliminaFoto }
  | { tipo: "chiudi-messaggio" };

export const RIPOSO: StatoFoto = { fase: "riposo" };

// Mentre si lavora col server o col canvas non si apre niente altro e i
// fogli non si chiudono.
export function occupato(stato: StatoFoto): boolean {
  return (
    stato.fase === "preparazione" || stato.fase === "caricamento" || stato.fase === "eliminazione"
  );
}

// Cosa fa il tocco sul cerchio. "selettore": il menu dell'iPhone (lo apre
// il componente, nello stesso tocco: Safari lo permette solo così).
// `online` è navigator.onLine: su iPhone arriva in ritardo (§3, lezione del
// 23/10), quindi qui decide solo se mostrare subito il riquadro; se la rete
// manca davvero, lo dice il caricamento con il suo errore.
export function azioneTocco(
  stato: StatoFoto,
  online: boolean,
  haFoto: boolean
): "niente" | "senza-rete" | "scelta" | "selettore" {
  if (occupato(stato)) return "niente";
  if (!online) return "senza-rete";
  return haFoto ? "scelta" : "selettore";
}

export function prossimoStatoFoto(stato: StatoFoto, evento: EventoFoto): StatoFoto {
  switch (evento.tipo) {
    case "senza-rete":
      return occupato(stato) ? stato : { fase: "senza-rete" };

    case "apri-scelta":
      return occupato(stato) ? stato : { fase: "scelta" };

    case "file-scelto":
      // Dal menu dell'iPhone, aperto dal tocco o da "Modifica foto".
      return occupato(stato) ? stato : { fase: "ritaglio", file: evento.file };

    case "annulla":
      // Annulla o chiusura di un foglio. Non durante un lavoro in corso.
      if (
        stato.fase === "scelta" ||
        stato.fase === "ritaglio" ||
        stato.fase === "conferma-elimina"
      ) {
        return RIPOSO;
      }
      return stato;

    case "usa-foto":
      return stato.fase === "ritaglio" ? { fase: "preparazione", file: stato.file } : stato;

    case "preparata":
      if (stato.fase !== "preparazione") return stato;
      if (evento.esito.esito === "ok") return { fase: "caricamento", foto: evento.esito.file };
      return {
        fase: "foto-non-valida",
        testo: evento.esito.esito === "non-si-apre" ? TESTO_NON_SI_APRE : TESTO_NON_PREPARATA,
      };

    case "caricata":
      if (stato.fase !== "caricamento") return stato;
      return evento.esito.esito === "ok"
        ? { fase: "fatto", cosa: "aggiornata" }
        : { fase: "caricamento-fallito", foto: stato.foto };

    case "riprova":
      return stato.fase === "caricamento-fallito"
        ? { fase: "caricamento", foto: stato.foto }
        : stato;

    case "chiedi-elimina":
      return stato.fase === "scelta" ? { fase: "conferma-elimina", errore: null } : stato;

    case "conferma-elimina":
      return stato.fase === "conferma-elimina" ? { fase: "eliminazione" } : stato;

    case "eliminata":
      if (stato.fase !== "eliminazione") return stato;
      return evento.esito.esito === "ok"
        ? { fase: "fatto", cosa: "eliminata" }
        : { fase: "conferma-elimina", errore: TESTO_ELIMINA_FALLITA };

    case "chiudi-messaggio":
      return stato.fase === "fatto" ? RIPOSO : stato;
  }
}
