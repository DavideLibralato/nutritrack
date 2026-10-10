# Punto di partenza — app tracking nutrizionale

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
   le kcal totali a destra, e sotto in grigio i nomi degli alimenti separati da
   punto medio. Un pasto vuoto mostra "—", non viene nascosto. Un tocco sulla
   riga di un pasto con alimenti nasconde o mostra il suo elenco (solo in
   memoria: a ogni apertura dell'app sono tutti aperti)
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
logica e test in `src/lib/inserimento/modificaPastoSalvato.ts`.

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
  5 tentativi);
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

**Dopo ogni inserimento, "Annulla"** (punto 10.2). I percorsi che scrivono
nel diario sono tre, tutti in `creaVoce` di /aggiungi: la conferma dallo
sheet, il "+" rapido su Recenti/Preferiti, e il "+" di un pasto salvato. Tutti
e tre tornano a Oggi, e lì compare la barra in basso "Aggiunto: Pane", oppure
"Aggiunto: Colazione tipo (3 alimenti)" per un pasto salvato, con
"Annulla" per qualche secondo. Il verbo sta prima del nome, così non ci
sono problemi di genere ("Mela aggiunto"). Se la frase non sta su una
riga va a capo; il nome si accorcia con "…" solo se da solo è più lungo
di una riga. Lo stesso formato vale per "Eliminato: Mela" e "Ripristinato:
Mela" in /aggiungi. Com'è fatta la barra (vetro, icona, linea del tempo) è
descritto nella sezione 7.

- **Cosa annulla.** Esattamente le voci di quell'inserimento, per id: una
  per un alimento, tutte quelle del gruppo per un pasto salvato. È una
  cancellazione logica via repository (`annullaInserimento` in
  `src/lib/repository/vociDiario.ts`), che rilegge le voci da Dexie e
  passa dall'outbox (punto 10.6). Dopo compare "Annullato."
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
  kcal" con i giorni differenziati accesi), Pasti e orari, Peso;
- gruppo **App**: Aspetto (Chiaro / Scuro / Sistema e colore principale;
  a destra tema e colore, "Sistema · Verde"), Preferiti e pasti salvati,
  Sincronizzazione (qui andrà l'indicatore);
- **Informazioni** (versione da `package.json` e commit corto del deploy,
  `VERCEL_GIT_COMMIT_SHA`, scritti nel codice alla build da `env` in
  `next.config.ts`; in locale "sviluppo");
- **Esci** in fondo, in arancio, con la conferma di sempre.

**Rotte.** `/impostazioni`, `/impostazioni/profilo`,
`/impostazioni/obiettivi`, `/impostazioni/peso`, `/impostazioni/aspetto`,
`/impostazioni/sincronizzazione`, `/impostazioni/informazioni`.
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
valgono oggi), Peso; **App**: Aspetto, Sincronizzazione;
**Informazioni**; **Esci**. Restano fuori, come **lavori a sé** e non come
passi di questa pagina, le righe che mancano rispetto alla struttura
finale:
- **Preferiti e pasti salvati** (gruppo App);
- **l'indicatore di sincronizzazione** (nella riga e nella pagina
  Sincronizzazione).

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

### Profilo

In Impostazioni > Profilo (`/impostazioni/profilo`), stile a gruppi con i
campi nella riga. Ci sono solo i dati personali; obiettivo, target e giorni
sono in Obiettivi, la pesata in Peso.

- **Intestazione**: sopra, "‹ Impostazioni" e il titolo "Profilo"; sotto,
  iniziali, nome, "78,4 kg · 180 cm" (ultima pesata e altezza salvate) ed
  email dell'account in sola lettura. Il nome viene dai metadati
  dell'account scritti alla registrazione (`profili.nome` non lo scrive
  ancora nessuno): se manca, niente iniziali e niente nome
