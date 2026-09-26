# NutriTrack

App per registrare quello che mangi — calorie e macronutrienti — con meno
fatica possibile. È una PWA installabile sul telefono e funziona anche
offline: i dati vivono sul dispositivo (IndexedDB) e si sincronizzano con
Supabase quando c'è rete.

Stack: Next.js (App Router) + React + TypeScript, Supabase (Postgres, Auth),
Dexie per il database locale, Vitest per i test. Deploy su Vercel.

## Avviarla in locale

Serve un file `.env.local` nella cartella del progetto (non va mai
committato) con:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
CODICE_INVITO=...
```

Poi:

```bash
npm install     # installa le dipendenze (la prima volta)
npm run dev     # avvia l'app su http://localhost:3000
npm test        # esegue i test
```

**In sviluppo il service worker è spento**: si registra solo nella build di
produzione (`npm run build` e `npm start`, o l'anteprima su Vercel). Per
provare l'uso offline serve quindi una build di produzione, non `npm run dev`.

## Dove stanno le decisioni

- `PUNTO_DI_PARTENZA.md` — l'unica fonte per decisioni, schermate, modello
  dati e stato dell'app
- `CHANGELOG.md` — la storia, commit per commit
- `CLAUDE.md` — le regole per lavorare sul progetto
