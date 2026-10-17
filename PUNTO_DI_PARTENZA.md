# Punto di partenza — Libra, app di tracking nutrizionale

**L'unica fonte** per posizionamento, schermate, modello dati, decisioni,
ordine di sviluppo e stato dell'app (lo stabilisce `CLAUDE.md`). Quando una
decisione cambia, si aggiorna qui nello stesso momento: non esistono due
versioni della stessa scelta. La storia di come ci si è arrivati, commit per
commit, sta in `CHANGELOG.md`.

Dove una parte descrive qualcosa che non esiste ancora nel codice, è
segnata "(non ancora costruito)"; il quadro completo di cosa c'è e cosa manca
è nella sezione 11.

---

## 1. Il posizionamento

L'app non è "un tracker nutrizionale con l'OCR". È **l'app in cui registrare un
pasto costa zero fatica**. Statistiche, obiettivi e insight esistono solo per
dare senso ai dati raccolti.

Criterio di decisione per ogni feature futura:

> Questo riduce l'attrito dell'inserimento o lo aumenta?

Se lo aumenta, va rimandata o scartata, per quanto sia bella.

---

## 2. Cosa è cambiato rispetto alla spec iniziale

La specifica precedente (30 sezioni) è un buon **catalogo di idee future**, ma
non è un piano di sviluppo: contiene tutte le feature di MyFitnessPal, Cronometer
e Yazio messe insieme, comprese V2 e V3.

Decisioni prese:

- Si tiene la vecchia spec come backlog, non come roadmap.
- L'MVP è molto più piccolo: **una sola modalità di inserimento rifinita**
  (manuale) + recenti e preferiti. L'OCR arriva subito dopo.
- Rimandate: barcode, foto piatto AI, inserimento vocale, inserimento testuale AI,
  insight AI, assistente AI, meal planner, community, condivisione nutrizionista,
  database ristoranti, gamification, export multiformato, integrazione fitness.
  La "community" resta rimandata: **Amici** (dal 15/10, sezione 3) non lo è,
  è solo il modo di mandare a un amico una copia di un alimento, senza
  feed né profili da sfogliare (eccezioni scritte in 9.5 e 9.6).
- Il documento deve avere una sezione **"fuori scope"** esplicita, non solo la
  lista di cosa includere.

---

## 3. Le 4 pagine

Navigazione a tab bar con tre voci (Oggi, Statistiche, Impostazioni). La
pagina di inserimento si apre sopra, non è una tab. Impostazioni (dal 3/10)
ha preso il posto di Profilo: un elenco a gruppi da cui si entra nelle
sotto-pagine, Profilo compreso (vedi "Impostazioni" più sotto).

**La tab bar è una pillola fluttuante** (dal 2/10, "opzione B"). Non è più
una striscia a tutta larghezza: è staccata dai bordi (16 px ai lati), alta
64 px, con gli angoli del tutto arrotondati, e appoggiata appena sopra la
barretta home. Lo sfondo è semitrasparente con la pagina sfocata sotto
(`backdrop-filter`), con bordo sottile e ombra leggera. La voce attiva ha una
capsula di sfondo e il colore accento. Dietro le barre in fondo c'è una
sfumatura dal trasparente al colore di fondo, così il testo che passa sotto
non disturba. Vale su Oggi, Statistiche, Impostazioni e le sue sotto-pagine
(`BarraNavigazione`). Sulle sotto-pagine resta attiva la voce Impostazioni, e
toccarla riporta all'elenco, come su iPhone.

**Layout delle pagine con la tab bar.** La pillola è `position: fixed`, e
**lo spazio in fondo lo lascia ogni pagina**, non il layout, perché le
pagine non scorrono allo stesso modo:
- **Impostazioni (con le sotto-pagine) e Statistiche**: a scorrere è il
  **documento**; in fondo lasciano `--ingombro-tab-bar`.
- **Oggi**: alta esattamente lo schermo, scorre solo la lista dei pasti, che
  arriva fino in fondo passando sotto "+ Aggiungi" e la pillola. In fondo alla
  lista c'è `--ingombro-oggi`, così l'ultimo alimento si porta sempre sopra
  bottone e pillola.

I numeri stanno tutti in `globals.css`, in un posto solo:

| Variabile | Cosa è |
|---|---|
| `--tab-bar-altezza` | 64 px |
| `--tab-bar-distanza` | dal fondo dello schermo alla pillola |
| `--ingombro-tab-bar` | distanza + altezza |
| `--aggiungi-altezza` | il bottone "+ Aggiungi" |
| `--spazio-fra-barre` | lo spazio fra pillola e bottone, e fra pillola e barra Salva |
| `--ingombro-oggi` | pillola + spazio + bottone |

Livelli: sfumatura z-20; pillola, "+ Aggiungi" e barra Salva z-30;
BarraAnnulla z-40; gli sheet z-50, sopra a tutto.

**Barretta home di iOS.** `--tab-bar-distanza` è
`max(env(safe-area-inset-bottom) − 12px, 12px)`:
- **app installata**: safe area di 34 px, quindi la pillola sta a 22 px dal
  bordo, appena sopra la barretta;
- **Safari**: sotto c'è già la barra degli strumenti, la safe area vale 0,
  quindi 12 px.

Lo stesso `env()` fa da spazio in fondo agli sheet. iOS lo restituisce solo
se il viewport ha `viewportFit: "cover"` (layout radice), altrimenti vale 0 e
nell'app installata la tab bar finiva sotto la barretta.

In alto non serve nulla: con `statusBarStyle: "default"` la barra di stato di
iOS è opaca e la pagina comincia sotto l'orologio. La testata di Oggi ha
comunque `env(safe-area-inset-top)` nel padding (vale 0), così resterebbe
fuori dall'orologio anche passando a `"black-translucent"`. Le altre testate
andrebbero sistemate in quel caso.

**Mentre scrivi, le barre si nascondono.** Su un dispositivo touch, finché un
campo ha il fuoco, sono invisibili la pillola della tab bar, la sfumatura,
"+ Aggiungi" e la barra Salva di Impostazioni > Profilo. Un
campo qui è un input di testo, numero, email, password o data, una textarea o
una select; non contano checkbox, radio e bottoni. Chiusa la tastiera, le
barre ricompaiono. È solo CSS, in `globals.css`: `:has()` sul `<body>`, le
barre segnate con `data-nascondi-mentre-scrivi`, e la media query
`(hover: none) and (pointer: coarse)`. Al PC, con mouse e tastiera fisica, le
barre restano sempre. Si usa `visibility: hidden` e non `display: none`: la
barra Salva è sticky e occupa spazio nella pagina, toglierla farebbe saltare
il contenuto.

Un'eccezione, dall'11/10: la barra Salva di `ModificaPastoSalvato` (la
modifica di un pasto salvato) **sparisce del tutto** (`display: none`,
attributo `data-sparisci-mentre-scrivi`, regola limitata a quella
schermata). Con `visibility` restava una fascia vuota fra l'elenco e la
tastiera. Lì si può: la barra è l'ultima della colonna, e senza di lei
l'elenco si allunga invece di saltare. Chiusa la tastiera (✓ o tocco
fuori), la barra ricompare.

Il motivo è la tastiera di iPhone, che copre il layout senza accorciarlo.
Quando si tocca un campo, a volte iOS fa scorrere il documento e le barre
fisse restano sotto la tastiera. Altre volte sposta la finestra e le barre
salgono sopra la tastiera. Provato sul telefono il 26/9: il layout da solo
non lo controlla, nemmeno con il documento che scorre. Su Android
`interactiveWidget: "resizes-visual"` (layout radice) fa comportare la
tastiera come su iOS.

Gli sheet e `/aggiungi` non cambiano: si agganciano alla parte visibile
(`useAreaVisibile`) e restano sopra la tastiera. Che sotto uno sheet la tab
bar sia nascosta non è un problema. **Regola:** qui non si corregge lo
scorrimento con JavaScript dopo che iOS l'ha fatto (`visualViewport`,
`scrollTo`, spazi calcolati). Arriva sempre in ritardo di un movimento e la
pagina balla: è il tentativo `a648455`, annullato.

Le descrizioni qui sotto corrispondono ai mockup realizzati a settembre 2026 e
li sostituiscono come specifica: dove il mockup e il testo precedente non
coincidevano, ha vinto il mockup.

### Oggi (schermata di apertura)

Dall'alto:

1. **Data + calorie rimanenti**: "Mercoledì 4 set" e sotto, in grigio,
   "Rimangono 620 kcal". Questa seconda riga non era prevista ed è la cosa più
   utile della schermata: risponde alla domanda vera ("quanto posso ancora
   mangiare?") senza far fare un calcolo. **La data è navigabile** (vedi
   "Inserimento retroattivo"), e su un giorno passato la seconda riga cambia
   testo: "2043 di 2200 kcal", perché "rimangono" su ieri non vuol dire niente.
   **Giorno sopra la data** (dai mockup): la data è un blocco centrato su due
   livelli. Sopra c'è il giorno della settimana intero, piccolo (11 px),
   maiuscolo e tenue ("MERCOLEDÌ"); sotto c'è "4 set" in grande, che non va
   mai a capo. Tutto il blocco è il pulsante del calendario, e lo screen
   reader legge la data per esteso ("mercoledì 4 settembre"). Sulla stessa
   riga, a destra, ci sono il pulsante **Oggi** (solo su un giorno diverso da
   quello corrente) e, se la differenziazione dei giorni è attiva, una
   piccola pastiglia **Normale / Allenamento** (vedi "Giorni normali e giorni
   di allenamento"). Se la differenziazione non è attiva, la pastiglia non
   c'è. **La testata ha sempre la stessa forma**, misurata con i font veri:
   nel caso peggiore ("30 mag", "Oggi" e "Allenamento" insieme) è larga
   315 px, e ci sta a 390 e a 375 px di schermo. Rete di sicurezza, solo CSS
   (`flex-wrap`): se "Oggi" e la pastiglia non entrano, scendono insieme
   sulla riga sotto, a destra. Succede a 320 px con tutti e due, o con un
   tipo di giorno dal nome più lungo di "Allenamento"
2. **Anello + macro affiancati**: l'anello calorie a sinistra con il consumato
   grande al centro e l'obiettivo sotto ("1580 / 2200"); a destra le tre barre
   macro con valore/target ("Proteine 98 / 140 g"), in ordine **Grassi,
   Carboidrati, Proteine** (vedi "Le barre macro" nella sezione 7).
   Affiancati, non impilati: sta tutto sopra la piega
3. **I pasti in lista** — quanti e quali dipende dall'utente (tabella `pasti`,
   cinque nel set predefinito, non quattro come nel mockup). Per ognuno il nome,
   le kcal totali a destra, e sotto in grigio una riga per ogni alimento:
   il nome a sinistra (troncato con "…" se lungo), grammi e kcal a destra
   ("80 g · 200 kcal"); un tocco sulla riga apre l'alimento in modifica.
   Un pasto vuoto mostra "—", non viene nascosto. Un tocco sulla
   riga di un pasto con alimenti nasconde o mostra il suo elenco (solo in
   memoria: a ogni apertura dell'app sono tutti aperti).
   **Segnalibro e kcal sempre allineati** (dall'11/10): le kcal del pasto
   stanno in uno spazio largo almeno 4 cifre, allineate a destra
   (`min-w-[4ch]`, `tabular-nums`), con "kcal" fuori dallo spazio e senza
   andare a capo; così il segnalibro sta sempre nella stessa posizione,
   con 2 cifre come con 4. Con 5 cifre lo spazio si allarga invece di far
   uscire il testo. L'area di tocco del segnalibro è di 44 px, con margini
   negativi che la compensano: per l'impaginazione occupa quanto l'icona
   (18 px + 4 px per lato), e né l'icona né le kcal si spostano.
   **Numeri delle voci incolonnati** (dall'11/10): nella riga di ogni voce
   ("80 g · 200 kcal") le kcal stanno in uno spazio largo almeno 3 cifre,
   allineate a destra (`min-w-[3ch]`, `tabular-nums`); così "·" e "g"
   restano fermi e i grammi finiscono tutti nello stesso punto. Oltre 999
   kcal lo spazio si allarga. I grammi si scrivono all'italiana, con la
   virgola ("12,5 g"), con la stessa funzione dei doppioni
   (`formattaGrammi`), anche nella copia che segue il dito trascinando
4. **Pulsante "+ Aggiungi"**, a pillola, centrato

Nient'altro: nessun grafico, nessun banner, nessun consiglio.

**Layout: in alto fisso, sotto la lista che scorre fino in fondo.**

- **In alto, fisso**: data, calorie rimanenti, anello e barre macro
- **Sotto, scorrevole**: la lista dei pasti, fino al fondo dello schermo
- **Fluttuante**, centrato appena sopra la pillola della tab bar: il pulsante
  "+ Aggiungi", con un'ombra leggera. La lista ci passa sotto, sfumata. La
  barra "Aggiunto — Annulla" compare sopra il pulsante, senza coprirlo

Fino al 2/10 c'era una fascia bassa fissa per "+ Aggiungi". È sparita con la
tab bar fluttuante: Oggi resta a scorrimento interno (la pagina è alta
esattamente lo schermo), così anello e calorie restano sempre visibili.

Il pulsante non deve mai finire sotto la piega: è l'azione per cui esiste l'app.
Se su schermi piccoli la fascia scorrevole risulta troppo stretta, la fascia
alta può rimpicciolirsi mentre si scorre (l'anello diventa una riga compatta) —
da valutare sul dispositivo vero, non ora.

#### Swipe per cambiare giorno (deciso il 2/10)

Trascinando il dito in orizzontale si cambia giorno, come con le
freccette: **dito verso sinistra = giorno dopo, verso destra = giorno
prima**. Freccette, calendario e "Oggi" restano come sono.

- **Area**: il pannello del giorno, cioè anello, macro e lista, che si
  muovono insieme col dito. La testata (data, "Oggi", pastiglia, calorie
  rimanenti) resta ferma e cambia testo quando cambia il giorno. Al
  rilascio oltre la soglia il pannello esce e il giorno nuovo entra dal
  lato giusto. Sotto la soglia torna al suo posto. Durante il
  trascinamento il giorno vicino **non** si vede: servirebbe disegnare due
  giorni insieme, rimandato a dopo la prova d'uso
- **Oltre oggi + 7 non si va** (l'ultimo giorno del diario, sezione
  "Inserimento retroattivo"; fino al 10/10 era oggi): il pannello segue il
  dito solo per un terzo (elastico) e torna indietro, senza cambiare giorno
- **Verticale contro orizzontale**: la direzione si decide dopo 10 px e
  non cambia più. È orizzontale solo se lo spostamento orizzontale supera
  1,5 volte quello verticale (al massimo ~34° di inclinazione). Il
  pannello ha `touch-action: pan-y`, così lo scroll verticale resta al
  browser. Deciso l'orizzontale, la lista non scorre più fino al rilascio
  (`preventDefault` sul `touchmove` e `overflow-y: hidden` per la durata
  del gesto)
- **Soglie**: 80 px, oppure un gesto veloce (0,5 px/ms negli ultimi
  100 ms) di almeno 30 px. Tutti i numeri sono costanti in
  `src/lib/decisioneSwipe.ts`
- **Bordi**: un gesto che parte a meno di 24 px da un bordo è ignorato (in
  Safari quello sinistro è "indietro"). Vale anche nell'app installata,
  per coerenza
- **Tocchi**: un trascinamento non apre lo sheet della riga da cui è
  partito e non preme stella o freccetta. Si blocca un click solo, che
  scade dopo 400 ms o al tocco seguente. Il mouse è escluso: al PC ci sono
  le freccette
- **Spento** con uno sheet aperto, con un campo di testo a fuoco e durante
  l'animazione di un cambio già in corso
- **Barra "Aggiunto — Annulla"**: resta. Annulla lavora per id, quindi
  funziona su qualunque giorno mostrato
- **`prefers-reduced-motion`**: il gesto vale, ma niente si muove e il
  giorno cambia subito
- **A ogni cambio di giorno** (swipe, frecce, "Oggi", calendario) la lista
  riparte dall'alto

Nessuna libreria: Pointer Events nell'hook `useSwipeGiorno`
(`src/lib/swipeGiorno.ts`). Le decisioni sono funzioni pure, testate in
`decisioneSwipe.test.ts`.

#### Tieni premuto: sposta, duplica, elimina (deciso il 6/10)

Design chiuso, provato su mockup interattivi e su iPhone. Si costruisce in
cinque passi, un branch ciascuno: **A** il gesto (`tieni-premuto`), **B**
menu + Elimina + Annulla generale (`menu-elimina`), **C** Sposta dal menu
+ foglio doppioni (`sposta-menu`), **D** trascinamento (`trascina`), **E**
Duplica (`duplica`). Ogni passo parte dal branch del precedente, e
**tutti i passi arrivano su main insieme alla fine**, dopo un giro di
prove completo (deciso il 6/10, al posto di "A e B insieme, poi un passo
alla volta"). Main non si tocca nel frattempo senza dirlo prima.

**Il gesto** (passo A, `src/lib/tieniPremuto.ts`, decisioni pure in
`decisioneTieniPremuto.ts`). Su un alimento o sul nome di un pasto con
alimenti:

- 450 ms di pressione ferma sollevano la riga (fondo pieno, ombra, leggero
  ingrandimento). Se prima il dito si muove di più di 8 px (distanza, non i
  due assi separati) il gesto si annulla e torna scroll o swipe. 8 px sta
  sotto i 10 px a cui lo swipe del giorno decide la direzione: i due gesti
  non si contendono mai lo stesso movimento
- dal sollevamento, una finestra di 160 ms decide il ramo: il dito si
  muove di più di 8 px (misurati da dove era al sollevamento) →
  **trascinamento**; resta fermo per tutta la finestra, o si alza →
  **menu**. Deciso il menu, un movimento successivo non conta più
- dal sollevamento il dito è del gesto: lo swipe del giorno lo lascia
  andare (`puntatoriRivendicati.ts`), la lista non scorre
  (`preventDefault` sul `touchmove` e `overflow-y: hidden`, come lo swipe),
  e il click che segue non apre lo sheet né chiude il pasto
- Pointer Events, quindi vale anche col mouse (tasto principale).
  `contextmenu` (tasto destro, Maiusc+F10, tasto Menu, tieni-premuto
  nativo di Android) apre il menu direttamente, ma **non** se c'è un gesto
  col dito in corso o finito da meno di 400 ms (alcuni Chrome lo mandano a
  dito alzato): su Android il menu non si apre due volte. Il menu del
  browser sulle righe è sempre soppresso
- su ogni riga: `-webkit-touch-callout: none`, `-webkit-user-select: none`,
  `user-select: none` (senza, Safari su iPhone apre il menu di selezione
  del testo). `touch-action` resta `pan-y`, non `none`: con `none` la lista
  non scorrerebbe più partendo da una riga, cioè quasi mai (punto 1 del
  piano; provato su iPhone il 6/10: lo scroll da una riga funziona, con lo
  slancio)
- `prefers-reduced-motion`: niente ingrandimento né animazioni, il gesto
  vale
- **pasto vuoto**: niente gesto (tutte le voci del menu sarebbero vuote)
- il tap resta com'è: sheet quantità sull'alimento, apri/chiudi sul pasto

**Il menu** (B, `src/components/MenuContestuale.tsx`): ancorato alla
riga, che resta staccata finché il menu è aperto. Si apre sotto la riga
se ci sta, altrimenti sopra; mai sotto "+ Aggiungi" e la pillola, mai
fuori schermo, mai sopra la riga (calcolo in `posizioneMenu.ts`, con
test). Un tocco fuori o Esc lo chiudono senza fare niente; anche Tab,
come i menu di sistema. Tutte le uscite (tocco fuori, anche sulla riga
stessa che sta sotto lo sfondo; Esc; Tab; una voce) passano da una sola
chiusura (`chiudiMenu` in Oggi), che chiude anche il gesto e rilascia il
dito che ha aperto il menu (`azzera` di `useTieniPremuto`). Fuoco: alla
prima voce, con frecce su/giù, solo se il menu è stato aperto da tastiera
o tasto destro; alla chiusura torna alla riga solo se si è chiuso da
tastiera. Col dito il fuoco non si sposta: cambiare cose sotto un dito
ancora appoggiato è quello che Safari gestisce male (bug del 6/10, sotto).
Swipe e tieni-premuto spenti finché è aperto.
Il click del dito che ha aperto il menu (che si alza dopo) non conta:
sfondo e voci rispondono solo a un tocco cominciato dopo l'apertura.

*Bug del 6/10, trovato su iPhone:* dopo aver chiuso il menu con un tocco
fuori, la lista non scorreva più e il tieni-premuto non ripartiva, fino a
ricaricare. Il menu compare sotto il dito ancora appoggiato, e la fine di
quel tocco può non arrivare alla lista: il gesto restava "aperto"
(touchmove bloccati, `overflow-y: hidden`, ogni tocco nuovo scartato come
secondo dito). Ora:
- il gesto finisce nel momento in cui si decide il menu;
- la chiusura del menu rilascia il dito;
- in ogni caso un nuovo dito *primario* chiude un gesto rimasto aperto,
  sia nel tieni-premuto sia nello swipe: se è primario, nessun altro dito
  è giù.

Riprodotto in un test sulla pagina (`page.test.tsx`), che col codice di
prima fallisce. Trovato nello stesso giro: un timer che scatta una
frazione di millisecondo prima della scadenza ora si riprogramma, invece
di lasciare il gesto fermo (test in `tieniPremuto.test.tsx`).
Voci: Sposta (sempre), Duplica (sul pasto solo se ha alimenti: oggi
sempre, visto che il pasto vuoto non ha il gesto), Elimina ("Elimina
tutto il pasto" sul pasto: cancella le voci, non la fascia). **Ogni voce
compare solo quando funziona**: col passo B c'era solo Elimina; dal
passo C c'è Sposta, sopra Elimina; dal passo E Duplica, fra le due. Voci
spente sembrerebbero rotte.

**Elimina** (B): nessuna conferma prima, "Annulla" dopo (come
l'inserimento, punto 10.2). Le voci si rileggono da Dexie al tocco.
Messaggio: "Eliminato: Mela" per un alimento, "Eliminato: Pranzo (3
alimenti)" per il pasto intero, la stessa forma di "Aggiunto" per un
pasto salvato. Anche "Elimina" nello sheet quantità passa da qui: stessa
fotografia, stessa barra con "Annulla", e come dal menu **nessuna
conferma**: fino al passo B lo sheet chiedeva "No / Sì, elimina" e poi
non aveva modo di tornare indietro; ora un tocco elimina e "Annulla"
rimedia (test sulla pagina in `src/app/(app)/page.test.tsx`). Le altre
conferme "Sì, elimina" (alimento del catalogo, pasto salvato) restano:
lì l'Annulla non c'è o è diverso.

**Sposta** (C dal menu, D trascinando): sul trascinamento tutti i pasti
sono bersagli (bordo tratteggiato), quello sotto il dito si evidenzia, il
pasto di partenza si spegne solo trascinando un pasto intero. Rilascio
fuori da un pasto, o sul pasto di partenza: niente. **Scorrimento
automatico vicino ai bordi** (cambiato il 6/10 dall'uso: la decisione 2
del piano diceva "niente scorrimento automatico", ma con molti pasti
quelli fuori schermo non si raggiungevano). Resta anche Sposta dal menu,
che apre l'elenco dei pasti del giorno meno quello di partenza.

Il trascinamento, costruito col passo D (`src/lib/trascinaInPasto.ts`,
decisioni pure in `decisioneTrascinamento.ts`):
- **A seguire il dito è una copia della riga** (`CopiaTrascinata`), in
  un portale su `document.body` con `position: fixed`, mossa scrivendo
  `transform` direttamente sull'elemento. Non la riga vera: i riquadri
  dei pasti non tagliano niente, ma la lista intera è un contenitore con
  `overflow-y: auto`, che per le regole CSS taglia in ogni direzione, e
  la riga sparirebbe appena esce dalla lista. Lo stato React cambia solo
  all'inizio, alla fine e quando cambia il pasto sotto il dito.
- **La copia:** per un alimento nome e "80 g · 200 kcal", larga quanto la
  riga; per un pasto intero è compatta, "Pranzo · 3 alimenti".
- **L'originale** resta al suo posto, spento: la riga dell'alimento,
  oppure tutto il pasto se si trascina il pasto intero.
- **I bersagli:**
  - tutti i pasti tranne quello di partenza hanno il bordo tratteggiato,
    anche quelli chiusi;
  - quello sotto il dito ha sfondo e bordo in accento;
  - bordo e sfondo sono un riquadro disegnato dietro al contenuto
    (`::before`), così niente si sposta. In verticale sta dentro il
    pasto, rientrato di 4 px: fra due pasti vicini restano 8 px e i bordi
    non si toccano. Ai lati sporge di 8 px nel margine della lista, perché
    il testo arriva al bordo del pasto. Fino al 6/10 era un `outline`
    appena fuori dal riquadro, e fra due pasti vicini si sovrapponeva
    (controllo in `src/app/bordiBersagli.test.ts`).
- **Scorrimento automatico:**
  - in alto e in basso nella parte visibile della lista c'è una fascia di
    64 px; quella in basso sta sopra "+ Aggiungi" e la pillola;
  - con il dito lì dentro la lista scorre da sola: più il dito è vicino al
    bordo, più va veloce, fino a 800 px al secondo, e oltre il bordo resta
    alla massima;
  - si ferma quando il dito esce dalla fascia o la lista è a fine corsa;
  - mentre scorre, il pasto sotto il dito si ricalcola anche a dito fermo;
  - vale anche con "Riduci movimento": è una funzione, non un effetto.
  Le regole sono funzioni pure in `decisioneTrascinamento.ts`
  (`velocitaScorrimento`, `prossimoScrollTop`); il ciclo a ogni
  fotogramma (`requestAnimationFrame`) è in `trascinaInPasto.ts`.
- **Dove vale il rilascio:** i pasti si misurano all'inizio. Il dito non fa
  scorrere la lista, e lo scorrimento automatico sposta i pasti misurati
  di quanto ha scorso. Vale solo la parte
  visibile della lista, tagliata in basso dove cominciano "+ Aggiungi" e
  la pillola; un pasto scorso sotto la testata o sotto le barre non è un
  bersaglio.
- **Rilascio su un altro pasto:** lo stesso spostamento di Sposta dal menu,
  con il foglio dei doppioni se serve, il messaggio e Annulla. Il foglio
  dei pasti non si apre.
- **Rilascio altrove, o gesto interrotto dal sistema** (`pointercancel`:
  una chiamata, l'app in background): niente si scrive, e la copia torna
  verso la riga e sparisce. Con "Riduci movimento" sparisce subito.
- **Dopo ogni rilascio** un click che arriva entro 400 ms viene fermato in
  tutta la pagina: nessuno sheet e nessun "+ Aggiungi" si apre per
  errore.

**Doppioni** (C, riusato da E): stesso `alimento_id`, mai il nome; le voci
con `alimento_id` nullo non sono mai doppioni. Foglio con una riga per
alimento (quantità esistente = somma delle righe di destinazione, in
arrivo = somma di quelle di partenza) e quattro scelte: **Somma**
(predefinita, una riga sola; resta la riga di destinazione con i **suoi**
valori copiati, anche se quelli della partenza erano diversi per una
correzione del catalogo), **Tieni separati**, **Scrivi quantità** (una
riga sola col numero scritto; campo vuoto → "Per salvare mancano: …"),
**Non spostarlo / Non duplicarlo**. Somma e Scrivi riducono a una riga
anche più righe dello stesso alimento. Annulla o tocco fuori annullano
tutto: si scrive solo alla conferma, e il piano si ricalcola sulle righe
rilette da Dexie.

Costruito col passo C:
- **Una scelta per alimento** (mockup approvato il 5/10, "Opzione A,
  completa"). Ogni alimento in comune ha il suo blocco nel foglio
  (`SheetDoppioni`):
  - il nome, e sotto le quantità ("Pranzo 100 g · Cena 50 g": prima la
    destinazione, poi quello che arriva);
  - la sua griglia 2×2 con Somma già scelta, che mostra il totale
    ("Somma (150 g)");
  - con "Scrivi quantità", il campo "Quantità __ g" sotto il blocco;
  - una riga con l'esito: "→ Una riga da 150 g", "→ Due righe: 100 g e
    50 g" ("→ 3 righe separate" se le righe erano già di più), "→ Una riga
    da 120 g (scritta a mano)", "→ Resta in Cena, non si sposta". L'ultima,
    e il pulsante "Non spostarlo" quando è scelto, nel colore d'avviso.

  Con più di un alimento, sotto il titolo compare "Scegli cosa fare per
  ciascuno."; con uno solo il foglio è lo stesso, con un blocco.
  "Per salvare mancano: …" sta sotto il bottone, con i nomi degli alimenti
  il cui campo è vuoto. (Nella prima versione del passo C le scelte erano
  una per tutto il foglio: interpretazione mia, corretta il 6/10.)
- **Quale riga resta** con Somma o Scrivi: la più vecchia (`creato_il`,
  poi `id`) fra quelle di destinazione. I grammi sommati restano a due
  decimali.
- **Alla conferma** si rileggono le righe (`spostaNelPasto` in
  `src/lib/repository/vociDiario.ts`). Se gli alimenti in doppione non
  sono più quelli che l'utente ha visto (un altro dispositivo nel
  frattempo), non si scrive niente e il foglio si riapre con l'elenco
  nuovo e un avviso.
- **Annulla**: le scritture passano dalla fotografia del passo B, quindi
  "Annulla" riporta anche i grammi sommati o scritti a mano. Se non si è
  scritto niente (tutto escluso) la barra non ha "Annulla".

**Campi data** (`<input type="date">`, regola del 6/10): Safari su iPhone dà
al campo data una larghezza minima sua, che ignora `width: 100%`, e il
campo Giorno di Duplica allargava il foglio oltre lo schermo. In
`globals.css`:
- tutti i campi data hanno `min-width: 0` e `max-width: 100%`;
- quelli a tutta larghezza (classe `campo-data`: Duplica, cambio di
  obiettivo) tolgono anche il controllo nativo (`appearance: none`), con il
  valore a sinistra e l'altezza di una riga;
- la data di nascita in Profilo e il calendario nascosto di Oggi tengono
  il loro aspetto;
- il foglio Duplica non scorre mai in orizzontale.

Controllo in `src/app/campiData.test.ts`.

**Duplica** (E): giorno (campo data, massimo oggi, controllato anche nel
codice; parte dal giorno mostrato) e pasto (parte da quello d'origine).
L'originale non si tocca mai. Le copie: stessi `alimento_id`, quantità e
valori della voce originale (anche se l'alimento è stato cancellato dal
catalogo: è "ripeti quello che ho mangiato"), `creato_il` adesso,
`consumato_alle` come in /aggiungi, un `gruppo_id` nuovo comune se è un
pasto intero. Su un giorno senza voci, con i giorni differenziati,
`garantisciGiornoPerPrimaVoce` come in /aggiungi (la trappola, sopra). Se
il giorno è diverso da quello mostrato, la barra ha anche "Vedi".

Costruito col passo E (`SheetDuplica`, regole pure in
`src/lib/diario/pianoDuplica.ts`, scritture in `duplicaNelPasto` di
`src/lib/repository/vociDiario.ts`):
- **Le righe che si duplicano non sono MAI doppioni di se stesse**
  (regola del 6/10). Duplicare la Mela nel suo stesso pasto e giorno crea
  una seconda riga Mela, senza foglio dei doppioni: altrimenti "Somma"
  modificherebbe l'originale. Il foglio si apre solo se nel pasto di
  destinazione c'è un'ALTRA riga dello stesso alimento. Lì vale tutto come
  in Sposta (una scelta per alimento, quarta scelta "Non duplicarlo"), e
  Somma o Scrivi quantità modificano quell'altra riga, mai l'originale.
- **La data:**
  - si ricontrolla nel foglio e di nuovo prima di scrivere
    (`dataScrivibile` in `dataGiorno.ts`): un giorno vero, fino a oggi + 7
    (dal 10/10, "Inserimento retroattivo"). Oltre, il messaggio dice il
    limite: "Scegli un giorno fino a mar 13 ott.";
  - alle 00:30 il limite si è già spostato di un giorno, anche se in UTC è
    ancora ieri.
- **`consumato_alle`:** l'ora attuale solo se il giorno è oggi, altrimenti
  vuoto, come in /aggiungi.
- **Il giorno di destinazione si classifica** solo se nasce almeno una
  copia; "Annulla" non toglie quella riga di `giorni`, come in /aggiungi.
- **Messaggi**, con lo stesso principio di Sposta:
  - "Duplicato: Mela in Pranzo", e "Duplicato: Colazione in Pranzo" per un
    pasto intero;
  - "… di lun 5 ott" se il giorno è diverso da quello che si guarda;
  - "(tranne «Mela», che c'era già)" se ci sono esclusioni;
  - tutto escluso: "Nessuna copia: «Mela» c'è già in «Pranzo»", senza la
    parola "Duplicato" e senza Annulla.
- **"Vedi"** è un secondo tasto della barra, solo testo accanto ad
  "Annulla", e c'è solo quando il giorno è diverso. Porta a quel giorno.
  La barra resta, con il tempo che le restava e "Annulla" ancora valido;
  "Vedi" sparisce, perché quel giorno ora è sullo schermo. Colore
  `--testo-capsula` direttamente sul vetro: il contrasto è controllato in
  `contrasti.test.ts`, da 5,74:1 in su per tutti i colori, in chiaro e in
  scuro.
- **Il fuso orario dei test** è fissato a `Europe/Rome`
  (`vitest.config.mts`): i test sulla mezzanotte valgono su qualsiasi
  computer, anche su uno impostato su UTC.

**Messaggi** (barra BarraAnnulla, mai una nuova): dicono cosa è successo
davvero. Per Sposta: "Spostato: «Nome» → «Pasto»"; escluso l'unico
alimento: "«Nome» resta in «Pasto», non spostato" (mai "Spostato");
pasto intero: "Spostato: «Pasto A» → «Pasto B»", con "(tranne «Nome»,
rimasto in «Pasto A»)" se ci sono esclusioni; tutti esclusi: "Nessuno
spostamento: …". Duplica ed Elimina con lo stesso principio.

Cosa si accorcia nella barra (`src/lib/diario/testiSpostamento.ts`):
- restano sempre interi il verbo, le parole che danno il senso ("→",
  "tranne", "resta in", "non spostato", "Nessuno spostamento") e i numeri;
- i nomi dei pasti si accorciano con "…" oltre 16 caratteri: di solito
  sono brevi, è solo una cintura;
- i nomi degli alimenti sono la parte lunga:
  - nei messaggi brevi ("Spostato: Yogurt → Pranzo") l'alimento sta nel
    campo `nome` della barra: se la frase non sta su una riga la barra va
    a capo, e il nome si accorcia con "…" solo se da solo è più lungo di
    una riga. Il pasto d'arrivo e il giorno restano sempre interi;
  - nelle frasi con esclusioni la barra va a capo, e ogni alimento si
    accorcia oltre 22 caratteri;
  - oltre due esclusi si scrive "«Yogurt», «Mela» e altri 2".

**Annulla solo in avanti** (B, il pezzo da testare di più). La discesa
fa vincere sempre una cancellazione arrivata dal server (sezione 9.2):
rimettere `deleted_at = null` su una riga la cui cancellazione è già
partita può farla sparire di nuovo alla discesa seguente. Quindi
l'Annulla di queste operazioni scrive solo in avanti: le righe cancellate
si **ricreano** (id nuovo, stesso contenuto, compresi `creato_il` e
`gruppo_id`), quelle modificate tornano ai valori di prima, quelle create
si cancellano. Nessuno punta all'id di una voce, quindi cambiarlo non
rompe niente. Se una scrittura fallisce a metà operazione, si applica
subito lo stesso annullo alle righe già toccate.
Costruito col passo B in `src/lib/repository/vociDiario.ts`: ogni
operazione restituisce una **fotografia** (le righe com'erano prima, per
quelle modificate o cancellate, e gli id di quelle create), e
`annullaOperazione` la riporta indietro. Anche l'"Aggiunto — Annulla"
passa da qui: la sua fotografia ha solo righe create, e il comportamento
è quello di prima. L'id di una riga ricreata è un UUID v5 calcolato
dall'id originale: annullare due volte, o riprovare dopo un guasto, la
trova già ricreata e non ne crea una seconda. Test in
`vociDiario.test.ts`, compreso il caso della cancellazione già arrivata
sul server.

Nessuna migration e nessuna nuova tabella: sono tutte scritture sui campi
già esistenti di `voci_diario`.

### Aggiungi alimento (la pagina su cui si gioca il prodotto)

Si apre a tutto schermo con freccia indietro e, come titolo, **il nome del pasto**
("Cena"). Il pasto è **proposto automaticamente in base all'ora** e il titolo è
**toccabile per cambiarlo** (vedi "I pasti" più avanti).

Ordine degli elementi:

1. **"Scansiona etichetta"** *(non ancora costruito: arriva con l'OCR,
   fase 5)* — riquadro grande con l'accento, titolo e
   sottotitolo ("Valori letti in automatico"). È il differenziante, ma resta il
   *secondo* percorso
2. **Campo di ricerca** con lente e placeholder "Cerca un alimento"
3. **Recenti** — righe con nome, e sotto in grigio **l'ultima quantità usata e le
   kcal corrispondenti** ("Petto di pollo · 150 g · 248 kcal"), con un **"+"**
   a destra
4. **Preferiti** — stessa struttura, include i pasti salvati ("Colazione
   standard · 3 alimenti · 320 kcal")

**Salvare un pasto intero.** I preferiti non contengono solo alimenti singoli:
contengono anche **pasti completi** ("Colazione standard · 3 alimenti"). La
colazione sempre uguale si aggiunge così con un tap, non con tre.

Il punto è **come nasce** un pasto salvato: non lo si costruisce in una schermata
apposta, lo si **promuove da una giornata già registrata**. Sulla riga del pasto
in Oggi: "Salva come preferito". Registri la colazione una volta con calma, e da
lì in poi è un tap. Nessun lavoro di configurazione, nessuna schermata nuova.

**Modificare un pasto salvato** (deciso il 2026-09-26). La matita sulla sua
riga in Preferiti (separata dal tap sulla riga, che lo aggiunge subito) apre
una schermata di modifica dentro Aggiungi, a tutta altezza con una testata
sua: nome, elenco degli alimenti con i grammi, "Aggiungi alimento" ed
"Elimina pasto". Codice in `src/components/ModificaPastoSalvato.tsx`,
logica e test in `src/lib/inserimento/modificaPastoSalvato.ts`. Dall'11/10
la stessa schermata si apre anche dalla riga del pasto in Impostazioni >
Preferiti (sezione 3, "Preferiti e pasti salvati"). Per questo si aggancia
da sola alla parte visibile della finestra (`fixed` con `useAreaVisibile`,
la stessa geometria del `<main>` di Aggiungi) e sta sopra la tab bar
(z-40). Il sottotitolo "3 alimenti · 412 kcal" è uno solo, per la riga in
Aggiungi, quella in Impostazioni e la testata dell'elenco qui
(`sottotitoloPastoSalvato` e `kcalPastoSalvato` in
`src/lib/inserimento/pastiSalvati.ts`).

- **Come il Profilo, tutto in sospeso fino al Salva.** I grammi si cambiano
  nel campo sulla riga, con sotto "Prima: 150 g". Il campo segue la stessa
  validazione dello sheet quantità (vedi "Grammi validi" più sotto),
  altrimenti c'è un messaggio accanto alla riga e il Salva resta spento. La "×" toglie un alimento, e "Annulla modifiche"
  torna a com'era. Niente si scrive in Dexie prima del Salva. Chi esce dalla
  freccia con modifiche non salvate riceve un avviso, e così anche chi
  chiude o ricarica la scheda. Il gesto "indietro" del telefono invece esce
  senza avviso (in Profilo invece il cambio di scheda ora avvisa: vedi
  "Impostazioni", il guardiano)
- **Aggiungere un alimento**: si cerca nel catalogo, come in Aggiungi, e si
  conferma con lo stesso sheet quantità. La conferma aggiunge una riga in
  fondo, in memoria, e non scrive nel diario. Da qui non si crea un
  alimento nuovo: se manca, lo si crea prima in Aggiungi. Nessun riordino
  delle righe: `ordine` decide solo la sequenza a schermo, e il confronto
  della stella lo ignora
- **Alimento già nel pasto: i grammi si sostituiscono, non si sommano.** Lo
  sheet si apre con i grammi attuali di quella riga, e il numero confermato
  è quello che finisce nel pasto. Con la somma, chi scrive "150" pensando al
  totale si ritroverebbe 250 senza accorgersene. I pasti vecchi con due righe
  dello stesso alimento restano come sono, ognuna col suo campo, e lo sheet
  agisce sulla prima
- **Eliminare subito, dopo una conferma**: "Elimina pasto", e togliere
  l'ultimo alimento, che chiede "È l'ultimo alimento del pasto: toglierlo
  elimina il pasto salvato". Sono le sole scritture fuori dal Salva. Un
  pasto salvato vuoto non deve esistere (i pasti fantasma del 22/9)
- **Il diario non cambia.** Le voci hanno la loro copia dei valori (sezione
  4), e la modifica vale da adesso in avanti. Un giorno, anche oggi, che
  conteneva il pasto nella versione vecchia vede spegnersi la stella in
  Oggi perché non coincide più. È corretto
- **Il Salva rilegge Dexie**, non lo stato React, e si ferma senza scrivere
  in due casi. Se il pasto è stato cancellato altrove, l'esito è
  `pasto-eliminato` e la schermata si chiude con un messaggio. Se nome o
  righe non sono più quelli caricati all'apertura, l'esito è
  `pasto-cambiato`: la schermata mostra la versione riletta e dice che le
  modifiche non sono state salvate. Le due versioni non si uniscono: per un
  caso raro, con un solo utente, sarebbe logica sottile. Un alimento uscito
  dal catalogo mentre la schermata era aperta non finisce in
  `composizioni_voci` e non fa scattare `pasto-cambiato`. Le altre modifiche
  si salvano, e il messaggio dice cosa è stato escluso. Se non resta nessun
  alimento, il pasto si cancella. Il nome doppio si controlla con
  `esisteComposizioneConNome`, escludendo il pasto stesso
- **Ordine delle scritture**: nome, grammi cambiati, righe nuove, poi la
  cancellazione delle righe tolte. Finché resta almeno un alimento, una riga
  viva c'è sempre. Se si cancella tutto, prima le righe e per ultima la
  composizione (spiegato nel commento di `salvaModificaPasto`)

**Grammi validi** (deciso il 2026-09-26). Una sola funzione,
`leggiGrammi` in `src/lib/inserimento/grammi.ts`, per lo sheet quantità e
per la modifica di un pasto salvato. Su Supabase `voci_diario.quantita_g` e
`composizioni_voci.quantita_g` sono `numeric(7,2)`, e da lì vengono le
regole:
- un numero **maggiore di zero e al massimo 99999,99**. Oltre, Dexie lo
  salverebbe e la sync fallirebbe in silenzio (la voce viene accantonata dopo
  5 rifiuti del server);
- **arrotondato a due decimali prima di scrivere**, come fa il server. Senza,
  Dexie terrebbe 12,345 e il server 12,35. Un valore che arrotondato fa 0
  non vale.

La parte comune a ogni colonna `numeric(7,2)` (virgola accettata,
arrotondamento, massimo 99999,99) sta in `leggiNumeroDecimale`, in
`src/lib/numeriDecimali.ts`. La usano sia `leggiGrammi` sia i valori
dell'alimento, qui sotto.

**Valori dell'alimento** (deciso il 2026-09-26). "Nuovo alimento" e
"Modifica alimento" (`CreaAlimentoForm`) passano da `validaValoriAlimento`,
in `src/lib/inserimento/valoriAlimento.ts`. In `alimenti`, kcal, macro per
100 g e porzione predefinita sono tutti `numeric(7,2)`, quindi valgono le
stesse regole dei grammi. In più, per i valori per 100 g, ci sono i limiti
fisici, perché superarli è sempre un errore di battitura:
- ogni macro (grassi, carboidrati, proteine, zuccheri, fibre, saturi, sale)
  **al massimo 100 g**, e le **kcal al massimo 900** (il grasso puro fa
  9 kcal/g). Zero è ammesso;
- **zuccheri non più dei carboidrati, saturi non più dei grassi**, perché
  ne sono una parte. Il confronto usa i valori già arrotondati;
- **grassi + carboidrati + proteine al massimo 101,5 g**, cioè 100 g più
  1,5 g di tolleranza. Il motivo: le etichette arrotondano al grammo da 10 g
  in su e al decimo sotto (linee guida UE del 2012 sul Reg. 1169/2011),
  quindi ogni valore stampato può essere più alto del vero di 0,5 g, e tre
  valori insieme di 1,5 g. In etichetta UE la fibra è fuori dai
  carboidrati, quindi la somma vera sta sotto 100 anche per olio e
  zucchero. Il messaggio sta sotto il gruppo "Valori per 100 g", non su un
  campo, e blocca il salvataggio;
- la porzione predefinita deve essere maggiore di zero, con il solo limite
  dello schema.

Il messaggio compare sotto il campo sbagliato mentre si scrive, e il
pulsante resta spento finché c'è un errore. I campi obbligatori ancora vuoti
non si segnano in rosso uno per uno, perché un form nuovo parte vuoto, non
sbagliato: si elencano sopra il pulsante ("Per salvare mancano: …").

**Zuccheri, fibre, saturi e sale non sono nel form, per scelta** (decisa il
2026-09-26): quattro campi in più da compilare a ogni alimento creato a
mano aumentano l'attrito (sezione 1). Si scrivono `null`, e in modifica
restano quelli che erano. Arriveranno con l'OCR (fase 5), che li leggerà
dall'etichetta. La validazione li copre già, comprese le regole
zuccheri ≤ carboidrati e saturi ≤ grassi, che oggi quindi non possono
scattare.

**Due percorsi di inserimento, non uno.** Questa è la decisione che il mockup
introduce e che va tenuta:

- **"+" sulla riga** → aggiunge subito con la quantità dell'ultima volta, senza
  aprire nulla. **Un tap.** È il percorso normale: mangi il solito yogurt nella
  solita quantità
- **tap sul nome** → apre lo sheet quantità precompilato e modificabile. È il
  percorso per quando la quantità cambia

Lo sheet quantità resta **uno solo**, identico per ogni sorgente (sezione 5).

**Doppioni in Aggiungi** (dal 10/10, branch `doppioni-aggiungi`). Prima
aggiungere un alimento già presente nel pasto creava una seconda riga senza
dire niente. Ora valgono le stesse regole di Sposta e Duplica ("Tieni
premuto", sopra, "Doppioni"):
- **Il confronto è per `alimento_id`, mai per nome.** Le righe in arrivo non
  sono doppioni fra loro: due Mela in un pasto salvato restano due righe, se
  nel pasto non c'è già una Mela;
- **lo stesso foglio** (`SheetDoppioni`), con un blocco per alimento e le
  quattro scelte. Le quantità si leggono "Pranzo 100 g · in arrivo 50 g".
  La quarta scelta è "Non aggiungerlo", con l'esito "→ Resta quello che
  c'è, non si aggiunge", e il bottone è "Aggiungi". Somma è già scelta,
  quindi **basta un tocco** per confermare;
- **alla conferma le righe del pasto si rileggono da Dexie**
  (`aggiungiNelPasto` in `src/lib/repository/vociDiario.ts`), mai dalla
  lista sullo schermo: così anche "la stessa Mela due volte di fila" trova
  la prima. Se i doppioni non sono più quelli visti, non si scrive niente e
  il foglio si riapre con l'avviso, come in Sposta;
- **o tutto o niente, anche per un pasto salvato.** Le scritture passano
  tutte da `applicaScritture`; prima il pasto salvato scriveva in parallelo,
  e un guasto a metà lasciava metà pasto nel diario;
- **"Non aggiungerlo" vale anche se il doppione sparisce** fra il foglio e
  la conferma (per esempio cancellato da un altro dispositivo): un "no"
  esplicito vale più di un cambiamento arrivato da altrove (regola del
  10/10). Vale solo per Aggiungi: Sposta e Duplica, nello stesso caso,
  spostano o copiano (sotto, sezione 11, "Difetti e verifiche aperti");
- **niente aggiunto = si resta su /aggiungi senza barra.** Succede con
  Annulla, con il tocco fuori, con Esc, o con tutto su "Non aggiungerlo";
- **un blocco contro il doppio tocco** ("aggiunta in corso", un `useRef`
  comune ai tre percorsi). Si prende subito al tocco e si libera dopo un
  errore, dopo "niente aggiunto" e alla chiusura del foglio senza
  conferma. Resta preso mentre il foglio è aperto e mentre si torna a Oggi.
  Senza, due tocchi ravvicinati sul "+" scrivevano due righe;
- **i testi della barra** (`messaggioInserimento` in
  `src/lib/inserimento/testiBarra.ts`) dicono cosa è successo davvero:
  "Aggiunto: Mela" (anche con "Tieni separati"), "Sommato: Mela → 150 g",
  "Aggiornato: Mela → 120 g" (quantità scritta a mano), "Aggiunto:
  Colazione (3 alimenti)". Con degli esclusi: "Aggiunto: «Colazione»
  (tranne «Mela», che c'era già).". **"(N alimenti)" conta gli alimenti
  entrati, non le righe**: un alimento sommato a una riga che c'era già
  conta, uno escluso no.

Test: `src/app/aggiungi/page.test.tsx`, oltre a quelli di
`pianoInserimento`, `aggiungiNelPasto` e `testiBarra`.

**Dopo ogni inserimento, "Annulla"** (punto 10.2). I percorsi che scrivono
nel diario sono tre: la conferma dallo sheet, il "+" rapido su
Recenti/Preferiti, e il "+" di un pasto salvato. Passano tutti da una sola
funzione di /aggiungi, che chiama `aggiungiNelPasto`. Quando è entrato
qualcosa tornano a Oggi, e lì compare la barra in basso (i testi sono
sopra, "Doppioni in Aggiungi") con "Annulla" per qualche secondo. Il
verbo sta prima del nome, così non ci sono problemi di genere ("Mela
aggiunto"). Se la frase non sta su una
riga va a capo; il nome si accorcia con "…" solo se da solo è più lungo
di una riga. Lo stesso formato vale per "Eliminato: Mela" e "Ripristinato:
Mela" in /aggiungi. Com'è fatta la barra (vetro, icona, linea del tempo) è
descritto nella sezione 7.

- **Cosa annulla.** Esattamente quello che l'inserimento ha toccato,
  dalla sua fotografia: le righe create si cancellano (in modo logico), e
  le righe che c'erano già tornano ai grammi di prima, se l'alimento era
  stato sommato o scritto a mano. Lo fa `annullaOperazione` in
  `src/lib/repository/vociDiario.ts`, che rilegge le voci da Dexie e passa
  dall'outbox (punto 10.6). Dopo compare "Annullato."
- **La riga di `giorni` resta.** Se si annulla la prima voce di un giorno,
  la classificazione scritta in quel momento non si cancella: nei secondi
  della barra può essere arrivata una scelta esplicita dalla pastiglia, che
  vince sempre. Annullare si comporta come cancellare l'ultima voce dallo
  sheet in Oggi.
- **Una barra sola.** Un nuovo messaggio sostituisce il precedente e
  riparte da capo.
- **Da /aggiungi a Oggi** l'inserimento passa in memoria
  (`src/lib/inserimento/ultimoInserimento.ts`), non nell'URL: ricaricando
  la pagina o tornando indietro la barra di un inserimento vecchio non
  ricompare. Oggi lo legge una volta sola, in un `useEffect`.

### Statistiche

- **Selettore Settimana / Mese** in alto, a segmenti
- **Due riquadri di sintesi**: "Media kcal 2043" e "Media proteine 126 g". Numero
  grande, etichetta piccola sopra. **La media conta solo i giorni con almeno una
  voce**: dividere per 7 quando due giorni sono vuoti abbassa la media senza che
  nessuno se ne accorga, e fa sembrare un deficit una settimana normale in cui
  hai solo dimenticato di registrare. Sotto il numero, in piccolo, su quanti
  giorni è calcolata ("su 5 giorni")
- **Grafico a barre "Calorie giornaliere"**: una barra per giorno (L M M G V S D),
  con **linea tratteggiata dell'obiettivo** etichettata ("obiettivo 2200").
  Attenzione: con i giorni differenziati l'obiettivo **non è più unico** — la
  linea continua diventa un trattino sopra ogni singola barra, e l'etichetta
  sparisce. Anche la media settimanale va letta con prudenza quando mescola
  giorni con target diversi. Il colore è informazione: barra normale = dentro l'obiettivo, barra calda = sopra
  l'obiettivo, barra grigia = giorno senza dati. Nessuna legenda: il significato
  si legge dal confronto con la linea
- **Grafico a linea "Peso"**, con l'intervallo agli estremi ("6 sett. fa" →
  "78,4 kg"), e la linea del peso obiettivo se impostato

Possibile più avanti, e senza bisogno di nessun dato esterno: **"Quando mangio"**,
la distribuzione degli orari dei pasti e l'ora media dell'ultimo pasto. È una
descrizione di un'abitudine, non un consiglio — resta dentro il perimetro.

Niente insight AI in V1: prima servono dati veri da interpretare.

### Impostazioni (dal 3/10, al posto della tab Profilo)

Strutturata come le impostazioni dell'iPhone: un elenco a gruppi arrotondati
da cui si entra nelle sotto-pagine. Mockup approvato in
`docs/mockups/impostazioni.html`. Componenti: `GruppoImpostazioni` (riquadro
con titolo e nota facoltativi), `RigaImpostazioni` (icona in un quadratino,
etichetta, valore grigio a destra, freccia; la linea fra le righe parte dal
testo, regola `.riga-impostazioni` in `globals.css`), `SchedaAccount`,
`IntestazioneSottopagina` ("‹ Impostazioni" e titolo grande). Per le pagine con
un modulo (dal passo "obiettivi"): `RigaCampo` (campo nella riga con
l'unità e "Prima: …"), `Interruttore`, `SelettoreSegmenti` (la scheda
scelta su `--segmento-attivo`), `CerchiGiorni`, `SalvataggioModulo` (barra
Salva, "Salvato." e bivio); il gruppo mostra "Modificato" ed errori.

**Struttura finale** (le righe compaiono solo quando la loro pagina esiste:
un comando che non fa niente sembra rotto):

- in cima la **scheda dell'account**: iniziali (prime due parole del nome),
  nome, "78,4 kg · 180 cm"; porta a **Profilo**;
- gruppo **Alimentazione**: Obiettivi ("2500 kcal", oppure "2500 · 2950
  kcal" con i giorni differenziati accesi), Pasti e orari, **Alimenti**
  (dal 15/10, branch `catalogo-alimenti`: il catalogo personale, "46
  alimenti"; con alimenti mandati dagli amici, "2 in arrivo" con il
  pallino al posto del numero, branch `condivisione-alimenti`, decisione
  del 16/10; vedi "Alimenti" più sotto), **Preferiti**
  (dall'11/10, in Alimentazione dal 15/10, prima stava in App: la pagina
  si intitola "Preferiti e pasti salvati", ma per esteso l'etichetta
  veniva accorciata con "…" su iPhone; a destra "12 alimenti · 3 pasti",
  vedi "Preferiti e pasti salvati" più sotto), Peso;
- gruppo **Amici** (dal 15/10, branch `amici`, passo 6), sotto
  Alimentazione: una riga **Amici** con l'icona delle due persone e, a
  destra, quanti amici ("2 amici", "1 amico", "Nessuno",
  `testoRigaAmici`); "…" mentre legge, "Serve la connessione" se la
  risposta non arriva, come la riga Username in Profilo. Si legge online
  (`useAmicizie`, la stessa divisione della pagina). La riga apre sempre
  la pagina. Il pallino e "2 nuove" arrivano al passo 7; vedi "Amici" più
  sotto;
- gruppo **App**: Aspetto (Chiaro / Scuro / Sistema e colore principale;
  a destra tema e colore, "Sistema · Verde"), Sincronizzazione (la
  pagina con l'indicatore dal 10/10, sezione 9.2; a destra della riga lo stato in breve con un pallino colorato: "Tutto
  salvato", "In corso…", "2 in attesa", "Errore", "Accedi di nuovo", "Da
  controllare");
- **Informazioni** (versione da `package.json` e commit corto del deploy,
  `VERCEL_GIT_COMMIT_SHA`, scritti nel codice alla build da `env` in
  `next.config.ts`; in locale "sviluppo");
- **Esci** in fondo, in arancio, con la conferma di sempre;
- sotto Esci, in un gruppo suo, **Elimina il mio account** (costruita
  e provata su iPhone l'11/10, branch `elimina-account`; mockup
  `docs/mockups/elimina-account.html`): rossa (`--pericolo`, sezione 7),
  allineata a sinistra, con la freccia; porta alla sottopagina. Decisioni
  in §9.6, "Elimina il mio account".

**Rotte.** `/impostazioni`, `/impostazioni/profilo`,
`/impostazioni/obiettivi`, `/impostazioni/pasti`, `/impostazioni/peso`,
`/impostazioni/aspetto`, `/impostazioni/preferiti`,
`/impostazioni/alimenti` (branch `catalogo-alimenti`),
`/impostazioni/amici` (branch `amici`, in `PAGINE_APP` dal passo 6),
`/impostazioni/sincronizzazione`, `/impostazioni/informazioni`;
`/impostazioni/elimina-account` (branch `elimina-account`).
Le cartelle stanno in `src/app/(app)/impostazioni/`, quindi ereditano il
layout con la tab bar. "‹ Impostazioni" è un link a `/impostazioni`, non un
"torna indietro": aperta da un indirizzo diretto, o ricaricata offline, la
pagina non ha cronologia. `/profilo` rimanda a `/impostazioni` con un
redirect temporaneo (307) in `next.config.ts`. Ogni sotto-pagina nuova va
anche in `PAGINE_APP` del service worker (sezione 9.2), nello stesso passo.

**Modifiche non salvate: il guardiano** (`GuardianoModifiche`). Una pagina
con un modulo dice "ho modifiche" (`useSegnalaModifiche`); "‹ Impostazioni"
e le voci della tab bar (`LinkProtetto`), compreso il tocco sulla voce già
attiva, invece di navigare aprono "Esci senza salvare?" (Annulla / Esci
senza salvare). Il contesto sta in `src/app/(app)/layout.tsx` perché deve
avvolgere insieme le pagine e la tab bar. Quando la pagina col modulo si
chiude, lo stato torna "nessuna modifica". Ricarica e chiusura della pagina
le copre il `beforeunload` della pagina. Resta scoperto solo il gesto
"indietro" di Safari dal bordo dello schermo, che non si può intercettare
(nell'app installata non c'è).

**Decisioni sull'analisi del 3/10** (valgono per tutti i passi):

- **A. L'interruttore "giorni differenziati" resta**, spento di default. Nella
  pagina Obiettivi sta in un gruppo "Giorni di allenamento" (interruttore e
  cerchi L M M G V S D) **sopra** i target: accendendolo, il contenuto
  compare sotto e non fuori dallo schermo. Da spento niente selettore
  Normale | Allenamento, niente giorni, e la riga in Impostazioni dice
  "2500 kcal"; da acceso "2500 · 2950 kcal"
- **B. Campi numerici direttamente nella riga**, allineati a destra. La
  domanda "cambio di dieta / correzione" si fa una volta sola, al Salva
- **C. Testo sotto i giorni**: "Da oggi i giorni segnati partono come
  Allenamento. Quelli già registrati non cambiano." (regola 3 più sotto)
- **D. Superficie bianca in chiaro** (come nel mockup): passo a sé, in cui si
  rimisura anche il contrasto della capsula attiva
- I 4 colori principali (verde, blu, viola, petrolio) e il grigio `--tenue`
  più scuro sono decisi al passo "accento", sul mockup
  `docs/mockups/colore-principale.html` (sezione 7)
- **Schema dati invariato**: la settimana tipo (`giorni_allenamento_default`)
  e l'interruttore esistono già; tema e colore principale sono preferenze
  del dispositivo (`localStorage`)

**Ordine dei passi**, un branch ciascuno, provabile da solo su iPhone:
1. `impostazioni` — elenco, Profilo spostato intero, Sincronizzazione,
   Informazioni, Esci, guardiano, redirect, service worker *(fatto 3/10)*
2. `superficie` — superficie bianca in chiaro, contrasto della capsula
   *(fatto 3/10, branch `superficie`)*
3. `obiettivi` — pagina Obiettivi; Profilo resta con i dati personali
   *(fatto 3/10, branch `obiettivi`)*
4. `peso` — pagina Peso *(fatto 3/10, branch `peso`)*
5. `tema` — Aspetto: Chiaro / Scuro / Sistema *(fatto 3/10, branch `tema`)*
6. `accento` — colore principale e grigio più scuro *(fatto 3/10, branch
   `accento`)*

**La pagina Impostazioni è completa (passi 1–6, tutti provati su iPhone,
il 6 il 3/10).** Oggi l'elenco ha: la scheda dell'account (→ Profilo);
**Alimentazione**: Obiettivi, Pasti e orari (dal 9/10, "5 pasti": quanti
valgono oggi), Alimenti (dal 15/10, branch `catalogo-alimenti`, "46
alimenti"), Preferiti (dall'11/10, qui dal 15/10), Peso; **App**:
Aspetto, Sincronizzazione; **Informazioni**; **Esci**. Le righe che mancavano
rispetto alla struttura finale sono state fatte come **lavori a sé**, non
come passi di questa pagina:
- ~~Preferiti e pasti salvati~~: pagina e riga fatte l'11/10 (branch
  `preferiti`, più sotto "Preferiti e pasti salvati"), provate su iPhone
  l'11/10 (sezione 11, "Fatto");
- ~~l'indicatore di sincronizzazione~~: pagina, riga e pallino sulla tab
  fatti il 10/10 (sezione 9.2, "L'indicatore"), provati su iPhone il 10/10
  (sezione 11, "Fatto").

### Obiettivi (dal 3/10, passo "obiettivi")

In Impostazioni > Obiettivi (`/impostazioni/obiettivi`), con
"‹ Impostazioni" e il guardiano delle modifiche. Dall'alto:

- **Obiettivo**: Dimagrire / Mantenere / Massa (selettore a segmenti),
  **peso obiettivo** (facoltativo; se c'è, comparirà come linea di
  riferimento nel grafico del peso, come la linea tratteggiata delle
  calorie) e **"Calcola proposta"**: riempie i target del giorno normale dal
  fabbisogno, usando i dati personali salvati e l'ultima pesata. Senza
  pesata è disattivato e la nota porta a Peso con un link; se mancano dati
  personali, il messaggio dice quali e porta a Profilo. I target restano
  modificabili a mano
- **Giorni di allenamento** (decisione A): l'interruttore "Obiettivi diversi
  nei giorni di allenamento" e, se acceso, i cerchi L M M G V S D con la
  frase della decisione C. Da spento: "Da spento, l'app usa gli stessi
  obiettivi tutti i giorni", e niente pastiglia in Oggi
- **Target**: Calorie, Grassi, Carboidrati, Proteine, con i campi nella riga
  (decisione B). Con l'interruttore acceso, sopra c'è il selettore Normale |
  Allenamento, con un pallino sulla scheda che ha modifiche non salvate; la
  scheda Allenamento, senza una riga "allenamento", parte dai valori del
  normale. Sotto: "In vigore dal …", oppure, senza periodo, "Il primo
  obiettivo vale per tutti i giorni, finché non lo cambi"

Un solo Salva per tutta la pagina, anche cambiando scheda; il bivio "cambio
vero o correzione?" una volta sola, al Salva, solo se serve.

**Utente senza profilo.** Accendere l'interruttore e salvare crea la riga
in `profili`, e `livello_attivita` è `NOT NULL` su Supabase (sezione 4,
"profili"): il livello serve anche se l'utente vuole solo i giorni di
allenamento. Il Salva si ferma con "Prima di salvare i giorni di
allenamento, completa il tuo profilo con il livello di attività." e il link
"Vai a Profilo". Il collegamento non è ovvio per l'utente (il livello serve
a "Calcola proposta"), ma toglierlo vorrebbe dire cambiare lo schema:
lasciato così il 3/10.

### Peso (dal 3/10, passo "peso")

In Impostazioni > Peso (`/impostazioni/peso`), con "‹ Impostazioni":

- **Ultima pesata**, in grande con la data: "85 kg · 2 ottobre" (l'anno
  solo se non è quello in corso), o "Nessuna pesata registrata"
  (`testoUltimaPesata`). Il peso ha lo stesso formato ovunque: decimale
  solo se c'è, con la virgola ("85 kg", "78,4 kg")
- **Registra peso**: un campo con il suo pulsante, che salva **subito** in
  `misurazioni` (una pesata al giorno, la regola è qui sotto). È
  fuori da ogni Salva: il peso è una misurazione, non un'impostazione.
  Per questo la pagina non ha il guardiano: un numero scritto e non
  registrato si riscrive in un attimo, e "Esci senza salvare?" su una
  pagina senza Salva confonderebbe
- **Storico peso**: arriverà con Statistiche, non qui

Nell'elenco, la riga Peso mostra l'ultima pesata come la scheda
dell'account ("85 kg", "78,4 kg") o "Da registrare" (`testoRigaPeso`).

**La regola della pesata** (`registraPesoSenzaDuplicati`, decisa il 3/10):
- **stesso giorno** → la pesata nuova sostituisce quella del giorno (con lo
  stesso valore non scrive niente): al massimo una pesata al giorno;
- **giorno diverso** → si scrive **sempre**, anche se il valore è uguale
  all'ultima pesata: "oggi peso come ieri" è un dato, serve allo storico e
  al grafico del peso.

Fino al 3/10 un valore uguale all'ultima pesata, in un giorno nuovo, non si
scriveva, mentre il messaggio diceva "Registrato … oggi": un bug. Veniva dal
6/9, quando il peso partiva con ogni "Salva obiettivo" anche se non era
stato toccato; con "Registra peso", un gesto esplicito, quel motivo non c'è
più. La pesata del giorno si cerca rileggendo Dexie dentro la funzione, non
da uno stato React che può essere indietro (stessa regola di
`salvaProfilo`). Test in `src/lib/repository/misurazioni.test.ts`.

### Onboarding (dal 17/10, branch `onboarding`)

**Stato al 17/10: costruito tutto, da provare su iPhone.** La parte senza
interfaccia (logica pura, segno nei metadati, chiave locale, ripresa,
attesa della discesa), la pagina `/onboarding` con i cinque passi e la
fine, il segno `da_fare` alla registrazione, il caricamento completo di
`/onboarding` dopo "Crea account", la guardia nel layout e la scheda di
Oggi. In questa sottosezione "fatto"
vuol dire costruito e coperto dai test, **non provato**: le prove su
iPhone sono in sezione 11, "Prove su iPhone dell'onboarding". Mockup in
`docs/mockups/onboarding.html`: vale lo **stile B, "Di benvenuto"**; lo
stile A resta nel file solo per confronto. Colori, font e testi del
mockup valgono, la logica JS dentro è solo una simulazione. Dove il
mockup e questo documento non coincidono vale il documento: per esempio
il mockup mostra l'obiettivo del passo 4 già scelto ("Mantenere"),
mentre qui parte senza scelta.

**Il problema.** Fino al 17/10 chi si registrava finiva su Oggi con un
diario vuoto e senza obiettivi. L'onboarding è una sequenza guidata di 5
passi a tutto schermo, subito dopo "Crea account", che porta a Oggi con
profilo, prima pesata e obiettivi già impostati.

**Chi lo vede: il segno nei metadati dell'account** (fatto il 17/10:
lettura e scrittura in `src/lib/onboarding/segnoOnboarding.ts`, `da_fare`
in `registrati`, `src/lib/actions/auth.ts`). Un campo
`onboarding` nei metadati di Supabase Auth (`raw_user_meta_data`, come
`nome` e `username`; nessuna migration). Il trigger di registrazione lo
lascia passare: toglie solo `codice_invito` e riscrive `username`
(sezione 9.1). I valori:
- **assente**: gli utenti registrati prima dell'onboarding. Non vedono
  mai né l'onboarding né la scheda di Oggi, anche senza obiettivi;
- **`da_fare`**: lo scrive `registrati` in `signUp`. L'onboarding si
  apre, e si riapre se l'app viene chiusa a metà;
- **`rimandato`**: dopo "Lo faccio dopo". L'onboarding non si apre più
  da solo; in Oggi c'è la scheda "Completa il tuo profilo";
- **`fatto`**: dopo "Inizia a usare Libra". Niente onboarding, niente
  scheda.

Il segno **non** si deduce dai dati mancanti: un utente di prima, su un
telefono nuovo, ha Dexie vuoto finché la discesa non arriva, e
sembrerebbe nuovo.

Il segno si legge **anche offline**, dalla sessione salvata nel cookie
(`leggiSessioneSalvata` in `src/lib/supabase/utenteOffline.ts`, la
stessa strada del nome). Si cambia con `updateUser({ data: { onboarding
} })`: Supabase unisce la chiave agli altri metadati, e supabase-js
aggiorna subito la sessione nel cookie (`session.user`). Il token JWT
porta il valore vecchio fino al rinnovo, ma nessuno lo legge: il
middleware usa `getUser()`, che chiede al server, e il client legge
`session.user`. Nel codice: `segnoDellaSessione` legge il cookie (nessuna
chiamata di rete), `segnoDaiMetadati` (statoOnboarding.ts) lo interpreta,
e un valore sconosciuto vale assente; nelle pagine i metadati arrivano da
`useMetadatiUtente` (`src/lib/supabase/useUtente.ts`, la stessa strada di
`useNomeUtente`), che distingue "non ancora letti" da "non ci sono".

**La chiave locale, che vince offline** (fatta il 17/10). `updateUser`
senza rete fallisce. Per questo l'esito ("fatto" o "rimandato") si scrive
anche in `localStorage`, nella chiave `nutritrack:onboarding:<user_id>`
(una per utente), e **la chiave locale vince sui metadati**. Ogni lettura
e scrittura sta in un try/catch: senza `localStorage` l'app funziona lo
stesso, e l'esito arriva solo se il server risponde subito.
- **`concludiOnboarding(userId, esito)`**: prima la chiave, poi
  `updateUser`. Riuscito → la chiave si toglie; non riuscito (rete,
  sessione) → resta. Non lancia mai. Se la sessione è di un altro utente
  non manda niente, per non mettere il segno sull'account sbagliato.
- **La ripresa** (`RipresaSegnoOnboarding` nel layout radice, accanto a
  `RipresaUscita`) applica `decidiRipresa` all'avvio, al ritorno della
  rete e a ogni avviso dei giri di sincronizzazione: così vede la prima
  discesa riuscita e l'utente nuovo dopo un accesso. Ogni ripresa sa da
  cosa parte (il motivo: `"avvio"`, `"online"` o `"giro"`). Al massimo
  una chiamata a `updateUser` alla volta (`ripreseInCorso`: chi arriva
  mentre una è in corso riceve quella), e **dopo un invio fallito i giri
  non ritentano**: un invio fallito resta ricordato in memoria per
  quell'utente (`invioFallito`), e una ripresa con motivo `"giro"` si
  ferma prima di chiamare `updateUser`. Ritentano solo il prossimo avvio
  e il ritorno della rete (evento `online`); un invio riuscito toglie il
  ricordo. Altrimenti con la sessione scaduta ogni giro rifarebbe una
  chiamata destinata a fallire. Utente e segno li
  legge dal cookie, non con `getUser`: **per un utente senza segno non
  parte nessuna chiamata di rete** (con un test). Le regole di
  `decidiRipresa`: senza segno nei metadati mai niente; chiave uguale ai
  metadati → si toglie; chiave `rimandato` con i metadati `fatto` → si
  toglie senza mandarla ("fatto" è la fine, e "rimandato" riaccenderebbe
  la scheda); chiave diversa → si manda; senza chiave, la rete di
  sicurezza qui sotto.
- **Esci** prova una volta a mandare l'esito in sospeso, prima di
  `signOut` (`updateUser` vuole la sessione), come fa già con la coda
  delle modifiche (sezione 9.6, "Esci svuota i dati locali"). Se non
  riesce l'uscita va avanti, e **la chiave sopravvive a Esci**: Esci
  toglie solo le sue chiavi (l'ora dell'ultimo contatto, il segno del
  reset password, le novità di Amici), e la manda la ripresa al
  prossimo accesso. **Elimina account** la toglie.

**La rete di sicurezza: c'è già un obiettivo → fatto** (fatta il 17/10).
Un obiettivo vivo vale "fatto" qualunque sia il segno, e la ripresa manda
`updateUser` per allinearlo. Copre l'onboarding finito offline su un
dispositivo e riaperto su un altro, dove la chiave locale non c'è. Gli
obiettivi contano solo con i dati noti (discesa riuscita o righe in
Dexie, sotto): un telefono nuovo con Dexie vuoto non conclude niente.

**I 5 passi** (testi dello stile B; fatti il 17/10, componenti
`PassoBenvenuto`, `PassoSuDiTe`, `PassoPeso`, `PassoObiettivo` con
`SchedeObiettivo`, `PassoTargetGiornalieri`). In alto, dal
passo 2, la barra (`BarraOnboarding`): il pulsante tondo Indietro, i
puntini di avanzamento (per gli screen reader "Passo N di 5") e "Dopo"
(= "Lo faccio dopo"). Il puntino del passo attuale si allunga con
`transform`, non animando la larghezza, e senza animazione con "riduci
movimento". In fondo il pulsante a pillola (`StrutturaPasso`), spento
finché il passo non è completo. Indietro torna al passo prima, dal 2 al
Benvenuto, e i valori scritti restano, anche quelli dei passi già
salvati: stanno nella pagina, non nei componenti dei passi.

1. **Benvenuto**: l'icona, "Ciao <nome>." e "Ti do il benvenuto su
   Libra. Quattro domande veloci e ti propongo quante calorie, grassi,
   carboidrati e proteine puntare ogni giorno." Pulsante "Iniziamo".
   Qui niente "Dopo" e niente Indietro. Il nome viene dai metadati
   (`useNomeUtente`), c'è già quando la pagina si carica dopo "Crea
   account".
   Finché il nome non è letto, o se manca, il titolo è "Ciao!": mai
   "Ciao ."
2. **"Parlami un po' di te"** ("Servono solo per il calcolo."): sesso a
   tessere (Uomo / Donna / Non indicato), data di nascita, altezza in
   cm, "Quanto ti muovi" (il livello di attività). Stessi campi, valori
   ed etichette di Impostazioni > Profilo. **Il sesso parte senza
   scelta**: Avanti resta spento finché non se ne tocca uno, anche "Non
   indicato"
3. **"Quanto pesi oggi?"** ("Sarà la tua prima pesata."): un campo
   grande in kg, con la virgola. Nota: "Ne puoi registrare una al giorno
   in Impostazioni > Peso."
4. **"Cosa vuoi ottenere?"**: Dimagrire ("Circa 500 kcal sotto il tuo
   fabbisogno"), Mantenere ("Quanto consumi in una giornata normale"),
   Massa ("Circa 300 kcal sopra il tuo fabbisogno"), più "Peso obiettivo
   (facoltativo)" in kg. **L'obiettivo parte senza scelta**, come il
   sesso: Avanti resta spento finché non se ne tocca uno (deciso da
   Davide il 17/10; il mockup lo mostra già scelto, vale il documento)
5. **"Ecco la tua proposta"** (oppure "I tuoi obiettivi" se i numeri sono
   cambiati o la proposta non c'è): le kcal in grande ("kcal al
   giorno"), sotto Grassi, Carboidrati, Proteine in g. Sotto il titolo:
   "Calcolato dai tuoi dati. Tocca un numero per cambiarlo.", e dopo una
   modifica "Hai cambiato la proposta. Torna alla proposta". Il link
   **"Ho già i miei valori"** svuota i quattro campi. Nota: "Giorni di
   allenamento, pasti e orari e colore dell'app li trovi in
   Impostazioni." Pulsante **"Inizia a usare Libra"** → Oggi

**La tastiera di iPhone.** La pagina è alta quanto la parte visibile dello
schermo (`useAreaVisibile`, come `/aggiungi`), e il pulsante è l'ultimo
elemento della colonna: con la tastiera aperta resta appena sopra la
tastiera. Non `data-nascondi-mentre-scrivi`, che nasconde le barre mentre
si scrive: qui il pulsante è l'azione del passo, e si scrive il peso e
si tocca Avanti senza chiudere la tastiera.

**Avanti spento finché il passo non è completo.**
- Passo 2: un sesso scelto, la data di nascita, l'altezza (maggiore di 0
  e al massimo 280 cm, come in Profilo: `validaModulo`), il livello di
  attività (`suDiTeCompleto`);
- passo 3: un peso maggiore di 0 e al massimo 500 kg (lo stesso
  controllo di "Registra peso": `leggiPesoKg`);
- passo 4: un obiettivo toccato (si parte senza scelta); il peso
  obiettivo vuoto, oppure valido come una pesata (`leggiPesoKg`: maggiore
  di 0 e al massimo 500 kg; `obiettivoCompleto`);
- passo 5: **tutti e 4 i numeri**, zero o più, come in Obiettivi
  (`validaModulo`). Non basta il numero delle kcal.

**Il salvataggio**, con le funzioni che usano già Profilo, Peso e
Obiettivi, senza duplicare la loro logica (fatto il 17/10, in
`src/lib/onboarding/passiOnboarding.ts`; un salvataggio non riuscito
lascia sul passo con "Salvataggio non riuscito. Riprova." e non conclude
niente):
- **passo 2**, quando si preme Avanti: `salvaProfilo` con la sola
  sezione "Dati personali" (`src/lib/profilo/salvataggioProfilo.ts`),
  che rilegge Dexie e decide da sola se creare o aggiornare il profilo;
- **passo 3**, quando si preme Avanti: `registraPesoSenzaDuplicati`
  (sezione "Peso" sopra). Tornare indietro e cambiare il valore aggiorna
  la pesata del giorno, non ne aggiunge una;
- **passi 4 e 5 insieme**, con "Inizia a usare Libra" (correzione
  dell'analisi del 17/10). Il passo 4 non si può salvare da solo: su
  `obiettivi` le colonne kcal e macro sono `NOT NULL`, e obiettivo e
  target sono la stessa sezione di `salvaProfilo`. Avanti al passo 4
  tiene la scelta solo in memoria; chi esce prima del passo 5 la perde,
  e "Continua" riparte dal passo 4 (deciso da Davide il 17/10).
  `salvaProfilo` crea il primo periodo con `valido_dal` = oggi, senza la
  domanda "cambio vero o correzione?": il primo periodo vale "da
  sempre" per la regola di lettura di `obiettivoValidoPer` (sezione 4,
  "obiettivi"). Il peso obiettivo va in `obiettivi.peso_obiettivo`.
  Riuscito il salvataggio: `concludiOnboarding(userId, "fatto")`, poi
  Oggi. Mentre salva il pulsante dice "Salvataggio…" ed è spento. Il
  periodo visto è sempre "nessuno" (`salvaObiettivo`), perché
  l'onboarding esiste solo senza obiettivi: se nel frattempo ne è
  arrivato uno da un altro dispositivo, `salvaProfilo` risponde "periodo
  cambiato" e non scrive niente. Allora la pagina dice "I tuoi obiettivi
  sono già stati impostati da un altro dispositivo.", mette il segno
  "fatto" e mostra il pulsante "Vai a Oggi". **Niente passaggio a tempo**
  (scelta del 17/10): toglierebbe lo schermo a chi sta ancora leggendo, o
  usa uno screen reader, e qui non c'è fretta, l'onboarding è già
  concluso.

"Lo faccio dopo" non salva il passo a metà: restano salvati solo i passi
già confermati con Avanti.

**Prima di decidere il passo e di scrivere, si aspetta la discesa**
(correzione dell'analisi del 17/10; fatto il 17/10, il segno e la pagina
che aspetta). Su un dispositivo con
Dexie vuoto (Chrome sul PC dopo Safari, un telefono nuovo) il passo 2
creerebbe un secondo profilo con un id nuovo, e la sincronizzazione lo
rifiuterebbe: `profili` ha `UNIQUE(user_id)` su Supabase. In più
l'onboarding ripartirebbe dal passo 2 anche con un profilo già salvato.
Regola: il passo si decide, e i pulsanti che scrivono si accendono, solo
dopo **una discesa riuscita in questa sessione dell'app**, oppure se in
Dexie ci sono già righe dell'utente. Fino ad allora la pagina dice
"Caricamento..."; offline su un dispositivo vuoto, "Per continuare serve
la connessione: prima devono arrivare i tuoi dati su questo
dispositivo.", come il seed dei pasti al primo avvio che ha bisogno
della rete (sezione 9.2).

Il cursore della discesa non basta, perché si scrive solo se arrivano
righe. Per questo c'è un segno in memoria, `discesaRiuscitaPer(userId)` in
`src/lib/sync/statoSincronizzazione.ts` (hook `useDiscesaRiuscita`):
`scaricaTutto` lo accende quando `profili`, `misurazioni` e `obiettivi`
scendono tutte e tre nello stesso giro, anche senza righe. Resta acceso
anche se un giro dopo fallisce, vale per un utente solo, e lo spegne
`azzeraStatoGiri` (Esci, Elimina account), così chi rientra aspetta di
nuovo la sua discesa. Ricaricare la pagina lo azzera, ed è voluto. Le
**righe dell'utente in Dexie** sono quelle vive delle stesse tre tabelle
(`righeOnboardingInDexie`): righe di altre tabelle non dicono niente su
queste, per esempio i pasti predefiniti si creano su un dispositivo nuovo
anche prima che i profili scendano.

Tutti gli ingressi insieme li dà l'hook `useStatoOnboarding`
(`src/lib/onboarding/useStatoOnboarding.ts`): metadati, chiave locale,
obiettivi e righe da Dexie, discesa riuscita, passati a `statoSegno`.
Restituisce "non ancora noto" finché utente, metadati e Dexie non hanno
risposto. Due forme: `useStatoOnboarding()`, che prende utente e
metadati da supabase-js (`useUtenteId` fa una chiamata `getUser` a ogni
montaggio: va bene nella pagina `/onboarding`), e il cuore
`useStatoOnboardingPer(userId, segno)`, con utente e segno già letti da
chi chiama: la guardia e la scheda di Oggi lo usano con quelli del
cookie, senza rete.

**Il primo passo da fare** (`primoPassoDaFare` in
`src/lib/onboarding/statoOnboarding.ts`, logica pura con test, fatta il
17/10), dai dati in Dexie:
- un obiettivo vivo → **finito**, qualunque cosa manchi;
- profilo assente, oppure data di nascita, altezza o livello di attività
  vuoti → **passo 2**. Il sesso non si controlla: "non indicato" è sia il
  valore iniziale della colonna sia una risposta valida;
- nessuna pesata viva → **passo 3**;
- altrimenti → **passo 4** (il passo 5 segue sempre il 4).

Dalla stessa regola escono le etichette di "cosa manca" nella scheda di
Oggi: "Su di te", "Il tuo peso", "Il tuo obiettivo", "Obiettivi
giornalieri" (gli ultimi due sempre insieme).

**Da dove si riparte** (fatto il 17/10: la regola `passoDiPartenza` e la
pagina). Chi riapre l'app con il segno `da_fare` torna all'onboarding: dal
**Benvenuto solo se non è salvato niente** (nessun profilo, nessuna
pesata, nessun obiettivo), altrimenti dal primo passo da fare. Il passo di
partenza si decide **una volta**, quando i dati sono noti; poi si muove
solo con Avanti e Indietro. Ricalcolato a ogni cambio di Dexie, salvare il
passo 2 farebbe saltare la pagina da sola. I campi partono dai dati
salvati: il passo 2 dal profilo (sesso compreso) se c'è, altrimenti vuoto
e senza sesso scelto; il passo 3 dalla pesata di oggi, se c'è.

**Chi entra nella pagina** (fatto il 17/10, `useStatoOnboarding`):
- non ancora noto, o in attesa della discesa con la rete →
  "Caricamento...";
- in attesa della discesa senza rete → "Per continuare serve la
  connessione: prima devono arrivare i tuoi dati su questo dispositivo."
  Riparte da sola: al ritorno della rete parte la discesa;
- `da_fare` → dal passo di ripresa;
- `rimandato` → solo con `?continua=1` (il "Continua" della scheda), dal
  primo passo da fare;
- senza segno, `fatto`, o `rimandato` senza `?continua=1` → Oggi, con
  `router.replace`; e così pure se, ai dati noti, risulta già un obiettivo
  (`passoDiPartenza` dice "finito").

Dentro, la pagina non segue più i cambi del segno: "Dopo" e la fine
portano fuori da sé.

**Costo e rete.** Per un utente senza segno l'onboarding non aggiunge
nessuna chiamata di rete e nessuna lettura di Dexie. Ripresa, guardia e
scheda leggono utente e segno dal cookie della sessione e dalla chiave
locale (`utenteConSegno("da_fare" | "rimandato")` in
`segnoOnboarding.ts`, mai `getUser`), e solo con il loro segno leggono
Dexie (le tre tabelle piccole: profili, misurazioni, obiettivi; mai le
voci del diario). Lo verificano tre test con una spia sul client
Supabase o sulle letture: quello della ripresa, quello d'integrazione
della guardia, quello della scheda in Oggi. Solo la pagina `/onboarding`
usa `useStatoOnboarding()`, con la sua chiamata `getUser`.

**"Lo faccio dopo" e la scheda in Oggi** (fatti il 17/10: "Dopo" nella
barra, `SchedaCompletaProfilo` in Oggi). "Dopo", dal passo 2
al 5, chiude l'onboarding, mette il segno `rimandato` e porta a Oggi. La
scheda **"Completa il tuo profilo"** ("Senza obiettivi non posso dirti
quante calorie ti restano oggi.", le etichette di ciò che manca, il
pulsante "Continua") si mostra **solo con il segno `rimandato` e 0
obiettivi** (deciso da Davide il 17/10). Gli utenti senza segno non la
vedono mai, anche senza obiettivi, e così non c'è nessun lampo per chi
gli obiettivi li ha ma sta ancora aspettando la discesa. Sta **in cima
alla lista dei pasti** e scorre con la lista: Oggi è alta esattamente lo
schermo, e una scheda fissa sotto la testata toglierebbe spazio alla
lista. "Continua" riapre l'onboarding **sempre dal primo passo da fare,
mai dal Benvenuto** (`/onboarding?continua=1`).

Come è fatta: un riquadro `--superficie` con il bordo `--linea` e lo
stesso raggio di "Serve la connessione", l'altra scheda di Oggi, e come
lei senza ombra; il titolo in `font-display`; le etichette di `cosaManca`
in piccole capsule `--capsula-attiva` con il testo `--testo-capsula`; il
pulsante "Continua" pieno, della stessa forma di "Riprova". Compare su
ogni giorno mostrato, perché riguarda il profilo e non il giorno; la
riga "Nessun obiettivo impostato" della testata resta. Sparisce da sola
appena c'è un obiettivo (Dexie cambia), e poi la ripresa manda "fatto".
Costo come la guardia: utente e segno dal cookie e dalla chiave locale
(`utenteConSegno("rimandato")`), nessuna chiamata di rete, e Dexie letto
solo con il segno effettivo `rimandato`.

I gesti di Oggi non la toccano. Non ha `data-tieni-premuto`, quindi non
apre il menu; non ha `data-pasto-id`, quindi non è un bersaglio del
trascinamento, e rilasciare sopra di lei non fa niente; scorre con la
lista anche durante lo scorrimento automatico. Lo swipe del giorno parte
anche da lei, come da tutto il pannello, e blocca da sé il tocco su
"Continua" che segue uno swipe. Resta visibile anche durante il
trascinamento: occupa la cima della lista, quindi con la scheda a volte
bisogna scorrere un po' per vedere il primo pasto, accettato perché c'è
solo per chi ha rimandato.

**Dove sta la pagina e perché la guardia è nel client** (pagina, service
worker, redirect dopo la registrazione e guardia fatti il 17/10).
`/onboarding` (`src/app/onboarding/page.tsx`) sta fuori dal
gruppo `(app)`, come `/aggiungi`: niente tab bar e niente guardiano delle
modifiche. È in `PAGINE_APP` del service worker, per riaprirsi anche
offline. Chi ha il segno `da_fare` ci arriva:
- subito dopo "Crea account": la Server Action `registrati`, dopo
  `impostaUsername`, risponde "registrato" (non più `redirect("/")`), e
  la pagina Registrati fa un **caricamento completo** di `/onboarding`
  (`caricaPaginaDaCapo` in `src/lib/caricamentoCompleto.ts`, con
  `window.location.replace`: "indietro" non torna a `/register`). Solo
  con la sessione: con la conferma email accesa resta il messaggio
  "Account creato: controlla la tua email…", e all'onboarding porta la
  guardia al primo accesso;
- negli altri casi, da una **guardia nel client** (`GuardiaOnboarding`
  in `src/app/(app)/layout.tsx`), che non disegna niente e non blocca la
  pagina. Legge utente e segno dal cookie della sessione e dalla chiave
  locale (`utenteConSegno("da_fare")`), senza nessuna chiamata di rete.
  Solo se il segno effettivo (`segnoEffettivo`: la chiave locale, se c'è,
  altrimenti i metadati) è `da_fare` legge Dexie (profili, misurazioni,
  obiettivi) per la rete di sicurezza; per tutti gli altri non legge
  niente, perché solo con `da_fare` `statoSegno` può dire "mostra
  l'onboarding". Con `mostraOnboarding` fa `router.replace("/onboarding")`,
  una volta sola per montaggio. La decisione è quella di `statoSegno`,
  la stessa della pagina: la guardia manda lì solo chi la pagina fa
  entrare, quindi nessun giro fra "/" e "/onboarding". Appena finito
  l'onboarding (chiave locale "fatto", metadati ancora `da_fare`) non
  riporta indietro; con `da_fare` e i dati non ancora noti porta alla
  pagina, che aspetta la discesa.

**Perché un caricamento completo e non `redirect()`** (bug trovato nelle
prove su iPhone del 17/10, account A e B: dopo "Crea account"
`/onboarding` restava su "Caricamento...", e con un refresh funzionava
tutto). La sessione nasce sul server, nella Server Action, e arriva al
browser solo nei cookie. `redirect()` di una Server Action è una
navigazione interna di Next.js: il layout radice resta montato. I suoi
componenti (`Sincronizzazione`, `RegistraServiceWorker` e le riprese) si
erano montati su `/register` senza utente, e il client Supabase del
browser non manda nessun evento quando una sessione compare nei cookie
dall'esterno: emette `SIGNED_IN` solo per un accesso fatto nel browser
(`signInWithPassword`, come il login, che infatti funzionava). Chi chiede
la sessione dopo la trova, perché il client rilegge il cookie a ogni
chiamata, ma chi era già montato resta "senza utente". Così la
sincronizzazione non partiva, la discesa non riusciva mai, e la pagina
aspettava per sempre. Verificato leggendo `@supabase/auth-js` e con un
test temporaneo, poi cancellato. Con il caricamento completo tutto si
rimonta e nasce già con la sessione.

Il problema c'era anche prima del branch, quando la registrazione portava
a Oggi, ma non si vedeva. Oggi crea i pasti predefiniti da sé
(`usePastiIniziali`, che non passa dalla sincronizzazione), quindi
"Preparo i tuoi pasti…" finiva lo stesso. Mancava solo la
sincronizzazione della prima sessione: le modifiche restavano nella coda
di Dexie e partivano alla riapertura successiva dell'app. Nessun dato
perso, e nessun segno visibile.

**Non dal middleware** (correzione dell'analisi del 17/10). Offline la
richiesta non arriva al server: risponde il service worker con la copia
salvata di "/", e il middleware non gira. In più, quando il service
worker scarica le pagine per l'uso offline, un redirect non si salva,
quindi Oggi resterebbe senza copia per tutto l'onboarding. Infine il
middleware leggerebbe il segno del server e ignorerebbe la chiave
locale: tornata la rete, rimanderebbe all'onboarding chi l'ha finito
offline. Il prezzo della guardia nel client: alla ripresa Oggi compare
per un istante prima del redirect; dopo "Crea account" no.

**Sesso "Non indicato" al passo 5.** Mifflin-St Jeor richiede il sesso
(sezione "Il calcolo del fabbisogno"): niente proposta, i quattro campi
partono vuoti, niente "Ho già i miei valori", e sotto il titolo "Con il
sesso non indicato non posso calcolare una proposta: scrivi i tuoi
valori, per esempio quelli del nutrizionista." I controlli sono gli
stessi di "Calcola proposta" in Obiettivi, in una funzione pura condivisa
(`propostaObiettivi` in `src/lib/profilo/propostaObiettivi.ts`, fatta il
17/10, con test). Gli altri motivi senza proposta non dovrebbero capitare
(`primoPassoDaFare` garantisce profilo e pesata), ma per sicurezza hanno
il loro testo: "Non ho tutti i dati per una proposta: scrivi i tuoi
valori.", con i campi vuoti.

**La proposta al passo 5** (fatta il 17/10): dal profilo e dall'ultima
pesata salvati, letti da Dexie, e dall'obiettivo del passo 4. Finché
l'utente non tocca i numeri, li segue: tornando al 4 e cambiando
obiettivo si ricalcola. Dopo una modifica a mano restano i suoi. "Torna
alla proposta" rimette i numeri calcolati; "Ho già i miei valori" svuota
i quattro campi e mette il fuoco sulle calorie. Le righe sotto gli
obiettivi del passo 4 ("Circa 500 kcal sotto il tuo fabbisogno") prendono
i numeri da `AGGIUSTAMENTO_KCAL_OBIETTIVO` in `src/lib/fabbisogno.ts`:
cambiando lì un numero, cambia anche il testo.

**Grafica.** Stile B del mockup, con le variabili di `globals.css`,
nessun colore scritto a mano (sezione 7). L'icona del Benvenuto è
`public/icons/icon-512.png`: è la bilancia del mockup, uguale nei due
temi, ed è già salvata dal service worker, quindi si vede anche offline.
Niente SVG nuovo e niente token `--icona-*`. La capsula (tessera scelta,
etichette della scheda) usa `--capsula-attiva` con il testo
`--testo-capsula`, non l'accento puro: sulla capsula l'accento fa 4,2:1,
sotto il 4,5:1 richiesto per il testo (commento in `globals.css`). Le
classi comuni ai passi (domanda, sottotitolo, etichette, riquadro dei
campi) stanno in `src/lib/onboarding/classiOnboarding.ts`. I campi sono a
17 px (mai sotto i 16, o Safari ingrandisce la pagina), ognuno con la sua
etichetta, con il focus di `CLASSE_FOCUS`; la data di nascita, a tutta
larghezza, usa `.campo-data` (`campiData.test.ts`).

### Aspetto (dal 3/10, passi "tema" e "accento")

In Impostazioni > Aspetto (`/impostazioni/aspetto`), con "‹ Impostazioni".
Gruppo **Tema**: tre anteprime affiancate, Chiaro / Scuro / Sistema, come
nel mockup; "Sistema" è metà chiara e metà scura. La scelta si applica
**subito** al tocco: niente Salva e niente guardiano. Sotto, la nota:
"Con “Sistema” l’app segue la modalità chiara o scura dell’iPhone, anche
quando cambia da sola la sera." e "Nell’app aggiunta alla schermata Home,
la barra in alto con l’ora segue sempre la modalità dell’iPhone, non
questa scelta." Come funziona e i limiti: sezione 7, "Tema chiaro / scuro /
sistema".

Sotto, gruppo **Colore principale** (passo 6, mockup
`docs/mockups/colore-principale.html`): quattro pallini con il nome sotto,
Verde / Blu / Viola / Petrolio; quello scelto ha un anello del colore del
testo e il nome in grassetto. Anche questo si applica al tocco, senza
Salva. Nota: "Colora l'anello, i pulsanti e la voce attiva. L'arancio resta
per quando superi un obiettivo." Sta sotto il gruppo come le altre note di
Impostazioni (nel mockup era dentro il riquadro). La riga Aspetto
dell'elenco dice tema e colore: "Sistema · Verde".

Anteprime e pallini non hanno colori propri: sono pezzi di pagina con
`data-tema="chiaro"` / `"scuro"` (`SelettoreTema`) o
`data-accento="blu"`... (`SelettoreAccento`), e dentro di loro
`globals.css` ricalcola i token per quel tema o colore. Così le anteprime
del tema mostrano il colore principale in uso, e i pallini il colore vero
nel tema in uso. Sono veri radio button: da tastiera le frecce passano da
una scelta all'altra.

### Preferiti e pasti salvati (dall'11/10, branch `preferiti`)

In Impostazioni > Preferiti (`/impostazioni/preferiti`), con
"‹ Impostazioni"; il titolo della pagina è "Preferiti e pasti salvati".
Mockup approvato `docs/mockups/preferiti-e-pasti-salvati.html`, proposta A
"la stella sulla riga". Non sostituisce niente: la sezione Preferiti di
Aggiungi e la matita sui pasti salvati restano come sono. Qui si guarda e si
fa ordine; non si riordina a mano, non si cerca e non si crea un pasto da
zero.

- **Due gruppi**, ciascuno in ordine alfabetico come in Aggiungi e mostrato
  solo se ha qualcosa: **Alimenti preferiti** ("60 g · 225 kcal": l'ultima
  quantità usata, o la porzione) e **Pasti salvati** ("3 alimenti · 412
  kcal", freccia). Sotto ciascuno una nota grigia su come nascono: "Si
  aggiungono con la stella quando scegli un alimento in Aggiungi." e "Si
  salvano dal segnalibro di un pasto in Oggi." Senza né l'uno né l'altro,
  un riquadro "Ancora niente qui" con le stesse due spiegazioni.
- **Elenchi e conteggio dalle funzioni di Aggiungi**, mai dalle tabelle
  grezze: `alimentiPreferiti` e `pastiSalvati`. Un alimento uscito dal
  catalogo o un pasto senza alimenti validi non compaiono qui come non
  compaiono là (regola "Alimenti cancellati", sezione 4). Un alimento con
  due righe vive in `preferiti` (due dispositivi offline) compare e si
  conta una volta sola, anche in Aggiungi.
- **La riga in Impostazioni**: "12 alimenti · 3 pasti"; con un gruppo a
  zero solo l'altro ("4 alimenti", "3 pasti"); con tutti e due a zero
  "Nessuno" (`contaPreferiti` e `testoRigaPreferiti` in
  `src/lib/inserimento/rigaPreferiti.ts`, con test). Niente forma corta
  "12 · 3": l'etichetta "Preferiti" basta a far stare il valore intero.
- **Togliere un alimento: la stella sulla riga**, un tocco, senza conferma
  (area di tocco 44 px). La riga resta a schermo, sbiadita e con la stella
  vuota, finché si è sulla pagina, e la barra in basso dice "Tolto dai
  preferiti: Mela" con **Annulla**. Ritoccare la stella lo rimette. Uscendo
  dalla pagina la riga sparisce. Togliere e rimettere passano da
  `togliPreferito` e `rimettiPreferito` (`src/lib/repository/preferiti.ts`),
  che rileggono Dexie invece di fidarsi dell'elenco della pagina: con un
  Annulla toccato subito dopo la stella, l'elenco può essere ancora quello
  di prima, e l'Annulla toglierebbe di nuovo invece di rimettere.
  Rimettere fa tornare in vita **la stessa riga** (stesso id), mai una
  nuova: su Supabase il vincolo unico (user_id, alimento_id) vale anche per
  le righe cancellate (lo stesso bug già corretto in `togglePreferito`).
  Togliere toglie tutte le righe vive di quell'alimento.
- **Pasto salvato: il tocco sulla riga apre `ModificaPastoSalvato`**, la
  stessa schermata della matita in Aggiungi (sezione 3, "Modificare un
  pasto salvato"), che copre anche la tab bar. Si elimina da lì, con la
  conferma di sempre: niente Annulla.
- **Con un pasto aperto la pagina disegna solo la schermata di modifica**,
  non l'elenco sotto. Provato su iPhone l'11/10: con l'elenco nel
  documento, toccando un campo iOS faceva scorrere la pagina per mostrarlo,
  la schermata (`fixed`, agganciata alla parte visibile della finestra con
  `useAreaVisibile`) non seguiva, e sotto di lei, sopra la tastiera,
  compariva l'elenco. In /aggiungi non succedeva perché anche il `<main>`
  è `fixed` e il documento non ha niente da scorrere. Senza l'elenco il
  documento resta alto quanto la finestra, come in Aggiungi. La causa è
  dedotta dal codice, non misurata; la correzione è provata. Alla chiusura
  l'elenco torna dove era arrivato lo scorrimento; righe tolte e barra
  restano (sono stato della pagina, che non si smonta).
- Niente guardiano nella pagina, che non ha un modulo: lo chiama
  `ModificaPastoSalvato` quando ha modifiche (`useSegnalaModifiche`, che in
  /aggiungi non fa niente perché lì il guardiano non c'è).
- La pagina è in `PAGINE_APP` del service worker: si apre anche offline.

### Alimenti (dal 15/10, branch `catalogo-alimenti`, provata su iPhone il 15/10)

Gestione del catalogo personale, in Impostazioni > Alimenti
(`/impostazioni/alimenti`), con "‹ Impostazioni". Mockup approvato da
Davide il 12/10: `docs/mockups/catalogo-alimenti.html`. Analisi e
decisioni del 15/10. Non sostituisce niente: in Aggiungi ricerca, matita e
"Crea alimento manualmente" restano come sono. Qui si guarda tutto il
catalogo, si corregge e si fa pulizia.

- **Quali alimenti**: solo quelli modificabili, cioè dell'utente
  (`user_id` = me), vivi e non verificati: la stessa condizione della
  matita in Aggiungi (sezione 10.8). Un tocco apre sempre "Modifica", mai
  una riga che non si può toccare. Il catalogo comune (`user_id` null,
  oggi vuoto) non compare: si trova dalla ricerca in Aggiungi, e non è
  modificabile (anche per RLS).
- **Ricerca per nome**, con le stesse regole di `cercaPerNome`
  (maiuscole e accenti indifferenti; `filtraPerNome`, che a ricerca vuota
  restituisce tutto), e **ordinamento**: Più usati (predefinito, a ogni
  visita) / A → Z / Z → A / Meno usati. Sotto la ricerca, a sinistra il
  numero di alimenti mostrati ("14 alimenti"), a destra l'ordine scelto.
  L'ordine è un `<select>` nativo, non il menu disegnato del mockup: sul
  telefono apre il selettore di sistema, come il titolo del pasto in
  Aggiungi. Senza risultati: "Nessun alimento trovato. Prova un altro
  termine di ricerca."
- **La riga**: il nome, con la marca se c'è ("Pane · Mulino",
  `etichettaAlimento`), e sotto "165 kcal / 100 g".
- **Catalogo vuoto**: niente ricerca né ordine, un riquadro "Ancora nessun
  alimento" — "Crea il primo con il + qui sotto, oppure da Aggiungi quando
  la ricerca non trova quello che cerchi."
- **"Più usati" conta le voci di diario vive** dell'utente con
  quell'`alimento_id`. Le righe dei pasti salvati (`composizioni_voci`) non
  contano: un pasto salvato è uno stampo, non un uso, e quando lo si
  inserisce crea comunque voci di diario, già contate. A parità di usi,
  ordine per nome A → Z; "Meno usati" mette in cima gli alimenti mai
  usati. **Il numero di usi non si mostra nella riga**, serve solo per
  ordinare. Calcolato in locale da Dexie in un passaggio solo, nessun
  indice nuovo. Funzioni pure con test permanenti (sezione 10.5).
- **Tocco su un alimento → "Modifica alimento"** a pagina intera, lo stesso
  `CreaAlimentoForm` di Aggiungi. **Il "+"** (sopra la tab bar) apre lo
  stesso form come "Nuovo alimento", senza Elimina. Il form è uno stato
  della pagina, **non una rotta con l'id**: una rotta
  `/impostazioni/alimenti/[id]` non può stare in `PAGINE_APP`, quindi
  offline non si aprirebbe. Il "‹" in alto, con il form aperto, chiude il
  form e torna all'elenco. Il form copre anche la tab bar, e mentre è
  aperto l'elenco non si disegna (lo stesso rimedio di Preferiti al
  problema di scorrimento di iOS dell'11/10). In alto "‹ Alimenti", nel
  form "Torna al catalogo" e, per un alimento nuovo, "Salva". Dopo la
  creazione la barra dice "Creato: Mela": con "Più usati" un alimento
  nuovo finisce in fondo all'elenco, e senza la barra non si vedrebbe che
  è stato salvato. Dopo una modifica nessuna barra, come in Aggiungi.
- **Il "+"** è tondo, a destra, alla stessa altezza di "+ Aggiungi" in
  Oggi (sopra la tab bar, con la stessa sfumatura dietro), e come la tab
  bar si nasconde mentre un campo ha il fuoco. La barra con Annulla sta
  appena sopra il "+", senza coprirlo, come in Oggi.
- **Una regola sola per "modificabile"**: `eModificabile` in
  `src/lib/catalogo/alimentiModificabili.ts`, usata anche dalla matita di
  Aggiungi (prima scritta due volte lì). Le frasi della barra dopo
  l'Annulla (`messaggioDopoRipristino`, `testoRipristinoNonRiuscito`) sono
  in `testiAlimentiCancellati.ts`, le stesse in Aggiungi e qui.
- **Frase sotto i valori, in modifica** (in Aggiungi e qui, non in "Nuovo
  alimento"): "Le modifiche valgono da ora e nei pasti salvati. Il diario
  già registrato non cambia." È la regola già in vigore: il diario copia i
  valori al momento dell'inserimento, i pasti salvati li leggono dal
  catalogo (sezione 4, "Alimenti cancellati", strada C scartata).
- **Eliminare un alimento, dal form**: la conferma nella riga del form
  ("No / Sì, elimina"), come in Aggiungi, poi la barra con Annulla
  (`BarraAnnulla`). Niente sheet: lo stesso componente si comporta allo
  stesso modo nei due posti.
- **Tieni premuto 450 ms → selezione multipla**, con lo stesso gesto di Oggi
  (`useTieniPremuto`, soglie in `decisioneTieniPremuto.ts`) ma senza
  trascinamento né menu: il sollevamento entra in selezione con quella
  riga spuntata. In selezione un tocco spunta o toglie la spunta, invece di
  aprire "Modifica". La **barra di selezione copre la tab bar**: "N
  selezionati", Elimina, Annulla (che esce dalla selezione).
  **L'icona condividi** (la scatola con la freccia in su, tonda, nel
  colore principale) la aggiunge il branch `condivisione-alimenti`,
  prima di Elimina: "N selezionati", Condividi, Elimina, Annulla. Apre lo
  sheet "Condividi con" (vedi "Amici" più sotto, "Condividere un
  alimento"). Lo stesso branch mette in cima alla pagina la riga "N
  alimenti in arrivo" con il suo foglio (decisione del 16/10, mockup
  `docs/mockups/alimenti-in-arrivo.html`, proposta B). Come è fatta (dal 15/10):
  - si entra da tutti e due i rami del gesto: dito fermo (il "menu" di
    Oggi, 450 + 160 ms) e dito che si muove dopo il sollevamento (il
    "trascina" di Oggi), perché qui non c'è niente da trascinare. Anche il
    tasto destro (`contextmenu`) seleziona. In selezione, tenere premuto
    un'altra riga la aggiunge;
  - togliendo l'ultima spunta si esce dalla selezione, come nel mockup;
  - il click che il browser manda dopo il gesto non apre "Modifica" né
    toglie la spunta appena messa: lo blocca l'hook, come in Oggi (un
    click solo, entro 400 ms);
  - la barra ha la forma e la posizione della pillola della tab bar, con
    fondo pieno (`bg-surface`, non `vetro`, che lascerebbe vedere la
    pillola sotto); come la pillola si nasconde mentre un campo ha il
    fuoco. Elimina è un pulsante tondo arancio (`warning`), non rosso:
    `--pericolo` è solo per ciò che non si può annullare (sezione 7);
  - in selezione il "+" e il suggerimento spariscono. Il suggerimento
    "Tieni premuto su un alimento per selezionarne più di uno insieme."
    sta sopra l'elenco fuori dalla selezione, con almeno due alimenti,
    in grigio (`text-muted`): non c'è un token per il fondo tenue del
    mockup, e i colori sono controllati dal test dei contrasti;
  - la ricerca resta usabile in selezione e non toglie le spunte: lo
    sheet dice comunque quanti alimenti si eliminano;
  - `useTieniPremuto` è generico: chi lo usa dichiara i `tipi` di riga
    (Oggi `voce` e `pasto`, qui `alimento`), e una riga di un tipo non
    dichiarato non partecipa (test in `tieniPremuto.test.tsx`).
- **Eliminare più alimenti**: `SheetConferma` "Eliminare N alimenti? Il
  diario non cambia." (con uno solo selezionato: "Eliminare «Mela»?"). Solo
  se serve, una seconda frase: "Verranno tolti anche da X pasti salvati e
  Y preferiti." con singolare e plurale giusti ("Verrà tolto" con un
  alimento solo; "1 pasto salvato", "1 preferito"; se una delle due parti
  è a zero, solo l'altra). X = pasti salvati visibili che contengono
  almeno uno degli alimenti; Y = alimenti selezionati che sono fra i
  preferiti (`conseguenzeEliminazione` e `testiConfermaEliminazione` in
  `src/lib/catalogo/confermaEliminazione.ts`, con test). Pulsanti
  "Annulla" / "Elimina". Poi la barra con Annulla: "Eliminati: 3
  alimenti" (con uno solo "Eliminato: Mela"), e dopo l'Annulla
  "Ripristinati: 3 alimenti".
- **Tutto o niente, in una sola transazione Dexie** (possibile dal 9/10:
  la sync parte fuori dalla transazione, `repository.ts`). Serve una
  funzione per più alimenti insieme, non la funzione per un alimento
  ripetuta: se due alimenti eliminati stanno nello stesso pasto salvato,
  la domanda "il pasto è rimasto vuoto?" va fatta sull'insieme, altrimenti
  resta il guscio vuoto del bug del 22/09. Cascata e ripristino seguono la
  regola "Alimenti cancellati" (sezione 4), estesa a più alimenti: l'Annulla
  ripristina tutti gli alimenti, poi i pasti salvati, poi le righe. Le
  righe di `preferiti` non si toccano, come per un alimento solo: restano
  vive e nascoste finché l'alimento è cancellato, e tornano con
  l'Annulla. Funzioni `eliminaAlimenti` e `ripristinaAlimenti` in
  `src/lib/repository/composizioni.ts`, test permanenti in
  `eliminazioneAlimenti.test.ts`. **Anche l'Elimina del form** (Aggiungi e
  qui) passa da `eliminaAlimenti` con un alimento solo, e l'Annulla di
  Aggiungi da `ripristinaAlimenti`: dal 15/10 anche l'eliminazione
  singola è tutto o niente (prima erano due scritture separate, in un
  ordine scelto perché un guasto a metà lasciasse uno stato visibile).
- **Mai due alimenti uguali** (decisioni del 16/10, branch
  `alimenti-doppi`). Stesso nome **e** stessa marca = stesso prodotto.
  - **Il confronto**: maiuscole e accenti indifferenti (come la ricerca),
    spazi ai bordi ignorati, spazi doppi interni contati come uno. La
    marca vuota conta come una marca: due "Banana" senza marca sono
    doppioni. Mai il solo nome: «Yogurt greco 0% · Fage» e «Yogurt greco
    0% · Müller» non lo sono. Contano solo gli alimenti **vivi
    dell'utente**, verificati compresi; non i cancellati e non il
    catalogo comune (`user_id` null): un alimento verificato non si
    modifica, se ne crea uno proprio (sezione 10.8), anche con lo stesso
    nome.
  - **Scritta una volta sola**: `trovaDoppione` in
    `src/lib/catalogo/doppioniAlimenti.ts`, con `testoConfronto` (lo
    stesso confronto di `cercaPerNome` e `filtraPerNome`, che la
    importano da lì) e `chiaveAlimento`; test permanenti in
    `doppioniAlimenti.test.ts`. La usa anche la condivisione (sotto,
    "Condividere un alimento").
  - **Nel form** (`CreaAlimentoForm`: "Nuovo alimento" e "Modifica
    alimento", in Aggiungi e qui): mentre si scrive, **sotto il campo
    Marca** (dopo tutti e due i campi) il messaggio in arancio, nome e
    marca con il bordo arancio, e il Salva spento. Il testo dice che il
    confronto è sulla coppia (`testoDoppione`, con test): «Hai già un
    alimento con questo nome e questa marca: «Pane · Mulino».», oppure,
    senza marca, «Hai già «Banana», senza marca.». Fino al 16/10 stava
    sotto il solo Nome («Hai già «Pane · Mulino»»): sembrava un errore sul
    nome, come se un altro «Pane» non si potesse avere (Davide, 16/10;
    branch `ritocchi-username`). Il form legge il catalogo da solo,
    con `useLiveQuery`: anche un alimento arrivato con la sync compare
    subito. In Modifica l'alimento stesso non conta, quindi una rinomina
    che cambia solo maiuscole o accenti ("pane" → "Pane") passa.
  - **"Apri"**, accanto al messaggio, porta all'alimento che c'è già: in
    Aggiungi da "Nuovo alimento" apre il suo **sheet quantità** (si stava
    cercando di registrarlo, come dopo "Crea e scegli la quantità");
    dalla matita in Aggiungi e da qui apre **"Modifica alimento"** di
    quello. Se quello non si può modificare (verificato), "Apri" non c'è
    e resta il messaggio. Le modifiche non salvate si perdono: non si
    potevano salvare comunque. Qui il form ha una `key` per alimento,
    così passando a un altro riparte dai suoi valori.
  - **Al Salva** (`salvaAlimento` in `src/lib/repository/alimenti.ts`):
    si rilegge il catalogo da Dexie e si scrive **nella stessa
    transazione** (`alimenti` + `outbox`). Ferma l'alimento uguale
    arrivato con la sync dopo l'ultimo ridisegno, e il doppio tocco su
    Salva (le due scritture vanno una dopo l'altra, la seconda trova la
    prima). In quel caso non si scrive niente e resta il messaggio, che
    la lettura live ha già visto. Nome e marca si salvano con gli spazi
    normalizzati (`normalizzaSpazi`, come i nomi dei pasti); una marca
    vuota diventa null.
  - **L'Annulla dopo un'eliminazione** non rimette in vita un alimento se
    nel frattempo ne è nato uno uguale. Restano cancellate anche le sue
    righe dei pasti salvati (punterebbero a un alimento cancellato), e un
    pasto salvato che senza di lui tornerebbe vuoto. La barra lo dice con
    nome e marca: "Non ripristinato: hai già «Pane · Mulino»." oppure
    "Ripristinati: 2 alimenti. «Pane · Mulino» no: ne hai già uno
    uguale." (`messaggioDopoRipristino`, con test).
  - **Solo nell'app, non sul server**: niente indice unico su `alimenti`,
    che bloccherebbe in silenzio la coda outbox (come l'indice sui nomi
    dei pasti, tolto il 20/9). Due telefoni offline possono ancora
    crearne due uguali: caso raro, accettato.
  - Schema dati invariato: niente migration, niente versione Dexie.
- **La riga in Impostazioni**: "Alimenti", nel gruppo Alimentazione prima
  di Preferiti, con a destra "46 alimenti", "1 alimento" o "Nessuno",
  contati con la stessa funzione dell'elenco. Con alimenti in arrivo
  (branch `condivisione-alimenti`), "2 in arrivo" ("1 in arrivo") con il
  pallino nel colore principale, al posto del numero (§3 "Amici", "Il
  pallino").
- La pagina è in `PAGINE_APP` del service worker.
- **Schema dati invariato**: niente migration Supabase, niente nuova
  versione Dexie.

### Amici (dal 15/10, branch `amici` e poi `condivisione-alimenti`, chiusi il 16/10)

Serve a una cosa sola: **mandare a un amico una copia di un alimento** del
proprio catalogo, così chi mangia le stesse cose non le riscrive a mano
(il primo giorno, sezione 10.1, è quello in cui l'attrito pesa di più).
Non è un social: niente feed, niente profili da sfogliare, niente diario
o peso visibili ad altri (eccezioni in 9.5 e 9.6). Analisi e decisioni
del 15/10.

**Le decisioni**
- **Condividere = mandare una copia.** Accettata, entra nel catalogo
  dell'amico come sua: id nuovo, il suo `user_id`, modificabile da lui.
  Le modifiche successive del mittente non la toccano. Rimuovere un amico
  non toglie le copie già accettate.
- **Gli alimenti in arrivo vanno accettati**, con **Aggiungi** /
  **Rifiuta**. Dal 16/10 stanno nella **pagina Alimenti**, non in Amici
  (Amici = solo persone): vedi "Condividere un alimento" più sotto.
- **Avvisi solo dentro l'app**: un pallino solo sulla tab Impostazioni;
  sulla riga Amici per le richieste di amicizia, sulla riga Alimenti per
  gli alimenti in arrivo (dal 16/10). Niente notifiche push.
- **Amicizia con richiesta e accettazione esplicita.**
- **Ricerca solo per username esatto**: nessun elenco degli utenti,
  nessuna ricerca parziale.
- La pagina sta in Impostazioni, gruppo **Amici** sotto Alimentazione
  (`/impostazioni/amici`, in `PAGINE_APP` del service worker).

**Lo username**
- **Regola**: `^[a-z][a-z0-9_]{2,19}$`: da 3 a 20 caratteri, comincia con
  una lettera, poi lettere, cifre e `_`; niente accenti, punti o spazi.
  **Sempre minuscolo**: l'app normalizza (spazi ai bordi tolti, tutto in
  minuscolo) prima di controllare e di inviare, quindi "Marco" e "marco"
  sono lo stesso nome per costruzione, e l'indice unico sul database lo
  garantisce senza estensioni. Il campo apre la tastiera senza maiuscola
  iniziale e senza correttore.
- **iPhone non deve scambiarlo per il campo di accesso** (visto da Davide
  il 16/10 in Profilo > Cambia username: "Vuoi accedere a vercel.app con
  la password per …?"). `autoComplete="off"` non bastava: iOS lo ignora
  per le password salvate. Dal 16/10 (branch `ritocchi-username`):
  - **Registrati**: `autoComplete="nickname"` (per lo standard HTML "un
    nome breve o handle al posto del nome completo", cioè proprio lo
    username) e niente "username" in `id` e `name`: il campo si chiama
    `nomeUtente`. **Provato su iPhone il 16/10: la proposta non compare
    più.** Lì iOS vede email (`autoComplete="email"`) e password
    (`"new-password"`) nello stesso modulo, e prende l'email per il campo
    di accesso: email e password si salvano ancora insieme.
  - **La regola** (nata il 16/10): **in un campo che sta da solo (un
    foglio, una schermata senza email e password) la parola "username"
    non deve stare vicino al campo**: né nel titolo, né nell'etichetta o
    nell'`aria-label`, né nella frase sopra, né nell'esito che compare
    all'apertura. iOS legge il testo intorno al campo e, con quella
    parola, lo prende per un accesso; `type` e `autocomplete` non
    bastano. Al suo posto **"nome su Libra"**. In Registrati la parola
    resta: lì c'è l'email.
  - **Come ci si è arrivati** (prove su iPhone del 16/10): con
    `nickname` la proposta compariva ancora nei fogli; poi con
    `type="search"` anche. La diagnosi, solo in Aggiungi un amico:
    senza la parola nei testi la proposta è sparita, mentre in Cambia
    username, dove la parola c'era ancora, compariva. Nessuno dei tre
    campi stava in un `<form>`, quindi toglierlo non era una strada.
  - **I tre campi fuori da Registrati, come sono ora:**
    - foglio di Profilo: titolo **"Cambia il tuo nome su Libra"**
      ("Scegli il tuo nome su Libra" se non c'è ancora), `aria-label` "Il
      tuo nome su Libra", e l'esito sul nome attuale **"È già il tuo
      nome."** (compare all'apertura, sotto il campo);
    - Amici, prima apertura: titolo **"Scegli il tuo nome su Libra"**,
      frase "Gli amici ti trovano solo con il nome esatto. Potrai
      cambiarlo da Profilo.", niente etichetta visibile, `aria-label` "Il
      tuo nome su Libra";
    - Aggiungi un amico: frase "Scrivi il suo nome esatto, quello che ha
      scelto in Libra. Gli arriverà una richiesta da accettare.",
      `aria-label` "Nome dell'amico", `autoComplete="off"` (non
      `nickname`: il nome è di un altro).
    - Tutti e tre restano `type="search"` con `enterKeyHint` ("Fine",
      "Vai", "Invia"): non danno fastidio e aiutano. La "×" nativa la
      toglie `globals.css`, come nelle ricerche di Aggiungi e del
      catalogo. Costo: VoiceOver annuncia "campo di ricerca".
  - **Restano con "username"**: la riga **Username** in Profilo, la
    pagina Registrati e i messaggi d'esito dopo un'azione ("Questo
    username è già in uso.", "Nessun utente con questo username…"). Non
    stanno vicino a un campo vuoto quando lo si tocca.
  - Nessun test sul comportamento: l'unica prova possibile è su iPhone.
- **Si sceglie alla registrazione**: campo "Username" nella pagina
  Registrati, sotto Nome. **Prima dell'invio** la Server Action chiede
  `username_disponibile` ("Questo username è già in uso"). **Lo
  garantisce il database**: il trigger su `auth.users` (sezione 9.1)
  crea la riga in `nomi_utente`; con il nome preso nel frattempo o un
  formato sbagliato la registrazione fallisce tutta, mai un account senza
  username. Due persone che scelgono lo stesso nome nello stesso istante:
  GoTrue risponde con un errore generico, che la Server Action traduce in
  "Username appena preso, scegline un altro". Il trigger si applica dopo
  il merge di `amici` (9.1, "ordine dei rilasci"): fino ad allora lo
  username di chi si registra lo salva la Server Action con
  `imposta_username` (sotto, "All'invio").
- **Com'è fatta la pagina Registrati** (dal 15/10, passo 3; mockup
  `docs/mockups/amici.html`, schermata 1). Campo "Username" sotto Nome,
  con la "@" davanti (fuori dal valore); il campo scrive già in
  minuscolo. Sotto, una riga di esito che cambia **mentre si scrive**
  (`useDisponibilitaUsername`): niente a campo vuoto; il formato sbagliato
  si dice subito, senza chiedere al server ("Da 3 a 20 caratteri: inizia
  con una lettera, poi lettere, numeri e _."); con il formato giusto, 400
  ms dopo l'ultimo tasto, `username_disponibile` → "Disponibile" (colore
  principale) o "Questo username è già in uso." (arancio); senza risposta
  "Non riesco a controllarlo ora: lo controllo quando crei l'account."
  Vale solo la risposta per il nome scritto adesso: una lenta per un nome
  precedente si scarta (test permanente). Sotto ancora le regole: "Da 3 a
  20 caratteri: lettere, numeri e _. Serve agli amici per trovarti."
  "Crea account" si spegne solo con formato sbagliato o nome preso.
- **All'invio** la Server Action rifà tutto: formato, codice di invito,
  poi `username_disponibile` (se la risposta non arriva si va avanti:
  il nome lo protegge l'indice unico). `signUp` porta nei metadati
  `nome`, `username`, `codice_invito` e, dal 17/10, `onboarding:
  "da_fare"` (sezione 3, "Onboarding"). Dal 16/10 i trigger su
  `auth.users` (sezione 9.1) controllano il codice e lo username, tolgono
  `codice_invito` e creano la riga di `nomi_utente`; con un nome già
  preso `signUp` fallisce ("username già in uso"). La **conferma email è
  spenta** sul nostro progetto (scelta di Davide; verificato il 15/10 da
  Cowork: gli account nuovi risultano confermati nello stesso secondo
  della registrazione), quindi dopo `signUp` c'è subito la sessione: la
  Server Action chiama `imposta_username`, che con lo stesso nome già
  scritto dal trigger non riscrive niente (resta come rete di sicurezza),
  e poi risponde "registrato": la pagina Registrati fa un caricamento
  completo di `/onboarding` (fino al 17/10 un redirect a Oggi; perché non
  un redirect: sezione 3, "Onboarding"). L'account non si
  annulla per lo username: se mancasse, lo chiede Amici. Il ramo "senza
  sessione" della Server Action ("controlla la tua email") resta nel
  codice per il giorno in cui la conferma si accendesse: lo username lo
  crea comunque il trigger, l'onboarding parte al primo accesso. Regole
  in `validazione.ts` (`FORMATO_USERNAME`, `normalizzaUsername`,
  `usernameValido`, con test), chiamate in `src/lib/amici/nomiUtente.ts`,
  testi in `testiUsername.ts`.
- **Chi è già registrato** lo sceglie alla prima apertura di Amici: al
  posto della pagina c'è "Scegli il tuo nome su Libra" (fino al 16/10
  "Scegli il tuo username"). **Se nei metadati
  dell'account c'è già uno `username`** (scritto da Registrati), il campo
  lo propone già scritto, con il suo esito "Disponibile / già in uso":
  basta confermarlo (decisione del 15/10, passo 6). Con la conferma email
  spenta (sopra, "All'invio") questa schermata serve a **chi era
  registrato prima di Amici** e al caso raro in cui `imposta_username`
  non ha risposto `ok` alla registrazione (lì il campo parte dai
  metadati). Nelle prove del 15/10 non è mai comparsa: si prova dopo il
  merge con l'account vero di Davide, che non ha username. (Corretto il
  15/10: prima qui c'era scritto che la conferma email era attiva.)
- **Si cambia da Profilo**, se il nome nuovo è libero: una riga
  "Username" che apre un piccolo modulo con il **suo** Salva, solo
  online. Non entra nel Salva unico di Profilo, che scrive in locale: una
  scrittura che può fallire per "già in uso" non si mescola con una
  locale (lo stesso motivo per cui Elimina account non sta in Profilo,
  9.6). Il nome lasciato torna libero.
- Non sta in `profili`: quella riga non nasce alla registrazione (il
  15/10: 6 utenti, 3 righe), passa dalla coda, dove un vincolo violato la
  bloccherebbe (sezione 4, `pasti`), ed è privata per costruzione, mentre
  lo username lo vedono gli amici. Ha una tabella sua, `nomi_utente`
  (sezione 4).
- Gli amici vedono **solo lo username**: mai nome, email o altro.

**Le amicizie**
- **Aggiungi**: si scrive lo username esatto, "Invia richiesta".
  `chiedi_amicizia` risponde solo con un esito, mai con un id o un nome:
  `inviata`, `non_trovato` ("Nessun utente con questo username": vale
  anche per un formato sbagliato, non si distingue), `sei_tu`,
  `gia_amici`, `gia_chiesta`, `troppo_presto` ("Puoi riprovare tra
  qualche giorno"), `accettata` (se l'altro ti aveva già chiesto
  l'amicizia, la sua richiesta diventa accettata) e **`senza_username`**
  (deciso il 15/10, passo 5): chi chiede non ha ancora uno username, e
  senza non si possono avere amici, perché l'altro non avrebbe un nome da
  leggere. Due persone che si chiedono l'amicizia nello stesso istante:
  la seconda trova la riga della prima e diventano amici (`accettata`),
  mai un errore.
- **Richieste ricevute**: Accetta / Rifiuta. **Richieste inviate**: "In
  attesa", con Annulla. ("In arrivo", dal 16/10, si dice solo degli
  alimenti.)
  Le risposte (`rispondi_amicizia`) hanno tre esiti: `ok`,
  `non_trovata` (la richiesta non c'è più, per esempio annullata nel
  frattempo) e `senza_username` (si accetta solo con uno username;
  rifiutare è sempre possibile). Ripetere la stessa risposta dà `ok`:
  dopo una risposta persa si può ripremere senza danni. La risposta
  opposta a una già data dà `non_trovata`.
- **Rifiuto** (decisione del 15/10): chi ha mandato la richiesta vede
  "Non accettata" con un pulsante **Ok**; toccato Ok, la riga sparisce
  (`chiudi_rifiuto`, esiti `ok`, anche ripetuto, e `non_trovata`).
  **Per 7 giorni dal rifiuto**, cioè 7×24 ore da quando è stata rifiutata,
  non può richiedere l'amicizia alla stessa persona (`troppo_presto`),
  dopo sì; l'Ok non accorcia l'attesa. Chi rifiuta non vede altro: la
  richiesta rifiutata sparisce dalla sua pagina, e lui può chiedere
  l'amicizia all'altro quando vuole. **Una richiesta rifiutata non si
  annulla**: se chi è stato rifiutato potesse cancellarla, aggirerebbe i
  7 giorni.
- **Annulla e Rimuovi amico** (`annulla_o_rimuovi_amicizia`, esiti `ok` e
  `non_trovata`): annulla chi ha chiesto, su una richiesta in attesa;
  rimuove uno qualsiasi dei due, su un'amicizia accettata. Ripetuta, per
  esempio dopo una risposta persa, risponde `non_trovata` (la riga è già
  cancellata): **la pagina lo tratta come "già fatto"**, ricarica
  l'elenco e non mostra nessun errore (passo 6). L'amicizia
  finisce per tutti e due. Le copie già aggiunte restano. Dopo, tutti e
  due possono richiedere subito. Gli alimenti ancora in attesa fra i due,
  in tutte e due le direzioni, diventano `annullato`: lo fa la
  ridefinizione della funzione (`create or replace`, stessa firma e
  stessi permessi) nella migration `alimenti_condivisi` (branch
  `condivisione-alimenti`, sezione 4).

**Condividere un alimento** (branch `condivisione-alimenti`; decisioni
del 15/10 e del 16/10; mockup `docs/mockups/alimenti-in-arrivo.html`,
proposta **B**, scelta il 16/10)
- **Da dove**: Impostazioni > Alimenti, selezione multipla. L'icona
  condividi nella barra di selezione apre lo sheet **"Condividi con"**
  con gli amici da spuntare (mockup `docs/mockups/amici.html`, schermata
  6: titolo "Condividi 2 alimenti", pulsante "Manda a 1 amico", spento
  senza amici spuntati: allora dice solo "Manda"). Serve la connessione:
  offline "Per condividere un alimento serve la connessione." e Manda
  spento. **Senza amici** l'icona c'è lo stesso: il foglio dice "Non hai
  ancora amici. Aggiungine uno da Amici, poi torna qui." con il
  collegamento "Vai ad Amici". Se gli amici non si leggono: "Non riesco a
  leggere i tuoi amici. Controlla la connessione e riprova." con
  Riprova. Gli amici sono quelli della pagina Amici, in ordine
  alfabetico, con la spunta a quadratino; "Annulla" chiude. Il foglio
  è `SheetCondividiCon` (passo 4, 16/10). **Provato su iPhone il 16/10**
  da Davide (anteprima in Safari, account A → B, build `c47f275`): invio
  di 2 alimenti, secondo invio dello stesso alimento, foglio offline;
  verificato da Cowork sul database (la riga in attesa con i valori
  giusti, il primo invio del Pane `sostituito`, il secondo in attesa).
- **L'invio è una chiamata sola, tutto o niente** (`manda_alimenti`,
  sezione 4; deciso il 16/10): tutti gli alimenti a tutti gli amici
  spuntati, oppure niente. Se nel frattempo uno degli amici non lo è più
  (`non_amici`) non parte niente, e il foglio rilegge gli amici. Il
  tentativo ripetuto dopo una risposta persa non crea doppie righe (un id
  per ogni tocco su "Manda", tenuto nei tentativi). Dopo l'invio il
  foglio si chiude, si esce dalla selezione e la barra dice "Mandati 2
  alimenti a @sara_c." (la stessa forma con un alimento o più amici:
  "Mandato 1 alimento a @sara_c.", "… a @sara_c e @paolo_a.", "… a 3
  amici."). Con `non_amici` il foglio resta aperto e dice "Uno degli
  amici scelti non è più tuo amico: non è partito niente. Controlla
  l'elenco e riprova."; senza risposta il testo comune di Amici ("Non
  sono riuscito a farlo…"). Una risposta nel foglio in arrivo su
  alimenti che nel frattempo non ci sono più (`non_trovata`): "Questo
  alimento non è più in arrivo." oppure "Alcuni di questi alimenti non
  sono più in arrivo: non è cambiato niente.", e l'elenco si rilegge.
  Testi in `src/lib/catalogo/testiAlimentiInArrivo.ts` (passo 3, 16/10).
  Niente insert diretto nella tabella: il secondo invio deve chiudere la
  riga vecchia, e solo una funzione lo fa insieme all'invio nuovo.
- **Lo stesso alimento mandato due volte alla stessa persona**, prima che
  risponda: il secondo invio sostituisce il primo, chi riceve ne vede uno
  solo, con i valori più recenti.
- **Gli alimenti mai decisi restano**, senza scadenza.
- **Cosa si copia, al momento dell'invio e da Dexie** (quello che il
  mittente vede): nome, marca, barcode, i quattro valori, zuccheri,
  fibre, saturi, sale, porzione, `fonte`. Non dal server: un alimento
  creato o corretto offline e non ancora inviato lì non c'è, o c'è
  vecchio. Se poi il mittente lo modifica o lo elimina, la copia in
  attesa non cambia.
- **Chi manda non vede** se l'alimento è stato aggiunto o rifiutato
  (decisione del 15/10).
- **Dove arrivano: nella pagina Alimenti** (decisione del 16/10; prima
  erano nella pagina Amici, che ora è solo persone). In cima al catalogo
  una riga **"N alimenti in arrivo"** che apre un **foglio** con
  l'elenco: per ciascuno chi lo manda (username), "Nome · Marca", i
  quattro valori per 100 g e i pulsanti **Rifiuta** / **Aggiungi**. Il
  catalogo resta pulito qualunque sia il numero di alimenti in arrivo, e
  nel foglio c'è spazio per i valori, utili per decidere. **Solo con la
  rete**: offline la riga non c'è e il catalogo funziona come oggi. Dopo
  Aggiungi l'alimento compare nel catalogo appena arriva dal server.
  - **La riga c'è anche con il catalogo vuoto**, sopra il riquadro
    "Ancora nessun alimento" (deciso il 16/10): è il caso del primo
    giorno (sezione 10.1), quello in cui un alimento mandato serve di
    più.
  - **Sotto il titolo, chi li manda** (deciso il 16/10): con un mittente
    "Da @sara_c", con due "Da @sara_c e @paolo_a", con tre o più "Da 3
    amici". Il mockup scrive "Da @sara_c · tocca per vederli" anche con
    due mittenti: vale questa regola.
  - **Dopo Aggiungi** la barra dice "Aggiunti: 3 alimenti" (con uno solo
    "Aggiunto: Pane"), **senza Annulla** (deciso il 16/10): l'alimento
    aggiunto si elimina dal catalogo come gli altri. L'app fa partire la
    sincronizzazione e rilegge l'elenco quando la discesa ha portato le
    copie nuove: fino ad allora non saprebbe che sono doppioni degli
    altri in arrivo (sotto, "Due alimenti in arrivo uguali fra loro").
  - **Com'è fatto** (passo 5, 16/10). La riga (`RigaAlimentiInArrivo`)
    sta sopra la ricerca, o sopra "Ancora nessun alimento"; **non in
    selezione**, dove un tocco lì confonderebbe le due cose. Il foglio
    (`SheetAlimentiInArrivo`): "In arrivo dagli amici", la frase del
    mockup, l'elenco dal più recente, "Chiudi"; si chiude da solo quando
    non resta niente. Ogni riga (`RigaAlimentoInArrivo`): "Nome · Marca",
    "Da @…", "259 kcal · G 3,3 · C 45 · P 9 g", e a destra i pulsanti in
    colonna come nel mockup (Aggiungi pieno sopra, Rifiuta sotto;
    "Usa questi valori" pieno sopra "Tieni i miei"). Una risposta alla
    volta: durante un'azione tutti i pulsanti del foglio sono spenti.
    Rifiuta, Tieni i miei e Ok non hanno barra: la riga sparisce. La
    barra con l'Annulla di "Usa questi valori" è della pagina e, con il
    foglio aperto, sale sopra il velo: resta anche se il foglio si chiude
    perché era l'ultimo alimento. Testi: "Valori aggiornati: Yogurt ·
    Fage" (con "(resta fra quelli in arrivo)" se la chiusura non è
    arrivata), dopo l'Annulla "Ripristinato: Yogurt · Fage", Annulla non
    riuscito "Non sono riuscito ad annullare. Controlla la connessione e
    riprova." (con di nuovo Annulla), il proprio alimento sparito nel
    frattempo "Il tuo alimento non c'è più: non è cambiato niente."
- **Doppione** = stesso nome e stessa marca di un alimento vivo del
  proprio catalogo, con maiuscole, accenti e spazi ai bordi indifferenti;
  la marca vuota conta come una marca («Yogurt greco 0% · Fage» e
  «Yogurt greco 0% · Müller» non sono doppioni, due alimenti senza marca
  con lo stesso nome sì). **Mai due alimenti uguali**: "Aggiungi
  comunque" non esiste. Il messaggio scrive sempre nome e marca. È la
  stessa regola del catalogo (sopra, "Alimenti", "Mai due alimenti
  uguali"), già scritta: `trovaDoppione` in
  `src/lib/catalogo/doppioniAlimenti.ts`, da usare così com'è.
  - **Valori diversi**: "Hai già «nome · marca», con valori diversi.", il
    collegamento **"Confronta i valori"** (una tabella, chiusa
    all'inizio: il tuo e quello in arrivo per kcal, grassi, carboidrati,
    proteine e porzione, i valori diversi in arancio) e i pulsanti **"Usa
    questi valori"** e **"Tieni i miei"** (= Rifiuta). Sotto le cinque
    righe fisse, una riga per zuccheri, fibre, saturi o sale **solo
    quando è diverso** (deciso il 16/10). I numeri fino a due decimali:
    una differenza in arancio deve vedersi.
  - **Uguali o diversi: tutti e nove i valori** che "Usa questi valori"
    scriverebbe (kcal, grassi, carboidrati, proteine, zuccheri, fibre,
    saturi, sale, porzione; deciso il 16/10), confrontati **in
    centesimi** (la precisione di `numeric(7,2)` e del form): 3,30 e
    3,31 sono diversi, nessun'altra tolleranza. Un valore assente non è
    uguale a 0. Confrontare solo i cinque della tabella farebbe
    sparire, con l'Ok, una differenza negli zuccheri che nessuno ha
    visto.
  - **"Usa questi valori"** aggiorna il **proprio** alimento, con lo
    stesso id: tutti i valori nutrizionali e la porzione, non nome, marca,
    barcode e `fonte`. Passa da Dexie e dalla coda come ogni modifica
    (§9.2); il server chiude solo la condivisione. Valgono le regole di
    una modifica (sezione 4): da ora e nei pasti salvati, il diario non
    cambia. Dopo, la barra con **Annulla**: rimette i valori di prima
    **e** riapre la condivisione, che torna in attesa
    (`riapri_alimento_condiviso`, sezione 4). Se il proprio alimento non
    si può modificare (verificato: oggi non succede, la RLS non lo
    permette a un utente) "Usa questi valori" non c'è, resta "Tieni i
    miei".
  - **L'ordine delle due scritture** (deciso il 16/10). "Usa questi
    valori": **prima Dexie, poi il server**. Una transazione Dexie
    (`alimenti` + `outbox`) rilegge il proprio alimento, controlla che
    sia vivo e ancora diverso, tiene i valori di prima per l'Annulla e
    scrive i nuovi; poi `rispondi_alimenti_condivisi` con
    `valori_usati`. Se la rete cade fra le due, i valori sono già
    aggiornati e la condivisione resta in attesa: alla rilettura il
    foglio la mostra come "valori identici", con solo Ok, e si sistema
    da sola. La barra con Annulla compare in tutti e due i casi; se la
    chiusura non è arrivata lo dice. L'ordine opposto, se si perde la
    scrittura locale, lascerebbe la condivisione chiusa e i valori nuovi
    persi. **Annulla: prima il server, poi Dexie.** Prima
    `riapri_alimento_condiviso`; se non risponde non si tocca niente, la
    barra dice di riprovare e l'Annulla resta. Riaperta, si rimettono i
    valori di prima (transazione Dexie, con la coda). Con la risposta
    persa il server ha già riaperto: ripremere dà `ok` (la funzione
    accetta la ripetizione) e poi rimette i valori. L'ordine opposto,
    con la rete che cade, lascerebbe la condivisione chiusa per sempre.
  - **Valori identici**: "Hai già questo alimento, con gli stessi
    valori." e solo **Ok**, che chiude la condivisione.
  - **Due alimenti in arrivo uguali fra loro** (stesso nome e marca, da
    due amici o due prodotti dello stesso amico; deciso il 16/10):
    nessuno dei due è un doppione del catalogo, ma aggiungerli tutti e
    due farebbe due alimenti uguali. Nella selezione multipla **se ne
    spunta uno solo per chiave** (`chiaveAlimento`); dopo l'Aggiungi e
    la discesa l'altro diventa un doppione normale, con le sue scelte.
    Spuntare il secondo **sposta la spunta** dal primo a lui (come una
    scelta fra due); "Seleziona tutti" prende il primo dell'elenco, il
    più recente (passo 3, 16/10).
  - Il confronto (doppione sì o no, valori uguali o diversi, uguale a un
    altro in arrivo) e le righe della tabella sono funzioni pure con test
    permanente (`src/lib/catalogo/alimentiInArrivo.ts`). Il doppione lo
    controlla solo l'app (con Dexie, subito prima di chiamare il server),
    come al Salva di un alimento: la regola sta in JS, non nel database.
- **Selezione multipla nel foglio**: "Seleziona" in alto, oppure tieni
  premuto su un alimento. Quadratini a sinistra, "Seleziona tutti" /
  "Deseleziona tutti", barra in fondo con **Rifiuta** e **Aggiungi**. I
  doppioni e gli alimenti già uguali non si selezionano: hanno le loro
  scelte. Con più di un alimento selezionato si chiede conferma, sia per
  Aggiungi sia per Rifiuta; con uno solo no. In blocco è **una sola
  chiamata, tutto o niente**. Niente selezione multipla in Amici.
  - **Com'è fatta** (passo 6, 16/10, come nel mockup). "Seleziona" diventa
    "Annulla" (esce dalla selezione); non c'è se nessun alimento si può
    spuntare. In selezione la nota diventa "I doppioni non si
    selezionano: per loro si decide uno per uno.", le righe nuove
    perdono i loro pulsanti e si spuntano con un tocco (la riga spuntata
    prende il fondo tenue del colore principale), doppioni e uguali
    tengono le loro scelte con il quadratino spento. Togliere l'ultima
    spunta **non** esce dalla selezione (barra con "0 selezionati" e i
    pulsanti spenti), al contrario del catalogo: qui "Seleziona" è un
    pulsante, e l'uscita è "Annulla". Il tieni premuto è lo stesso
    gesto del catalogo (`useTieniPremuto`, tipo di riga
    `alimentoInArrivo`) e vale solo sulle righe nuove. La barra in fondo
    prende il posto di "Chiudi": "N selezionati", **Rifiuta** pieno in
    arancio (`warning`), **Aggiungi** pieno nel colore principale. Le
    conferme sono quelle del mockup (`SheetConferma`, "Rifiuta N" in
    arancio). Prima di Aggiungi si ricontrolla su Dexie: se uno degli
    spuntati è diventato un doppione nel frattempo non si chiama il
    server, la sua spunta cade e si ripreme. Dopo la risposta si esce
    dalla selezione; Aggiungi ha la barra "Aggiunti: N alimenti",
    Rifiuta no.
  - **Passi 5 e 6 provati su iPhone il 16/10** da Davide (anteprima in
    Safari, A → B, build `cba066a`): riga "in arrivo", foglio,
    confronto, "Usa questi valori" con Annulla, Ok sui valori uguali,
    Aggiungi singolo, selezione (Seleziona, tieni premuto, Seleziona
    tutti / Deseleziona tutti), Aggiungi e Rifiuta multipli con
    conferma. "0 selezionati" senza uscire dalla selezione confermato.
    Verificato da Cowork sul database: stati `aggiunto`, `rifiutato`,
    `uguale`, `valori_usati`, `sostituito` corretti; tre copie nel
    catalogo di B con i valori giusti (`manuale`, non verificate); lo
    Yogurt di B aggiornato con i valori di A sullo stesso id.
- **La copia nasce sul server**, in `rispondi_alimenti_condivisi`, in una
  transazione: inserisce in `alimenti` con l'id calcolato dalla
  condivisione (UUID v5, `uuid-ossp` è già installata), `user_id` di chi
  accetta, `verificato = false`, `fonte` del mittente (`ricetta` diventa
  `manuale`: senza la sua composizione non sarebbe una ricetta), e segna
  la riga `aggiunto`. L'id calcolato rende il tentativo ripetibile: se
  la risposta si perde e si ripreme, `on conflict (id) do nothing` non
  crea una seconda copia. Poi l'app fa partire una discesa e l'alimento
  compare nel catalogo come gli altri. Nessuna foreign key da `alimenti`
  verso la condivisione: la copia è indipendente da tutto. Con la
  selezione multipla la stessa funzione riceve più righe insieme, in una
  transazione (forma in sezione 4).

**Il pallino** (dal 16/10, branch `amici`, passo 7; codice in
`src/lib/amici/novita.ts`)
- **Il numero è una somma di parti** (`NovitaAmici`, `totaleNovita`): oggi
  una sola, le **richieste di amicizia ricevute in attesa**
  (`contaRichiesteRicevute`: solo il numero, con `head: true`, filtrato
  dalla RLS). "Non accettata" non è una novità: è la risposta a una
  richiesta propria. Il secondo termine, gli **alimenti in arrivo**
  (`alimentiInArrivo`, contati come le richieste: solo il numero, con
  `head: true`, filtrato dalla RLS), arriva con il branch
  `condivisione-alimenti`. Le due parti si aggiornano **ciascuna per
  conto suo**: la rilettura della pagina Amici scrive solo le richieste,
  quella della pagina Alimenti solo gli alimenti, e nessuna azzera
  l'altra. Se uno dei due conteggi non risponde, quella parte resta
  l'ultima nota. Anche lo scarto delle letture vecchie è **per parte**
  (passo 7, 16/10): se la pagina Amici scrive le richieste mentre il
  pallino sta chiedendo i due numeri, si scarta la risposta vecchia sulle
  richieste, non quella sugli alimenti (test permanenti in
  `novita.test.ts`).
  Il pallino della tab conta il totale; **la riga Amici conta solo le
  richieste** (`richiesteRicevute`), non il totale. Gli alimenti in
  arrivo (decisione del 16/10) hanno il loro numero sulla **riga
  Alimenti** di Impostazioni: "2 in arrivo" con il pallino, al posto del
  numero di alimenti, come "2 nuove" sulla riga Amici. Sulla tab resta un
  pallino solo, per la somma.
- **Si aggiorna** agli stessi inneschi della discesa (avvio, ritorno
  online, ritorno in primo piano: `useNovitaAmici`) e dopo ogni azione
  nella pagina Amici: ogni rilettura riuscita della pagina (`useAmicizie`)
  scrive anche le novità, contate dalle stesse righe, senza un'altra
  chiamata. Se una lettura del pallino partita prima arriva dopo, si
  scarta: non riaccende un pallino che la pagina ha appena spento (test
  permanente). Niente Realtime, niente polling (9.2).
- **Un numero condiviso**: tab e riga leggono le novità dallo stesso
  posto in memoria (`useSyncExternalStore`): una lettura aggiorna tutte e
  due.
- **Offline**: le ultime novità note, in `localStorage` con una chiave per
  utente (`nutritrack:amici:novita:<id>`), il JSON delle parti
  (`{"richiesteRicevute":2}`): offline la tab e la riga hanno ciascuna il
  suo numero. Accesso protetto (`try/catch`) come le altre chiavi; un
  valore rovinato vale "nessuna novità". Con gli alimenti in arrivo il
  JSON ha anche `alimentiInArrivo`; un valore salvato prima, senza
  quella chiave, vale 0 alimenti (e le sue richieste restano). Lo sovrascrive il primo contatto
  riuscito; se la risposta non arriva resta l'ultimo noto. Lo cancellano
  **Esci**, nel blocco "sempre" (anche quando la sessione è scaduta e i
  dati restano: le novità non sono modifiche da salvare), ed **Elimina
  account** (9.6).
- **Sulla tab Impostazioni c'è un pallino solo** (`pallinoTab`, funzione
  pura con test): se la sincronizzazione chiede attenzione vince il suo
  arancio (9.2), e lo screen reader legge solo "sincronizzazione da
  controllare"; altrimenti, con delle novità, il pallino nel colore
  principale (`bg-accent`), e lo screen reader legge "Impostazioni, 2
  novità in Amici" ("novità" non cambia al plurale). Con gli alimenti in
  arrivo (branch `condivisione-alimenti`, deciso il 16/10) il testo
  diventa **"Impostazioni, N novità"**, con N la somma: le novità non
  stanno più tutte in Amici.
- **Nella riga Amici**, con richieste ricevute, a destra "2 nuove" ("1
  nuova") in colore principale con lo stesso pallino, al posto del numero
  di amici; senza, "N amici" come prima.
- **Contrasti** (verificato il 16/10, nessun test nuovo): il pallino ha
  un anello del colore della superficie (`ring-2 ring-surface`), quindi il
  colore che lo tocca davvero è `--superficie`, sia sul vetro della
  pillola sia sulla capsula della voce attiva. "`--accento` su
  superficie" è già controllato da `contrasti.test.ts` per i quattro
  colori, in chiaro e in scuro, con la soglia dei testi (4,5:1), più alta
  di quella degli elementi grafici (3:1). Vale anche per il pallino
  arancio ("`--avviso` su superficie") e per quello della riga Amici, che
  sta sul gruppo, cioè sulla superficie.

**Offline e dati.** Le tre tabelle di Amici sono **solo online** (sezione
4): non entrano in Dexie, nella coda né nella discesa, quindi niente
versione Dexie nuova. Offline la pagina Amici mostra "Serve la
connessione". Entra nel local-first una cosa sola, la copia accettata,
che è una riga normale di `alimenti`.

**La pagina Amici** (dal 15/10, branch `amici`, passo 6; mockup
`docs/mockups/amici.html`, schermate 3 e 4). Decisioni del 15/10:
1. **"Alimenti in arrivo" non sta in questa pagina**: dal 16/10 va nella
   pagina Alimenti, con il branch `condivisione-alimenti` (vedi
   "Condividere un alimento" sopra). Amici è solo persone: richieste e
   amici. Il mockup `docs/mockups/amici.html` è aggiornato di
   conseguenza (16/10, senza il gruppo "Alimenti in arrivo").
2. **La riga in Impostazioni** mostra quanti amici (vedi "Impostazioni"
   sopra); pallino e "2 nuove" al passo 7.
3. **Testi**: gli esiti di `chiedi_amicizia` come nel mockup ("Richiesta
   inviata a @nome.", "Nessun utente con questo username. Controlla come
   è scritto.", "Siete già amici.", "Hai già mandato una richiesta a
   @nome.", "Puoi riprovare tra qualche giorno.", "Ora siete amici."), più
   `sei_tu` "Questo è il tuo username." e `senza_username` "Prima scegli
   il tuo username." (in pratica non succede: la pagina lo chiede prima).
   In verde solo "inviata" e "Ora siete amici.", gli altri in arancio,
   come nel mockup. Il nome nel testo è normalizzato, come lo vede
   l'altro. Accetta / Rifiuta con `non_trovata`: si rilegge l'elenco e la
   barra dice "Questa richiesta non c'è più."; Annulla / Rimuovi / Ok con
   `non_trovata` valgono "già fatto", senza messaggi (passo 5). Una
   risposta che non arriva: la barra "Non sono riuscito a farlo.
   Controlla la connessione e riprova." Testi in
   `src/lib/amici/testiAmici.ts`, con test.
4. **Conferme**: solo Rimuovi amico, con `SheetConferma` "Rimuovere
   @sara_c dagli amici?" / "Gli alimenti che vi siete già mandati
   restano.", Annulla / Rimuovi in arancio (`warning`, non `--pericolo`:
   si può richiedere subito). Accetta, Rifiuta, Annulla e Ok senza
   conferma.
5. **Elenchi**: una sezione vuota non si mostra; senza richieste né
   amici, sotto "Aggiungi un amico", il riquadro "Ancora nessun amico.
   Aggiungine uno con il suo username esatto." Richieste (ricevute e
   inviate) dalla più recente, amici in ordine alfabetico di username.
6. **Quando si rilegge**: all'apertura, dopo ogni azione, al ritorno in
   primo piano (`visibilitychange`) e al ritorno della rete (`online`).
   Niente polling, niente Realtime. Una rilettura non rimette
   "Caricamento...": l'elenco resta finché arriva quello nuovo, e se due
   letture si accavallano vale l'ultima partita (`useAmicizie`).

Com'è fatta, dall'alto ("‹ Impostazioni" e il titolo "Amici"):
- **offline**: `ServeConnessione` con un testo suo ("Amici funziona solo
  con internet…"), che si toglie da solo quando torna la rete;
- **senza username** (nessuna riga in `nomi_utente`): "Scegli il tuo
  username" (`SceltaUsername`, schermata 3) al posto della pagina, con
  "Gli amici ti trovano solo con il nome esatto. Potrai cambiarlo da
  Profilo.", il campo con la "@" e l'esito mentre si scrive. Con uno
  `username` nei metadati dell'account (`useUsernameDaiMetadati`) il
  campo parte già scritto e mostra subito il suo esito; se il
  suggerimento arriva un attimo dopo, riempie il campo solo se l'utente
  non ha ancora scritto (test permanente). "Continua" chiama
  `imposta_username`: con `ok` si apre la pagina, con `occupato` o
  `non_valido` il messaggio sotto il campo, come in `SheetUsername`;
- **"Aggiungi un amico"**, pulsante pieno a tutta larghezza: apre il
  foglio del mockup (`SheetAggiungiAmico`). Campo "@" in minuscolo,
  "Invia richiesta"; il formato si controlla prima di chiamare il server
  (sbagliato → la regola del formato sotto il campo); l'esito resta sotto
  il campo e il foglio non si chiude da solo; dopo `inviata` o
  `accettata` l'elenco si rilegge. **Chiudi** per uscire. Niente
  controllo "esiste?" mentre si scrive: la ricerca è solo all'invio;
- **Richieste ricevute**: iniziali nel cerchio, "@username", "Vuole
  essere tuo amico", **Rifiuta** / **Accetta**;
- **Richieste inviate**: prima quelle "In attesa che accetti", con
  **Annulla**, poi le "Non accettata", con **Ok** (`chiudi_rifiuto`);
- **I tuoi amici · N**, nota "Tocca un amico per rimuoverlo.": tocco
  sulla riga (con la freccia) → conferma → Rimuovi;
- durante un'azione i pulsanti di quella riga sono spenti (niente doppio
  tocco).

Le iniziali vengono dallo username: le prime lettere delle prime due
parti separate da "_" ("marco_b" → "mb"), altrimenti le prime due lettere
(`inizialiUsername`). La divisione delle righe in ricevute / inviate in
attesa / non accettate / amici è una funzione pura con test
(`dividiAmicizie` in `src/lib/amici/amicizie.ts`): non si fida della RLS e
scarta comunque le righe cancellate, quelle senza di me, le richieste
rifiutate da me e i rifiuti già chiusi. **Username mancante** (in pratica
non succede: può capitare solo se il nome cambia fra le due letture): la
riga resta con "Nome non disponibile" e "?" nel cerchio, e i pulsanti
funzionano; nasconderla lascerebbe una richiesta a cui non si può
rispondere e un numero di amici diverso dall'elenco. Fra gli amici va in
fondo. Le chiamate alle quattro funzioni e i tipi dei loro esiti stanno
in `amicizie.ts`, come `EsitoImpostaUsername` in `nomiUtente.ts`;
`tipi.ts` tiene solo i tipi delle righe.

**Fasi**, ognuna con la sua migration (file in `supabase/migrations/`,
prove in un blocco SQL annullato prima, `get_advisors` dopo):
- branch **`amici`**: (1) questo documento; (2) migration `nomi_utente`
  con `username_disponibile` e `imposta_username`, senza trigger; (3)
  campo Username in Registrati, che manda username e codice nei
  metadati, e regole in `validazione.ts` con test; (4) riga Username in
  Profilo; (5) migration `amicizie`; (6) pagina Amici, con "Scegli il tuo
  username", e gruppo in Impostazioni; (7) pallino per le richieste.
  (8) la migration del trigger su `auth.users` (username e codice di
  invito, sezione 9.1), in quest'ordine: merge di `amici` → deploy di
  produzione **Ready** → prove in un blocco SQL annullato → applicazione
  → una registrazione vera;
- prima, subito dopo il merge di `amici`: il controllo dei doppi nel
  catalogo quando si crea o si rinomina un alimento (branch
  `alimenti-doppi`, 16/10; sopra, "Alimenti", "Mai due alimenti
  uguali");
- branch **`condivisione-alimenti`** (passi rivisti il 16/10, dopo
  l'analisi): (1) questo documento; (2) migration `alimenti_condivisi`
  (sezione 4: tabella, `manda_alimenti`, `rispondi_alimenti_condivisi`,
  `riapri_alimento_condiviso`, `annulla_o_rimuovi_amicizia` ridefinita)
  con il blocco di prova annullato, che contiene anche la prova della
  cascata di Elimina account; (3) `src/lib/amici/alimentiCondivisi.ts`
  (chiamate e letture), le funzioni pure del confronto e i testi, con i
  test; (4) icona condividi e sheet "Condividi con", anche senza amici →
  **prova dell'invio su iPhone**; (5) nella pagina Alimenti la riga "N
  alimenti in arrivo", il foglio, il confronto, "Usa questi valori" /
  "Tieni i miei" con l'Annulla, valori identici con Ok; (6) la
  selezione multipla nel foglio → **prova della ricezione completa su
  iPhone**; (7) novità e pallino estesi agli alimenti, riga Alimenti "N
  in arrivo", testo di Elimina account; (8) prova finale con A e B, poi
  la cascata vera con Elimina account (sezione 11, "Account di prova").
  Le prove le fa Davide sull'anteprima Vercel del branch, in Safari, con
  A (`@amici_uno`) e B (`@amici_due_b`), già amici. **Tutti e otto i
  passi fatti il 16/10**, provati su iPhone e verificati da Cowork sul
  database; il passo 8 con Elimina il mio account vero (sezione 11,
  "Fatto", "Condivisione degli alimenti").

**Prove con due utenti**: due account usa e getta creati da Davide
dall'app (per esempio `davidemancon02+amici1@…` e `+amici2@…`), eliminati
alla fine con Elimina account, che così prova anche la cascata. Il suo
account e l'account di prova fisso restano fuori. Sullo stesso iPhone uno
in Safari e uno nell'app installata (memorie separate). Servono il codice
di invito e la Redirect URL esatta dell'anteprima del branch (sezione
11). Fatte il 15/10 con gli account A e B (sezione 11, "Account di
prova"): A in Safari su iPhone, B in Chrome sul PC; nessuna email da
aspettare, perché la conferma email è spenta.

### Profilo

In Impostazioni > Profilo (`/impostazioni/profilo`), stile a gruppi con i
campi nella riga. Ci sono solo i dati personali; obiettivo, target e giorni
sono in Obiettivi, la pesata in Peso.

- **Intestazione**: sopra, "‹ Impostazioni" e il titolo "Profilo"; sotto,
  iniziali, nome, "78,4 kg · 180 cm" (ultima pesata e altezza salvate) ed
  email dell'account in sola lettura. Il nome viene dai metadati
  dell'account scritti alla registrazione (`profili.nome` non lo scrive
  ancora nessuno): se manca, niente iniziali e niente nome
- **Account** (dal 15/10, branch `amici`, passo 4; mockup
  `docs/mockups/amici.html`, schermata 5): la riga **Username**, sopra i
  dati personali. A destra "@nome", "Da scegliere" se non c'è ancora,
  "…" mentre si legge; offline "Serve la connessione", e il tocco riprova
  a leggerlo. Si legge da Supabase all'apertura (`useMioUsername`: solo
  online, non sta in Dexie). Il tocco apre il foglio **"Cambia il tuo
  nome su Libra"** ("Scegli il tuo nome su Libra" se non c'è; fino al
  16/10 "Cambia username", vedi sopra "Lo username", iPhone): campo con
  la "@", esito mentre si scrive come in Registrati, più il caso del nome
  attuale ("È già il tuo nome.", Salva spento: per il database il tuo nome è
  "preso", e senza questa regola il foglio direbbe "già in uso",
  `foglioUsername.ts` con test); sotto, "I tuoi amici restano: sono
  legati al tuo account, non al nome. Il vecchio nome torna libero."
  **Annulla / Salva**: il Salva chiama `imposta_username` e si spegne
  offline ("Per cambiare lo username serve la connessione."); "occupato"
  → "Questo username è già in uso.", nessuna risposta → "Non sono
  riuscito a salvarlo. Controlla la connessione e riprova." Riuscito, il
  foglio si chiude e la riga mostra il nome nuovo. Fuori dal Salva unico e
  dal guardiano: il foglio salva da sé. L'email resta nell'intestazione,
  non nel gruppo come nel mockup, per non mostrarla due volte
- **Dati personali** (per il calcolo): sesso, data di nascita, altezza, livello di attività.
  Non sono dati "in più": senza di loro il fabbisogno non è calcolabile (vedi
  sotto). Il sesso ammette "preferisco non indicarlo" (a schermo "Non
  indicato", nel selettore a tre segmenti), che disattiva il calcolo
  automatico e lascia i target manuali. Il livello di attività ha il menu a
  tutta larghezza sotto il nome, perché le voci sono lunghe
- **"Ricarica i dati dal tuo account"** (§9.2) è passato in Impostazioni >
  Sincronizzazione; **Esci** in fondo all'elenco Impostazioni. Uscendo
  si svuotano i dati di questo utente dal dispositivo (branch
  `esci-svuota`, regole in §9.6 "Esci svuota i dati locali"): prima prova
  a inviare la coda, poi con la coda vuota esce senza chiedere; se resta
  qualcosa e la sessione è valida chiede "perdi N" (**Resta** / **Esci e
  perdile**, in arancio); se la sessione non vale più non svuota niente e
  lo dice (**Resta** / **Esci**): rientrando le modifiche partono. Durante
  l'uscita il pulsante dice **"Uscita…"** ed è spento, anche mentre
  aspetta le discese in corso. Le modifiche non salvate di un modulo non
  c'entrano: per lasciare la pagina col modulo il guardiano chiede già
  prima. Esce solo questo dispositivo (`scope: "local"`), e non offline:
  senza rete non si esce, con un messaggio, mai "a metà"
- **Tema**: non sta in Profilo ma in Impostazioni > Aspetto (sopra)

#### Un solo Salva (deciso il 2026-09-26)

Dati personali, Obiettivo e Giorni di allenamento sono **un unico modulo**;
dal 3/10 sta in due pagine, Profilo (dati personali) e Obiettivi (obiettivo,
target, giorni), con **un solo pulsante Salva per pagina**, in una barra in
fondo. Ogni pagina carica tutto il modulo e ne modifica la sua parte; il
Salva passa tutto e scrive solo le sezioni cambiate, quindi quelle
dell'altra pagina non vengono toccate. Stato e azioni comuni in
`useModuloImpostazioni` (un hook React), barra e bivio in
`SalvataggioModulo`. Se il Salva da Obiettivi deve creare il profilo e manca
il livello di attività, il messaggio dice di impostarlo in Profilo, con il
link. **La barra compare
solo quando ci sono modifiche da salvare** (dal 2/10). Prima era sempre
visibile, inerte quando non c'era niente da salvare. Con la tab bar diventata
una pillola fluttuante, due elementi fluttuanti fissi erano troppi: ora il
Salva compare quando serve, sopra la pillola, come una scheda staccata dai
bordi. Lo spazio in fondo alla pagina resta sempre riservato, come se la barra
ci fosse: quando compare non copre gli ultimi campi, e la pagina
non salta. Compare con una dissolvenza di 150 ms, nessuna animazione con
`prefers-reduced-motion`. Sparisce dopo il salvataggio e dopo "Annulla
modifiche". Dopo un salvataggio riuscito, nello stesso punto sopra la
pillola, compare "Salvato." per 2,5 secondi: una BarraAnnulla senza
azione, perché la barra Salva a quel punto non c'è più. Il Salva
confronta i
valori sullo schermo con quelli caricati e **scrive solo le tabelle delle
sezioni cambiate** (Dati personali → `profili`; Obiettivo → `obiettivi` +
target "normale"; Giorni di allenamento → `profili` + target "allenamento").
Nessun ordine obbligato fra le sezioni, nessun salvataggio automatico al
tocco dell'interruttore. Le sezioni toccate hanno bordo d'accento ed
etichetta "Modificato", sotto ogni campo cambiato c'è il valore precedente, e
la barra dice quali sezioni verranno aggiornate (con "Annulla modifiche").
Con modifiche non salvate, lasciare la pagina da "‹ Impostazioni" o dalla
tab bar chiede "Esci senza salvare?" (il guardiano, vedi "Impostazioni"
sopra; dal 3/10, prima il cambio di scheda non avvisava); chiusura e
ricarica della pagina le avvisa il browser. Logica e test in
`src/lib/profilo/salvataggioProfilo.ts`.

**Cambio vero o correzione.** Se è cambiato l'obiettivo o un target (anche
solo quello di allenamento) di un periodo già esistente, il Salva chiede:
- **"È un cambio vero"** (predefinita) → periodo nuovo in `obiettivi`, con la
  **data d'inizio modificabile**: da oggi (data del calendario) indietro fino al
  **giorno dopo** l'inizio del periodo in corso. Non prima: il periodo nuovo
  non sarebbe mai quello in corso. Non lo stesso giorno: il vecchio resterebbe
  senza nemmeno un giorno di validità. Non nel futuro: dopo il Salva la pagina
  mostrerebbe ancora i valori vecchi. Se il periodo in corso è iniziato oggi,
  si può solo correggere. Il periodo nuovo nasce con la riga "normale" e, se la
  differenziazione è attiva o il periodo precedente l'aveva, con la riga
  "allenamento"
- **"Avevo sbagliato a inserirlo"** → aggiorna il periodo in corso (e le sue
  righe di `obiettivi_target` cambiate), `valido_dal` invariato: i valori
  corretti valgono per tutto il periodo, anche i giorni già passati

Al **primo inserimento** (nessun obiettivo) non si chiede niente: si crea il
primo periodo, che vale "da sempre" (vedi `obiettivi` nella sezione 4).

**Il periodo in corso** ha una sola definizione in tutta l'app: il periodo
valido oggi, data del calendario (`periodoInCorso` in `totaliDiario.ts`), lo
stesso "oggi" della pagina Oggi.

### Il calcolo del fabbisogno

Va detto esplicitamente perché determina quali dati servono nel profilo.

Formula di **Mifflin-St Jeor** per il metabolismo basale, che richiede **sesso,
età, altezza e peso**; moltiplicata per un fattore di attività (sedentario →
molto attivo); poi corretta dall'obiettivo (deficit per dimagrire, surplus per
massa). I macro si derivano dalle calorie con percentuali predefinite.

Il risultato è sempre e solo una **proposta**: ogni target resta modificabile a
mano, e un target modificato non viene più ricalcolato da solo alle spalle
dell'utente.

### Giorni normali e giorni di allenamento

Chi segue una dieta impostata da un nutrizionista ha spesso **target diversi nei
giorni di allenamento**: più carboidrati e più calorie quando ci si allena, meno
quando si riposa. Senza questa distinzione l'app mostrerebbe "Rimangono 620 kcal"
sbagliato su metà della settimana — non è un dettaglio estetico, è il numero
principale della schermata principale.

**È spenta di default.** Chi non ne ha bisogno — la maggioranza — non deve
vedere né l'interruttore acceso, né la pastiglia in Oggi, né il secondo set di
target. Da spenta l'app è identica a com'è adesso.

**Il tipo del giorno è proposto, non chiesto ogni volta.** Nel profilo si
indicano i giorni della settimana in cui ci si allena di solito (lunedì,
mercoledì, venerdì...): da lì in poi la giornata nasce già classificata e la
pastiglia in Oggi serve solo a correggerla quando la realtà è diversa. È lo
stesso principio del pasto proposto dall'ora: chiedere una classificazione ogni
giorno sarebbe una tassa quotidiana su un'app che esiste per non farne pagare.

**I tipi di giorno non sono cablati nel codice.** Sono i set di target che
l'utente ha definito: se un nutrizionista ne prescrive tre (riposo, allenamento
leggero, allenamento intenso), si aggiunge un set di target e il selettore ne
mostra tre. Nessuna modifica allo schema.

#### Le tre regole, per non lasciare ambiguità

1. **Un giorno viene scritto** in due momenti soltanto: quando riceve la prima
   voce di diario, oppure quando l'utente tocca la pastiglia in Oggi
2. **Il pattern settimanale del profilo propone solo per i giorni non ancora
   scritti.** Non è la fonte della verità, è il valore predefinito
3. **Cambiare il pattern non modifica nessun giorno già scritto**, né passato né
   della settimana in corso

La pastiglia in Oggi vince sempre, in qualsiasi momento.

Esempio con pattern lun/mer/gio: lunedì registri e viene scritto "allenamento";
mercoledì non ti alleni e con un tocco diventa "normale"; venerdì ti alleni a
sorpresa e con un tocco diventa "allenamento". Nel database la settimana risulta
lun/gio/ven, non lun/mer/gio. Se il mese dopo cambi il pattern in lun/mer/ven,
quelle righe restano identiche: cambia solo cosa verrà proposto da lì in avanti.

Le settimane in cui ci si allena due volte invece di tre non richiedono nulla di
speciale: quel giorno resta "normale" e nessuno lo rimette a posto. Il pattern
serve solo a risparmiare tocchi nel caso frequente.

Caso ambiguo accettato: registrando **a posteriori** una giornata mai aperta, la
proposta arriva dal pattern *attuale*, che allora poteva essere diverso. Come per
il pasto proposto dall'ora sui giorni passati, è un tentativo che l'utente
corregge.

#### La trappola: il tipo del giorno va scritto, non ricalcolato

Il tipo si eredita dal pattern settimanale, ma **appena una giornata riceve la
prima voce, il suo tipo viene scritto esplicitamente**. Se restasse calcolato dal
pattern, il giorno in cui sposti l'allenamento dal mercoledì al giovedì
**riscriveresti il passato**: mesi di mercoledì diventerebbero giorni normali,
con i target sbagliati e i grafici ridisegnati.

È lo stesso errore della data delle voci (sezione 4, "Il giorno è quello del
calendario") e dello storico degli obiettivi, per la terza volta. Vale la regola generale: **quello che l'app deduce nel momento in cui
succede va salvato; quello che ricalcola a ogni lettura può riscrivere la
storia.**

### I pasti: proposti dall'ora, sempre modificabili

Decisione presa dopo i mockup, e ha conseguenze sul modello dati.

**Il pasto è proposto, mai imposto.** Quando apri l'inserimento, l'app guarda
l'ora e propone il pasto corrispondente: alle 11 propone lo spuntino del
mattino. Ma il titolo della pagina è toccabile e apre l'elenco dei pasti della
giornata, perché il caso normale è proprio quello in cui l'ora non aiuta: mangi
senza telefono e registri spuntino e pranzo la sera.

Per lo stesso motivo, **una voce già inserita si può spostare di pasto**: tap
sulla voce in Oggi → lo sheet quantità, con anche il pasto modificabile.

**La struttura dei pasti è dell'utente, non dell'app.** Chi segue una dieta ha
"Pranzo 1" e "Pranzo 2", o tre spuntini. Quindi i pasti non sono quattro valori
fissi nel codice: sono righe di una tabella, che l'utente può rinominare,
aggiungere, eliminare e riordinare da Impostazioni > Pasti e orari *(dal
9/10 rinominare, cambiare l'ora, aggiungere ed eliminare: "Pasti e orari"
più sotto; le date future arrivano al passo 5)*.

Ogni pasto ha **solo un'ora di inizio**, non un intervallo: dura fino all'inizio
del pasto successivo, e l'ultimo arriva fino a mezzanotte. Un campo invece di
due, e per costruzione niente buchi e niente sovrapposizioni. Fra mezzanotte
e l'inizio del primo pasto l'app propone il primo pasto (alle 00:30 la
Colazione), perché il giorno è quello del calendario (sezione 4): proporre
la Cena metterebbe la voce nella Cena di stasera, non ancora mangiata.

Set predefinito creato alla registrazione:

| Pasto | Inizia alle |
|---|---|
| Colazione | 06:00 |
| Spuntino mattina | 10:00 |
| Pranzo | 12:30 |
| Spuntino pomeriggio | 16:00 |
| Cena | 19:30 |

In Oggi si vedono **tutti i pasti, anche quelli vuoti** (con "—"). Nasconderli
accorcerebbe la pagina, ma farebbe ballare le posizioni: sapere che la Cena sta
sempre in quel punto vale più dello spazio risparmiato.

**L'ordine segue l'orario** (deciso il 2026-10-07). Lista di Oggi, titolo di
Aggiungi, fogli di Sposta e Duplica e "primo pasto vuoto" mettono i pasti in
ordine di `ora_inizio`, confrontata sui primi 5 caratteri ("12:30" e
"12:30:00" sono la stessa ora, il secondo formato arriva da Postgres). Fra
due pasti alla stessa ora decide `ordine`, poi l'id. Riordinare vuol dire
cambiare l'ora. Al passaggio, il 9/10, per tutti e tre gli utenti l'ordine
per `ordine` e quello per ora coincidevano: nessuno ha visto cambiare niente.

#### I pasti di un giorno (validità, dal 9/10)

Ogni riga di `pasti` ha un periodo, `valido_dal` / `valido_al` (sezione 4),
**confini inclusi**, null = da sempre / per sempre. **Un pasto vale nel
giorno D** se non è cancellato e D sta nel suo periodo
(`src/lib/pasti/validitaPasti.ts`, con i suoi test). Le date le scrive
la pagina Pasti e orari, con la domanda "da quando" (sotto); le righe
nate prima hanno le date vuote.

Ogni schermata chiede i pasti del **suo** giorno:
- **Oggi**: il giorno mostrato. Se in quel giorno non vale nessun pasto, la
  lista dice "Nessun pasto in questo giorno."; "Preparo i tuoi pasti…" e
  "Serve la connessione" restano per il solo caso in cui l'utente non ha
  nessuna riga (primo avvio, sezione 9.2);
- **Aggiungi**: il giorno in cui si registra. Fra quei pasti si propone
  quello dell'ora (solo se è oggi) o il primo vuoto (giorni passati);
- **sheet della voce e Sposta**: il giorno della voce;
- **Duplica**: il **giorno di destinazione**. L'elenco cambia quando cambia
  la data. Se quel giorno il pasto d'origine non esiste, nessuna
  preselezione: "Scegli un pasto", e Duplica resta spento finché non si
  sceglie (copiare nel pasto sbagliato senza accorgersene è peggio di un
  tocco in più). `duplicaNelPasto` ricontrolla al momento della scrittura;
- **trascinamento**: i bersagli sono solo i pasti validi a schermo.

**Rete di sicurezza.** In Oggi, nel giorno D, si vedono i pasti validi in D
**più ogni pasto che ha voci vive in D**, anche se fuori dal suo periodo o
cancellato. Senza, quelle voci sparirebbero dalla lista ma resterebbero nei
totali, e i numeri non tornerebbero. Un pasto così:
- sta al suo posto per orario, con il suo nome e sotto, in piccolo, "Non più
  in uso";
- **non riceve voci**: non è una destinazione di Sposta, Duplica e
  trascinamento. Da lì le voci si possono solo portare via;
- nello sheet della voce, il menu "Pasto" lo mostra fra le opzioni come
  "Merenda · non più in uso", accanto ai pasti validi. Il valore del menu è
  quindi sempre fra le opzioni: senza, il browser ne mostrerebbe un altro
  mentre "Salva" lascerebbe la voce dov'era.

Rimandato: le voci il cui pasto non c'è proprio sul dispositivo (`pasto_id`
null, o un pasto non ancora scaricato) non hanno una riga in Oggi. Un gruppo
"Senza pasto" si farà più avanti; su Supabase il 7/10 non ce n'erano.

#### Pasti e orari (dal 9/10, passo 3)

Impostazioni > Alimentazione > **Pasti e orari** (`/impostazioni/pasti`;
mockup `docs/mockups/pasti-e-orari.html`, elenco "A · Righe"). Passo 3:
rinominare, cambiare l'ora, aggiungere; passo 4: **Elimina** (sotto). Le
**date future** ("Da una data", schede per data) sono il passo 5.

- **Elenco**: i pasti che valgono **oggi**, in ordine d'orario, nome a
  sinistra e ora a destra; in fondo "+ Aggiungi pasto". Un pasto chiuso
  qui non compare (in Oggi resta visibile con la rete di sicurezza).
- **Tocco su un pasto** → sheet con Nome e "Inizia alle", Salva e Annulla:
  - cambia **solo l'ora** → la domanda (passo 5): **Subito** (già scelto:
    si scrive sulla riga di oggi, in tutti i suoi giorni, passati
    compresi) o **Da una data** ("Fino a dom 11 ott inizia alle 12:30.").
    Senza giorni futuri da scegliere (pasto nato oggi, o che finisce oggi)
    niente domanda: si scrive subito;
  - cambia **il nome** → la domanda "da quando vale?": **Correggi** ("Vale
    anche per i giorni passati"), **Da oggi** ("Fino a ieri resta
    «Pranzo»") o **Da una data** ("Per un cambio dieta già deciso. Fino a
    dom 11 ott resta «Pranzo»."), con Da oggi già scelto (non riscrive il
    passato). Nome e ora si scrivono **insieme, dopo la risposta**:
    "Indietro" torna ai campi senza aver scritto niente;
  - **niente domanda**, si corregge e basta, se cambiano solo maiuscole o
    spazi ("pranzo" → "Pranzo" è lo stesso nome), o se il pasto è nato
    oggi (`valido_dal` oggi o dopo): chiuderlo "da oggi" lo lascerebbe
    senza giorni, come per gli obiettivi.
- **Da oggi** (modello C, sezione 4), in **una transazione Dexie** (tutto o
  niente, coda outbox compresa): riga nuova (id nuovo, nome nuovo, stessa
  ora o quella nuova, stesso `ordine`, `valido_dal` oggi, `valido_al` quello
  della vecchia), le **voci vive da oggi in poi** passano alla riga nuova,
  comprese quelle dei giorni futuri già pianificati (niente pasto nuovo
  vuoto accanto a un "Non più in uso" con le voci), la riga vecchia si
  chiude ieri. Che il pasto nuovo arrivi al server prima delle
  voci lo garantisce l'ordine della coda (sezione 9.2).
- **+ Aggiungi pasto**: nome e ora (nessuna ora proposta), poi "**Anche nei
  giorni passati**" (`valido_dal` null: compare vuoto anche nei giorni già
  registrati) o "**Da oggi**". `ordine` = il più alto fra tutte le righe,
  cancellate comprese, più uno.
- **Controlli**, nell'app e non sul server (un vincolo violato bloccherebbe
  la coda): nome con gli spazi tolti, non vuoto, **senza distinguere
  maiuscole**; nome e ora diversi da ogni altro pasto vivo che ha **almeno
  un giorno in comune** (non solo oggi: servirà così com'è al passo 5).
  Errori sotto il campo ("Alle 12:30 inizia già Pranzo."); se il pasto che
  occupa l'ora oggi non c'è, lo dice ("iniziava già Merenda (fino all'8
  ott)"). L'ora si controlla solo se cambia. Nella domanda, una scelta che
  violerebbe i controlli è spenta con il motivo (es. Correggi con un nome
  che nei giorni passati c'è già). Le scritture rifanno i controlli: se una
  sync ha cambiato i pasti nel frattempo, l'errore torna sotto il campo.
  `src/lib/pasti/controlliPasti.ts`.
- La pagina **scrive sempre** `valido_dal` e `valido_al` esplicite, anche
  null, sulle righe che crea o modifica.
- **Annulla** nella barra in basso, come nel diario, con una fotografia
  (`src/lib/repository/modifichePasti.ts`); mai una riga rimessa in vita:
  ora e Correggi rimettono i valori di prima; Da oggi cancella la riga
  nuova (`deleted_at`), riapre la vecchia e riporta sul pasto vecchio le
  voci da quel giorno in poi che stanno sul nuovo, anche quelle arrivate
  nel frattempo (la fotografia vive solo in memoria, nella barra); Aggiungi cancella la riga nuova, ma **non** se nel frattempo
  ha delle voci ("Non annullato: il pasto ha già delle voci."). Arrivato
  dopo la sync, l'Annulla è una scrittura in avanti come le altre.
- **Aggiungi alimento** ricontrolla, prima di scrivere una voce, che il
  pasto scelto valga quel giorno (`pastoValidoAdesso`): Pasti e orari in
  un'altra scheda può averlo chiuso.
- Ogni azione si salva alla conferma: niente guardiano delle modifiche.

**Elimina pasto** (dal 9/10, passo 4). In fondo allo sheet del pasto.
- **Almeno un pasto in ogni giorno** (`periodoCoperto`, `regoleElimina`
  in `controlliPasti.ts`). Il pulsante è spento, con il motivo sotto ("È
  l'unico pasto: almeno uno deve restare."), se da oggi in poi qualche
  giorno del pasto resterebbe senza pasti; "Anche nei giorni passati" è
  spento ("Alcuni giorni passati resterebbero senza pasti.") se resterebbe
  un buco nel passato, per esempio dopo una catena di rinomine. Da un
  giorno senza pasti non si registra niente.
- **Domanda "da quando"**: "Anche nei giorni passati" ("Sparisce ovunque,
  insieme alle sue voci.") o "Da oggi" ("I giorni passati restano come
  sono." + "Le voci di oggi vengono eliminate." se ha voci solo oggi, "Le
  voci da oggi in poi vengono eliminate." se ne ha anche nei giorni
  futuri), con Da oggi già scelto. Un pasto che comincia oggi o dopo si elimina del tutto,
  **senza domanda**.
- **Le voci si eliminano, non si spostano**: "anche nei giorni passati" →
  `deleted_at` sul pasto e su tutte le sue voci vive; "da oggi" →
  `valido_al` = ieri sul pasto e `deleted_at` sulle voci vive da oggi in
  poi (anche i giorni futuri: il diario arriva a oggi + 7). La
  tabella `giorni` non si tocca. Tutto in una transazione
  (`eliminaPasto` in `modifichePasti.ts`).
- **Conferma prima**, solo se l'eliminazione tocca almeno una voce:
  "Eliminare anche 13 voci?" — "«Pranzo» ha 13 voci in 9 giorni, per
  8.420 kcal. Verranno eliminate e i totali di quei giorni scenderanno." —
  pulsante rosso "Elimina pasto e 13 voci". Da oggi: "ha 1 voce oggi … i
  totali di oggi" se sono tutte di oggi, "ha 3 voci in 3 giorni, da oggi in
  poi, per … i totali di quei giorni" se ce ne sono nei giorni futuri. Senza "Non si può annullare"
  del mockup: dopo c'è la barra con Annulla. Kcal con `totaleVoce` (le voci
  hanno i valori copiati). La conferma vale per le voci viste: se una sync
  le cambia prima della scrittura, non si scrive niente e la conferma si
  ripresenta con i numeri nuovi. Il pulsante resta spento finché le voci
  del pasto non sono state lette.
- **Barra**: "Eliminato: Pranzo (13 voci)", "Eliminato da oggi: Cena (1
  voce di oggi)", "Eliminato da oggi: Cena (3 voci da oggi in poi)",
  "Eliminato: Spuntino pomeriggio".
- **Annulla**, mai una riga rimessa in vita: "anche nei giorni passati"
  **ricrea** il pasto con id UUID v5 dall'id vecchio (stessi nome, ora,
  ordine, date) e le voci su di lui (`annullaOperazione` con
  `pastoSostituito`); "da oggi" rimette la data di fine e ricrea le voci
  da oggi in poi sullo stesso pasto, ciascuna nel suo giorno. Rifà i controlli di nome e ora: se nel
  frattempo è nato un pasto con lo stesso nome o la stessa ora, non scrive
  niente e la barra dice perché ("Non annullato: alle 12:30 inizia già
  Brunch."). Ripetuto, non crea doppioni (id v5). In coda il pasto
  ricreato parte prima delle sue voci (sezione 9.2).
- Una voce aggiunta da un altro telefono non ancora allineato su un pasto
  eliminato o chiuso resta viva sul server: in Oggi la mostra la rete di
  sicurezza ("Non più in uso"), da lì la si porta via.

**Date future e cambi programmati** (passo 5, deciso il 10/10, provato su
iPhone il 10/10, sezione 11: la logica pura,
`src/lib/pasti/cambiProgrammati.ts`, le scritture con i loro Annulla,
`src/lib/repository/modifichePasti.ts`, la domanda "da quando" con la
data e le schede per data nella pagina).
- **Il campo "Dal giorno"** compare sotto "Da una data" quando la si
  sceglie (`SheetDaQuando`, campo `.campo-data` come in Duplica). La data
  la tiene la pagina, che la ricontrolla a ogni cambio
  (`erroreDataDaUnaData`, più i controlli di nome e ora per quel giorno):
  se non va, il messaggio è sotto il campo ("Scegli un giorno fra dom 11
  ott e mar 13 ott.") e il pulsante è spento. Sotto il campo c'è anche il
  cambio già programmato che fissa il massimo ("Il mar 13 ott è già
  programmato un cambio: scegliendo quel giorno lo modifichi."). Conferma
  di Elimina: "«Pranzo» ha 2 voci in 2 giorni, dal lun 12 ott, per …".
  Barra: "Programmato dal lun 12 ott: Pranzo → Pranzo 1" (con "alle 14:30."
  se cambia anche l'ora), "Programmato dal lun 12 ott: Cena, inizierà alle
  20:00.", "Programmato dal lun 12 ott: Merenda, alle 16:30.",
  "Programmato: Pranzo non ci sarà più dal lun 12 ott (2 voci).", "Cambio
  del lun 12 ott modificato: Pranzo 2, alle 12:30." (stessa data).
Mockup: `docs/mockups/pasti-e-orari.html`, "A · Righe" e "2 · Schede per
data".
- **"Da una data"**: terza scelta della domanda "da quando" per
  rinominare, aggiungere ed eliminare. Solo date future, da domani, **senza
  limite massimo** (il limite dei 7 giorni riguarda solo le voci del
  diario), salvo un cambio già programmato su quel pasto: la data arriva al
  massimo al giorno di quel cambio, se il pasto continua (la stessa data
  modifica il cambio già programmato), o al suo ultimo giorno, se da lì
  non c'è più. Oltre, il pasto ha già un altro nome o non esiste. Un pasto
  nato oggi o dopo resta senza domanda (si corregge, o si elimina del
  tutto). La data proposta è il prossimo lunedì.
- **L'orario segue la data, come il nome**: ogni riga del filo (sezione 4,
  "pasti": `ordine` è il filo) ha il suo orario. Cambiando **solo l'ora**
  compare la domanda con due scelte: **Subito** (si scrive sulla riga
  valida oggi, in tutti i suoi giorni, passati compresi, fino al prossimo
  cambio programmato; le righe future del filo tengono la loro ora) o
  **Da una data**. Una rinomina "da una data" che cambia anche l'ora
  porta nome e ora nuovi da quel giorno; fino al giorno prima resta tutto
  com'era ("Pranzo" alle 12:30 fino al 12, "Pranzo 1" alle 14:30 dal 13).
  Così fa anche la rinomina "da oggi": la riga vecchia tiene la sua ora
  *(fino al passo 5 prendeva anche lei l'ora nuova)*.
  L'ordine nei giorni passati e futuri segue l'ora delle righe valide quel
  giorno (`pastiValidiIl`, già così).
- **Ogni cambio "da D"** è un taglio del filo al giorno D:
  - rinomina o ora da D: la riga valida il giorno D si chiude a D−1, ne
    nasce una dello stesso filo da D (fino alla vecchia fine), e le voci
    da D in poi passano su quella nuova. Se una riga del filo comincia già
    il giorno D, si corregge quella (la stessa data modifica il cambio);
  - elimina da D: la riga che contiene D−1 si chiude lì, le righe del
    filo che cominciano da D in poi si cancellano, e le voci del filo da D
    in poi si cancellano, con la conferma (voci / giorni / kcal) e il
    segno `eliminata_dal_cambio` (sezione 4, `voci_diario`). "Da oggi" è
    lo stesso taglio con D = oggi: anche lui taglia tutto il filo, così
    una rinomina programmata non fa ricomparire il pasto;
  - aggiungi da D: una riga nuova con `valido_dal` = D e un `ordine`
    nuovo. Non tocca voci.
- **Controlli** come sempre, sul periodo della riga che si scrive:
  `erroreNome` ed `erroreOra` contro le righe vive con giorni in comune
  (le righe di uno stesso filo non si sovrappongono mai), messaggio
  "inizierà … (dal …)", `periodoCoperto` (nessun giorno resta senza pasti).
- **Schede per data**: se c'è almeno un cambio programmato, in cima
  compaiono "Oggi" e una scheda "Dal lun 12 ott" per ogni data con cambi,
  calcolate dalle righe (niente di salvato: quando la data arriva la
  scheda sparisce da sola, con `useGiornoCorrente`; se era quella scelta,
  si torna a "Oggi", come quando si annulla il suo ultimo cambio). Con le
  schede, l'elenco di oggi ha il titolo "Oggi, sab 10 ott". Una scheda
  futura (`VistaDataFutura`) mostra la nota "Così saranno i tuoi pasti dal
  lun 12 ott. Si modificano dalla scheda Oggi.", i pasti come saranno quel
  giorno (righe da leggere, senza freccia) con "nuovo", "nome nuovo" o
  "ora nuova" + "prima: …", "Non ci sarà più: …", e i cambi di quella data
  (`RigaCambio`): "Pranzo → Pranzo 1" (sotto "nome nuovo", o "nome nuovo,
  alle 14:30"), "Pranzo 12:30 → 14:30" ("ora nuova"), "Nuovo pasto:
  Merenda" ("inizia alle 16:30"), "Pranzo non ci sarà più" ("4 voci
  eliminate, dal lun 12 ott al gio 15 ott", "1 voce eliminata, del lun 12
  ott", o senza voci "i giorni prima restano come sono": le voci col segno
  di quel cambio, `vociEliminateDalCambio`), ciascuno con **Annulla**.
  Barra dopo: "Cambio annullato: Pranzo → Pranzo 1", "Cambio annullato:
  Cena (tornano 3 voci)", senza un altro Annulla (il cambio si
  riprogramma da "Oggi"); o il motivo ("Non annullato: …", "Il cambio era
  già annullato."). Le schede future non si modificano: si modifica sempre
  da "Oggi". Tutta la pagina usa l'oggi di `useGiornoCorrente`, non solo
  le schede.
- **Annulla**: quello della **barra**, subito dopo, usa la fotografia in
  memoria come oggi (rimette anche le righe del filo tagliate). Quello
  della **scheda** lavora sulle righe, quindi anche giorni dopo, e rifà i
  controlli di nome e ora ("Non annullato: …"):
  - rinomina o ora: la riga vecchia riprende la fine di quella nuova, le
    voci della nuova tornano sulla vecchia, la nuova si cancella;
  - elimina: la riga si riapre (senza fine) e **tornano le voci col segno
    di quel cambio, cercate in tutto il filo** (anche quelle che stavano
    su una rinomina programmata tagliata), ricreate sulla riga riaperta
    (sono tutte dal giorno del cambio in poi, quindi ancora future: una
    scheda esiste solo finché la sua data non arriva), senza il segno; una
    voce già viva o già ricreata si salta, e una cancellata a mano non ha
    il segno e non torna. Non tornano le righe del filo tagliate (nessuna riga rimessa in
    vita);
  - nuovo: la riga si cancella, ma non se ha già delle voci.
- **Due telefoni**: le righe nuove si sommano senza problemi; se tutti e
  due modificano la stessa riga, vince l'ultima scrittura e possono
  restare due righe dello stesso filo valide negli stessi giorni (due pasti
  in Oggi). I controlli stanno nell'app, il server non può impedirlo: si
  sistema a mano con Elimina.
- **Limite noto** (sezione 11, "Difetti e verifiche aperti"): il Salva dei
  campi controlla nome e ora con le regole "da oggi", prima della domanda.

### Inserimento retroattivo

**Si deve poter registrare anche i giorni passati.** Non è un caso limite: è la
sera in cui recuperi la giornata, o il rientro dopo un weekend senza telefono.

- **La data in cima a Oggi è navigabile**: frecce per il giorno prima e dopo,
  tap sulla data per il calendario. Quando non sei su oggi, un modo evidente per
  tornarci
- **Il diario arriva fino a 7 giorni da oggi** (deciso il 10/10; prima si
  fermava a oggi). Chi prepara il pranzo la sera prima, o la domenica quelli
  di tutta la settimana, registra le quantità subito nel giorno giusto invece
  che nelle note del telefono. Il limite è **oggi + 7, incluso**, calcolato
  sull'orologio locale come il resto (alle 00:30 si è già spostato), in una
  costante sola: `GIORNI_FUTURI_DIARIO` e `ultimoGiornoDiario` in
  `src/lib/dataGiorno.ts`. Vale per frecce, swipe, calendario (che ignora
  una data digitata oltre il massimo), `?giorno=` di Oggi e Aggiungi (oltre
  il limite si ripiega su oggi) e Duplica (`dataScrivibile`, ricontrollata
  prima di scrivere). Riguarda **solo le voci del diario**: non le date dei
  pasti in Pasti e orari, non il peso
- **Quando il giorno cambia, Oggi va sul nuovo oggi** (deciso il 10/10),
  qualunque giorno stesse mostrando: a mezzanotte con l'app aperta, o
  riaprendola il giorno dopo (su iPhone l'app installata torna dal
  multitasking senza ricaricarsi). `useGiornoCorrente`
  (`src/lib/useGiornoCorrente.ts`): un timer fino alla mezzanotte locale e
  il ritorno in primo piano (`visibilitychange`), perché in background
  iOS sospende i timer. **Un foglio aperto si chiude e il salto è subito**
  (sheet della voce, "Salva come pasto", menu, Sposta, Duplica; quello che
  si stava scrivendo si perde, come toccando fuori): Sposta, Duplica ed
  "Elimina tutto il pasto" leggono il giorno mostrato alla conferma, e un
  foglio rimasto aperto sopra il giorno nuovo le farebbe agire sulle voci
  di un altro giorno. Solo un trascinamento in corso si lascia finire
  (dura finché il dito è giù, e il rilascio agisce sul giorno da cui è
  partito): il salto viene subito dopo. All'apertura da zero la pagina
  parte già da oggi
- **I giorni futuri non hanno un segno "pianificato"** (deciso il 10/10):
  bastano la data in alto e il pulsante "Oggi". La riga sotto la data è
  quella dei giorni passati ("X di Y kcal"); "Rimangono X kcal" resta solo
  per oggi
- **Medie e grafici contano solo i giorni fino a oggi** (`eFuturo` in
  `dataGiorno.ts`): una voce pianificata per domani non deve abbassare la
  media di una settimana che non è ancora finita
- **Sui giorni passati e futuri il pasto non si indovina dall'ora** — sarebbe
  sempre sbagliato. Il pulsante "+ Aggiungi" propone il **primo pasto ancora
  vuoto** di quella giornata, perché stai completando; se sono tutti pieni,
  l'ultimo della lista. E come sempre il titolo è toccabile. Sui giorni futuri
  `consumato_alle` resta vuoto, come sui passati
- **Un giorno futuro si classifica alla prima voce**, come gli altri (sezione
  3, "La trappola"): il tipo (normale/allenamento) si fissa quando pianifichi,
  e se poi cambi la settimana tipo quel giorno resta com'era. Si cambia dalla
  pastiglia
- Vale anche per il peso: `misurazioni` ha la sua data, si registra un peso di
  ieri come uno di oggi

Nessuna modifica allo schema: `voci_diario` ha già `data` (il giorno a cui il
pasto appartiene) e `creato_il` (quando l'hai scritto). Sono due cose diverse
proprio per questo — una voce inserita stasera per ieri ha `data` = ieri e
`creato_il` = oggi.

**Conseguenza sull'architettura: i totali giornalieri non si memorizzano mai.**
Niente colonna "kcal del giorno" da tenere aggiornata. Si ricalcolano sempre
dalle voci, che in locale su IndexedDB è istantaneo. Un totale memorizzato
diventerebbe sbagliato ogni volta che tocchi un giorno passato — ed è il tipo di
bug che si nota sei mesi dopo, guardando un grafico che non torna.

---

## 4. Modello dati (11 tabelle sincronizzate, più 3 solo online per Amici)

Progettate per il quadro completo, anche se in V1 se ne usa metà. **Creare una
tabella non vuol dire costruire la feature**: alcune restano vuote finché non
serviranno, ma la loro forma condiziona le altre e va decisa adesso.

**`profili`** — dati utente e anagrafica corporea
- `sesso` (con valore "non indicato"), `data_nascita`, `altezza_cm`,
  `livello_attivita`
- `differenzia_giorni` (bool, default false) e `giorni_allenamento_default`
  (quali giorni della settimana)
- sono gli ingredienti del calcolo del fabbisogno, non dati decorativi
- **`livello_attivita` è `NOT NULL` su Supabase** (gli altri tre campi
  anagrafici no): un profilo non si crea senza. Il motivo è il bug del 6/9:
  i tipi non lo riflettevano, il salvataggio riusciva in locale ("Salvato."
  a schermo) e la sync verso Supabase falliva in silenzio. Da allora
  `validaModulo` lo pretende prima di scrivere `profili`, anche quando il
  Salva parte dai giorni di allenamento. In Dexie non c'è nessun vincolo
  (solo indici): il limite è del database. Toglierlo vorrebbe dire
  `ALTER COLUMN livello_attivita DROP NOT NULL`, con la checklist A di
  CLAUDE.md (una migration versionata, `get_advisors`, `tipi.ts` con
  `LivelloAttivita | null` e ogni lettura con il suo ripiego). Deciso il
  3/10 di lasciarlo così

**`obiettivi`** — **lo storico dei periodi**, non un valore singolo
- `valido_dal`, `tipo` (dimagrire / mantenere / massa), `peso_obiettivo` (nullable)
- un **cambio vero** di obiettivo **non modifica** la riga esistente: ne
  inserisce una nuova. Una **correzione** (un refuso) aggiorna invece il periodo
  in corso, senza aprire nello storico uno stacco mai avvenuto — la scelta la fa
  l'utente al Salva del Profilo (sezione 3, "Un solo Salva")
- un giorno **precedente a tutti i periodi** prende il periodo più vecchio: il
  primo periodo vale "da sempre" (decisione del 2026-09-26). È una regola di
  lettura in `obiettivoValidoPer`, non una data finta scritta nei dati; serve
  perché in Oggi si registrano anche giornate a ritroso, prima del giorno in cui
  si è impostato il primo obiettivo. Prima di questa decisione quei giorni
  restavano senza target
- vedi "Estensioni future" più sotto: è la cosa che non si può recuperare dopo

**`obiettivi_target`** — i target di un periodo, **uno per tipo di giorno**
- `obiettivo_id`, `tipo_giorno` (testo: "normale", "allenamento", ...), `kcal`,
  `proteine`, `carboidrati`, `grassi`
- senza la differenziazione attiva esiste una sola riga per periodo, con
  `tipo_giorno = 'normale'`: la tabella c'è ma non si nota
- **i tipi di giorno sono queste righe**, non un elenco fisso nel codice: un
  terzo set di target è una riga in più, non una migration
- perché separata da `obiettivi` invece di aggiungere una colonna: il periodo ha
  cose che non dipendono dal giorno (il peso obiettivo). Duplicarle su due righe
  significa poterle aggiornare su una sola e dimenticare l'altra
- **fallback quando manca la riga per il tipo scritto**: dal Salva unico
  (2026-09-26) un periodo nuovo nasce già con la riga "allenamento" se la
  differenziazione è attiva, ma la riga può mancare ancora — periodi creati
  prima, o differenziazione accesa senza mai toccare i target di allenamento —
  e intanto un giorno può già essere
  scritto o proposto come "allenamento". In quel caso si usa il target
  "normale" dello stesso obiettivo, che esiste sempre per costruzione. Non è
  un ripiego silenzioso: se la differenziazione è attiva e succede, va
  segnalato (oggi: `console.error`) — e la pastiglia in Oggi non deve mai
  mostrare un tipo per cui il target non esiste (mostrerebbe "Allenamento"
  sopra a dei numeri che sono in realtà quelli di "Normale"). La
  classificazione scritta in `giorni` non cambia per questo: torna a
  mostrarsi da sola appena il target mancante viene aggiunto

**`giorni`** — la classificazione della giornata
- `data`, `tipo_giorno`
- `data` è il **giorno del calendario** (sezione "Il giorno è quello del
  calendario"), la stessa convenzione di `voci_diario.data`. Un inserimento
  fatto all'una di notte classifica il giorno del calendario, coerentemente
  con la voce che quell'inserimento scrive. Le righe scritte prima del 2/10
  con la regola del giorno logico restano come sono
- riga **sparsa**: esiste solo per le giornate effettivamente classificate. Il
  valore nasce dal pattern settimanale del profilo, ma **viene scritto** appena
  la giornata riceve la prima voce (vedi "La trappola" nella sezione 3)
- è l'unica tabella che rappresenta un giorno: prima i giorni esistevano solo
  implicitamente, come `data` sulle voci di diario
- vincolo unico su Supabase, `(user_id, data) WHERE deleted_at IS NULL`: due
  righe per lo stesso giorno sarebbero un errore di modello, non un dettaglio
  estetico. L'id di ogni riga è per questo un UUID v5 deterministico da
  utente + data (namespace proprio, non quello dei pasti predefiniti — vedi
  `src/lib/repository/giorni.ts`), così due dispositivi offline che
  classificano indipendentemente lo stesso giorno (prima voce su uno,
  pastiglia sull'altro, prima di essersi mai sincronizzati) producono la
  stessa riga invece di scontrarsi contro il vincolo

**`pasti`** — le fasce della giornata, **una riga per utente per pasto**
- `nome` ("Colazione", "Pranzo 1"), `ora_inizio`, `ordine`. Dal 9/10 i
  pasti si ordinano per `ora_inizio`; `ordine` decide solo fra due pasti
  alla stessa ora (sezione 3, "I pasti")
- creata alla registrazione con il set predefinito, poi modificabile dall'utente
- è la tabella che rende possibile "Pranzo 1 / Pranzo 2" senza toccare il codice
- **`valido_dal`, `valido_al`** (`date`, nullable, nessun default;
  migration `pasti_validita` applicata il 9/10, advisors invariati): il
  periodo in cui il pasto esiste, **confini inclusi**. Null vuol dire da
  sempre / per sempre, ed è il valore di tutte le righe esistenti. Un
  cambio "da una data" chiude la riga vecchia (`valido_al` = il giorno
  prima) e ne apre una nuova (`valido_dal` = quel giorno): modello C
  dell'analisi del 7/10. Su Dexie (`version(6)`) i due campi sono
  facoltativi: una riga salvata prima non ha la chiave e vale da sempre
- **chiave assente o null nell'upsert: chiuso il 9/10 senza prova su
  Supabase.** Secondo la documentazione di postgrest-js, l'upsert di una
  riga sola aggiorna solo le colonne presenti: una riga senza le due chiavi
  lascerebbe intatte le date sul server, una chiave con null le azzera. Il
  dubbio riguardava un client vecchio che manda una riga senza chiavi, e
  oggi non c'è: tutti i telefoni sono alla build `66c25f1`, e la pagina
  Pasti e orari scrive sempre le due date in modo esplicito, anche null,
  su ogni riga che crea o modifica. L'unico altro punto che scrive `pasti`
  è il seed, che parte solo con il server vuoto
- **nessun `CHECK` e nessun indice unico**, nemmeno `valido_dal <=
  valido_al`: un vincolo violato blocca in silenzio la coda outbox (lo
  stesso motivo per cui il 20/9 è stato tolto `pasti_user_nome_idx`). I
  controlli stanno nell'app. Una riga con le date invertite non vale in
  nessun giorno: resta invisibile, salvo i giorni in cui ha voci
- **`ordine` è il FILO del pasto** (regola del 10/10, passo 5). Per
  l'utente "Pranzo" è un pasto solo anche quando diventa più righe, una per
  periodo ("Pranzo" fino al 12, "Pranzo 1" dal 13): le righe di uno stesso
  filo hanno lo stesso `ordine`. Rinominare o cambiare l'ora "da un giorno"
  lo copia sulla riga nuova; un pasto aggiunto ne prende uno mai usato
  (`prossimoOrdine`: il più alto fra tutte le righe, cancellate comprese,
  più uno). Su `ordine` di una riga esistente **non si scrive mai**. Così i
  cambi programmati si riconoscono dalle righe senza una colonna in più
  (`src/lib/pasti/cambiProgrammati.ts`): riga A che finisce il giorno D−1 e
  riga B dello stesso filo che comincia il giorno D = dal giorno D il
  pasto cambia (nome o solo ora); nessuna riga che continua = dal giorno D
  non c'è più; una riga che comincia dopo oggi senza niente prima = pasto
  nuovo. In produzione il 10/10 era già così per tutti e tre gli utenti.
  Limite noto: due telefoni offline che aggiungono un pasto insieme
  possono dare lo stesso `ordine` a due pasti diversi; si confonderebbero
  solo se uno finisse il giorno prima di quello in cui l'altro comincia (la
  scheda mostrerebbe una rinomina invece di "elimina + nuovo")

**`alimenti`** — il catalogo
- nome, marca, `barcode`
- `marca` è facoltativa: serve a distinguere due prodotti con lo stesso nome
  e valori diversi ("Yogurt magro" di due marche). Dove un alimento compare
  in un elenco (ricerca, recenti, preferiti) e la marca c'è, si mostra
  "Nome · Marca" (`etichettaAlimento` in `src/lib/repository/alimenti.ts`).
  Nel diario no: `voci_diario` copia solo il nome
- valori per 100 g: kcal, proteine, carboidrati, grassi
- campi già previsti anche se non mostrati in V1: zuccheri, fibre, saturi, sale
- `porzione_default_g`
- `fonte` (manuale / etichetta / barcode / off / ai / ricetta)
- `verificato`

**`voci_diario`** — la riga di diario
- riferimento all'alimento, `quantita_g`, `data`
- **`pasto_id`** che punta a `pasti` — non più un enum fisso
- **`gruppo_id`** (nullable): le righe inserite insieme da un pasto salvato o da
  una ricetta condividono lo stesso valore. Serve a poterle annullare, spostare
  o cancellare come un blocco solo
- `creato_il`: l'ora reale dell'inserimento, quella che ha fatto proporre il
  pasto. Serve a distinguere "l'app ha indovinato" da "l'utente ha corretto"
- **`consumato_alle`** (nullable): l'ora a cui hai *mangiato*, che è un'altra
  cosa. Precompilata con l'ora corrente e modificabile nello sheet, mai chiesta
  *(la modifica nello sheet non è ancora costruita: oggi il campo si
  riempie con l'ora corrente solo quando si registra per il giorno in corso,
  altrimenti resta vuoto)*.
  Su un inserimento retroattivo `creato_il` è stasera e `consumato_alle` è
  l'ora di ieri a cui hai cenato
- **copia dei valori nutrizionali al momento dell'inserimento**: se un alimento
  viene corretto nel catalogo, la storia passata non deve cambiare
- **`eliminata_dal_cambio`** (`uuid`, nullable, nessun default, nessun
  vincolo né indice; migration `voci_eliminata_dal_cambio`, testo in
  `supabase/migrations/voci_eliminata_dal_cambio.sql`, applicata il 10/10
  e verificata: colonna presente col suo commento, RLS attiva, advisors
  senza avvisi nuovi. Su Dexie `version(7)`, stessi indici della 6: il
  campo è facoltativo, una voce salvata prima non ha la chiave e vale
  null): il SEGNO di una voce cancellata da "Elimina pasto da una data" (o
  "da oggi", che è la stessa operazione). Lo scrive `eliminaPasto`
  (`src/lib/repository/modifichePasti.ts`) nella stessa scrittura di
  `deleted_at`; una voce ricreata da un Annulla nasce senza. Vale l'id del cambio,
  `idCambio(riga di pasti chiusa, data)` in `cambiProgrammati.ts`: UUID v5
  calcolato da riga e data, non salvato altrove. Null per le voci vive e
  per quelle cancellate in ogni altro modo, a mano comprese: quelle non
  tornano mai. Serve all'Annulla dalla scheda "Non ci sarà più", che
  ritrova le voci con quel segno in **tutto il filo** (stesso `ordine`,
  righe cancellate comprese: un taglio può aver cancellato anche una
  rinomina programmata con le sue voci) e le ricrea sulla riga riaperta

**`composizioni`** — un gruppo di alimenti con un nome
- `nome`, `tipo` (`pasto_salvato` | `ricetta`)
- un **pasto salvato** ("Colazione standard") si inserisce nel diario come N
  righe che condividono un `gruppo_id`
- una **ricetta** è la stessa cosa, più una riga in `alimenti` con
  `fonte = ricetta` e i valori per 100 g calcolati dagli ingredienti
- una tabella sola per due feature che il documento trattava separatamente

**`composizioni_voci`** — gli alimenti dentro una composizione, con le quantità

#### Alimenti cancellati (regola decisa il 2026-09-25)

**Cancellare un alimento vuol dire ritirarlo dal futuro, non dal passato.**
Il catalogo non è un archivio di alimenti esistenti: è la lista delle cose
che potresti rimangiare. Il diario è storia, e la storia non si tocca.
Corollario: se ho sbagliato i valori non cancello l'alimento, lo modifico.

In pratica: l'alimento cancellato sparisce da ricerca, recenti, preferiti e
pasti salvati, ma **resta nel diario**, dove ogni voce ha la sua copia dei
valori.

Strade scartate, da non riproporre:
- **B — cancellare = "non proporlo più", alimento ancora risolvibile per id.**
  Esiste per far sopravvivere l'alimento cancellato dentro i pasti salvati,
  ma un pasto salvato serve a inserire in futuro, e un alimento che non
  userai più non ha senso dentro uno stampo di inserimento futuro.
- **C — copiare i valori in `composizioni_voci`.** Cade per il corollario:
  correggere il Pane da 26 a 260 kcal non aggiornerebbe i pasti salvati che
  lo contengono. Oggi il pasto salvato punta all'id ed eredita i valori
  corretti, mentre il diario conserva le sue copie: è già giusto.

**Cascata sui pasti salvati** (`rimuoviAlimentoDaPastiSalvati` in
`src/lib/repository/composizioni.ts`; nata dal bug del 2026-09-22,
"Colazione fantasma": un pasto salvato con un solo alimento, poi cancellato
dal catalogo, restava tecnicamente esistente ma invisibile in Preferiti — il
nome non era più riusabile):
- resta almeno un altro alimento nel pasto → si cancella solo la riga di
  `composizioni_voci` di quell'alimento, il pasto resta con gli altri;
- era l'ultimo alimento del pasto → si cancella (logicamente, `deleted_at`)
  anche la composizione, altrimenti resta un guscio vuoto.

**L'app non decide più in silenzio.** Quattro comportamenti visibili:

1. **Avviso al salvataggio.** Salvare come preferito un pasto di giornata
   che contiene alimenti cancellati: lo sheet del nome mostra già
   all'apertura "Verrà salvato 1 alimento su 2. «test» non è più nel
   catalogo." — "Salva" conferma, "Annulla" non salva niente. Senza voci
   escluse l'avviso non compare. Il salvataggio (`salvaPastoComeComposizione`)
   riceve le voci annunciate come escluse e, rileggendo il catalogo, si
   rifiuta di salvare se nel frattempo non sono più quelle: l'avviso si
   aggiorna e serve un altro "Salva".
2. **Stella: confronto stretto.** La stella di un pasto in Oggi si accende
   solo se un pasto salvato riproduce esattamente l'elenco a schermo,
   alimenti cancellati compresi. Un pasto di giornata con un alimento
   cancellato non risulta mai salvato. Il filtro sugli alimenti cancellati
   vale solo dal lato del pasto salvato (che resta nascosto se non gli resta
   nessun alimento valido), mai dal lato del diario: filtrando un solo lato
   la stella direbbe "già salvato" per qualcosa che non riproduce ciò che
   l'utente vede.
3. **Contenuto già salvato: messaggio, non errore.** Conseguenza del punto
   2: la stella vuota invita a ripremere. Se le sole voci valide coincidono
   già con un pasto salvato (con qualunque nome: il confronto è sul
   contenuto), il tocco della stella non apre lo sheet e mostra una barra
   temporanea: "Hai già un pasto salvato «Cena». Non contiene «test», che non
   è più nel catalogo." Conseguenza accettata: da quella giornata non si può
   salvare lo stesso contenuto con un secondo nome. Lo stesso controllo è
   ripetuto nel salvataggio come rete di sicurezza (dati cambiati via sync
   con lo sheet aperto). L'errore di nome duplicato resta invariato in tutti
   gli altri casi. Quando vale il punto 3, l'avviso del punto 1 non compare.
4. **Annulla dopo la cancellazione.** Cancellato un alimento in Aggiungi,
   una barra in basso offre "Annulla" per qualche secondo (`BarraAnnulla`).
   Ripristina esattamente ciò che quella cancellazione ha toccato:
   l'alimento, le righe di `composizioni_voci` rimosse dalla cascata e i
   pasti salvati cancellati perché rimasti vuoti — né più né meno: una riga
   già cancellata prima non torna. Tutto logico (`deleted_at` di nuovo null)
   e via repository, così la sync lo propaga. Ordine: alimento, pasti
   salvati, righe — mai una riga viva che punta a qualcosa di cancellato.
   Non si ripristina: un pasto salvato vuoto se nel frattempo ne è nato un
   altro con lo stesso nome (lo dice la barra: niente doppione, niente nome
   inventato), né una riga il cui pasto salvato è stato cancellato durante
   la finestra. E, dal 16/10, nemmeno l'alimento se nel frattempo ne è
   nato uno uguale (stesso nome e marca, sezione 3, "Alimenti", "Mai due
   alimenti uguali"): con lui restano cancellate le sue righe, e il pasto
   salvato che senza di lui tornerebbe vuoto. Se l'utente non preme, la
   cancellazione resta. Lo stesso
   Annulla c'è in Impostazioni > Alimenti, anche dopo l'eliminazione di
   più alimenti insieme (sezione 3, "Alimenti").

Avviso (prima dell'azione, dentro lo sheet che già chiede conferma) e barra
(dopo l'azione, con la possibilità di tornare indietro) sono volutamente due
forme diverse: sono due momenti diversi. Test permanenti in
`src/lib/repository/composizioni.test.ts` ("regola Alimenti cancellati").

Da non confondere con la cancellazione di una **voce di diario** (togliere un
alimento dal pasto di una giornata): quella non tocca mai i pasti salvati,
sono due cancellazioni diverse su tabelle diverse — un pasto salvato è
un modello riutilizzabile, indipendente da quali giornate lo abbiano usato.

Per lo stesso motivo, il controllo "esiste già un pasto salvato con questo
nome" (`esisteComposizioneConNome`) non guarda solo la tabella `composizioni`:
usa la stessa regola di visibilità della sezione Preferiti
(`pastoSalvatoVisibile`/`pastiSalvati` in `src/lib/inserimento/pastiSalvati.ts`),
scritta una volta sola e riusata — le due cose non devono più poter
divergere.

**`misurazioni`** — peso e misure corporee
- `tipo` (peso / vita / fianchi / …), `valore`, `unita`, `data`
- **righe, non colonne**: aggiungere una misura in futuro è un inserimento,
  non una migration

**`preferiti`** — associazione utente / alimento. I pasti salvati **non** stanno
qui: stanno in `composizioni`. La sezione "Preferiti" della UI mostra l'unione
delle due cose, ma sono dati diversi

#### Le tabelle di Amici: solo online (decise il 15/10)

Stato delle migration: **`nomi_utente` applicata il 15/10** (versione
20261015175818, `apply_migration`; prove in un blocco annullato 20/20,
advisors solo con i WARN accettati in 9.6; tipo `NomeUtente` in
`tipi.ts`). **`amicizie` applicata il 15/10** (versione 20261015184017,
`apply_migration`; prove in un blocco annullato 90/90, advisors solo con i
WARN accettati in 9.6; tipo `Amicizia` in `tipi.ts`). Il trigger su
`auth.users` è applicato dal 16/10 (`trigger_registrazione` e
`registrazione_pulizia_codice`, 9.1). **`alimenti_condivisi` applicata
il 16/10** (versione 20261016180308, `apply_migration` da Cowork, branch
`condivisione-alimenti`; prove in un blocco annullato 150/150, con la
cascata di Elimina account; advisors: sicurezza solo i tre WARN
accettati in 9.6 per le funzioni nuove, performance solo "unused index"
sui due indici nuovi, a tabella vuota; tipo `AlimentoCondiviso` in
`tipi.ts`).

Tre tabelle per Amici (sezione 3). **Non sono local-first**: non stanno in
Dexie, non passano dalla coda né dalla discesa, non entrano in
`NomeTabella` (che pretenderebbe un livello in `LIVELLO_TABELLA`,
un'etichetta e una voce nella discesa). I loro tipi stanno in `tipi.ts`
ma fuori da `NomeTabella`. Il motivo: cercare uno username, rispondere a
una richiesta e ricevere un alimento non hanno senso offline, e una riga
scritta da due utenti diversi non sta nel modello "vince l'ultima
scrittura, un utente alla volta" (9.2). Hanno lo stesso le quattro
colonne obbligatorie (sotto) e il trigger `set_updated_at`. Ogni colonna
che punta a un utente è `ON DELETE CASCADE`. Le scritture passano dalle
funzioni (sotto), non da `insert`/`update` diretti, salvo dove è detto.

**`nomi_utente`** — lo username, una riga per utente
- `user_id` unico, `username text` con
  `check (username ~ '^[a-z][a-z0-9_]{2,19}$')`, indice unico su
  `username`: il formato ammette solo minuscole, quindi l'unicità è
  indifferente alle maiuscole per costruzione
- RLS, lettura: la propria riga, oppure quella di chi ha con me una riga
  di `amicizie` che posso leggere (sotto: in attesa, accettata, o il mio
  "Non accettata" non ancora chiuso con Ok). Nessun altro username è
  leggibile
- la crea il trigger su `auth.users` alla registrazione (9.1), oppure
  `imposta_username` per chi è registrato da prima; si cambia con
  `imposta_username`

**`amicizie`** — una riga per coppia, `user_id` = chi chiede
- `amico_id` (chi riceve), `stato` (`in_attesa` | `accettata` |
  `rifiutata`), `risposta_il` (quando ha accettato o rifiutato),
  `rifiuto_visto` (bool, default false: chi ha chiesto ha toccato Ok su
  "Non accettata"); `check (user_id <> amico_id)`
- indice unico sulla coppia in qualunque ordine,
  `(least(user_id, amico_id), greatest(user_id, amico_id)) where
  deleted_at is null`: fra due persone c'è al massimo una riga viva.
  Indici semplici su `user_id` e su `amico_id`: quello sulla coppia
  comincia da un'espressione e non copre le due foreign key (avviso
  "unindexed foreign keys", e la cascata scorrerebbe la tabella)
- RLS, lettura: chi ha chiesto la vede finché è viva e non è un rifiuto
  già visto; chi riceve la vede finché è viva e non l'ha rifiutata
  (`(user_id = uid and deleted_at is null and not (stato = 'rifiutata'
  and rifiuto_visto)) or (amico_id = uid and deleted_at is null and
  stato <> 'rifiutata')`). Nessuna policy e nessun grant di scrittura
- `nomi_utente` si legge con la **stessa regola**: la policy di
  `nomi_utente` chiede che esista una riga di `amicizie` che posso
  leggere con l'altro utente, e la RLS di `amicizie` vale anche dentro
  quella sottoquery. Una regola sola: se cambia chi vede le amicizie,
  cambia anche chi legge gli username
- una richiesta rifiutata **resta** (con `risposta_il`) per la regola dei
  7 giorni (7×24 ore da `risposta_il`): `chiedi_amicizia` dello stesso
  richiedente risponde `troppo_presto` finché non sono passati; dopo, o
  se chiede l'altro, la riga vecchia prende `deleted_at` e ne nasce una
  nuova. Annullare una richiesta o rimuovere un'amicizia = `deleted_at`;
  una riga rifiutata **non** si annulla (aggirerebbe i 7 giorni). L'Ok su
  "Non accettata" mette solo `rifiuto_visto`
- **le quattro funzioni e i loro esiti** (solo testo, mai dati; senza
  utente autenticato → errore; l'uuid è sempre l'id della riga di
  `amicizie`): `chiedi_amicizia(text)` → `inviata`, `non_trovato`,
  `sei_tu`, `gia_amici`, `gia_chiesta`, `accettata`, `troppo_presto`,
  `senza_username`; `rispondi_amicizia(uuid, bool)` → `ok`,
  `non_trovata`, `senza_username` (solo chi riceve, solo su una riga in
  attesa; la stessa risposta ripetuta → `ok`);
  `annulla_o_rimuovi_amicizia(uuid)` → `ok`, `non_trovata`;
  `chiudi_rifiuto(uuid)` → `ok`, `non_trovata`
- concorrenza: due richieste incrociate nello stesso istante. La seconda
  `insert` viola l'indice sulla coppia; `chiedi_amicizia` intercetta
  `unique_violation`, rilegge la riga che ora c'è e decide su quella
  (`accettata` o `gia_chiesta`). La riga trovata si legge con `for
  update`. Al massimo tre giri, poi l'errore vero
- `annulla_o_rimuovi_amicizia` nella migration `amicizie` tocca solo
  `amicizie`: la migration `alimenti_condivisi` la ridefinisce (`create or
  replace`, stessa firma, i permessi restano) per segnare `annullato` gli
  alimenti in attesa fra i due, in tutte e due le direzioni

**`alimenti_condivisi`** — un alimento mandato, una riga per alimento ×
destinatario, `user_id` = chi manda (decisa il 16/10; file
`supabase/migrations/alimenti_condivisi.sql`)
- `id` calcolato da `manda_alimenti` (sotto), `destinatario_id`,
  **`alimento_origine_id`** (l'id dell'alimento del mittente, **senza
  foreign key**: il mittente può cancellarlo; serve a riconoscere lo
  stesso alimento mandato di nuovo), la **copia dei valori** presa dal
  telefono di chi manda al momento dell'invio (le stesse colonne e gli
  stessi tipi di `alimenti`: nome, marca, barcode, i quattro valori,
  zuccheri, fibre, saturi, sale, porzione, `fonte`; nome da 1 a 200
  caratteri, marca al massimo 200, barcode al massimo 100, valori ≥ 0,
  porzione > 0), `stato`, `risposta_il` (quando è uscita da
  `in_attesa`), `creato_il` e le quattro colonne obbligatorie.
  `deleted_at` c'è ma non si usa: lo stato basta
- **sette stati** (deciso il 16/10): `in_attesa` (l'unico che il
  destinatario vede), `aggiunto` (Aggiungi: la copia è nata),
  `rifiutato` (Rifiuta e Tieni i miei), `uguale` (Ok sui valori
  identici), `valori_usati` ("Usa questi valori": il destinatario ha
  aggiornato il suo alimento; l'unico stato che si riapre), `sostituito`
  (chiusa da un secondo invio dello stesso alimento alla stessa
  persona), `annullato` (l'amicizia è finita con la condivisione in
  attesa). Le righe in attesa **non scadono**
- **indice unico parziale** su (mittente, destinatario, alimento
  d'origine) per le righe in attesa: chi riceve ne vede al massimo una
  per alimento, la più recente. Indici su (`destinatario_id`, `stato`) e
  su `user_id`, che coprono anche le due foreign key verso
  `auth.users` (tutte e due `ON DELETE CASCADE`)
- RLS, lettura: **solo il destinatario, solo le righe in attesa** (chi
  manda non vede niente, nemmeno i suoi invii: decisione del 15/10).
  **Nessuna policy e nessun grant di scrittura** (deciso il 16/10: niente
  insert diretto, perché il secondo invio deve chiudere la riga vecchia
  e l'invio a più amici è tutto o niente); `anon` nessun permesso. Lo
  username di chi manda si legge con la policy di `nomi_utente` che c'è
  già: una riga in attesa esiste solo con un'amicizia accettata
- l'alimento creato dall'accettazione ha come id un UUID v5 di questa
  riga, ma **nessuna foreign key** la lega: la copia è indipendente
- **le funzioni** (esiti di solo testo; senza utente autenticato →
  errore):
  - `manda_alimenti(p_invio uuid, p_destinatari uuid[], p_alimenti
    jsonb)` → `ok`, `non_amici`, `non_valido`. Tutto o niente.
    `p_invio` è un uuid che il telefono genera a ogni tocco su "Manda" e
    ripete nei tentativi; l'id di ogni riga è il v5 di
    "invio:origine:destinatario", quindi un tentativo dopo una risposta
    persa trova le righe già fatte e non ne crea altre. `non_valido`:
    elenchi vuoti o troppo lunghi (50 amici, 200 alimenti), un amico
    ripetuto o uguale a chi manda, lo stesso alimento due volte, un
    campo mancante o fuori dai limiti. `non_amici`: almeno un
    destinatario senza amicizia accettata, e non parte niente. Per ogni
    coppia: la riga in attesa dello stesso alimento per la stessa
    persona diventa `sostituito`, poi nasce quella nuova; una riga già
    risposta non si tocca (il nuovo invio sarà un doppione da decidere).
    Due invii dello stesso mittente insieme vanno in fila (advisory lock
    per mittente); le amicizie si leggono con `FOR SHARE`, così un invio
    e una rimozione insieme non lasciano righe in attesa fra due che non
    sono più amici;
  - `rispondi_alimenti_condivisi(p_ids uuid[], p_risposta text)` con
    `aggiungi` | `rifiuta` | `uguale` | `valori_usati` → `ok`,
    `non_trovata`, `non_valido`. Tutto o niente: le righe si bloccano
    (in ordine di id) e si controllano tutte prima di scrivere. Una riga
    già nello stato chiesto conta come fatta (ripetizione dopo una
    risposta persa); una riga non sua, inesistente o chiusa in un altro
    modo → `non_trovata` e non cambia niente. Aggiungi crea la copia
    (sezione 3, "La copia nasce sul server");
  - `riapri_alimento_condiviso(p_id uuid)` → `ok`, `non_trovata`.
    L'Annulla di "Usa questi valori": solo il destinatario, solo da
    `valori_usati` a `in_attesa`, solo con l'amicizia ancora accettata.
    Già in attesa → `ok`. Se nel frattempo lo stesso alimento è
    arrivato di nuovo dallo stesso amico, la riga resta chiusa e la
    risposta è `ok`: quella più recente è già in attesa;
  - `annulla_o_rimuovi_amicizia` ridefinita (sopra, "`amicizie`")

**Le funzioni** (tutte `security definer`, `search_path = ''`, controlli
espliciti dentro, `revoke` da `public`; `grant` solo ad `authenticated`,
salvo dove è detto): `username_disponibile(text)` (anche ad `anon`, per la
pagina Registrati: risponde solo sì o no sul nome esatto),
`imposta_username(text)`, `chiedi_amicizia(text)`,
`rispondi_amicizia(uuid, bool)`, `annulla_o_rimuovi_amicizia(uuid)`,
`chiudi_rifiuto(uuid)` (l'Ok su "Non accettata"),
`manda_alimenti(uuid, uuid[], jsonb)`,
`rispondi_alimenti_condivisi(uuid[], text)` e
`riapri_alimento_condiviso(uuid)` (sopra, "`alimenti_condivisi`"); più
le funzioni dei trigger su `auth.users` (9.1) e
`valore_condiviso_valido` (il controllo di un valore numerico dentro
`manda_alimenti`, non security definer), non chiamabili da nessuno. Gli
avvisi degli advisors che danno sono accettati (9.6).

### Campi tecnici obbligatori su ogni tabella

Conseguenza delle decisioni della sezione 9 (multiutente + local-first). Vanno
messi da subito, non aggiunti dopo:

- `id` **uuid generato dal client**, non `serial` — il dispositivo deve poter
  creare una riga valida mentre è offline
- `user_id` con riferimento a `auth.users` **`ON DELETE CASCADE`**, e **RLS
  attiva su ogni tabella**. Cancellare un utente cancella tutte le sue
  righe; anche i riferimenti tra tabelle dello stesso utente che
  appartengono al genitore (`obiettivi_target` → `obiettivi`) sono
  `CASCADE`, altrimenti la cancellazione dell'utente si blocca (sezione
  11, "Fatto", vincoli verso `auth.users`)
- `updated_at` — base della sincronizzazione
- `deleted_at` — cancellazione logica: una riga cancellata offline deve poter
  essere propagata; il `delete` fisico non è sincronizzabile

Eccezione: `alimenti` ha `user_id` **nullable**. `NULL` = alimento del catalogo
condiviso, visibile a tutti; valorizzato = alimento privato di quell'utente.

---

### Il giorno è quello del calendario

> Un inserimento appartiene al **giorno del calendario** dell'orologio locale
> (`oggiLocale` in `dataGiorno.ts`), a qualunque ora. Alle 01:30 è già oggi.

C'è **un solo "oggi"** in tutta l'app: lo stesso per Oggi, l'inserimento, il
periodo in corso del Profilo e la pesata.

**La data è calcolata una volta e memorizzata**, non ricalcolata a ogni lettura.
Il passato non si riscrive mai da solo: stesso principio dello storico degli
obiettivi.

**Decisione ritirata (2 ottobre 2026): il "giorno logico".** Prima valeva la
regola inversa: un inserimento fatto prima dell'inizio del primo pasto
apparteneva al giorno precedente. Il 1/10 alle 05:57 tre voci sono finite
nella Cena del 30/9 e sono state cancellate a mano. In più la pesata usava già
la data del calendario: c'erano due "oggi". Le voci salvate con la regola
vecchia restano come sono, con la loro `data`.

### Estensioni future: cosa tocca lo schema e cosa no

Criterio per decidere cosa va deciso **adesso** e cosa può aspettare.

**Categoria 1 — se rimandata, i dati sono persi per sempre.** Vanno fatte ora.

- **Storico degli obiettivi.** Le Statistiche disegnano la linea tratteggiata
  "obiettivo 2200" sulle settimane passate. Se il target vive solo come valore
  corrente nel profilo, il giorno in cui passi da "mantenere" a "dimagrire"
  **tutta la storia passata viene ridisegnata con il target nuovo** e dice il
  falso. È lo stesso problema della copia dei valori nutrizionali sulle voci di
  diario, già risolto lì. Nessuna migration futura può ricostruire quel dato: o
  lo si registra mentre succede, o non esiste. → tabella `obiettivi`
- **Il tipo di ogni giornata.** Se la differenziazione è attiva, sapere quale
  giorno era di allenamento non è ricostruibile a posteriori: nessun dato nel
  diario lo dice. Va scritto mentre succede. → tabella `giorni`
- **Raggruppamento delle voci.** Un pasto salvato inserisce 3 righe nel diario.
  Senza un `gruppo_id` scritto al momento dell'inserimento, l'informazione "queste
  tre sono state messe insieme" non è più ricostruibile, e non puoi annullare o
  spostare il blocco. → campo `gruppo_id` su `voci_diario`

**Categoria 2 — modificano una tabella esistente.** Costa poco ora, costa una
migration dopo.

- **Misure corporee oltre al peso** (vita, fianchi, % grasso): `misurazioni`
  come righe `tipo`/`valore` invece di una colonna per misura
- **Unità diverse dal grammo** (ml per i liquidi, "1 uovo"): invariante da
  fissare subito — **il database memorizza sempre grammi**, l'unità è solo
  presentazione. Aggiungerne una in futuro sarà un campo su `alimenti`, non un
  cambio di significato di `quantita_g`

**Categoria 3 — tabelle nuove che non toccano niente.** Aggiungibili quando
vuoi, senza rischio e senza migration dolorose.

- **Idratazione / acqua.** L'acqua non è un alimento: non ha macro, non si misura
  in grammi, non deve comparire tra i recenti. È una tabella sua
  (`utente`, `data`, `ml`) e una riga in più nella schermata Oggi. **Zero impatto
  sulle tabelle di adesso**, quindi non c'è nessun motivo di deciderlo ora:
  quando la vuoi, si aggiunge in mezz'ora. L'unico costo vero è lo spazio nella
  fascia alta di Oggi, che è già piena
- **Sonno inserito a mano** (ora di addormentamento, ora di sveglia, qualità
  1-5). Tecnicamente è una tabella sua e non tocca niente: `utente`, `data`, i
  due orari, `qualita`, `note`. Ma vedi "Il sonno" qui sotto: il costo non è nel
  database
- Note o foto su una voce di diario: campi nullable
- Attività fisica e calorie bruciate: tabella a parte. Attenzione però, non è
  gratis dal punto di vista del prodotto — cambia il significato di "Rimangono
  620 kcal", che diventerebbe un bersaglio mobile. Resta fuori dal perimetro
- Barcode: il campo su `alimenti` c'è già, serve solo la UI di scansione

#### Il sonno: perché resta nel backlog

Il problema non è tecnico — è una tabella isolata, si aggiunge in un pomeriggio
quando si vuole. Il problema è che **è una seconda abitudine quotidiana**, e le
abitudini non si sommano gratis.

Registrare un pasto funziona perché avviene mentre guardi il cibo: il momento
giusto e il gesto coincidono. Registrare il sonno andrebbe fatto al risveglio,
che è esattamente il momento in cui nessuno apre un'app. Il risultato tipico è
due settimane di dati, poi buchi — e una correlazione calcolata su undici notti
non significa niente, pur avendo l'aria autorevole di un grafico.

C'è poi la deriva: dal momento in cui l'app dice "mangi tardi e dormi peggio",
non è più un diario, è un consiglio sulla salute. Fuori perimetro (sezione 9.5).

**Il test da fare prima di costruirla**, e costa zero: segnare gli orari di sonno
per 30 giorni **su un foglio o nelle note del telefono**. Se dopo un mese la
serie è completa, l'abitudine regge e la feature ha senso. Se ci sono buchi dopo
dieci giorni, la risposta è arrivata senza aver scritto una riga di codice.

**Se un giorno si fa**: una riga sola in Oggi ("Sonno — 7h 20m"), due campi e una
faccina, mai una notifica, e **nessuna correlazione calcolata dall'app**. Al
massimo le due serie sullo stesso asse temporale, e le conclusioni le trae chi
guarda.

**Categoria 4 — già coperte dall'architettura.** Multiutente, più dispositivi,
apertura al pubblico, unione di alimenti duplicati (le voci di diario hanno la
loro copia dei valori, quindi unire due alimenti non altera la storia).

---

## 5. L'astrazione chiave

Interfaccia unica per tutte le modalità di inserimento:

```
SorgenteAlimento.ottieni() → AlimentoNormalizzato {
  nome, kcal100g, macro, porzioneSuggerita, fonte, confidenza
}
```

*(Non ancora nel codice: resta il progetto da seguire quando arriveranno Open
Food Facts e l'OCR. Oggi esiste solo l'inserimento manuale, che passa già
dall'unico sheet quantità.)*

Implementazioni: `RicercaManuale`, `RicercaOpenFoodFacts`, `ScansioneEtichetta`,
e in futuro `Barcode`, `FotoPiatto`, `Testo`, `Voce`.

La UI di conferma quantità è **una sola**, identica per ogni sorgente. Aggiungere
il barcode significherà scrivere una classe nuova e zero modifiche altrove.

È questa la cosa che impedisce al codice di diventare un puzzle di pezzi
attaccati man mano.

---

## 6. Ordine di sviluppo

0. Livello dati local-first (IndexedDB + outbox + sync) — prima di qualsiasi
   schermata, perché è dove vive il dato, non una feature
1. Schema database + auth + profilo + calcolo fabbisogno
2. Inserimento manuale + pagina Oggi → **usarla davvero per una settimana**
3. Recenti, preferiti e **pasti salvati**
4. Ricerca Open Food Facts
5. OCR etichetta
6. Statistiche e peso
7. Solo dopo: barcode, AI, il resto del backlog

I punti 3 e 4 sono il vero test del prodotto. Se dopo recenti+preferiti i pasti
si registrano in 5 secondi senza mai usare la fotocamera, è un'informazione
importante sul prodotto, ottenuta avendo scritto pochissimo codice.

---

## 7. Linee guida visive

Confermate dai mockup, con una correzione.

- **Un solo colore d'accento: il verde.** Usato per l'azione principale
  (il pulsante "+ Aggiungi", il riquadro "Scansiona etichetta"), per lo stato
  attivo (tab selezionata, obiettivo selezionato) e per l'anello delle calorie.
  Tutto il resto è neutro: nero per i numeri, grigio per le etichette
- Nessun bordo dove non serve: separatori sottili tra le righe, niente card
  dentro card. Lo spazio bianco separa
- **Elementi fluttuanti** (dal 2/10): la pillola della tab bar, "+ Aggiungi"
  in Oggi e la barra Salva di Profilo galleggiano sopra il contenuto, con
  un'ombra leggera (`--ombra-fluttuante`). La pillola ha lo sfondo "vetro"
  (`--vetro`, semitrasparente, con `backdrop-filter`; sfondo pieno dove la
  sfocatura non è supportata, con `@supports`). La voce attiva ha una
  capsula di sfondo, `--capsula-attiva`: un token solo, per provare
  alternative cambiando una riga. Il testo sopra la capsula (etichetta della
  voce attiva, "Annulla") usa `--testo-capsula`, dal 3/10: vedi i contrasti
  in "Tema chiaro / scuro / sistema". Tutti derivati con `color-mix` dai token
  di base, nessun colore scritto a mano, quindi seguono anche il tema scuro
- **La barra dei messaggi in basso** (`BarraAnnulla`, dal 2/10, "opzione
  A") è dello stesso vetro della tab bar: `.vetro`, bordo,
  `--ombra-fluttuante`, mai il nero pieno. È una pillola larga quanto il
  contenuto e centrata, al massimo quanto lo schermo meno 32 px. Se il testo
  va a capo diventa un rettangolo molto arrotondato, perché il raggio è fisso.
  Da sinistra:
  - **icona in un cerchio di 26 px**: spunta su fondo `--accento-pieno` per
    Aggiunto, Salvato e Ripristinato; su fondo `--linea` la freccia ↶
    (Annullato), il cestino (Eliminato) o la "i" (avvisi, errori, il
    messaggio della stella);
  - **testo**: il verbo normale e il nome in medium (non bold: qui valgono
    regular e medium); il dettaglio, per esempio "(3 alimenti)", resta
    sempre visibile. È una frase sola con spazi veri fra le parti (lo
    screen reader la legge intera). Se non sta su una riga va a capo; il
    nome si accorcia con "…" solo se da solo è più lungo di una riga.
    Fino al 6/10 il testo stava su una riga che non andava mai a capo e
    solo il nome poteva restringersi: con "Vedi" e "Annulla" accanto il
    nome spariva del tutto e il dettaglio finiva sotto i pulsanti,
    tagliato ("Duplicato:  in Pranzo di lun 5"). Controllo in
    `BarraAnnulla.test.tsx`;
  - **"Vedi"** (solo dopo una Duplica su un altro giorno): testo in
    `--testo-capsula`, senza capsula, prima di "Annulla";
  - **"Annulla"**: accento, in una capsula `--capsula-attiva`, con un'area
    toccabile di 44 px. I pulsanti non si restringono mai: il testo non ci
    finisce sotto.

  Sul bordo basso una linea di 2 px (`--linea-tempo`) si accorcia per tutta
  la durata. Con `prefers-reduced-motion` la linea non c'è.

  **Pausa** (regola del 3/10): finché il dito o il fuoco è sulla barra,
  timer e linea sono fermi; quando finisce **riprendono da quanto
  restava, non da capo**. Prima ripartivano pieni: un tocco per sbaglio
  allungava la barra, e tocchi ripetuti la tenevano aperta. La barra resta
  quindi visibile al massimo la sua durata più il tempo passato in pausa.
  Il calcolo sta in `src/lib/inserimento/tempoBarra.ts` (funzioni pure,
  test in `tempoBarra.test.ts`). Timer e linea leggono lo stesso stato: a
  ogni pausa o ripresa la linea si ridisegna con un `animation-delay`
  negativo pari al tempo già passato, così parte dal punto giusto e arriva
  a zero quando la barra sparisce.

  **Durate** (dal 3/10; dal 2/10 erano 5 s con Annulla, 4 s per una frase,
  2,5 s per una conferma breve, e prima ancora 8 s per tutto: troppi
  inserendo più alimenti di fila). Sono costanti in un posto solo,
  `DURATE_BARRA` in `src/lib/inserimento/testiBarra.ts`:
  - **3 secondi** con l'azione "Annulla" (Aggiunto, Eliminato);
  - **2,5 secondi** per tutto il resto: conferme brevi (Salvato,
    Ripristinato, Annullato) e frasi (il messaggio della stella, l'avviso
    del pasto salvato non ripristinato, gli errori).

  La barra sceglie da sola, a seconda che ci sia un'azione; i messaggi non
  portano una durata loro
- Numeri grandi, etichette piccole e grigie, spesso in maiuscoletto
  ("OBIETTIVO", "TARGET GIORNALIERI"). Pesi tipografici: solo regular e medium
- **Il colore nei grafici segnala, non decora.** Nel grafico calorie del
  mockup (la pagina Statistiche non è ancora costruita) funziona così: verde =
  dentro l'obiettivo, arancio = sopra, grigio = giorno senza dati
- **Attenzione a una trappola**: per le calorie il verde è *restare sotto* il
  target, per le proteine è *arrivarci*. Sono posizioni opposte rispetto alla
  soglia, quindi la regola non è "verde = sotto" ma **"verde = stai andando come
  volevi, arancio = hai superato"**. Va scritta così nel codice, altrimenti si
  finisce con due componenti che colorano al contrario

### Nome e icona (dall'11/10, branch `nome-libra`)

- **Il nome dell'app è "Libra"** (deciso l'11/10; prima NutriTrack).
  Libra = bilancia in latino. Compare nel `name` e `short_name` del
  manifest, nel titolo della scheda e in `apple-mobile-web-app-title`
  (`layout.tsx`, il nome proposto da "Aggiungi a Home") e in
  `offline.html`. Indirizzo: https://app-libra.vercel.app
- **L'icona è la bilancia**: asta, giogo e due piatti, verde chiaro
  `#7bb887` su fondo scuro `#1b1815` (`--accento-scuro` del verde e
  `--background` del tema scuro). Scelta fra tre proposte nel mockup
  `docs/mockups/icona-libra.html`. File: `public/icons/icon-192.png`,
  `public/icons/icon-512.png`, `public/apple-touch-icon.png` (180),
  `src/app/favicon.ico` (16, 32, 48). È un file fisso, uguale per tutti:
  non segue il colore principale scelto in Aspetto
- **Come sono fatti i file**: quadrati pieni, senza angoli arrotondati né
  trasparenza (gli angoli li taglia iPhone, che riempie di nero le parti
  trasparenti); il disegno sta nel cerchio centrale all'80%, la zona
  sicura delle icone maskable. Dentro `favicon.ico` i PNG devono essere
  **RGBA** (color type 6): con PNG RGB la build di Next.js fallisce
  ("The PNG is not in RGBA format!", visto l'11/10). Cambiando le icone
  si alza la versione di `CACHE_STATICI` in `sw.js`, perché stanno in
  `PRECACHE`
- **Chi ha già l'app installata** tiene nome e icona del momento in cui
  l'ha aggiunta alla Home: iOS non li aggiorna mai. Per l'icona nuova
  si toglie l'app e la si riaggiunge, **dopo aver controllato in
  Impostazioni > Sincronizzazione che sia tutto sincronizzato**: l'app
  installata ha dati suoi, separati da Safari, e quello che non è ancora
  salito sul server si perde. Dopo, i dati si riscaricano dal server
- **Restano "nutritrack" per sempre** (regola fissa, 11/10): le chiavi
  tecniche dei dati sul telefono (il database Dexie `nutritrack`, le
  chiavi di localStorage e sessionStorage, le cache del service worker
  `nutritrack-statici-…` e `nutritrack-pagine-…`), il `name` di
  `package.json`, la classe `NutriTrackDatabase`, il repository GitHub e
  i progetti Vercel e Supabase. Non si vedono, e cambiarle rischia i dati
  locali: un database Dexie con un nome nuovo nasce vuoto e perde le
  scritture non ancora salite; chiavi e cache nuove azzerano tema,
  colore e pagine salvate. Il nome nuovo vale solo per ciò che vede
  l'utente
- **Le email di Supabase non contengono il nome dell'app**: sul piano
  gratuito i modelli non si personalizzano (sezione 10.9)

### Tema chiaro / scuro / sistema

Previsto dall'inizio, con tre opzioni: Chiaro, Scuro, Sistema (segue le
impostazioni del telefono, ed è il valore predefinito).

Non è una feature, è un **vincolo di come si scrive il CSS**: nessun colore
scritto a mano dentro un componente, tutti i colori passano da variabili
definite in un punto solo. Farlo dal primo giorno costa un'ora; aggiungerlo dopo
vuol dire ripassare ogni schermata a caccia di colori cablati.

La scelta del tema **non sta nel database**: è una preferenza del dispositivo
(`localStorage`), non dell'account. Il telefono in scuro e il portatile in
chiaro è normale e giusto.

Da verificare in tema scuro: che l'arancio "sopra l'obiettivo" resti distinguibile
e che il verde d'accento non risulti fluorescente su fondo nero. Non si aggiusta
a occhio in chiaro e si spera.

**Stato (3/10): fatti tutti e due i passi.** Passo 1, l'app segue il tema
del telefono; passo 2 (passo "tema" di Impostazioni), la scelta Chiaro /
Scuro / Sistema in Impostazioni > Aspetto, predefinito Sistema. Provati
su iPhone il 3/10, in Safari e nell'app installata (dettaglio in §11).
Dal passo "accento" (passo 6 di Impostazioni) anche il **colore
principale** si sceglie lì, con lo stesso meccanismo (sotto, "Colore
principale").

**Come funziona la scelta** (`src/lib/tema.ts`):

- **Dove sta**: `localStorage`, chiave `nutritrack:tema`, valori `chiaro`
  | `scuro` | `sistema`; per il colore chiave `nutritrack:accento`, valori
  `verde` | `blu` | `viola` | `petrolio` (`ACCENTI`), un valore
  sconosciuto vale `verde`. Ogni lettura e scrittura è in try/catch: senza
  `localStorage` (Safari privato) l'app fa come "Sistema" e verde, senza
  errori.
- **Chi la applica**: uno script piccolissimo in linea dentro `<head>`
  (`layout.tsx`), che il browser esegue prima di disegnare la pagina: niente
  lampo del tema sbagliato. Scrive `data-tema="chiaro|scuro"` e
  `data-accento="verde|blu|viola|petrolio"` su `<html>` e il colore della
  barra, e lo rifà quando cambia il tema del telefono,
  quando la pagina Aspetto salva (evento `nutritrack:tema`) e quando
  un'altra scheda cambia la scelta (evento `storage`). `<html>` ha
  `suppressHydrationWarning`: React non segnala l'attributo aggiunto dallo
  script.
- **Una sola copia della logica**: le decisioni sono le funzioni pure
  `temaEffettivo(scelta, telefonoScuro)` e `accentoEffettivo(scelta,
  accenti)`; lo script non è scritto a mano, è il testo di
  `temaEffettivo`, `accentoEffettivo` e `avviaTema` (`toString()`).
  **Regola: `temaEffettivo`, `accentoEffettivo` e `avviaTema` devono
  restare autonome, niente import e niente funzioni o costanti di fuori**
  (l'elenco dei colori arriva come parametro): nel testo copiato in
  `<head>` il resto del modulo non esiste e lo script si romperebbe. Lo
  scopre `src/lib/tema.test.ts`, che esegue in una pagina finta proprio la
  stringa `SCRIPT_TEMA`. `offline.html` (fuori da Next) ha una copia dello
  script: lo stesso test la fa girare sugli stessi casi dell'originale.
- **Colore della barra** (`theme-color`): in `<head>` ci sono due `<meta>`,
  uno per tema del telefono (`media`), che sono la rete di sicurezza. Lo
  script mette davanti un suo `<meta>` senza `media`, con il colore del
  tema in uso: il browser usa il primo che vale. I due della pagina non si
  toccano: React li riconosce dagli attributi e, con un `content` cambiato,
  ne aggiungeva una copia (visto il 3/10).
- **CSS, una sola copia dei valori**: ogni colore è scritto una volta, con i
  due valori uno accanto all'altro,
  `--background: var(--se-chiaro, #faf7f2) var(--se-scuro, #1b1815)`.
  **Il trucco**: un interruttore "acceso" vale `initial` (= non definito),
  quindi `var()` mette il valore dopo la virgola; "spento" vale uno spazio,
  e `var()` mette lo spazio. Non `light-dark()`, la funzione CSS fatta
  apposta: c'è solo da iOS 17.5 e la build non la traduce per i telefoni
  più vecchi. Gli interruttori si accendono con `[data-tema="chiaro"]` o
  `[data-tema="scuro"]` e, **senza attributo** (script non partito), con
  `@media (prefers-color-scheme: dark)`, come prima di Aspetto.

**Colore principale** (passo "accento", deciso il 3/10 sul mockup
`docs/mockups/colore-principale.html`). Quattro colori, verde predefinito:

| Colore | Chiaro | Scuro |
|---|---|---|
| Verde | `#3f7d4c` | `#7bb887` |
| Blu | `#356d96` | `#8ab8de` |
| Viola | `#6b56a0` | `#b5a3e0` |
| Petrolio | `#2c7472` | `#6fbdb8` |

- **Cosa cambia**: per ogni colore solo due valori, `--accento-chiaro` e
  `--accento-scuro`, scritti una volta in `[data-accento="..."]` in
  `globals.css` (il verde anche su `:root`: senza attributo, cioè senza
  script, l'app è verde). `--accento` li legge con gli interruttori del
  tema; `--accento-pieno` è sempre `--accento-chiaro` (al buio il
  riempimento resta il valore chiaro, come per il verde da sempre). Tutto il
  resto deriva da `--accento`: capsula, testo sulla capsula, linea del
  tempo, anello di focus, anello delle calorie, icone.
- **Anteprime con un colore diverso da quello in uso**: il blocco dei token
  vale su `:root, [data-tema], [data-accento]`. Le variabili CSS si
  calcolano sull'elemento dove sono scritte e chi sta dentro riceve il
  risultato già fatto: per questo un elemento con solo `data-accento="blu"`
  deve ridichiarare tutti i token, derivati compresi, altrimenti la capsula
  e il testo sulla capsula resterebbero quelli del colore di `<html>`. Con
  il selettore in quella lista lo fa da solo.
- **Un colore nuovo**: una regola `[data-accento="..."]` in `globals.css`
  e in `offline.html`, il nome in `ACCENTI` e `NOMI_ACCENTO`
  (`src/lib/tema.ts`). `temaScuro.test.ts` controlla che CSS, offline.html
  e `ACCENTI` coincidano; `contrasti.test.ts` ne misura i contrasti.
- **Dove il colore non passa dalle variabili** (cercato il 3/10): da
  nessuna parte nell'app. Anello, barre, icone e bottoni usano già le
  classi dei token; Recharts non è ancora usato (Statistiche è un
  segnaposto: i grafici, quando arriveranno, dovranno prendere i colori
  dalle variabili); nessun colore in JavaScript. `offline.html` segue il
  colore (`CACHE_STATICI` v5). **Restano fissi apposta**: le icone
  dell'app e `manifest.json` (icona scura con "NT" bianco, sfondo crema:
  non contengono il verde) e `theme-color`, che è lo sfondo.
- **L'arancio** "superato" (`--avviso`) non cambia con il colore
  principale: segnala un obiettivo superato e, come già nei messaggi
  d'errore, gli stati della sincronizzazione che chiedono attenzione
  (sessione scaduta, server che rifiuta, modifiche accantonate).
- **Il rosso** `--pericolo` (deciso l'11/10 sul mockup
  `docs/mockups/elimina-account.html`, costruito nel branch
  `elimina-account`): **solo per le azioni che non si possono
  annullare**, oggi solo "Elimina il mio account". L'arancio resta per
  "attenzione" (Esci, errori, obiettivo superato). `#b3261e` in chiaro
  (6,5:1 su superficie, 6,1:1 su fondo), `#f2938a` al buio (7,0:1 su
  superficie, 7,8:1 su fondo). `--pericolo-pieno`, il riempimento del
  pulsante, è `#b3261e` nei due temi, come `--avviso-pieno`: testo crema
  in chiaro 6,1:1, bianco al buio 6,5:1. I due token vanno in
  `contrasti.test.ts` e `temaScuro.test.ts`
- **L'ocra** `--attesa` (`text-pending`, dal 10/10): `#8a6d1f` in chiaro,
  `#d9b764` al buio. Solo per "modifiche in attesa" nell'indicatore di
  sincronizzazione: niente di sbagliato, solo da sapere (mockup
  `docs/mockups/sincronizzazione.html`). Non cambia con il colore
  principale; contrasto controllato da `contrasti.test.ts`.

**Grigio `--tenue`**: in chiaro da `#8a8271` a **`#78705f`** dal passo
"accento" (prima era sotto 4,5:1, vedi i contrasti sotto). Al buio resta
`#a39a8b`.

**Contrasti misurati il 3/10** (testo, soglia 4,5:1), tutti sopra la
soglia; li controlla `src/app/contrasti.test.ts`, che calcola i colori da
`globals.css` così com'è (segue `var()` e `color-mix()` e sovrappone
vetro e capsula):

| | Verde | Blu | Viola | Petrolio |
|---|---|---|---|---|
| Chiaro: accento su sfondo / su superficie | 4,6 / 4,9 | 5,2 / 5,6 | 5,7 / 6,1 | 5,1 / 5,5 |
| Chiaro: testo sul pieno | 4,6 | 5,2 | 5,7 | 5,1 |
| Chiaro: testo-capsula su capsula e vetro | 4,9 | 5,5 | 5,9 | 5,4 |
| Scuro: accento su sfondo / su superficie | 7,6 / 6,8 | 8,4 / 7,5 | 7,8 / 7,0 | 8,1 / 7,3 |
| Scuro: testo bianco sul pieno | 4,9 | 5,6 | 6,1 | 5,5 |
| Scuro: testo-capsula su capsula e vetro | 5,2 | 5,6 | 5,3 | 5,5 |

`--tenue`: in chiaro 4,6 su sfondo e 4,9 su superficie, al buio 6,4 e
5,7, uguale per tutti i colori. Il caso più stretto è `--tenue` sullo
sfondo crema, 4,59:1. Rimesso per prova il grigio vecchio, il test
diventa rosso (3,57:1).

**Due limiti da sapere:**

- **Nell'app installata la barra in alto con l'ora segue il tema del
  telefono**, non la scelta: con `statusBarStyle: "default"` (sotto) iOS la
  colora da solo e una pagina web non la può cambiare. Con "Scuro" su un
  iPhone in chiaro: barra chiara sopra una pagina scura. In Safari invece la
  barra segue `theme-color`, quindi la scelta. Scritto nella nota della
  pagina Aspetto.
- **Safari e l'app installata hanno scelte separate**: su iPhone hanno
  ciascuno il suo `localStorage`. Scegliere "Scuro" in Safari non cambia
  l'app sulla Home, e viceversa.

- **Palette "Caldo"**, il gemello scuro di quella chiara. Tutti i valori
  scuri stanno accanto ai chiari, nel blocco `:root, [data-tema],
  [data-accento]` di `src/app/globals.css`: sfondo `#1b1815`, testo
  `#f2ede4`, linea `#3a342d`, tenue `#a39a8b`, accento `#7bb887` (per il
  verde; gli altri colori sopra), avviso `#e8916f`.
  Contrasti: tenue su sfondo 6,4:1, accento su sfondo 7,6:1, avviso su
  sfondo 7,3:1. L'arancio resta distinguibile dal verde e il verde non è
  fluorescente: confermato su iPhone il 3/10.
- **Token aggiunti per il tema scuro.** Quando sono nati (3/10) in chiaro
  valevano quanto quelli di base, quindi in chiaro non cambiava nessun pixel
  (verificato con un confronto pixel per pixel con main). Dal passo
  "superficie" fa eccezione `--superficie`:
  - `--superficie` (`bg-surface`): pillola, barra dei messaggi, sheet,
    barra Salva, gruppi e scheda dell'account di Impostazioni. **In chiaro
    `#ffffff`** dal 3/10 (decisione D, sezione 3): i riquadri bianchi
    staccano dal crema come nel mockup; prima era uguale allo sfondo. Al
    buio `#26221e`, un po' più chiara dello sfondo, altrimenti questi
    elementi spariscono;
  - `--accento-pieno` / `--avviso-pieno` (`bg-accent-strong` /
    `bg-warning-strong`): il riempimento dei bottoni con testo sopra. Al
    buio restano il valore chiaro dell'accento (`#3f7d4c` per il verde) e
    `#b5533c`, perché il bianco sopra il verde e
    l'arancio chiari del tema scuro non si legge (sull'arancio 2,4:1);
  - `--su-pieno` (`text-on-strong`): il testo sopra quei riempimenti. In
    chiaro è il colore dello sfondo, come prima; al buio è bianco, 4,9:1;
  - `--velo` (`bg-veil`): lo sfondo dietro gli sheet aperti. Prima era
    `bg-foreground/40`, che al buio avrebbe sbiancato la pagina invece di
    scurirla; al buio è nero al 60%.

  - `--testo-capsula`: il testo accento sopra `--capsula-attiva`
    (etichetta della voce attiva della tab bar, "Annulla" nella barra dei
    messaggi). In chiaro è l'accento con il 10% di nero
    (`color-mix`, quindi segue il colore principale); al buio è
    `--accento`;
  - `--segmento-attivo`: la scheda scelta di un selettore a segmenti
    (Normale | Allenamento, Dimagrire / Mantenere / Massa, il sesso). Deve
    essere più chiara della capsula grigia intorno, come sull'iPhone: in
    chiaro è la superficie bianca, al buio `#4a433a` (la superficie scura
    sarebbe più scura della capsula). Testo sopra 8,4:1.

  `--accento` resta per tutto ciò che non ha testo sopra: anello, icone,
  testi verdi, barra macro raggiunta.
- **Contrasti in chiaro misurati il 3/10, con la superficie bianca** (caso
  peggiore: la pillola è vetro, bianco al 75% sopra lo sfondo crema):
  - testo sopra la capsula: con l'accento puro 4,2:1 sul vetro e 4,2:1 sul
    bianco, sotto il 4,5:1 del testo; ridurre la capsula non bastava
    (all'10% 4,3:1, all'8% 4,4:1). Con `--testo-capsula` **4,9:1** sul
    vetro e **5,0:1** sul bianco. Prima del passo, con il vetro crema, era
    4,0:1;
  - `--accento` su bianco 4,9:1 (su crema 4,6:1);
  - `--tenue` su bianco 3,8:1, sul crema 3,6:1: sotto 4,5:1 già prima di
    questo passo. Corretto al passo "accento" con `#78705f` (4,9 e 4,6,
    tabella sopra);
  - `--linea` su bianco 1,3:1 (su crema 1,2:1): bordi e separatori si
    vedono ancora, come prima; sono decorativi;
  - campi di testo dentro gli sheet: restano col colore dello sfondo, cioè
    caselle crema dentro il riquadro bianco (crema su bianco 1,07:1, più il
    bordo). Si leggono come caselle da riempire, come i campi grigi
    dell'iPhone: lasciati così.
- **Ogni colore scritto per esteso ha i due valori** (chiaro e scuro); uno
  senza interruttori deve derivare da altri token (`--vetro`,
  `--linea-tempo`). Lo controlla il test `src/app/temaScuro.test.ts`, che
  verifica anche gli interruttori nei tre casi, i colori principali, che
  il colore della barra sia lo sfondo e che `public/offline.html` abbia
  gli stessi valori.
- **`color-scheme`** segue il tema in uso (`light` o `dark`, negli stessi
  blocchi degli interruttori): select, calendario delle date e scrollbar
  hanno lo stesso tema della pagina.
- **Fuori dalle variabili CSS:**
  - `theme-color`: `COLORI_BARRA` in `src/lib/tema.ts` (`#faf7f2` /
    `#1b1815`), usato dai `<meta>` di `layout.tsx` e dallo script;
  - `manifest.json` ha un valore solo, quindi resta chiaro: `#faf7f2` per
    sfondo e `theme_color`. Su Android chi è in scuro vede un lampo chiaro
    all'avvio;
  - `offline.html` ha i suoi colori e lo script copiati (sopra).
- **Barra di stato dell'app installata: resta `statusBarStyle:
  "default"`.** iOS la fa opaca, la colora secondo il tema del sistema e la
  pagina comincia sotto. Provato su iPhone il 3/10: in chiaro e in scuro
  la barra è in tinta con la pagina, senza stacco. Con "black-translucent"
  l'orologio sarebbe sempre bianco, quindi invisibile in chiaro.
- **Selezione del testo e campi compilati in automatico**: lasciati ai
  colori del browser. Il solito trucco per ricolorare i campi compilati in
  automatico (`box-shadow` inset) cancellerebbe l'anello di focus. Provato
  su iPhone il 3/10 nel login in Scuro: vanno bene così.

### Le barre macro (corretto rispetto al mockup)

Nel mockup le tre barre macro erano blu, arancio e rosso. **Diventano tutte
dello stesso neutro scuro.** Il colore non aggiungeva informazione — l'etichetta
dice già "Proteine" — e l'arancio significa già "sopra l'obiettivo" nelle
Statistiche: stesso colore, due significati.

Il colore entra solo quando dice qualcosa:

- neutro: sotto il target
- accento: target raggiunto
- arancio: target superato

Una regola sola, valida in tutta l'app.

**Ordine: Kcal → Grassi → Carboidrati → Proteine**, ovunque i quattro valori
compaiono insieme (form crea/modifica alimento, anteprima dello sheet
quantità, Oggi, target del Profilo). Scelto il 2026-09-10 perché è l'ordine
delle etichette nutrizionali dei prodotti: copiando i valori da una
confezione non si salta avanti e indietro fra i campi. In Oggi le kcal sono
l'anello, quindi le barre sono tre: Grassi, Carboidrati, Proteine.

---

## 8. Stack e costi

- **Next.js + Vercel** — hosting gratuito
- **Supabase** — database e autenticazione, piano gratuito (progetto esistente:
  `nutritrack`, eu-west-1)
- **Dexie (IndexedDB)** — database locale sul dispositivo, fonte di verità
- **PWA installabile** — nessuno store, nessun costo di pubblicazione
- **Open Food Facts** — catalogo alimenti via API pubblica, gratuita, senza chiave
- **Tesseract.js** per l'OCR, gira nel browser: zero costi server
- **Recharts** per i grafici

Costi reali solo su API AI (V2) e dominio personalizzato (opzionale).

**Strumenti di sviluppo** (solo devDependency, gratuiti): ESLint con la
configurazione di Next.js (esclude `.claude/**`, codice di terzi), Vitest +
Testing Library per i test (sezione 10.5), **Prettier 3.9.10**.

**Prima di ogni commit che tocca `public/` o `src/app/`** si lancia anche
`npm run build`, non solo test, `tsc` e lint (dall'11/10). Lezione del
favicon: un `favicon.ico` con PNG RGB passava test e lint, ma la build di
Vercel falliva perché Next.js lo legge e lo vuole RGBA (sezione 7, "Nome
e icona").

**Migration che il connettore rifiuta** (dall'11/10). Se il connettore
Supabase rifiuta `apply_migration` senza chiedere conferma (succede con
un DELETE nel testo, anche dentro una funzione), la applica Davide dal
SQL Editor con il testo esatto del file, più la riga di registrazione
perché compaia in `list_migrations` con la sua versione:
`insert into supabase_migrations.schema_migrations (version, name,
created_by) values (to_char(now() at time zone 'utc',
'YYYYMMDDHH24MISS'), '<nome>', 'sql-editor (Davide)');`. Poi Cowork
verifica (`list_migrations`, `get_advisors` e le prove della migration).
Primo caso: `elimina_mio_account` (sezione 9.6).

**Una migration non si esegue dal SQL Editor** (regola del 16/10). Quel
giorno `trigger_registrazione` è stata applicata per sbaglio eseguendo
il suo file al posto del blocco di prove (sezione 9.1). D'ora in poi ogni
file nuovo in `supabase/migrations/` ha **in testa**, prima di ogni altro
commento, una riga ben visibile:
`-- NON eseguire dal SQL Editor: si applica con apply_migration; le prove
sono nel file prove_<nome>.sql`. L'unica eccezione resta il caso sopra
(il connettore rifiuta), deciso esplicitamente. I file delle migration
già applicate non si modificano per aggiungerla: il testo applicato e
quello nel repository devono restare uguali.

- **Prettier è configurato ma non ancora applicato a tutto il codice.**
  `.prettierrc` rispecchia lo stile prevalente misurato in `src` l'11/10:
  doppi apici, punto e virgola, righe fino a 100, virgole finali "es5",
  fine riga lasciato com'è (`auto`, perché Git su Windows li converte in
  CRLF sul disco). `.prettierignore` esclude i documenti `.md` (a capo a
  mano), `.next`, `node_modules`, `.claude` e i file generati
- Lanciarlo oggi cambierebbe 128 file su 208 in `src`, più
  `next.config.ts` e `tsconfig.json`: **il primo lancio
  sarà un commit separato, solo di formattazione, deciso a parte**. Fino
  ad allora nessun `prettier --write` su file interi, e nessuna
  formattazione al salvataggio nell'editor
- Non è collegato a ESLint (`eslint-config-prettier`): le regole attive
  non hanno conflitti con Prettier (verificato l'11/10). Si aggiunge se
  ne compare uno

Rinunce accettate rispetto al nativo: accesso ad Apple Health e discoverability
dello store. Nessuna delle due serve all'MVP.

---

## 9. Decisioni prese (4 settembre 2026)

### 9.1 Utenti — multiutente da subito

L'app nasce con **account separati per me e i miei amici**. Supabase Auth attiva
dal primo giorno, RLS su tutte le tabelle.

Conseguenze:
- ogni tabella ha `user_id` + policy RLS (vedi sezione 4)
- `alimenti` è l'eccezione: catalogo **condiviso**. L'etichetta scansionata da
  uno serve anche agli altri. Policy di lettura:
  `user_id is null or user_id = auth.uid()`
- **pagina di login vera dal primo giorno** (Supabase Auth, email + password).
  Non è una schermata "finta" da rifare dopo: è la stessa che servirà se un
  giorno l'app viene aperta a tutti
- in fase beta la **registrazione è chiusa**: chi si iscrive deve inserire un
  codice di invito, oppure la sua email deve essere in una allowlist. È un
  controllo di una riga, che si toglie senza toccare nient'altro il giorno in
  cui si apre
- l'apertura al pubblico è un'ipotesi tenuta viva dall'architettura, non un
  obiettivo dell'MVP
- **la conferma email è spenta** (scelta di Davide; verificato il 15/10:
  gli account nuovi risultano confermati nello stesso secondo della
  registrazione). Conseguenza: chi ha il codice di invito può
  registrarsi anche con un indirizzo che non riceve email, e allora
  "Password dimenticata" non gli funziona, perché il link non arriva. È
  il caso dell'account di prova A di Amici (sezione 11, "Account di
  prova"). **Spenta per la beta**: prima di un'eventuale apertura al
  pubblico va riaccesa, e va riprovato il percorso "registrazione senza
  sessione". Dal 16/10 lo username lo crea il trigger anche senza
  sessione (con un nome già preso `signUp` fallisce), quindi non resta
  più solo nei metadati; restano da provare il messaggio "controlla la
  tua email" e l'onboarding al primo accesso (voce qui sotto)
- **il segno dell'onboarding sta nei metadati dell'account** (campo
  `onboarding: "da_fare"`, scritto da `registrati` in `signUp` dal 17/10,
  branch `onboarding`; sezione 3, "Onboarding"). Il trigger di
  registrazione lo lascia passare: toglie solo `codice_invito` e riscrive
  solo `username`. Con la sessione la pagina Registrati fa un
  caricamento completo di `/onboarding`. Se un giorno si riaccende la
  conferma email, `signUp`
  non dà una sessione e la Server Action non può portare all'onboarding:
  il segno resta `da_fare` nei metadati, e l'onboarding parte al primo
  accesso, dalla guardia nel client (fatta il 17/10)

#### Il codice di invito anche nel database (deciso il 15/10, branch `amici`)

**Il buco.** Fino al 15/10 il codice lo controllava solo la Server Action
`registrati`: chiunque abbia la chiave pubblica dell'app (è nel browser per
costruzione) può chiamare `auth.signUp` direttamente e registrarsi senza.
Si chiude nello stesso trigger su `auth.users` che crea lo username
(sezione 3, "Amici").

**Il trigger** (due, sulla stessa tabella, con funzioni `security
definer` e `search_path = ''`):
- **`BEFORE INSERT`**: legge `codice_invito` dai metadati della
  registrazione e lo confronta con quello salvato (sotto). Codice
  mancante o sbagliato → errore, l'account non nasce. Controlla anche il
  formato dello username. Poi **toglie `codice_invito` dai metadati**,
  così il codice non resta salvato nella riga dell'utente. Dal passo 3
  (15/10) la pagina Registrati lo manda già, prima che il trigger ci sia:
  chi si registra nel frattempo lo ha nei metadati. La migration del
  trigger lo toglie anche da quelle righe
  (`raw_user_meta_data - 'codice_invito'`)
- **`AFTER INSERT`**: crea la riga in `nomi_utente` dallo `username` dei
  metadati (prima la riga in `auth.users` non esiste, e la foreign key
  la rifiuterebbe). Nome già preso → errore, e la registrazione viene
  annullata tutta. Lo `username` resta nei metadati come "nome alla
  registrazione", ma l'app non lo legge mai: vale `nomi_utente`
- vale per **ogni** riga nuova in `auth.users`, anche per gli utenti
  creati dalla dashboard di Supabase: da qui in poi gli account nascono
  solo dall'app
- **ordine dei rilasci**: prima in produzione la pagina Registrati che
  manda `codice_invito` e `username` nei metadati (innocui finché il
  trigger non c'è), poi il trigger. Al contrario, nella finestra fra i
  due nessuno potrebbe registrarsi dalla pagina di produzione: le
  anteprime usano lo stesso Supabase, quindi il trigger si applica **dopo
  il merge** di `amici`, non durante il branch. Ordine deciso il 15/10:
  merge → deploy di produzione **Ready** → prove nel blocco SQL annullato
  → applicazione → una registrazione vera.
  Fino ad allora lo username di chi si registra (anche gli account di
  prova) lo salva la Server Action con `imposta_username`: la conferma
  email è spenta, quindi dopo `signUp` c'è già la sessione (sezione 3,
  "Lo username"). Dopo l'applicazione, una registrazione vera con un
  account usa e getta
- **è il punto più delicato del lavoro**: un errore nel trigger blocca
  tutte le registrazioni. Prima di applicarlo, prove in un blocco SQL
  annullato: registrazione valida, username preso, formato sbagliato,
  codice sbagliato, codice mancante
- **Stato (16/10, passo 8, su main): fatto.** Due migration applicate,
  tre trigger attivi su `auth.users`:
  - `trigger_registrazione` (versione **20261016112900**): applicata da
    Davide dal SQL Editor, per sbaglio al posto del blocco di prove;
    registrata da Cowork in `schema_migrations` con created_by
    "sql-editor (Davide)". Funzioni `public.controlla_registrazione()`
    (BEFORE INSERT) e `public.crea_nome_utente_registrazione()` (AFTER
    INSERT), trigger con gli stessi nomi. Il 16/10, prima, su
    `auth.users` non c'era nessun altro trigger. Il BEFORE, oltre a
    togliere `codice_invito`, **riscrive lo `username` dei metadati già
    normalizzato** (minuscolo, senza spazi ai bordi): il "nome alla
    registrazione" coincide con la riga di `nomi_utente`. Messaggi
    d'errore che cominciano tutti con "registrazione rifiutata:" (codice
    di invito non configurato / non valido, username non valido / già in
    uso), mai con il codice dentro: GoTrue all'app manda solo un errore
    generico, il motivo si legge nei log;
  - `registrazione_pulizia_codice` (versione **20261016113910**):
    applicata da Cowork con `apply_migration`, dopo il blocco di prove
    annullato **58/58 ok** eseguito da Davide. Funzione e trigger
    `public.togli_codice_invito()`, **BEFORE UPDATE**, con `WHEN` sulla
    presenza della chiave: se i metadati sono un oggetto JSON e hanno
    `codice_invito`, lo toglie. **Non dà mai errore** (scatta anche a
    ogni accesso e aggiornamento di GoTrue): nessun raise, metadati null
    o non oggetto lasciati come sono. Nella stessa migration la pulizia
    dell'account che aveva ancora la chiave.
- **Perché il terzo trigger** (difetto trovato il 16/10 con la prima
  registrazione vera; causa verificata da Cowork sui dati). Il BEFORE
  INSERT toglie `codice_invito`, ma circa 100 ms dopo GoTrue fa un
  UPDATE di `raw_user_meta_data` (aggiunge `sub`, `email`,
  `email_verified`, `phone_verified`) partendo dalla **sua copia in
  memoria**, che il codice lo aveva ancora. Togliere la chiave
  all'inserimento non basta: si toglie a ogni scrittura.
- **Verifiche di Cowork (16/10)**: 3 trigger attivi; funzioni security
  definer, owner postgres, non eseguibili da anon e authenticated;
  segreto `codice_invito` presente; nessun account con `codice_invito`
  nei metadati; advisors senza avvisi nuovi. Due registrazioni vere da
  app-libra: davidemancon02+trigger@gmail.com (username `test`, 13:31,
  ha fatto scoprire il difetto) e davidemancon02+trigger2@gmail.com
  (username `prova_trigger2`, 13:42, dopo la correzione: metadati senza
  codice). Da lì gli account nascono solo dall'app, con codice e
  username

**Dove sta il codice (deciso il 15/10).** Nel **Vault di Supabase** (`supabase_vault`, già installato nel
progetto), un segreto di nome `codice_invito`: cifrato sul disco, non
esposto dall'API, leggibile solo dalle funzioni del database. Non nel
client, niente `NEXT_PUBLIC_`. La variabile `CODICE_INVITO` su Vercel e
in `.env.local` resta: alla Server Action serve per dire "Codice di invito
non valido." invece dell'errore generico che GoTrue restituisce quando il
trigger rifiuta. Il database è la garanzia, la Server Action il messaggio.
- **Senza il segreto** (cancellato per sbaglio) il trigger rifiuta tutte
  le registrazioni: direzione sicura, mai registrazione aperta per un
  dato mancante
- **Aprire al pubblico**: una migration che toglie il controllo dalla
  funzione del trigger, più la riga nella Server Action

**Cambiare il codice di invito**, passo per passo. **I due valori, su
Vercel e nel Vault, devono coincidere**: se sono diversi, chi scrive il
codice di Vercel passa la Server Action ma viene rifiutato dal trigger con
l'errore generico, e chi scrive quello del Vault si ferma a "Codice di
invito non valido." In pratica nessuno si registra finché non coincidono.
1. Scegliere il codice nuovo. Non va scritto in nessun file del
   repository (`.env.local` non si committa mai, CLAUDE.md).
2. **Vercel**: progetto → Settings → Environment Variables →
   `CODICE_INVITO` → Edit, valore nuovo, per l'ambiente Production (e
   Preview, se si prova la registrazione da un'anteprima) → Save.
3. **Redeploy**: Deployments → l'ultimo deploy di Production → "…" →
   Redeploy. La variabile nuova vale solo dal deploy successivo; aspettare
   lo stato **Ready**.
4. **Vault**: dal SQL Editor di Supabase
   `select vault.update_secret((select id from vault.secrets where name =
   'codice_invito'), '<nuovo>');`
5. **Verifica**: `select count(*) from vault.decrypted_secrets where name
   = 'codice_invito' and decrypted_secret = '<nuovo>';` deve dare 1. Poi,
   se serve un account, una registrazione vera dall'app con il codice
   nuovo.
6. In locale, se serve provare la registrazione da `npm run dev`,
   aggiornare anche `CODICE_INVITO` in `.env.local`.

**La prima volta** il segreto non esiste ancora, e non può nascere dal
file della migration: il codice finirebbe nel repository. Lo crea Davide
dal SQL Editor, con lo stesso valore di `CODICE_INVITO` su Vercel,
**prima** di applicare la migration del trigger:
`select vault.create_secret('<codice>', 'codice_invito');`, poi la
verifica del passo 5. Senza il segreto il trigger rifiuterebbe tutte le
registrazioni.

Fra il passo 3 e il 4 i due valori sono diversi e nessuno si registra:
pochi minuti, accettabile per una beta di amici. I passi si fanno uno
dopo l'altro, senza lasciare la procedura a metà.

#### Il ripristino della password (dal 10/10, branch `reset-password`)

`/password-dimenticata` chiede il link (`resetPasswordForEmail`, flusso
PKCE: il browser salva un "code verifier" nei cookie). Il link
dell'email passa dal server di Auth e torna a `/reimposta-password`:
con `?code=` se il link è buono, **senza** `?code=` e con l'errore
nell'indirizzo (query e hash, `error_code=otp_expired`) se è già usato o
scaduto. Le regole della pagina:

- **Lo scambio del codice lo fa la libreria, la pagina ne legge solo
  l'esito.** Il client Supabase è uno solo per pagina e appena nasce
  scambia da solo il `?code=` (`detectSessionInUrl`), se trova il
  verifier; dopo lo scambio riuscito toglie `?code=` dall'indirizzo. La
  pagina chiama `initialize()`, che restituisce l'esito dell'avvio già
  partito senza rifarlo. Mai `exchangeCodeForSession` a mano: era il
  bug del 10/10, il secondo scambio trovava il verifier già cancellato.
- **L'errore nell'indirizzo prima di tutto.** Se `initialize()` dà
  errore (link già usato o scaduto, server che rifiuta il codice, rete)
  si mostra l'errore, anche con una sessione aperta nel browser. Il
  testo si sceglie dal codice dell'errore, non dal testo inglese
  (`traduciErroreLinkRipristino`): `otp_expired`, `flow_state_*`,
  `bad_code_verifier` → "link scaduto, già usato o superato".
- **Una sessione aperta non basta.** Con `?code=` il modulo compare solo
  se la libreria l'ha tolto dall'indirizzo, cioè se la sessione è nata
  da quel link; se è ancora lì manca il verifier (altro browser) → testo
  "funziona solo nel browser da cui l'hai chiesto". Altrimenti una
  sessione già aperta, per esempio l'account di prova in Safari,
  riceverebbe la password nuova di un altro account.
- **Il segno per il ricaricamento.** Dopo lo scambio riuscito la pagina
  scrive l'id dell'utente in `sessionStorage` (vale per una scheda,
  sopravvive al ricaricamento: Safari su iPhone ricarica da solo le
  schede rimaste dietro). Senza codice né errore il modulo ricompare solo
  se la sessione è di quell'utente. Il segno si toglie dopo il
  salvataggio, e la pagina esce dalla cronologia (`router.replace`).
  Senza memoria disponibile non c'è segno → errore (direzione sicura).
  Scartato il claim `amr`: "recovery" resta per tutta la sessione.
- **L'email nel modulo.** Campo "Account" in sola lettura con
  `autoComplete="username"`: si vede a quale account si cambia la
  password, e il gestore delle password la salva su quell'email.
- `/password-dimenticata` e `/reimposta-password` sono sempre accessibili
  (middleware): da loggati non rimandano alla home. Chiedere un reset è
  già possibile a chiunque.

Codice: `src/app/reimposta-password/page.tsx`, `src/lib/erroriAuth.ts`,
`src/lib/segnoRipristinoPassword.ts`. Test:
`reimpostaPassword.test.tsx` (client Supabase vero, rete finta). I
limiti noti stanno in §11, "Difetti e verifiche aperti".

### 9.2 Offline — local-first completo

**IndexedDB è la fonte di verità.** La UI legge e scrive sempre in locale;
Supabase è la copia remota che si allinea quando c'è rete, **nei due sensi**.

Come, in concreto:
- **Dexie** per il database locale
- un livello *repository*: **la UI non chiama mai Supabase direttamente**
- **outbox (salita)**: ogni mutazione entra in una coda locale, che si svuota
  verso Supabase quando la rete torna (`src/lib/sync/outbox.ts`,
  `sincronizza.ts`)
  - **l'ordine della coda** (dal 9/10): prima i genitori, poi i figli,
    secondo le foreign key del server (`ordinaOutbox`). Livello 0:
    `profili`, `obiettivi`, `pasti`, `alimenti`, `giorni`, `misurazioni`;
    livello 1: `obiettivi_target`, `voci_diario`, `composizioni`,
    `preferiti`; livello 2: `composizioni_voci`. Dentro lo stesso livello,
    `creato_il`. Fino all'8/10 era solo `creato_il`, ma riscrivere una
    riga già in coda le dà un `creato_il` nuovo: un genitore corretto dopo
    i suoi figli (un alimento creato offline, registrato, poi corretto)
    partiva dopo di loro, il server rifiutava il figlio, la coda si
    fermava e dopo 5 giri il figlio veniva accantonato, mai arrivato.
    Mandare un genitore "troppo presto" non rompe niente: ogni riga vince
    da sola e le cancellazioni sono logiche. Una tabella nuova deve avere
    il suo livello, altrimenti TypeScript non compila
  - le scritture del repository si possono fare **dentro una transazione
    Dexie** (tutto o niente): la sync che ogni scrittura fa partire esce
    dalla transazione (`Dexie.ignoreTransaction`) e legge la coda solo
    dopo il commit. **La funzione passata a `db.transaction` deve essere
    `async`** (`async () => { … }` oppure `async () => await f()`), mai
    `() => f()` che restituisce la promise di un'altra funzione: in quel
    caso Dexie perde la transazione dopo la prima scrittura, le altre
    finiscono fuori, e il "tutto o niente" non vale più (trovato il 15/10
    dai test di `ripristinaAlimenti`, con PrematureCommitError)
  - **una sincronizzazione per volta** (dal 9/10): se un giro è in corso,
    una chiamata nuova non ne apre un altro ma ne prenota **uno** dopo,
    condiviso da tutte quelle arrivate nel frattempo (il giro in corso può
    aver letto la coda prima delle loro voci). Vale per ogni innesco,
    perché passano tutti da `sincronizzaOutbox`: le scritture, l'avvio,
    `online`, il ritorno in primo piano, "Sincronizza ora", Esci, il
    ripristino. Prima ogni chiamata faceva un giro suo: le 14 scritture di
    una transazione facevano 14 giri in parallelo, 196 invii invece di 14
  - **la coda si ferma al primo errore; una voce si accantona dopo 5
    rifiuti del server** (`sospesa_il`: resta in Dexie, esclusa dai giri,
    così non blocca le altre). Conta come rifiuto solo una risposta del
    server sulla riga, decisa dallo status HTTP e non dal testo
    dell'errore (dal 10/10): con status 0 (la richiesta non è arrivata:
    niente rete, rete caduta) o 401 (sessione scaduta) la coda aspetta il
    giro dopo senza contare tentativi. Un'eccezione durante l'invio invece
    conta: senza rete Supabase risponde con status 0 e non lancia, quindi
    un'eccezione è più probabilmente un guasto su quella riga, che se non
    contasse fermerebbe la coda per sempre. Prima contava ogni fallimento, e
    offline, dove ogni scrittura fa un giro, dopo 5 scritture la prima
    voce veniva accantonata senza che il server l'avesse mai vista.
    Rischio accettato: un guasto permanente che arriva come status 0
    ferma la coda senza accantonare; non si perde niente, e l'indicatore
    di sincronizzazione lo mostrerà come un'attesa che dura
- **un tempo massimo per ogni richiesta** (dal 10/10): dopo 30 secondi
  senza risposta la richiesta viene **annullata**. Prima non c'era: su
  iPhone, con l'app in background a metà di una richiesta, la fetch può
  non rispondere più, il giro restava "in corso" per sempre e ogni giro
  nuovo si prenotava dietro di lui.
  - **dove**: nella fetch del client Supabase del browser
    (`src/lib/supabase/fetchConScadenza.ts`, passata a `createClient` con
    `global.fetch`), quindi per ogni richiesta, compresi accesso ed Esci.
    Per la libreria un annullamento è una fetch fallita: status 0, cioè
    rete assente, nessun tentativo contato. In discesa la pagina fallisce
    e la tabella non sposta il cursore
  - **annullare, non abbandonare**: una richiesta solo abbandonata può
    arrivare al server dopo. Un invio "100 g" appeso scade, l'utente
    corregge in 150 g, il giro dopo manda 150 g, poi arriva il vecchio e
    riscrive 100 g: le tabelle hanno solo il trigger `set_updated_at`,
    vince l'ultima scrittura che arriva. Server a 100 g, telefono a 150 g,
    coda vuota. Rischio residuo in sezione 11
  - **con un `AbortController`, non `AbortSignal.timeout()`**: quello
    annulla con un errore "TimeoutError", e la libreria ripete da sola le
    letture fallite che non sono un "AbortError" (fino a tre volte, ognuna
    con altri 30 secondi)
  - **rete di sicurezza**: `conTempoMassimo` (`src/lib/sync/tempoMassimo.ts`)
    fa correre ogni richiesta della sync contro un timer di 35 secondi,
    per il caso in cui l'annullamento non chiuda la richiesta. Di norma
    non scatta mai
  - trenta secondi e non meno perché una pagina della discesa può avere
    500 righe: un limite stretto farebbe fallire a ripetizione la prima
    discesa di un dispositivo nuovo su una rete lenta
- **discesa**: legge da Supabase le righe cambiate e le scrive in Dexie
  (`src/lib/sync/discesa.ts`) — senza questa metà, Supabase era solo una
  destinazione: un dispositivo nuovo non vedeva mai i dati già presenti sul
  server, e due dispositivi divergevano senza riallinearsi mai. **Incrementale**
  per tabella: un cursore locale (`sync_cursori`, mai sincronizzato a sua
  volta) tiene il `updated_at` più recente già scaricato, non l'intera
  tabella ogni volta
  - **paginata** (`.range()`, ordinata per `updated_at`): PostgREST applica
    un tetto di righe per risposta (Supabase, Settings → API → Max Rows,
    default tipico 1000 — da verificare a mano nel dashboard, non è un
    parametro leggibile da SQL). Senza paginazione, la prima discesa di un
    dispositivo nuovo su una tabella più grande del tetto (un diario supera
    facilmente le mille voci in pochi mesi) riceverebbe un sottoinsieme
    arbitrario e le righe rimaste fuori non verrebbero mai più richieste
  - finestra di sicurezza sul cursore: interroga da (cursore − 1 minuto)
    con `>=`, non dal cursore esatto — il trigger che assegna `updated_at`
    usa l'inizio della transazione, non il commit, quindi due scritture
    quasi simultanee possono arrivare fuori ordine; riscaricare qualcosa di
    già noto è innocuo (`put` per id è idempotente), perderlo per sempre no
  - non sovrascrive una riga locale più recente di quella scaricata (utile
    quando c'è ancora una mutazione in coda outbox non confermata dal
    server) — confronto per istante (`getTime()`), non fra stringhe:
    PostgREST restituisce `updated_at` con 6 decimali e offset esplicito
    (`...619969+00:00`), il client con 3 decimali e `Z`
    (`new Date().toISOString()` → `...619Z`); confrontate come stringhe i
    due formati non ordinano in modo affidabile allo stesso istante
  - se una riga scaricata risulta cancellata (`deleted_at`), una voce
    outbox non ancora inviata per lo stesso id viene scartata **sempre**
    (loggata, non sparita in silenzio), **senza eccezioni sul confronto dei
    timestamp**: è l'unico caso in cui la voce esiste davvero proprio
    perché la modifica locale è successiva alla cancellazione (fatta offline,
    dopo che un altro dispositivo ha cancellato) — un controllo "solo se il
    server è più recente" lascerebbe passare esattamente il caso reale.
    La cancellazione vince anche sulla copia locale in Dexie, per lo stesso
    motivo: altrimenti la riga resterebbe visibile per sempre su quel
    dispositivo con una modifica ormai orfana, che non raggiungerà mai il
    server
  - **limite: il modello si regge sul fatto che la cancellazione fisica non
    esista mai** — si scrive `deleted_at`, la discesa lo propaga come un
    campo qualsiasi (punto sopra). Una riga cancellata FISICAMENTE dal
    server (`DELETE` da SQL Editor, non dall'app) è indistinguibile per la
    discesa da una riga mai esistita: nessuna versione con `deleted_at`
    arriva mai, quindi nessun dispositivo che la ha già in Dexie la toglie.
    Alla prima salita quel dispositivo la rimanda su com'era — la
    resuscita. **Regola operativa per lo sviluppo**: svuotare una tabella
    su Supabase (SQL Editor, reset dei dati di test) richiede di svuotare
    anche IndexedDB su OGNI dispositivo che ha usato quell'account, non
    solo il server — altrimenti il primo dispositivo rimasto indietro
    riporta indietro i dati appena cancellati. Non è un rischio per gli
    utenti (loro cancellano solo dall'app, mai da SQL Editor), è un
    promemoria per chi sviluppa. Per svuotare IndexedDB di un dispositivo
    senza passare dalle impostazioni del browser (su iPhone non ha
    funzionato) c'è "Ricarica i dati dal tuo account" in Impostazioni > Sincronizzazione — vedi
    "Ripristino dei dati locali" più sotto
  - tre inneschi, condivisi con la salita: montaggio dell'app, ritorno
    online, ritorno in primo piano della PWA (`visibilitychange`). Niente
    polling a intervalli, niente Supabase Realtime — l'uso tipico
    ("apro, registro, chiudo") non ne trae beneficio e Realtime aggiunge
    complessità senza bisogno
  - la discesa gira sempre prima della salita, agli stessi inneschi: riduce
    (non elimina) la finestra in cui una modifica locale in coda potrebbe
    sovrascrivere sul server qualcosa cambiato nel frattempo altrove — non
    la elimina perché una voce outbox già in coda è uno snapshot congelato
    al momento della modifica, non si aggiorna da sola quando la discesa
    scrive Dexie. Rischio residuo accettato, coerente con "mono-dispositivo
    alla volta" più sotto
- sincronizzazione **last-write-wins per riga**, basata su `updated_at`. Niente
  CRDT: i dati sono mono-utente e mono-dispositivo alla volta, i conflitti veri
  sono quasi impossibili
- service worker per l'app shell → l'app si apre anche senza rete
  (`public/sw.js`, scritto a mano, senza librerie). Strategia per tipo di
  richiesta, decisa da una funzione pura con test
  (`public/sw-strategia.js`, `src/lib/swStrategia.test.ts`):
  - **file con nome versionato** (`/_next/static/`, `/icons/`,
    `/apple-touch-icon.png`): prima la cache. Il nome cambia a ogni
    modifica, quindi una copia non è mai vecchia
  - **le pagine dell'app** (`PAGINE_APP`: `/`, `/aggiungi`, `/statistiche`,
    `/impostazioni` e le sue sotto-pagine, dal 3/10 al posto di `/profilo`):
    prima la rete, e se risponde se ne salva una copia (chiave = percorso,
    senza query). Offline si usa la copia; se manca, `/offline.html` ("Sei
    offline"). Non si salvano risposte non ok né redirect (il middleware
    rimanda a `/login` chi non è entrato). Una pagina si salva **solo dopo**
    che tutti i file che cita (JS, CSS e i font citati dal CSS) sono in
    cache: mai una copia che cerca file assenti
  - **altre navigazioni** (login, registrazione, password): solo rete,
    offline "Sei offline". Per entrare serve comunque la rete
  - **richieste RSC** (header `RSC: 1`, parametro `_rsc`: i dati con cui la
    tab bar cambia pagina): solo rete, mai in cache. Se falliscono, Next 16
    ripiega da solo su una navigazione completa (verificato in
    `fetch-server-response.js`), che trova la copia della pagina. Metterle
    in cache era il difetto della prima versione: un'app rimasta aperta
    dopo un deploy riceveva dalla cache pagine della build vecchia, che
    Next accettava perché uguali alla build ancora in memoria — e non
    scopriva mai il deploy
  - **tutto il resto**, Supabase compreso: il service worker non interviene
  - **riscaldamento**: con un utente entrato e la rete, l'app chiede al
    service worker di scaricare tutte le `PAGINE_APP` e i file che citano
    (l'elenco si legge dall'HTML delle pagine: nella build di Next 16 con
    Turbopack ogni file JS è citato da almeno una pagina). Così offline si
    apre anche una scheda mai visitata. A ogni riscaldamento si cancellano
    prima le copie delle pagine tolte dall'elenco (`pagineDaTogliere`, dal
    3/10: la vecchia `/profilo`), poi i file che nessuna pagina salvata
    cita più (i deploy vecchi). Senza il primo passo una copia rimasta
    terrebbe in cache per sempre i file che cita
  - **Esci** svuota le pagine salvate (i file statici restano: non hanno
    niente dell'utente)
  - due cache, `nutritrack-statici-v7` e `nutritrack-pagine-v2` (all'11/10;
    il nome resta "nutritrack" anche dopo la rinomina, sezione 7, "Nome e
    icona"); `activate` cancella tutte le altre. Il numero si alza solo se
    cambia la forma di ciò che è salvato, `offline.html` o le icone
  - scartato Serwist (`@serwist/turbopack` 9.5.12): per Turbopack è un
    ripiego dichiarato (route handler + esbuild), non salva le pagine HTML
    (le nostre stanno dietro il login, il riscaldamento andrebbe scritto
    comunque) e le sue regole predefinite scadono dopo 24 ore e mettono in
    cache le RSC. Da rivedere se arriveranno file caricati a richiesta
    (es. OCR con `next/dynamic`), che l'HTML non cita: oggi verrebbero
    salvati solo al primo uso online

**Checklist B.7 (CLAUDE.md): un test permanente, non una prova sul
telefono** (dal 2026-10-09, `src/lib/db/aggiornamentoSchema.test.ts`).
Sul telefono la prova non si può fare: anteprima e produzione sono
indirizzi diversi, con database diversi. Il test apre un IndexedDB
(quello finto di `fake-indexeddb`, con le stesse regole) alla
`version(3)`, `(4)` e `(5)`, con lo schema di allora copiato fisso e righe
realistiche in tutte le tabelle, compresa la coda outbox (anche senza
`sospesa_il`, com'era prima della 4). Poi lo riapre con la classe vera
dell'app e controlla che le righe ci siano tutte, identiche, che gli
indici funzionino e che i campi nati dopo si leggano con il loro ripiego.
Copre quindi anche la 4 e la 5, verificate prima solo leggendo il codice.
A ogni versione nuova si aggiunge lo schema di quella precedente al test.

**Due schede aperte durante un aggiornamento** (solo da computer: su
iPhone Safari e l'app installata hanno memorie separate). La scheda
nuova apre la versione nuova; IndexedDB chiede a quella vecchia di
chiudersi, e Dexie (4.4.5) lo fa da solo, con un avviso in console. La
vecchia non si rompe: alla prima operazione si riapre alla versione che
trova e continua a leggere e scrivere, con il suo codice vecchio, finché
non si ricarica. Funziona finché gli indici della versione nuova
contengono quelli della vecchia. Nessuno deve aggiungere un ascoltatore
di `versionchange` che impedisca la chiusura: la scheda nuova resterebbe
bloccata. Coperto dallo stesso test.

#### L'indicatore di sincronizzazione (dal 10/10, branch `sync-stato`)

Perché: per sapere se i dati erano arrivati al server bisognava guardare
Supabase a mano (il 20/9 una giornata intera; il 6/9 il profilo diceva
"Salvato." mentre la sync falliva in silenzio). Dove: in Impostazioni >
Sincronizzazione, in breve a destra della sua riga nell'elenco, e un
pallino sulla tab Impostazioni per gli errori (decisioni del 10/10).

**Lo stato** (`src/lib/sync/statoSincronizzazione.ts`), da due fonti,
senza polling:
- **la coda**, da Dexie (`outbox`): quante modifiche in attesa, da quando
  (il `creato_il` più vecchio: vale anche dopo un riavvio), quante
  accantonate. La pagina la legge con `useLiveQuery`. Ogni voce tiene
  anche lo status HTTP dell'ultimo invio fallito (`ultimo_status`, dalla
  `version(8)` di Dexie, facoltativo: le voci di prima non ce l'hanno),
  per i "Dettagli tecnici" delle accantonate;
- **i giri**, in memoria: per salita e discesa, in corso sì/no, esito
  dell'ultimo giro (`ok` / `rete` / `sessione` / `errore`, deciso dallo
  status HTTP con `esitoDaStatus`, la stessa regola dei tentativi), da
  quando dura l'esito e quanti giri di fila; per la discesa anche le
  tabelle non scaricate (`scaricaTutto` le restituisce). Lo aggiornano
  `sincronizza.ts` e `discesa.ts` a inizio e fine giro; la pagina lo legge
  con `useSyncExternalStore`. Non si salva: all'apertura parte comunque un
  giro;
- **l'ora dell'ultimo contatto riuscito** in `localStorage` (una chiave per
  dispositivo): si aggiorna solo quando un giro ha davvero parlato col
  server (una salita con la coda vuota non conta).

**Gli stati, uno alla volta, per priorità** (`statoDaMostrare`, funzione
pura con i test):
1. **accantonate** — modifiche su cui l'app ha smesso di riprovare;
2. **sessione scaduta** — un 401, in salita o in discesa;
3. **errore** — il server rifiuta, o una tabella non si scarica; porta da
   quando e, per la discesa, quali tabelle;
4. **in corso** — un giro che dura da almeno un secondo (prima no: un
   indicatore che lampeggia a ogni tap è rumore);
5. **in attesa** — N modifiche in coda, **da quando** (decisione del 10/10:
   un'attesa che dura giorni deve notarsi). Non compare per la voce di una
   scrittura appena fatta se l'ultimo giro era andato bene;
6. **sincronizzato** — con l'ora dell'ultimo contatto riuscito.

Un errore resta a schermo mentre parte il giro dopo: sparisce quando un
giro finisce bene. **Pallino** sulla tab: stati 1–3, il 3 dal secondo giro
fallito di fila. Arancio, sull'icona della voce Impostazioni, con un
bordo del colore della pillola (`usePallinoSincronizzazione`, disegnato in
`BarraNavigazione`). Mai per "senza rete", "in corso" o "tutto salvato";
si spegne da solo quando un giro finisce bene. Uno screen reader legge la
voce come "Impostazioni, sincronizzazione da controllare" (testo nascosto
alla vista, dopo il nome).

**La riga nell'elenco** di Impostazioni (dal 10/10, mockup "2 · Pallino +
testo"): a destra di "Sincronizzazione" un pallino colorato e lo stato in
breve (`rigaSincronizzazione`, `ValoreRigaSincronizzazione`). "Tutto
salvato" e "In corso…" in grigio come gli altri valori, con il pallino
verde (che pulsa in corso, fermo per chi ha chiesto meno movimento); "2 in
attesa" in ocra; "Errore", "Accedi di nuovo", "Da controllare" in arancio.
Stesso hook della pagina, quindi stesso stato.

**La pagina** (dal 10/10, mockup approvato
`docs/mockups/sincronizzazione.html`, "A · Riquadro"):
- in cima il **riquadro dello stato** (`RiquadroStatoSincronizzazione`):
  icona in un cerchio, titolo, testo e la riga "da quando" / "controllato
  alle" ("dalle 14:02", "da ieri alle 14:02", "da gio 8 ott alle 14:02").
  Testi in `testiSincronizzazione.ts`. Colori dai token: verde tutto a
  posto e in corso, ocra (`--attesa`, sezione 7) in attesa, arancio per
  sessione, errore e accantonate. "In corso" compare da solo dopo un
  secondo: l'hook `useStatoSincronizzazione` programma un timer per quel
  momento;
- **"Sincronizza ora"** (discesa e salita), spento mentre un giro è in
  corso. Con la sessione scaduta al suo posto c'è **"Esci e rientra"**: è
  Esci (`EsciAccount` con un'altra etichetta), stesso percorso: con la
  sessione scaduta e modifiche in coda non svuota niente (§9.6). Esci
  azzera anche lo stato dei giri in memoria;
- con modifiche accantonate, il gruppo **"Non salvate online"**
  (`ModificheAccantonate`): che cosa, quale e quando, in parole
  dell'utente; **"Dettagli tecnici" chiuso di default** (tabella,
  tentativi, status, errore: in futuro l'app potrebbe usarla qualcuno in
  famiglia); **"Riprova a salvarle"** (`riprovaAccantonate`: rimette in
  coda come nuove solo le voci di quell'utente, poi un giro). Niente
  "Scarta": c'è già "Ricarica i dati dal tuo account";
- in fondo, com'era, "Ricarica i dati dal tuo account".

Solo le voci dell'utente entrano nei conteggi e nell'elenco
(`codaDellUtente.ts`): su un dispositivo condiviso la coda può contenere
anche quelle di un altro (Esci non svuota con la sessione scaduta e
modifiche in coda, né i dati lasciati dalle uscite prima dell'11/10; 9.6).

#### Ripristino dei dati locali (deciso il 2026-09-25)

Impostazioni → Sincronizzazione → **"Ricarica i dati dal tuo
account"**: sostituisce i dati di questo dispositivo con quelli di
Supabase, senza uscire dall'account. È la via d'uscita generale quando il
locale è incoerente in un modo che la sync non ripara da sola (per esempio
righe cancellate fisicamente sul server, limite qui sopra); prima l'unica
strada era cancellare i dati del sito dalle impostazioni del browser, che
su iPhone non ha funzionato. Codice in `src/lib/sync/ripristino.ts`.

**Il caso che l'ha fatto nascere non l'ha risolto lui.** 10 pasti a schermo
invece di 5 (2026-09-25): si pensava a pasti con id casuali di prima del
passaggio agli id deterministici, rimasti solo sul telefono. Verifica su
Supabase: erano ancora sul server (creati il 2026-09-20 alle 20:11 UTC),
con 8 voci del Pranzo sotto il doppione — ricaricare dal server li avrebbe
riportati uguali. Si correggono sul server (voci spostate sui pasti con id
fisso, doppioni cancellati logicamente) e la discesa porta la correzione su
ogni dispositivo.

**Prima scarica, poi sostituisce** — mai "cancella e riscarica":
1. prova a inviare la coda outbox, poi conta ciò che resta;
2. l'utente conferma. Se ci sono modifiche non inviate la conferma lo dice,
   con numero e tipo, separando quelle **in attesa** ("modifiche non ancora
   salvate online") da quelle **accantonate** dopo troppi tentativi
   ("modifiche che l'app non è riuscita a salvare online, nemmeno
   riprovando"): anche queste ultime sono dati dell'utente, perderle va
   detto (regola B.5 di CLAUDE.md);
3. scarica TUTTE le tabelle in memoria, complete, senza cursore. Se anche
   una sola fallisce, non si tocca niente;
4. in una sola transazione Dexie (niente rete dentro): se fra le modifiche
   non inviate ce n'è una che l'utente non ha visto nella conferma (fatta
   durante lo scarico, o una seconda modifica della stessa riga — il
   confronto usa id + `creato_il`), non si tocca niente; altrimenti
   cancella i dati di questo utente, scrive le righe scaricate, riscrive un
   cursore per tabella al massimo `updated_at` scaricato. La discesa
   successiva riparte incrementale.

Scartato "cancella e riscarica": `scaricaTutto` non segnala le tabelle
fallite (resterebbero vuote); una discesa in background partita prima della
pulizia potrebbe riscrivere il suo cursore dopo, rendendo la riscarica
incrementale e perdendo le righe vecchie; `db.delete()` chiude il database
sotto le `useLiveQuery` aperte e si blocca con l'app aperta in un'altra
scheda. Con lo scarico in memoria una discesa in background che finisce
dopo può solo scrivere righe del server più recenti di quelle locali, e al
peggio riportare indietro un cursore (una riscarica in più, nessuna riga
persa).

**Solo i dati di questo utente.** Il dispositivo può contenere dati di un
altro utente (Esci non svuota con la sessione scaduta e modifiche in
coda, né i dati lasciati dalle uscite prima dell'11/10; §9.6): le sue
righe, le sue modifiche in coda e i suoi cursori restano intatti. Il
**catalogo condiviso** (alimenti con `user_id` null) non si cancella, si
sovrascrive con le righe scaricate: cancellarlo lascerebbe l'altro utente
con il cursore "alimenti" già avanti, e la sua discesa incrementale non lo
riscaricherebbe più. Sono righe in sola lettura (RLS), senza modifiche in
sospeso possibili. Limite accettato: una riga condivisa cancellata
fisicamente sul server resta sul dispositivo (stesso limite di sopra).

Nessun seed dei pasti predefiniti nel ripristino: i 5 canonici arrivano dal
server con il resto. Dal 3/10 il ripristino sta in una pagina senza moduli:
le pagine con un modulo (Profilo) leggono i dati da Dexie quando si aprono,
quindi dopo il ripristino mostrano già quelli nuovi. Prima, con Ricarica
dentro Profilo, il modulo andava ricaricato a mano — altrimenti avrebbe
mostrato i valori di prima, e un "Salva" li avrebbe rimandati al server
sopra quelli giusti.

`sostituisciDatiUtente` è separata apposta: con zero righe da scrivere è la
pulizia di Esci e della sua ripresa all'avvio (§9.6, "Esci svuota i dati
locali"), con lo stesso controllo delle firme. Test permanenti in
`src/lib/sync/ripristino.test.ts`.

Perché ora e non dopo: il local-first non è una feature, è *dove vive il dato*.
Aggiungerlo in seguito significa riscrivere ogni lettura e ogni scrittura
dell'app. Effetto collaterale previsto: con Tesseract nel browser, **l'app
funzionerà interamente offline, OCR compreso** — quando l'OCR ci sarà (oggi
non è ancora costruito, fase 5) **e a una condizione**: tesseract.js da solo
non è offline. Verificato nel codice della versione installata (7.0.0,
`src/worker/browser/defaultOptions.js`, `src/worker-script/browser/getCore.js`,
`src/worker-script/index.js`) e in `docs/local-installation.md` del
pacchetto: se non si indicano `workerPath`, `corePath` e `langPath`, scarica
tutto da jsDelivr —
- il worker (`tesseract.js@v7.0.0/dist/worker.min.js`, circa 0,1 MB);
- il core WebAssembly (`tesseract.js-core@v7.0.0`): una variante scelta in
  base al dispositivo, circa 3,9 MB con il modello predefinito (LSTM);
- i dati della lingua (`@tesseract.js-data/ita/4.0.0_best_int`,
  `ita.traineddata.gz`, circa 1,7 MB; 6,9 MB se servisse il modello
  "legacy").

Quindi circa **6 MB per dispositivo** al primo uso. Per l'OCR offline questi
file vanno **ospitati da noi** (in `public/`, con i tre percorsi impostati) e
salvati dal service worker: nomi e versioni fissi, non passano dal build di
Next, quindi la strategia di `sw-strategia.js` andrà estesa. Nella cartella
del core le varianti sono diverse (per dispositivi con e senza SIMD):
vanno copiate tutte, anche se ognuno ne scarica una sola.

**I 5 pasti predefiniti hanno id deterministico**, non casuale: UUID v5
calcolato da `user_id` + nome canonico (`src/lib/repository/pasti.ts`,
namespace fisso e immutabile — se cambiasse, ogni dispositivo esistente
ricalcolerebbe id diversi dagli stessi che ha già sul server). Due
dispositivi che seminano il set predefinito senza essersi mai sincronizzati
producono le stesse righe: `upsert()` le tratta come un aggiornamento della
stessa riga, mai come un doppione.

Conseguenza: l'indice unico `pasti_user_nome_idx` (che impediva due pasti
con lo stesso nome per utente) è stato **rimosso** — proteggeva solo
l'estetica (nessun'altra tabella usa `pasti.nome` come chiave, `voci_diario`
punta a `pasto_id`) al costo di poter bloccare in silenzio la coda outbox su
una violazione di vincolo. Con l'id deterministico il doppione che
giustificava l'indice non può più verificarsi per i pasti predefiniti.

**Seed dei pasti predefiniti: solo con il server vuoto** (deciso il
2026-10-07, `garantisciPastiPredefiniti` in `src/lib/repository/pasti.ts`).
I 5 pasti si creano solo quando l'app ha **visto** che l'utente non ne ha:
1. se Dexie ha già righe in `pasti` per quell'utente, vive o cancellate,
   non si scrive niente e non si legge il server (ogni apertura dopo la
   prima, anche offline);
2. altrimenti si contano le righe dell'utente su Supabase, **comprese le
   cancellate** (`contaRigheSulServer` in `discesa.ts`). Il conteggio non
   è incrementale: la discesa dal cursore restituisce 0 righe anche a un
   server pieno, quindi "0 righe scaricate" non vuol dire "server vuoto";
3. conteggio fallito (rete, sessione rifiutata: `anon` non ha `SELECT`,
   quindi è un errore e non uno zero) → **non si crea niente, mai**;
4. zero righe → si creano i 5, con gli id deterministici;
5. almeno una riga, anche solo cancellata → non si crea niente: si
   toglie il cursore dei pasti (con Dexie vuota non ha senso) e si
   scaricano le righe del server.

Non c'è un percorso di registrazione a parte: dopo `signUp` la Server
Action rimanda a Oggi, e il seed è questo stesso. Per un utente appena
registrato il server è vuoto e la registrazione richiede la rete, quindi
il punto 4 scatta subito.

**Cosa chiude.** Prima il seed creava le righe che mancavano *in Dexie*, e
`crea()` le mandava intere al server con i valori predefiniti e
`deleted_at` null: su un dispositivo vuoto con la discesa fallita (iPhone
nuovo, Safari in navigazione privata, dati del sito cancellati) **un pasto
cancellato tornava vivo** (difetto segnalato il 2026-09-25) e **un pasto
rinominato riprendeva il nome di fabbrica** su tutti i dispositivi
(trovato il 2026-10-07). Con la gestione dei pasti in mano all'utente
(Impostazioni > Pasti e orari) non sarebbe più stato un caso raro.

**Cosa costa.** Al primo avvio su un dispositivo vuoto, senza rete, i pasti
non ci sono: Oggi e Aggiungi mostrano "Serve la connessione" con
"Riprova" (`ServeConnessione`), e l'app riprova da sola all'evento
`online` del browser (`usePastiIniziali`). "Preparo i tuoi pasti…" resta
solo mentre la lettura è in corso. Una volta scaricati i pasti, l'app
funziona offline come prima. Il seed non ripara più un pasto predefinito
sparito per un bug: lo farebbe alla cieca, con lo stesso rischio.

**Limite noto, chiuso dal passo 4.** Un utente con righe in `pasti` sul
server ma nessuna viva non riceverebbe i predefiniti: dopo lo scarico
Dexie avrebbe solo righe cancellate, e Oggi resterebbe su "Nessun pasto in
questo giorno.". Dal 9/10 Pasti e orari non lascia eliminare l'ultimo
pasto, né lasciare senza pasti un giorno passato (sezione 3, "Elimina
pasto").

Strade scartate, da non riproporre: un seed "provvisorio" che trattiene la
salita fino a conferma del server (il blocco si propaga a ogni voce di
diario che punta a quei pasti) e la riconciliazione per nome (si rompe se
l'utente rinomina un pasto predefinito). Un segno sul profilo "pasti già
creati" non aggiunge niente: arriva con la stessa discesa che può fallire,
e il profilo nasce solo al primo Salva.

### 9.3 Precisione — sempre al grammo

Nessuna quantità approssimata: la quantità è **sempre in grammi**.

Per non pagare l'attrito su ogni pasto:
- il campo grammi è precompilato con `porzione_default_g` e **già selezionato**
- valore giusto → confermi (due tap in tutto)
- valore diverso → digiti il numero direttamente, senza cancellare nulla
- tastierino numerico, nessun menu a tendina

### 9.4 Catalogo — Open Food Facts via API, con copia all'uso

Nessun import massivo. La ricerca funziona a **tre livelli**, non due:

1. **catalogo locale** (IndexedDB): il set precaricato, i recenti, i preferiti e
   gli alimenti già usati — risponde istantaneamente e anche offline
2. **catalogo condiviso su Supabase**, se la ricerca locale non basta e c'è rete.
   **Questo livello mancava nella versione precedente del documento**, e senza di
   esso il catalogo condiviso non serve a niente: l'etichetta scansionata da un
   amico esiste nel database ma nessun altro riuscirebbe mai a trovarla, perché
   in locale non ce l'ha e su Open Food Facts non c'è
3. **Open Food Facts** via API, se non l'ha trovato nessuno dei due

**Oggi il livello 2 non serve.** La discesa (§9.2) scarica in Dexie **tutto**
il catalogo condiviso (le righe di `alimenti` con `user_id` null sono
leggibili da tutti, quindi arrivano a ogni utente), e la ricerca locale lo
trova già, anche offline. Va ripreso se il catalogo condiviso diventa troppo
grande per stare intero su ogni dispositivo — per esempio quando gli
alimenti copiati da Open Food Facts cominceranno ad accumularsi: a quel
punto la discesa del catalogo andrà limitata e la ricerca su Supabase
tornerà necessaria.

Quando scegli un alimento da OFF, viene **copiato nella tabella `alimenti`** con
`fonte = 'off'`, il barcode e `verificato = false`. Il catalogo cresce da solo
con quello che mangi davvero.

Perché non l'import massivo: il piano gratuito Supabase ha 500 MB e i dati OFF
sono spesso duplicati o incompleti. Perché non il solo manuale: i primi giorni
sono esattamente quelli in cui decidi se l'app ti piace.

Nota tecnica: l'API OFF richiede uno `User-Agent` identificativo e va usata con
un `debounce` sulla digitazione.

### 9.5 Perimetro — cosa non farà mai

*(confermato)*

- **Niente social**: nessun feed, nessun profilo pubblico, nessun confronto con
  altri utenti. **Eccezione decisa il 15/10: Amici** (sezione 3). Si può
  avere degli amici e mandare loro una copia di un alimento, niente di
  più: lo username si trova solo scrivendolo esatto (nessun elenco,
  nessuna ricerca parziale), un amico vede solo lo username, mai diario,
  peso, obiettivi o profilo, e niente classifiche o confronti. Gli avvisi
  sono un pallino dentro l'app, mai una notifica
- **Niente gamification**: nessuna streak, nessun badge, nessun punteggio. Saltare
  un giorno non è un fallimento da notificare
- **Niente giudizi sul cibo**: nessun alimento "sano" o "da evitare", nessun
  punteggio nutrizionale, nessun coaching non richiesto. L'app registra, non
  commenta
- **Niente pubblicità**, mai, in nessuna forma
- **Niente paywall sul nucleo**: registrare un pasto, vedere la giornata e le
  statistiche di base restano gratuiti per sempre. Se un giorno ci sarà qualcosa
  a pagamento, sarà solo su funzioni che hanno un **costo reale per me** (le API
  AI, in pratica), e mai una funzione esistente spostata dietro il paywall.
  Regola: la monetizzazione non può mai essere il motivo per cui l'inserimento
  di un pasto diventa più scomodo
- **Niente meal planner né liste della spesa**: è un'app che guarda al passato,
  non al futuro
- **Niente notifiche di promemoria pasto**: l'app non insegue l'utente
- **Niente integrazione con dispositivi fitness o Apple Health**
- **Niente condivisione con terzi** (nutrizionista, export medico)
- **Niente micronutrienti completi** (vitamine, minerali), né ora né dopo: solo
  i macro più zuccheri, fibre, saturi e sale

### 9.6 Privacy e riservatezza

Il diario alimentare è un dato personale delicato: peso, obiettivi e abitudini.
Il principio è che **nessun utente possa mai vedere i dati di un altro**, per
costruzione e non per attenzione.

- **RLS attiva su tutte le tabelle**, con policy `user_id = auth.uid()` come
  regola predefinita. Nessuna tabella parte senza RLS: su Supabase una tabella
  senza policy è leggibile da chiunque abbia la chiave pubblica dell'app
- Nessuna vista, nessuna classifica, nessuna funzione che aggreghi dati di più
  utenti
- Il diario, il peso e il profilo sono **privati e basta**: non sono condivisi
  nemmeno in forma anonima
- **Il catalogo `alimenti` è l'unica cosa condivisa**, e condivide solo dati di
  prodotto (nome, marca, valori per 100 g). Il `user_id` di chi ha creato la
  riga esiste nel database ma **non viene mai esposto all'app**: gli altri
  utenti vedono l'alimento, non chi l'ha inserito né quando
- **Eccezioni di Amici** (decise il 15/10, sezione 3 e sezione 4, "Le
  tabelle di Amici"), le uniche righe che riguardano due utenti:
  - lo **username** è leggibile solo da chi ha con te una riga di
    `amicizie` che può vedere (sezione 4); chiunque, anche senza
    account, può sapere solo se un nome **esatto** è già preso (`username_disponibile`, per la
    pagina Registrati), lo stesso che la richiesta di amicizia dice a chi
    è entrato. Nessuna funzione restituisce un elenco, un id o un nome
    che non hai scritto tu;
  - un **alimento mandato** porta a un amico una copia dei soli dati di
    prodotto (gli stessi del catalogo), con lo username di chi lo manda;
    chi lo manda non sa se è stato aggiunto o rifiutato;
  - le righe di `amicizie` mostrano a ciascuno dei due l'id dell'altro:
    serve a leggere il suo username, e non dice niente di più;
  - nessuna di queste regole tocca diario, peso, obiettivi, profilo,
    pasti salvati o preferiti, che restano `user_id = auth.uid()`
- **Avvisi di `get_advisors` accettati per Amici** (15/10), come per
  `elimina_mio_account`: un WARN
  `authenticated_security_definer_function_executable` per ogni funzione
  di Amici (sezione 4), e `anon_security_definer_function_executable` per
  `username_disponibile`. Sono voluti: le funzioni leggono righe di altri
  utenti che la RLS nasconde (per questo `security definer`), ma ciascuna
  agisce solo per chi la chiama, con i controlli scritti dentro, e
  restituisce un esito, mai dati di altri. `username_disponibile` è
  chiamabile senza account perché la pagina Registrati non ha ancora una
  sessione, e risponde solo sì o no sul nome esatto. Su Supabase non c'è
  un limite di frequenza per funzione: se un giorno servisse, una
  tabellina dei tentativi. Con la beta a inviti non serve
- I dati sul dispositivo (IndexedDB) vanno **cancellati al logout**: su un
  telefono condiviso resterebbero leggibili. Era rimandato finché l'app
  girava su dispositivi personali; è pubblica dall'11/10. Costruito e
  provato nel branch `esci-svuota` (decisioni sotto; §11, "Fatto")
- Se un giorno l'app si apre al pubblico servono anche informativa privacy,
  export dei propri dati e cancellazione dell'account. In Europa i dati
  nutrizionali collegati a peso e obiettivi ricadono in una categoria protetta,
  quindi quel passo va preparato, non improvvisato. La cancellazione
  dell'account è costruita nel branch `elimina-account` (sotto)

#### Elimina il mio account (decisioni dell'11/10, branch `elimina-account`)

- **Lato server, una funzione Postgres**: `public.elimina_mio_account()`,
  `security definer` con `search_path = ''`, senza parametri. Cancella da
  `auth.users` la riga con `id = auth.uid()`; errore se `auth.uid()` è
  null. **Idempotente**: se l'utente non c'è più cancella 0 righe e
  risponde ok, così ritentare dopo una risposta persa non fa danni.
  `revoke execute` da `public` e `anon`, `grant` solo ad `authenticated`.
  L'app la chiama con `supabase.rpc` da un modulo in `/lib`, mai dal
  componente
- **Applicata l'11/10**, versione 20261011155326, file
  `supabase/migrations/elimina_mio_account.sql`. Il connettore rifiutava
  `apply_migration` senza chiedere conferma (il DELETE nel testo): l'ha
  applicata Davide dal SQL Editor con il testo esatto e la riga di
  registrazione (sezione 8, "Migration che il connettore rifiuta").
  Verificato da Cowork: proprietario `postgres`, `security definer`,
  `search_path` vuoto; `has_function_privilege` falso per `anon`, vero
  per `authenticated`. Prova sull'account di prova in un blocco annullato
  apposta: da `anon` "permission denied"; da `authenticated` senza utente
  l'errore "nessun utente autenticato"; da account di prova utente
  cancellato, 0 righe nelle 11 tabelle, 0 identità, 0 sessioni; una
  seconda chiamata senza errore (idempotente); utenti 6 → 5, righe altrui
  311 → 311; tutto annullato, account intatto. `get_advisors`: solo il
  WARN atteso `authenticated_security_definer_function_executable`
- **Scartato**: un route handler Next con `auth.admin.deleteUser`. Vuole
  la chiave di servizio su Vercel (anche nelle anteprime, che usano il
  Supabase di produzione) e in `.env.local`: una chiave che può cancellare
  chiunque, esposta a ogni bug futuro del codice server
- **La cancellazione si propaga da sola**: dall'11/10 tutte le foreign key
  verso `auth.users` sono `CASCADE` (sezione 4; §11, "Fatto"), e nello
  schema `auth` identità, sessioni, refresh token e fattori MFA sono già
  `CASCADE` (letto in `pg_constraint` l'11/10). Nessun trigger su
  `auth.users`. Da verificare, non certo: cosa fa GoTrue in più con
  `deleteUser` (probabilmente una riga nel registro di audit, che qui
  manca)
- **Avviso di `get_advisors` accettato** (11/10): la funzione `security
  definer` eseguibile da `authenticated` dà un WARN. È voluto: cancella
  solo l'utente che la chiama, senza parametri, quindi nessuno può
  cancellare un altro. Eccezione decisa alla regola "nessun avviso nuovo"
- **Amici** (deciso il 15/10): le tre tabelle nuove hanno `ON DELETE
  CASCADE` su ogni colonna che punta a un utente, quindi
  `elimina_mio_account` (che fa solo `delete from auth.users`, verificato
  il 15/10) le copre senza cambiare. Per chi elimina: spariscono
  username (che torna libero), amicizie, richieste e alimenti mandati o
  ricevuti; sul dispositivo si cancella in più solo la chiave del
  pallino di Amici. Per l'altro utente l'amicizia e gli alimenti in
  attesa da quel mittente spariscono in silenzio; **le copie già
  aggiunte restano**, sono righe sue di `alimenti` senza legami. Lo
  username liberato può prenderlo un altro, ma la vecchia amicizia non
  passa a lui. Il testo della pagina si aggiorna (deciso il 16/10,
  branch `condivisione-alimenti`) con una voce in più: **"I tuoi amici e
  il tuo nome su Libra"**, dettaglio "Gli alimenti mandati e non ancora
  accettati spariscono; le copie già aggiunte dagli amici restano." Mai
  "username": la pagina ha un campo da solo (scrivi ELIMINA), e vale la
  regola di iPhone (sezione 3, "Lo username"). La prova della cascata
  con le tabelle nuove sta nel blocco annullato della migration
  `alimenti_condivisi` (le 14 tabelle a zero per chi elimina, la copia
  dell'amico viva, il nome di nuovo libero), e il 16/10 anche la prova
  vera: A eliminato con due condivisioni in attesa nei due sensi, tutto
  di A sparito, le copie già aggiunte da B rimaste, `@amici_uno` di nuovo
  libero, nessun altro utente toccato (verificato da Cowork)
- **File in Storage**: oggi zero. Quando ci saranno file dell'utente (la
  foto profilo), `elimina_mio_account` o il flusso che la chiama dovrà
  cancellare anche quelli: le foreign key non toccano i file
- **Sul dispositivo, solo dopo l'ok del server**: via le righe di questo
  utente nelle 11 tabelle Dexie, le sue voci di outbox (accantonate
  comprese) e i suoi cursori. Senza il controllo delle firme del
  ripristino: a server cancellato non c'è più niente da proteggere. Il
  catalogo comune e i dati di altri utenti sul dispositivo restano. Poi
  le pagine salvate dal service worker, la sessione (`scope: "local"`),
  lo stato dei giri, l'ora dell'ultimo contatto col server in
  `localStorage`, il segno del reset password in `sessionStorage`. Tema e
  colore restano: sono del dispositivo, non dell'account. Si atterra su
  `/login` con "Account eliminato"
- **Segno "eliminazione in corso"** in `localStorage`
  (`src/lib/account/eliminazioneInCorso.ts`), con l'id dell'utente e una
  fase. **"richiesta"** si scrive prima della chiamata; **"confermata"**
  appena il server dice di sì. Il flusso non toglie il segno
  "confermata" a pulizia finita: lo toglie il prossimo avvio, dopo una
  seconda pulizia (`cancellaDatiUtente` è idempotente). Così sono coperte
  la pulizia fallita a metà e una discesa partita prima che riscrive
  righe *dopo* la pulizia: al prossimo avvio nessuna discesa vecchia è
  più in corso (corretto l'11/10 scrivendo il codice: con il segno tolto
  a fine flusso questo secondo caso restava scoperto). All'avvio
  (`riprendiEliminazioneInSospeso`): "confermata" → si pulisce senza
  rete; "richiesta" → si chiede al server: "utente non trovato" (codice
  `user_not_found`) → si pulisce; lo stesso utente riconosciuto → la
  chiamata non era arrivata, si toglie il segno; tutto il resto (rete,
  sessione mancante o scaduta, un altro utente) → non si tocca niente e
  il segno resta. Da verificare nella prova vera che per un account
  cancellato il server risponda proprio `user_not_found`. Limite
  accettato: un segno "richiesta" con la sessione sparita resta lì
  finché non si può chiedere al server; i dati restano sul dispositivo,
  inerti. Test permanenti in `eliminazioneInCorso.test.ts` e
  `ripristino.test.ts`
- **Offline non si elimina**, come Esci: prima una chiamata vera
  (`getUser`). Risposta persa dopo la chiamata: di nuovo `getUser`;
  "utente non trovato" → si pulisce, errore di rete → "non so, riprova".
  Doppio tocco: pulsante disattivato durante l'operazione
- **Le modifiche non inviate si perdono** con tutto il resto: la conferma
  lo dice; non si contano e non si inviano prima
- **Altri dispositivi collegati**: il token d'accesso resta valido fino
  alla scadenza (circa un'ora, da verificare nelle impostazioni Auth).
  Intanto la discesa legge zero righe e la salita è rifiutata dalla
  foreign key verso `auth.users` (accantonata dopo 5 tentativi). Il
  rinnovo del token fallisce (refresh token cancellati) e l'app torna al
  login. I dati locali su quel dispositivo restano, come con Esci oggi:
  pulirli quando il server dice "utente non trovato" è lavoro a parte
- **Dove e come** (deciso l'11/10 sul mockup
  `docs/mockups/elimina-account.html`): la riga "Elimina il mio account"
  sta in fondo all'elenco Impostazioni, sotto Esci, in un gruppo suo;
  rossa (`--pericolo`, sezione 7), allineata a sinistra, con la freccia.
  Porta alla sottopagina `/impostazioni/elimina-account` ("‹
  Impostazioni" per tornare; va in `PAGINE_APP` del service worker come
  le altre). La pagina dice cosa viene cancellato (diario e pasti,
  alimenti creati, obiettivi e peso, preferiti e pasti salvati,
  l'account), "dal server e da questo telefono, comprese le modifiche non
  ancora inviate", "per sempre"; poi il campo "Per confermare scrivi
  ELIMINA" e un solo pulsante rosso, "Elimina il mio account". Sotto, la
  riga di stato. Scartate: la conferma dentro il gruppo, come Esci, e la
  riga in fondo a Profilo (Profilo è un modulo con la barra Salva in
  fondo, che mescolerebbe due flussi)
- **La parola**: "ELIMINA" con maiuscole e minuscole indifferenti
  ("elimina", "Elimina" valgono), tolti gli spazi ai bordi (sull'iPhone
  la tastiera mette da sola la prima lettera maiuscola). Il campo apre la tastiera in maiuscolo
  e senza correttore
- **Stati del pulsante**: spento finché la parola non è giusta; offline
  spento, con "Per eliminare l'account serve la connessione.";
  "Eliminazione…" con campo e pulsante spenti; errore di rete ("il tuo
  account non è stato toccato, riprova"); risposta persa ("non so se è
  andata, riprova"). Testi esatti nel mockup. In più, scoperto scrivendo
  il codice: **rifiuto del server** ("il server ha rifiutato la
  richiesta, il tuo account non è stato toccato": la funzione gira in
  una transazione) e **sessione non riconosciuta** ("esci e rientra, poi
  riprova": prima della chiamata il server deve riconoscere proprio
  questo utente)
- **Com'è fatto** (11/10): il flusso in `src/lib/account/eliminaAccount.ts`
  (verifica dell'utente, segno, chiamata, esito, pulizia, uscita), con la
  regola della parola (`parolaDiConfermaGiusta`); la pagina in
  `EliminaAccount.tsx`; la riga con `RigaImpostazioni pericolo`; la
  ripresa all'avvio in `RipresaEliminazioneAccount.tsx`, nel layout
  principale (gira anche sul login); il messaggio sul login con
  `?eliminato=1`. `useOnline` spostato da EsciAccount in
  `src/lib/useOnline.ts`, usato da tutti e due. Test permanenti in
  `eliminaAccount.test.ts`
- **Prova vera** su un account usa e getta,
  davidemancon02+elimina@gmail.com, creato da Davide dall'app. L'account
  di prova fisso non si tocca. **Fatta l'11/10** sull'anteprima del
  branch (§11, "Fatto"): riuscita. Non è entrato in gioco il percorso
  della risposta persa, quindi che il server risponda proprio
  `user_not_found` per un account cancellato resta da verificare

#### Esci svuota i dati locali (decisioni dell'11/10, branch `esci-svuota`)

- **Decide lo stato, non il pulsante**: "Esci" in fondo a Impostazioni ed
  "Esci e rientra" in Sincronizzazione fanno la stessa cosa. Prima si
  prova a inviare la coda, poi si conta ciò che resta dell'utente (in
  attesa e accantonate):
  - **offline** → non si esce, come prima. Il controllo con `getUser`
    passa **prima di tutto**, conferma compresa: una conferma "perdi N"
    offline sarebbe falsa;
  - **coda vuota** → si svuota senza chiedere;
  - **coda non vuota, sessione valida** → ciò che resta il server non lo
    prende da solo: conferma "perdi N", con **Resta** ed **Esci e
    perdile**. Arancio (`--avviso`), non rosso: il rosso resta solo per
    Elimina account (sezione 7). Testo: "Su questo telefono ci sono N
    modifiche che l'app non è riuscita a salvare online (tipi). Uscendo, i
    dati di questo telefono vengono cancellati: queste modifiche andranno
    perse.";
  - **coda non vuota, sessione non valida** (`getUser` risponde con un
    errore di autenticazione, non di rete) → **non si svuota niente**:
    rientrando con lo stesso account le modifiche partono. È il caso per
    cui esiste "Esci e rientra". Frase: "La sessione è scaduta: le tue N
    modifiche restano su questo telefono e partono appena rientri con lo
    stesso account." Su un telefono condiviso i dati restano: accettato,
    è l'unico modo per non perderli, e la frase lo dice
- **Cosa si svuota**: le righe, l'outbox e i cursori di questo utente
  (`sostituisciDatiUtente` con zero righe e le firme confermate: una
  modifica comparsa dopo la conferma, da un'altra scheda, fa saltare la
  pulizia e i dati restano), l'ora dell'ultimo contatto
  (`CHIAVE_ULTIMO_SUCCESSO`, prima di `azzeraStatoGiri` che la rilegge),
  il segno del reset password, lo stato dei giri, le pagine salvate.
  **Restano** tema e colore (preferenze del telefono, si vedono anche al
  login), il catalogo comune e i dati di altri utenti. Con Amici (15/10)
  si cancella anche la chiave del pallino di questo utente
  (`nutritrack:amici:novita:<id>`); in Dexie niente di nuovo, le tabelle
  di Amici sono solo online
- **Ordine: signOut → attesa delle discese in corso → pulizia**. Una
  discesa partita prima dell'uscita può finire dopo la pulizia e
  riscrivere righe **e cursore**: al rientro dello stesso utente la
  discesa ripartirebbe dal cursore e lo storico più vecchio non
  tornerebbe più. Per questo `attendiDiscesaInCorso()` (discesa.ts).
  Dopo signOut una discesa nuova fallisce alla prima pagina (il ruolo
  anonimo non legge), quindi non scrive niente
- **Segno `nutritrack:uscita`** (`{ idUtente }`, localStorage), come per
  Elimina account: scritto dopo signOut e prima della pulizia, tolto a
  pulizia riuscita. All'avvio: nessuna sessione o un altro utente → si
  ripete la pulizia di quell'utente; rientrato lo stesso utente → si
  toglie solo il segno (la pulizia è una transazione: se è fallita non
  ha toccato niente). Una pulizia fallita non ferma l'uscita
- **La salita invia solo le voci dell'utente della sessione** (bug
  trovato l'11/10, primo commit di codice del branch, da solo): oggi
  `unGiro` legge tutta l'outbox, e su un telefono con le modifiche
  lasciate da un altro utente le manda con la sessione sbagliata. Il
  server le rifiuta (403), contano come tentativi, bloccano la coda di
  chi è entrato e dopo 5 rifiuti vengono accantonate
- **Telefoni con dati vecchi**: le righe lasciate da uscite precedenti a
  questo rilascio (per esempio l'account di prova sull'iPhone di
  Davide) non si toccano. Restano invisibili (ogni lettura filtra per
  utente); cancellarle "per tutti gli utenti diversi da chi entra"
  toglierebbe anche i dati tenuti apposta con la sessione scaduta

---

## 10. Rischi noti prima di iniziare

Non sono feature: sono cose che costano poco adesso e care dopo, o buchi nel
piano che si presentano al primo giorno di sviluppo.

### 10.1 Il primo giorno il catalogo è vuoto

È il rischio più serio per il posizionamento. Un'app che promette "zero fatica"
la prima settimana non ha recenti, non ha preferiti e non ha catalogo: ogni
alimento va scritto a mano con i suoi valori. L'attrito è **massimo** proprio nel
momento in cui l'utente decide se l'app gli piace.

Rimedio, gratuito e da fare prima del lancio: **precaricare il catalogo con
150-200 alimenti comuni italiani** — pasta, riso, pane, uova, latte, petto di
pollo, tonno in scatola, olio, i formaggi e gli affettati più diffusi. Un file
CSV importato una volta, marcati `verificato`. Copre gran parte di quello che si
mangia davvero, e l'utente nuovo trova qualcosa fin dalla prima ricerca.

**Va precaricato anche in locale**, non solo su Supabase: al primo avvio
IndexedDB è vuoto, e un utente senza rete il primo giorno si troverebbe di nuovo
davanti al nulla. Il file viaggia dentro l'app e popola IndexedDB alla prima
apertura.

### 10.2 Se aggiungere costa un tap, annullare deve costarne uno

Il "+" sui recenti inserisce senza chiedere conferma. Bene — ma solo se sbagliare
è indolore. Dopo ogni inserimento, per qualche secondo, una barra in basso:
**"Aggiunto — Annulla"**. Costruita il 2/10: com'è fatta è nella sezione 3,
"Dopo ogni inserimento, «Annulla»".

Senza rete di sicurezza il tap veloce diventa un tap prudente, e il vantaggio
sparisce. È il complemento necessario della decisione, non un dettaglio.

### 10.3 Le chiavi API non entrano mai nel browser

Quando arriveranno le funzioni AI: **le chiamate partono da una Edge Function di
Supabase, mai dal client**. Una chiave in una variabile `NEXT_PUBLIC_` è
pubblica: chiunque apra gli strumenti da sviluppatore la vede, e la usa a spese
di chi l'ha messa lì.

Per un progetto a costo zero non è un dettaglio di sicurezza, è l'unica cosa che
separa "zero euro" da una bolletta a sorpresa.

### 10.4 Backup ed esportazione

Il piano gratuito di Supabase non garantisce backup gestiti come un piano a
pagamento, e i progetti inattivi vengono messi in pausa — è già successo a
`nutritrack`. Un anno di diario perso non si ricostruisce.

Due difese, entrambe gratuite: la copia locale IndexedDB (che c'è già, per altri
motivi) e un pulsante **"Esporta i miei dati"** in JSON o CSV. Vale anche come
promessa di riservatezza: i dati sono tuoi e te li puoi portare via.

### 10.5 Cinque funzioni da testare sul serio

Non serve testare tutto. Servono test su cinque pezzi di logica pura, che non
toccano né database né interfaccia e che sbagliano in modo silenzioso:

1. il calcolo dei totali giornalieri a partire dalle voci
2. le medie settimanali e mensili, **con giorni vuoti in mezzo** (sezione 3,
   Statistiche): è il caso che sbaglia più facilmente e non se ne accorge nessuno
3. **il target di una giornata**: dato un giorno, trovare il periodo valido a
   quella data e dentro quel periodo il set di target del tipo di giorno giusto.
   Sbagliarlo significa mostrare il numero principale della schermata principale
   errato, con l'aria di essere corretto
4. il giorno di un inserimento: la data dell'orologio locale, non quella UTC
   (`oggiLocale`), anche all'una di notte. Fino al 2 ottobre 2026 era la
   regola del giorno logico, ritirata (sezione 4, "Il giorno è quello del
   calendario")
5. la proposta del pasto in base all'ora, inclusi gli orari fra mezzanotte e
   il primo pasto (si propone il primo pasto)

Sono cinque funzioni, si testano con una manciata di casi. È il punto in cui un bug
non fa rumore: non crasha niente, i numeri sono solo un po' sbagliati — e te ne
accorgi mesi dopo.

Stato al 2026-10-02: hanno test permanenti la 1 (`totaliDiario.test.ts`), la
3 (`obiettivoValidoPer` in `totaliDiario.test.ts`, il ripiego sul target
"normale" in `obiettiviTarget.test.ts`), la 4 (`oggiLocale` in
`dataGiorno.test.ts`) e la 5 (`pastoPerOrario` in `propostaPasto.test.ts`). La 2 aspetta le Statistiche, che non esistono
ancora.

**Aggiornamento (6 settembre 2026):** Vitest + Testing Library + jsdom sono
configurati nel progetto — non solo per queste cinque funzioni, ma per ogni
bug di questa famiglia. Il primo caso reale non era nella lista sopra ma
identico nello spirito: una race condition tra `useUtenteId()` e
`useLiveQuery` nella pagina Profilo faceva sparire i dati precaricati al
refresh, perché una risposta "non so ancora" (`undefined`) veniva confusa con
"ho controllato, non c'è nulla" (`null`/`[]`). Corretto, e tenuto come test
permanente. Regola pratica: un bug di logica sottile (calcoli, race
condition, regole sulle date) diventa un test che resta nel
progetto; uno script di verifica manuale contro Supabase reale resta
temporaneo come prima.

### 10.6 Tre trappole del local-first

Conseguenze della sezione 9.2 che non erano state tirate fino in fondo.

- **L'annulla deve annullare anche la sincronizzazione.** Il pulsante "Annulla"
  del punto 10.2 non può limitarsi a cancellare la riga locale: se la mutazione
  è già entrata nell'outbox, va tolta dalla coda, e se è già partita serve una
  cancellazione logica che viaggi a sua volta. Altrimenti la voce riappare al
  primo sync
- **Il "last-write-wins" si fida dell'orologio del dispositivo.** Un telefono con
  la data sbagliata scrive un `updated_at` nel futuro e da quel momento vince
  ogni confronto, anche contro modifiche più recenti fatte altrove. `updated_at`
  va assegnato dal server quando la riga arriva; quello locale serve solo per
  l'ordine dentro il dispositivo
- **La sessione che scade offline non deve buttare fuori l'utente.** Il token
  Supabase si rinnova con la rete: dopo qualche giorno senza connessione, un
  controllo ingenuo porterebbe alla schermata di login — con i dati tutti lì in
  IndexedDB e nessun modo di entrare. La regola: **senza rete l'app resta
  utilizzabile con i dati locali**, e il login si richiede solo quando la rete
  c'è e il rinnovo del token fallisce davvero.
  Come, in concreto (`src/lib/supabase/utenteOffline.ts`, con test): offline
  e con il token scaduto supabase-js (auth-js 2.115) risponde "nessuna
  sessione" da `getSession()`, `getUser()` e `INITIAL_SESSION`, ma **non
  cancella la sessione salvata** nel cookie — la cancella (con
  `SIGNED_OUT`) solo quando il server la rifiuta davvero. Per Dexie basta
  l'id, non un token valido: se supabase-js dice "nessuna sessione" all'avvio
  e il cookie c'è ancora, `useUtenteId` prende l'id da lì. Un errore di rete
  non porta mai a "nessun utente"; ci portano solo `SIGNED_OUT` (Esci, o
  sessione cancellata da supabase-js) e un rifiuto vero di `getUser()`
  (nessuna sessione, 401/403/404: utente cancellato, sessione revocata)

### 10.7 L'aggiornamento della PWA

Trappola classica: una PWA installata tiene in cache il codice vecchio e continua
a servirlo dopo che hai pubblicato una versione nuova. Si corregge una volta
sola, nella configurazione del service worker, decidendo la strategia di
aggiornamento. Se ci si pensa dopo, si passa il tempo a chiedere agli amici di
disinstallare e reinstallare.

**Deciso** (strategie complete in 9.2): online vince sempre la rete per
pagine e RSC; solo i file con nome versionato stanno in cache "per sempre".
`sw.js` e `sw-strategia.js` sono serviti con `max-age=0` (`next.config.ts`),
il service worker nuovo entra subito (`skipWaiting` + `clients.claim`) e
cancella le cache con un nome diverso dal suo — così la vecchia
`nutritrack-v1`, con le RSC salvate, sparisce dai dispositivi al primo
aggiornamento.

### 10.8 Chi corregge il catalogo condiviso

Il catalogo è comune. Se un amico corregge i valori di un alimento, li corregge
per tutti. Non è un problema per la storia (le voci di diario hanno la loro copia
dei valori), ma serve una regola: **un alimento `verificato` non si modifica, se
ne crea uno nuovo**; gli alimenti non verificati sono correggibili da chi li ha
creati. Da rivedere solo se l'app si aprisse davvero al pubblico.

**E dev'essere una policy RLS, non una convenzione del codice.** Sulle righe con
`user_id IS NULL` la lettura è per tutti, ma l'`UPDATE` e il `DELETE` vanno
negati a tutti: altrimenti "condiviso" significa che chiunque può riscrivere i
valori nutrizionali di chiunque. La sezione 9.6 dice "per costruzione, non per
attenzione" — vale anche qui.

### 10.9 Le email di autenticazione sono in inglese

Sul piano gratuito, Supabase manda le email di auth (reset password, conferma
registrazione) con un servizio interno "usa e getta", pensato solo per basso
volume — e per questo **non permette di personalizzarne testo e oggetto**. Per
tradurle in italiano serve collegare un proprio server SMTP.

Non è un costo: **Resend** (3.000 email/mese gratis) o **Brevo** (300/giorno
gratis) bastano ampiamente per i volumi di questa app. È però una cosa in più
da configurare (un account esterno, una chiave in Supabase → Authentication →
Emails → SMTP Settings), quindi rimandata: **le email restano in inglese per
ora**, il reset password funziona comunque (link e flusso sono indipendenti
dalla lingua). Da rivedere quando l'app si apre agli amici.

---

## 11. Stato attuale

Aggiornato al 17 ottobre 2026. È la fotografia di oggi; la storia, commit
per commit, sta in `CHANGELOG.md`.

**Account di prova.** Esiste un account di prova fisso,
davidemancon02@gmail.com, creato il 3/10. Si usa in Safari per le prove
che scrivono dati (utente nuovo, cambio vero, ...), mentre l'app
installata resta sull'account vero. Non va cancellato. Dall'11/10 i
vincoli verso `auth.users` permettono di cancellarlo (sotto, "Fatto"):
la prova è stata fatta in una transazione annullata, l'account è intatto
e resta il primo caso di prova per "elimina account".

Dal 15/10 ci sono anche **due account usa e getta di Amici** (branch
`amici`), per le prove con due utenti:
- **A**: davidemancon02*amici1@gmail.com, username `@amici_uno`, usato in
  Safari su iPhone. L'indirizzo, con l'asterisco, non riceve email: con
  la conferma email spenta la registrazione è riuscita lo stesso, ma
  "Password dimenticata" non gli funziona (sezione 9.1);
- **B**: davidemancon02+amici2@gmail.com, username `@amici_due_b`, usato
  in Chrome sul PC.

Dal 16/10 anche **due account usa e getta del trigger di registrazione**
(sezione 9.1), nati dalle registrazioni vere di prova su app-libra:
- davidemancon02+trigger@gmail.com, username `@test`;
- davidemancon02+trigger2@gmail.com, username `@prova_trigger2`.

Più un terzo, davidemancon02+trigger3@gmail.com, username `test3`, nato
dalla prova di `nomeUtente` (branch `ritocchi-username`).

**Il 16/10, a fine branch `condivisione-alimenti`, sono stati tutti
eliminati** con Elimina il mio account, che così ha provato la cascata
sulle tabelle di Amici (sezione 9.6): prima A, con due condivisioni in
attesa nei due sensi, poi B e i tre account del trigger. Restano 6
utenti, nessuna riga orfana (verificato da Cowork). Per altre prove con
due utenti servono account nuovi; l'account di prova fisso resta.

### Fatto

**Database Supabase.** Le 11 tabelle della sezione 4, RLS attiva su tutte,
13 migration (`list_migrations`): schema iniziale e policy del 4 settembre,
rimozione del trigger orfano della v0 (5/9), tabelle `obiettivi_target` e
`giorni` con backfill, colonne dei giorni differenziati su `profili`,
`CHECK` su `tipo_giorno` tolto (19/9), `GRANT` mancanti sulle due tabelle
nuove (20/9), indice unico sui nomi dei pasti creato e rimosso lo stesso
giorno (20/9). Scelte prese durante la prima migration, ancora valide:

- **`updated_at` lo scrive un trigger sul server** (`public.set_updated_at`),
  non il client: è la difesa contro l'orologio sbagliato del punto 10.6
- **Gli enum sono `text` + vincolo `check`**, non tipi `enum` di Postgres.
  Eccezione voluta: `tipo_giorno` non ha più il `check`, perché i tipi di
  giorno sono righe definite dall'utente (sezione 3)
- **Su `alimenti` le policy di `update` e `delete` richiedono
  `user_id = auth.uid() and verificato = false`**: il catalogo condiviso è in
  sola lettura per costruzione (punto 10.8), e l'`insert` impedisce di
  crearsi alimenti già `verificato = true`

Resta un solo avviso del linter, non risolvibile gratuitamente:
**Leaked Password Protection** disattivata (Authentication → Sign In /
Providers → Email → "Prevent use of leaked passwords"). Disponibile solo dal
piano Pro (25$/mese), quindi resta spenta per la regola "niente servizi a
pagamento senza avvisare". Da riconsiderare solo se l'app si aprisse al
pubblico.

**Repo.** Ripulito il 4-5 settembre invece di crearne uno nuovo: history e
configurazione Vercel mantenute, codice della v0 consultabile sul tag
`v0-vecchia-app`.

**Punto 0 — local-first** (sezione 9.2). Dexie è a `version(8)`: le 11
tabelle più `outbox` e `sync_cursori`. Repository unico per ogni scrittura;
salita dall'outbox con i genitori prima dei figli (dal 9/10), che si ferma
al primo errore e accantona una voce dopo 5 rifiuti del server (rete
assente e sessione scaduta non contano, dal 10/10); ogni richiesta
annullata dopo 30 secondi senza risposta (dal 10/10); scritture
del repository possibili dentro una transazione Dexie; discesa incrementale e paginata; `orchestratore.ts`
(discesa prima della salita, tre inneschi); id deterministici per i pasti
predefiniti e per le righe di `giorni`; "Ricarica i dati dal tuo account"
in Profilo; service worker scritto a mano per l'uso offline; utente
riconosciuto offline anche con il token scaduto (punto 10.6). Service
worker provato sul telefono il 26/9, sulla preview: offline, token scaduto
da più di un'ora, Esci.

**Punto 1 — auth, profilo, fabbisogno.** Login e registrazione con Supabase
Auth (beta a inviti), recupero password. Profilo rifatto il 26/9 con un
solo Salva e la scelta fra cambio vero e correzione (sezione 3), calcolo
Mifflin-St Jeor, storico in `obiettivi`, "Registra peso", peso obiettivo,
giorni differenziati, Esci.

**Punto 2 — Oggi e inserimento manuale.** Oggi a tre fasce con data
navigabile (frecce e calendario), giorno = data del calendario (il giorno
logico è ritirato dal 2/10, sezione 4), anello e barre macro,
pastiglia Normale/Allenamento, pasti richiudibili, voce spostabile di pasto
dallo sheet. Aggiungi alimento con ricerca nel catalogo locale, crea,
modifica ed elimina alimento (con la marca), sheet quantità unico.

**Punto 3 — recenti, preferiti, pasti salvati.** Recenti (5), Preferiti,
pasti salvati promossi da Oggi con la stella. Dalla matita in Preferiti si
modificano: nome, alimenti e grammi, eliminazione (26/9, provata su iPhone,
sezione 3). Regola "alimenti cancellati"
(sezione 4) con Annulla dopo la cancellazione.

**Tastiera iOS nelle pagine con la tab bar** (26/9, provata su iPhone). A
scorrere è il documento, con la tab bar fissa. Mentre un campo ha il fuoco,
tab bar e barra Salva si nascondono e ricompaiono quando la tastiera si
chiude (sezione 3, "Layout delle pagine con la tab bar").

**Tab bar nell'app installata** (2/10, provata su iPhone da Safari e
dall'app sulla Home). `viewportFit: "cover"` (sezione 3, "Barretta home di
iOS"). Il margine in più solo in modalità standalone è stato tolto con la
tab bar fluttuante, che ha la sua distanza dal fondo.

**Tab bar fluttuante** (2/10, "opzione B", provata su iPhone da Safari e
dall'app installata). Pillola staccata dai bordi con sfondo vetro; in Oggi
"+ Aggiungi" fluttuante e lista fino in fondo; barra Salva di Profilo solo
con modifiche (sezione 3, "La tab bar è una pillola fluttuante" e "Un solo
Salva"; sezione 7). Aggiunto dopo la prova: "Salvato." in Profilo dopo un
salvataggio riuscito, poi provato su iPhone con la barra "vetro" (vedi
sotto).

**Giorno del calendario al posto del giorno logico** (2/10, provato su
iPhone). Un solo "oggi" (`oggiLocale`) per Oggi, Aggiungi e Profilo; fra
mezzanotte e il primo pasto si propone il primo pasto (sezione 4, "Il
giorno è quello del calendario").

**"Aggiunto — Annulla" dopo ogni inserimento** (2/10, punto 10.2, provata
su iPhone da Safari e dall'app installata). Barra in
Oggi dopo i tre percorsi di inserimento; annulla le voci di
quell'inserimento con una cancellazione logica (sezione 3, "Dopo ogni
inserimento, «Annulla»").

**Barra dei messaggi "vetro"** (2/10, provata su iPhone da Safari e
dall'app installata, compreso "Salvato." in Profilo). Stesso vetro della
tab bar, icona, linea del tempo; durate di 5, 4 e 2,5 secondi, dal 3/10
3 e 2,5, con la pausa che riprende da dove era (provato su iPhone il 3/10:
3 s con Annulla, 2,5 s il resto, pausa che riprende da dove era, tocchi
ripetuti; sezione 7). Confermato da Davide l'11/10 su iPhone: 3 s con
Annulla bastano, anche dopo "Elimina tutto il pasto".

**Swipe per cambiare giorno in Oggi** (2/10, provato su iPhone da Safari
e dall'app installata). Dito a sinistra giorno dopo, a destra giorno prima,
elastico oltre l'ultimo giorno del diario (oggi, oggi + 7 dal 10/10); la
lista riparte dall'alto a ogni cambio di giorno
(sezione 3, "Swipe per cambiare giorno").

**Tema scuro, passo 1** (3/10, provato su iPhone da Safari e dall'app
installata, in chiaro e in scuro: Oggi, sheet con il velo, bottoni, menu
nativi; la barra dell'orologio è in tinta con la pagina). L'app segue la
modalità chiara/scura del sistema, palette "Caldo"; in chiaro nessun pixel
è cambiato (sezione 7, "Tema chiaro / scuro / sistema").

**Impostazioni, passo 1** (3/10, provato su iPhone da Safari e dall'app
installata, in chiaro e in scuro: guardiano, redirect, offline in modalità
aereo). La tab Profilo è diventata Impostazioni (ingranaggio): elenco a
gruppi con scheda dell'account, Sincronizzazione ("Ricarica i dati"),
Informazioni (versione e commit) ed Esci; il vecchio Profilo spostato intero
in `/impostazioni/profilo`, con l'email in sola lettura; guardiano delle
modifiche non salvate su "‹ Impostazioni" e tab bar; `/profilo` rimanda a
`/impostazioni`; service worker con le pagine nuove (sezione 3,
"Impostazioni").

**Impostazioni, passo 2: superficie bianca** (3/10, provato su iPhone da
Safari e dall'app installata, in chiaro e in scuro). In chiaro `--superficie` è `#ffffff`: pillola, barra
dei messaggi, sheet, barra Salva, gruppi e scheda dell'account. Testo sopra
la capsula in `--testo-capsula` (4,9:1 nel caso peggiore). Il tema scuro
non cambia (sezione 7, contrasti misurati).

**Impostazioni, passo 3: Obiettivi** (3/10, provato su iPhone: con
l'account di prova in Safari, utente nuovo, interruttore senza profilo,
cambio vero, "Calcola proposta", guardiano; con l'account vero nell'app
installata. Dopo le prove è cambiato solo il testo del messaggio sul
livello di attività). Pagina `/impostazioni/obiettivi` con obiettivo, "Calcola
proposta", giorni di allenamento con l'interruttore e target nella riga,
selettore Normale | Allenamento; Profilo con i soli dati personali e la
pesata, nello stile a gruppi; riga "Obiettivi" nell'elenco con le calorie
del periodo in corso (sezione 3, "Obiettivi").

**Impostazioni, passo 4: Peso** (3/10, provato su iPhone: con l'account
di prova in Safari riga e pagina senza pesate, "Vai a Peso", pesata e
sostituzione nello stesso giorno, Profilo senza "Registra peso", offline;
con l'account vero nell'app installata la riga Peso). Pagina `/impostazioni/peso` con l'ultima pesata e "Registra
peso", uscito da Profilo; riga Peso nell'elenco; "Calcola proposta" in
Obiettivi rimanda a Peso; regola della pesata corretta (stesso valore in un
giorno nuovo ora si scrive; confermato da Davide l'11/10 su iPhone: la
pesata compare in cima con la data nuova) (sezione 3, "Peso").

**Impostazioni, passo 5: Aspetto** (3/10, provato su iPhone: Safari e app
installata, Chiaro / Scuro / Sistema, cambio dal Centro di controllo con
"Sistema", avvio a freddo dell'app installata in tutti e due i versi senza
lampo, login in Scuro con i campi compilati in automatico, offline con il
tema scelto, Safari privato, sheet, date, tab bar e grafici). Pagina
`/impostazioni/aspetto` con le tre anteprime, scelta applicata subito e
salvata nel dispositivo; script in `<head>` che applica il tema prima del
disegno; riga Aspetto nell'elenco (sezione 3, "Aspetto"; sezione 7, "Tema
chiaro / scuro / sistema").

**Impostazioni, passo 6: colore principale** (3/10, provato su iPhone: i
quattro colori in chiaro e in scuro, riga Aspetto, grigio nuovo, avvio a
freddo senza lampo verde, offline, Safari privato). Gruppo "Colore principale" in Aspetto con Verde / Blu /
Viola / Petrolio, applicato subito; `data-accento` scritto dallo stesso
script del tema; riga Aspetto "Sistema · Verde"; grigio `--tenue` più
scuro in chiaro; test permanente dei contrasti per ogni colore e tema
(sezione 3, "Aspetto"; sezione 7, "Colore principale"). Con questo passo
la pagina Impostazioni è completa per questo giro.

**Tieni premuto in Oggi: sposta, duplica, elimina** (passi A–E con le
loro correzioni, provati insieme su iPhone il 6/10 sull'anteprima del
branch `duplica` e uniti a main lo stesso giorno). Provato tutto: il
gesto a due rami; menu ed Elimina con Annulla, anche dopo la sync; Sposta
con i doppioni (una scelta per alimento); trascinamento con scorrimento
automatico; Duplica con giorno, pasto e "Vedi". Nello stesso giro anche
inserimento, Impostazioni, tema scuro e offline, senza regressioni.
Com'è fatto: sezione 3, "Tieni premuto: sposta, duplica, elimina".

**Seed dei pasti predefiniti solo con il server vuoto** (7/10, provato su
iPhone il 9/10 sull'anteprima del branch `seed-pasti`). Chiude la
resurrezione di un pasto cancellato e la rinomina annullata (§9.2). Da
computer, con l'account di prova: IndexedDB cancellato e rete spenta →
"Serve la connessione"; con la rete di nuovo accesa i pasti arrivano da
soli; "Riprova" funziona in tutti e due i casi. Su iPhone, tutto come prima
e il riquadro non compare mai: Safari privato con l'account di prova, app
installata con l'account vero (anche in modalità aereo), "Ricarica i dati
dal tuo account". Test: `pasti.test.ts` per il seed,
`primoAvvioSenzaRete.test.tsx` per la schermata.

**Validità dei pasti nel tempo, con la rete di sicurezza** (passo 2,
9/10, provato su iPhone il 9/10 in Safari privato sull'anteprima del
branch `validita-pasti`, account di prova). Tutto come prima: Oggi (oggi
e giorno passato), Aggiungi, sheet, Sposta, trascinamento, Duplica,
offline. Con un pasto di prova e date scritte via SQL: con `valido_dal` =
oggi compare oggi e non ieri, e Duplica segue la data; spostato a domani
con una voce oggi, resta visibile con "Non più in uso", totali coerenti,
non riceve voci da nessuna strada e il menu della voce dice "· non più in
uso"; eliminata la voce, sparisce. Com'è fatto: sezione 3, "I pasti di un
giorno". Test: `validitaPasti.test.ts`, `aggiornamentoSchema.test.ts`.

**Pasti e orari, passo 3** (9/10, provato su iPhone il 9/10 in Safari
privato sull'anteprima del branch `pagina-pasti`, account di prova): la
pagina per rinominare (Correggi / Da oggi), cambiare l'ora e aggiungere
un pasto, con Annulla; la guardia in Aggiungi; la coda di
sincronizzazione con i genitori prima dei figli (sezione 9.2). Tutte le
11 prove ok: riga in Impostazioni, solo ora, ora occupata, Correggi, Da
oggi con voci e Annulla, pasto nato oggi senza domanda, Indietro, nomi,
Aggiungi nei due modi e con il nome di un pasto chiuso, tema scuro. La
prova offline (rinomina da oggi, poi ora cambiata, poi online) è
verificata su Supabase: riga vecchia chiusa ieri, riga nuova con la voce
di oggi, coda vuota, nessuna voce accantonata. Com'è fatto: sezione 3,
"Pasti e orari". Test: `controlliPasti.test.ts`,
`modifichePasti.test.ts`, la pagina, `sincronizza.test.ts`,
`repository.transazione.test.ts`.

**Elimina pasto, passo 4** (9/10, provato su iPhone il 9/10 in Safari
privato sull'anteprima del branch `elimina-pasto`, account di prova):
"Elimina pasto" nello sheet, con la domanda "da quando", la conferma con
voci / giorni / kcal se tocca voci, la barra con Annulla che ricrea il
pasto e le voci; almeno un pasto in ogni giorno; la sincronizzazione un
giro per volta (sezione 9.2). Provati: da oggi senza voci e con voci
(conferma con 1 voce), pasti eliminati assenti oggi e presenti ieri in
Aggiungi, Sposta, Duplica e trascinamento, "Anche nei giorni passati"
con 13 voci + Annulla, da oggi + Annulla, pasto nato oggi senza domanda
+ Annulla, tema scuro. Su Supabase: pasto ricreato con id v5 e le sue
voci, anche dopo eliminazione e Annulla fatti offline. Com'è fatto:
sezione 3, "Elimina pasto". Test: `controlliPasti.test.ts`,
`modifichePasti.test.ts`, `vociDiario.test.ts`, la pagina,
`sincronizzaUnaPerVolta.test.ts`.

**Diario fino a 7 giorni** (10/10, provato su iPhone il 10/10 in Safari
sull'anteprima del branch `diario-futuro`, account di prova; verificato su
Supabase): il diario accetta i giorni futuri fino a oggi + 7; "da oggi"
in Pasti e orari vuol dire da oggi in poi; Oggi salta al nuovo oggi
quando il giorno cambia. Provati: navigazione fino a oggi + 7 (freccia,
swipe, calendario); Aggiungi su un giorno futuro (primo pasto vuoto
proposto, `consumato_alle` vuoto); Duplica fino a sab 17 ott e spento
oltre; Rinomina "da oggi" con e senza Annulla (voci di oggi e di lun 12
spostate sul pasto nuovo, quelle di ieri rimaste sul vecchio); Elimina
"da oggi" con la conferma "in N giorni, da oggi in poi" e Annulla che
ricrea il pasto e le voci future. **Il giorno che cambia** è provato
l'11/10 sull'app installata, con l'account vero: riaprendola dal
multitasking la mattina dell'11, Oggi mostrava domenica 11, e il menu
della voce lasciato aperto la sera era chiuso. Gli altri fogli (sheet
della voce, Sposta, Duplica) si chiudono nello stesso modo, e lo coprono
i test. Com'è fatto: sezione 3,
"Inserimento retroattivo", "Pasti e orari" ed "Elimina pasto". Test:
`dataGiorno.test.ts`, `useGiornoCorrente.test.tsx`,
`modifichePasti.test.ts`, `vociDiario.test.ts`, `SheetDuplica.test.tsx`,
le pagine Oggi, Aggiungi e Pasti e orari.

**Pasti e orari, passo 5: date future e cambi programmati** (10/10,
provato su iPhone il 10/10 in Safari sull'anteprima del branch
`pasti-date`, account di prova; tutto verificato su Supabase, compreso il
segno `eliminata_dal_cambio`): "Da una data" per rinominare, cambiare
l'ora, aggiungere ed eliminare, le schede per data con il loro Annulla.
Provati: rinomina programmata con orario e schede per data; la stessa
data che modifica il cambio programmato; solo orario con "Subito" e "Da
una data"; aggiungi da una data ("nuovo" nella scheda); elimina da una
data con la conferma, e Annulla della scheda che rimette la voce
eliminata dal cambio ma non quella cancellata a mano; Annulla della
barra; rinomina "da oggi" con orario (i giorni passati tengono l'ora
vecchia); data limitata al prossimo cambio programmato. Resta aperto il
limite del Salva (sotto, "Difetti e verifiche aperti"). Com'è fatto:
sezione 3, "Pasti e orari", "Date future e cambi programmati". Test:
`cambiProgrammati.test.ts`, `controlliPasti.test.ts`,
`modifichePasti.test.ts`, `vociDiario.test.ts`,
`aggiornamentoSchema.test.ts`, `dataGiorno.test.ts`, `campiData.test.ts`,
la pagina.

**Indicatore di sincronizzazione** (10/10, provato su iPhone il 10/10 in
Safari sull'anteprima del branch `sync-stato`, build `816d081`, account
di prova; verificato su Supabase). Prima la sync: senza rete e con la
sessione scaduta la coda non consuma tentativi; ogni richiesta annullata
dopo 30 secondi; lo status dell'ultimo invio fallito sulle voci (Dexie
`version(8)`). Poi l'indicatore: la pagina Sincronizzazione con il
riquadro dello stato, "Sincronizza ora", "Non salvate online"; lo stato in
breve nella riga di Impostazioni; il pallino sulla tab. Provati:
aggiornamento di Dexie alla `version(8)` senza perdere voci; "Tutto
salvato" nella pagina e nella riga (pallino verde), nessun pallino sulla
tab; in modalità aereo 6 voci registrate, "6 in attesa" in ocra con "in
attesa dalle …", nessun pallino, **nessuna voce accantonata** (la prova
del difetto corretto: prima dopo 5 scritture offline la prima veniva
accantonata); tornata la rete, "Sincronizza ora" → "Tutto salvato
online", le 6 voci arrivate al server nello stesso giro. Non provati a
mano, coperti dai test: server che rifiuta, accesso scaduto, accantonate,
pallino sulla tab. Com'è fatto: sezione 9.2 ("L'indicatore", "un tempo
massimo per ogni richiesta", la regola dei tentativi). Test:
`sincronizza.test.ts`, `discesa.test.ts`, `fetchConScadenza.test.ts`,
`statoSincronizzazione.test.ts`, `codaDellUtente.test.ts`,
`testiSincronizzazione.test.ts`, `rigaSincronizzazione.test.ts`,
`aggiornamentoSchema.test.ts`, la pagina Sincronizzazione, l'elenco di
Impostazioni, `BarraNavigazione.test.tsx`.

**Ripristino della password** (10/10, branch `reset-password`, provato
su iPhone il 10/10 in Safari sull'anteprima, account di prova). Prima il
link mostrava "Link non valido" alla prima apertura e il modulo solo
ricaricando; provando la correzione si è visto che un link già usato
apriva il modulo alla sessione già aperta. Provati: link aperto la prima
volta → modulo subito, con l'email dell'account; ricaricando prima di
salvare il modulo resta; salvataggio → Oggi; link già usato
(`otp_expired`) con la sessione dell'account di prova aperta → testo
"link scaduto", niente modulo; link chiesto da Chrome sul PC e aperto in
Safari su iPhone → testo "altro browser", niente modulo, e "Richiedi un
nuovo link" apre la pagina anche da loggato; dopo il salvataggio
"indietro" da Oggi non riporta più alla pagina del reset. Com'è fatto:
sezione 9.1, "Il ripristino della password". Test:
`reimpostaPassword.test.tsx`.

**Doppioni in Aggiungi** (11/10, branch `doppioni-aggiungi`, provato su
iPhone l'11/10 in Safari sull'anteprima, account di prova; tutto
verificato su Supabase). Aggiungere un alimento già nel pasto apre il
foglio dei doppioni invece di creare una seconda riga in silenzio.
Provati:
- "+" su un alimento già nel pasto: foglio, un tocco su "Aggiungi" →
  "Sommato", una riga sola. Annulla riporta i grammi di prima senza
  cancellare la riga;
- sheet quantità con "Scrivi quantità" 120 → "Aggiornato", poi Annulla;
- "Tieni separati" → due righe, "Aggiunto";
- "Non aggiungerlo" → si resta su /aggiungi, niente scritto, e il "+"
  funziona subito dopo;
- pasto salvato con un solo doppione: un blocco, gli altri alimenti
  entrano, "(N alimenti)". Con "Non aggiungerlo" → "(tranne «…», che
  c'era già)";
- doppio tocco veloce sul "+" → una riga sola;
- Duplica con un doppione, dopo il refactoring di `pianoInserimento`,
  funziona come prima.

Com'è fatto: sezione 3, "Doppioni in Aggiungi". Restano aperti i due
difetti di Sposta, Duplica e dello sheet di modifica (sotto, "Difetti e
verifiche aperti"). Test: `pianoInserimento.test.ts`,
`vociDiario.test.ts`, `testiBarra.test.ts`, la pagina Aggiungi e la
pagina Oggi.

**Segnalibro allineato in Oggi** (11/10, branch `icona-preferiti`,
provato su iPhone l'11/10 in Safari sull'anteprima, account di prova).
Prima il segnalibro del pasto si spostava con il numero di cifre delle
kcal. Provati: segnalibri in colonna con kcal da 2 e da 3 cifre, nel
tema scuro e nel chiaro; il segnalibro risponde anche toccando appena
fuori dal disegno; toccando la prima voce sotto il pasto, vicino al
segnalibro, si apre la voce e non il segnalibro; la riga di un pasto
senza voci ("—") resta in ordine. Com'è fatto: sezione 3, Oggi, punto 3.

**Numeri delle voci in Oggi incolonnati** (11/10, branch `pulizie`,
provato su iPhone l'11/10 in Safari sull'anteprima, account di prova).
Prima "·" e grammi si spostavano con il numero di cifre delle kcal, e i
grammi con decimali si leggevano "12.5 g". Provati: "·" e "g" in colonna
con kcal da 1, 2 e 3 cifre; una voce da 12,5 g scritta "12,5 g", anche
nella copia che segue il dito trascinando; i nomi lunghi si accorciano
con "…" senza spingere i numeri. Confermati da Davide l'11/10 su iPhone
anche i numeri con kcal da 1 cifra e la schermata su iPhone SE. Com'è
fatto:
sezione 3, Oggi, punto 3.

**Preferiti e pasti salvati in Impostazioni** (11/10, branch `preferiti`,
provato su iPhone l'11/10 in Safari sull'anteprima, account di prova, con
le scritture controllate su Supabase). Provati: la riga "Preferiti" in
Impostazioni intera, con "1 alimento · 2 pasti"; l'elenco uguale ai
Preferiti di Aggiungi; la stella che toglie (riga sbiadita, barra,
Annulla che rimette) e il ritocco della stella che rimette; uscendo dalla
pagina l'alimento tolto sparisce anche da Aggiungi; su Supabase una sola
riga per alimento, rimessa in vita e mai creata di nuovo; il pasto
salvato che si apre nella modifica sopra la tab bar; con la tastiera
(grammi, nome, ricerca) sotto la schermata non si vede l'elenco e non
resta la fascia vuota della barra Salva; ✓ chiude la tastiera e la barra
ricompare; il salvataggio con il suo messaggio; chiudendo, l'elenco torna
dov'era; la stessa schermata dalla matita in Aggiungi, come prima; la
pagina che si apre offline. Due difetti trovati nella prima prova e
corretti nello stesso branch: l'etichetta per esteso accorciata con "…",
e l'elenco visibile sotto la modifica con la tastiera aperta. Com'è
fatto: sezione 3, "Preferiti e pasti salvati".

**Indirizzo pubblico** (11/10, fuori dal codice). L'app sta su
https://app-libra.vercel.app, dominio di produzione su Vercel; il vecchio
`nutritrack-green-one.vercel.app` rimanda lì (307). Gli indirizzi dei
branch, compreso `nutritrack-git-main-…`, restano protetti dal login di
Vercel, apposta: servono solo per le prove. Su Supabase Site URL e unica
Redirect URL puntano al nuovo indirizzo (sotto, "Difetti e verifiche
aperti"). Il codice non aveva indirizzi scritti a mano: il reset usa
`window.location.origin`, il service worker `self.location.origin`, il
manifest percorsi relativi. Provato su iPhone l'11/10: app reinstallata
da app-libra, dati riscaricati dal server, vecchia icona tolta; reset
password dal nuovo indirizzo con l'account di prova, il link porta su
app-libra e funziona.

**Nome "Libra" e icona della bilancia** (11/10, branch `nome-libra`).
Nome nel manifest, nel titolo e in `offline.html`; icone e favicon
nuovi; cache dei file statici a v7 (sezione 7, "Nome e icona"). Provati
su iPhone l'11/10 in Safari sull'anteprima: la bilancia nella scheda e
in "Aggiungi a Home", la pagina offline. Il primo deploy dell'anteprima
era fallito per il favicon RGB, corretto nello stesso branch. Unito a main
l'11/10 (`c988901`), deploy di produzione riuscito. Confermati su iPhone
l'11/10: titolo della scheda "Libra", "Libra" proposto da "Aggiungi a
Home", "Apri Libra…" nella pagina offline con il tema giusto, la
bilancia nella scheda e in "Aggiungi a Home"; app vera reinstallata da
app-libra con l'icona nuova, dati riscaricati, Build `c988901`.

**Vincoli verso `auth.users` in CASCADE** (11/10, branch
`vincoli-utente`, migration `vincoli_cancellazione_utente`, versione
20261011133801). Prima, cancellando un utente, `alimenti` era `ON DELETE
SET NULL`: le sue righe restavano con `user_id` null e la policy
`alimenti_select` le mostrava a tutti come catalogo comune. `giorni` e
`obiettivi_target` (sia `user_id` sia `obiettivo_id`) erano `NO ACTION`:
la cancellazione falliva. Ora tutte le foreign key verso `auth.users`
sono `CASCADE`, e così `obiettivi_target_obiettivo_id_fkey`. Il codice
non ne dipendeva: l'app non cancella mai fisicamente. Advisors identici
a prima. Provato l'11/10 sull'account di prova in una transazione
annullata apposta: prima della migration la cancellazione falliva su
`obiettivi_target_user_id_fkey`; dopo, riuscita e 0 righe in tutte le 11
tabelle (prima 122 in tutto: profili 1, obiettivi 1, obiettivi_target 2,
giorni 13, pasti 24, alimenti 3, voci_diario 70, composizioni 2,
composizioni_voci 3, misurazioni 1, preferiti 2); righe di altri utenti
invariate (311 tra voci e alimenti), nessun alimento con `user_id` null;
account di prova intatto dopo l'annullamento. Pronto per "Elimina
account" (sotto).

**Elimina il mio account** (11/10, branch `elimina-account`, decisioni
e com'è fatto in §9.6; mockup `docs/mockups/elimina-account.html`). In
fondo a Impostazioni, sotto Esci, la riga rossa porta alla sottopagina
con la parola da scrivere e un solo pulsante; lato server la funzione
`elimina_mio_account` (versione 20261011155326). Provato su iPhone l'11/10
sull'anteprima: la riga rossa nei due temi, la sottopagina e "‹
Impostazioni", la tastiera che si apre in maiuscolo, la parola
sbagliata (pulsante spento) e in minuscolo (accettata), offline
(pulsante spento con la sua frase), il resto dell'app intatto. **Prova
vera** sull'account usa e getta davidemancon02+elimina@gmail.com,
eliminato da Davide dal pulsante, arrivato al login con "Account
eliminato". Verificato da Cowork: prima 20 righe (obiettivi 1,
obiettivi_target 1, pasti 5, alimenti 4, voci_diario 3, composizioni 1,
composizioni_voci 3, misurazioni 1, preferiti 1), 1 identità, 1
sessione, 7 utenti, 384 righe altrui; dopo utente sparito, 0 righe
nelle 11 tabelle, 0 identità, 0 sessioni, 0 refresh token, 6 utenti,
384 righe altrui invariate, nessun alimento senza utente. Account di
prova fisso intatto (70 voci); rientrati con quello, solo i suoi dati e
sincronizzazione a posto. Resta da verificare `user_not_found` (§9.6,
"Segno").

**Esci svuota i dati locali** (11/10, branch `esci-svuota`, decisioni e
com'è fatto in §9.6). Uscendo si svuotano righe, coda e cursori
dell'utente dal dispositivo, deciso dallo stato: coda vuota senza
chiedere, "Resta / Esci e perdile" con la sessione valida, niente
svuotato con la sessione scaduta; signOut → attesa delle discese →
pulizia, segno `nutritrack:uscita` ripreso all'avvio. Insieme, la
correzione della salita: partono solo le voci dell'utente della
sessione, e nessuna voce entra in outbox senza `user_id`. Provato
l'11/10 sull'anteprima con l'account di prova fisso. PC (Chrome): Esci
con la coda vuota senza domande, IndexedDB senza righe dell'utente,
rientro con lo storico completo; con `*/rest/v1*` bloccato una voce in
coda dà la conferma con Resta / Esci e perdila, Resta lascia tutto, Esci
e perdila svuota; sbloccato e rientrato, storico completo e la voce
persa assente. iPhone (Safari): Esci con la coda vuota e rientro con lo
storico completo; Esci offline bloccato, niente toccato; Esci appena
aperta l'app con "Uscita…" e poi login, rientro con lo storico
completo. Giro generale per la salita (aggiungi, modifica, elimina,
duplica voce, preferito aggiunto e tolto, peso, pasto salvato),
verificato da Cowork su Supabase: arrivate voci_diario (3 righe, 1
eliminata), preferiti (2, 1 tolto), misurazioni (1), pasti (1), con
`updated_at` del server. Non provabili a mano, coperti dai test
permanenti: la sessione scaduta vera (nessun segno scritto, dati che
restano) e l'app chiusa a metà uscita.

**Impostazioni > Alimenti, il catalogo personale** (15/10, branch
`catalogo-alimenti`, decisioni e com'è fatto in sezione 3, "Alimenti";
mockup `docs/mockups/catalogo-alimenti.html`). Elenco degli alimenti
modificabili con ricerca e ordinamento, "Modifica alimento" e "Nuovo
alimento" a pagina intera con lo stesso form di Aggiungi, tieni premuto
per la selezione multipla, eliminazione di più alimenti tutto o niente in
una transazione con Annulla, riga in Impostazioni. Insieme: l'Elimina del
form (anche in Aggiungi) passa dalla stessa transazione, e nel form la
frase "Le modifiche valgono da ora e nei pasti salvati. Il diario già
registrato non cambia." Un bug trovato dai test prima del commit e
corretto: la funzione passata a `db.transaction` non `async` perdeva la
transazione dopo la prima scrittura (regola in §9.2). Provato su iPhone
il 15/10 in Safari sull'anteprima, account di prova: la riga "Alimenti"
prima di Preferiti con lo stesso numero della pagina; ricerca, i quattro
ordini dal selettore dell'iPhone, lo scorrimento che non entra mai in
selezione; la modifica con la frase nuova, "‹ Alimenti" che torna allo
stesso scorrimento, "+" → "Nuovo alimento" → "Creato: …"; tieni premuto
→ selezione, la barra che copre la tab bar, spunte aggiunte e tolte, lo
sheet con i conteggi di pasti salvati e preferiti, Elimina e Annulla
(anche con un alimento dentro un pasto salvato: tutto ripristinato); la
pagina che si apre offline; in Aggiungi la matita con la frase nuova,
crea, elimina dal form e Annulla. Verificato da Cowork su Supabase:
"Prova catalogo" cancellato; "Prova", il pasto salvato "Colazione" e le
sue righe di `composizioni_voci` ripristinati nello stesso secondo (una
transazione); "Dxx" creato da Aggiungi, eliminato e ripristinato.

**Amici, passi 1–7** (15–16/10, branch `amici`; sezione 3, "Amici";
mockup `docs/mockups/amici.html`). Username: tabella `nomi_utente`
(migration 20261015175818) con `username_disponibile` e
`imposta_username`; campo Username in Registrati con il controllo mentre
si scrive; riga Username in Profilo con il suo foglio. Amicizie: tabella
`amicizie` (migration 20261015184017) con le quattro funzioni e la
lettura degli username allargata agli amici; prove nei blocchi annullati
20/20 e 90/90; advisors solo con i WARN accettati in §9.6. Pagina
`/impostazioni/amici`: "Scegli il tuo username", Aggiungi un amico,
richieste ricevute e inviate ("Non accettata" con Ok), amici con Rimuovi;
riga Amici in un gruppo suo. Pallino delle richieste ricevute sulla tab
(l'arancio della sincronizzazione vince) e "N nuove" sulla riga Amici,
con l'ultimo numero noto offline. Provati su iPhone il 15/10 (pagina) e
il 16/10 (pallino) sull'anteprima, con gli account A e B ("Account di
prova", sopra) e l'account di prova fisso; verificati da Cowork su
Supabase. Non provati a mano, coperti da test o dai blocchi SQL: "Questa
richiesta non c'è più.", l'arancio insieme a una richiesta, VoiceOver;
Unito a main il 16/10 (fast-forward, `ae0a75a`, deploy di produzione
Ready); "Scegli il tuo username" provato in produzione il 16/10 con
l'account vero di Davide (username `@libra`), verificato da Cowork.

**Amici, passo 8** (16/10, su main; §9.1, "Il codice di invito anche nel
database"). Il codice di invito e lo username controllati anche nel
database, con tre trigger su `auth.users`: migration
`trigger_registrazione` (20261016112900, BEFORE e AFTER INSERT: codice
contro il segreto `codice_invito` del Vault, formato dello username, riga
di `nomi_utente`) e `registrazione_pulizia_codice` (20261016113910,
BEFORE UPDATE: toglie `codice_invito` quando GoTrue riscrive i metadati).
Prove nel blocco annullato 58/58; advisors senza avvisi nuovi; due
registrazioni vere da app-libra, la seconda con i metadati puliti.
Verificato da Cowork. Poi il branch `condivisione-alimenti` (sotto).

**Alimenti doppi nel catalogo** (16/10, branch `alimenti-doppi`; trovato
da Davide il 16/10, era in "Difetti e verifiche aperti"). Prima, creando
o rinominando un alimento, non c'era nessun controllo su nome + marca.
Ora vale "Mai due alimenti uguali" (sezione 3, "Alimenti"): messaggio
«Hai già …» con "Apri" e Salva spento nel form, controllo di nuovo al
Salva nella stessa transazione della scrittura (chiude anche il doppio
tocco), e l'Annulla dopo un'eliminazione che non rimette in vita un
doppione. Al 16/10 nei dati non c'era nessun doppione (verificato da
Cowork, e di nuovo con la chiave nuova). Schema invariato. **Provato su
iPhone il 16/10** sull'anteprima del branch, con l'account di prova in
Safari: Nuovo e Modifica in Aggiungi e nel catalogo, "Apri", spazi doppi,
doppio tocco su Salva. Le due prove rimaste (Annulla con un doppione nato
nel frattempo, alimento arrivato da un altro telefono) sono coperte dai
test. Verificato da Cowork su Supabase: nessun doppione e nessuna copia
dal doppio tocco.

**Ritocchi: messaggio del doppione e campi username** (16/10, branch
`ritocchi-username`). Due cose chieste da Davide il 16/10.
(1) Il messaggio del doppione sta sotto il campo Marca, con nome e marca
tutti e due in arancio, e dice che conta la coppia (`testoDoppione`;
sezione 3, "Alimenti").
(2) iPhone proponeva "Accedi con la password" toccando un campo username.
Rimedio, dopo tre prove: nei campi che stanno da soli, niente parola
"username" vicino al campo, al suo posto "nome su Libra"; in Registrati
il campo si chiama `nomeUtente`, con `autoComplete="nickname"` (sezione
3, "Lo username"). **Provato su iPhone il 16/10** sull'anteprima (build
`da5d90a`): il doppione, i fogli "Cambia il tuo nome su Libra" e
Aggiungi un amico senza la proposta, e una registrazione vera con
`nomeUtente` (+trigger3, `test3`), verificata da Cowork.

**Condivisione degli alimenti** (16/10, branch `condivisione-alimenti`,
chiuso; sezione 3, "Amici", "Condividere un alimento" e "Il pallino";
sezione 4, "`alimenti_condivisi`"). Mandare uno o più alimenti a uno o
più amici dalla selezione del catalogo (icona Condividi, foglio
"Condividi con"); riceverli nella pagina Alimenti (riga "N alimenti in
arrivo" e foglio) con Aggiungi / Rifiuta, il doppione con "Confronta i
valori", "Usa questi valori" con Annulla o "Tieni i miei", Ok sui valori
identici, la selezione multipla; il pallino della tab che somma
richieste e alimenti, la riga Alimenti di Impostazioni "N in arrivo",
il testo di Elimina account. Migration `alimenti_condivisi`
(20261016180308; prove nel blocco annullato 150/150, con la cascata;
advisors solo con gli avvisi attesi). **Provato su iPhone il 16/10**
sull'anteprima in Safari, con A → B: invio, secondo invio e foglio
offline (passo 4); riga, foglio, confronto, "Usa questi valori" con
Annulla, Ok, Aggiungi singolo, selezione e Aggiungi / Rifiuta multipli
con conferma (passi 5 e 6); pallino con soli alimenti in arrivo, riga
Alimenti "2 in arrivo" anche offline, pallino spento dopo le risposte,
testo di Elimina account (passo 7). Verificato da Cowork sul database
dopo ogni prova (stati, copie su B, lo Yogurt di B aggiornato sullo
stesso id). **Passo 8, la cascata vera**: A eliminato con Elimina il
mio account, con due condivisioni in attesa nei due sensi; sparito tutto
di A (utente, alimenti, pasti, voci, condivisioni, amicizie, nome), B
senza più alimenti in arrivo, le copie già aggiunte da B rimaste,
`@amici_uno` di nuovo libero, nessun altro utente toccato. Non provato a
mano, coperto dai test: due alimenti in arrivo con lo stesso nome e la
stessa marca (servirebbe un terzo utente).

**Test.** 995 test permanenti in 90 file (Vitest), tutti verdi al 16/10.

### Non ancora costruito

- **Onboarding** dopo la registrazione: in corso sul branch `onboarding`
  dal 17/10: costruito tutto (pagina, redirect dopo la registrazione,
  guardia, scheda di Oggi); mancano le prove su iPhone (sezione 3,
  "Onboarding")
- **Statistiche** e storico del peso (fase 6): la pagina è un segnaposto
- **Ricerca Open Food Facts** (fase 4) e **OCR / "Scansiona etichetta"**
  (fase 5)
- Rimedi della sezione 10 ancora da fare: **catalogo precaricato** (10.1),
  **"Esporta i miei dati"** (10.4)
- Ora del consumo (`consumato_alle`) modificabile nello sheet. La
  gestione dei pasti in Impostazioni > Pasti e orari è completa (passi
  1-5, l'ultimo provato su iPhone il 10/10: sopra, "Fatto")

### Difetti e verifiche aperti

- **Onboarding finito su un dispositivo e riaperto offline su un altro**
  (limite noto, accettato da Davide il 17/10; sezione 3, "Onboarding").
  Inizio l'onboarding in Safari, lo finisco su Chrome, poi riapro Safari
  **offline**. Safari ha ancora il segno vecchio nel cookie e nessun
  obiettivo in Dexie, quindi ripropone gli ultimi passi. Se li rifaccio,
  crea un secondo periodo di obiettivi e una seconda pesata. È raro:
  servono due dispositivi, l'offline e ignorare di aver già finito.
  Tornata la rete, la discesa porta l'obiettivo di Chrome e la rete di
  sicurezza mette "fatto"
- **Uniformare le fine riga** (trovato al passo 5 di
  `condivisione-alimenti`, 16/10; da fare in un commit a parte). Una
  sostituzione automatica su più righe non entrava in
  `src/lib/repository/alimenti.ts`, che nella copia di lavoro aveva
  righe miste (Windows e Unix). Al 16/10, a branch chiuso, nessun file
  risulta misto (`git ls-files --eol`): nel repository sono tutti LF,
  perché `core.autocrlf=true` li normalizza al commit. Nella copia di
  lavoro però convivono file con fine riga Windows (278) e Unix (184):
  innocuo per l'app, ma fa inciampare le modifiche su più righe.

- **"Username appena preso, scegline un altro" non esiste ancora**
  (16/10, passo 8). La sezione 3 ("Lo username") lo prevede per due
  persone che scelgono lo stesso nome nello stesso istante: il trigger
  rifiuta la seconda registrazione, ma GoTrue all'app manda solo un
  errore generico, e `traduciErroreAuth` lo trasforma in "Si è
  verificato un errore. Riprova tra poco." Raro: la pagina Registrati e
  la Server Action controllano prima con `username_disponibile`. Da
  fare: riconoscere quel caso nella Server Action (per esempio
  richiamando `username_disponibile` dopo l'errore) e dare il messaggio
  giusto

- **Redirect URL su Supabase: solo voci esatte** (Authentication → URL
  Configuration; regola dal 10/10). Mai un jolly sui sottodomini
  `vercel.app`: i nomi dei progetti Vercel li sceglie chiunque, e un
  progetto altrui con un nome adatto (per esempio
  `nutritrack-x-davide-libralato-personale`) soddisferebbe il jolly e
  riceverebbe i link di accesso. Dall'11/10 Site URL =
  `https://app-libra.vercel.app` e l'unica Redirect URL è
  `https://app-libra.vercel.app/**`. Per provare un branch sull'anteprima si
  aggiunge la sua voce esatta (`https://nutritrack-git-<branch>-…vercel.app/**`)
  e la si toglie dopo il merge. Un `redirectTo` non in elenco viene
  ignorato in silenzio: il link porta al Site URL, quindi un reset chiesto
  dall'anteprima di un branch senza la sua voce porta su app-libra
- **Un reset chiesto dall'app installata su iPhone non può riuscire**
  (limite noto, 10/10). Il link dell'email si apre sempre in Safari,
  mentre il code verifier sta nei cookie dell'app, che sono separati. La
  pagina lo spiega ("funziona solo nel browser da cui l'hai chiesto…") e
  si richiede il link da Safari. Soluzione possibile in futuro: link con
  `token_hash` e `verifyOtp` lato server, che non ha bisogno del
  verifier; cambia il modello dell'email "Reset Password" su Supabase
  (dalla dashboard, fuori da git)
- **Errore di rete durante lo scambio del link** (10/10, raro). La
  libreria cancella comunque il verifier: si vede "Errore di
  connessione", e ricaricando compare il testo "altro browser". Serve un
  link nuovo
- **Email di Supabase gratuite: circa 2 all'ora** (il servizio interno
  del piano gratuito, sezione 10.9). Da tenere presente nelle prove del
  reset: oltre il limite la richiesta fallisce con "Troppi tentativi"

- **Sposta e Duplica ignorano "Non spostarlo" / "Non duplicarlo" se il
  doppione sparisce** fra il foglio e la conferma (11/10, visto facendo i
  doppioni in Aggiungi). Se la riga in doppione viene cancellata nel
  frattempo, per esempio da un altro dispositivo, alla conferma non c'è più
  niente da decidere: `spostaNelPasto` e `duplicaNelPasto` controllano le
  scelte solo quando ci sono ancora dei doppioni, e l'alimento si sposta o
  si copia lo stesso, contro il "no" dell'utente. Aggiungi invece lo
  rispetta (sezione 3, "Doppioni in Aggiungi"). Raro; il rimedio è lo
  stesso di Aggiungi: togliere gli esclusi prima del piano
- **Il cambio di pasto dallo sheet di modifica in Oggi non controlla i
  doppioni** (11/10). Cambiando il pasto di una voce dal suo sheet, la
  voce va nel pasto nuovo con l'`update` diretto di `pasto_id`, senza
  passare da `spostaNelPasto`: se lì c'è già lo stesso alimento si
  ritrovano due righe, senza foglio. Il menu "Sposta" invece lo controlla

- **Pasti e orari: il Salva controlla nome e ora con le regole "da oggi"**
  (10/10, passo 5, accettato per ora). Il controllo al Salva dei campi
  viene prima della domanda "da quando", quindi non sa ancora se si
  sceglierà "Da una data": il nome si controlla da oggi alla fine della
  riga, l'ora su tutta la riga (passato compreso), e per un pasto nuovo
  da oggi in poi. Un nome o un'ora occupati da un altro pasto solo fra oggi
  e il giorno prima della data scelta bloccano già lì, anche se da quella
  data andrebbero bene. Esempio: Merenda (16:00) ha "non ci sarà più dal
  lun 12"; Spuntino → "Merenda", o Cena → 16:00, dal 12 si fermano al Salva
  con "C'è già un pasto con questo nome." / "Alle 16:00 inizia già
  Merenda." (verificato il 10/10). Lo stesso per aggiungere dal 12 un
  pasto di nome "Merenda". Per ora si aspetta che la data arrivi e si
  cambia "da oggi". Il rimedio: al Salva
  controllare il periodo più stretto fra le scelte possibili (o solo il
  formato), lasciando il controllo vero alla scelta nella domanda, dove
  c'è già (`cambioDaUnaData`, `erroreAggiuntaData`, e le scritture che lo
  rifanno)

- **Un invio scaduto può ancora arrivare tardi** (10/10, rischio residuo
  del tempo massimo, sezione 9.2). Dopo 30 secondi la richiesta viene
  annullata e il browser chiude la connessione, ma se la richiesta era già
  partita del tutto (inviata al server) e si è bloccata solo la risposta,
  il server può averla già ricevuta, o riceverla dopo. Se nel frattempo
  l'utente ha corretto la stessa riga e la correzione è arrivata prima,
  il valore vecchio la riscrive: il server resta indietro, il telefono
  mostra il valore giusto, la coda è vuota, nessun errore. Stessa cosa se
  vince la rete di sicurezza (`conTempoMassimo`, 35 secondi) perché
  l'annullamento non ha chiuso la richiesta. Raro: servono una richiesta
  bloccata dopo l'invio e una correzione della stessa riga entro il giro
  dopo. Il rimedio vero sarebbe sul server (riconoscere e rifiutare una
  scrittura più vecchia di quella già salvata; oggi non si può dal solo
  `updated_at`, che il trigger riscrive con l'ora del server), da valutare
  a parte

- **Una riga cancellata può tornare in vita da un altro telefono** (visto
  il 9/10 preparando Elimina pasto, non introdotto da lì). Se il telefono
  B, non ancora allineato, modifica offline una riga che il telefono A ha
  cancellato (per esempio rinomina un pasto eliminato), e la salita di B
  parte prima della sua discesa (ogni scrittura fa partire solo la
  salita), l'upsert manda la riga con `deleted_at` null e la rimette in
  vita sul server. La regola "la cancellazione vince" (sezione 9.2) scatta
  solo se la discesa arriva prima. Vale per ogni tabella; è raro (serve
  modificare proprio la riga cancellata). Da affrontare a parte

- **Eliminare un pasto salvato: due garanzie diverse** (incoerenza nota,
  11/10). In Oggi il segnalibro pieno di un pasto, ritoccato, elimina
  subito tutti i pasti salvati con quel contenuto, senza conferma e senza
  Annulla (`toggleSalvaPreferito`). Dalla modifica del pasto salvato,
  aperta da Aggiungi o da Impostazioni > Preferiti, "Elimina pasto" chiede
  conferma. Stessa azione, due livelli di protezione: un tocco per sbaglio
  sul segnalibro perde il pasto. Da decidere a parte se il segnalibro
  debba chiedere conferma o offrire l'Annulla
- Il gesto "indietro" nella modifica di un pasto salvato esce senza avviso
  di modifiche non salvate: accettato per ora. In Impostazioni il cambio di
  scheda ora avvisa (il guardiano, sezione 3); resta scoperto solo il gesto
  "indietro" di Safari dal bordo dello schermo
- **Pasto salvato vuoto da due dispositivi offline** (26/9, non risolvibile
  dal client). Un pasto con due alimenti viene modificato su due dispositivi
  offline, e ciascuno toglie un alimento diverso. La sync tiene per ogni
  riga la scrittura più recente, quindi le due cancellazioni passano
  entrambe e la composizione resta viva senza righe vive. È innocua: resta
  invisibile in Preferiti e non blocca il nome (`pastoSalvatoVisibile`,
  correzione del 22/9), ma la riga esiste. Lo stesso stato resta se un Salva
  che cancella tutto si interrompe fra le righe e la composizione

### Prove su iPhone dell'onboarding (da fare)

Branch `onboarding`, costruito il 17/10 (sezione 3, "Onboarding"). Le
prove 1-16 si fanno in **Safari sull'anteprima del branch**: l'app
installata è la produzione e non apre l'anteprima. "Chiudere l'app" vuol
dire chiudere la scheda di Safari; il "dispositivo nuovo" è **Chrome sul
PC**. Tastiera e riapertura dalla Home si provano dopo il merge (17-19).
Le voci **[Cowork]** sono i controlli che fa Claude da Cowork sul
database, in sola lettura.

Prima di tutto: Impostazioni > Informazioni, la riga Build dice l'ultimo
commit del branch.

**Account A** (nuovo, registrato da Davide con il codice di invito):
1. Registrati → si apre "Ciao <nome>." senza tab bar, con il nome
   giusto.
2. Iniziamo → passo 2: Avanti spento. Con data, altezza e attività ma
   senza sesso, resta spento. Tocco Uomo o Donna → si accende. Avanti.
3. Al passo 3 chiudo la scheda di Safari e la riapro → (lampo di Oggi
   accettato) l'onboarding riparte dal passo 3, non dal Benvenuto.
   [Cowork: profilo salvato, con i 4 campi]
4. Peso "78,4" → Avanti → Indietro → c'è 78,4 → cambio in 78,6 →
   Avanti. [Cowork: una sola pesata oggi, 78,6]
5. Passo 4: nessuna scelta, Avanti spento. Peso obiettivo "0" → spento;
   lo svuoto → scelgo Dimagrire → acceso. Avanti.
6. Passo 5:
   - "Ecco la tua proposta" con i numeri;
   - cambio i grassi → "Hai cambiato la proposta." → "Torna alla
     proposta" → i numeri tornano;
   - Indietro → Mantenere → Avanti → la proposta sale di 500 kcal;
   - "Ho già i miei valori" → campi vuoti, cursore sulle calorie;
   - scrivo 2000 / 60 / 250 / 120 → "Inizia a usare Libra" → Oggi con
     gli obiettivi, i 5 pasti, nessuna scheda.
7. Chiudo e riapro → niente onboarding. [Cowork: metadati
   `onboarding = fatto`, un periodo di obiettivi Mantenere con quei
   target]
8. Chrome sul PC, accedo con A → niente onboarding, nessuna scheda.
   [Cowork: sempre un solo profilo]

**Account B** (nuovo):
9. Registrati → Iniziamo → passo 2 con "Non indicato" → Avanti → passo
   3, peso → Avanti → passo 4.
10. Chrome sul PC, accedo con B → "Caricamento..." poi l'onboarding dal
    passo 4, non dal 2. [Cowork: un solo profilo, una sola pesata]
11. In Safari, al passo 4 → "Dopo" → Oggi con la scheda "Completa il
    tuo profilo" e le etichette "Il tuo obiettivo" e "Obiettivi
    giornalieri".
12. Modalità aereo → chiudo e riapro Safari → la scheda c'è ancora →
    "Continua" → onboarding dal passo 4 → Mantenere → passo 5 con i
    campi vuoti e la frase sul sesso non indicato → scrivo i valori →
    "Inizia a usare Libra" → Oggi senza scheda.
13. Tolgo la modalità aereo, riapro → niente onboarding né scheda.
    [Cowork: metadati `fatto`, obiettivi arrivati sul server]
14. Chrome sul PC (era rimasto al passo 4): ricarico → Oggi, niente
    onboarding.

**Account di prova fisso** (davidemancon02@gmail.com, Safari
sull'anteprima):
15. Oggi normale: niente onboarding, niente scheda nemmeno per un
    istante.
16. Profilo: le scelte di sesso e attività uguali a prima. Obiettivi:
    "Calcola proposta" dà gli stessi messaggi e numeri di prima. Peso:
    "Registra peso" come prima.

**Dopo il merge** (app installata = produzione), **account C** nuovo:
17. Registrazione dall'app installata → onboarding. La tastiera non
    copre Avanti ai passi 2, 3, 4, 5.
18. Esco a metà (passo 3) chiudendo l'app dal multitasking → la riapro
    dalla Home → riparte dal passo 3.
19. Finisco → Oggi.

**Alla fine**: A, B e C si eliminano con Elimina account. [Cowork:
nessuna riga orfana]

### Prossimi passi

1. **Onboarding** dopo la registrazione, branch `onboarding`: costruito
   il 17/10, da provare su iPhone (sopra, "Prove su iPhone
   dell'onboarding"; sezione 3, "Onboarding")
2. **`login-ritocchi`**, branch da aprire dopo l'onboarding
3. **`cambia-password`**, branch da aprire dopo `login-ritocchi`
4. **Una settimana d'uso vero** (è il senso della fase 2, sezione 6). La
   domanda a cui deve rispondere: da quale sezione di Aggiungi si parte
   davvero (ricerca, Recenti o Preferiti)
5. ~~**Dopo la settimana:** l'indicatore di sincronizzazione in app~~
   fatto e provato su iPhone il 10/10, prima della settimana (sopra,
   "Fatto")
6. ~~**Un indirizzo di produzione pubblico**~~ fatto l'11/10:
   https://app-libra.vercel.app, con Site URL e Redirect URL su Supabase
   aggiornati (sopra, "Fatto")
7. ~~**Rinominare l'app in "Libra"**~~ fatto l'11/10: nome e icona
   della bilancia (sezione 7, "Nome e icona"; sopra, "Fatto")
