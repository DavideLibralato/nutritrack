# Changelog

Registro cronologico di cosa è stato fatto, più recente in alto. Per lo stato
attuale e le decisioni vedi `PUNTO_DI_PARTENZA.md` — qui c'è solo la storia.

---

## 2026-09-10 — Procedura anti-perdita dati per i deploy di schema

- Nuova sezione in `CLAUDE.md` ("Deploy che toccano lo schema dati"): due
  checklist da verificare prima di ogni deploy che cambia la struttura dei
  dati. Lato Supabase: migration solo additive (niente drop/rename su oggetti
  con dati, colonna che cambia forma in 4 passi separati nel tempo, split di
  una tabella che copia e non sposta, RLS + policy nella stessa migration di
  creazione). Lato Dexie: `version(N)` mai modificata, `.upgrade()` esplicito
  quando cambia la forma delle righe salvate, bump nello stesso deploy del
  codice che dipende dalla forma nuova.
- Nessuna modifica di codice: le voci di `NOTE_MODIFICHE.md` non toccano lo
  schema (`alimenti.marca` esisteva già).

## 2026-09-06 — Modifica ed elimina un alimento dal catalogo (fase 2)

- Nella lista risultati di `/aggiungi`, sugli alimenti creati dall'utente e
  non ancora `verificato` compare una matita accanto al `+` (stessa riga,
  non sposta il layout). Sugli alimenti condivisi (`user_id` null) o
  verificati non compare — stesso criterio della RLS (sezione 10.8/11)
- Tap sulla matita → `CreaAlimentoForm` in modalità modifica: campi
  precompilati coi valori reali, `aggiorna()` sulla stessa riga (non una
  nuova), `verificato`/`fonte`/`marca`/`barcode` invariati
- Eliminazione con la stessa interazione delle voci di diario: in modifica
  la riga pulsanti è `[Elimina] [Salva]`, il tap su Elimina la trasforma in
  `[No] [Sì, elimina]` (conferma inline). Cancellazione logica (`deleted_at`)
- Flusso di creazione, `+` di aggiunta rapida e ricerca non toccati
- **Bug trovato provando:** modificando un alimento e aggiungendolo subito a
  un pasto, lo sheet quantità (e la copia in `voci_diario`) usava i valori
  di prima. Causa: la pagina catturava una fotografia dell'alimento al tap
  del `+`, e per un istante dopo la modifica la lista non è ancora
  ri-emessa dalla liveQuery. Corretto: `alimentoScelto` ora è derivato
  sempre dalla versione viva nel `catalogo` (fallback all'oggetto catturato
  solo per un alimento appena creato). Aggiunto un test permanente
  (`alimenti.reattivita.test.ts`) che verifica la ri-emissione della
  liveQuery dopo `aggiorna`/`elimina`

## 2026-09-06 — Fix deploy: conflitto @types/node / vitest

- Il build su Vercel falliva in `npm install`: `vitest@5` richiede
  `@types/node` `^22 || >=24`, ma `package.json` aveva `^20`. In locale non
  si vedeva perché `node_modules` non era mai stato reinstallato da zero
- `@types/node` portato a `^22` (risolto a 22.20.1). `node_modules` e
  `package-lock.json` cancellati e rigenerati da zero per verificare che il
  conflitto sia davvero risolto, non nascosto dalla cache locale
- Riverificato tutto da ambiente pulito: `npm install` (0 vulnerabilità,
  nessun ERESOLVE), `npm test` (33/33), `npm run build` (11 rotte),
  `npm run dev` + login renderizzato in browser. Solo allineamento di
  versioni, nessun'altra modifica

## 2026-09-06 — Stati della pagina "Aggiungi alimento" (stile, fase 2)

- La vista di ricerca di `/aggiungi` non è più spoglia: tre stati distinti
  (mockup preparato su claude.ai). Vuoto → icona posate + "Cerca il tuo
  alimento" + sottotitolo, centrati. Risultati → lista con nome e
  `grammi · kcal` (come in Oggi) + link discreto "Crea «query»". Nessun
  risultato → messaggio centrato + pulsante pieno "Crea alimento
  manualmente" a tutta larghezza, stesso stile del "+ Aggiungi" di Oggi
