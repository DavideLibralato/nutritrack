// Il link per reimpostare la password: lo usa solo /reimposta-password.
// Lo scambio non è avvenuto perché in questo browser manca il "code
// verifier" salvato quando il link è stato chiesto.
export const LINK_ALTRO_BROWSER =
  "Questo link funziona solo nel browser da cui l'hai chiesto. Richiedine uno nuovo qui sotto, da questo browser. Su iPhone i link delle email si aprono sempre in Safari, anche se hai l'app installata.";
// Il server ha rifiutato il codice del link.
export const LINK_SCADUTO = "Il link è scaduto, è già stato usato o ne hai chiesto uno più recente. Usa l'ultimo arrivato o richiedine uno nuovo.";

// Traduce i messaggi di errore di Supabase Auth (che arrivano in inglese)
// in italiano, cosi anche gli amici non tecnici che usano l'app capiscono
// cosa e' successo. Se il messaggio non e' tra quelli noti, mostriamo un
// messaggio generico invece di lasciar trapelare l'inglese grezzo.
const MAPPA_ERRORI: Record<string, string> = {
  "invalid login credentials": "Email o password non corrette.",
  "email not confirmed": "Devi confermare la tua email prima di accedere: controlla la posta.",
  "user already registered": "Esiste già un account con questa email.",
  "password should be at least 6 characters": "La password deve avere almeno 6 caratteri.",
  "unable to validate email address": "L'indirizzo email non è valido.",
  "email rate limit exceeded": "Troppi tentativi in poco tempo: riprova tra qualche minuto.",
  "signup requires a valid password": "Inserisci una password valida.",
  "for security purposes": "Per sicurezza, riprova tra qualche istante.",
  "network": "Errore di connessione. Controlla la tua connessione e riprova.",
  "failed to fetch": "Errore di connessione. Controlla la tua connessione e riprova.",
  "flow state": LINK_SCADUTO,
  "code verifier": LINK_ALTRO_BROWSER,
};

export function traduciErroreAuth(messaggio: string | undefined | null): string {
  if (!messaggio) return "Si è verificato un errore imprevisto. Riprova.";

  const messaggioMinuscolo = messaggio.toLowerCase();
  const trovato = Object.entries(MAPPA_ERRORI).find(([chiave]) =>
    messaggioMinuscolo.includes(chiave)
  );
  if (trovato) return trovato[1];

  return "Si è verificato un errore. Riprova tra poco.";
}

// Codici con cui il server rifiuta il codice del link. bad_code_verifier:
// il verifier c'è ma è di un'altra richiesta, per esempio il link della
// prima email dopo averne chiesta una seconda. Si decide dal codice e non
// dal testo inglese: quel testo non è documentato, e quello di
// bad_code_verifier potrebbe contenere "code verifier" e finire nel
// messaggio dell'altro browser. Altri errori (rete...) passano dalla mappa.
const CODICI_LINK_SCADUTO = ["flow_state_not_found", "flow_state_expired", "bad_code_verifier"];

export function traduciErroreLinkRipristino(errore: { code?: string; message: string }): string {
  if (errore.code && CODICI_LINK_SCADUTO.includes(errore.code)) return LINK_SCADUTO;
  return traduciErroreAuth(errore.message);
}
