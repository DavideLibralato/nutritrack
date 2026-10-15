// Controlli di formato condivisi tra i form di auth. Servono solo a dare un
// messaggio in italiano prima ancora di contattare Supabase — la verifica
// che conta resta quella del server (qui, o dentro una Server Action).
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValida(valore: string): boolean {
  return FORMATO_EMAIL.test(valore.trim());
}

// Lo username (Amici, PUNTO_DI_PARTENZA.md §3): da 3 a 20 caratteri, prima
// una lettera, poi lettere, cifre e `_`, sempre minuscolo. È la stessa regola
// del check sulla tabella `nomi_utente` e delle funzioni
// `username_disponibile` / `imposta_username`: se cambia qui, cambia anche
// lì con una migration.
export const FORMATO_USERNAME = /^[a-z][a-z0-9_]{2,19}$/;

// Come lo username viene salvato: spazi ai bordi tolti, tutto minuscolo.
// Le funzioni sul database fanno la stessa cosa (lower + btrim), quindi
// "Mario_T" e "mario_t" sono lo stesso nome da tutte e due le parti.
export function normalizzaUsername(valore: string): string {
  return valore.trim().toLowerCase();
}

// Vale sul valore così come l'utente l'ha scritto: lo normalizza prima.
export function usernameValido(valore: string): boolean {
  return FORMATO_USERNAME.test(normalizzaUsername(valore));
}
