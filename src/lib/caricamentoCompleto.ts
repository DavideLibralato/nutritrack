// Un caricamento completo di una pagina, non la navigazione interna di
// Next.js (router.push o redirect di una Server Action): il browser
// richiede la pagina da capo, e tutto si rimonta, compreso il layout
// radice.
//
// Serve dopo "Crea account" (PUNTO_DI_PARTENZA.md, sezione 3,
// "Onboarding"): la sessione nasce sul server, nei cookie, e il client
// Supabase del browser non manda nessun evento ai componenti già montati
// (Sincronizzazione, le riprese, il service worker), che restano "senza
// utente" finché la pagina non si ricarica. Con un caricamento completo
// nascono già con la sessione.
//
// `replace` e non `assign`: la pagina di prima esce dalla cronologia, così
// "indietro" non ci torna. Una funzione a parte anche per i test, perché in
// jsdom window.location.replace non si può sostituire con una spia.

export function caricaPaginaDaCapo(percorso: string): void {
  window.location.replace(percorso);
}
