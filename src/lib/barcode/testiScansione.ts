// I testi della scansione del codice a barre (PUNTO_DI_PARTENZA.md §3,
// "Codice a barre"), in un posto solo: la schermata (SchermataScansione)
// e i suoi test li prendono da qui.
//
// Regola dei messaggi d'errore: dicono cosa è successo e cosa si può fare
// adesso, sempre con un'uscita che non dipende dalla rete ("Crea a mano"
// con il codice già compilato, "Scrivi il codice").

import type { ErroreCodice } from "./codiceEan";
import type { StatoFotocamera } from "./useFotocamera";

export const TESTO_INQUADRA = "Inquadra il codice a barre della confezione";
export const TESTO_DA_SOLO = "Si legge da solo, senza premere niente";
// Al posto di TESTO_DA_SOLO quando la scansione legge solo il codice per
// "Modifica alimento" (uso "solo-codice" di SchermataScansione).
export const TESTO_TORNA_NEL_MODULO = "Il codice torna nel modulo: si salva con Salva";
export const TESTO_SENZA_RETE = "Senza connessione la scansione non è disponibile";
export const TESTO_CERCO = "Cerco il prodotto…";
export const TESTO_FOTO_SENZA_CODICE =
  "Nella foto non trovo un codice a barre. Riprova più da vicino, o scrivi il codice.";
export const TESTO_LETTORE_NON_CARICATO =
  "Il lettore dei codici non si è caricato. Controlla la connessione e riprova, oppure scrivi il codice.";

// La scansione dal catalogo alimenti (PUNTO_DI_PARTENZA.md §3, "Codice a
// barre", "Nel catalogo").
export const TITOLO_SCANSIONE_CATALOGO = "Catalogo alimenti";
// In cima a "Modifica alimento", quando il codice scansionato è già di un
// alimento del catalogo.
export const TESTO_GIA_NEL_CATALOGO = "Questo codice è già nel tuo catalogo.";
// Il codice è di un alimento che non si modifica: resta la schermata di
// scansione con questo testo. `etichetta` come etichettaAlimento
// ("Nome · Marca"). Il catalogo comune è il testo approvato nel mockup;
// quello di un alimento proprio ma verificato, che oggi non esiste, è di
// Davide (07/11).
export function testoNonModificabile(etichetta: string, comune: boolean): string {
  return comune
    ? `È nel catalogo comune: «${etichetta}». Non si modifica, ma lo trovi in Aggiungi.`
    : `È un alimento verificato: «${etichetta}». Non si modifica, ma lo trovi in Aggiungi.`;
}

// "Scrivi il codice": perché il codice scritto non va.
export const TESTI_CODICE_SBAGLIATO: Record<ErroreCodice, string> = {
  vuoto: "Scrivi le cifre che stanno sotto le barre.",
  "non-cifre": "Solo cifre, senza lettere né segni.",
  lunghezza: "Il codice deve avere 8, 12 o 13 cifre.",
  controllo: "Il codice non torna: controlla le cifre.",
};

// La fotocamera non c'è o non si può usare: restano la foto e il codice
// scritto. `null` quando non c'è niente da dire.
export function testoFotocamera(stato: StatoFotocamera): string | null {
  if (stato === "negata") {
    return "Non hai dato il permesso per la fotocamera. Puoi usare una foto o scrivere il codice.";
  }
  if (stato === "non-disponibile") {
    return "La fotocamera non è disponibile. Puoi usare una foto o scrivere il codice.";
  }
  return null;
}

// Open Food Facts non ha risposto come serve. Sempre con "Crea a mano".
export type ErroreRicerca = "rete" | "occupato" | "errore";

export const TESTI_ERRORE_RICERCA: Record<ErroreRicerca, string> = {
  rete: "Non riesco a raggiungere Open Food Facts. Controlla la connessione, oppure crea l'alimento a mano: il codice è già compilato.",
  occupato:
    "Open Food Facts è occupato in questo momento. Riprova fra poco, oppure crea l'alimento a mano: il codice è già compilato.",
  errore:
    "Open Food Facts ha risposto in modo inatteso. Riprova, oppure crea l'alimento a mano: il codice è già compilato.",
};
