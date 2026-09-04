'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { traduciErroreAuth } from '@/lib/erroriAuth'

const CLASSE_FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

// useSearchParams() (sotto, in LoginForm) puo' andare in stallo durante il
// primo render sul server se non e' avvolto in una <Suspense>: Next.js lo
// richiede esplicitamente, altrimenti la build da' errore.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [caricamento, setCaricamento] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrore(null)
    setCaricamento(true)

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setCaricamento(false)

    if (error) {
      setErrore(traduciErroreAuth(error.message))
      return
    }

    // Se il middleware ci ha mandato qui perche' l'utente ha provato ad
    // aprire una pagina protetta senza essere loggato, dopo il login lo
    // riportiamo li' invece che sempre alla dashboard.
    const redirectTo = searchParams.get('redirectTo')
    router.push(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard')
    router.refresh() // aggiorna i Server Components con la nuova sessione
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-display font-bold">Accedi</h1>

        <div>
          <label htmlFor="login-email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            placeholder="tuonome@esempio.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <label htmlFor="login-password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            placeholder="La tua password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        {errore && <p className="text-sm text-red-600">{errore}</p>}

        <button
          type="submit"
          disabled={caricamento}
          className={`w-full rounded-lg bg-foreground p-2 text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {caricamento ? 'Attendere...' : 'Accedi'}
        </button>

        <p className="text-sm">
          Non hai un account?{' '}
          <a href="/register" className={`underline rounded ${CLASSE_FOCUS}`}>
            Registrati
          </a>
        </p>
      </form>
    </main>
  )
}