- **Dati personali** (per il calcolo): sesso, data di nascita, altezza, livello di attività.
  Non sono dati "in più": senza di loro il fabbisogno non è calcolabile (vedi
  sotto). Il sesso ammette "preferisco non indicarlo" (a schermo "Non
  indicato", nel selettore a tre segmenti), che disattiva il calcolo
  automatico e lascia i target manuali. Il livello di attività ha il menu a
  tutta larghezza sotto il nome, perché le voci sono lunghe
- **"Ricarica i dati dal tuo account"** (§9.2) è passato in Impostazioni >
  Sincronizzazione; **Esci** in fondo all'elenco Impostazioni. Esci chiede
  conferma solo se uscire può far perdere qualcosa: modifiche non ancora
  inviate (restano sul dispositivo ma non arrivano all'account finché non
  si rientra da lì). Le modifiche non salvate di un modulo non c'entrano più:
  per lasciare la pagina col modulo il guardiano chiede già prima. Esce solo
  questo dispositivo (`scope: "local"`), e non offline: senza rete non si
  esce, con un messaggio, mai "a metà". I dati locali restano (§9.6,
  cancellazione al logout rimandata)
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
  - cambia **solo l'ora** → si scrive subito, in ogni giorno del pasto,
    passati compresi *(dal passo 5 con la domanda "Subito" / "Da una
    data": "Date future e cambi programmati", sotto)*;
  - cambia **il nome** → la domanda "da quando vale?": **Correggi** ("Vale
    anche per i giorni passati") o **Da oggi** ("Fino a ieri resta
    «Pranzo»"), con Da oggi già scelto (non riscrive il passato). Nome e
    ora si scrivono **insieme, dopo la risposta**: "Indietro" torna ai
    campi senza aver scritto niente;
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

**Date future e cambi programmati** (passo 5, deciso il 10/10, **in
costruzione** sul branch `pasti-date`: fatta la logica pura,
`src/lib/pasti/cambiProgrammati.ts`; il resto qui sotto è il progetto).
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
  Così farà anche la rinomina "da oggi": la riga vecchia tiene la sua ora
  *(oggi su main la riga vecchia prende l'ora nuova: cambia col passo 5)*.
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
  scheda sparisce da sola, con `useGiornoCorrente`). Una scheda futura
  mostra i pasti come saranno quel giorno, con "nuovo", "nome nuovo" o
  "ora nuova" + "prima: …", "Non ci sarà più: …", e i cambi di quella data
  ("Pranzo → Pranzo 1", "Pranzo 12:30 → 14:30", "Pranzo non ci sarà più —
  4 voci eliminate, dal 12 al 15 ott") ciascuno con **Annulla**. Le schede
  future non si modificano: si modifica sempre da "Oggi".
- **Annulla**: quello della **barra**, subito dopo, usa la fotografia in
  memoria come oggi (rimette anche le righe del filo tagliate). Quello
  della **scheda** lavora sulle righe, quindi anche giorni dopo, e rifà i
  controlli di nome e ora ("Non annullato: …"):
  - rinomina o ora: la riga vecchia riprende la fine di quella nuova, le
    voci della nuova tornano sulla vecchia, la nuova si cancella;
  - elimina: la riga si riapre (senza fine) e **tornano le voci col segno
    di quel cambio, cercate in tutto il filo** (anche quelle che stavano
    su una rinomina programmata tagliata), ricreate sulla riga riaperta,
    anche se il loro giorno è passato; una voce già viva o già ricreata si
    salta. Non tornano le righe del filo tagliate (nessuna riga rimessa in
    vita);
  - nuovo: la riga si cancella, ma non se ha già delle voci.
- **Due telefoni**: le righe nuove si sommano senza problemi; se tutti e
  due modificano la stessa riga, vince l'ultima scrittura e possono
  restare due righe dello stesso filo valide negli stessi giorni (due pasti
  in Oggi). I controlli stanno nell'app, il server non può impedirlo: si
  sistema a mano con Elimina.

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

## 4. Modello dati (11 tabelle)

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
  vincolo né indice; **in arrivo col passo 5, migration non ancora
  applicata**): il SEGNO di una voce cancellata da "Elimina pasto da una
  data" (o "da oggi", che è la stessa operazione). Vale l'id del cambio,
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
   la finestra. Se l'utente non preme, la cancellazione resta.

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

### Campi tecnici obbligatori su ogni tabella

Conseguenza delle decisioni della sezione 9 (multiutente + local-first). Vanno
messi da subito, non aggiunti dopo:

- `id` **uuid generato dal client**, non `serial` — il dispositivo deve poter
  creare una riga valida mentre è offline
- `user_id` con riferimento a `auth.users`, e **RLS attiva su ogni tabella**
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
  principale: resta il solo segnale di obiettivo superato.

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
    dopo il commit
  - **una sincronizzazione per volta** (dal 9/10): se un giro è in corso,
    una chiamata nuova non ne apre un altro ma ne prenota **uno** dopo,
    condiviso da tutte quelle arrivate nel frattempo (il giro in corso può
    aver letto la coda prima delle loro voci). Vale per ogni innesco,
    perché passano tutti da `sincronizzaOutbox`: le scritture, l'avvio,
    `online`, il ritorno in primo piano, "Sincronizza ora", Esci, il
    ripristino. Prima ogni chiamata faceva un giro suo: le 14 scritture di
    una transazione facevano 14 giri in parallelo, 196 invii invece di 14
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
  - due cache, `nutritrack-statici-v2` e `nutritrack-pagine-v2`; `activate`
    cancella tutte le altre. Il numero si alza solo se cambia la forma di
    ciò che è salvato o `offline.html`
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
altro utente (i dati locali non si cancellano al logout, §9.6): le sue
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
cancellazione dei dati locali al logout (§9.6), **rimandata per scelta** —
quando arriverà userà la stessa funzione. Test permanenti in
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
  altri utenti
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
- I dati sul dispositivo (IndexedDB) vanno **cancellati al logout**: su un
  telefono condiviso resterebbero leggibili. **Rimandato per scelta**: oggi
  l'app gira su dispositivi personali, e cancellare a ogni uscita costerebbe
  una riscarica completa al rientro senza proteggere da nessuno. Si riprende
  quando l'app si apre agli amici; la funzione pronta è
  `sostituisciDatiUtente` (§9.2, "Ripristino dei dati locali"). Esci oggi
  svuota solo le pagine salvate dal service worker
- Se un giorno l'app si apre al pubblico servono anche informativa privacy,
  export dei propri dati e cancellazione dell'account. In Europa i dati
  nutrizionali collegati a peso e obiettivi ricadono in una categoria protetta,
  quindi quel passo va preparato, non improvvisato

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

Aggiornato al 3 ottobre 2026. È la fotografia di oggi; la storia, commit
per commit, sta in `CHANGELOG.md`.

**Account di prova.** Esiste un account di prova fisso,
davidemancon02@gmail.com, creato il 3/10. Si usa in Safari per le prove
che scrivono dati (utente nuovo, cambio vero, ...), mentre l'app
installata resta sull'account vero. Non va cancellato: con i vincoli
verso `auth.users` oggi non si può comunque (vedi "Difetti e verifiche
aperti"), e sarà il primo caso di prova per "elimina account".

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

**Punto 0 — local-first** (sezione 9.2). Dexie è a `version(6)`: le 11
tabelle più `outbox` e `sync_cursori`. Repository unico per ogni scrittura;
salita dall'outbox con i genitori prima dei figli (dal 9/10), che si ferma
al primo errore e accantona una voce dopo 5 tentativi falliti; scritture
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
ripetuti; sezione 7).

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
giorno nuovo ora si scrive) (sezione 3, "Peso").

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
ricrea il pasto e le voci future. **Da provare** il giorno che cambia
(sotto, "Difetti e verifiche aperti"). Com'è fatto: sezione 3,
"Inserimento retroattivo", "Pasti e orari" ed "Elimina pasto". Test:
`dataGiorno.test.ts`, `useGiornoCorrente.test.tsx`,
`modifichePasti.test.ts`, `vociDiario.test.ts`, `SheetDuplica.test.tsx`,
le pagine Oggi, Aggiungi e Pasti e orari.

**Test.** 609 test permanenti in 55 file (Vitest), tutti verdi al 10/10.

### Non ancora costruito

- **Statistiche** e storico del peso (fase 6): la pagina è un segnaposto
- **Ricerca Open Food Facts** (fase 4) e **OCR / "Scansiona etichetta"**
  (fase 5)
- Rimedi della sezione 10 ancora da fare: **catalogo precaricato** (10.1),
  **"Esporta i miei dati"** (10.4)
- Gestione delle fasce dei pasti, Impostazioni > Pasti e orari: fatti il
  seed (passo 1), la validità nel tempo (passo 2) e la pagina per
  rinominare, cambiare l'ora e aggiungere (passo 3, provato su iPhone il
  9/10) ed eliminare (passo 4, provato su iPhone il 9/10). Mancano le **date future** (passo 5, in costruzione sul branch `pasti-date`). E ora del consumo
  (`consumato_alle`) modificabile nello sheet
- **Indicatore di sincronizzazione** in app: oggi un fallimento di sync non
  arriva mai all'utente, la UI conferma dal passo locale
- Cancellazione dei dati locali al logout: **rimandata per scelta** (9.6)

### Difetti e verifiche aperti

- **Una riga cancellata può tornare in vita da un altro telefono** (visto
  il 9/10 preparando Elimina pasto, non introdotto da lì). Se il telefono
  B, non ancora allineato, modifica offline una riga che il telefono A ha
  cancellato (per esempio rinomina un pasto eliminato), e la salita di B
  parte prima della sua discesa (ogni scrittura fa partire solo la
  salita), l'upsert manda la riga con `deleted_at` null e la rimette in
  vita sul server. La regola "la cancellazione vince" (sezione 9.2) scatta
  solo se la discesa arriva prima. Vale per ogni tabella; è raro (serve
  modificare proprio la riga cancellata). Da affrontare a parte

- **Giorno che cambia, prova da fare l'11/10** sull'app installata (non
  in Safari: è il caso del multitasking). Lasciare l'app aperta la sera,
  riaprirla la mattina: deve andare sul nuovo oggi da qualunque giorno
  stesse mostrando, e un foglio lasciato aperto (sheet della voce, menu,
  Sposta) deve chiudersi senza scrivere niente. Il resto del diario fino a
  7 giorni è provato il 10/10; questo caso lo coprono già i test
  (`useGiornoCorrente.test.tsx`, pagina Oggi)
- **Peso, prova da fare il 4/10** con l'account di prova in Safari:
  registrare lo stesso valore dell'ultima pesata in un giorno nuovo; deve
  comparire con la data nuova. Il resto del passo 4 è provato; questo
  caso lo copre già il test (`misurazioni.test.ts`)
- **Cancellando un utente, le sue righe in `alimenti` non vengono
  cancellate** (2/10): il vincolo verso `auth.users` è `ON DELETE SET NULL`,
  non `CASCADE`, quindi restano con `user_id` null. In più `giorni` e
  `obiettivi_target` sono `NO ACTION`: se l'utente ha righe lì, la
  cancellazione dell'utente fallisce. Da sistemare prima di "elimina
  account". Le altre tabelle sono `CASCADE`. Primo caso di prova:
  l'account di prova fisso (sopra, "Account di prova")
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

### Prossimi passi

1. **Una settimana d'uso vero** (è il senso della fase 2, sezione 6). La
   domanda a cui deve rispondere: da quale sezione di Aggiungi si parte
   davvero (ricerca, Recenti o Preferiti)
2. **Dopo la settimana:** l'indicatore di sincronizzazione in app
