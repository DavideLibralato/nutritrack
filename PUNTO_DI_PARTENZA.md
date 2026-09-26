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

Navigazione a tab bar con tre voci (Oggi, Statistiche, Profilo). La pagina di
inserimento si apre sopra, non è una tab.

**Layout delle pagine con la tab bar.** A scorrere è il **documento**, non un
contenitore interno. La tab bar è `position: fixed` in fondo, e il contenuto
lascia sotto di sé uno spazio pari alla sua altezza (variabile CSS
`--altezza-tab-bar` in `globals.css`, unico posto dove sta il numero). La
barra Salva di Profilo è `sticky` con `bottom` uguale a quella variabile, cioè
appena sopra la tab bar. Oggi fa eccezione: ha un'altezza fissa (schermo meno
tab bar) e fa scorrere solo la lista dei pasti.

**Mentre scrivi, le barre si nascondono.** Su un dispositivo touch, finché un
campo ha il fuoco, la tab bar e la barra Salva di Profilo sono invisibili. Un
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
   Sulla prima riga c'è solo ‹ data ›, sempre su una riga sola. Sulla
   seconda, allineati a destra accanto alla riga delle calorie, ci sono il
   pulsante **Oggi** (solo su un giorno diverso da quello corrente) e, se la
   differenziazione dei giorni è attiva, una piccola pastiglia
   **Normale / Allenamento** (vedi "Giorni normali e giorni di allenamento").
   Se la differenziazione non è attiva, la pastiglia non c'è. Misurato a
   320 px: la data più larga ("Mercoledì 20 mag") e la seconda riga nelle
   combinazioni possibili ci stanno
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

**Layout: tre fasce, solo quella centrale scorre.**

- **In alto, fisso**: data, calorie rimanenti, anello e barre macro
- **Al centro, scorrevole**: la lista dei pasti
- **In basso, fisso** sopra la tab bar: il pulsante "+ Aggiungi"

Il pulsante non deve mai finire sotto la piega: è l'azione per cui esiste l'app.
Se su schermi piccoli la fascia scorrevole risulta troppo stretta, la fascia
alta può rimpicciolirsi mentre si scorre (l'anello diventa una riga compatta) —
da valutare sul dispositivo vero, non ora.

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

Un pasto salvato si **rinomina o elimina** dalla matita sulla sua riga in
Preferiti (separata dal tap sulla riga, che lo aggiunge subito). Gli
alimenti e le quantità **non si modificano**: per cambiarli si risalva da
capo dal pasto di una giornata. Se serva davvero modificarli lo dirà la
settimana d'uso (sezione 11, "Prossimi passi").

**Due percorsi di inserimento, non uno.** Questa è la decisione che il mockup
introduce e che va tenuta:

- **"+" sulla riga** → aggiunge subito con la quantità dell'ultima volta, senza
  aprire nulla. **Un tap.** È il percorso normale: mangi il solito yogurt nella
  solita quantità
- **tap sul nome** → apre lo sheet quantità precompilato e modificabile. È il
  percorso per quando la quantità cambia

Lo sheet quantità resta **uno solo**, identico per ogni sorgente (sezione 5).

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

### Profilo

- **Intestazione**: avatar con l'iniziale, nome, e sotto in grigio "78,4 kg · 180 cm"
  (ultima pesata e altezza salvate). Il nome viene dai metadati dell'account
  scritti alla registrazione (`profili.nome` non lo scrive ancora nessuno): se
  manca, niente avatar e il titolo resta "Profilo"
- **Dati personali** (per il calcolo): sesso, data di nascita, altezza, livello di attività.
  Non sono dati "in più": senza di loro il fabbisogno non è calcolabile (vedi
  sotto). Il sesso ammette "preferisco non indicarlo", che disattiva il calcolo
  automatico e lascia i target manuali
- **Registra peso**: un campo con il suo pulsante, che salva **subito** in
  `misurazioni` (una pesata al giorno, la seconda aggiorna la prima). È fuori dal
  Salva: il peso è una misurazione, non un'impostazione
- **Obiettivo**: tre pulsanti affiancati (Dimagrire / Mantenere / Massa), quello
  attivo con sfondo e bordo d'accento
- **Peso obiettivo**: facoltativo. Se c'è, compare come linea di riferimento nel
  grafico del peso — allo stesso modo della linea tratteggiata delle calorie
- **Target giornalieri**: quattro righe (Calorie, Grassi, Carboidrati, Proteine)
  con il valore a destra. "Calcola proposta" li riempie dal fabbisogno usando i
  dati personali sul modulo e l'ultima pesata (senza pesate è disattivato:
  "Registra prima il tuo peso"); restano modificabili a mano
