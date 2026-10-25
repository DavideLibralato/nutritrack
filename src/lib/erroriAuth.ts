// Il link per reimpostare la password: lo usa solo /reimposta-password.
// Nessun link e nessuna sessione nata da un link in questa scheda.
export const LINK_NON_VALIDO = "Link non valido o scaduto. Richiedine uno nuovo.";
// Il server ha rifiutato il link.
export const LINK_SCADUTO = "Il link è scaduto, è già stato usato o ne hai chiesto uno più recente. Usa l'ultimo arrivato o richiedine uno nuovo.";
export const ERRORE_CONNESSIONE = "Errore di connessione. Controlla la tua connessione e riprova.";
export const PASSWORD_TROPPO_CORTA = "La password deve avere almeno 6 caratteri.";
const ERRORE_GENERICO = "Si è verificato un errore. Riprova tra poco.";

// Impostazioni > Profilo > Cambia password (cambiaPassword.ts): un testo
// per ogni esito che lascia l'utente sulla pagina. "ok" non c'è: si torna
// a Profilo con "Password aggiornata".
export const TESTI_CAMBIO_PASSWORD = {
  "attuale-mancante": "Inserisci la password attuale.",
  "nuova-mancante": "Inserisci la nuova password.",
  "attuale-sbagliata": "La password attuale non è corretta.",
  uguale: "La nuova password è uguale a quella attuale: scegline una diversa.",
  "troppo-corta": PASSWORD_TROPPO_CORTA,
  debole: "Questa password è troppo facile da indovinare: scegline un'altra.",
  riautenticazione:
    "Il server chiede una verifica via email per cambiare la password. Usa \"Reimpostala via email\" qui sotto.",
  sessione: "Il server non riconosce più la tua sessione. Esci e rientra, poi riprova.",
  rete: "Non riuscito: il server non risponde. La password non è cambiata. Riprova.",
  "risposta-persa":
    "Non so se è andata: la connessione si è interrotta prima della risposta. La password potrebbe essere già quella nuova.",
  errore: ERRORE_GENERICO,
} as const;

// Sotto il pulsante: il server chiude le sessioni degli altri dispositivi
// (LogoutAllExceptMe, cambiaPassword.ts).
export const AVVISO_ALTRI_DISPOSITIVI = "Sugli altri dispositivi dovrai rientrare con la nuova password.";
// Il riquadro in cima alla pagina senza rete.
export const SENZA_RETE_CAMBIO_PASSWORD = {
  titolo: "Serve la connessione",
  testo: "Per cambiare la password devi essere online. Il modulo resta qui: riprova quando torna la rete.",
} as const;

// "Password attuale sbagliata" subito dopo una risposta persa: il tentativo
// di prima può essere arrivato, e allora l'attuale è già quella nuova.
export const ATTUALE_SBAGLIATA_DOPO_RISPOSTA_PERSA =
  "La password attuale non è corretta. Il tentativo di prima forse è riuscito: prova a scrivere come attuale quella nuova.";

// Traduce i messaggi di errore di Supabase Auth (che arrivano in inglese)
// in italiano, cosi anche gli amici non tecnici che usano l'app capiscono
// cosa e' successo. Se il messaggio non e' tra quelli noti, mostriamo un
// messaggio generico invece di lasciar trapelare l'inglese grezzo.
const MAPPA_ERRORI: Record<string, string> = {
  "invalid login credentials": "Email o password non corrette.",
  "email not confirmed": "Devi confermare la tua email prima di accedere: controlla la posta.",
  "user already registered": "Esiste già un account con questa email.",
  "password should be at least 6 characters": PASSWORD_TROPPO_CORTA,
  "unable to validate email address": "L'indirizzo email non è valido.",
  "email rate limit exceeded": "Troppi tentativi in poco tempo: riprova tra qualche minuto.",
  "signup requires a valid password": "Inserisci una password valida.",
  "for security purposes": "Per sicurezza, riprova tra qualche istante.",
  "network": ERRORE_CONNESSIONE,
  "failed to fetch": ERRORE_CONNESSIONE,
};

export function traduciErroreAuth(messaggio: string | undefined | null): string {
  if (!messaggio) return "Si è verificato un errore imprevisto. Riprova.";

  const messaggioMinuscolo = messaggio.toLowerCase();
  const trovato = Object.entries(MAPPA_ERRORI).find(([chiave]) =>
    messaggioMinuscolo.includes(chiave)
  );
  if (trovato) return trovato[1];

  return ERRORE_GENERICO;
}

// Codici con cui il server rifiuta il link. otp_expired: il link è già
// usato o scaduto (anche quello di un'email superata da una più recente),
// e il server rimanda alla pagina con l'errore nell'indirizzo. Si decide
// dal codice e non dal testo inglese, che non è documentato. Altri errori
// (rete...) passano dalla mappa.
const CODICI_LINK_SCADUTO = ["otp_expired"];

// Due forme: da una chiamata al server il codice sta in `code`; dall'errore
// nell'indirizzo (AuthImplicitGrantRedirectError di auth-js) `code` è
// vuoto e il codice sta in `details.code`.
type ErroreLink = { code?: string; message: string; details?: { code?: string } | null };

export function traduciErroreLinkRipristino(errore: ErroreLink): string {
  const codice = errore.code ?? errore.details?.code;
  if (codice && CODICI_LINK_SCADUTO.includes(codice)) return LINK_SCADUTO;
  return traduciErroreAuth(errore.message);
}