- Tutti i colori dalle variabili CSS esistenti (`text-muted`, `text-accent`,
  `border-border`, `bg-accent`, `text-background`), nessun colore a mano.
  Icone SVG inline stroke, coerenti col resto
- Logica di ricerca/creazione/inserimento non toccata: solo composizione
  del ramo non-modifica di `/aggiungi`
- **Fix:** la "×" per svuotare il campo di ricerca era il pulsante nativo di
  `<input type="search">`, che WebKit colora con l'accento di sistema (blu).
  Nascosto quello nativo in `globals.css`, disegnata la "×" come le altre
  icone (`text-muted`), visibile solo quando c'è testo

## 2026-09-06 — Modifica ed elimina una voce dalla pagina Oggi (fase 2)

- Nella pagina Oggi ogni voce di un pasto è ora una riga tappabile (nome +
  `g` + kcal), al posto della vecchia riga grigia con i nomi uniti da `·`
- Il tap riapre lo stesso `SheetQuantita` in modalità modifica:
  precompilato con grammi e pasto reali della voce (non la porzione di
  default), con un `<select>` per spostare la voce di pasto (sezione 5)
- Conferma → `repositoryVociDiario.aggiorna(id, …)` sulla stessa riga, non
  una nuova. "Elimina" → `elimina(id)` (cancellazione logica)
- Riga pulsanti dello sheet: in creazione `[Annulla] [Aggiungi]`
  invariata; in modifica `[Elimina] [Salva]`, e il tap su Elimina
  trasforma la stessa riga in `[No] [Sì, elimina]` (conferma inline, stessa
  posizione) per evitare i tap accidentali
- `SheetQuantita` esteso solo con prop opzionali (`modifica`,
  `grammiIniziali`, `pasti`/`pastoSelezionatoId`/`onCambiaPasto`,
  `onElimina`): il flusso di creazione da `/aggiungi` non è stato toccato e
  rende identico a prima. Nuovo helper `daVoce()` in `alimentoPerSheet.ts`
  che usa i valori nutrizionali copiati sulla voce, non quelli attuali del
  catalogo

## 2026-09-06 — Inserimento manuale (fase 2): dalla ricerca al diario

- Nuova pagina `/aggiungi`, a tutto schermo e fuori dal route group `(app)`
  (niente tab bar): si apre dal pulsante "+ Aggiungi" di Oggi passando
  `?giorno=`, e salvare fa `router.replace('/?giorno=…')` — si torna
  all'Oggi del giorno giusto, anche un giorno passato
- Titolo = pasto proposto, come `<select>` (è già "l'elenco dei pasti della
  giornata"): sull'oggi in base all'ora (`pastoPerOrario`, con la Cena che
  copre la fascia dopo mezzanotte), sui giorni passati il primo pasto ancora
  vuoto (`primoPastoVuoto`)
- Ricerca nel catalogo locale (alimenti in Dexie: privati dell'utente +
  condivisi con `user_id` null), per sottostringa e indifferente ad
  accenti/maiuscole. I livelli 2 (Supabase) e 3 (Open Food Facts) sono
  fase 4
- Creazione a mano quando la ricerca non basta (`CreaAlimentoForm`): nome +
  kcal/proteine/carboidrati/grassi per 100 g + porzione predefinita,
  salvata con `fonte "manuale"` e `verificato false`
- Sheet quantità unico e riusabile (`SheetQuantita`, sezione 5): grammi
  precompilati con la porzione di default e già selezionati, tastierino
  numerico, anteprima kcal/macro. Conferma → riga in `voci_diario` con i
  valori nutrizionali **copiati** (mai un riferimento che possa cambiare)
- Oggi ora legge `?giorno=` all'avvio: è servito avvolgere il contenuto in
  `<Suspense>` per `useSearchParams` (come nel login), il che rende il
  contenuto solo lato client ed elimina i disallineamenti di data
  server/browser
- Test permanenti (sezione 10.5): `propostaPasto.test.ts` (proposta del
  pasto in base all'ora, incluso lo scavalco della mezzanotte — punto 4) e
  `alimenti.test.ts` (ricerca senza accenti, per sottostringa, ordinata).
  33 test totali
- **Rimandato:** lo spostamento automatico della *data* per la regola del
  giorno logico (inserimento dopo mezzanotte → giorno prima): tocca anche il
  giorno di default di Oggi, si fa insieme. `consumato_alle` è precompilato
  con l'ora attuale solo se si registra oggi, altrimenti `null` (l'editor
  nello sheet è un pezzo successivo)

