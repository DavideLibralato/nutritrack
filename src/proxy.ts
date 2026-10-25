// Il "proxy" di Next 16 (fino a Next 15 si chiamava middleware): gira sul
// server prima di ogni pagina e decide se mandare a /login. Dal 25/10/2026
// è una funzione Node.js su Vercel, nella regione fissata in vercel.json
// (dub1, Dublino, vicino a Supabase in Irlanda); prima, come middleware,
// girava su Edge. PUNTO_DI_PARTENZA.md §8, "Il proxy".
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: non aggiungere logica tra createServerClient e getClaims().
  // getClaims() rinfresca il token di sessione se serve (i cookie nuovi
  // passano da setAll qui sopra); se lo si chiama troppo tardi si rischia
  // di perdere sessioni valide in modo casuale.
  //
  // getClaims() e non getUser() (dal 25/10/2026): verifica la firma del
  // token in locale, con la chiave pubblica del progetto (ECC P-256,
  // scaricata da /auth/v1/.well-known/jwks.json e tenuta in memoria), senza
  // chiedere a Supabase a ogni navigazione. Un token firmato con una chiave
  // simmetrica (HS256) lo manderebbe comunque a verificare al server, come
  // getUser(). Il prezzo: un token revocato sul server (uscita da un altro
  // dispositivo, password cambiata) qui vale fino alla sua scadenza, al
  // massimo un'ora. Non pesa: questa è una porta verso /login, non la
  // protezione dei dati, che è l'RLS di Supabase con lo stesso token.
  // PUNTO_DI_PARTENZA.md §8, "Il proxy".
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims ?? null

  const percorso = request.nextUrl.pathname
  const rottaSoloOspiti = percorso === '/login' || percorso === '/register'
  // Le due pagine della password non vanno né protette né rimbalzate se
  // già loggati:
  // - /reimposta-password: ci si arriva dal link nell'email senza essere
  //   ancora loggati, con la sessione nel frammento dell'indirizzo, che la
  //   pagina raccoglie da sé (il frammento non arriva mai al server);
  // - /password-dimenticata: "Richiedi un nuovo link" deve funzionare anche
  //   con una sessione aperta, per esempio quella dell'account di prova in
  //   Safari quando il reset dell'account vero va richiesto da lì (dal
  //   10/10/2026; prima rimandava alla home). Non apre niente di nuovo:
  //   chiedere un reset per qualunque email è già possibile a chiunque.
  const rottaSempreAccessibile =
    percorso === '/reimposta-password' || percorso === '/password-dimenticata'
  // Non c'è più un prefisso "/dashboard": tutta l'app richiede login dal
  // primo giorno (sezione 9.1), quindi è protetto tutto tranne le rotte
  // sopra. Gli asset statici sono già esclusi dal matcher sotto.
  const rottaProtetta = !rottaSoloOspiti && !rottaSempreAccessibile

  // Non loggato che prova ad aprire una pagina protetta (es. l'URL digitato
  // a mano): lo rimandiamo al login.
  if (!user && rottaProtetta) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', percorso)
    return copiaCookieSessione(NextResponse.redirect(url), supabaseResponse)
  }

  // Già loggato che apre /login o /register: non ha senso, lo mandiamo
  // direttamente alla home.
  if (user && rottaSoloOspiti) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return copiaCookieSessione(NextResponse.redirect(url), supabaseResponse)
  }

  // IMPORTANTE: va restituito supabaseResponse (o una copia con gli
  // stessi cookie) e non un NextResponse.next() creato da zero, altrimenti
  // il rinfresco della sessione fatto sopra andrebbe perso.
  return supabaseResponse
}

// I redirect qui sopra creano una risposta nuova (NextResponse.redirect),
// quindi dobbiamo ricopiarci sopra a mano gli eventuali cookie di sessione
// aggiornati da supabase.auth.getClaims(), altrimenti l'utente rischia di
// perdere la sessione rinfrescata proprio nel momento del redirect.
function copiaCookieSessione(
  risposta: NextResponse,
  origineCookie: NextResponse
) {
  origineCookie.cookies.getAll().forEach((cookie) => {
    risposta.cookies.set(cookie)
  })
  return risposta
}

// I file del service worker (sw.js, sw-strategia.js, offline.html) devono
// restare fuori: il browser li scarica anche senza login, e un redirect a
// /login al loro posto farebbe fallire l'installazione del service worker.
// Test: proxyMatcher.test.ts.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|sw-strategia.js|offline.html|apple-touch-icon.png|icons/).*)',
  ],
}
