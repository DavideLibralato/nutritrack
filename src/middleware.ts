import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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

  // IMPORTANTE: non aggiungere logica tra createServerClient e getUser().
  // getUser() rinfresca il token di sessione se serve; se lo si chiama
  // troppo tardi si rischia di perdere sessioni valide in modo casuale.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const percorso = request.nextUrl.pathname
  const rottaSoloOspiti = percorso === '/login' || percorso === '/register'
  // Non c'è più un prefisso "/dashboard": tutta l'app richiede login dal
  // primo giorno (sezione 9.1), quindi è protetto tutto tranne login e
  // registrazione. Gli asset statici sono già esclusi dal matcher sotto.
  const rottaProtetta = !rottaSoloOspiti

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
// aggiornati da supabase.auth.getUser(), altrimenti l'utente rischia di
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

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|apple-touch-icon.png|icons/).*)',
  ],
}