## 2026-09-06 — Pagina Oggi (fase 2, sola lettura da Dexie)

- Pagina Oggi a tre fasce come da `mockup1oggi.png`: in alto (fisso) data
  navigabile + "Rimangono X kcal" + anello calorie e barre macro affiancati;
  al centro (scorrevole) la lista di tutti i pasti con kcal e alimenti; in
  basso (fisso) il pulsante "+ Aggiungi". Nessun inserimento ancora: i dati
  si leggono da Dexie e basta. Il pulsante "+ Aggiungi" è per ora inerte
- **Route group `(app)`**: `/` e `/profilo` spostati sotto un layout comune
  con la tab bar (Oggi / Statistiche / Profilo), URL invariati. Prima `/`
  non esisteva (nessun `page.tsx` alla radice) ed era una rotta rotta. Stub
  `/statistiche` ("Prossimamente") solo per non lasciare il link morto
- **Set predefinito dei 5 pasti**: non era implementato da nessuna parte
  (la tabella `pasti` restava vuota per ogni utente). Aggiunto
  `garantisciPastiPredefiniti()` in `src/lib/repository/pasti.ts`, chiamato
  al primo caricamento di Oggi se l'utente non ha pasti — scrive in Dexie +
  outbox come ogni altra scrittura, idempotente
- **Obiettivo storico sui giorni passati**: `obiettivoValidoPer()` usa la
  riga di `obiettivi` in vigore *a quella data*, non quella corrente — un
  giorno passato prima del primo obiettivo non mostra un target inventato
- **Colore secondo la sezione 7**: anello verde entro l'obiettivo, arancio
  se superato; barre macro neutre sotto il target, verde a target raggiunto,
  arancio se superato. Scritto nel codice con commento che cita la regola
- **Test permanenti** (Vitest, sezione 10.5): `totaliDiario.test.ts`
  (ricalcolo dei totali dalle voci, giorni vuoti, voci cancellate, scelta
  dell'obiettivo storico) e `dataGiorno.test.ts` (navigazione fra giorni a
  cavallo di mese/anno, 29 febbraio, ora legale). 20 test totali verdi
- **Bug trovato in corso d'opera:** il primo tentativo apriva il calendario
  con un `<input type="date">` invisibile sovrapposto al testo della data.
  Ma di un input date nativo solo una porzione della superficie apre il
  picker (il resto mette a fuoco i segmenti giorno/mese/anno), quindi la
  data era cliccabile solo in parte. Corretto: il titolo-data è un
  `<button>` che chiama `showPicker()` sull'input (tenuto `sr-only`), con
  fallback su `focus()`. Ora funziona da tutta la scritta, anche da tastiera

## 2026-09-06 — Aggiornato lo stato attuale in PUNTO_DI_PARTENZA.md

- Sezione "Stato attuale" riscritta: ripulitura del repo, punto 0
  (local-first) e punto 1 (auth/profilo/fabbisogno) segnati come fatti.
  Prossimi passi aggiornati alla fase 2 (pagina Oggi + inserimento manuale)

## 2026-09-06 — Profilo, fabbisogno e obiettivo: sync collegata, bug di schema corretti

- Aggiunta la sezione Obiettivo alla pagina Profilo: calcolo del fabbisogno
  (Mifflin-St Jeor), storico in `obiettivi`, peso registrato in `misurazioni`
  senza duplicati per lo stesso giorno
- **Bug trovato:** la sincronizzazione outbox→Supabase partiva solo
  all'avvio dell'app e sull'evento `online`, mai dopo una scrittura fatta a
  connessione già presente — un salvataggio a app già aperta restava solo in
  locale finché non si ricaricava la pagina. Corretto: `crea`/`aggiorna`/
  `elimina` nel repository ora richiamano `sincronizzaOutbox()` subito dopo
