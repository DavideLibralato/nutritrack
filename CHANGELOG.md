# Changelog

Registro cronologico di cosa è stato fatto, più recente in alto. Per lo stato
attuale e le decisioni vedi `PUNTO_DI_PARTENZA.md` — qui c'è solo la storia.

---

## 2026-09-24 — Striscia non scurita fra lo sheet e la tastiera

- Ultimo difetto della serie sugli sheet su iPhone: dopo la correzione della
  volta scorsa (ancorati al visual viewport) restava una striscia non
  scurita fra il bordo dello sheet e la tastiera (la zona della barra di
  Safari) — lì si rivedeva a piena luminosità la stessa voce di diario che
  si stava modificando nello sheet sopra, sembrava un doppione. Causa: un
  solo `<div>` in `SheetQuantita.tsx`/`SheetNome.tsx` faceva sia da sfondo
  scurito sia da contenitore posizionato sul visual viewport, quindi lo
  scurimento finiva dove finiva l'area visibile, non a tutto schermo.
- Separati i due livelli: uno sfondo scurito ancorato al layout viewport
  (`fixed inset-0`, copre tutto lo schermo) sotto, il contenitore del
  pannello ancorato al visual viewport (come prima) ma trasparente sopra.
  Il tap-per-chiudere ora è su entrambi i `<div>` (si affida all'ordine nel
  DOM, non allo z-index, per decidere chi riceve il tocco dove si
  sovrappongono) — verificato con un test temporaneo (Testing Library,
  cancellato dopo l'uso, non è un test permanente: non è un bug di logica
  sottile) che il tap chiude sia sullo sfondo sia sul contenitore fuori dal
  pannello, e non chiude toccando il pannello stesso.
- Nessun bug aperto noto. Nessuna migration coinvolta (solo UI).

## 2026-09-24 — Contorno di sistema doppio sul focus + cursore mancante sui bottoni

- L'anello di focus verde (corretto la volta scorsa) lasciava comunque
  visibile ACCANTO il contorno blu di focus di Safari: il verde prima era un
  `outline` (che sostituiva quello del browser), ora è un `ring`/`inset-ring`
  (una `box-shadow`, che non lo sostituisce più). Aggiunta a `CLASSE_FOCUS`
  (`src/lib/classeFocus.ts`) la classe `focus-visible:outline-hidden` — non
  `outline-none`: in Tailwind 4 sono due cose diverse, `outline-hidden`
  nasconde il contorno ma lo mantiene (trasparente) in modalità
  forced-colors/alto contrasto, `outline-none` lo toglie anche lì. Verificato
  nel CSS generato dopo la build, non solo che la build passasse.
- Spazzolata delle altre utility Tailwind che in v4 sono rimaste con lo
  stesso nome ma un significato diverso (scala shadow/blur/rounded, `ring`
  nudo, colore di default di `border`/`divide`, selettore di `space-y`,
  variante `hover:`, gradiente): nessuna delle altre è usata nel progetto,
  o è sempre accompagnata da un valore esplicito che la rende irrilevante.
  `rounded` nudo (molto usato) verificato via CSS generato: produce ancora
  `.25rem`, nessuna regressione.
- Preflight di Tailwind 4: tolto anche il `cursor:pointer` di default sui
  `<button>` che la v3 metteva. Rimesso in `globals.css`
  (`button:not(:disabled){cursor:pointer}`, verificato nel CSS generato) —
  invisibile al tocco su telefono ma conta ogni volta che l'app gira con un
  mouse (sviluppo da browser, PWA desktop).
- Il colore dei placeholder è cambiato anche lui nel preflight v4 (da
  `gray-400` fisso a `currentColor` al 50%, cioè più scuro qui perché il
  testo è quasi nero) — verifica ancora in corso da telefono, non ancora
  corretto.
