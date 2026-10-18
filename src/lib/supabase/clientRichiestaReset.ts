// La richiesta del link per reimpostare la password (/password-dimenticata).
// Dal 18/10/2026, branch `reset-ovunque`.
//
// Perché un client Supabase a parte. Il client di tutta l'app (client.ts,
// createBrowserClient di @supabase/ssr) usa sempre il flusso PKCE, e non si
// può cambiare: la libreria scrive flowType "pkce" sopra le nostre opzioni.
// Con PKCE la richiesta salva nei cookie di QUESTO browser un "code
// verifier", e il link dell'email funziona solo dove c'è quel verifier. Su
// iPhone i link delle email si aprono sempre in Safari, che non vede i
// cookie dell'app installata: un reset chiesto dall'app non poteva riuscire.
//
// Questo client usa il flusso implicito: la richiesta parte senza
// code_challenge, il server non lega il link a nessun browser, e dopo il
// clic rimanda a /reimposta-password con la sessione nel frammento
// dell'indirizzo (#access_token=...&type=recovery). La pagina la raccoglie
// da qualunque browser (reimposta-password/page.tsx).
//
// Va usato SOLO per resetPasswordForEmail, ed è per questo che il file
// esporta la funzione e non il client. Non ha memoria (persistSession
// false): non scrive cookie né localStorage, non legge l'indirizzo della
// pagina, non rinnova token. La sessione aperta nel browser, se c'è, resta
// com'è. Un accesso o un updateUser fatti da qui finirebbero nel vuoto.

import { createClient } from "@supabase/supabase-js";
import { creaFetchConScadenza } from "./fetchConScadenza";

function creaClientRichiestaReset() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        // Un nome suo: con lo stesso nome del client dell'app la libreria
        // avviserebbe di due client sulla stessa memoria.
        storageKey: "nutritrack-richiesta-reset",
      },
      global: { fetch: creaFetchConScadenza() },
    }
  );
}

export function chiediLinkRipristino(email: string, redirectTo: string) {
  return creaClientRichiestaReset().auth.resetPasswordForEmail(email, { redirectTo });
}
