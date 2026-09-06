# Punto di partenza — app tracking nutrizionale

Documento di sintesi delle decisioni prese prima di ricominciare lo sviluppo.
Serve come base per la chat di progettazione dentro il progetto Claude.ai.

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
   testo: "2043 di 2200 kcal", perché "rimangono" su ieri non vuol dire niente
2. **Anello + macro affiancati**: l'anello calorie a sinistra con il consumato
   grande al centro e l'obiettivo sotto ("1580 / 2200"); a destra le tre barre
   macro con valore/target ("Proteine 98 / 140 g"). Affiancati, non impilati:
   sta tutto sopra la piega
3. **I pasti in lista** — quanti e quali dipende dall'utente (tabella `pasti`,
   cinque nel set predefinito, non quattro come nel mockup). Per ognuno il nome,
   le kcal totali a destra, e sotto in grigio i nomi degli alimenti separati da
   punto medio. Un pasto vuoto mostra "—", non viene nascosto
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

1. **"Scansiona etichetta"** — riquadro grande con l'accento, titolo e
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
  con **linea tratteggiata dell'obiettivo** etichettata ("obiettivo 2200"). Il
  colore è informazione: barra normale = dentro l'obiettivo, barra calda = sopra
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
- **Dati per il calcolo**: sesso, data di nascita, altezza, livello di attività.
  Non sono dati "in più": senza di loro il fabbisogno non è calcolabile (vedi
  sotto). Il sesso ammette "preferisco non indicarlo", che disattiva il calcolo
  automatico e lascia i target manuali
- **Obiettivo**: tre pulsanti affiancati (Dimagrire / Mantenere / Massa), quello
  attivo con sfondo e bordo d'accento
- **Peso obiettivo**: facoltativo. Se c'è, compare come linea di riferimento nel
  grafico del peso — allo stesso modo della linea tratteggiata delle calorie
- **Target giornalieri**: quattro righe (Calorie, Proteine, Carboidrati, Grassi)
  con il valore a destra. Calcolati dal fabbisogno, modificabili a mano
- **Registra peso** e **Storico peso**: due righe con chevron, portano altrove
- **Tema**: Chiaro / Scuro / Sistema

### Il calcolo del fabbisogno

Va detto esplicitamente perché determina quali dati servono nel profilo.

Formula di **Mifflin-St Jeor** per il metabolismo basale, che richiede **sesso,
età, altezza e peso**; moltiplicata per un fattore di attività (sedentario →
molto attivo); poi corretta dall'obiettivo (deficit per dimagrire, surplus per
massa). I macro si derivano dalle calorie con percentuali predefinite.

Il risultato è sempre e solo una **proposta**: ogni target resta modificabile a
mano, e un target modificato non viene più ricalcolato da solo alle spalle
dell'utente.

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
aggiungere, eliminare e riordinare dal Profilo.

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

## 4. Modello dati (9 tabelle)

Progettate per il quadro completo, anche se in V1 se ne usa metà. **Creare una
tabella non vuol dire costruire la feature**: alcune restano vuote finché non
serviranno, ma la loro forma condiziona le altre e va decisa adesso.

**`profili`** — dati utente e anagrafica corporea
- `sesso` (con valore "non indicato"), `data_nascita`, `altezza_cm`,
  `livello_attivita`
- sono gli ingredienti del calcolo del fabbisogno, non dati decorativi

**`obiettivi`** — **lo storico dei target**, non un valore singolo
- `valido_dal`, `tipo` (dimagrire / mantenere / massa), `kcal`, `proteine`,
  `carboidrati`, `grassi`, `peso_obiettivo` (nullable)
- cambiare obiettivo **non modifica** la riga esistente: ne inserisce una nuova
- vedi "Estensioni future" più sotto: è la cosa che non si può recuperare dopo

**`pasti`** — le fasce della giornata, **una riga per utente per pasto**
- `nome` ("Colazione", "Pranzo 1"), `ora_inizio`, `ordine`
- creata alla registrazione con il set predefinito, poi modificabile dall'utente
- è la tabella che rende possibile "Pranzo 1 / Pranzo 2" senza toccare il codice

