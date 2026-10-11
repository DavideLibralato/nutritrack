// Di chi è la sessione su questo dispositivo, senza rete. La usano la
// salita (sincronizza.ts: manda solo le voci di questo utente) e la ripresa
// dell'uscita all'avvio (account/uscitaInCorso.ts: pulisce solo se non è
// rientrato lo stesso utente).
//
// getSession legge la sessione salvata; offline con il token scaduto
// risponde null anche se la sessione c'è ancora (utenteOffline.ts), e
// allora l'id si prende dal cookie, come fa useUtenteId. null solo se
// davvero non c'è nessuno.

import { createClient } from "./client";
import { chiaveSessione, leggiSessioneSalvata } from "./utenteOffline";

export async function idUtenteDellaSessione(
  supabase: ReturnType<typeof createClient> = createClient()
): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  try {
    return leggiSessioneSalvata(document.cookie, chiaveSessione(process.env.NEXT_PUBLIC_SUPABASE_URL!))?.id ?? null;
  } catch {
    // Cookie o indirizzo illeggibili: come nessuna sessione.
    return null;
  }
}
