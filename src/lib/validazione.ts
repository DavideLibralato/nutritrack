// Controlli di formato condivisi tra i form di auth. Servono solo a dare un
// messaggio in italiano prima ancora di contattare Supabase — la verifica
// che conta resta quella del server (qui, o dentro una Server Action).
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValida(valore: string): boolean {
  return FORMATO_EMAIL.test(valore.trim());
}