- **Giorni differenziati**: interruttore acceso/spento. Da spento non compare
  nulla, in nessuna schermata. Da acceso si sbloccano il secondo set di target e
  i giorni della settimana in cui ti alleni di solito
- **Storico peso**: arriverà con Statistiche, non in Profilo per ora
- **Dati su questo dispositivo**: "Ricarica i dati dal tuo account" (§9.2) ed
  **Esci**. Esci chiede conferma solo se uscire può far perdere qualcosa:
  modifiche non ancora inviate (restano sul dispositivo ma non arrivano
  all'account finché non si rientra da lì) o modifiche al modulo non salvate.
  Esce solo questo dispositivo (`scope: "local"`), e non offline: senza rete
  non si esce, con un messaggio, mai "a metà". I dati locali restano (§9.6,
  cancellazione al logout rimandata)
- **Tema**: Chiaro / Scuro / Sistema — **non ancora costruito**, e non va
  mostrato finché non esiste: tre pulsanti che non cambiano niente sembrano
  rotti. È un lavoro a sé

#### Un solo Salva (deciso il 2026-09-26)

Dati personali, Obiettivo e Giorni differenziati sono **un unico modulo con un
solo pulsante Salva**, in una barra in fondo alla pagina. Il Salva confronta i
valori sullo schermo con quelli caricati e **scrive solo le tabelle delle
sezioni cambiate** (Dati personali → `profili`; Obiettivo → `obiettivi` +
target "normale"; Giorni differenziati → `profili` + target "allenamento").
Nessun ordine obbligato fra le sezioni, nessun salvataggio automatico al
tocco dell'interruttore. Le sezioni toccate hanno bordo d'accento ed
etichetta "Modificato", sotto ogni campo cambiato c'è il valore precedente, e
la barra dice quali sezioni verranno aggiornate (con "Annulla modifiche").
Ricarica, Esci e la chiusura/ricarica della pagina avvisano se ci sono
modifiche non salvate; il cambio di scheda dalla tab bar no (accettato per
ora). Logica e test in `src/lib/profilo/salvataggioProfilo.ts`.

**Cambio vero o correzione.** Se è cambiato l'obiettivo o un target (anche
solo quello di allenamento) di un periodo già esistente, il Salva chiede:
- **"È un cambio vero"** (predefinita) → periodo nuovo in `obiettivi`, con la
  **data d'inizio modificabile**: da oggi (giorno logico) indietro fino al
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
valido nel giorno logico corrente (`periodoInCorso` in `totaliDiario.ts`).

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

È lo stesso errore del giorno logico e dello storico degli obiettivi, per la
terza volta. Vale la regola generale: **quello che l'app deduce nel momento in cui
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
aggiungere, eliminare e riordinare dal Profilo *(non ancora costruito: oggi
esiste solo il set predefinito, nessuna schermata per modificarlo)*.

Ogni pasto ha **solo un'ora di inizio**, non un intervallo: dura fino all'inizio
del pasto successivo, e l'ultimo arriva fino al primo del giorno dopo. Un campo
invece di due, e per costruzione niente buchi e niente sovrapposizioni.

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

### Inserimento retroattivo

**Si deve poter registrare anche i giorni passati.** Non è un caso limite: è la
sera in cui recuperi la giornata, o il rientro dopo un weekend senza telefono.

- **La data in cima a Oggi è navigabile**: frecce per il giorno prima e dopo,
  tap sulla data per il calendario. Quando non sei su oggi, un modo evidente per
  tornarci
- **Il giorno futuro non è inseribile.** La navigazione si ferma a oggi: una voce
  datata domani sporcherebbe medie e grafici senza che nessuno se ne accorga
