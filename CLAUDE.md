# CLAUDE.md — regole per lavorare su questo progetto

## Documento di riferimento

**`PUNTO_DI_PARTENZA.md` è l'unica fonte** per posizionamento, schermate, modello
dati, ordine di sviluppo e perimetro. I documenti precedenti (PROJECT_BRIEF,
DATABASE_SCHEMA, ROADMAP) sono stati eliminati perché superati: se in una
conversazione emergono riferimenti a quello schema o a quelle fasi, sono vecchi.

Se una decisione cambia, si aggiorna quel documento nello stesso momento. Non
devono esistere due versioni della stessa scelta.

## Changelog

**`CHANGELOG.md`** è il registro cronologico di cosa è stato fatto, commit per
commit — diverso da `PUNTO_DI_PARTENZA.md`, che descrive lo stato e le
decisioni, non la storia. **Dopo ogni commit che faccio su tua richiesta
esplicita, aggiungo una voce in cima a `CHANGELOG.md`** (ordine
cronologico inverso, più recente in alto) con: data, una riga su cosa è
cambiato e perché, ed eventuali bug trovati/corretti o lasciati aperti. Poche
righe, non un altro riepilogo completo — quello resta nella chat.

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
- **Test permanenti solo per bug di logica sottile** (race condition, calcoli,
  regole come il giorno logico) — quelli che non fanno rumore e si scoprono
  mesi dopo (sezione 10.5). Scrivi il test, tienilo nel progetto (Vitest +
  Testing Library, già configurati). Gli script usati per verificare a mano
  contro Supabase reale (creare un utente, controllare una riga) restano
  temporanei come sempre: si cancellano dopo l'uso
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

## Deploy che toccano lo schema dati — procedura anti-perdita

Vale per ogni push che cambia la struttura dei dati su uno qualsiasi dei due
lati: Postgres su Supabase, oppure IndexedDB via Dexie sul dispositivo. I dati
già creati dagli utenti non si perdono mai. Prima di un deploy di questo tipo
entrambe le checklist vanno verdi; un deploy può toccarne anche una sola.

### A. Migration Supabase — solo additive

1. **Mai `DROP COLUMN`, `DROP TABLE`, `ALTER … RENAME` su oggetti con dati
   dentro.** Si aggiunge, non si toglie né si rinomina.
2. Se un valore deve cambiare forma (colonna nuova che rimpiazza una vecchia),
   in quattro passi separati nel tempo:
   a. migration che aggiunge la colonna nuova, `NULL` ammesso;
   b. backfill: `UPDATE` che riempie la nuova dai valori vecchi, verificato con
      un `SELECT count(*)` che non lasci righe scoperte;
   c. il client scrive e legge la colonna nuova per almeno un rilascio intero;
   d. la rimozione della vecchia è lavoro separato, mesi dopo, quando nessun
      client la usa più — mai nello stesso deploy che introduce la nuova.
3. Se una tabella si **divide in più tabelle**, stessa logica ma il backfill
   **copia, non sposta**: le tabelle nuove si popolano dai dati della vecchia,
   che resta intatta e leggibile finché il client non legge e scrive solo le
   nuove. La vecchia si droppa come lavoro separato, mesi dopo, a client
   migrato.
4. Colonna nuova `NOT NULL` solo con `DEFAULT`. Mai `NOT NULL` secco su una
   tabella non vuota.
5. Ogni modifica di struttura passa da `apply_migration` (una migration =
   un file versionato), mai da `execute_sql` a mano.
6. **Una tabella nuova nasce già con RLS attiva e le sue policy nella stessa
   migration di creazione** (`enable row level security` + i `create policy`
   nello stesso file), non in un secondo momento. `get_advisors` dopo è la
   verifica, non il punto in cui si scopre che manca.
7. Dopo la migration: `get_advisors` (security + performance). Nessuna tabella
   senza RLS, nessun avviso nuovo.
8. La stessa modifica va riflessa in `src/lib/db/tipi.ts`, confrontata con lo
   schema reale (`information_schema.columns`), non solo col documento — è già
   la regola in testa a quel file.

### B. Versione schema Dexie — upgrade esplicito

Il numero in `this.version(N)` in `src/lib/db/database.ts` si alza di 1 ogni
volta che cambia `.stores(...)` **oppure** la forma delle righe già salvate sul
dispositivo.

1. **La `version(N)` esistente non si modifica mai.** Si aggiunge una
   `this.version(N+1)` nuova, in coda, con lo schema aggiornato.
2. Se cambiano **solo gli indici** (la stringa dopo i due punti) e non la forma
   dei dati, basta `this.version(N+1).stores({ … })`: Dexie ricostruisce gli
   indici da solo, le righe restano.
3. Se cambia la **forma delle righe** (campo nuovo con valore da calcolare,
   campo rinominato, valore da trasformare), la nuova versione porta una
   `.upgrade()` che riscrive le righe esistenti sul dispositivo:

   ```ts
   this.version(2)
     .stores({ /* schema completo */ })
     .upgrade(async (tx) => {
       await tx.table("alimenti").toCollection().modify((a) => {
         a.marca ??= null;
       });
     });
   ```

4. Un campo nuovo **facoltativo**, che il codice tratta già come opzionale
   (`T | null` con fallback ovunque venga letto), può non avere `.upgrade`: le
   righe vecchie senza quel campo restano valide. In quel caso si scrive nel
   commento della versione perché l'upgrade non serve.
5. Mai `db.delete()` o "cancella e ricrea" come scorciatoia: butta via i dati
   locali non ancora sincronizzati.
6. Il bump di versione va nello stesso deploy del codice che dipende dalla
   forma nuova — mai un codice che legge un campo che la `version` in
   esecuzione sul telefono non ha ancora popolato.
7. Verifica prima del deploy: partire da un IndexedDB popolato con lo schema
   vecchio, applicare la build nuova, controllare che le righe di prima ci
   siano ancora e con la forma nuova. Se è una trasformazione di valori,
   diventa anche un test permanente (sezione test).

### Nota

I due lati sono indipendenti e la sync non fa da rete di sicurezza: se
l'upgrade Dexie perde una riga non ancora sincronizzata, quella riga non
esiste più da nessuna parte.
