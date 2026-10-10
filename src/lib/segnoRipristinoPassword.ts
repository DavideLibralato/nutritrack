// Il "segno" del ripristino della password, per /reimposta-password.
//
// Dopo uno scambio riuscito del link la pagina scrive qui l'id
// dell'utente. Se la pagina viene ricaricata (su iPhone Safari ricarica da
// solo le schede rimaste dietro, per esempio tornando dall'app Mail),
// l'indirizzo non ha più ?code= e il modulo ricompare solo se la sessione
// aperta è dello stesso utente del segno. Senza segno, o con un altro
// utente, la pagina mostra l'errore: una sessione qualunque aperta nel
// browser non basta per cambiarle la password.
//
// sessionStorage: una memoria del browser che vale per UNA scheda e
// sopravvive al ricaricamento, ma non passa alle altre schede. Un link
// aperto in una scheda nuova parte senza segno.
//
// Ogni accesso è in try/catch: in alcuni casi (navigazione privata, memoria
// bloccata) sessionStorage lancia un errore. Senza memoria non c'è segno, e
// senza segno si mostra l'errore: la direzione sicura.

const CHIAVE = "nutritrack-ripristino-password";

export function scriviSegnoRipristino(idUtente: string): void {
  try {
    sessionStorage.setItem(CHIAVE, idUtente);
  } catch {
    // Niente segno: un ricaricamento mostrerà l'errore.
  }
}

export function leggiSegnoRipristino(): string | null {
  try {
    return sessionStorage.getItem(CHIAVE);
  } catch {
    return null;
  }
}

// Dopo il salvataggio della password nuova: "indietro" o un ricaricamento
// nella stessa scheda non devono riaprire il modulo.
export function togliSegnoRipristino(): void {
  try {
    sessionStorage.removeItem(CHIAVE);
  } catch {
    // Se non si può leggere non si poteva nemmeno scrivere: niente da togliere.
  }
}