- **Sui giorni passati il pasto non si indovina dall'ora** — sarebbe sempre
  sbagliato. Il pulsante "+ Aggiungi" propone il **primo pasto ancora vuoto** di
  quella giornata, perché stai completando; se sono tutti pieni, l'ultimo della
  lista. E come sempre il titolo è toccabile
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
- `data` è il **giorno logico** (sezione "Il giorno logico"), la stessa
  convenzione di `voci_diario.data` — non la data di calendario grezza. Un
  inserimento fatto all'una di notte classifica il giorno di ieri, non quello
  del calendario, coerentemente con la voce che quell'inserimento scrive
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
- `nome` ("Colazione", "Pranzo 1"), `ora_inizio`, `ordine`
- creata alla registrazione con il set predefinito, poi modificabile dall'utente
- è la tabella che rende possibile "Pranzo 1 / Pranzo 2" senza toccare il codice

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

### Il giorno logico

Serve una regola, perché l'ultimo pasto della giornata scavalca la mezzanotte
(Cena inizia alle 19:30 e dura fino alle 06:00).

> Un inserimento fatto **prima dell'ora di inizio del primo pasto** appartiene al
> giorno precedente.

Registri qualcosa all'una di notte: finisce nella Cena di ieri, non nella
Colazione di oggi. È la stessa logica con cui l'app propone il pasto, applicata
alla data.

**La data è calcolata una volta e memorizzata**, non ricalcolata a ogni lettura.
Gli orari dei pasti sono modificabili dall'utente: se fossero ricalcolati,
spostare la Colazione dalle 06:00 alle 05:00 riscriverebbe l'appartenenza di
voci di mesi fa. Stesso principio dello storico degli obiettivi — il passato non
si riscrive mai da solo.

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

**Stato: il tema scuro NON è costruito.** Esiste solo il tema chiaro:
`src/app/globals.css` ha un unico `:root` con i colori chiari, nessun blocco
scuro, nessun selettore in Profilo, niente in `localStorage`. Il vincolo qui
sopra invece è rispettato (verificato il 2026-09-26: nessun colore scritto
a mano nei componenti), quindi il giorno che si fa bastano i valori scuri
delle stesse variabili, più il selettore. Fuori dalle variabili CSS, e da
rivedere quel giorno: `themeColor` in `src/app/layout.tsx`, i colori di
`public/manifest.json` e quelli ricopiati in `public/offline.html`.

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
    funzionato) c'è "Ricarica i dati dal tuo account" in Profilo — vedi
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
  - **le quattro schermate** (`/`, `/aggiungi`, `/statistiche`, `/profilo`):
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
    service worker di scaricare le quattro schermate e i file che citano
    (l'elenco si legge dall'HTML delle pagine: nella build di Next 16 con
    Turbopack ogni file JS è citato da almeno una pagina). Così offline si
    apre anche una scheda mai visitata. A ogni riscaldamento si tolgono i
    file che nessuna pagina salvata cita più (i deploy vecchi)
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

**Checklist B.7 (CLAUDE.md) non ancora eseguita empiricamente** per
`version(4)` (campo `sospesa_il` su outbox) e `version(5)` (tabella
`sync_cursori`). Verificate il 2026-09-20 **per lettura del codice**, non
con la prova che la checklist richiede (partire da un IndexedDB popolato
con lo schema vecchio, applicare la build nuova, controllare le righe dopo
l'upgrade). Punti controllati: `sincronizza.ts` (filtro `!v.sospesa_il`) e
`discesa.ts` (`!voceInSospeso.sospesa_il`) — entrambi trattano un campo
mancante (`undefined`, riga scritta prima che il campo esistesse) come
"non sospesa", coerente col fallback previsto; nessun altro punto in `src/`
legge `sospesa_il`. `sync_cursori` è una tabella nuova che parte vuota,
ogni lettura passa da un controllo di esistenza (`cursore?.` o
`cursore ? ... : null`), mai un accesso diretto. Nessun punto trovato che
legga uno dei due valori senza fallback — ma è un argomento da lettura del
codice, non la prova empirica: aggiornare questa nota quando viene
eseguita davvero.

#### Ripristino dei dati locali (deciso il 2026-09-25)

Profilo → "Dati su questo dispositivo" → **"Ricarica i dati dal tuo
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
server con il resto. Dopo il ripristino i moduli di Profilo si ricaricano
dai dati nuovi — altrimenti mostrerebbero i valori di prima, e un "Salva"
li rimanderebbe al server sopra quelli giusti.

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
stessa riga, mai come un doppione. `garantisciPastiPredefiniti` non "semina
una volta": controlla i 5 nomi **uno per uno** (non un controllo aggregato
"l'utente ha già un pasto?") e ricrea solo quelli mancanti — un pasto perso
per un bug viene auto-riparato, uno cancellato deliberatamente (riga
presente con `deleted_at`) non viene mai resuscitato dal seed stesso.

