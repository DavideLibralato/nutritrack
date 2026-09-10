# Note modifiche — da testare in uso reale

Elenco delle modifiche individuate durante l'uso dell'app, da passare a
Claude Code per l'implementazione. Diverso da `CHANGELOG.md` (storico di
cosa è stato fatto) e da `PUNTO_DI_PARTENZA.md` (stato e decisioni): questo
è solo la lista di cose da correggere/aggiungere.

Priorità: 🔴 bloccante · 🟡 importante · ⚪ rifinitura

---

## Da fare

*(vuoto — tutte implementate, in attesa di verifica in uso reale)*

---

## Fatte

### 2026-09-10 — Voci 1, 2, 3, 4, 5

Implementate tutte in un unico giro di lavoro (non ancora committate al
momento della scrittura). Da provare sul telefono:

- **Voce 4** → non è codice: è diventata la sezione "Deploy che toccano lo
  schema dati — procedura anti-perdita" in `CLAUDE.md`. Nessuna delle altre
  voci toccava lo schema (`alimenti.marca` esisteva già), quindi niente
  migration e niente bump di versione Dexie.
- **Voce 1** → ordine Kcal → Grassi → Carboidrati → Proteine nel form
  crea/modifica alimento, nell'anteprima dello sheet quantità, nelle barre
  macro di Oggi e nei target del Profilo.
- **Voce 5** → campo "Marca" (facoltativo) nel form crea/modifica; in modifica
  ora è aggiornabile (prima restava invariato). Nella lista risultati della
  ricerca, con la marca valorizzata, compare "Nome · Marca".
- **Voce 2** → risultati e stati vuoto/nessun-risultato ancorati sotto la
  barra di ricerca (non più centrati); riga "Crea alimento manualmente" fissa
  in fondo, presente in ogni stato; Invio/"Vai" della tastiera crea
  l'alimento quando la ricerca non trova nulla.
- **Voce 3** → in Oggi, tap sulla riga del pasto (solo se ha alimenti)
  nasconde/mostra la sua lista. Stato in memoria, per id di pasto: al riavvio
  torna tutto aperto.
- **Bonus non in nota** → bug del giorno logico applicato alla pagina Oggi e a
  /aggiungi: un inserimento fatto prima dell'ora del primo pasto finisce nel
  giorno precedente (era rimandato dal 2026-09-06). Test permanenti aggiunti.

---

### Testo originale delle note (archivio)

### 1. Ordine dei valori nutrizionali non allineato alle etichette reali

- **Schermata**: Aggiungi alimento → Modifica/crea alimento manualmente
  (screenshot: `Colazione` → "Modifica alimento"). Probabilmente anche altri
  punti dove gli stessi 4 valori vengono mostrati o inseriti (sheet quantità,
  eventuale dettaglio alimento, target giornalieri in Profilo, macro in Oggi)
- **Cosa non va**: l'ordine attuale è Kcal, Proteine, Carboidrati, Grassi.
  Le etichette nutrizionali reali dei prodotti riportano sempre l'ordine
  Kcal, Grassi, Carboidrati, Proteine — copiare i valori da un'etichetta
  costringe a saltare avanti e indietro tra i campi
- **Comportamento atteso**: allineare l'ordine a Kcal → Grassi → Carboidrati →
  Proteine ovunque nell'app vengano mostrati o richiesti questi 4 valori
  insieme, non solo nel form di modifica alimento
- **Priorità**: 🟡 importante

---

### 2. Ricerca alimento: la tastiera nasconde il bottone "Crea alimento manualmente"

- **Schermata**: Aggiungi alimento → ricerca senza risultati (screenshot:
  ricerca "Prova")
- **Cosa non va**: lo stato vuoto/nessun risultato e il bottone "+ Crea
  alimento manualmente" sono impaginati come se occupassero lo schermo
  intero (centrati/in basso). Quando la tastiera è aperta per digitare la
  ricerca, occupa metà schermo e il bottone finisce sotto la piega — bisogna
  chiudere la tastiera con un tap in più solo per vederlo e premerlo
- **Comportamento atteso** (tre modifiche insieme, non alternative):
  1. Risultati e stato vuoto ancorati subito sotto la barra di ricerca,
     non centrati sullo schermo intero — restano visibili sopra la
     tastiera in ogni stato (vuoto, risultati, nessun risultato)
  2. "+ Crea alimento manualmente" sempre raggiungibile come riga fissa in
     fondo alla lista, non solo quando la ricerca non trova nulla — utile
     anche quando ci sono risultati ma nessuno è quello giusto
  3. Il tasto "Vai"/invio della tastiera, quando non ci sono risultati, fa
     la stessa azione del bottone "Crea alimento manualmente" (un tap in
     meno, niente bisogno di chiudere la tastiera)
- **Priorità**: 🟡 importante

---

### 3. Pasti collassabili in Oggi

- **Schermata**: Oggi, lista pasti
- **Cosa non va / cosa manca**: ogni pasto mostra sempre nome, kcal totali e
  sotto la lista degli alimenti. Non c'è modo di nascondere gli alimenti di
  un pasto quando non servono in quel momento (es. per scorrere più in
  fretta la giornata)
- **Comportamento atteso**: tap sul nome del pasto (o su tutta la riga)
- **Priorità**: 🟡 importante

---

### 4. Nessuna perdita di dati sugli aggiornamenti (push/deploy)

- **Schermata**: nessuna in particolare — è una regola di processo per ogni
  futuro deploy che tocca lo schema dati
- **Cosa non va / cosa manca**: non è ancora una procedura formalizzata che
  ogni push non perda i dati già creati da ogni utente, nelle 9 tabelle
- **Comportamento atteso**: prima di ogni deploy che modifica lo schema,
  verificare due punti separati:
  1. **Migration Supabase**: nessuna migration elimina o rinomina una
     colonna/tabella con dati dentro senza prima migrare quei valori. Le
     migration devono essere additive
  2. **Versione schema Dexie (IndexedDB)**: quando la struttura locale
     cambia, il numero di versione Dexie si alza e viene scritta la
     funzione di upgrade che porta i dati esistenti sul dispositivo alla
     struttura nuova — senza upgrade esplicito i dati locali vengono persi
     al primo avvio dopo l'aggiornamento
- **Priorità**: 🔴 bloccante

---

### 5. Campo "Marca" mancante nella creazione/modifica alimento

- **Schermata**: Aggiungi alimento → "Crea alimento manualmente" / "Modifica
  alimento" (stesso form dello screenshot della voce 1)
- **Cosa non va / cosa manca**: il form ha solo il campo "Nome". Due
  prodotti con lo stesso nome ma marca diversa (es. "Yogurt magro" di due
  marche, con valori nutrizionali diversi) devono per forza avere nomi
  scritti a mano in modo diverso per distinguerli, invece di usare la marca
- **Comportamento atteso**:
  - Aggiungere il campo "Marca" (facoltativo) nel form di creazione/modifica
    alimento — il campo esiste già nello schema (`alimenti.marca`), manca
    solo la UI
  - Dove il nome dell'alimento compare in una lista (ricerca, recenti,
    preferiti) e la marca è valorizzata, mostrarla per distinguere i
    prodotti — es. "Yogurt magro · Fage" invece di solo "Yogurt magro"
- **Priorità**: 🟡 importante