- Scoperto durante il lavoro, non ancora sistemato: il tema chiaro/scuro/
  sistema previsto in `PUNTO_DI_PARTENZA.md` (sezione "Tema chiaro / scuro /
  sistema") non è mai stato costruito — nessun selettore, nessun blocco
  scuro in `globals.css`, nessun `localStorage`. Tutte le scelte di colore
  fatte finora valgono solo per l'unico tema esistente, quello chiaro.

## 2026-09-24 — Sheet sotto la tastiera + anello di focus che sbordava

- Correzione di due difetti su iPhone, entrambi legati ai campi di testo:
  1. Gli sheet di modifica (`SheetQuantita`, `SheetNome`) a volte finivano
     sotto la tastiera invece che sopra: erano ancorati al layout viewport
     (`fixed inset-0`), che iOS non riduce quando la tastiera si apre — il
     caso "corretto" era solo Safari che per caso scrollava la pagina.
     Estratto in `src/lib/areaVisibile.ts` l'hook `useAreaVisibile` (già
     usato solo in `/aggiungi`) che legge `window.visualViewport` e ancora
     l'elemento all'area davvero visibile; ora lo usano anche i due sheet.
  2. L'anello di focus in `CreaAlimentoForm` sbordava dal campo e appariva
     tagliato ai lati: l'`outline` (sempre fuori dal bordo) veniva ritagliato
     dal contenitore `overflow-y-auto` di `/aggiungi` (impostare un solo asse
     di overflow rende `auto` anche l'altro). Centralizzato lo stile — prima
     duplicato identico in 11 file — in `src/lib/classeFocus.ts`, passato da
     `outline` a un anello interno (`box-shadow` inset). Primo tentativo con
     `ring-inset` (sintassi Tailwind v3) non generava nessun CSS in v4:
     corretto in `inset-ring-2`/`inset-ring-accent` (l'utility che v4 usa per
     l'inset ring) e verificato che la regola compaia davvero nel CSS
     generato dopo la build, non solo che la build passasse.
- Nessun bug aperto noto da questi due; nessuna migration Supabase o Dexie
  coinvolta (solo UI).

## 2026-09-20 — Recenti da 10 a 5 in "Aggiungi alimento"

- `NUMERO_RECENTI` in `src/app/aggiungi/page.tsx` da 10 a 5: dieci righe (già
  deduplicate) più l'intestazione spingevano Preferiti e Pasti salvati, le
  due sezioni curate subito sotto, fuori dalla prima schermata su telefono.
  Cinque coprono la rotazione abituale lasciando visibile quello che viene
  dopo. Valore da tarare con l'uso reale, non definitivo — scritto così nel
  commento sopra la costante.
- Nessun test nuovo: `alimentiRecenti` riceve il limite come parametro ed è
  già coperta. Nessun bug aperto.

## 2026-09-20 — Pastiglia Normale/Allenamento in Oggi

- Implementata la differenziazione dei giorni sulla pagina Oggi (sezione 3
  di `PUNTO_DI_PARTENZA.md`): pastiglia accanto alla data, visibile solo con
  `profili.differenzia_giorni` attivo; i tipi selezionabili sono le righe di
  `obiettivi_target` dell'obiettivo corrente, non un elenco fisso. Le tabelle
  `giorni` e `obiettivi_target` esistevano già dalla `version(2)` di Dexie
  (mai usate finora): nessuna nuova migration Dexie né Supabase per questo
  pezzo.
- "La trappola" (sezione 3, regola 3) rispettata: il tipo del giorno si
  scrive in due soli momenti (prima voce di diario, gancio in `creaVoce` di
  `/aggiungi`; tocco della pastiglia) e non si ricalcola mai più dal pattern
  settimanale — anche quando il pattern propone "normale" la riga viene
  scritta lo stesso, altrimenti un cambio di pattern futuro riclassificherebbe
  giorni passati mai scritti. Test permanente in
  `src/lib/repository/giorni.test.ts`.
- Nuova regola scritta in `PUNTO_DI_PARTENZA.md` (sezione 4,
  `obiettivi_target`): se il tipo scritto di un giorno non ha una riga
  corrispondente per l'obiettivo corrente (caso reale: obiettivo appena
  cambiato, target "allenamento" non ancora risalvato), si ripiega sul target
  "normale" dello stesso obiettivo — segnalato con `console.error`, e la
  pastiglia mostra "Normale" anche lei finché il target mancante non torna,
  per non mostrare un tipo con sotto i numeri di un altro. La classificazione
  vera in `giorni` non viene toccata da questo ripiego. Test permanente in
  `src/lib/repository/obiettiviTarget.test.ts`.
- Id delle righe di `giorni` deterministico (UUID v5 da utente + giorno
  logico, namespace proprio — non quello dei pasti predefiniti, per
  leggibilità): su Supabase esiste un vincolo unico
  `giorni_user_data_idx (user_id, data) WHERE deleted_at IS NULL`, verificato
  con l'utente prima di scrivere codice. A differenza di
  `pasti_user_nome_idx` (rimosso il 20/9, voce sotto), questo vincolo **non va
  tolto**: due righe per lo stesso giorno sarebbero un errore di modello, non
  un dettaglio estetico — l'id deterministico è quello che evita lo scontro
  fra due dispositivi offline, non un'alternativa al vincolo.
- Bug trovato in revisione, prima del commit (stessa forma di quello del
  seed pasti di stamattina): `garantisciGiornoPerPrimaVoce` e
  `scriviTipoGiornoScelto` ricevevano le righe di `giorni` già scritte come
  parametro, passato da un `useLiveQuery` — cioè stato React, potenzialmente
  di un giro di ridisegno indietro rispetto a Dexie. Se una classificazione
  appena scritta (pastiglia o prima voce) non fosse ancora arrivata in
  quello stato, la funzione non la vedeva e la sovrascriveva con la
  proposta del pattern: la regola 3 ("la pastiglia vince sempre") cadeva in
  silenzio. Corretto rileggendo Dexie direttamente per id
  (`repositoryGiorni.ottieniPerId`), come già fa `garantisciPastiPredefiniti`
  in `pasti.ts`; `scriviTipoGiornoScelto` non ha più bisogno di leggere
  affatto, visto che l'id è sempre lo stesso e una `crea()` incondizionata
  produce lo stesso risultato di un `aggiorna()`. Nuovo test permanente in
  `giorni.test.ts` per il caso esatto (giorno scritto "normale" a mano,
  pattern che nel frattempo proporrebbe "allenamento" → resta "normale").
- Verificato a mano, 7 passi, prima del commit: differenziazione attivata in
  Profilo, pattern impostato, pastiglia comparsa in Oggi con i tipi da
  `obiettivi_target`, prima voce del giorno scritta con il tipo proposto dal
  pattern, tocco della pastiglia che lo corregge, target (kcal + tre macro)
  che seguono il tipo del giorno mostrato, e — passo decisivo — svuotato il
  pattern nel profilo: `tipo_giorno` è rimasto "allenamento" su Supabase
  (tabella `giorni`, una sola riga, id `bc72e483-291d-5ac9-b40a-1650067d9fec`
  — coincide con l'id ricalcolato a mano dal namespace e da
  `user_id:2026-09-20`, prova che il formato canonico della data regge su
  tutti i percorsi di scrittura). Regola 3 confermata anche fuori dai test.
- Nessun bug aperto: `tsc --noEmit`, `eslint` e la suite di test (110/110)
  passano dopo l'implementazione e la correzione.
- **Nota sulla checklist B.7 di CLAUDE.md**: non si applica a questo commit
  (nessun bump di `version(N)` Dexie, lo schema era già quello di
  `version(2)`). Resta invece aperta, com'era già scritta nella voce del 20/9
  qui sotto, per `version(4)` e `version(5)`: verificate **solo per lettura
  del codice**, non con la prova empirica (Dexie popolato con lo schema
  vecchio → build nuova → righe intatte) che la checklist richiede. Va fatta
  prima del prossimo deploy che tocca lo schema, non di questo.

## 2026-09-20 — Aggiornamento Next.js (CVE) e limite della cancellazione fisica

- Next.js aggiornato da 16.3.0 a 16.3.3 (salto di patch): chiude
  CVE-2026-75604 / GHSA-p293-qw3h-jr36, RCE non autenticata sugli host
  Windows, più l'avviso gemello sull'ottimizzazione immagini AVIF. `npm
  audit` passa da 1 vulnerabilità critica a 0. Non eravamo esposti (deploy
  su Vercel), aggiornato comunque. Test, `tsc --noEmit`, `eslint` e build
  rilanciati dopo: nessuna differenza.
- Documentato in `PUNTO_DI_PARTENZA.md` §9.2 un limite del modello di
  sincronizzazione trovato durante lo sviluppo di oggi: una riga cancellata
  fisicamente sul server (SQL Editor, non dall'app — successo due volte
  oggi durante un reset dei dati di test) è indistinguibile per la discesa
  da una riga mai esistita, quindi nessun dispositivo che la ha già in
  Dexie la toglie — alla prima salita la rimanda su, resuscitandola. Regola
  operativa scritta: svuotare una tabella su Supabase richiede di svuotare
  anche IndexedDB su ogni dispositivo che ha usato quell'account.
- Aggiunta anche una nota che la checklist B.7 (CLAUDE.md) per `version(4)`
  e `version(5)` di Dexie è stata verificata **per lettura del codice**
  (ogni punto che legge `sospesa_il` o i campi di `sync_cursori` ha un
  fallback corretto su un valore mancante), non con la prova empirica che
  la checklist richiede — non è la B.7 superata, resta da fare prima del
  deploy.
- Nessun bug aperto.

## 2026-09-20 — Discesa incrementale e id deterministico per i pasti predefiniti

- La sincronizzazione era a senso unico (solo verso Supabase): un
  dispositivo nuovo non vedeva mai i dati già sul server, due dispositivi
  divergevano senza riallinearsi mai — la causa di fondo del "duplicate
  key" del seed pasti di stamattina. Aggiunta la discesa (`src/lib/sync/
  discesa.ts`): incrementale per tabella (cursore in `sync_cursori`, Dexie
  `version(5)`), paginata (`.range()`, altrimenti il tetto di righe di
  PostgREST perde in silenzio le righe più vecchie di una tabella grande),
  con finestra di sicurezza di un minuto sul cursore (il trigger
  `set_updated_at` timbra l'inizio della transazione, non il commit) e
  confronto dei timestamp per istante (`getTime()`), non come stringhe
  (PostgREST e il client locale usano formati diversi). Una cancellazione
  scaricata vince sempre, anche su una modifica locale "più recente" solo
  perché fatta offline prima di vedere la cancellazione. Discesa sempre
  prima della salita, tre inneschi (mount, online, `visibilitychange`).
- L'id dei 5 pasti predefiniti è passato da casuale a deterministico (UUID
  v5 da utente + nome canonico): due dispositivi che seminano senza
  essersi mai sincronizzati producono ora le stesse righe, mai un
  doppione. Il seed (`garantisciPastiPredefiniti`) è passato da un
  controllo aggregato ("l'utente ha già un pasto?") a un controllo per
  singolo pasto — auto-riparante per una riga persa per un bug, non
  resuscita mai una riga cancellata deliberatamente.
- Rimosso su Supabase l'indice unico `pasti_user_nome_idx`: proteggeva solo
  l'estetica (due pasti con lo stesso nome), al costo di poter bloccare in
  silenzio la coda outbox su una violazione di vincolo. Con l'id
  deterministico il doppione che lo giustificava non può più verificarsi.
- Bug trovato e corretto durante la revisione, prima del commit: la
  paginazione mancante avrebbe perso in silenzio le righe più vecchie di
  una tabella oltre il tetto di PostgREST; la guardia che scarta le voci
  outbox su una cancellazione scoperta scattava solo se il server era più
  recente del locale, mancando esattamente il caso reale (cancellazione
  altrove, modifica locale offline dopo); il confronto dei timestamp come
  stringhe invece che come istanti. Nessun bug aperto.
- Rischio accettato e scritto in `PUNTO_DI_PARTENZA.md`, sezione 9.2: un
  dispositivo nuovo la cui discesa iniziale fallisce proprio mentre un
  pasto predefinito era stato cancellato sul server lo ricrea (non un
  doppione — l'id resta lo stesso — ma la resurrezione di una
  cancellazione). Valutata e scartata un'alternativa più prudente (seminare
  ma trattenere la salita finché la discesa non conferma): si propaga a
  ogni voce di diario collegata via foreign key, sproporzionata al danno.

## 2026-09-20 — Stella preferiti duplicata dopo togli-e-riaggiungi

- Trovato controllando le voci ferme nell'outbox durante la verifica del
  secondo pezzo dei giorni differenziati: `togglePreferito` faceva sempre un
  `crea()` con un id nuovo anche quando una riga cancellata per lo stesso
  alimento esisteva già — il vincolo unico su Supabase non fa eccezione per
  le cancellazioni logiche, quindi ogni ri-aggiunta falliva con "duplicate
  key", in silenzio.
- Ora risuscita la riga cancellata più recente invece di crearne una
  seconda. Verificato con un ciclo aggiungi/togli/riaggiungi contro Supabase
  reale, dopo un reset completo dei dati di test.
- Nessun bug aperto.

## 2026-09-20 — Coda di sync: ordine delle scritture, voci irrecuperabili, seed pasti duplicato

- Tre bug reali, trovati tutti testando dal vivo il secondo pezzo dei giorni
  differenziati (interruttore in Profilo) e verificati contro Supabase reale
  dopo un reset completo dei dati di test:
  - **Ordine della coda**: `sincronizzaOutbox` passava alla voce successiva
    (`continue`) anche quando una voce falliva. Per due righe collegate da
    una foreign key (es. un obiettivo e il suo `obiettivi_target`), se il
    genitore falliva anche solo per un singhiozzo di rete, la figlia veniva
    comunque tentata e falliva per forza — fallimento di sync silenzioso,
    mai visibile a schermo. Ora si ferma al primo fallimento (`break`).
  - **Coda bloccata all'infinito**: proprio quel `break` ha un rischio
    simmetrico — una voce che non riuscirà mai (schema vecchio, vincolo
    violato...) blocca tutte quelle dietro di lei per sempre. Successo
    davvero: un pasto doppione ha bloccato la sync di tutte le tabelle per
    settimane, scoperto solo controllando l'outbox locale a mano. Nuovo
    meccanismo: oltre 5 tentativi falliti consecutivi la voce si accantona
    (esclusa dal ciclo, non cancellata, segnalata con `console.error`) e la
    coda prosegue con le altre. Dexie `version(4)` per il campo nuovo.
  - **Seed pasti duplicato**: il set predefinito dei 5 pasti veniva creato
    due volte a un refresh di distanza — la decisione di seminare dipendeva
    da `pasti`, uno stato React derivato che dopo un refresh completo può
    restare "non ancora aggiornato" più a lungo del previsto.
    `garantisciPastiPredefiniti` ora rilegge Dexie direttamente invece di
    fidarsi dello stato passato dal chiamante, corretto nei due punti che la
    invocano (Oggi e Aggiungi alimento).
- Durante l'indagine, prima di questi fix, la coda locale aveva accumulato
  39 voci ferme dal 6 settembre — quattro cause distinte, non solo questa:
  permessi mancanti sulle tabelle nuove (GRANT dimenticato nella migration
  di creazione, corretto lato Supabase), righe di un vecchio account di
  test, payload pre-split delle tabelle obiettivi/obiettivi_target, e il bug
  preferiti sopra. Tutto ripulito con un reset completo (Supabase +
  IndexedDB locale) prima di verificare i fix su dati puliti.
- Nessun bug aperto.

## 2026-09-20 — Interruttore Giorni differenziati in Profilo

- Secondo pezzo dei giorni differenziati (dopo lo schema del 19/9): sezione
  "Giorni differenziati" in Profilo, spenta di default. Da accesa sblocca il
  selettore dei giorni di allenamento proposti (proposta, non regola) e un
  secondo set di target — accanto a quello "normale" già esistente,
  precompilato la prima volta con gli stessi valori come punto di partenza.
- Correzione rispetto al primo pezzo: `TipoGiorno` da union chiuso
  (`"normale" | "allenamento"`) a stringa aperta + costanti
  (`TIPO_GIORNO_NORMALE`/`TIPO_GIORNO_ALLENAMENTO`) — il documento aggiornato
  chiarisce che i tipi di giorno sono righe definite dall'utente, non un
  elenco fisso nel codice; tolto di conseguenza anche il `CHECK` a due
  valori sulle colonne `tipo_giorno` su Supabase.
- `handleSubmitObiettivo` crea ora anche la riga "normale" in
  `obiettivi_target` per ogni obiettivo nuovo (altrimenti l'invariante si
  rompe in silenzio da qui in avanti, il backfill copre solo gli obiettivi
  precedenti).
- Bug trovati testando questo pezzo dal vivo, corretti nei due commit sotto.

## 2026-09-19 — Schema per giorni differenziati allenamento/normale

- Prima vera modifica di schema dopo aver scritto la procedura anti-perdita-
  dati in `CLAUDE.md`: seguita punto per punto. Solo schema in questo giro,
  nessuna UI collegata ancora.
- Due tabelle nuove su Supabase: `obiettivi_target` (target per
  `tipo_giorno`, legati a un `obiettivo_id`) e `giorni` (tabella sparsa: una
  riga solo per le date il cui tipo è stato deciso). RLS attiva dalla stessa
  migration di creazione, come sempre.
- Backfill di `obiettivi_target` dai valori già su `obiettivi`
  (kcal/proteine_g/carboidrati_g/grassi_g), come riga `tipo_giorno =
  "normale"` per ogni obiettivo esistente — copia, non sposta: `obiettivi`
  resta intatta. Verificato 4/4 righe, nessuna scoperta.
- Dexie passa a `version(2)`: le due tabelle nuove nello store locale,
  nessun `.upgrade()` — non cambia la forma di nessuna riga già sul
  dispositivo. Verificato dal vivo: dati esistenti intatti dopo l'upgrade,
  tabelle nuove presenti e vuote, nessun errore in console.
- `tipi.ts` aggiornato (`ObiettivoTarget`, `Giorno`, `TipoGiorno`).
- Lasciato aperto di proposito: `obiettivi.kcal/proteine_g/carboidrati_g/
  grassi_g` restano l'unica fonte letta da `profilo/page.tsx` finché il
  codice applicativo non passa a leggere/scrivere `obiettivi_target` — pezzo
  successivo, non in questo commit. `get_advisors` ha segnalato una FK non
  indicizzata su `obiettivi_target.user_id` (INFO, coerente con altre 7
  tabelle già così nello schema): lasciata com'è, volumi piccoli, da rivedere
  tutte insieme in un giro dedicato se mai servirà.
- Nessun bug aperto.

## 2026-09-19 — Rinomina/elimina pasti salvati + matita mancante in Recenti/Preferiti

- Chiude il debito 🟡 di `NOTE_MODIFICHE.md`: `RigaPastoSalvato` (sottogruppo
  "Pasti salvati" di Preferiti) ha ora una matita, stessa posizione/stile di
  quella sui risultati di ricerca, separata dal tap sulla riga (aggiunge
  subito) e dal "+". Apre `SheetNome` esteso con `modifica`/`onElimina` —
  stesso pattern già in `SheetQuantita` (Annulla→Elimina→conferma "No/Sì,
  elimina"). Rinomina con lo stesso controllo duplicati della creazione
  (`esisteComposizioneConNome`, ora con `escludiId` per non segnalarsi come
  duplicato di se stesso); elimina riusa `eliminaComposizione`. Non tocca gli
  alimenti/quantità della composizione — per cambiarli si risalva da capo.
- Bug trovato in uso reale: la matita di modifica su un alimento (tuo, non
  ancora verificato) compariva solo nei risultati di ricerca, non in Recenti
  né in Preferiti > Alimenti, pur essendo lo stesso alimento con lo stesso
  criterio di modificabilità — mancava solo in `RigaRapida`, il componente
  condiviso dalle altre due liste. Aggiunta lì, stesso identico criterio e
  bottone: compare ora automaticamente in entrambe.
- Nessun bug aperto.

## 2026-09-13 — Pasti salvati (chiude il punto 3 della roadmap)

- "Salva come preferito" su un pasto in Oggi (icona segnalibro, solo se il
  pasto ha alimenti) promuove le voci di oggi a una composizione riutilizzabile
  (`repository/composizioni.ts`, `salvaPastoComeComposizione`) — copia
  `alimento_id`/`quantita_g` al momento del salvataggio, non un riferimento.
- Nome chiesto con un nuovo `SheetNome`, non `window.prompt()`: risultava
  "not supported" in alcuni ambienti (es. il Simple Browser di VSCode) invece
  di limitarsi a non fare nulla.
- Blocco duplicati: stesso nome (dopo trim) fra i pasti salvati non crea una
  seconda composizione, lo sheet segnala che esiste già.
- In Aggiungi alimento, "Preferiti" mostra anche i pasti salvati, in un
  sottogruppo separato ("Pasti salvati", alfabetico) sotto "Alimenti" — il
  "+" inserisce tutte le righe con lo stesso `gruppo_id`, nessuno sheet
  quantità (le quantità sono già tutte decise).
- Icona segnalibro coerente con lo stato: `pastoGiaSalvato()` (confronto per
  multiset su alimento_id+quantita_g, uguaglianza esatta — 10 test permanenti
  in `pastiSalvati.test.ts`) tiene la stella piena finché il pasto di oggi
  corrisponde a una composizione salvata; ripremerla la toglie dai preferiti
  (cancellazione logica di composizione e voci insieme, non solo della
  composizione).
- Fuori da questo pezzo: modificare/eliminare un pasto salvato dalla lista
  Preferiti stessa (tracciato in `NOTE_MODIFICHE.md`, 🟡) e le ricette (stessa
  tabella `composizioni`, tipo diverso).
- Nessun bug aperto.

## 2026-09-13 — Preferiti in Aggiungi alimento (roadmap punto 3, solo alimenti singoli)

- Trigger scelto per aggiungere/togliere un preferito: una stella dentro
  `SheetQuantita`, non sulle righe di ricerca/Recenti — è un'azione di
  setup, rara, e non doveva aggiungere un terzo bersaglio tappabile su
  liste già strette su mobile (sezione 1). Scrive subito nel repository,
  indipendente da Annulla/Conferma dello sheet.
- Nuovi `repository/preferiti.ts` (`ePreferito`, `togglePreferito`) e
  `inserimento/preferiti.ts` (`alimentiPreferiti()`, ordine alfabetico —
  è un elenco curato, non uno storico — quantità dell'ultima voce o
  `porzione_default_g` se l'alimento preferito non è mai stato registrato).
- In `aggiungi/page.tsx`, sezione "Preferiti" sotto "Recenti"; estratto
  `RigaRapida`, componente condiviso da entrambe le liste per non
  duplicare nome+quantità+kcal+"+".
- Pasti salvati (composizioni) restano fuori, pezzo successivo.
- Nessun bug aperto.

## 2026-09-13 — Recenti in Aggiungi alimento (roadmap punto 3, solo Recenti)

- Nuova `alimentiRecenti()` in `src/lib/inserimento/recenti.ts`: funzione
  pura, ultimi 10 alimenti usati (per `creato_il` di `voci_diario`),
  deduplicati per alimento (solo l'ultima quantità di ciascuno), con
  l'alimento vivo dal catalogo — non la copia storica nella voce.
- In `src/app/aggiungi/page.tsx` sostituisce lo stato vuoto della ricerca
  quando ce n'è storico. "+" sulla riga aggiunge subito con l'ultima
  quantità, senza aprire lo sheet (un tap, come da sezione 3 del documento);
  tap sul nome apre lo sheet come già succede nei risultati di ricerca. La
  scrittura della voce (`creaVoce`) è condivisa fra sheet e "+" rapido.
  `vociGiorno` ora deriva da una nuova `vociTutte` (tutto lo storico)
  invece di una seconda interrogazione a Dexie.
- Preferiti e pasti salvati restano fuori, pezzo successivo.
- Nessun bug aperto. Nota per me: `npm run dev` (Next.js 16) rigenera un
  blocco in fondo a `CLAUDE.md` a ogni avvio — va scartato con `git restore`
  prima di committare, non è farina del sacco dell'utente.

## 2026-09-10 — Fix voce 2: il pulsante "Crea alimento" finiva dietro la tastiera

- La causa non era l'impaginazione del pulsante (già ancorato in fondo) ma
  `100dvh`, che su mobile non si accorcia quando entra la tastiera: la
  tastiera copre il contenuto senza ridurre il layout.
- `src/app/layout.tsx`: `interactiveWidget: "resizes-content"` nel viewport —
  Chrome/Android rimpicciolisce davvero l'area di layout con la tastiera
  aperta (giova anche allo sheet quantità e ai campi del Profilo).
- `src/app/aggiungi/page.tsx`: primo tentativo con solo l'altezza da
  `visualViewport` non bastava su iOS Safari (il documento veniva comunque
  scrollato). Ora il `<main>` è `position: fixed` inchiodato all'area
  visibile con `visualViewport.height` **e** `.offsetTop`, così resta sopra
  la tastiera anche quando iOS fa scorrere il contenuto. Fallback a tutta la
  finestra dove l'API non c'è.

## 2026-09-10 — Giorno logico su Oggi/Aggiungi + note voci 1, 2, 3, 5

- **Giorno logico** (rimandato dal 2026-09-06): un inserimento fatto prima
  dell'ora di inizio del primo pasto appartiene al giorno precedente. Nuove
  funzioni pure `giornoLogico` (`dataGiorno.ts`) e `oraInizioPrimoPasto`
  (`propostaPasto.ts` — il pasto più mattiniero per `ora_inizio`, non per
  `ordine`). Oggi parte dal giorno logico quando non arriva da `?giorno=`
  (il `giorno` è `null` finché i pasti non arrivano da Dexie, poi impostato
  durante il render); /aggiungi scrive `data` e sceglie proposta pasto /
  `consumato_alle` sullo stesso criterio. "Oggi", freccia avanti e calendario
  si fermano al giorno logico. Test permanenti aggiunti (47 test totali).
- **Voce 1** — ordine dei valori come sulle etichette reali dei prodotti
  (Kcal → Grassi → Carboidrati → Proteine): form crea/modifica alimento,
  anteprima dello sheet quantità, barre macro di Oggi, target del Profilo.
- **Voce 5** — campo "Marca" (facoltativo) nel form crea/modifica; in modifica
  ora è aggiornabile (prima restava invariato). Nella lista risultati della
  ricerca compare "Nome · Marca" quando valorizzata (`etichettaAlimento` in
  `repository/alimenti.ts`). Nessuna migration: `alimenti.marca` esisteva già.
- **Voce 2** — risultati e stati vuoto/nessun-risultato ancorati sotto la
  barra di ricerca invece che centrati; "Crea alimento manualmente" è una
  riga fissa in fondo, presente in ogni stato; il tasto Invio/"Vai" della
  tastiera crea l'alimento quando la ricerca non trova nulla.
- **Voce 3** — in Oggi, tap sulla riga di un pasto con alimenti ne
  nasconde/mostra la lista. Stato in memoria, per id di pasto (una fascia
  chiusa resta chiusa cambiando giorno; al riavvio torna tutto aperto).

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