Conseguenza: l'indice unico `pasti_user_nome_idx` (che impediva due pasti
con lo stesso nome per utente) è stato **rimosso** — proteggeva solo
l'estetica (nessun'altra tabella usa `pasti.nome` come chiave, `voci_diario`
punta a `pasto_id`) al costo di poter bloccare in silenzio la coda outbox su
una violazione di vincolo. Con l'id deterministico il doppione che
giustificava l'indice non può più verificarsi per i pasti predefiniti.

**Rischio accettato — seed su dispositivo nuovo con discesa fallita.** Se un
dispositivo apre l'app per la prima volta a locale vuoto (fuori dal percorso
di registrazione, che sa già che il server è vuoto) e la discesa iniziale
fallisce (offline, permessi, bug) **proprio mentre** uno dei 5 pasti
predefiniti era stato cancellato sul server, quel dispositivo non ha modo di
saperlo e lo ricrea: il pasto torna a esistere. Non è più un doppione (l'id
resta lo stesso, quindi al successivo sync riuscito la riga si allinea da
sola), è la resurrezione di una cancellazione — comunque preferibile al
doppione irrisolvibile del vecchio schema a id casuali. Rischio ristretto
all'intersezione di tre condizioni (dispositivo che non ha mai visto quella
riga, discesa fallita in quel momento, pasto predefinito già cancellato),
non eliminabile senza un meccanismo sproporzionato al danno (valutato e
scartato: un seed "provvisorio" che trattiene la salita fino a conferma del
server propaga il blocco a ogni voce di diario che referenzia quei pasti via
foreign key, e la riconciliazione per nome si rompe se l'utente rinomina un
pasto predefinito prima di riconnettersi).

**Difetto aperto, segnalato il 2026-09-25 e non ancora corretto.** Lo stesso
meccanismo scatta anche su un dispositivo che NON è nuovo: se la discesa dei
pasti fallisce, `garantisciPastiPredefiniti` crea le righe mancanti con
`repositoryPasti.crea`, che manda al server `deleted_at` null — un pasto
predefinito cancellato apposta, e mai scaricato su quel dispositivo, torna
in vita anche sul server. Il ripristino dei dati locali non fa seed, quindi
non lo peggiora; va chiuso come lavoro a sé.

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
**"Aggiunto — Annulla"**.

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
4. la regola del giorno logico (l'inserimento dell'una di notte)
5. la proposta del pasto in base all'ora, inclusa la fascia che scavalca la
   mezzanotte

Sono cinque funzioni, si testano con una manciata di casi. È il punto in cui un bug
non fa rumore: non crasha niente, i numeri sono solo un po' sbagliati — e te ne
accorgi mesi dopo.

Stato al 2026-09-26: hanno test permanenti la 1 (`totaliDiario.test.ts`), la
3 (`obiettivoValidoPer` in `totaliDiario.test.ts`, il ripiego sul target
"normale" in `obiettiviTarget.test.ts`), la 4 (`dataGiorno.test.ts`) e la 5
(`propostaPasto.test.ts`). La 2 aspetta le Statistiche, che non esistono
ancora.

**Aggiornamento (6 settembre 2026):** Vitest + Testing Library + jsdom sono
configurati nel progetto — non solo per queste cinque funzioni, ma per ogni
bug di questa famiglia. Il primo caso reale non era nella lista sopra ma
identico nello spirito: una race condition tra `useUtenteId()` e
`useLiveQuery` nella pagina Profilo faceva sparire i dati precaricati al
refresh, perché una risposta "non so ancora" (`undefined`) veniva confusa con
"ho controllato, non c'è nulla" (`null`/`[]`). Corretto, e tenuto come test
permanente. Regola pratica: un bug di logica sottile (calcoli, race
condition, regole come il giorno logico) diventa un test che resta nel
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

Aggiornato al 26 settembre 2026. È la fotografia di oggi; la storia, commit
per commit, sta in `CHANGELOG.md`.

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

