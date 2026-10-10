import { createBrowserClient } from '@supabase/ssr'
import { creaFetchConScadenza } from './fetchConScadenza'

// Ogni richiesta del client del browser ha una scadenza e viene annullata
// se non risponde (fetchConScadenza.ts, dal 10/10/2026). Vale per tutto
// ciò che passa da qui: la sincronizzazione, ma anche accesso, recupero
// della password ed Esci.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { fetch: creaFetchConScadenza() } }
  )
}