**`alimenti`** — il catalogo
- nome, marca, `barcode`
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
  cosa. Precompilata con l'ora corrente e modificabile nello sheet, mai chiesta.
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
- **Il colore nei grafici segnala, non decora.** Nel grafico calorie funziona
  già così: verde = dentro l'obiettivo, arancio = sopra, grigio = giorno senza
  dati
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
Supabase è la copia remota che si allinea quando c'è rete.

Come, in concreto:
- **Dexie** per il database locale
- un livello *repository*: **la UI non chiama mai Supabase direttamente**
- **outbox**: ogni mutazione entra in una coda locale, che si svuota verso
  Supabase quando la rete torna
- sincronizzazione **last-write-wins per riga**, basata su `updated_at`. Niente
  CRDT: i dati sono mono-utente e mono-dispositivo alla volta, i conflitti veri
  sono quasi impossibili
- service worker per l'app shell → l'app si apre anche senza rete

Perché ora e non dopo: il local-first non è una feature, è *dove vive il dato*.
Aggiungerlo in seguito significa riscrivere ogni lettura e ogni scrittura
dell'app. Effetto collaterale: con Tesseract nel browser, **l'app funziona
interamente offline, OCR compreso**.

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
  telefono condiviso resterebbero leggibili
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

### 10.5 Quattro funzioni da testare sul serio

Non serve testare tutto. Servono test su tre pezzi di logica pura, che non
toccano né database né interfaccia e che sbagliano in modo silenzioso:

1. il calcolo dei totali giornalieri a partire dalle voci
2. le medie settimanali e mensili, **con giorni vuoti in mezzo** (sezione 3,
   Statistiche): è il caso che sbaglia più facilmente e non se ne accorge nessuno
3. la regola del giorno logico (l'inserimento dell'una di notte)
4. la proposta del pasto in base all'ora, inclusa la fascia che scavalca la
   mezzanotte

Sono quattro funzioni, si testano con una manciata di casi. È il punto in cui un bug
non fa rumore: non crasha niente, i numeri sono solo un po' sbagliati — e te ne
accorgi mesi dopo.

**Aggiornamento (6 settembre 2026):** Vitest + Testing Library + jsdom sono
configurati nel progetto — non solo per queste quattro funzioni, ma per ogni
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
  c'è e il rinnovo del token fallisce davvero

### 10.7 L'aggiornamento della PWA

Trappola classica: una PWA installata tiene in cache il codice vecchio e continua
a servirlo dopo che hai pubblicato una versione nuova. Si corregge una volta
sola, nella configurazione del service worker, decidendo la strategia di
aggiornamento. Se ci si pensa dopo, si passa il tempo a chiedere agli amici di
disinstallare e reinstallare.

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

Aggiornato al 4 settembre 2026.

### Database — fatto

Il progetto Supabase `nutritrack` è attivo e lo schema nuovo è applicato.
Quattro migration:

1. `pulizia_vecchio_schema` — drop di `profiles`, `alimenti`, `pasti` (le
   tabelle della v0, tutte a zero righe). Schema `auth` non toccato
2. `schema_iniziale` — le 9 tabelle della sezione 4, con `id` uuid, `user_id`,
   `updated_at` e `deleted_at` su ognuna
3. `rls_policies` — RLS attiva su tutte e 9, quattro policy ciascuna
4. `fix_search_path_set_updated_at` — chiusura di un avviso del linter

Tre scelte prese durante la migration, non presenti nel documento prima:

- **`updated_at` lo scrive un trigger sul server** (`public.set_updated_at`), non
  il client. È la difesa contro l'orologio sbagliato del punto 10.6: il
  dispositivo può mandare quello che vuole, il valore che conta lo mette Postgres
- **Gli enum sono `text` + vincolo `check`**, non tipi `enum` di Postgres.
  Aggiungere un valore domani è una riga di SQL invece di una migration delicata
- **Su `alimenti` le policy di `update` e `delete` richiedono
  `user_id = auth.uid() and verificato = false`.** Una riga condivisa
  (`user_id` null) non soddisfa mai la condizione: il catalogo condiviso è in
  sola lettura per costruzione (punto 10.8). La policy di `insert` impedisce
  anche di crearsi alimenti già `verificato = true`

