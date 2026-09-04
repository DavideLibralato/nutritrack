'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { traduciErroreAuth } from '@/lib/erroriAuth'

const CLASSE_FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

export default function RegisterPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [caricamento, setCaricamento] = useState(false)

  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrore(null)
    setCaricamento(true)

    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome }, // finisce in raw_user_meta_data, letto dal trigger
      },
    })

    setCaricamento(false)

    if (error) {
      setErrore(traduciErroreAuth(error.message))
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-display font-bold">Registrati</h1>

        <div>
          <label htmlFor="register-nome" className="block text-sm font-medium mb-1">
            Nome
          </label>
          <input
            id="register-nome"
            type="text"
            placeholder="Come ti chiami"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <label htmlFor="register-email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            placeholder="tuonome@esempio.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <label htmlFor="register-password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            placeholder="Almeno 6 caratteri"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        {errore && <p className="text-sm text-red-600">{errore}</p>}

        <button
          type="submit"
          disabled={caricamento}
          className={`w-full rounded-lg bg-foreground p-2 text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {caricamento ? 'Attendere...' : 'Crea account'}
        </button>

        <p className="text-sm">
          Hai già un account?{' '}
          <a href="/login" className={`underline rounded ${CLASSE_FOCUS}`}>
            Accedi
          </a>
        </p>
      </form>
    </main>
  )
}
