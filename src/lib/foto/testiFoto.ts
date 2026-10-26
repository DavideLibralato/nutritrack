// I testi del cambio della foto profilo (PUNTO_DI_PARTENZA.md §3, "La foto
// profilo"; mockup docs/mockups/foto-profilo.html, proposta B). Quelli del
// mockup sono di Davide; gli altri (foto non preparata, eliminazione non
// riuscita, "Foto eliminata.") sono proposti nel commit 8.

import type { MessaggioBarra } from "../inserimento/testiBarra";

// Il nome del cerchio per lo screen reader, che in Profilo è un pulsante.
export const ETICHETTA_AGGIUNGI_FOTO = "Aggiungi foto profilo";
export const ETICHETTA_CAMBIA_FOTO = "Cambia foto profilo";

export const TITOLO_SCELTA_FOTO = "Foto profilo";
export const VOCE_MODIFICA_FOTO = "Modifica foto";
export const VOCE_ELIMINA_FOTO = "Elimina foto";

export const TITOLO_RITAGLIO = "La tua foto";
export const ETICHETTA_USA_FOTO = "Usa foto";
export const ETICHETTA_INGRANDIMENTO = "Ingrandimento";

export const TESTO_CARICAMENTO_FOTO = "Caricamento della foto…";

export const TESTO_CARICAMENTO_FALLITO =
  "Caricamento non riuscito: la foto non è cambiata. Controlla la connessione e riprova.";

// preparaFotoProfilo → "non-si-apre": il file non è un'immagine che il
// browser sa aprire.
export const TESTO_NON_SI_APRE = "Questa foto non si può aprire. Scegline un'altra.";

// preparaFotoProfilo → gli altri errori (ritaglio non valido, canvas, non
// JPEG, troppo grande): la foto si è aperta ma non si è riusciti a farne il
// file. Rari; riprovare con la stessa o un'altra foto è tutto quello che
// l'utente può fare.
export const TESTO_NON_PREPARATA =
  "Non sono riuscito a preparare la foto. Riprova, o scegline un'altra.";

export const TITOLO_CONFERMA_ELIMINA = "Eliminare la foto?";
export const TESTO_CONFERMA_ELIMINA =
  "Al suo posto torneranno le iniziali, anche per i tuoi amici.";
export const TESTO_ELIMINA_FALLITA =
  "Non sono riuscito a togliere la foto: è ancora quella di prima. Controlla la connessione e riprova.";

export const SENZA_RETE_FOTO = {
  titolo: "Serve la connessione",
  testo: "Per cambiare o togliere la foto devi essere online. Quella di adesso resta visibile.",
} as const;

// Il messaggio breve in basso, come "Password aggiornata." (con il punto,
// come quello).
export const MESSAGGIO_FOTO_AGGIORNATA: MessaggioBarra = {
  testo: "Foto aggiornata.",
  icona: "spunta",
};
export const MESSAGGIO_FOTO_ELIMINATA: MessaggioBarra = {
  testo: "Foto eliminata.",
  icona: "spunta",
};
