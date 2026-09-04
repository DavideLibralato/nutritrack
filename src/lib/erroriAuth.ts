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