**Punto 0 — local-first** (sezione 9.2). Dexie è a `version(5)`: le 11
tabelle più `outbox` e `sync_cursori`. Repository unico per ogni scrittura;
salita dall'outbox che si ferma al primo errore e accantona una voce dopo 5
tentativi falliti; discesa incrementale e paginata; `orchestratore.ts`
(discesa prima della salita, tre inneschi); id deterministici per i pasti
predefiniti e per le righe di `giorni`; "Ricarica i dati dal tuo account"
in Profilo; service worker scritto a mano per l'uso offline; utente
riconosciuto offline anche con il token scaduto (punto 10.6).

**Punto 1 — auth, profilo, fabbisogno.** Login e registrazione con Supabase
Auth (beta a inviti), recupero password. Profilo rifatto il 26/9 con un
solo Salva e la scelta fra cambio vero e correzione (sezione 3), calcolo
Mifflin-St Jeor, storico in `obiettivi`, "Registra peso", peso obiettivo,
giorni differenziati, Esci.

**Punto 2 — Oggi e inserimento manuale.** Oggi a tre fasce con data
navigabile (frecce e calendario), giorno logico, anello e barre macro,
pastiglia Normale/Allenamento, pasti richiudibili, voce spostabile di pasto
dallo sheet. Aggiungi alimento con ricerca nel catalogo locale, crea,
modifica ed elimina alimento (con la marca), sheet quantità unico.

**Punto 3 — recenti, preferiti, pasti salvati.** Recenti (5), Preferiti,
pasti salvati promossi da Oggi con la stella, rinominabili ed eliminabili
da Preferiti. Regola "alimenti cancellati" (sezione 4) con Annulla dopo la
cancellazione.

**Tastiera iOS nelle pagine con la tab bar** (26/9, provata su iPhone). A
scorrere è il documento, con la tab bar fissa. Mentre un campo ha il fuoco,
tab bar e barra Salva si nascondono e ricompaiono quando la tastiera si
chiude (sezione 3, "Layout delle pagine con la tab bar").

**Test.** 180 test permanenti in 18 file (Vitest), tutti verdi al 26/9.

### Non ancora costruito

- **Statistiche** e storico del peso (fase 6): la pagina è un segnaposto
- **Ricerca Open Food Facts** (fase 4) e **OCR / "Scansiona etichetta"**
  (fase 5)
- **Tema scuro** (sezione 7): esiste solo il tema chiaro
- Rimedi della sezione 10 ancora da fare: **catalogo precaricato** (10.1),
  barra **"Aggiunto — Annulla" dopo un inserimento** (10.2; oggi c'è solo
  dopo la cancellazione di un alimento), **"Esporta i miei dati"** (10.4)
- Gestione delle fasce dei pasti dal Profilo (rinominare, aggiungere,
  riordinare: sezione 3, "I pasti") e ora del consumo (`consumato_alle`)
  modificabile nello sheet
- **Indicatore di sincronizzazione** in app: oggi un fallimento di sync non
  arriva mai all'utente, la UI conferma dal passo locale
- Cancellazione dei dati locali al logout: **rimandata per scelta** (9.6)

### Difetti e verifiche aperti

- **Seed dei pasti predefiniti che resuscita una cancellazione** anche su un
  dispositivo non nuovo, se la discesa dei pasti fallisce (§9.2, segnalato
  il 25/9)
- **Checklist B.7 non eseguita empiricamente** per `version(4)` e
  `version(5)` di Dexie (§9.2): va fatta prima del prossimo deploy che tocca
  lo schema locale
- **Colore dei placeholder** cambiato con Tailwind 4 (più scuro): il 24/9 la
  verifica sul telefono era in corso, non risulta corretto né chiuso
- **Service worker** (26/9): provato in simulazione e con il server locale,
  la prova sul telefono (modalità aereo, cambio scheda, secondo deploy) non
  è ancora registrata
- Il cambio di scheda dalla tab bar non avvisa di modifiche non salvate in
  Profilo: accettato per ora (sezione 3, "Un solo Salva")

### Prossimi passi

1. **Una settimana d'uso vero** (è il senso della fase 2, sezione 6). Due
   domande a cui deve rispondere: da quale sezione di Aggiungi si parte
   davvero (ricerca, Recenti o Preferiti), e quante volte si vorrebbe
   modificare un pasto salvato (oggi si può solo rinominarlo o eliminarlo;
   per cambiarne gli alimenti lo si risalva)
2. **Dopo la settimana:** l'indicatore di sincronizzazione in app, e la
   modifica di un pasto salvato — solo se la settimana dice che serve