Resta un solo avviso del linter, non risolvibile gratuitamente:
**Leaked Password Protection** disattivata (Authentication → Sign In / Providers
→ Email → "Prevent use of leaked passwords"). Verificato in dashboard: la
funzione è **disponibile solo dal piano Pro in su** (25$/mese), non è
gratuita come pensavo inizialmente. Resta disattivata: per un'app con pochi
utenti il rischio è basso, e la regola "niente servizi a pagamento senza
avvisare prima" vale anche qui. Da riconsiderare solo se l'app si aprisse
al pubblico.

### Repo — ripulito

Il repo esistente (`~/Progetti/nutritrack`) è stato ripulito invece di crearne
uno nuovo: history git e configurazione Vercel mantenute. Il vecchio codice
della v0 resta consultabile sul tag `v0-vecchia-app`. AI e barcode tolti dalle
dipendenze (`@google/genai`, `html5-qrcode`); aggiunte `dexie` e
`dexie-react-hooks`.

### Punto 0 — livello dati local-first: fatto e verificato end-to-end

Schema Dexie (le 9 tabelle, `src/lib/db/tipi.ts` + `database.ts`), livello
repository (`src/lib/repository/`) e coda outbox (`src/lib/sync/`) scritti e
poi collegati alla sincronizzazione reale verso Supabase.

Due bug reali trovati testando contro il database vero (non solo a
compilazione), entrambi corretti:

- **La sync partiva solo all'avvio dell'app e sull'evento `online`**, mai dopo
  una scrittura fatta a connessione già presente — quindi salvare un dato non
  lo mandava mai su Supabase finché non si ricaricava la pagina. Corretto in
  `repository.ts`: `crea` e `aggiorna` (ed `elimina`, che richiama `aggiorna`)
  ora chiamano `sincronizzaOutbox()` subito dopo, senza `await` (la UI ha già
  risposto dal passo locale, il tentativo di rete va in background). Un
  fallimento di rete durante la sync è ora gestito con `try/catch`: la voce
  resta in coda con `tentativi`/`ultimo_errore`, non blocca le altre
- **I tipi TypeScript di `src/lib/db/tipi.ts` non corrispondevano esattamente
  alle colonne reali su Supabase** su più tabelle: `obiettivi.proteine/
  carboidrati/grassi` dovevano essere `proteine_g/carboidrati_g/grassi_g`
  (causa di un salvataggio che falliva in silenzio: "Salvato." a schermo ma
  niente su Supabase), `profili.livello_attivita` era NOT NULL sul database ma
  nullable nel tipo, `voci_diario.alimento_nome` doveva essere `nome_alimento`,
  mancavano `composizioni.alimento_id` e `composizioni_voci.ordine`. Tutto
  allineato

**Lezione da questo:** un fallimento di sync oggi non arriva mai all'utente —
la UI conferma dal passo locale, che riesce sempre. Va bene per l'MVP (i dati
non si perdono, restano in coda), ma prima o poi serve un indicatore
"sincronizzazione in corso/fallita" visibile, altrimenti un problema come
questo si scopre solo controllando il database a mano. Non blocca lo sviluppo
attuale, da tenere presente.

### Punto 1 — auth, profilo, fabbisogno: fatto

Login/registrazione con Supabase Auth (beta a inviti, `CODICE_INVITO` in
`.env.local`), pagina Profilo con i dati anagrafici e la sezione Obiettivo
(Mifflin-St Jeor, storico in `obiettivi`, peso in `misurazioni` senza
duplicati per lo stesso giorno). Corrette tre piccolezze di UX su
login/registrazione: recupero password aggiunto, il form di registrazione non
si svuota più su codice di invito sbagliato, messaggi di validazione in
italiano. Email di Supabase (reset password) restano in inglese per ora
(punto 10.9).

### Prossimi passi

Fase 2 (sezione 6): pagina Oggi + inserimento manuale — la prima schermata da
usare sul serio per una settimana.