- **Bug trovato:** i tipi TypeScript in `src/lib/db/tipi.ts` non
  corrispondevano esattamente alle colonne reali su Supabase su più tabelle
  (`obiettivi.proteine/carboidrati/grassi` → `proteine_g/carboidrati_g/
  grassi_g`, `profili.livello_attivita` NOT NULL non riflesso nel tipo,
  `voci_diario.alimento_nome` → `nome_alimento`, mancavano
  `composizioni.alimento_id` e `composizioni_voci.ordine`). Un salvataggio con
  questi campi falliva la sync in silenzio: "Salvato." a schermo, niente su
  Supabase. Tutto allineato e riverificato con un utente reale
- **Bug trovato (io, migration):** mancavano i `GRANT` a livello di tabella
  per il ruolo `authenticated` su tutte e 9 le tabelle — un blocco precedente
  alle policy RLS. Corretto direttamente sul database
- **Bug trovato:** dopo un F5 la pagina Profilo appariva vuota anche con i
  dati già in IndexedDB. Causa: race condition tra `useUtenteId` (risolve
  l'utente in modo asincrono) e `useLiveQuery` — al primissimo render le
  query rispondevano `null`/`[]` invece di "non so ancora", e l'effetto di
  precompilazione si segnava come "già fatto" prima che i dati veri
  arrivassero. Corretto: le query rispondono `undefined` finché `userId`
  non è noto. La stessa correzione ha tolto due `useEffect` che chiamavano
  setState in modo che ESLint segnala come rischioso (`react-hooks/
  set-state-in-effect`) — ora l'aggiornamento avviene durante il render,
  pattern che React stesso consiglia per questo caso
- **Aggiunta infrastruttura di test permanente:** Vitest + Testing Library +
  jsdom (`npm test`), con un test che monta davvero `ProfiloPage` e riproduce
  il timing asincrono reale — verificato che fallisce sul codice vecchio e
  passa su quello corretto, non è un test che passa per caso
- **Trovati e corretti altri 3 errori ESLint** (non warning) dello stesso
  tipo (`react-hooks/set-state-in-effect`) in `register/page.tsx`, rimasti
  invisibili finora per un filtro di verifica sbagliato da parte mia (path
  con `/` invece di `\` su Windows) — lezione: controllare `npm run lint`
  per intero, mai con un filtro che potrebbe nascondere errori

## 2026-09-05/06 — Login e registrazione: tre correzioni

- Aggiunto il recupero password (flusso di reset di Supabase Auth)
- Il form di registrazione non si svuota più se il codice di invito è
  sbagliato — resta solo l'errore, gli altri campi restano compilati
- Messaggi di validazione sui campi vuoti tradotti in italiano
- Le email di Supabase (reset password) restano in inglese per ora — serve
  un SMTP personalizzato per tradurle, rimandato (punto 10.9 del documento)

## 2026-09-05 — Login e registrazione (fase 1)

- Login/registrazione con Supabase Auth, beta a inviti (`CODICE_INVITO` in
  `.env.local`, non pubblico)
- **Bug trovato (io, migration precedente):** un trigger rimasto dalla v0 su
  `auth.users` (`on_auth_user_created`) inseriva in una tabella `public.
  profiles` già droppata, facendo fallire ogni registrazione con "Database
  error saving new user". Rimosso dal database
- Regola aggiunta a `CLAUDE.md`: niente commit senza ok esplicito

## 2026-09-04/05 — Livello dati local-first (fase 0) e ripulitura repo

- Schema Dexie (le 9 tabelle), livello repository, coda outbox — non ancora
  collegati alla sync reale (rimandato in attesa dell'auth)
- Repo esistente ripulito invece di crearne uno nuovo: rimosso il codice v0
  (dashboard, AI, barcode, OCR), tag `v0-vecchia-app` per consultarlo,
  dipendenze aggiornate (`@google/genai`/`html5-qrcode` tolte, `dexie`
  aggiunta)

## 2026-09-04 — Migrazione database

- Drop delle tabelle v0 (`profiles`, `alimenti`, `pasti`, tutte vuote), schema
  auth non toccato
- Nuovo schema a 9 tabelle (sezione 4 di `PUNTO_DI_PARTENZA.md`), RLS attiva
  su tutte con policy `user_id = auth.uid()`; `alimenti` come eccezione
  (catalogo condiviso, sola lettura sulle righe condivise/verificate)
- `updated_at` scritto da un trigger sul server, non dal client
