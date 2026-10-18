// La sessione nel "frammento" del link di ripristino, per
// /reimposta-password. Dal 18/10/2026, branch `reset-ovunque`.
//
// Il frammento è la parte dell'indirizzo dopo il #. Il browser non lo
// manda mai al server: lo vede solo il JavaScript della pagina.
//
// Con il flusso implicito (clientRichiestaReset.ts) il link dell'email,
// dopo il server di Supabase, arriva così:
//   /reimposta-password#access_token=...&refresh_token=...&type=recovery&...
// Sono una sessione vera dell'account del link, non un codice da
// scambiare: per questo si tolgono dall'indirizzo appena letti
// (togliFrammento), prima di qualunque chiamata, anche se poi qualcosa
// fallisce.
//
// Il client Supabase dell'app non la raccoglie da solo: è PKCE, vede un
// indirizzo "implicito" e rinuncia con l'errore "Not a valid PKCE flow
// url". La raccoglie la pagina, con setSession.

export interface SessioneDalFrammento {
  access_token: string;
  refresh_token: string;
}

// Solo access_token e refresh_token insieme, e solo se type=recovery: un
// frammento diverso (un errore, un altro tipo di link) non è affar suo, e
// la pagina lo tratta come prima.
export function leggiFrammentoRipristino(hash: string): SessioneDalFrammento | null {
  if (!hash.startsWith("#")) return null;
  const parametri = new URLSearchParams(hash.slice(1));
  const access_token = parametri.get("access_token");
  const refresh_token = parametri.get("refresh_token");
  if (!access_token || !refresh_token || parametri.get("type") !== "recovery") return null;
  return { access_token, refresh_token };
}

// replaceState sostituisce l'indirizzo della voce corrente della
// cronologia senza ricaricare la pagina: i token spariscono anche da
// "indietro". history.state si passa com'era: dentro c'è lo stato del
// router di Next.
export function togliFrammento(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", pathname + search);
}
