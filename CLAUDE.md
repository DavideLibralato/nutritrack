# CLAUDE.md — regole per lavorare su questo progetto

## Documento di riferimento

**`PUNTO_DI_PARTENZA.md` è l'unica fonte** per posizionamento, schermate, modello
dati, ordine di sviluppo e perimetro. I documenti precedenti (PROJECT_BRIEF,
DATABASE_SCHEMA, ROADMAP) sono stati eliminati perché superati: se in una
conversazione emergono riferimenti a quello schema o a quelle fasi, sono vecchi.

Se una decisione cambia, si aggiorna quel documento nello stesso momento. Non
devono esistere due versioni della stessa scelta.

## Chi sono e come aiutarmi

Sono uno sviluppatore RPGLE/AS400, non conosco ancora Next.js/React/TypeScript
nella pratica. Nel progetto precedente (app Flutter) era Claude a scrivere il
codice spiegandomi i concetti man mano. Vale lo stesso approccio qui:

- Scrivi tu il codice, ma spiega in linguaggio semplice cosa fa ogni parte nuova
- Dammi comandi terminale esatti e nomi di file espliciti
- Se introduci un concetto nuovo di React/Next.js (hook, componente server vs
  client, ecc.) spiegalo brevemente la prima volta che lo usi
- Preferisco risposte strutturate, non muri di testo

Non darmi ragione per compiacenza: se una mia idea peggiora il prodotto o
complica lo schema, dimmelo con il motivo.

## Stack

- Next.js (App Router) + React + TypeScript
- Supabase — Postgres, Auth, RLS (progetto `nutritrack`, ref
  `ftpsepmneemrwgdbhlgo`, eu-west-1)
- **Dexie / IndexedDB — fonte di verità locale**: la UI non chiama mai Supabase
  direttamente, passa sempre dal livello repository (sezione 9.2)
- PWA installabile: manifest + service worker
- Tesseract.js per l'OCR delle etichette
- Recharts per i grafici
- Deploy su Vercel

Barcode e AI sono nel backlog, non nell'MVP: non introdurli finché il documento
non dice il contrario.

## Convenzioni

- Componenti in `/components`, un file per componente
- Accesso a servizi esterni (Supabase, OCR) isolato in `/lib`
- Nomi di file e variabili in inglese, testi visibili all'utente in italiano
- Nessun colore scritto a mano nei componenti: tutti da variabili CSS, per il
  tema chiaro/scuro (sezione 7)
- **Nomi di file descrittivi ovunque, tranne dove Next.js impone un nome
  fisso** (`page.tsx`, `layout.tsx`, `middleware.ts`, `route.ts`...). Per
  quei file il significato sta nel percorso/cartella, non nel nome del
  file: `src/app/login/page.tsx` è la pagina di login perché sta nella
  cartella `login`, non perché si chiama `page.tsx` — è così che il
  router "App Router" di Next.js trova le pagine, rinominare il file
  romperebbe la rotta. Per tutto il resto (componenti, funzioni, moduli in
  `/lib`) il nome del file deve dire cosa fa
- Commit piccoli e frequenti, messaggi in italiano
- **Non committare mai di tua iniziativa.** Finisci il pezzo di lavoro
  richiesto, riepiloga cosa hai fatto e come l'hai verificato, poi fermati
  e aspetta. Committa solo quando scrivo esplicitamente "committa"

## Regole non negoziabili

- **Nessuna tabella viene creata senza RLS attiva.** Su Supabase una tabella
  senza policy è leggibile da chiunque abbia la chiave pubblica dell'app.
  Dopo ogni migration, verificare con `get_advisors`
- **Ogni tabella ha `id` uuid generato dal client, `user_id`, `updated_at`,
  `deleted_at`** — servono al local-first, non si aggiungono dopo
- **I totali giornalieri non si memorizzano mai**: si ricalcolano dalle voci
- **Le chiavi API non entrano mai nel client.** Nessun segreto in variabili
  `NEXT_PUBLIC_`, `.env.local` mai committato. Le chiamate AI, quando
  arriveranno, partono da Edge Function
- **Niente servizi a pagamento senza avvisarmi prima**: obiettivo costo zero
- Prima di aggiungere una feature, la domanda della sezione 1: riduce o aumenta
  l'attrito dell'inserimento?
