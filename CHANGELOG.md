# Changelog

Registro cronologico di cosa è stato fatto, più recente in alto. Per lo stato
attuale e le decisioni vedi `PUNTO_DI_PARTENZA.md` — qui c'è solo la storia.

---

## 2026-10-18 — Cambia password: decisioni e prove su iPhone

Branch `cambia-password`, commit 5 (solo documenti). Nel PUNTO:
- §9.1, nuova "Cambia password": la chiamata con `current_password`, i
  due interruttori di Auth ("Require current password when updating"
  accesa, "Secure password change" spenta, controllati da Davide il
  18/10), gli errori decisi dal codice, il caso senza rete, la conferma
  in Profilo e il Portachiavi;
- **decisione corretta sulle sessioni**: quelle sugli altri dispositivi
  si chiudono, perché le chiude il server (`LogoutAllExceptMe`) e non
  c'è modo di evitarlo; le modifiche in coda non si perdono;
- §3 Profilo, la riga Password; §11 "Fatto", il conteggio dei test e
  "Prossimi passi" (merge di `login-ritocchi` fatto);
- §11, nuove "Prove su iPhone di Cambia password", 0-11, con la password
  attuale sbagliata (prova 5), il reset completo dopo l'accensione
  dell'interruttore (10) e, facoltativa, la sessione chiusa su Chrome
  senza perdere modifiche (11).

## 2026-10-18 — Cambia password: la riga in Profilo e la conferma

Branch `cambia-password`, commit 4. In fondo al gruppo Account di
Profilo c'è la riga "Password · Cambia ›" verso `/impostazioni/password`.
`RigaImpostazioni` ora passa da `LinkProtetto`: con modifiche non salvate
in Profilo chiede prima "Esci senza salvare?", nelle altre pagine si
comporta come prima (verificato dai loro test). Al ritorno da Cambia
password, Profilo mostra "Password aggiornata." con `BarraAnnulla`, letta
da `?password=aggiornata` (nuovo `src/lib/account/passwordAggiornata.ts`)
e tolta subito dall'indirizzo con `history.replaceState`, così un
ricaricamento non la fa ricomparire. Test permanenti in
`passwordAggiornata.test.ts` e nel test di Profilo, visti fallire con 4
guasti (segno non tolto, riga con un `Link` normale, barra non mostrata,
segno accettato con qualunque valore).

## 2026-10-18 — Cambia password: la pagina

Branch `cambia-password`, commit 3. Nuova pagina `/impostazioni/password`
(componente server) con dentro `CambiaPassword.tsx`, che mostra
l'account, la password attuale e la nuova con l'occhio, "Salva nuova
password", la riga "Sugli altri dispositivi dovrai rientrare con la nuova
password." e il rimando a Password dimenticata. Per il Portachiavi c'è
l'email in un campo nascosto (`sr-only`) con `autoComplete="username"`.
Senza rete compare il riquadro "Serve la connessione" e il pulsante è
spento. Dopo l'ok si torna a Profilo con `?password=aggiornata`; Profilo
lo leggerà dal commit 4. `IntestazioneSottopagina` ha la prop facoltativa
`indietro` ("‹ Profilo"). La pagina è in `PAGINE_APP` del service worker.
Test permanenti in `CambiaPassword.test.tsx`, con il client Supabase vero
e la rete finta, visti fallire con 4 guasti (invio senza rete,
`currentPassword` nella richiesta vera, `push` invece di `replace`,
ricordo della risposta persa cancellato da un controllo sul dispositivo).
Ancora nessuna riga in Profilo: per ora ci si arriva solo dall'indirizzo.

## 2026-10-18 — Cambia password: la logica in /lib

Branch `cambia-password`, commit 2. Nuovo `src/lib/account/cambiaPassword.ts`:
controlli sul dispositivo, verifica col server (`getUser`) prima di
inviare, poi `updateUser({ password, current_password })`. Il nome è
`current_password` e non `currentPassword` della guida Supabase: il
server legge solo il primo. Ogni errore diventa un esito, deciso dal
codice e non dal testo (con la password attuale mancante o sbagliata il
server manda lo stesso testo inglese). "Attuale sbagliata" dopo una
risposta persa ha un testo suo, perché la password può essere già
cambiata. Testi in `erroriAuth.ts`. Test permanenti in
`cambiaPassword.test.ts`, visti fallire con 4 guasti (esito dal testo,
`currentPassword`, niente testo speciale, chiamata senza risposta da
`getUser`). Nessuna interfaccia ancora.

## 2026-10-18 — Merge di `login-ritocchi` su main

Fast-forward `d3906e8` → `f9d7b26`, 6 commit. Branch cancellato in
locale e su GitHub. Tolta da Supabase la Redirect URL dell'anteprima del
branch e vista la Build `f9d7b26` nell'app installata, confermate da
Davide alle 20:51. Nello stesso commit il mockup del branch successivo,
`docs/mockups/cambia-password.html` (approvato il 18/10).
Branch `cambia-password`.

## 2026-10-18 — Pagine di accesso provate su iPhone

Branch `login-ritocchi`, commit 6 (solo documenti). **Provato su iPhone il
18/10**, dalle 18:27 alle 18:36, sull'anteprima del branch (Build
`731fe3b`): prove 0-15, tutte passate. Le prove 4 e 5 sono state fatte
con l'account vero di Davide, non con quello di prova: solo accessi e
uscite, e il colore principale si salva solo sul telefono, quindi
nessuna scrittura su Supabase. Il reset (9-15) con l'account di prova.
Esiti delle cose da annotare:
- Portachiavi: ha proposto di salvare la password inviata da visibile.
  "Torna nascosta all'invio" basta;
- bilancia nel titolo: va bene, non va ispessita;
- spazio fra il marchio in cima e il titolo (Password dimenticata): va
  bene;
- password nascoste dopo "Le due password non coincidono." (prova 12):
  non danno fastidio, la scelta del commit 2 resta;
- username preso fra il controllo e l'invio: coperto solo dai test; su
  iPhone provato il "già in uso" mentre si scrive.

Verificato da Claude sui log di Auth, in sola lettura: tutte le
richieste partono dall'anteprima. Link chiesto alle 18:31:37, aperto con
la sessione rinnovata alle 18:31:57-58, password cambiata alle 18:32:53
(PUT /user), link riusato rifiutato alle 18:35:36 ("Link non valido"),
uscita e accesso con la password nuova alle 18:35:45-58. PUNTO: §9.1
(Portachiavi provato), §7 (marchio provato), §11 ("Fatto", "Pagine di
accesso"; "Username appena preso" coperto solo dai test) e "Prossimi
passi" (passo 2 fatto; dopo il merge va tolta da Supabase la Redirect URL
dell'anteprima).

## 2026-10-18 — Pagine di accesso: riepilogo del branch e prove su iPhone

Branch `login-ritocchi`, commit 5 di 5 (solo documenti). Il branch
sistema le quattro pagine di accesso: Accedi, Registrati, Password
dimenticata e Reimposta password. **Da provare su iPhone.**
- l'occhio sui quattro campi password, `CampoPassword` (commit 2), e in
  Accedi l'email ripulita come negli altri moduli: non era un difetto,
  il campo `type="email"` toglie già gli spazi;
- il marchio di Libra, `MarchioLibra` e `PaginaAccesso`, con i titoli a
  32 px (commit 3);
- lo username appena preso, con il messaggio giusto e la riga sotto il
  campo che non resta su "Disponibile" (commit 4; questa seconda parte
  era un difetto già in produzione).

PUNTO: "Prossimi passi" (passo 2) e il conteggio dei test in §11.
Nessun cambio di schema, né Supabase né Dexie. 1249 test.

**Prove su iPhone, in ordine.** Anteprima del branch in Safari, con
l'account di prova. Si parte **usciti dall'account**. Non serve creare
account: in Registrati non si invia niente. Serve una sola email di
reset.

0. **La versione giusta.** L'indirizzo in Safari deve essere l'anteprima
   di `login-ritocchi`, non quelle vecchie di `reset-ovunque` o
   `doppioni`: chiudi le schede vecchie. Al primo accesso (prova 4),
   Impostazioni > Informazioni > Build deve mostrare i primi 7 caratteri
   dell'hash del commit 5 di questo branch, quello di questa voce. Se non
   corrisponde, fermati: stai provando un altro codice.

A. **Accedi**:
1. si vede "Accedi a ⚖ Libra": bilancia e parola nel colore principale,
   l'occhio a destra nel campo Password. Cambia il tema del telefono
   (Centro di Controllo): marchio e pagina seguono. Annota se la bilancia
   sembra troppo sottile accanto alle lettere in grassetto (si può
   ispessire dopo);
2. con i campi vuoti tocca l'occhio → nessun messaggio ("Inserisci la
   tua email." vuol dire che il modulo è partito);
3. tocca Password e scrivi "abc", poi tocca l'occhio → si legge "abc", la
   **tastiera resta aperta** e il cursore resta in fondo. Scrivi "d" →
   "abcd", senza maiuscola iniziale né correzione. Tocca di nuovo → di
   nuovo i pallini;
4. cancella. Email dell'account di prova (anche dal suggerimento sopra la
   tastiera), password **scritta a mano** con l'occhio aperto → Accedi →
   Oggi. Controlla la Build (prova 0). Annota se Safari propone di
   salvare o aggiornare la password nel Portachiavi. Se la password è già
   salvata e uguale, può non chiedere niente: va annotato com'è andata,
   non è un errore;
5. Impostazioni > Aspetto → colore Blu → Esci → Accedi con marchio e
   pulsante blu. Rimetti il colore di prima (serve rientrare).

B. **Registrati** (da "Registrati", senza inviare):
6. il titolo è "Crea il tuo account ⚖ Libra" su due righe, e la bilancia
   resta attaccata a "Libra";
7. scrivi una password, tocca l'occhio due volte → il testo c'è ancora;
8. Username: scrivi quello dell'account di prova → dopo un attimo "Questo
   username è già in uso." in arancio, "Crea account" spento (come
   prima). Il caso "preso fra il controllo e l'invio" non si provoca a
   mano: lo coprono i test.

C. **Password dimenticata e Reimposta**. *Prima*: su Supabase
(Authentication → URL Configuration) aggiungi la Redirect URL esatta
dell'anteprima, dalla dashboard: con ogni probabilità
`https://nutritrack-git-login-ritocchi-davide-libralato-personale.vercel.app/**`
(da controllare su Vercel). Senza, il link dell'email porta su
app-libra, e le prove 11-14 girano sul codice di main (PUNTO §11,
"Redirect URL su Supabase: solo voci esatte"). Va tolta dopo il merge.
9. "Password dimenticata?" → marchio piccolo in cima a sinistra (solo la
   bilancia colorata, "Libra" nel colore del testo), sotto il titolo
   "Password dimenticata". Annota se lo spazio vuoto fra il marchio e il
   titolo stona;
10. email dell'account di prova → Invia link → "Controlla la tua email",
    con il marchio **nello stesso punto**;
11. apri il link dell'email in Safari → "Verifica del link in corso...",
    poi il modulo: il marchio non si muove. "Imposta una nuova password"
    su due righe equilibrate. Due occhi indipendenti: aprire quello di
    "Nuova password" non mostra "Conferma password";
12. "Nuova password" e "Conferma password" **diverse**, con tutti e due
    gli occhi aperti → Salva nuova password → "Le due password non
    coincidono." e le due password tornano nascoste. Annota se dà
    fastidio: la scelta del commit 2 è nasconderle a ogni invio, anche
    quando il modulo si ferma per un errore;
13. nuova password con il primo occhio aperto, la stessa nel secondo →
    Salva nuova password → Oggi. Annota se Safari propone di aggiornare
    la password salvata;
14. riapri lo stesso link dall'email → "Link non valido", con il marchio
    in cima;
15. Esci → Accedi con la nuova password → Oggi.

*Alla fine.* Il Portachiavi (Impostazioni di iOS > Password): annota
quale password risulta salvata per l'anteprima. Le prove 4 e 13 dicono
se "torna nascosta all'invio" basta al Portachiavi (PUNTO §9.1, "da
provare su iPhone").

## 2026-10-18 — Username appena preso: il messaggio giusto

Branch `login-ritocchi`, commit 4. Lavoretto di Amici (PUNTO §11). Con
lo username preso fra il controllo e `signUp`, GoTrue risponde solo
"Database error saving new user" (`unexpected_failure`). Il rifiuto lo dà
`crea_nome_utente_registrazione`, non `controlla_registrazione` come
diceva il commento in `auth.ts`: verificato sulla funzione, in sola
lettura. Ora, solo con quell'errore, `registrati` richiede
`username_disponibile`: con il nome preso risponde "Questo username è già
in uso." e `usernamePreso`; con il nome libero (per esempio un codice di
invito rifiutato dal trigger) o senza risposta resta il messaggio
generico. **Difetto già in produzione**, corretto: dopo il "già in uso"
dato all'invio, la riga sotto il campo restava su "Disponibile". Ora
dice "già in uso" e "Crea account" si spegne finché il nome non cambia.
Commento di `auth.ts` corretto. Test in `auth.test.ts` (5 nuovi) e
`register/page.test.tsx` (1), visti fallire senza il secondo controllo,
con il secondo controllo dopo ogni errore, ignorandone la risposta e
senza `usernamePreso` nella pagina. In `auth.test.ts` il `beforeEach` usa
`mockReset` e non più `mockClear`: le risposte "Once" non consumate
passavano al test dopo. PUNTO §3 ("Lo username", al posto di "Username
appena preso, scegline un altro") e §11 (da "Difetti e verifiche aperti"
a "Fatto"). 1249 test, lint e build verdi.

## 2026-10-18 — Il marchio di Libra nelle pagine di accesso

Branch `login-ritocchi`, commit 3. Proposta 3 del mockup
`testata-login.html`. Nuovo `MarchioLibra.tsx`: bilancia SVG in
`currentColor`, in em, con `role="img"` e "Libra". Due varianti: nel
titolo tutto in accento, piccolo in cima solo la bilancia in accento.
Accedi ("Accedi a ⚖ Libra") e Registrati ("Crea il tuo account ⚖ Libra")
lo hanno nel titolo; Password dimenticata e Reimposta lo hanno piccolo in
cima su tutte le schermate. Nuovo `PaginaAccesso.tsx` al posto degli otto
`<main>` scritti a mano. Titoli a 32 px con `text-balance`
(`classiAccesso.ts`). Guardato nel browser a 390 px, dal dev server
locale e senza account: Accedi (anche con "Account eliminato"),
Registrati, Password dimenticata, "Link non valido", in chiaro e in
scuro, e Accedi con l'accento viola e con il blu. Nessun test: è solo
grafica. PUNTO §7, "Il marchio nelle pagine di accesso".

## 2026-10-18 — L'occhio sui campi password

Branch `login-ritocchi`, commit 2. Nuovo `src/components/CampoPassword.tsx`
sui quattro campi password (Accedi, Registrati, i due di Reimposta):
pulsante da 40×40 px nel campo, etichetta fissa "Mostra password" con
`aria-pressed`, il fuoco resta nel campo, all'invio la password torna
nascosta (per il Portachiavi iCloud, da provare su iPhone). Registrati
resta non controllato. In Accedi l'email si ripulisce dagli spazi come
negli altri moduli: non era un difetto, il campo `type="email"` li toglie
già da solo (trovato con un test che non sapeva fallire, poi tolto).
Test permanente `CampoPassword.test.tsx`, visto fallire senza
`type="button"`, senza il ritorno a nascosta all'invio e con il campo
sempre controllato. PUNTO §9.1, "le quattro pagine di accesso". 1243 test,
lint e build verdi.

## 2026-10-18 — Mockup della testata delle pagine di accesso

Branch `login-ritocchi`, commit 1. Aggiunto `docs/mockups/testata-login.html`:
le quattro pagine di accesso con il modulo di oggi, l'occhio sui campi
password e tre proposte per il marchio di Libra. Scelta di Davide: la
proposta 3, "Nel titolo" ("Accedi a ⚖ Libra"; marchio piccolo in cima
dove Libra non è nel titolo). Nel campo "Account" di Reimposta l'email
dell'account di prova è sostituita da `tuonome@esempio.it`. Solo
documenti.

## 2026-10-18 — Merge di `doppioni` su main

Fast-forward `ac90ca9` → `d3906e8`, 10 commit. Branch cancellato in
locale e su GitHub.

## 2026-10-18 — Doppioni rimasti provati su iPhone; test di pagina su Aggiungi

Branch `doppioni`, commit 9. **Provato su iPhone il 18/10**
sull'anteprima del branch, account di prova in Safari, dalle 16:39 alle
17:02: prove 1-20 più la 17b, tutte passate. Una prima prova 14 era
stata fatta per errore sull'anteprima di `reset-ovunque`, con il codice
di prima: Somma sceglibile e una riga da 100.000 g, rifiutata dal server
(400) e rimasta solo in quel browser. I log di Supabase mostravano le
scritture partire da quell'indirizzo, mentre il deploy di `doppioni` era
pronto dalle 14:07. Rifatta su `doppioni`, passata. Verificato da Claude
su Supabase in sola lettura: nessuna voce oltre 99999,99 g, nessuna riga
orfana nei pasti salvati, l'Annulla del segnalibro rimette in vita lo
stesso pasto (stesso id), nessuna "Non salvate online". Nuovo test di
pagina in `src/app/aggiungi/page.test.tsx` sul percorso della prova 14
(tocco sul nome, sheet quantità, 50.000 + 50.000 g: Somma spenta, Tieni
separati, il testo, due righe da 50.000 g); visto fallire con Somma mai
spenta e con il blocco che parte sempre da Somma. PUNTO §11: i casi del
branch passano da "Difetti e verifiche aperti" a "Fatto" ("Doppioni
rimasti"); resta il CHECK `quantita_g > 0` come lavoro futuro. 1240 test.

## 2026-10-18 — Doppioni rimasti: riepilogo del branch e prove su iPhone

Branch `doppioni`, commit 8 di 8 (solo documenti). Il branch chiude i
"doppioni rimasti" di PUNTO §11, tutti corretti e **provati su iPhone il
18/10** (casi 1, 2, 3 e 5; il 4b, l'errore del trascinamento, non si
provoca a mano: coperto dai test, su iPhone provata solo la regressione;
dettagli nella voce del commit 9):
- caso 1, il cambio di pasto dallo sheet di modifica in Oggi passa da
  Sposta, con i grammi nuovi, e i soli grammi hanno Annulla (commit 4 e
  5);
- caso 2, "Non spostarlo" / "Non duplicarlo" valgono anche se il doppione
  sparisce (commit 1);
- caso 3, il segnalibro pieno toglie il pasto salvato con Annulla, in
  transazione (commit 6 e 7);
- caso 4, non era più un difetto (Aggiungi lo gestisce dall'11/10);
- caso 5, Somma mai oltre 99999,99 g: foglio e rete nei piani (commit 2 e
  3);
- in più il commit 4b: un trascinamento fallito senza foglio non spegne
  più i gesti di Oggi (difetto già in produzione).

PUNTO: §3 e §11 ricontrollati per tutto il branch; in §11 il CHECK
`quantita_g > 0` come lavoro futuro (migration a parte, solo con "ok
migration") e i 3 gruppi di voci uguali trovati su Supabase il 18/10.
Nessun cambio di schema, né Supabase né Dexie. 1239 test.

**Prove su iPhone, in ordine** (anteprima del branch, account di prova in
Safari; per la parte C serve anche Chrome sul PC con lo stesso account).
Dopo ogni prova con Annulla il diario deve tornare com'era.

*Preparazione.* Oggi: Colazione con Yogurt 125 g, Pranzo con Yogurt
100 g e Mela 150 g, Cena vuota (alimenti del catalogo, aggiunti da
Aggiungi).

A. **Sheet di modifica** (caso 1), toccando lo Yogurt di Colazione:
1. solo i grammi a 150 → "Aggiornato: Yogurt → 150 g"; Annulla → 125 g;
2. Salva senza cambiare niente → lo sheet si chiude, nessuna barra;
3. pasto Cena e 150 g → "Spostato: Yogurt → Cena, 150 g"; Annulla →
   Colazione 125 g;
4. pasto Pranzo e 150 g → foglio "«Yogurt» c'è già in «Pranzo»" con
   "Pranzo 100 g · Colazione 150 g" e "Somma (250 g)"; Sposta →
   "Spostato: Yogurt → Pranzo, 250 g"; Annulla;
5. come 4, Tieni separati → due righe a Pranzo, 100 e 150 g; Annulla;
6. come 4, Scrivi quantità 200 → "Spostato: Yogurt → Pranzo, 200 g";
   Annulla;
7. come 4, Non spostarlo → esito "→ Resta in Colazione con 150 g", barra
   "«Yogurt» resta in «Colazione» con 150 g."; Annulla → 125 g;
8. come 4, poi Annulla nel foglio → niente cambiato, grammi compresi.

B. **Sposta e trascinamento** (regressione dei commit 4 e 4b):
9. menu sullo Yogurt di Colazione → Sposta → Pranzo: foglio, Somma →
   "Spostato: Yogurt → Pranzo" (senza grammi); Annulla;
10. trascina lo Yogurt di Colazione su Cena → "Spostato: Yogurt → Cena";
    Annulla; poi swipe del giorno e tieni premuto funzionano;
11. trascina lo Yogurt di Colazione su Pranzo → si apre il foglio dei
    doppioni; Annulla nel foglio.

C. **Doppione sparito prima della conferma** (caso 2, due dispositivi):
12. iPhone: aggiungi una Mela da 80 g a Cena. Menu sulla Mela di Pranzo →
    Sposta → Cena → nel foglio "Non spostarlo", **senza confermare**. PC:
    cancella la Mela di Cena. iPhone: esci da Safari e rientra (la sync
    parte al ritorno in primo piano), il foglio è ancora aperto → Sposta
    → la Mela resta a Pranzo, barra "«Mela» resta in «Pranzo», non
    spostato.";
13. come 12 con Duplica (Mela di Pranzo → Cena, "Non duplicarlo") →
    nessuna copia in Cena, barra "Nessuna copia: «Mela» c'è già in
    «Cena»." (il testo di sempre: dice il motivo della scelta).

D. **Somma oltre 99999,99 g** (caso 5):
14. Aggiungi → Colazione → tocca il **nome** di un alimento (per esempio
    Pane, non il "+" rapido) → 50000 g → Aggiungi. Di nuovo il nome del
    Pane → 50000 g → foglio: "Somma (100.000 g)" spenta, "Tieni separati"
    già scelto, sotto "La somma supera 99999,99 g: scegli un'altra
    opzione."; Aggiungi → due righe da 50.000 g;
15. aggiungi Pane 50000 g anche a Pranzo con lo sheet quantità. Menu su
    un Pane di Colazione → Sposta → Pranzo → stesso foglio, Somma spenta;
    Tieni separati → Sposta; Annulla;
16. menu su un Pane di Colazione → Duplica → Pranzo, oggi → stesso foglio;
    chiudi;
17. togli tutti i Pane da 50.000 g (Elimina dal menu).

E. **Segnalibro pieno** (caso 3), sulla Colazione con lo Yogurt 125 g:
18. segnalibro vuoto → salva come "Colazione prova" → pieno. Toccalo →
    "Tolto dai preferiti: Colazione prova", nessuna conferma; Annulla →
    "Annullato.", segnalibro pieno, il pasto è in Aggiungi > Preferiti;
19. toccalo di nuovo → barra; subito il segnalibro (ora vuoto) → salva
    come "Colazione bis"; poi Annulla nella barra (il dito sulla barra
    ferma il conto) → "Non ripristinato: hai già un altro pasto salvato
    con gli stessi alimenti."; in Preferiti c'è solo "Colazione bis";
20. Impostazioni > Preferiti → "Colazione bis" → Elimina pasto → chiede
    conferma come prima → Sì, elimina.

*Alla fine.* Impostazioni > Sincronizzazione: nessuna "Non salvate
online". Da Cowork (sola lettura) su Supabase: nessuna voce oltre
99999,99 g, nessuna riga orfana nei pasti salvati. Poi la pulizia dei dati
di prova.

## 2026-10-18 — Segnalibro pieno in Oggi: «Tolto dai preferiti» con Annulla

Branch `doppioni`, commit 7 di 8 (caso 3, seconda metà). Il tocco sul
segnalibro pieno toglie i pasti salvati con `eliminaPastiSalvati` (commit
6) e mostra "Tolto dai preferiti: Colazione" (lo stesso testo di
Impostazioni > Preferiti; con più pasti "Tolti dai preferiti: 2 pasti
salvati") con Annulla, che li ripristina: "Annullato." e segnalibro di
nuovo pieno, oppure "Non ripristinato: hai già un altro pasto salvato con
gli stessi alimenti." (o con lo stesso nome, o i suoi alimenti non più
nel catalogo; `messaggioDopoRipristinoPasti`, con le parole dell'Annulla
degli alimenti). Prima un errore era silenzioso: ora "Operazione non
riuscita. Riprova." e niente cambia. La barra di Oggi annulla voci del
diario oppure pasti salvati (`Annullabile`); i casi di prima sono gli
stessi. Test: 3 sulla pagina (tocco, Annulla, segnalibro di nuovo pieno;
risalvato prima di Annulla, rifiutato con il testo; errore) e i testi in
`testiAlimentiCancellati.test.ts`; visti fallire con la barra senza
Annulla, con l'Annulla che dice sempre "Annullato.", con l'errore
silenzioso e con il motivo "contenuto" detto come "nome". **Da provare
su iPhone** (elenco nel commit 8).

## 2026-10-18 — Pasti salvati: eliminazione in transazione e ripristino dalla traccia

Branch `doppioni`, commit 6 di 8 (caso 3, prima metà; solo repository).
`eliminaPastiSalvati` toglie uno o più pasti salvati con le loro righe in
una sola transazione Dexie (prima in parallelo e fuori transazione) e
restituisce la traccia; `eliminaComposizione` (Elimina da Preferiti) passa
da lì, con la stessa firma. `ripristinaPastiSalvati` rimette in vita dalla
traccia, ma non un pasto il cui nome o contenuto è ormai preso, né uno
rimasto senza alimenti nel catalogo; con conflitti solo su alcuni pasti
tornano gli altri (come per gli alimenti). La parte comune con l'Annulla
di un alimento è ora `ripristinaPastiNellaTransazione`: il comportamento
degli alimenti non cambia (i loro test passano invariati). Test in
`composizioni.test.ts`: tutto o niente, traccia, ripristino riuscito,
ripristino ripetuto senza scritture, nome preso, contenuto presente, due
pasti con un conflitto, pasto vuoto, Elimina da Preferiti invariata. Visti
fallire senza la transazione, senza il controllo del contenuto, con la
traccia che include pasti già cancellati e senza il controllo del pasto
vuoto (lì fallisce anche un test degli alimenti già esistente). La pagina
non lo usa ancora (commit 7): **da provare su iPhone** solo Elimina da
Preferiti, che deve restare com'era.

## 2026-10-18 — Sheet di modifica in Oggi: cambio di pasto via Sposta, Annulla sui grammi

Branch `doppioni`, commit 5 di 8 (caso 1, seconda metà). `confermaModifica`
non scrive più pasto e grammi con un `aggiorna` diretto, che cambiando
pasto creava un doppione senza foglio e non aveva Annulla. Niente di
cambiato: si chiude e basta. Solo i grammi: `applicaScritture` e la barra
"Aggiornato: Mela → 120 g" con Annulla (`messaggioAggiornato`, ora
condiviso con Scrivi quantità in Aggiungi). Il pasto: lo stesso Sposta
del menu con i grammi nuovi in arrivo (commit 4), foglio dei doppioni se
serve; "Non spostarlo" dice "→ Resta in Colazione con 150 g" nel foglio e
"«Yogurt» resta in «Colazione» con 150 g." nella barra
(`esitoNonSpostarlo`, `grammiNuovi` in `messaggioSpostamento`). Se la
voce si sposta con i grammi nuovi: "Spostato: Yogurt → Pranzo, 150 g"
(con Somma o Scrivi quantità i grammi della riga che resta,
`grammiInDestinazione` in `pianoSpostamento.ts`); senza grammi nuovi il
testo di Sposta. Test: 7 sulla pagina (niente cambiato, solo grammi con
Annulla, pasto senza doppione con Annulla, Non spostarlo con i grammi
nuovi e Annulla, Somma, solo il pasto senza grammi nel testo, foglio
chiuso senza scritture) e i testi in `pianoSpostamento.test.ts`,
`testiSpostamento.test.ts` e `testiBarra.test.ts`; visti fallire con il
ramo del pasto spento, con la barra senza fotografia, senza i grammi
nuovi nei testi, con `esitoNonSpostarlo` che li ignora, senza l'uscita
"niente di cambiato", con la barra senza grammi in destinazione, con i
grammi anche senza grammi nuovi e con "Non spostarlo" non riconosciuto.
**Da provare su iPhone**: solo i grammi e Annulla; cambio di pasto senza
doppione; con doppione Somma, Tieni separati, Scrivi quantità, Non
spostarlo e Annulla; foglio chiuso senza confermare; più Sposta dal menu
e trascinamento, che passano dallo stesso codice (commit 4 e 4b).

## 2026-10-18 — Trascinamento fallito: errore nella barra, gesti di nuovo attivi

Branch `doppioni`, commit 4b (fuori dal piano a 8, chiesto da Davide
prima del commit 5). Difetto **già in produzione**, trovato preparando il
caso 1: se un trascinamento senza doppioni falliva, lo spostamento
restava in sospeso con l'errore ma senza nessun foglio a mostrarlo, e
`gestiAttivi` teneva spenti swipe, tieni premuto e trascinamento fino a
una ricarica. Ora, senza un foglio aperto, lo spostamento si azzera e
"Operazione non riuscita. Riprova." va nella barra senza Annulla, come
per Elimina dal menu; con un foglio aperto l'errore resta nel foglio.
Niente scritto, come prima. Test in `page.test.tsx` (guasto finto su
`aggiorna`: barra, niente Annulla né foglio, niente scritto, la riga si
solleva di nuovo); visto fallire con il codice di prima e con lo stato
non azzerato. **Da provare su iPhone** (difficile da provocare: serve un
guasto vero di Dexie; basta riprovare che il trascinamento normale
funzioni).

## 2026-10-18 — Sposta accetta i grammi nuovi di una voce (repository)

Branch `doppioni`, commit 4 di 8 (caso 1, prima metà; tocca il percorso
di Sposta e del trascinamento). `spostaNelPasto` accetta
`origine: { tipo: "voce", id, grammi }`: la voce in arrivo vale con i
grammi nuovi nel foglio dei doppioni, in Somma e nella rete del massimo.
Il piano (`idGrammiNuovi`) scrive una sola volta per riga: pasto e
grammi nello stesso `aggiorna` se la voce si sposta, niente sulla voce
che Somma o Scrivi quantità cancellano, i soli grammi con "Non
spostarlo". Senza grammi, o con gli stessi, scritture identiche a prima.
Test in `vociDiario.test.ts`: le quattro scelte e il caso senza
doppione, ognuno con Annulla che riporta pasto e grammi; il massimo
superato con Somma; i grammi uguali. I test esistenti di Sposta e
trascinamento passano senza modifiche. Visti fallire con il piano che
ignora i grammi nuovi, con il repository che non li applica e con il
confronto dei grammi tolto. La pagina non lo usa ancora (commit 5):
niente da provare su iPhone per ora; Sposta e trascinamento **da
riprovare** su iPhone insieme al commit 5.

## 2026-10-18 — Foglio dei doppioni: Somma spenta oltre 99999,99 g

Branch `doppioni`, commit 3 di 8 (caso 5, seconda metà). In
`SheetDoppioni`, se il totale supera il massimo, "Somma (… g)" è spenta,
il blocco parte da "Tieni separati" e sotto la griglia compare "La somma
supera 99999,99 g: scegli un'altra opzione."; gli altri blocchi non
cambiano. Il totale del foglio, quello della riga d'esito
(`testoEsitoDoppione`, che aveva un suo arrotondamento) e quello dei
piani sono ora la stessa funzione, `totaleSomma`. Vale per Sposta,
trascinamento, Duplica e Aggiungi, che usano lo stesso foglio. Test nuovo
`SheetDoppioni.test.tsx` (oltre il massimo, limite esatto, un blocco solo
spento); visti fallire con il blocco che parte sempre da Somma e con Somma
non spenta. **Da provare su iPhone**: due voci dello stesso alimento da
50.000 g, poi Sposta, Duplica e "+" in Aggiungi.

## 2026-10-18 — Rete del massimo di 99999,99 g nei piani dei doppioni

Branch `doppioni`, commit 2 di 8 (caso 5, prima metà). Il totale di
"Somma" poteva superare il massimo di `numeric(7,2)`: Dexie lo salvava,
il server lo rifiutava e la sync accantonava la riga. Ora
`grammiRigaCheResta` in `pianoSpostamento.ts`, comune a `pianoSpostamento`
e `pianoInserimento` (Sposta, trascinamento, Duplica, Aggiungi), lancia
un errore oltre `GRAMMI_MASSIMI` prima di qualsiasi scrittura; le pagine
mostrano il loro messaggio d'errore di sempre. Il controllo vale per i
grammi finali, quindi anche per "Scrivi quantità" (il foglio già non lo
accetta: rete in più). `totaleSomma` è la funzione del totale che userà
anche il foglio (commit 3). Test in `vociDiario.test.ts` (per i tre
percorsi: 50.000 + 50.000 rifiutato senza scritture né outbox, 99999,99
esatti che passano) e in `pianoSpostamento.test.ts`; visti fallire
spostando il limite in su e con `>=` al posto di `>`. Nessuna prova su
iPhone a sé: si vedrà con il foglio, nel commit 3.

## 2026-10-18 — "Non spostarlo" e "Non duplicarlo" valgono anche se il doppione sparisce

Branch `doppioni`, commit 1 di 8 (i "doppioni rimasti", caso 2). Se la
riga in doppione veniva cancellata fra il foglio e la conferma (per
esempio da un altro dispositivo), Sposta e Duplica spostavano o
copiavano lo stesso l'alimento escluso; Aggiungi no. Ora la regola è una
sola, `togliEsclusi` in `pianoSpostamento.ts`, chiamata dentro
`pianoSpostamento` e `pianoInserimento` (quindi anche Duplica): Aggiungi
non ha più la sua copia in `vociDiario.ts`. Test nuovi in
`vociDiario.test.ts` (Sposta di un pasto e di una voce sola, Duplica,
ognuno con "escludi" e con "somma" dopo la sparizione); visti fallire
rompendo `togliEsclusi`, insieme a quello di Aggiungi già esistente.
**Da provare su iPhone** (serve un secondo dispositivo). PUNTO: §3 e §11
aggiornati; il caso "aggiunta di un alimento già presente" non è più un
difetto, l'unico percorso rimasto è il cambio di pasto dallo sheet di
modifica (caso 1, più avanti su questo branch); prova del reset in
produzione fatta e Redirect URL dell'anteprima tolta.

## 2026-10-18 — Merge di `reset-ovunque` su main

Fast-forward `8c44218` → `ac90ca9`. Provato in produzione dall'app
installata il 18/10: Password dimenticata → Mail → Safari → nuova
password → accesso dall'app. Tolta da Supabase la Redirect URL
dell'anteprima del branch (resta solo `https://app-libra.vercel.app/**`).

## 2026-10-18 — Documenti del reset da qualunque browser

Branch `reset-ovunque`, provato su iPhone il 18/10 (anteprima, account di
prova: reset chiesto da Chrome sul PC e link aperto in Safari, 3 email,
database verificato da Cowork; PUNTO §11 segna le prove come passate e
la Redirect URL dell'anteprima da togliere dopo il merge). PUNTO: §9.1
"Il ripristino della password" con il flusso nuovo (perché implicito
solo per la richiesta, il client a parte, la sessione nel frammento
raccolta dalla pagina, il rinforzo con il rinnovo, il prezzo in
sicurezza e il limite residuo: l'access token dell'indirizzo vale fino
a 3600 secondi, e il riuso del refresh token è riconosciuto solo con
"Detect and revoke potentially compromised refresh tokens" attivo,
verificati da Davide il 18/10), con il ramo PKCE descritto come
transitorio. §10.9: i modelli delle email sono bloccati senza SMTP
personalizzato (verificato da Davide sulla dashboard il 18/10), e il
blocco "solo indirizzi del team" che sembra non valere per questo
progetto. §11: il limite "un reset chiesto dall'app installata non può
riuscire" è risolto sul branch, da provare; nuovo difetto aperto
"togliere il ramo PKCE e `LINK_ALTRO_BROWSER`" come lavoro futuro;
nuova sezione "Prove su iPhone del reset da qualunque browser" (11
passi, 3 email, account di prova: reset chiesto da Chrome sul PC, link
aperto su iPhone da Mail → Safari) più la prova in produzione dall'app
installata dopo il merge. Solo documenti.

## 2026-10-18 — Rinnovo della sessione subito dopo il link

Branch `reset-ovunque`. Subito dopo `setSession`, prima del modulo, la
pagina chiede un rinnovo (`refreshSession` con il refresh token del
frammento): il server ne dà uno nuovo, e quello passato dall'indirizzo
non vale più. Se qualcuno lo ritrovasse (cronologia di Safari) e lo
riusasse, il server chiuderebbe la sessione. Se il rinnovo fallisce
niente modulo: `signOut({ scope: "local" })` toglie la sessione da questo
browser (la libreria la conserverebbe, perché l'access token vale
ancora) e, con la rete, la chiude sul server; testo di connessione se
manca la rete, altrimenti link non valido. 3 test nuovi (rinnovo con il
token dell'indirizzo e prima del modulo, refresh token finale diverso;
rinnovo rifiutato; rete assente, con l'orologio finto perché la libreria
ripete per circa 30 secondi). La rete finta risponde in più a rinnovo e
`/logout`. Tre rotture della pagina prese dai test; una quarta ("modulo
anche con il rinnovo fallito" togliendo il controllo sull'errore) non
cambia il comportamento, perché `refreshSession` fallito restituisce
sempre anche la sessione vuota. 1187 test, tsc, lint e build verdi.

## 2026-10-18 — /reimposta-password raccoglie la sessione dal frammento

Branch `reset-ovunque`. Il link chiesto con il flusso implicito torna con
la sessione nel frammento (`#access_token=…&type=recovery`). La pagina lo
legge per prima cosa, lo toglie subito dall'indirizzo
(`history.replaceState`, anche se poi qualcosa fallisce) e chiama
`setSession` sul client dell'app, che salva la sessione nei cookie. Poi
scrive il segno e mostra il modulo dell'account del link. Errori: rete →
testo di connessione; token rifiutati → link non valido; `otp_expired`
nel frammento → link scaduto. L'errore "Not a valid PKCE flow url" di
`initialize()` (il client nato prima che il frammento venisse tolto) si
ignora solo con una sessione di recovery nel frammento. La raccolta parte
una volta per caricamento (una ref: StrictMode non la ripete). Ramo PKCE
(`?code=`) invariato per i link già spediti. Nuovi:
`src/lib/frammentoRipristino.ts`, `ERRORE_CONNESSIONE` in `erroriAuth.ts`.
7 test nuovi in `reimpostaPassword.test.tsx`; nei casi di prima nessun
ritocco, la rete finta riconosce in più il token del link (firma base64url
valida: `setSession` la controlla, lo scambio PKCE no). Cinque rotture
della pagina, ognuna presa da almeno un test. 1184 test, tsc, lint e build
verdi.

## 2026-10-18 — La richiesta del link di reset parte con il flusso implicito

Branch `reset-ovunque`. Primo passo del reset che funziona da qualunque
browser: `/password-dimenticata` chiede il link con un client Supabase a
parte (`src/lib/supabase/clientRichiestaReset.ts`, flusso implicito, senza
memoria), invece del client dell'app che usa sempre PKCE. La richiesta
parte senza `code_challenge`, quindi il link non è più legato al browser
che l'ha chiesto e nessun "code verifier" finisce nei cookie. Stesso
`redirectTo` di prima. Il file esporta solo `chiediLinkRipristino`: il
client non si può usare per altro. La pagina `/reimposta-password` non
raccoglie ancora la sessione dal frammento (passo successivo): da solo
questo commit non va in produzione. Test nuovi in
`passwordDimenticata.test.tsx` (nessun `code_challenge`, nessun verifier,
cookie della sessione aperta identici), rossi tutti e 3 con il client
PKCE. 1177 test, tsc, lint e build verdi.

## 2026-10-18 — Fine riga LF ovunque

Su main. Nel repository i file erano già tutti LF, ma nella copia di
lavoro sul PC convivevano CRLF (scritti dal checkout con
`core.autocrlf=true`, dalla configurazione di sistema di Git per
Windows) e LF (file scritti da Claude Code e dagli script): oggi 322 CRLF,
180 LF e un file misto (`modificaPastoSalvato.test.ts`, misto per un
`cat >>` di Claude in questa sessione). Nuovo `.gitattributes`
(`* text=auto eol=lf`, binari espliciti, `.bat`/`.cmd` CRLF),
`.vscode/settings.json` con `"files.eol": "\n"`, `.prettierrc` con
`"endOfLine": "lf"`. `git add --renormalize .` non ha cambiato nessun file:
nel repository nessun contenuto cambia. I 323 file non LF sono stati
riestratti da git con le regole nuove, dopo una copia di sicurezza
completa (`.git` e file non tracciati compresi), verificata byte per byte.
Controlli dopo: `git ls-files --eol` con 504 file LF/LF e 8 binari, nessun
CRLF né misto; `git diff HEAD` solo sui file nuovi; contenuto identico alla
copia a parte le fine riga (323 file diversi byte per byte, zero
ignorando il CR); binari e file non tracciati identici. PUNTO: la regola
in §8, tolto "Uniformare le fine riga" dai difetti aperti in §11. 1174
test, lint e build verdi.

## 2026-10-18 — Si arrotonda ai decimali della colonna prima di scrivere

Su main. Corretto il difetto trovato col lavoro precedente: altezza e peso
obiettivo (`numeric(5,1)`) si scrivevano in Dexie come digitati ("175,55"),
mentre il server teneva 175,6. Ora passano da `altezzaOPesoDaCampo`, già
arrotondata, usata da validazione, scrittura e `normalizza`; "0,04" fa 0
e non vale. Una regola sola, `arrotondaDecimali` in `numeriDecimali.ts`
(mezzo per eccesso, senza gli errori di `Math.round(n * 100) / 100`, uguale
a `numeroPerCampo`), usata anche da `leggiNumeroDecimale`, dalla pesata
(`leggiPesoKg`, che ora arrotonda da sé e controlla il valore arrotondato)
e da `arrotondaGrammi` dei doppioni, con il totale del foglio. Controllati
gli altri numeri: grammi e valori dell'alimento erano già arrotondati,
pesata e somme dei doppioni non potevano divergere (un decimale in una
colonna a due, somme di valori a due decimali), alimenti ricevuti già
arrotondati, target integer. Test permanenti nuovi, provati rompendo le
copie in sette punti; i test esistenti passano senza ritocchi. Trovato e
lasciato aperto: la "Somma" dei doppioni non controlla il massimo
99999,99. PUNTO §3: la regola; "Difetti e verifiche aperti": tolto
quello corretto, aggiunto quello nuovo. 1174 test, lint e build verdi.

## 2026-10-18 — Ogni campo numerico si precompila con la virgola

Su main. Dopo lo sheet quantità, gli altri campi che ripartivano da un
valore salvato con `String()` e mostravano "0.9", "12.5", "72.5": i
valori e la porzione nel form dell'alimento, i grammi della modifica di
un pasto salvato, altezza e peso obiettivo in Profilo e Obiettivi (anche
dopo il Salva, `normalizza`), l'altezza dell'onboarding. Una funzione
sola, `numeroPerCampo` in `src/lib/numeriDecimali.ts` (virgola, niente
zeri inutili né punto delle migliaia, decimali scelti dal chiamante);
`grammiPerCampo` e il peso dell'onboarding la usano. "Prima: …" della
modifica pasto passa a `formattaGrammi`. Target integer non toccati.
Controllato: i confronti "modificato" di Profilo, Obiettivi e pasto
salvato sono numerici (`numeriUguali`, `stessiGrammi`), quindi "72.5"
contro "72,5" non risultava e non risulta modificato. Test permanenti
nuovi (funzione, form alimento, pasto salvato, Profilo con Salva e
riapertura, onboarding), provati rompendo le copie in nove punti; i test
esistenti passano senza ritocchi. Difetto trovato e lasciato aperto:
altezza e peso obiettivo accettano due decimali, Dexie tiene 175,55 e il
server (`numeric(5,1)`) 175,6. PUNTO §3: la regola. 1159 test, lint e
build verdi.

## 2026-10-18 — Sheet quantità: i grammi si precompilano con la virgola

Su main. Il campo dei grammi si apriva con `String(...)`: una voce da
12,5 g mostrava "12.5", come una porzione predefinita decimale. Ora usa
`grammiPerCampo` (nuova, in `src/lib/inserimento/grammi.ts`), che ha le
stesse cifre di `formattaGrammi` ma senza "g" e senza il punto delle
migliaia: riusare `formattaGrammi` così com'era avrebbe aperto 12.500 g
con "12.500", che `leggiGrammi` legge come 12,5 — un Salva senza
guardare avrebbe cambiato la quantità. Valori interi identici a prima.
Test permanente nuovo (`SheetQuantita.test.tsx`: 12,5, 100, 0,5 e
12500,25 mostrati e risalvati uguali), provato rompendo una copia del
componente in due modi (`String()` e `formattaGrammi`). Lasciati com'erano
e segnalati gli altri campi precompilati con `String()`. PUNTO §5: la
virgola nel campo; §3 e §11: onboarding unito e provato in produzione
(prove 17-19), account A-D eliminati. 1143 test, lint e build verdi.

## 2026-10-17 — Merge di `onboarding` in main

Unito il 17/10 con fast-forward, da `f2c034a` a `0eef1c1`; deploy di
produzione Ready. Branch cancellato in locale e su GitHub. 1139 test.
Dopo il merge Davide ha fatto le prove 17-19 in produzione, dall'app
installata, con l'account C (tastiera, riapertura dal multitasking a
metà onboarding, fine → Oggi); poi gli account A, B, C e D eliminati
con Elimina account: restano 6 utenti, nessuna riga orfana (verificato
da Cowork).

## 2026-10-17 — Onboarding: provato su iPhone

Branch `onboarding`. Solo documenti. Provato da Davide il 17/10
sull'anteprima del branch, in Safari su iPhone più Chrome sul PC come
secondo dispositivo: prove 1-16 della lista in PUNTO §11, con i controlli
di Cowork sul database tutti passati (un solo profilo anche con l'accesso
da Chrome a metà onboarding, una sola pesata dopo la correzione del peso,
periodo e target giusti, il segno "fatto" arrivato anche dopo la
modalità aereo). Dopo la correzione del caricamento completo, la
registrazione con l'account D: onboarding subito, senza refresh, e i dati
sul server già nella prima sessione. Restano le prove 17-19 con l'app
installata, dopo il merge. Coperti dai test e non provati a mano: il
limite Safari/Chrome offline e i fallimenti ripetuti di `updateUser`.
PUNTO: stato "provato" nella sottosezione Onboarding, prove 1-16 segnate
come fatte, "Non ancora costruito" e "Prossimi passi" aggiornati,
l'account D fra quelli da eliminare.

## 2026-10-17 — Onboarding: dopo "Crea account" un caricamento completo

Branch `onboarding`. Bug trovato nelle prove su iPhone (account A e B):
dopo "Crea account" `/onboarding` restava su "Caricamento...", e con un
refresh funzionava. Causa verificata leggendo `@supabase/auth-js` e con
un test temporaneo (poi cancellato): `redirect()` della Server Action è
una navigazione interna, il layout radice resta montato, e i suoi
componenti, montati su `/register` senza utente, non ricevono nessun
evento quando la sessione nasce sul server nei cookie (il client emette
`SIGNED_IN` solo per un accesso fatto nel browser). Senza utente
`Sincronizzazione` non partiva e la discesa non riusciva mai. C'era già
prima del branch, invisibile: Oggi crea i pasti da sé, e la prima sessione
dopo la registrazione semplicemente non sincronizzava, fino alla
riapertura. Corretto: con la sessione `registrati` risponde "registrato"
invece di `redirect`, e la pagina Registrati fa
`caricaPaginaDaCapo("/onboarding")` (`window.location.replace`, in
`src/lib/caricamentoCompleto.ts`); il pulsante resta spento intanto. Il
resto della Server Action e il caso senza sessione non cambiano. Test
della Server Action aggiornati (con la sessione nessun `redirect`, esito
"registrato"), test nuovo della pagina Registrati; provati rompendo le
copie in cinque punti. PUNTO §3 "Onboarding": il perché, più le frasi in
§3 "Lo username" e §9.1. 1139 test, lint e build verdi.

## 2026-10-17 — Onboarding: costruito, la lista delle prove

Branch `onboarding`. Solo documenti. Il branch in breve: chi si registra
passa da `/onboarding` (Benvenuto, dati personali, peso, obiettivo,
obiettivi giornalieri con la proposta), con il segno `onboarding` nei
metadati dell'account, la chiave locale che vince offline, la ripresa che
manda gli esiti in sospeso, l'attesa della discesa su un dispositivo
vuoto, la guardia nel layout e la scheda "Completa il tuo profilo" per chi
rimanda. Nessuna chiamata di rete in più per chi non ha un segno. Il
dettaglio sta nelle voci dei commit qui sotto. PUNTO §3, "Onboarding":
riletta contro il codice dei commit 1-10, "costruito, da provare" al posto
di "fatto", e corretti cinque punti che non corrispondevano (il titolo
"Ciao!" senza nome, il controllo del peso obiettivo, l'altezza, il testo
della pagina senza rete, l'attesa della discesa ancora "da fare"); in più
il motivo della ripresa e `invioFallito`, e un paragrafo su costo e rete.
§11: la lista delle prove su iPhone (19 prove, account A, B, il fisso e C
dopo il merge) e il primo dei "Prossimi passi" aggiornato.

## 2026-10-17 — Onboarding: la scheda "Completa il tuo profilo" in Oggi

Branch `onboarding`. `SchedaCompletaProfilo` in cima alla lista dei
pasti, su ogni giorno: titolo, "Senza obiettivi non posso dirti quante
calorie ti restano oggi.", le etichette di `cosaManca` in capsule
`--capsula-attiva` / `--testo-capsula`, "Continua" verso
`/onboarding?continua=1`. Compare solo con `mostraScheda` di
`statoSegno` (`rimandato`, 0 obiettivi, dati noti) e sparisce da sola con
un obiettivo. Utente e segno dal cookie con `utenteConSegno`, che prende il
posto di `utenteConOnboardingDaFare` e serve anche alla guardia: niente
rete per nessuno, e Dexie letto solo con `rimandato`. Controllati i gesti
di Oggi: la scheda non è un bersaglio né una riga del tieni premuto, e lo
swipe la tratta come il resto del pannello. Test in `page.test.tsx` di
Oggi (6); i 28 test esistenti passano senza ritocchi, cambiato solo il
router finto del file (`push` ora è una spia). Provati rompendo le copie
dei file in cinque punti. 1135 test, lint e build verdi.

## 2026-10-17 — Onboarding: la guardia nel layout

Branch `onboarding`. Tocca il primo avvio delle pagine con la tab bar,
quindi è un commit a parte. `GuardiaOnboarding` in `(app)/layout.tsx`:
non disegna niente, e con `mostraOnboarding` fa `router.replace` verso
`/onboarding` una volta sola per montaggio. Trovato prima di scriverla:
`useStatoOnboarding` usa `useUtenteId`, che fa una `getUser` al server a
ogni montaggio, quindi nel layout avrebbe aggiunto una chiamata per tutti.
Per questo l'hook ora ha un cuore, `useStatoOnboardingPer(userId, segno)`,
e la guardia gli passa utente e segno letti dal cookie
(`utenteConOnboardingDaFare`), solo se il segno effettivo è `da_fare`
(`segnoEffettivo`, estratta da `statoSegno`): per gli altri utenti niente
rete e niente Dexie. La pagina `/onboarding` non cambia. Test con lo stato
finto (4) e d'integrazione con `statoSegno` vero e il client Supabase come
spia (6), compreso "appena finito" (chiave `fatto`, metadati `da_fare`:
nessun redirect). Provati rompendo le copie dei file in cinque punti. 1129
test, lint e build verdi.

## 2026-10-17 — Onboarding: la registrazione porta all'onboarding

Branch `onboarding`. Tocca la registrazione, quindi è un commit a parte.
`registrati` mette `onboarding: "da_fare"` nei metadati di `signUp`
(chiave e tipo da `statoOnboarding.ts`, logica pura che si può usare sul
server) e, con la sessione, dopo `impostaUsername` porta a `/onboarding`
invece che a "/". Senza sessione (conferma email accesa) il messaggio
resta identico, e il segno aspetta il primo accesso. Controlli, messaggi
d'errore e codice di invito invariati. Commenti riscritti su come
funzionano oggi i trigger, attivi dal 16/10: verificato leggendo dal
database che `controlla_registrazione` toglie solo `codice_invito` e
riscrive solo `username`, che con uno username preso `signUp` fallisce, e
che `imposta_username` con lo stesso nome non riscrive niente. PUNTO
§9.1 e §3 ("Lo username", "All'invio"): le frasi sulla conferma email e
sui trigger riportate al vero. Test nuovo `auth.test.ts` (5 casi),
provato rompendo una copia in sei punti. 1119 test, lint e build verdi.

## 2026-10-17 — Onboarding: i passi 4 e 5, la proposta e la fine

Branch `onboarding`. Tolto il segnaposto del passo 4. `PassoObiettivo`
con `SchedeObiettivo` (tre schede, si parte senza scelta; le righe sotto
prendono 500 e 300 da `AGGIUSTAMENTO_KCAL_OBIETTIVO`, ora esportato da
`fabbisogno.ts`) e il peso obiettivo facoltativo, valido per
`leggiPesoKg`; Avanti non salva. `PassoTargetGiornalieri`: la proposta di
`propostaObiettivi`, che segue l'obiettivo finché i numeri non si
toccano, "Torna alla proposta", "Ho già i miei valori", i testi per sesso
non indicato e dati mancanti, il pulsante acceso con i controlli di
`validaModulo`. "Inizia a usare Libra" salva i passi 4 e 5 con
`salvaProfilo` (sezione obiettivo, periodo visto nessuno), poi
`concludiOnboarding` "fatto" e Oggi. Con un obiettivo arrivato nel
frattempo: messaggio, "fatto" e il pulsante "Vai a Oggi", senza passaggio
a tempo. 13 test nuovi nella pagina, provati rompendo le copie dei file in
dodici punti. 1114 test, lint e build verdi.

## 2026-10-17 — Onboarding: la pagina, con la barra e i passi 1-3

Branch `onboarding`. `src/app/onboarding/page.tsx`, fuori da `(app)`:
chi entra lo decide `useStatoOnboarding` ("Caricamento...", il testo
della connessione offline in attesa della discesa, `da_fare` dal passo di
ripresa, `rimandato` solo con `?continua=1`, tutti gli altri a Oggi). Il
passo di partenza si decide una volta; poi solo Avanti e Indietro, e i
valori restano nella pagina. Componenti nuovi: `BarraOnboarding`
(Indietro, cinque puntini allungati con `transform`, "Dopo"),
`StrutturaPasso` (contenuto e pulsante a pillola), `TessereScelta`,
`PassoBenvenuto`, `PassoSuDiTe`, `PassoPeso`. Passo 2 salvato con
`salvaProfilo` (`passiOnboarding.ts`), passo 3 con
`registraPesoSenzaDuplicati`. "Dopo" chiama `concludiOnboarding` con
`rimandato` e torna a Oggi senza aspettare la rete. Tastiera: la pagina è
alta quanto la parte visibile (`useAreaVisibile`), come `/aggiungi`.
**Provvisorio fino al commit 7: il passo 4 è un segnaposto**, con il solo
titolo "Il tuo obiettivo" e il pulsante spento. Test della pagina (16) e
di `useStatoOnboarding` (7), e `PassoSuDiTe` nel test dei campi data;
provati rompendo le copie dei file in dodici punti. Un test rifatto
durante la prova: quello di "Dopo" controllava il profilo prima che un
salvataggio partito per sbaglio potesse finire. 1101 test, lint e build
verdi.

## 2026-10-17 — Onboarding: /onboarding nel service worker

Branch `onboarding`. Commit a parte, prima della pagina: `/onboarding` in
`PAGINE_APP` (`public/sw-strategia.js`), così chi chiude l'app a metà la
ritrova anche offline. Controllato prima: la lista non si scarica
all'installazione (`cache.addAll` prende solo `offline.html` e le icone),
e il riscaldamento salta le risposte non riuscite, quindi il 404 finché la
pagina non c'è non blocca niente. Commento datato in `public/sw.js`, che
cambia il file e fa aggiornare il service worker; nessuna versione di
cache alzata, come per le pagine aggiunte prima. Lista in
`swStrategia.test.ts`, provata togliendo `/onboarding` da una copia. 1078
test, lint e build verdi.

## 2026-10-17 — Onboarding: segno nei metadati, chiave locale e ripresa

Branch `onboarding`. Tocca l'autenticazione all'avvio, quindi è un commit
a parte; nessuna interfaccia nuova, e per gli utenti di oggi l'app si
comporta come prima. `src/lib/onboarding/segnoOnboarding.ts`: il segno
letto dal cookie della sessione (nessuna chiamata di rete), la chiave
locale `nutritrack:onboarding:<user_id>` in try/catch, `concludiOnboarding`
(prima la chiave, poi `updateUser`; riuscito toglie la chiave, fallito la
lascia, non lancia mai, e con la sessione di un altro utente non manda
niente) e la ripresa. `decidiRipresa`, funzione pura in
`statoOnboarding.ts`: senza segno mai niente, chiave uguale ai metadati
tolta, chiave diversa mandata, `rimandato` sopra `fatto` tolto senza
mandarlo, rete di sicurezza degli obiettivi solo con i dati noti.
`RipresaSegnoOnboarding` nel layout radice: avvio, ritorno della rete e
ogni avviso dei giri; prende l'utente dal cookie e non da `useUtenteId`,
che avrebbe aggiunto una chiamata `getUser` per tutti. Una chiamata a
`updateUser` alla volta, e dopo un invio fallito i giri non ritentano:
solo l'avvio e il ritorno della rete. Hook
`useStatoOnboarding`, che nessuno usa ancora. `useMetadatiUtente` in
`useUtente.ts` (distingue "non ancora letti" da "non ci sono"), riusato da
nome e username. Esci prova a mandare la chiave prima di `signOut`, e la
chiave sopravvive a Esci; Elimina account la toglie. PUNTO: fatto e da
fare nella sottosezione Onboarding, compresi i pezzi dei commit 2-4, e il
limite noto "finito su Chrome, riaperto Safari offline" fra i difetti
aperti. 38 test nuovi, provati rompendo le copie dei file in undici
punti, più cinque sui nuovi tentativi. 1078 test, lint e build verdi.

## 2026-10-17 — Onboarding: il segno "discesa riuscita in questa sessione"

Branch `onboarding`. Tocca la sincronizzazione, quindi è un commit a
parte. Un segno solo in memoria, in `statoSincronizzazione.ts`:
`scaricaTutto` lo accende per l'utente quando `profili`, `misurazioni` e
`obiettivi` sono scese tutte e tre nello stesso giro, anche senza righe.
Resta acceso anche se un giro dopo fallisce, vale per un utente solo e lo
spegne `azzeraStatoGiri`, che Esci ed Elimina account chiamano già.
Ricaricare la pagina lo azzera. Si legge con `discesaRiuscitaPer` e con
l'hook `useDiscesaRiuscita` (useSyncExternalStore, gli stessi ascoltatori
dello stato dei giri, avvisati solo quando il segno cambia). Nessun cambio
alla sincronizzazione: tabelle, ordine, cursori, salita, errori ed esito
del giro restano come prima. Test `discesaRiuscita.test.ts` (10 casi),
provato rompendo le copie dei due file in sei punti; il test che il segno
avvisi da solo è stato aggiunto perché la prima volta quella rottura
passava (l'avviso di fine giro la copriva). 1040 test, lint e build verdi.

## 2026-10-17 — Onboarding: la logica pura, con test

Branch `onboarding`. `src/lib/onboarding/statoOnboarding.ts`, senza
interfaccia e senza accesso a Dexie, Supabase o localStorage.
`primoPassoDaFare` (obiettivo vivo → finito; profilo assente o data di
nascita, altezza o livello vuoti → 2, il sesso non si controlla; nessuna
pesata viva → 3; altrimenti 4) e `cosaManca`, che usano la stessa lista
dei passi mancanti. `passoDiPartenza`: alla ripresa il Benvenuto solo se
non è salvato niente, con "Continua" mai. `segnoDaiMetadati` (un valore
sconosciuto vale assente) e `statoSegno`: la chiave locale vince, senza
segno mai onboarding né scheda, un obiettivo vivo vale "fatto", la scheda
solo con `rimandato` e 0 obiettivi, e con i dati non ancora noti si
aspetta. Test `statoOnboarding.test.ts` (25 casi), provato rompendo una
copia in sei punti, ognuno preso da almeno un test. 1030 test e lint
verdi.

## 2026-10-17 — Onboarding: opzioni, proposta e peso in /lib

Branch `onboarding`. Refactor senza cambi visibili, per riusare i pezzi
nell'onboarding. Le scelte di sesso, attività e obiettivo passano da
Profilo e Obiettivi a `src/lib/profilo/opzioniProfilo.ts`, con le stesse
etichette. I controlli di "Calcola proposta" (pesata, sesso non
indicato, dati mancanti, età a oggi, poi `calcolaFabbisogno`) diventano
la funzione pura `propostaObiettivi`, che restituisce la proposta o il
motivo; i messaggi della pagina Obiettivi non cambiano. Il controllo del
peso (0 < kg ≤ 500) di "Registra peso" diventa `leggiPesoKg`. Test nuovo
`propostaObiettivi.test.ts` (10 casi), provato rompendo una copia in tre
punti: controllo del sesso tolto, altezza zero accettata, età calcolata
con l'orologio invece che con la data passata. La terza rottura all'inizio
passava, perché la data del test era proprio oggi: spostata al 15/1/2031.
1005 test, lint e build verdi.

## 2026-10-17 — Onboarding: le decisioni nel documento

Branch `onboarding`. Solo documenti, nessun codice. Aggiunto il mockup
`docs/mockups/onboarding.html` (vale lo stile B, "Di benvenuto"). PUNTO
§3: sottosezione nuova "Onboarding", con le decisioni del 17/10 scritte
come regole: il segno `onboarding` nei metadati dell'account (assente,
`da_fare`, `rimandato`, `fatto`), la chiave locale che vince offline,
"c'è già un obiettivo → fatto", i 5 passi e i loro testi, Avanti spento,
salvataggio dei passi 2 e 3 con Avanti e dei passi 4 e 5 insieme alla
fine, l'attesa della discesa (`profili` ha `UNIQUE(user_id)`), la scheda
solo con `rimandato`, in cima alla lista dei pasti, la ripresa, la guardia
nel client invece del middleware, il sesso "Non indicato" al passo 5, la
grafica. §9.1: il segno nei metadati e la conferma email. §11:
aggiornato al 17/10, onboarding in "Non ancora costruito" e in cima ai
"Prossimi passi", poi `login-ritocchi` e `cambia-password`. Mockup:
la simulazione del passo 5 ora chiede tutti e 4 i numeri, non solo le
kcal. Il passo 4 parte senza obiettivo scelto, come il sesso: vale il
documento, il mockup lo mostra già scelto.

## 2026-10-17 — Merge di `condivisione-alimenti` su main

Unito su main il 17/10 con un fast-forward, da `ec86f72` a `f2c034a`.
Deploy di produzione Ready. Branch cancellato in locale e su GitHub.
tsc, lint, 995 test e build verdi sul branch prima del merge. Schema
dati: solo la migration `alimenti_condivisi`, già applicata
(20261016180308); nessuna versione Dexie nuova. Questa voce sostituisce
quella scritta sul branch il 16/10, prima del merge.

## 2026-10-16 — Condivisione alimenti: provata tutta, branch chiuso

Branch `condivisione-alimenti`. Passo 7 provato da Davide su iPhone:
pallino della tab con soli alimenti in arrivo, riga Alimenti "2 in
arrivo" (anche offline, con l'ultimo numero noto), pallino spento dopo
le risposte, testo di Elimina account. Passo 8 fatto con Cowork: A
eliminato con Elimina il mio account vero, con due condivisioni in
attesa nei due sensi; sul database sparito tutto di A (utente, alimenti,
pasti, voci, condivisioni, amicizie, nome), B senza più alimenti in
arrivo, le copie già aggiunte da B rimaste, `@amici_uno` di nuovo
libero, nessun altro utente toccato. Poi eliminati anche B e i tre
account del trigger: restano 6 utenti, nessuna riga orfana. PUNTO:
"Fatto" con la condivisione, account di prova eliminati, test a 995,
tolto Amici da "Non ancora costruito", fra i difetti aperti le fine riga
da uniformare (commit a parte). Solo documenti.

## 2026-10-16 — Condivisione alimenti: pallino, riga Alimenti, Elimina account

Branch `condivisione-alimenti`, passo 7. Le novità hanno due parti
(richieste di amicizia e alimenti in arrivo): il pallino della tab le
somma ("Impostazioni, N novità"), ogni pagina scrive solo la sua parte,
lo scarto delle letture vecchie è per parte, un valore salvato prima vale
0 alimenti. Riga Alimenti di Impostazioni con "N in arrivo" e il pallino.
Elimina account con "I tuoi amici e il tuo nome su Libra". Test delle
novità riscritti, provati rompendo una copia in tre punti; 995 test,
build verde.

## 2026-10-16 — Condivisione alimenti: ricezione provata su iPhone

Branch `condivisione-alimenti`. Passi 5 e 6 provati da Davide
sull'anteprima in Safari (A → B, build `cba066a`): riga e foglio,
confronto, "Usa questi valori" con Annulla, Ok, Aggiungi singolo,
selezione e Aggiungi / Rifiuta multipli con conferma. Verificati da
Cowork sul database: stati, tre copie su B, lo Yogurt aggiornato sullo
stesso id. "0 selezionati" resta così. Solo documenti.

## 2026-10-16 — Condivisione alimenti: selezione multipla nel foglio

Branch `condivisione-alimenti`, passo 6. Nel foglio degli alimenti in
arrivo: "Seleziona" / "Annulla" o tieni premuto (lo stesso gesto del
catalogo), quadratini, "Seleziona tutti" / "Deseleziona tutti", barra
con Rifiuta e Aggiungi, conferma con più di un alimento, una chiamata
sola tutto o niente; ricontrollo dei doppioni prima di Aggiungi. Come
nel mockup, togliere l'ultima spunta non esce dalla selezione (diverso
dal catalogo, scritto nel PUNTO). 990 test, build verde; prova completa
della ricezione su iPhone da fare.

## 2026-10-16 — Condivisione alimenti: riga e foglio degli alimenti in arrivo

Branch `condivisione-alimenti`, passo 5 (senza la selezione multipla, che
è il passo 6). In Impostazioni > Alimenti la riga "N alimenti in arrivo"
(anche con il catalogo vuoto, non offline né in selezione) e il foglio:
Aggiungi / Rifiuta, doppione con "Confronta i valori", "Usa questi
valori" / "Tieni i miei", valori identici con Ok. "Usa questi valori" e
il suo Annulla in `repository/alimenti.ts` (prima Dexie poi il server;
l'Annulla prima il server poi Dexie), con 10 test permanenti, provati
rompendo l'ordine tre volte (un primo tentativo di rottura non era
entrato per le fine riga miste del file: rifatto una rottura alla volta).
Testi nuovi nel PUNTO. Registrata anche la prova su iPhone del passo 4
(invio A → B, secondo invio, foglio offline; verificata da Cowork).
990 test, build verde; da provare su iPhone dopo il passo 6.

## 2026-10-16 — Condivisione alimenti: icona Condividi e foglio "Condividi con"

Branch `condivisione-alimenti`, passo 4. Nella barra di selezione di
Impostazioni > Alimenti l'icona Condividi, prima di Elimina; apre
`SheetCondividiCon`: gli amici da spuntare, "Manda a N amici", un invio
solo tutto o niente con i valori riletti da Dexie, lo stesso id d'invio
nei tentativi, la barra "Mandati 2 alimenti a @…". Testi nuovi per
offline, senza amici e amici non letti. Build, tipi, lint e 978 test
verdi; da provare su iPhone (invio da A a B).

## 2026-10-16 — Condivisione alimenti: chiamate, confronto e testi

Branch `condivisione-alimenti`, passo 3. `src/lib/amici/alimentiCondivisi.ts`
(le tre funzioni del database, la copia che parte, la lettura e il
conteggio degli alimenti in arrivo); `src/lib/catalogo/alimentiInArrivo.ts`
(nuovo / uguale / diverso sui 9 valori in centesimi, righe del confronto,
selezione con un solo alimento per nome e marca);
`testiAlimentiInArrivo.ts`. 35 test nuovi, provati anche rompendo una
copia del confronto (4 falliti, quelli giusti). Decisi scrivendo:
spuntare il secondo di due alimenti uguali sposta la spunta; i testi di
`non_amici` e di "non più in arrivo". Trovato dal controllo dei tipi:
l'elenco delle colonne spezzato con "+" toglieva i tipi alle righe lette.

## 2026-10-16 — Condivisione alimenti: decisioni e migration `alimenti_condivisi`

Branch `condivisione-alimenti`, passi 1 e 2. PUNTO aggiornato con le
decisioni dell'analisi: invio solo dalla funzione `manda_alimenti` (niente
insert diretto), sette stati, "valori identici" su tutti e 9 i valori in
centesimi, ordine delle scritture per "Usa questi valori" (prima Dexie) e
per l'Annulla (prima il server), sottotitolo con i mittenti, due alimenti
in arrivo uguali fra loro, riga anche col catalogo vuoto, pallino a due
termini con "Impostazioni, N novità", testo di Elimina account, passi con
due prove su iPhone a metà strada.

Migration `alimenti_condivisi` (tabella con RLS di sola lettura per il
destinatario, `manda_alimenti`, `rispondi_alimenti_condivisi`,
`riapri_alimento_condiviso`, `annulla_o_rimuovi_amicizia` ridefinita):
blocco di prova annullato 150/150 nel SQL Editor, cascata di Elimina
account compresa; applicata da Cowork, versione 20261016180308; advisors
solo con gli avvisi attesi. Tipo `AlimentoCondiviso` in `tipi.ts`.

Bug trovati nel blocco di prova prima di dartelo, eseguendolo in un
Postgres locale (PGlite): una funzione di prova scritta in SQL leggeva la
tabella prima che esistesse, e tre controlli mettevano scrittura e
lettura nella stessa istruzione. Corretti; nessun difetto nella migration.

## 2026-10-16 — Ritocchi username e doppione: provato su iPhone

Branch `ritocchi-username`. Provato da Davide il 16/10 sull'anteprima
(build `da5d90a`):
- il messaggio del doppione: nome e marca, sotto Marca, con due bordi
  arancio e "Apri";
- Profilo > "Cambia il tuo nome su Libra" e Aggiungi un amico: niente
  proposta "Accedi con la password", titoli a posto;
- la registrazione vera con il campo `nomeUtente` (+trigger3, `test3`),
  verificata da Cowork.

Decisi: «È già il tuo nome.» resta; il mockup `amici.html` resta com'è.
Solo documenti.

## 2026-10-16 — "Nome su Libra" nei fogli: iPhone non propone più l'accesso

Branch `ritocchi-username`. La diagnosi è riuscita (iPhone, 16/10): in
Aggiungi un amico, senza la parola "username" nei testi, la proposta
"Accedi con la password" non compare più. In Cambia username, dove la
parola c'era ancora, compariva. iOS si fa guidare dal testo intorno a un
campo che sta da solo, non da `type` o `autocomplete`.

Regola nuova in PUNTO §3 "Lo username": nei campi da soli, niente
"username" vicino al campo, al suo posto "nome su Libra". I testi:
- foglio di Profilo: titolo "Cambia il tuo nome su Libra" / "Scegli il
  tuo nome su Libra", `aria-label` "Il tuo nome su Libra", esito
  all'apertura "È già il tuo nome." (prima "È già il tuo username.");
- Amici, prima apertura: titolo "Scegli il tuo nome su Libra", niente
  etichetta visibile, `aria-label` "Il tuo nome su Libra";
- Aggiungi un amico: i testi della prova, con il commento definitivo.

`type="search"` ed `enterKeyHint` restano. Restano con "username" la
riga in Profilo, Registrati e i messaggi d'esito dopo un'azione. Test di
SceltaUsername aggiornato all'etichetta nuova.

Registrazione vera con il campo `nomeUtente` provata da Davide
(+trigger3, username `test3`): lo username è arrivato, verificato da
Cowork. Restano da provare su iPhone i due fogli cambiati. Il mockup
`docs/mockups/amici.html` ha ancora i testi vecchi.

## 2026-10-16 — Prova di diagnosi: "username" tolto da Aggiungi un amico

Branch `ritocchi-username`. Con `type="search"` la proposta "Accedi con
la password" compariva ancora in Cambia username e Aggiungi un amico
(prova su iPhone del 16/10). Ipotesi: iOS legge i testi intorno al campo.
Solo in Aggiungi un amico la parola "username" è tolta dai testi:
- la frase sopra il campo ora è "Scrivi il suo nome esatto, quello che ha
  scelto in Libra.";
- l'`aria-label` ora è "Nome dell'amico".

Cambia username resta com'è, come confronto. Non toccati i messaggi di
esito (vuoti quando si tocca il campo, alcuni condivisi).

## 2026-10-16 — Campi username nei fogli: type="search"

Branch `ritocchi-username`. Prova su iPhone del 16/10: il messaggio del
doppione va bene ovunque. In Registrati la proposta "Accedi con la
password" non compare più. In Cambia username e Aggiungi un amico invece
compariva ancora, anche con `autoComplete="nickname"`: lì il campo è da
solo nel suo foglio, con l'etichetta "Username". Ora quei campi, e Scegli
il tuo username, sono `type="search"`: iOS non propone credenziali sui
campi di ricerca. Sui tasti della tastiera "Fine", "Vai" e "Invia" con
`enterKeyHint`; Aggiungi un amico ha `autoComplete="off"`. Togliere il
`<form>` non era una strada: non c'era. Costo: VoiceOver dice "campo di
ricerca". Ancora da provare su iPhone, insieme alla registrazione vera
con il campo `nomeUtente`.

## 2026-10-16 — Messaggio del doppione e campi username su iPhone

Branch `ritocchi-username`. Due ritocchi chiesti da Davide il 16/10.
(1) Il messaggio del doppione ora sta sotto il campo Marca, con nome e
marca tutti e due in arancio, e dice che il confronto è sulla coppia:
sotto il solo Nome sembrava un errore sul nome. Testo in `testoDoppione`
(«Hai già un alimento con questo nome e questa marca: «Pane · Mulino».»
/ «Hai già «Banana», senza marca.»), con test. (2) iPhone proponeva
"Accedi" con la password salvata toccando un campo username:
`autoComplete="off"` non bastava, iOS lo ignora. Ora i quattro campi
username hanno `autoComplete="nickname"` e niente "username" in id e
name (in Registrati `nomeUtente`, letto così anche dalla Server Action).
Email e password di Registrati non cambiano. Prova su iPhone ancora da
fare: solo lì si vede se iOS obbedisce.

## 2026-10-16 — Merge di `alimenti-doppi` su main

Fast-forward, main a `fb8aa21`. tsc, lint, 940 test e build verdi su
main prima del push. Branch cancellato in locale e su GitHub.

## 2026-10-16 — Alimenti doppi: provato su iPhone

Branch `alimenti-doppi`. Provato da Davide il 16/10 sull'anteprima del
branch, account di prova in Safari: prove 1–12 (Nuovo e Modifica in
Aggiungi e nel catalogo, "Apri" nei due posti, spazi doppi, doppio tocco
su Salva). Saltate la 13 (Annulla con un doppione nato nel frattempo) e
la 14 (alimento arrivato da un altro telefono), coperte dai test.
Verificato da Cowork su Supabase: sono nati solo «Pane · Mulino»,
«Banana» (poi rinominata «BANANA») e «Pane di segale», con gli spazi
ridotti; nessun doppione e nessuna copia dal doppio tocco. Alimenti di
prova eliminati da Davide. Solo documenti.

## 2026-10-16 — Mai due alimenti uguali nel catalogo

Branch `alimenti-doppi`. Creando o rinominando un alimento non c'era
nessun controllo su nome + marca (trovato da Davide su iPhone). Ora la
regola sta in `trovaDoppione` (`src/lib/catalogo/doppioniAlimenti.ts`,
la stessa normalizzazione della ricerca, che la importa da lì): nel form
«Hai già «Pane · Mulino»» con "Apri" e Salva spento; al Salva
`salvaAlimento` rilegge e scrive in una transazione, il che chiude anche
il doppio tocco su Salva, che prima poteva creare due righe. Nome e marca
si salvano con gli spazi doppi ridotti. L'Annulla dopo un'eliminazione non
rimette in vita un doppione. Trovato strada facendo: con l'alimento non
ripristinato restano cancellate anche le sue righe dei pasti salvati e il
pasto che tornerebbe vuoto. Aggiunta la `key` mancante sul form in
Impostazioni > Alimenti. 940 test, 4 file nuovi o estesi. Schema
invariato. Prova su iPhone ancora da fare.

## 2026-10-16 — Amici: passo 8 completato, trigger di registrazione attivi

Su main, solo documenti e le due migration. `trigger_registrazione`
applicata da Davide dal SQL Editor (per sbaglio, al posto delle prove) e
registrata da Cowork in `schema_migrations` (20261016112900, created_by
"sql-editor (Davide)"); `registrazione_pulizia_codice` applicata da
Cowork con `apply_migration` (20261016113910) dopo il blocco di prove
58/58 ok. Verificato da Cowork: 3 trigger attivi su `auth.users`,
funzioni security definer non eseguibili da anon e authenticated,
segreto presente, nessun account con `codice_invito`, advisors senza
avvisi nuovi; due registrazioni vere da app-libra (`test` alle 13:31,
che ha fatto scoprire il difetto; `prova_trigger2` alle 13:42, metadati
puliti). Blocco di prove cancellato. In PUNTO: stato finale in §9.1;
in §8 la regola nuova, ogni migration nuova ha in testa "NON eseguire dal
SQL Editor"; in §11 il passo 8 in "Fatto", i due account del trigger da
eliminare con A e B alla fine di `condivisione-alimenti`, e fra i
difetti aperti il messaggio "Username appena preso" che non esiste
ancora (oggi la seconda di due registrazioni simultanee con lo stesso
nome vede "Si è verificato un errore. Riprova tra poco.").

## 2026-10-16 — Amici: il codice di invito tornava nei metadati

Passo 8, su main. `trigger_registrazione` applicata il 16/10 dal SQL
Editor, per sbaglio al posto delle prove; verificata da Cowork (trigger
attivi, funzioni come nel file, segreto uguale a `CODICE_INVITO`,
advisors puliti, registrazione vera passata con username `test`). Quella
registrazione ha mostrato il difetto: `codice_invito` restava nei
metadati, perché ~100 ms dopo l'insert GoTrue riscrive
`raw_user_meta_data` dalla sua copia in memoria. Nuova migration
`supabase/migrations/registrazione_pulizia_codice.sql`, **non
applicata**: trigger BEFORE UPDATE `togli_codice_invito` (con `WHEN`
sulla chiave, mai errori, metadati null o non oggetto lasciati stare) e
pulizia dell'account che ha ancora la chiave. Blocco di prove
`prove_trigger_registrazione.sql` rifatto: prova i due trigger già
attivi, esegue dentro la migration nuova e aggiunge l'UPDATE come
GoTrue, l'UPDATE con metadati null, quello con uno scalare e quello di
`last_sign_in_at`. Non ancora eseguito. PUNTO §9.1 e §11 aggiornati.

## 2026-10-16 — Amici: il file del trigger di registrazione

Passo 8, su main. `supabase/migrations/trigger_registrazione.sql`, **non
applicato**: BEFORE INSERT su `auth.users` (`controlla_registrazione`:
codice di invito contro il segreto `codice_invito` del Vault, segreto
assente → rifiuta tutto; formato dello username; toglie `codice_invito`
dai metadati e ci rimette lo username normalizzato) e AFTER INSERT
(`crea_nome_utente_registrazione`: la riga di `nomi_utente`, nome preso →
la registrazione si annulla). Funzioni security definer, `search_path =
''`, non eseguibili da nessuno. Nella stessa migration `codice_invito`
tolto dai metadati dei 2 account che lo hanno. Letto da Supabase: nessun
altro trigger su `auth.users`; `postgres` non ha UPDATE su
`vault.secrets`, quindi le prove rinominano il segreto con
`vault.update_secret`. Blocco di prove `prove_trigger_registrazione.sql`
nella radice (temporaneo, fuori da git), non ancora eseguito. PUNTO §9.1
e §11 aggiornati.

## 2026-10-16 — Merge di `amici` su main

Main `ae0a75a`, fast-forward; deploy di produzione Ready confermato il
16/10. "Scegli il tuo username" provato in produzione il 16/10 con
l'account vero di Davide (username `@libra`), verificato da Cowork su
Supabase.

## 2026-10-16 — Amici: pallino provato su iPhone, decisioni sugli alimenti in arrivo

Branch `amici`. Pallino provato da Davide il 16/10 sull'anteprima (A in
Safari su iPhone, B in Chrome sul PC, account di prova fisso in
incognito): pallino nel colore principale sulla tab e "1 nuova" / "2
nuove" sulla riga Amici; pallino e numero restano offline; Accetta e
Rifiuta spengono il pallino; "Non accettata" senza pallino; dopo Esci e
rientro con un altro account nessun pallino del precedente; tema scuro e
un altro colore principale. Verificato da Cowork su Supabase. Non
provati a mano, coperti dai test: l'arancio insieme a una richiesta,
VoiceOver. In PUNTO le decisioni del 16/10: gli alimenti in arrivo
stanno nella pagina Alimenti (riga "N alimenti in arrivo" con un foglio,
riga Alimenti di Impostazioni "2 in arrivo"), Amici è solo persone;
doppione = stesso nome e stessa marca, mai due alimenti uguali ("Usa
questi valori" / "Tieni i miei" con il confronto e l'Annulla che riapre
la condivisione, valori identici con Ok; "Aggiungi comunque" tolto);
selezione multipla nel foglio; secondo invio dello stesso alimento che
sostituisce il primo; Condividi senza amici; nessuna scadenza; in §4
cosa resta da progettare nella migration `alimenti_condivisi`. In §9.1
la conferma email spenta per la beta, da riaccendere prima di un'apertura
al pubblico; in §11 il difetto "Alimenti doppi nel catalogo" (da fare
subito dopo il merge) e la voce di Amici in "Fatto". Mockup
`docs/mockups/alimenti-in-arrivo.html` (nuovo, proposta B scelta) e
`docs/mockups/amici.html` (aggiornato da Cowork, senza gli alimenti in
arrivo). Solo documenti.

## 2026-10-16 — Amici: il pallino delle novità

Branch `amici`, passo 7. `src/lib/amici/novita.ts`: le novità come somma
di parti (oggi solo le richieste di amicizia ricevute in attesa, contate
su Supabase con `contaRichiesteRicevute`; gli alimenti in arrivo
arriveranno come secondo termine, sulla tab ma non sulla riga Amici,
decisione del 16/10), condivise in memoria fra tab e riga, salvate in
`localStorage` (`nutritrack:amici:novita:<id>`, JSON delle parti) per
l'offline, aggiornate agli inneschi della discesa e da ogni rilettura
della pagina Amici, con lo scarto delle letture vecchie. Sulla tab
Impostazioni un pallino solo (`pallinoTab`): l'arancio della
sincronizzazione vince, altrimenti il colore principale con "N novità in
Amici" per lo screen reader. Riga Amici: "2 nuove" / "1 nuova" con il
pallino al posto del numero di amici. Esci (anche con i dati tenuti) ed
Elimina account cancellano la chiave. Contrasti: nessun test nuovo, il
pallino ha l'anello della superficie e "accento su superficie" è già
controllato a 4,5:1 (PUNTO §3). Commento di `useUtente.ts` corretto sulla
conferma email spenta. Test permanenti su pallino, somma, chiave, Esci,
Elimina account, testi e tab bar; ognuno fallisce rompendo il punto che
protegge (provato da copie, ripristinate). 918 test verdi in 83 file,
lint, `tsc` e `npm run build` puliti. Non provato nel browser.

## 2026-10-15 — Amici: pagina Amici provata su iPhone

Branch `amici`. Provata da Davide il 15/10 sull'anteprima: account A
(davidemancon02*amici1@gmail.com, `@amici_uno`) in Safari su iPhone,
account B (davidemancon02+amici2@gmail.com, `@amici_due_b`) in Chrome sul
PC. Provati: registrazione con username (A e B); "già in uso" su un nome
preso; Aggiungi un amico con gli esiti non trovato, formato sbagliato, sei
tu, inviata, già chiesta; rifiuto → "Non accettata", troppo presto, Ok,
troppo presto ancora dopo l'Ok; chi ha rifiutato chiede subito; richiesta
incrociata → "Ora siete amici."; già amici; riga Amici con il conteggio;
cambio di username in Profilo visto dall'altro; Rimuovi con la conferma
da tutti e due i lati; Annulla; Accetta con doppio tocco; offline; tema
scuro. Verificato da Cowork su Supabase: 5 righe di `amicizie` coerenti
con le prove (rifiutata e superata, accettata e rimossa, annullata,
accettata e rimossa, accettata e viva: A e B sono amici), `nomi_utente`
con `amici_uno` e `amici_due_b`. **Non provati a mano**: "Questa richiesta
non c'è più." (il comportamento del database è provato nel blocco SQL,
D11) e "Scegli il tuo username", mai comparsa perché la conferma email è
spenta: si prova dopo il merge con l'account vero di Davide, che non ha
username. Corretto PUNTO: la conferma email è **spenta**, non attiva
(verificato da Cowork: account confermati nello stesso secondo della
registrazione), quindi lo username lo salva la Server Action; in §9.1 la
conseguenza su "Password dimenticata" per un indirizzo che non riceve
email; in §11 i due account A e B, da eliminare alla fine di
`condivisione-alimenti`. Solo documenti.

## 2026-10-15 — Amici: la pagina Amici

Branch `amici`, passo 6. Pagina `/impostazioni/amici` come nelle schermate
3 e 4 del mockup: offline "Serve la connessione" (che si toglie da solo),
"Scegli il tuo username" con lo username dei metadati già scritto
(`SceltaUsername`), "Aggiungi un amico" (`SheetAggiungiAmico`, esiti di
`chiedi_amicizia` sotto il campo), richieste ricevute (Rifiuta / Accetta),
inviate (Annulla, "Non accettata" con Ok), amici con Rimuovi e conferma
arancio. Si rilegge all'apertura, dopo ogni azione, al ritorno in primo
piano e al ritorno della rete (`useAmicizie`). Riga Amici in Impostazioni,
gruppo nuovo sotto Alimentazione, con il numero di amici. Dati in
`src/lib/amici/amicizie.ts` (letture, chiamate, `dividiAmicizie`, tipi
degli esiti tolti da `tipi.ts`), testi in `testiAmici.ts`.
`/impostazioni/amici` in `PAGINE_APP`, senza cache nuova. `ServeConnessione`
con un testo facoltativo; nome e username dei metadati letti da una
funzione sola in `useUtente.ts`; `useMioUsername` rilegge al ritorno della
rete. Test permanenti: divisione delle righe (compresi rifiuto mio e
username mancante), testi, suggerimento che non scrive sopra quello
dell'utente; ognuno fallisce rompendo il punto che protegge (provato da
copie, ripristinate). 901 test verdi in 82 file, lint, `tsc` e `npm run
build` puliti. Non provato nel browser: le prove con due account le fa
Davide su iPhone.

## 2026-10-15 — Amici: migration `amicizie` applicata, tipo `Amicizia`

Branch `amici`. `supabase/migrations/amicizie.sql`: tabella solo online
con una riga viva per coppia (indice unico sulla coppia in qualunque
ordine, indici su `user_id` e `amico_id`), RLS di sola lettura (chi
chiede, chi riceve, rifiuto nascosto a chi ha rifiutato e, dopo l'Ok, a
chi è stato rifiutato), lettura di `nomi_utente` allargata con la stessa
regola (`alter policy`), quattro funzioni `security definer` con esiti
di solo testo: `chiedi_amicizia` (anche `senza_username`, regola dei 7×24
ore, richieste incrociate nello stesso istante gestite intercettando
`unique_violation`), `rispondi_amicizia`, `annulla_o_rimuovi_amicizia`
(non su una riga rifiutata), `chiudi_rifiuto`. Prove in un blocco
annullato lanciate da Davide dal SQL Editor: 90/90 ok. Applicata da
Cowork con `apply_migration`, versione 20261015184017; verifiche: RLS
attiva, 0 righe, utenti e `nomi_utente` invariati, permessi e policy come
nel file, `get_advisors` con i soli 4 WARN attesi nuovi
(`authenticated_security_definer`), performance solo con INFO
`unused_index` (tabella vuota). Tipo `Amicizia` e tipi degli esiti in
`tipi.ts`; PUNTO §3 e §4 con le decisioni del passo 5 e lo stato della
migration. Script di prova temporaneo cancellato, mai in git.

## 2026-10-15 — Amici: username in Profilo

Branch `amici`. Gruppo "Account" in Profilo con la riga "Username" (letta
da Supabase, `useMioUsername`) e il foglio `SheetUsername` con il suo
Salva online (`imposta_username`), come nella schermata 5 del mockup;
l'email resta nell'intestazione. Regola del nome attuale (non "già in
uso", Salva spento) in `foglioUsername.ts`, con test permanente.
`leggiMioUsername` restituisce un oggetto con l'esito, non la stringa
"errore", che è anche uno username valido. Nel test della pagina Profilo
l'hook dello username è finto (il test riguarda IndexedDB). 881 test verdi
in 79 file, lint, `tsc` e `npm run build` puliti. Non provato nel
browser.

## 2026-10-15 — Amici: username nella pagina Registrati

Branch `amici`. Campo "Username" sotto Nome, come nel mockup approvato
`docs/mockups/amici.html` (aggiunto in questo commit): "@" davanti,
minuscolo mentre si scrive, esito "Disponibile / già in uso" chiesto a
`username_disponibile` 400 ms dopo l'ultimo tasto
(`useDisponibilitaUsername`), formato sbagliato detto subito. La Server
Action ricontrolla formato e disponibilità, manda `username` e
`codice_invito` nei metadati per il trigger futuro e, con la sessione già
aperta, salva lo username con `imposta_username`; senza sessione, o con un
esito diverso da `ok`, lo chiederà Amici. Regole in `validazione.ts`
(`normalizzaUsername`, `usernameValido`) e chiamate in
`src/lib/amici/nomiUtente.ts`. Test permanenti: le regole (gli stessi casi
delle prove sulla migration) e le risposte fuori ordine dell'esito (il
test fallisce togliendo il controllo, provato da una copia e
ripristinato). 875 test verdi in 78 file, lint, `tsc` e `npm run build`
puliti. Non provato nel browser: la registrazione vera crea un account,
serve l'ok di Davide. Con la conferma email attiva (il caso del progetto)
lo username resta nei metadati: Amici lo proporrà già scritto in "Scegli
il tuo username" (passo 6, annotato in PUNTO §3).

## 2026-10-15 — Amici: migration `nomi_utente` applicata, tipo `NomeUtente`

Branch `amici`. Applicata da Cowork con `apply_migration` (questa volta il
connettore l'ha accettata), versione 20261015175818. Verifiche: RLS
attiva; `username_disponibile` eseguibile da `anon` e `authenticated`,
`imposta_username` solo da `authenticated`; `anon` non legge la tabella,
`authenticated` legge ma non scrive direttamente; 0 righe; colonne
confrontate con `information_schema.columns`; `get_advisors` solo con i
WARN attesi (`anon_security_definer` su `username_disponibile`,
`authenticated_security_definer` sulle due funzioni nuove e su
`elimina_mio_account`), performance invariata. Tipo `NomeUtente` in
`tipi.ts`, fuori da `NomeTabella`; PUNTO §4 con lo stato delle migration.

## 2026-10-15 — Amici: file della migration `nomi_utente`

Branch `amici`. `supabase/migrations/nomi_utente.sql`: tabella solo
online con lo username (formato `^[a-z][a-z0-9_]{2,19}$`, indice unico,
`user_id` unico e `ON DELETE CASCADE`), RLS con lettura della sola propria
riga e nessuna scrittura diretta, `username_disponibile` (anche per
`anon`) e `imposta_username` (esiti `ok` / `non_valido` / `occupato`).
Senza il trigger su `auth.users`, che arriva dopo il merge. Migration
non ancora applicata. Prove in un blocco annullato: il connettore ha
rifiutato l'esecuzione (`declined`), le ha lanciate Davide dal SQL Editor
in un blocco unico (versione di Cowork, con la migration dentro il blocco
`do`, annullata dal `raise` finale): 20/20 ok (T01–T20: RLS, permessi,
anon, normalizzazione, occupato, formati non validi, limiti di 3 e 20
caratteri, cambio nome, lettura solo della propria riga, niente scritture
dirette, errore senza utente, check, `updated_at`, cascata). Verificato
da Cowork dopo: tabella assente, funzioni 0, utenti finti 0, utenti 6.
Script di prova temporanei, cancellati, mai in git.

## 2026-10-15 — Amici: decisioni nel documento

Branch `amici`. Analisi e decisioni di Davide del 15/10 in
`PUNTO_DI_PARTENZA.md`: sezione 3 "Amici" (copia dell'alimento da
accettare, username scelto alla registrazione e cambiabile da Profilo,
ricerca solo per nome esatto, rifiuto con "Non accettata" e 7 giorni
prima di poter richiedere, chi manda non vede l'esito, pallino nel colore
principale con l'arancio della sync che vince), §4 le tre tabelle solo
online (`nomi_utente`, `amicizie`, `alimenti_condivisi`) e le funzioni,
§9.1 il codice di invito controllato anche dal trigger su `auth.users`
(codice nel Vault di Supabase, `CODICE_INVITO` su Vercel solo per il
messaggio, procedura per cambiarlo; trigger applicato dopo il merge e il
deploy Ready, perché le anteprime usano il Supabase di produzione), eccezioni in
§9.5 e §9.6 con gli avvisi degli advisors accettati, Elimina account ed
Esci. Solo documenti, schema dati invariato.

## 2026-10-15 — Catalogo alimenti unito a main

Unito a main il 15/10 con fast-forward da `c4d7190` a `38dfcff`, senza
commit di merge: `f4aa9a6` (mockup e decisioni), `093781c` (contaUsi e
ordinaCatalogo), `f348e03` (eliminazione e ripristino di più alimenti in
una transazione), `9350cb3` (testi del form dal chiamante), `a16c9b2` (la
pagina), `e987c64` (selezione multipla), `7a3de96` (riga in
Impostazioni), `38dfcff` (provato, documenti). Branch cancellato in
locale e su GitHub. 862 test verdi in 76 file, lint, `tsc` e `npm run
build` puliti su main prima del push. Schema dati invariato. Deploy di
produzione di `38dfcff` riuscito, confermato da Davide il 15/10.

## 2026-10-15 — Catalogo alimenti: provato su iPhone

Branch `catalogo-alimenti`. Commit dei documenti (questa voce compresa):
esito delle prove in PUNTO §11, "Fatto"; tolto "Impostazioni > Alimenti"
da "Non ancora costruito". Provato da Davide il 15/10 in Safari
sull'anteprima con l'account di prova: ingresso da Impostazioni con il
conteggio uguale alla pagina, ricerca, i quattro ordini, scorrimento che
non entra in selezione, modifica con la frase nuova e ritorno allo stesso
scorrimento, "+" → "Creato: …", selezione con la barra sopra la tab bar,
sheet con i conteggi, Elimina + Annulla anche con un alimento in un pasto
salvato, apertura offline; in Aggiungi matita con la frase nuova, crea,
elimina e Annulla. Verificato da Cowork su Supabase: cancellazione e
ripristino arrivati, con pasto salvato e righe ripristinati nello stesso
secondo. Nessun difetto trovato nelle prove.

## 2026-10-15 — Catalogo alimenti: riga in Impostazioni

Branch `catalogo-alimenti`. Commit `7a3de96`: riga "Alimenti" nel gruppo
Alimentazione, prima di Preferiti, con "46 alimenti" / "1 alimento" /
"Nessuno" (`testoRigaAlimenti`), contati con `alimentiModificabili` come
l'elenco della pagina; icona a forma di mela. Test permanente sul
conteggio. 862 test verdi, `tsc`, `eslint` e `npm run build` puliti.
Branch pushato su GitHub per l'anteprima Vercel e le prove su iPhone.

## 2026-10-15 — Catalogo alimenti: selezione multipla

Branch `catalogo-alimenti`. Commit `e987c64`: tieni premuto (stesso gesto
di Oggi, tutti e due i rami e il tasto destro) → selezione, tocco che
spunta o toglie, uscita togliendo l'ultima spunta; barra di selezione con
la forma della pillola della tab bar e fondo pieno, senza condividi;
`SheetConferma` con i conteggi di pasti salvati e preferiti
(`confermaEliminazione.ts`), eliminazione tutto o niente, "Eliminati: N
alimenti" con Annulla. `useTieniPremuto` reso generico (`tipi`), Oggi
invariato. Scelte approvate da Davide: Elimina arancio e non rosso,
suggerimento in grigio, ricerca usabile in selezione, tocco entro 400 ms
dal gesto scartato come in Oggi. 8 test permanenti nuovi, provati al
contrario in tre modi; pagina verificata con un test temporaneo, poi
cancellato. 860 test verdi, `tsc`, `eslint` e `npm run build` puliti. Non
ancora provato su iPhone.

## 2026-10-15 — Catalogo alimenti: la pagina

Branch `catalogo-alimenti`. Commit `a16c9b2`: `/impostazioni/alimenti` con
elenco degli alimenti modificabili, ricerca, ordinamento (`<select>`
nativo, scelta approvata da Davide al posto del menu del mockup), "+"
sopra la tab bar alla stessa altezza di "+ Aggiungi" in Oggi, form a
pagina intera come stato della pagina ("‹" lo chiude), barra "Creato:" ed
"Eliminato:" con Annulla, riquadro a catalogo vuoto; in `PAGINE_APP`.
Portate in un posto solo la regola `eModificabile` (prima scritta due
volte in Aggiungi) e le frasi dopo l'Annulla (`messaggioDopoRipristino`),
testi invariati. Verificata con un test temporaneo della pagina, poi
cancellato. 852 test verdi, `tsc`, `eslint` e `npm run build` puliti. La
pagina non ha ancora la riga in Impostazioni (commit 7) e non è stata
guardata su iPhone.

## 2026-10-15 — Catalogo alimenti: testi del form dal chiamante

Branch `catalogo-alimenti`. Commit `9350cb3`: `CreaAlimentoForm` riceve
`etichettaIndietro` ed `etichettaCrea` (obbligatorie, senza valore
predefinito) al posto di "Torna alla ricerca" e "Crea e scegli la
quantità" scritti fissi; Aggiungi passa gli stessi testi di prima. In
modifica, sotto i valori, la frase "Le modifiche valgono da ora e nei
pasti salvati. Il diario già registrato non cambia." 852 test verdi,
`tsc`, `eslint` e `npm run build` puliti. Non ancora guardato nel
browser: lo verifica Davide su iPhone nelle prove finali.

## 2026-10-15 — Catalogo alimenti: eliminazione e ripristino di più alimenti

Branch `catalogo-alimenti`. Commit `f348e03`: `eliminaAlimenti` e
`ripristinaAlimenti` in `src/lib/repository/composizioni.ts`, cascata sui
pasti salvati calcolata sull'insieme degli alimenti, tutto o niente in
una transazione Dexie, Annulla che rimette esattamente ciò che è stato
tolto. Le funzioni per un alimento solo ora le richiamano, e l'Elimina di
`CreaAlimentoForm` passa da `eliminaAlimenti`: anche in Aggiungi
l'eliminazione singola è tutto o niente; tolto il commento sulla
transazione "scartata", superato dal 9/10.
**Bug trovato dai test e corretto prima del commit**: con
`() => ripristinaNellaTransazione(...)` (funzione non async) Dexie perdeva
la transazione dopo la prima scrittura (PrematureCommitError); corretto
con `async () => await …`, regola scritta in PUNTO §9.2. Verificato con un
test temporaneo, poi cancellato, che le transazioni di `modifichePasti.ts`
non hanno lo stesso problema. 9 test nuovi in
`eliminazioneAlimenti.test.ts`, provati al contrario in tre modi (cascata
un alimento alla volta, niente transazione, funzione non async): ognuno fa
fallire i test attesi. 852 test verdi, `tsc` ed `eslint` puliti.

## 2026-10-15 — Catalogo alimenti: contaUsi e ordinaCatalogo

Branch `catalogo-alimenti`. Commit `093781c`: in
`src/lib/catalogo/ordinamentoCatalogo.ts` le due funzioni pure per
l'ordinamento della pagina Alimenti (usi dalle voci di diario vive;
Più usati / A → Z / Z → A / Meno usati, a parità A → Z, poi marca, poi
id). 10 test permanenti, provati al contrario: contando anche le voci
cancellate fallisce "non conta le voci cancellate"; togliendo la parità
A → Z da "Meno usati" fallisce il test di "Meno usati". Nessuna pagina
le usa ancora.

## 2026-10-15 — Catalogo alimenti: mockup e decisioni

Branch `catalogo-alimenti`. Commit `f4aa9a6`: in git il mockup approvato
il 12/10 (`docs/mockups/catalogo-alimenti.html`) e in PUNTO §3 la
sezione "Alimenti" con le decisioni dell'analisi del 15/10 (solo
alimenti propri modificabili, "Più usati" dalle voci di diario, form
come stato della pagina e non rotta con id, selezione multipla senza
condividi, eliminazione multipla tutto o niente con Annulla). Solo
documenti, nessun codice. Trovato e lasciato al commit 3: il commento in
`CreaAlimentoForm` sulla transazione "scartata" è superato dal 9/10.

## 2026-10-15 — Preferiti nel gruppo Alimentazione

Su main, senza branch (deciso da Davide). In Impostazioni la riga
Preferiti, con il suo conteggio, passa dal gruppo App al gruppo
Alimentazione, dopo Pasti e orari: Obiettivi, Pasti e orari, Preferiti,
Peso. App resta con Aspetto e Sincronizzazione. Il test di Impostazioni
non controlla l'ordine delle righe, invariato. PUNTO §3 aggiornato.

## 2026-10-11 — Esci svuota i dati locali unito a main

Unito a main l'11/10 con fast-forward da `3c8b425` a `245441d`, senza
commit di merge: `9eb9cd1` (voce di merge di elimina-account,
decisioni), `2043ceb` (salita solo per l'utente della sessione, nessuna
voce senza user_id), `aebeece` (attendiDiscesaInCorso), `609ae31`
(segno di uscita e ripresa all'avvio), `d7ace8e` (Esci svuota i dati
locali), `245441d` (provato, documenti). Branch cancellato in locale e
su GitHub. Deploy di produzione riuscito (confermato da Davide l'11/10).
833 test verdi in 72 file, lint, `tsc` e `npm run build` puliti su main
prima del push. Nessuna migration e nessuna version Dexie nuova. Voce
scritta con il commit successivo (Preferiti in Alimentazione), per non
fare un commit su main solo per il registro.

## 2026-10-11 — Esci svuota i dati locali provato

Branch `esci-svuota`. Provato l'11/10 sull'anteprima con l'account di
prova fisso. PC (Chrome): Esci con la coda vuota senza domande e
IndexedDB senza righe dell'utente, rientro con lo storico completo; con
`*/rest/v1*` bloccato, conferma con Resta / Esci e perdila, Resta
lascia tutto, Esci e perdila svuota; sbloccato e rientrato, storico
completo e voce persa assente. iPhone (Safari): coda vuota e rientro con
lo storico completo; offline bloccato, niente toccato; Esci appena
aperta l'app con "Uscita…", rientro con lo storico completo. Giro
generale per la salita verificato da Cowork su Supabase (voci_diario 3
con 1 eliminata, preferiti 2 con 1 tolto, misurazioni 1, pasti 1, con
`updated_at` del server). In PUNTO §9.6 e §11 ("Fatto", tolto da "Non
ancora costruito"). Corretti i commenti che dicevano ancora "i dati
locali non si cancellano all'uscita" (`ripristino.ts`,
`codaDellUtente.ts`, `discesa.ts`, PUNTO §9.2). Non provabili a mano,
coperti dai test: sessione scaduta vera e app chiusa a metà uscita.
Documenti e commenti.

## 2026-10-11 — Esci svuota i dati locali

Branch `esci-svuota`, da provare. Nuovo `src/lib/account/esci.ts`:
`preparaUscita` (getUser prima di tutto, offline non si esce; con la
sessione valida prova a inviare la coda, poi decide) e `eseguiUscita`
(signOut, controllo della sessione, e solo se si svuota: segno, attesa
delle discese, pulizia con le firme). Coda vuota → svuota senza
chiedere; coda non vuota con sessione valida → "Resta / Esci e
perdile" (perdila con una sola); con sessione scaduta → non svuota
niente, "Resta / Esci" con la frase. "Uscita…" con il pulsante spento
per tutta l'uscita. `EsciAccount` riscritto, solo stati e testi. Il
segno di uscita si scrive solo quando si svuota: 7 test permanenti in
`esci.test.ts`, verificati rompendo la regola. PUNTO §3 e la riga di
"Esci e rientra" aggiornati. 833 test verdi in 72 file, `tsc`, lint e
`npm run build` puliti. Aperto: commenti che dicono ancora "i dati
locali non si cancellano all'uscita" (ripristino.ts, codaDellUtente.ts,
discesa.ts, PUNTO §9.2), da correggere con il commit di documenti.

## 2026-10-11 — Segno di uscita e ripresa all'avvio

Branch `esci-svuota`. Nuovo segno `nutritrack:uscita` (`{ idUtente,
firme }`, `src/lib/account/uscitaInCorso.ts`), che Esci scriverà dopo
signOut e toglierà a pulizia riuscita. All'avvio `RipresaUscita` (nel
layout principale): rientrato lo stesso utente → segno tolto, dati
intatti; nessuna sessione o un altro utente → pulizia con
`sostituisciDatiUtente` e le firme del segno (una modifica non
confermata non si perde nemmeno qui); pulizia fallita o utente non
leggibile → segno lasciato. `idUtenteDellaSessione` (con il ripiego sul
cookie offline) spostata in `src/lib/supabase/utenteDellaSessione.ts`,
usata dalla salita e dalla ripresa. 8 test permanenti, verificati
rompendo il codice (controllo "stesso utente", firme). 826 test verdi in
71 file, `tsc`, lint e `npm run build` puliti.

## 2026-10-11 — attendiDiscesaInCorso

Branch `esci-svuota`. `scaricaTabella` tiene un elenco delle discese in
corso (anche quelle del seed dei pasti) e `attendiDiscesaInCorso()` si
risolve quando è vuoto, comprese le discese partite durante l'attesa;
non rifiuta mai. Servirà a Esci (commit successivo): una discesa partita
prima dell'uscita poteva finire dopo la pulizia e riscrivere righe e
cursore, e al rientro lo storico più vecchio non sarebbe più tornato.
Nessuno la chiama ancora. 4 test permanenti in `discesa.test.ts`,
verificati rompendo il codice. 818 test verdi in 70 file, `tsc` e lint
puliti.

## 2026-10-11 — La salita invia solo le voci dell'utente della sessione

Branch `esci-svuota`. Corretto il bug trovato nell'analisi: `unGiro`
mandava tutta l'outbox, anche le modifiche lasciate da un altro utente
uscito dal dispositivo; il server le rifiutava (403), contavano come
tentativi, bloccavano la coda di chi era entrato e finivano accantonate.
Ora partono solo le voci con `dati.user_id` dell'utente della sessione
(`getSession`, o il cookie offline col token scaduto, come
`useUtenteId`); senza utente non parte niente. Verificati tutti i punti
che scrivono in outbox: ogni voce porta `user_id`. Nuovo
`controllaUtenteDellaRiga` in `accodaMutazione` e nel repository prima
di scrivere la riga, così un errore futuro è un'eccezione e non una
voce ferma in silenzio. 8 test permanenti nuovi (3 in
`sincronizza.test.ts`, 5 in `outbox.test.ts`), verificati rompendo il
codice. 814 test verdi in 70 file, `tsc` e lint puliti.

## 2026-10-11 — Esci svuota i dati locali: decisioni

Branch `esci-svuota`. Decise le regole per svuotare i dati dell'utente
da questo dispositivo all'uscita (PUNTO §9.6): controllo della rete
prima di tutto; coda vuota → si svuota senza chiedere; coda non vuota
con sessione valida → conferma "perdi N" (Resta / Esci e perdile, in
arancio); coda non vuota con sessione non valida → non si svuota, con
una frase. Ordine signOut → attesa delle discese in corso → pulizia, e
segno `nutritrack:uscita` ripreso all'avvio. Trovato un bug aperto: la
salita invia l'outbox di tutti gli utenti del dispositivo, non solo di
quello della sessione (sarà il primo commit di codice, da solo). Solo
documenti.

## 2026-10-11 — Elimina account unito a main

Unito a main l'11/10 con fast-forward da `acec5ff` a `3c8b425`, senza
commit di merge: `90ffb68` (voce di merge di vincoli-utente, decisioni),
`1415d5c` (mockup, posizione e colore), `6bef9c6` (migration
`elimina_mio_account`), `e96ec1b` (cancellaDatiUtente e segno,
migration applicata, regola §8 e CLAUDE.md A.5), `efdef52` (pulsante),
`3c8b425` (provato, documenti). Branch cancellato in locale e su
GitHub. Deploy di produzione riuscito. 806 test verdi in 69 file, lint,
`tsc` e `npm run build` puliti su main dopo il merge. Solo documenti:
la migration era già in produzione prima del merge (20261011155326).
Voce scritta con il primo commit del branch successivo (`esci-svuota`),
per non fare un commit su main solo per il registro.

## 2026-10-11 — Elimina account provato

Branch `elimina-account`. Provato su iPhone l'11/10 sull'anteprima: riga
rossa nei due temi, sottopagina e "‹ Impostazioni", tastiera in
maiuscolo, parola sbagliata (pulsante spento) e in minuscolo
(accettata), offline, resto dell'app intatto. Prova vera sull'account
usa e getta davidemancon02+elimina@gmail.com, eliminato dal pulsante,
arrivato al login con "Account eliminato". Verificato da Cowork: da 20
righe a 0 nelle 11 tabelle, 0 identità, sessioni e refresh token,
utenti 7 → 6, 384 righe altrui invariate, nessun alimento senza utente;
account di prova fisso intatto, sincronizzazione a posto. Aperto:
`user_not_found` resta da verificare, il percorso della risposta persa
non è entrato in gioco. In PUNTO §3, §9.6 e §11 (voce in "Fatto", tolto
da "Non ancora costruito"). Solo documenti.

## 2026-10-11 — Pulsante Elimina il mio account

Branch `elimina-account`, da provare su iPhone. In fondo a Impostazioni,
sotto Esci, la riga rossa "Elimina il mio account" porta alla sottopagina
`/impostazioni/elimina-account`: cosa viene cancellato, la parola da
scrivere (ELIMINA, maiuscole e minuscole indifferenti), un solo pulsante
rosso, la riga di stato. Il flusso (`src/lib/account/eliminaAccount.ts`)
controlla che il server riconosca l'utente, scrive il segno, chiama
`elimina_mio_account` e solo dopo l'ok pulisce il dispositivo (Dexie,
pagine salvate, ora dell'ultimo contatto, segno del reset, stato dei
giri) ed esce; esiti rete, risposta persa, rifiuto e sessione non
riconosciuta. Login con "Account eliminato". Ripresa del segno
all'avvio nel layout principale. Token `--pericolo` e
`--pericolo-pieno` nei due temi, con i contrasti in
`contrasti.test.ts`. Pagina in `PAGINE_APP` del service worker.
`useOnline` spostato in `src/lib/useOnline.ts`. 10 test permanenti
nuovi; verificato che falliscono rompendo il codice (rifiuto trattato
come risposta persa). 806 test verdi in 69 file, `tsc`, lint e
`npm run build` puliti.

## 2026-10-11 — Pulizia del dispositivo e segno di eliminazione

Branch `elimina-account`. La migration `elimina_mio_account` è in
produzione dall'11/10, versione 20261011155326: il connettore rifiutava
`apply_migration` senza chiedere conferma, l'ha applicata Davide dal SQL
Editor con il testo del file e la riga di registrazione in
`supabase_migrations.schema_migrations`. Verifiche di Cowork: permessi
(anon no, authenticated sì), prova in un blocco annullato sull'account
di prova (cancellato a cascata, idempotente, righe altrui invariate,
tutto annullato), `get_advisors` con il solo WARN atteso. Regola nuova
in PUNTO §8 per le migration che il connettore rifiuta, con un rimando
in CLAUDE.md, regola A.5.

Codice, non ancora collegato all'app (lo usa il commit del pulsante):
`cancellaDatiUtente` in `ripristino.ts`, che toglie dal dispositivo
righe, coda (accantonate comprese) e cursori di un utente senza toccare
altri utenti e catalogo, con il cuore in comune con
`sostituisciDatiUtente`; `src/lib/account/eliminazioneInCorso.ts`, il
segno in `localStorage` a due fasi ("richiesta", "confermata") e la
ripresa all'avvio. Corretto il disegno di PUNTO §9.6: il segno
"confermata" lo toglie il prossimo avvio, dopo una seconda pulizia,
altrimenti una discesa in ritardo poteva riscrivere righe dopo la
pulizia. 14 test permanenti nuovi; verificato che falliscono rompendo
il codice (accantonate saltate, pulizia nel dubbio). 796 test verdi in
68 file, `tsc` e lint puliti.

## 2026-10-11 — Migration elimina_mio_account (non applicata)

Branch `elimina-account`. Nuovo file
`supabase/migrations/elimina_mio_account.sql`, non ancora applicato: la
funzione `public.elimina_mio_account()`, `security definer` con
`search_path = ''`, senza parametri, che cancella da `auth.users` la riga
di `auth.uid()` (errore se null, idempotente se l'utente non c'è più);
il resto lo fanno le foreign key in CASCADE. Revoke da `public` e `anon`,
grant ad `authenticated`: letto in `pg_default_acl` che, a seconda di chi
crea la funzione, `anon` la riceverebbe da PUBLIC o con un EXECUTE
esplicito, e la revoke copre i due casi. Nel commento il WARN atteso di
`get_advisors`, già accettato, e la nota sui file di Storage per la foto
profilo.

## 2026-10-11 — Mockup di Elimina account

Branch `elimina-account`. Nuovo `docs/mockups/elimina-account.html`, nei
due temi: l'elenco Impostazioni in fondo (Esci e, sotto, il gruppo
"Elimina il mio account"), la sottopagina con la parola da scrivere e gli
stati del pulsante, il login con "Account eliminato". Prima versione con
due proposte (conferma nel gruppo in fondo a Profilo, oppure sottopagina)
e due colori; decise l'11/10: riga in fondo a Impostazioni sotto Esci,
sottopagina `/impostazioni/elimina-account`, rosso nuovo `--pericolo`
solo per le azioni che non si possono annullare, "ELIMINA" accettato
anche in minuscolo o con l'iniziale maiuscola. In PUNTO §3 (Impostazioni,
tolta la riga in Profilo), §7 (il rosso, valori e contrasti) e §9.6. Solo
documenti.

## 2026-10-11 — Elimina account: decisioni

Branch `elimina-account`. Dall'analisi approvata, in PUNTO §9.6 una parte
nuova "Elimina il mio account": funzione Postgres `security definer`
`elimina_mio_account()` senza parametri e idempotente (scartato il route
handler con la chiave di servizio), WARN di `get_advisors` accettato con
il motivo, file in Storage da cancellare quando arriverà la foto profilo,
pulizia del dispositivo solo dopo l'ok del server, segno "eliminazione in
corso" in `localStorage`, offline bloccato, altri dispositivi, prova vera
su un account usa e getta. Rimandi in §3 Profilo e in §11; la
cancellazione dei dati locali all'uscita va nel branch successivo. Solo
documenti.

## 2026-10-11 — Vincoli verso auth.users uniti a main

Unito a main l'11/10 con fast-forward da `c988901` a `acec5ff`, senza
commit di merge: `d1b29c6` (migration `vincoli_cancellazione_utente`,
più la voce di merge di `nome-libra`), `acec5ff` (vincoli applicati,
versione 20261011133801, e provati; PUNTO aggiornato). Branch cancellato
in locale e su GitHub. Deploy di produzione riuscito. 782 test verdi in
67 file, lint e `tsc` puliti su main dopo il merge. Solo documenti: la
migration era già in produzione prima del merge. Voce scritta con il
primo commit del branch successivo (`elimina-account`), per non fare un
commit su main solo per il registro.

## 2026-10-11 — Vincoli verso auth.users applicati e provati

Branch `vincoli-utente`. Migration `vincoli_cancellazione_utente`
applicata da Cowork l'11/10, versione 20261011133801: i quattro vincoli
risultano `ON DELETE CASCADE` in `pg_constraint` (ricontrollato anche da
Claude in sola lettura), le altre FK invariate, advisors security e
performance identici a prima. Prova sull'account di prova in un blocco
DO che va in errore apposta, così tutto si annulla: prima della
migration la cancellazione dell'utente falliva su
`obiettivi_target_user_id_fkey`, dopo riesce e lascia 0 righe in tutte
le 11 tabelle (erano 122); 311 righe di altri utenti invariate; account
intatto dopo l'annullamento. In PUNTO: difetto aperto spostato in
"Fatto", regola `ON DELETE CASCADE` tra le colonne di ogni tabella
(sezione 4), nota sull'account di prova aggiornata. Solo documenti.

## 2026-10-11 — Migration per i vincoli verso auth.users (non applicata)

Branch `vincoli-utente`, prima di "Elimina account". Nuovo file
`supabase/migrations/vincoli_cancellazione_utente.sql`, non ancora
applicato: porta a `ON DELETE CASCADE` quattro foreign key, con lo
stesso nome (drop + add nello stesso `ALTER TABLE`):
`alimenti_user_id_fkey` (era SET NULL: cancellando un utente i suoi
alimenti restavano con `user_id` null e la policy `alimenti_select` li
mostrava a tutti come catalogo comune), `giorni_user_id_fkey`,
`obiettivi_target_user_id_fkey` e `obiettivi_target_obiettivo_id_fkey`
(erano NO ACTION: la cancellazione dell'utente falliva). Nomi letti da
`pg_constraint` in produzione: le migration che li hanno creati non sono
nel repo. Il codice non ne dipende: l'app non cancella mai fisicamente
(solo `upsert` con `deleted_at`), Dexie e `tipi.ts` invariati. Controllato
in sola lettura: nessuna riga punta ad alimenti o obiettivi di un altro
utente, nessun alimento con `user_id` null.

## 2026-10-11 — Nome Libra unito a main

Unito a main l'11/10 con fast-forward da `4567cf7` a `c988901`, senza
commit di merge: `ef99241` (nome "Libra" visibile, più la voce di merge
di `indirizzo`), `a1bb3ee` (icona della bilancia, PNG, favicon, mockup),
`e2e6e9f` (favicon.ico con PNG RGBA: il deploy di `a1bb3ee` falliva),
`c988901` (documenti). Branch cancellato in locale e su GitHub. Deploy
di produzione riuscito. 782 test verdi in 67 file, lint, `tsc` e
`npm run build` puliti su main dopo il merge. Provati su iPhone l'11/10:
titolo della scheda "Libra", "Libra" proposto da "Aggiungi a Home",
"Apri Libra…" nella pagina offline con il tema giusto, la bilancia nella
scheda e in "Aggiungi a Home"; app vera reinstallata da app-libra con
l'icona nuova, dati riscaricati, Build `c988901` (segnato in PUNTO §11).
Voce scritta con il primo commit del branch successivo
(`vincoli-utente`), per non fare un commit su main solo per il registro.

## 2026-10-11 — Libra nei documenti

Branch `nome-libra`, passo 3 della rinomina. Provati su iPhone l'11/10
sull'anteprima: la bilancia nella scheda e in "Aggiungi a Home", la
pagina offline; deploy dell'anteprima riuscito dopo la correzione del
favicon. In PUNTO: sezione 7 nuova "Nome e icona" (nome, icona e file,
come vanno fatti i PNG, reinstallazione solo dopo aver controllato la
sincronizzazione, regola fissa su cosa resta "nutritrack" per sempre,
email di Supabase senza nome); in §8 la build prima dei commit che
toccano `public/` o `src/app/`; in 9.2 i nomi delle cache aggiornati
(erano fermi a `-statici-v2`); voce in "Fatto"; passo 4 fatto; titolo
del documento. README con il titolo "Libra". I mockup in `docs/`
restano come sono. Solo documenti.

## 2026-10-11 — favicon.ico con PNG RGBA, per il deploy fallito

Branch `nome-libra`. Il deploy di `a1bb3ee` falliva: Turbopack non
leggeva `src/app/favicon.ico` ("Format error decoding Ico: The PNG is not
in RGBA format!"), perché le tre immagini dentro (16, 32, 48) erano PNG
RGB, color type 2, e Next.js le vuole RGBA, color type 6. Rigenerato con
lo stesso disegno e le stesse misure, in RGBA con alpha 255 ovunque:
controllato l'header di ogni PNG dentro l'ICO. `npm run build` in locale
finisce senza errori. Da ora in poi la build si lancia prima di ogni
commit che tocca `public/` o `src/app/`: test e lint erano verdi, solo la
build lo avrebbe visto. I PNG in `public/` restano RGB: Next li serve
così come sono, senza leggerli.

## 2026-10-11 — Icona di Libra: la bilancia

Branch `nome-libra`, passo 2 della rinomina. Dal mockup
`docs/mockups/icona-libra.html` (tre proposte: monogramma "L", bilancia,
segno della Bilancia) scelta la bilancia, scura con il segno verde chiaro
(`--background` e `--accento-scuro` del tema scuro, verde). Al posto di
"NT": `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, e
`favicon.ico` (16, 32, 48 px), che era ancora il triangolo di Next.js.
PNG quadrati pieni, senza angoli arrotondati né trasparenza: gli angoli
li taglia iPhone, che riempie di nero le parti trasparenti. Il disegno
sta nella zona sicura delle icone maskable. Cache dei file statici a
v7: le icone sono in `PRECACHE`, e l'anteprima del passo 1 ha già
installato la v6. Da provare su iPhone.

## 2026-10-11 — Nome "Libra" visibile all'utente

Branch `nome-libra`, passo 1 della rinomina (nome deciso l'11/10). Il
nome che si vede diventa "Libra": `name` e `short_name` nel manifest, il
titolo della scheda e `apple-mobile-web-app-title` in `layout.tsx` (il
nome proposto da "Aggiungi a Home"), titolo e testo di `offline.html`.
Cache dei file statici del service worker a v6, perché `offline.html` è
cambiata. Restano "nutritrack" per scelta, e per sempre, le chiavi
tecniche dei dati sul telefono (database Dexie, localStorage,
sessionStorage, cache), `package.json` e la classe `NutriTrackDatabase`:
cambiarle non si vede e rischia i dati locali. Repository GitHub e
progetti Vercel e Supabase restano "nutritrack". Da provare su iPhone.

## 2026-10-11 — Indirizzo unito a main

Unito a main l'11/10 con fast-forward da `4ec4961` a `4567cf7`, senza
commit di merge: `cd9df4a` (voce di merge di `preferiti`, conferme su
iPhone in PUNTO §11), `4567cf7` (indirizzo pubblico app-libra in PUNTO e
README). Branch `indirizzo` mai pushato su GitHub, cancellato in locale.
Deploy di produzione riuscito. 782 test verdi in 67 file, lint e `tsc`
puliti su main dopo il merge. Solo documenti. Voce scritta con il primo
commit del branch successivo (`nome-libra`), per non fare un commit su
main solo per il registro.

## 2026-10-11 — Indirizzo pubblico nei documenti

Branch `indirizzo`. L'app ha un indirizzo pubblico dall'11/10,
https://app-libra.vercel.app (configurato su Vercel e Supabase, fuori
dal codice; il vecchio `nutritrack-green-one.vercel.app` rimanda lì). In
PUNTO: voce "Indirizzo pubblico" in "Fatto", Site URL e Redirect URL
attuali nella regola sulle voci esatte, tolto "L'app non è ancora
condivisibile", prossimo passo 3 fatto e nuovo passo 4, la rinomina in
"Libra". Nel README l'indirizzo dell'app e gli indirizzi dei branch solo
per le prove. Cercati nel repo "git-main", "vercel.app", "green-one" e
indirizzi scritti a mano: nel codice nessuno (reset, service worker e
manifest usano l'origine); gli indirizzi finti nei test restano. Solo
documenti.

## 2026-10-11 — Conferme su iPhone in PUNTO §11

Branch `indirizzo`. Segnate come confermate da Davide l'11/10 su iPhone
tre prove rimaste aperte: la pesata con lo stesso valore in un giorno
nuovo (compare in cima con la data nuova; tolta da "Difetti e verifiche
aperti"), i numeri delle voci con kcal da 1 cifra e su iPhone SE, la
durata della barra con Annulla (3 s bastano, anche dopo "Elimina tutto
il pasto"). Solo documenti.

## 2026-10-11 — Preferiti uniti a main

Provati l'11/10 e uniti a main con fast-forward da `659653d` a
`4ec4961`, senza commit di merge: `481d020` (sottotitolo condiviso,
`ModificaPastoSalvato` apribile da Impostazioni, più la voce di merge di
`pulizie`), `af7fb01` (pagina Preferiti e pasti salvati, riga in
Impostazioni), `3c37512` (etichetta "Preferiti", modifica senza elenco
sotto), `0e8780e` (barra Salva che sparisce mentre si scrive),
`4ec4961` (provato su iPhone). Branch `preferiti` cancellato, in locale
e su GitHub. Deploy di produzione riuscito. 782 test verdi in 67 file.
Voce scritta con il primo commit del branch successivo (`indirizzo`),
per non fare un commit su main solo per il registro.

## 2026-10-11 — Preferiti in Impostazioni provato su iPhone

Branch `preferiti`. Provato l'11/10 in Safari sull'anteprima, con
l'account di prova, scritture controllate su Supabase: riga "Preferiti"
intera; elenco uguale a quello di Aggiungi; stella, Annulla e ritocco,
con una sola riga per alimento sul server (rimessa in vita, nessuna
nuova); modifica del pasto sopra la tab bar, con la tastiera senza
l'elenco sotto né la fascia vuota; salvataggio; ritorno allo stesso
punto dell'elenco; matita in Aggiungi come prima; pagina offline.
Nessun bug nuovo. In PUNTO: struttura e rotte di Impostazioni, la
sezione "Preferiti e pasti salvati", la modifica del pasto apribile da
Impostazioni, la barra Salva che sparisce mentre si scrive, la voce
"Fatto" in §11 e l'incoerenza nota del segnalibro in Oggi, che elimina
un pasto salvato senza conferma né Annulla. Corretto anche l'elenco
delle rotte, a cui mancava `/impostazioni/pasti`. Solo documenti.

## 2026-10-11 — Barra Salva della modifica pasto: sparisce mentre si scrive

Branch `preferiti`. In `ModificaPastoSalvato`, mentre nome o grammi hanno
il fuoco, la barra Salva/Annulla non è più solo invisibile
(`visibility: hidden` della regola `data-nascondi-mentre-scrivi`, che ne
lasciava lo spazio: una fascia vuota sopra la tastiera) ma sparisce del
tutto (`display: none`), e l'elenco si allunga fino alla tastiera. Regola
nuova `data-sparisci-mentre-scrivi` in `globals.css`, limitata a quella
schermata; la regola globale resta com'è per tab bar e Profilo. Vale da
Impostazioni e dalla matita in /aggiungi. 782 test verdi, `tsc` e lint
puliti. Da provare su iPhone.

## 2026-10-11 — Preferiti: etichetta corta, modifica del pasto con la tastiera

Branch `preferiti`. Dalle prove su iPhone dell'11/10 (Safari,
anteprima, account di prova), due difetti. La riga in Impostazioni
"Preferiti e pasti salvati" veniva accorciata con "…" accanto a "1
alimento · 2 pasti": ora l'etichetta è "Preferiti", il titolo della
pagina resta per esteso; tolta la forma corta "12 · 3", non serve più.
Aperta da Impostazioni, `ModificaPastoSalvato` con la tastiera aperta
finiva a metà schermo e sotto si vedeva l'elenco: iOS faceva scorrere
il documento per mostrare il campo, e la schermata (fixed, agganciata
con `useAreaVisibile`) non seguiva. In /aggiungi il documento è vuoto e
non scorre. Ora, con un pasto aperto, la pagina disegna solo la
schermata: il documento resta alto quanto la finestra, come in
Aggiungi. Lo scorrimento dell'elenco si ripristina alla chiusura, righe
tolte e barra restano. Causa dedotta dal codice, non misurata: da
riprovare su iPhone. 782 test verdi, `tsc` e lint puliti.

## 2026-10-11 — Preferiti in Impostazioni, passo 2: la pagina e la riga

Branch `preferiti`. Pagina `/impostazioni/preferiti` dal mockup approvato
(proposta A): "Alimenti preferiti" con la stella sulla riga, "Pasti
salvati" che aprono `ModificaPastoSalvato`, pagina vuota con la
spiegazione. La stella toglie con un tocco: la riga resta sbiadita e la
barra offre "Annulla". Togliere e rimettere passano da `togliPreferito` e
`rimettiPreferito`, che rileggono Dexie (un Annulla toccato prima che la
pagina ridisegni toglieva di nuovo invece di rimettere) e rimettono in
vita la stessa riga. Riga in Impostazioni, gruppo App, con "12 alimenti
· 3 pasti", solo "4 alimenti" o "3 pasti" se l'altro gruppo è a zero,
"Nessuno" se lo sono tutti e due (`contaPreferiti`, `testoRigaPreferiti`,
forma corta "12 · 3" a una costante di distanza). `alimentiPreferiti` ora mostra una
volta sola un alimento con due righe vive: tocca anche Aggiungi, dove
prima comparivano doppie. `/impostazioni/preferiti` in `PAGINE_APP`.
Test permanenti: conteggio (alimenti fuori catalogo, pasti invisibili,
doppioni, ricette) e stella → tolto → Annulla con la stessa riga; provati
rompendo la logica. 783 test verdi, `tsc` e lint puliti. Da provare su
iPhone.

## 2026-10-11 — Preferiti in Impostazioni, passo 1: preparazione

Branch `preferiti`. Nessun cambio visibile. Il sottotitolo di un pasto
salvato ("3 alimenti · 412 kcal") era scritto due volte, nella riga di
Aggiungi e in `ModificaPastoSalvato`: ora `kcalPastoSalvato` e
`sottotitoloPastoSalvato` in `src/lib/inserimento/pastiSalvati.ts`.
`ModificaPastoSalvato` si aggancia da sola alla parte visibile della
finestra (`fixed` con `useAreaVisibile`, la stessa geometria del `<main>`
di Aggiungi, dove prima era `absolute`), così copre anche la tab bar
quando si aprirà da Impostazioni, e chiama `useSegnalaModifiche`, che in
/aggiungi non fa niente. Aggiunto il mockup approvato
`docs/mockups/preferiti-e-pasti-salvati.html`. 771 test verdi senza
modifiche, `tsc` e lint puliti.

## 2026-10-11 — Pulizie unite a main

Provate l'11/10 e unite a main con fast-forward da `b7d164b` a
`659653d`, senza commit di merge: `78b23f0` (ESLint ignora .claude, più
la voce di merge di `icona-preferiti`), `dd4da7f` (Prettier configurato,
non applicato), `e4f953f` (messaggio d'errore di Duplica), `5ce5657`
(numeri delle voci incolonnati, grammi con la virgola), `659653d`
(provato su iPhone). Branch `pulizie` cancellato, in locale e su GitHub.
Deploy di produzione riuscito. 771 test verdi in 65 file. Voce scritta
con il primo commit del branch successivo (`preferiti`), per non fare un
commit su main solo per il registro.

## 2026-10-11 — Numeri delle voci incolonnati provati su iPhone

Branch `pulizie`. Provato l'11/10 in Safari sull'anteprima, con
l'account di prova: "·" e "g" in colonna con kcal da 1, 2 e 3 cifre; una
voce da 12,5 g scritta "12,5 g", anche nella copia trascinata; i nomi
lunghi si accorciano con "…" senza spingere i numeri. Nessun bug
trovato. In PUNTO §11 la voce "Fatto" al posto della verifica aperta.
Solo documenti.

## 2026-10-11 — Numeri delle voci in Oggi incolonnati, grammi con la virgola

Branch `pulizie`. Nella riga di ogni voce le kcal stanno in uno spazio
largo almeno 3 cifre, allineate a destra (`min-w-[3ch]`, `tabular-nums`):
"·" e "g" restano fermi, grammi e kcal in colonna. I grammi con decimali
si leggevano "12.5 g": ora "12,5 g", anche nella copia trascinata, con
`formattaGrammi` spostata da `SheetDoppioni` in
`src/lib/inserimento/grammi.ts` senza cambiarne il comportamento. 771
test verdi, `tsc` e lint puliti. Da provare a schermo su iPhone (PUNTO
§11, verifiche aperte). In PUNTO §3 corretta la descrizione superata
delle voci ("nomi separati da punto medio": ora una riga ciascuna).

## 2026-10-11 — Messaggio d'errore di Duplica con giorno e pasto

Branch `pulizie`. In `duplicaNelPasto` il controllo sul pasto di
destinazione lanciava "Pasto non valido per Duplica il : ": le variabili
erano sparite già nel commit `d3796d1` (un `${...}` svuotato dalla shell
che ha scritto il file). Ora dice giorno e id del pasto, come il gemello
di Aggiungi. È un messaggio per lo sviluppatore, non visibile in app.
Cercati altri template rotti in `src`, nei `.md` e in `supabase`: nessuno.

## 2026-10-11 — Prettier configurato, non ancora applicato

Branch `pulizie`. `prettier@3.9.10` come devDependency (versione esatta),
`.prettierrc` sullo stile prevalente di `src` (doppi apici, `;`, 100
colonne, virgole "es5", fine riga `auto` per il CRLF di Git su Windows),
`.prettierignore` con documenti `.md`, generati e codice di terzi. Niente
`eslint-config-prettier`: nessun conflitto con le regole attive. Nessun
file riformattato: il primo lancio (128 file di `src` più due di
configurazione) sarà un commit a parte, regola scritta in PUNTO §8.
Corretto in prova un errore del `.prettierignore`: `supabase` senza "/"
escludeva anche `src/lib/supabase`. In VS Code niente formattazione al
salvataggio. Riallineata una riga della voce di merge qui sotto.

## 2026-10-11 — ESLint non controlla più le skill di `.claude`

Branch `pulizie`. `.claude/**` aggiunto a `globalIgnores` in
`eslint.config.mjs`: i 152 avvisi venivano tutti dagli script della skill
"impeccable" (codice di terzi), nessuno da `src`. Regole invariate.
`npx eslint .` ora dà 0 avvisi; 771 test verdi, `tsc` pulito.

## 2026-10-11 — Icona preferiti unita a main

Provato l'11/10 (voce sotto) e unito a main con fast-forward da
`8889759` a `b7d164b`, senza commit di merge: `71f0057` (segnalibro fermo
e area di tocco 44px, più la voce di merge di `doppioni-aggiungi`),
`b7d164b` (provato su iPhone). Branch `icona-preferiti` cancellato, in
locale e su GitHub. Deploy di produzione riuscito. 771 test verdi in 65
file. Voce scritta con il primo commit del branch successivo (`pulizie`),
per non fare un commit su main solo per il registro.

## 2026-10-11 — Segnalibro allineato provato su iPhone

Branch `icona-preferiti`. Provato l'11/10 in Safari sull'anteprima, con
l'account di prova: segnalibri in colonna con kcal da 2 e da 3 cifre, in
tema scuro e chiaro; tocco appena fuori dal disegno preso dal segnalibro;
tocco sulla prima voce vicino al segnalibro apre la voce; riga del pasto
vuoto ("—") in ordine. Nessun bug trovato. In PUNTO §3 (Oggi, punto 3)
la regola della riga; in §11 la voce "Fatto" e il piccolo lavoro aperto
`tabular-nums` sulle voci dentro il pasto. Solo documenti.

## 2026-10-11 — Icona preferiti ferma nella riga del pasto

Branch `icona-preferiti`. In Oggi il segnalibro del pasto si spostava in
base alle cifre delle kcal (80 contro 554). Ora il numero sta in uno
spazio largo almeno 4 cifre, allineato a destra (`min-w-[4ch]`,
`tabular-nums`), e "kcal" non va a capo. Area di tocco del segnalibro
portata a 44px con margini negativi che la compensano: icona e kcal
restano dove stavano. Hanken Grotesk non ha `tnum`, ma le sue cifre sono
già tutte larghe uguali, quindi 4ch = 4 cifre. Aggiornato un test che
cercava "100 kcal" in un solo elemento. Da provare a schermo su iPhone.

## 2026-10-11 — Doppioni in Aggiungi unito a main

Provato l'11/10 (voce sotto) e unito a main con fast-forward da
`da9a9c7` a `8889759`, senza commit di merge: `f451474` (la voce di merge
di `reset-password`), `a385832` (pianoInserimento), `cac0872`
(aggiungiNelPasto, tutto o niente), `20d85d6` (testi della barra),
`6f65b61` (la pagina /aggiungi), `6138482` (i documenti), `8889759`
(provato su iPhone). Branch `doppioni-aggiungi` cancellato, in locale e su
GitHub. Deploy di produzione riuscito. 771 test verdi in 65 file. Voce
scritta con il primo commit del branch successivo (`icona-preferiti`),
per non fare un commit su main solo per il registro.

## 2026-10-11 — Doppioni in Aggiungi provato su iPhone

Branch `doppioni-aggiungi`. Provato l'11/10 in Safari sull'anteprima, con
l'account di prova, e verificato su Supabase: Somma con un tocco e
Annulla che riporta i grammi; "Scrivi quantità" → "Aggiornato"; "Tieni
separati"; "Non aggiungerlo" (resta su /aggiungi, il "+" risponde
subito); pasto salvato con un doppione, anche escluso; doppio tocco → una
riga; Duplica con doppione come prima. Nessun bug trovato. Provato anche
il giorno che cambia sull'app installata, con l'account vero: riaperta
dal multitasking la mattina dell'11, Oggi era su domenica 11 e il menu
lasciato aperto la sera era chiuso. Tolta la voce aperta da PUNTO §11.
Documenti: PUNTO §11.

## 2026-10-11 — Doppioni in Aggiungi, passo 6: documentazione

Branch `doppioni-aggiungi`. PUNTO §3, Aggiungi: nuovo blocco "Doppioni in
Aggiungi" (confronto per `alimento_id`, foglio con "in arrivo" e "Non
aggiungerlo", rilettura alla conferma, tutto o niente, "Non aggiungerlo"
che vale anche se il doppione sparisce, il blocco del doppio tocco, i testi
della barra). Corretto il paragrafo dell'Annulla, rimasto a `creaVoce` e
`annullaInserimento`: ora si annulla dalla fotografia, con
`annullaOperazione`. §11: due difetti aperti (Sposta e Duplica ignorano
l'esclusione se il doppione sparisce; il cambio di pasto dallo sheet di
modifica in Oggi non controlla i doppioni) e il conteggio dei test. Solo
documenti.

## 2026-10-11 — Doppioni in Aggiungi, passo 5: la pagina /aggiungi

Branch `doppioni-aggiungi`. I tre percorsi (sheet quantità, "+" di
Recenti/Preferiti, pasto salvato) passano da una sola funzione che chiama
`aggiungiNelPasto`: tolto `creaVoce`, che scriveva il pasto salvato in
parallelo. Doppioni → `SheetDoppioni` ("in arrivo", "Non aggiungerlo",
"Aggiungi"), "cambiati" → foglio riaperto con l'avviso come in Sposta;
Annulla/Esc/tocco fuori o tutto escluso → si resta su /aggiungi senza
barra. Blocco "aggiunta in corso" (`useRef`) preso al tocco, liberato dopo
errore, "niente entrato" e chiusura del foglio; resta preso col foglio
aperto e tornando a Oggi. Bug evitato: un doppio tocco sul "+" scriveva due
righe. 5 test nuovi; 9 rotture di prova prese, ripristino dalla copia. 771
test verdi in 65 file. Aperto: PUNTO_DI_PARTENZA.md non descrive ancora i
doppioni in /aggiungi.

## 2026-10-10 — Doppioni in Aggiungi, passo 4: testi della barra e passaggio a Oggi

Branch `doppioni-aggiungi`. `messaggioInserimento` in `testiBarra.ts`:
"Aggiunto: Mela", "Sommato: Mela → 150 g", "Aggiornato: Mela → 120 g",
"Aggiunto: Colazione (3 alimenti)" (aggiunti + sommati), "Aggiunto:
«Colazione» (tranne «Mela», che c'era già)." con più esclusi come in
Duplica; niente entrato → nessun messaggio. `ultimoInserimento` porta a
Oggi la fotografia intera e il messaggio (resta in memoria del modulo:
ricaricando, nessuna barra); Oggi li usa per barra e Annulla, e con una
fotografia vuota non mostra la barra. Bug evitato: con la fotografia di
sole righe create, Annulla dopo una Somma lasciava i grammi sommati.
/aggiungi adattata alla forma nuova senza cambiare comportamento
(collegamento ai doppioni al passo 5). 11 test nuovi; 7 rotture di prova
prese, ripristino dalla copia. 766 test verdi in 65 file.

## 2026-10-10 — Doppioni in Aggiungi, passo 3: aggiungiNelPasto

Branch `doppioni-aggiungi`. `aggiungiNelPasto` in
`src/lib/repository/vociDiario.ts`, gemella di `duplicaNelPasto`:
ricontrolla giorno (fino a oggi + 7) e pasto, rilegge da Dexie le righe
del pasto di destinazione alla conferma, esiti "doppioni" / "cambiati" /
"fatto". Tutte le scritture in `applicaScritture` (o tutto o niente, anche
per il pasto salvato, che prima scriveva in parallelo e un guasto a metà
lasciava metà pasto); giorno classificato solo se nasce una riga.
"Non aggiungerlo" vale anche se il doppione sparisce prima della conferma
(Sposta e Duplica invece spostano/copiano: lasciato com'è, da annotare in
PUNTO §11). `pianoInserimento` restituisce anche `aggiornati` (sommati o
scritti, con i grammi) per la barra. 14 test nuovi; 10 rotture di prova
prese, ripristino dalla copia. 755 test verdi in 65 file. La pagina
/aggiungi non lo usa ancora (passo 5).

## 2026-10-10 — Doppioni in Aggiungi, passo 2: pianoInserimento

Branch `doppioni-aggiungi`. Primo pezzo dei doppioni in /aggiungi (oggi
aggiungere un alimento già presente nel pasto crea una seconda riga in
silenzio). Estratto da `pianoDuplica` il cuore comune "righe nuove che
entrano in un pasto, con i doppioni" (`src/lib/diario/pianoInserimento.ts`,
funzione pura); `pianoDuplica` ora prepara le copie e delega. Nessun
cambio di comportamento: test di Duplica e Sposta invariati e verdi.
`trovaDoppioni`/`sommaGrammi` accettano anche righe non ancora scritte
(solo tipi). 14 test nuovi; 7 rotture di prova prese (due sui test
esistenti di Duplica), ripristino dalla copia. 741 test verdi in 65 file.

## 2026-10-10 — Ripristino della password unito a main

Provato il 10/10 (voce sotto) e unito a main con fast-forward da
`8f3e7ea` a `da9a9c7`, senza commit di merge: `fe3c7f2` (lo scambio del
codice non avviene più due volte, e la voce di merge di `sync-stato`),
`9235095` (testi chiari sul link di ripristino, nuovo link anche da
loggati), `88b22ce` (un link già usato non apre più il modulo),
`f5cc5ca` (dopo il salvataggio la pagina esce dalla cronologia),
`da9a9c7` (i documenti, provato su iPhone il 10/10). Branch
`reset-password` cancellato, in locale e su GitHub. Deploy di produzione
riuscito. 727 test verdi in 64 file. Voce scritta con il primo commit
del branch successivo (`doppioni-aggiungi`), per non fare un commit su
main solo per il registro.

## 2026-10-10 — Ripristino della password provato su iPhone

Branch `reset-password`. Provato il 10/10 su iPhone in Safari
sull'anteprima, account di prova: link aperto la prima volta → modulo
subito, con l'email dell'account; ricaricando prima di salvare il
modulo resta; salvataggio → Oggi; link già usato (`otp_expired`) con la
sessione dell'account di prova aperta → testo "link scaduto", niente
modulo; link chiesto da Chrome sul PC e aperto in Safari su iPhone →
testo "altro browser", niente modulo, e "Richiedi un nuovo link" apre la
pagina anche da loggato; dopo il salvataggio "indietro" da Oggi non
riporta più alla pagina del reset (`router.replace`). Nessun bug
trovato. Documenti: PUNTO §9.1 (il flusso di ripristino come regola),
§11 ("Fatto"; in "Difetti e verifiche aperti" Redirect URL solo esatte,
reset dall'app installata su iPhone, errore di rete durante lo scambio,
limite delle email gratuite, app non ancora condivisibile; "Prossimi
passi": un indirizzo di produzione pubblico). Test 727 in 64 file.

## 2026-10-10 — Reimposta password: dopo il salvataggio la pagina esce dalla cronologia

Branch `reset-password`. Provato sull'anteprima (`88b22ce`): dopo il
salvataggio, "indietro" da Oggi mostrava "Link non valido". Corretto
(il segno era stato tolto) ma strano. Ora `router.replace("/")` invece
di `router.push("/")`: la pagina del reset esce dalla cronologia; il
segno tolto resta come seconda difesa. T8 aggiornato (rottura con
`push` presa, ripristino dalla copia). 727 test verdi in 64 file. Da
riprovare sull'anteprima.

## 2026-10-10 — Reimposta password: un link già usato non apre più il modulo

Branch `reset-password`. Bug di sicurezza trovato provando l'anteprima
(`9235095`): riaprendo il link già usato compariva il modulo, con la
sessione dell'account di prova aperta in Safari; la password nuova
sarebbe finita su quell'account. Causa: per un link già usato o scaduto
il server rimanda alla pagina SENZA `?code=`, con l'errore nella query e
nell'hash (`otp_expired`, verificato nel sorgente di supabase/auth e nei
log); la pagina non guardava l'esito di `initialize()` e mostrava il
modulo a qualunque sessione aperta. Ora: errore nell'indirizzo → testo
del link scaduto, sempre; senza codice né errore (ricaricamento) il
modulo solo se la sessione è dello stesso utente del "segno" scritto in
`sessionStorage` dopo lo scambio riuscito in questa scheda
(`segnoRipristinoPassword.ts`, tolto dopo il salvataggio, letture e
scritture in try/catch). Scartato il claim `amr`: "recovery" resta per
tutta la sessione, e c'era proprio su quella della prova. Il modulo
mostra l'email dell'account (campo in sola lettura,
`autoComplete="username"`). Test: 15 casi (T1–T9), 7 rotture di prova
prese, ripristino dalla copia; corretto anche un token finto che
dipendeva dal secondo corrente. 727 test verdi in 64 file. Da riprovare
sull'anteprima.

## 2026-10-10 — Reimposta password: testi chiari e nuovo link anche da loggati

Branch `reset-password`. Due testi distinti sotto "Link non valido":
link aperto in un altro browser (verifier assente; spiega che su iPhone
i link delle email si aprono sempre in Safari) e link scaduto, già usato
o superato da uno più recente. Il secondo si sceglie dal codice
dell'errore (`flow_state_not_found`, `flow_state_expired`,
`bad_code_verifier`), non dal testo inglese: quello di
`bad_code_verifier` contiene "code verifier" e finiva sul messaggio
sbagliato (`traduciErroreLinkRipristino` in `erroriAuth.ts`).
`/password-dimenticata` ora è sempre accessibile: da loggati
"Richiedi un nuovo link" rimandava alla home, e serviva proprio con
l'account di prova aperto in Safari. Nessun rischio nuovo: chiedere un
reset è già possibile a chiunque. Test: 8 casi (i rifiuti del server
con `it.each`), testi scritti per intero; 3 rotture di prova prese,
ripristino dalla copia. 720 test verdi in 64 file. Da provare nel
browser. Aperto: con un errore di rete durante lo scambio la libreria
cancella il verifier, e ricaricando compare il testo "altro browser".

## 2026-10-10 — Reimposta password: il link funziona alla prima apertura

Branch `reset-password`. Bug: aprendo il link dell'email compariva "Link
non valido", e solo ricaricando il modulo. Causa: il client Supabase
(singleton, `detectSessionInUrl`) scambia da solo il `?code=` appena
nasce; la pagina lo scambiava una seconda volta, trovava il code
verifier già usato e cancellato, e mostrava l'errore anche se l'accesso
era riuscito. Ora la pagina legge l'esito con `initialize()` e mostra il
modulo solo se la sessione è nata da quel link: la libreria toglie
`?code=` dall'indirizzo solo dopo uno scambio riuscito. Una sessione già
aperta di un altro account (per esempio quello di prova in Safari) dà
errore, come prima: la password non può finire sull'account sbagliato.
Testi invariati (il caso "altro browser" usa ancora il messaggio di
oggi). Test permanente `reimpostaPassword.test.tsx`: client Supabase
vero, rete finta che fa fallire il test per ogni richiesta non prevista,
6 casi; 5 rotture di prova prese, ripristino dalla copia. 718 test verdi
in 64 file. Da provare nel browser.

## 2026-10-10 — Indicatore di sincronizzazione unito a main

Provato il 10/10 (voce sotto) e unito a main con fast-forward da
`6b99c32` a `8f3e7ea`, senza commit di merge: `7ae114b` (voce di merge
di `pasti-date`), `3924d81` (nessun tentativo consumato senza rete o con
401), `a7f06fb` (richieste annullate dopo 30 s), `dd30a0d` (lo stato
della sincronizzazione), `0fae28d` (`ultimo_status`, Dexie version(8)),
`3758281` (la pagina Sincronizzazione), `0d0fe97` (la riga in
Impostazioni), `816d081` (il pallino sulla tab), `8f3e7ea` (i documenti,
provato su iPhone il 10/10). Branch `sync-stato` cancellato, in locale e
su GitHub. Deploy di produzione riuscito. 712 test verdi in 63 file.
Voce scritta con il primo commit del branch successivo
(`reset-password`), per non fare un commit su main solo per il
changelog.

## 2026-10-10 — Indicatore di sincronizzazione provato su iPhone

Branch `sync-stato`. Provato su iPhone il 10/10 in Safari sull'anteprima,
build `816d081`, account di prova, tutto verificato su Supabase:
aggiornamento di Dexie alla `version(8)` senza perdita di voci; "Tutto
salvato" nella pagina e nella riga (pallino verde), nessun pallino sulla
tab; in modalità aereo 6 voci registrate, "6 in attesa" in ocra con "in
attesa dalle …", nessun pallino, nessuna voce accantonata (la prova di
D1); tornata la rete, "Sincronizza ora" → "Tutto salvato online", le 6
voci arrivate al server nello stesso giro. Non provati a mano, coperti
dai test: server che rifiuta, accesso scaduto, accantonate, pallino sulla
tab. Nessun bug trovato. Nota: il primo deploy di anteprima era fallito
con "Git information retrieval failed" (problema di Vercel, non del
codice), risolto con Redeploy. Documenti: PUNTO §3 e §11 (l'indicatore
passa in "Fatto"; test 712 in 63 file).

## 2026-10-10 — Sincronizzazione: il pallino sulla tab Impostazioni

Branch `sync-stato`. Ultimo pezzo dell'indicatore: un pallino arancio
sull'icona della voce Impostazioni, solo per accantonate, accesso scaduto
e server che rifiuta dal secondo giro fallito di fila; spento senza rete.
`usePallinoSincronizzazione` (stesso hook della pagina), disegnato in
`BarraNavigazione`. Difetto trovato dal test e corretto prima del commit:
il testo per lo screen reader stava prima del nome della voce ("…da
controllare Impostazioni"); ora viene dopo. 5 test in
`BarraNavigazione.test.tsx` (primo test della barra); 4 rotture di prova
prese, ripristino dalla copia. 712 test verdi in 63 file. Da provare su
iPhone. Documenti: PUNTO §3, §9.2, §11.

## 2026-10-10 — Sincronizzazione: lo stato nella riga di Impostazioni

Branch `sync-stato`. Mockup "2 · Pallino + testo": a destra della riga
Sincronizzazione un pallino colorato e lo stato in breve ("Tutto
salvato", "In corso…", "2 in attesa", "Errore", "Accedi di nuovo", "Da
controllare"), in grigio, ocra o arancio. `rigaSincronizzazione` (pura) e
`ValoreRigaSincronizzazione`; l'elenco usa lo stesso hook della pagina.
`RigaImpostazioni` invariato. Test: 3 sulla funzione, 3 sull'elenco vero
(primo test della pagina Impostazioni); 7 rotture di prova prese,
ripristino dalla copia. 707 test verdi in 62 file. Documenti: PUNTO §3,
§9.2, §11.

## 2026-10-10 — Sincronizzazione: la pagina con l'indicatore

Branch `sync-stato`. La pagina Impostazioni > Sincronizzazione dal mockup
approvato (`docs/mockups/sincronizzazione.html`, aggiunto con questo
commit; scelta "A · Riquadro").
- Riquadro dello stato (`RiquadroStatoSincronizzazione`) con i testi dei
  sei stati (`testiSincronizzazione.ts`: "dalle 14:02", "da ieri alle…",
  "Controllato alle…"); colori dai token, con l'ocra nuovo `--attesa`
  (`text-pending`, chiaro e scuro) per "in attesa".
- `useStatoSincronizzazione`: coda dell'utente da Dexie (`useLiveQuery`),
  giri dalla memoria (`useSyncExternalStore`), e un timer che ridisegna la
  pagina quando un giro supera il secondo ("in corso").
- "Sincronizza ora", spento durante un giro; con la sessione scaduta
  "Esci e rientra" (`EsciAccount` con l'etichetta nuova). Esci azzera lo
  stato dei giri.
- "Non salvate online" (`ModificheAccantonate`): elenco in parole
  dell'utente, "Dettagli tecnici" chiuso, "Riprova a salvarle"
  (`riprovaAccantonate` in `codaDellUtente.ts`, solo le voci di
  quell'utente). Rispetto al mockup, una voce di diario mostra anche
  l'alimento ("Yogurt magro, Pranzo").
Test: 8 sulla pagina (sei stati, Sincronizza ora, Riprova), 3 in
`codaDellUtente.test.ts`, 5 in `testiSincronizzazione.test.ts`, contrasti
dell'ocra e dell'arancio. 17 rotture di prova, ogni test nuovo rosso
almeno una volta, ripristino dalla copia. 701 test verdi in 60 file. Non
ancora provata su iPhone. Documenti: PUNTO §3, §7, §9.2, §11.

## 2026-10-10 — Sincronizzazione: lo status dell'ultimo invio fallito (Dexie version 8)

Branch `sync-stato`. Commit a sé prima della pagina, perché tocca la sync
e lo schema Dexie: i "Dettagli tecnici" delle voci accantonate (mockup
approvato) mostrano anche lo status HTTP, che la coda non salvava. Campo
nuovo `ultimo_status` sulle voci outbox, scritto da `sincronizza.ts` a
ogni invio fallito (0, 401, 4xx/5xx; null per un'eccezione). Facoltativo:
`version(8)` con gli stessi indici della 7 e senza `.upgrade()` (regola
B.4, le voci di prima valgono "status non noto"). `aggiornamentoSchema.test.ts`
ora parte anche dalla 7 e prova il campo nuovo; tre controlli dello status
in `sincronizza.test.ts`. Rotture di prova prese (status non salvato
sull'accantonata: 1 rosso; senza la version(8): 6), ripristino dalla
copia. 684 test verdi in 57 file. Documenti: PUNTO §9.2, §11.

## 2026-10-10 — Sincronizzazione: lo stato per l'indicatore

Branch `sync-stato`. Terzo commit dell'indicatore, l'ultimo prima del
mockup; da solo perché tocca i punti d'ingresso della sync (il
comportamento non cambia: i 664 test di prima passano senza modifiche).
- `statoSincronizzazione.ts` (nuovo): stato dei giri in memoria per salita
  e discesa (in corso, esito `ok`/`rete`/`sessione`/`errore`, da quando,
  giri di fila), che si sostituisce a ogni cambiamento e avvisa chi
  ascolta (per `useSyncExternalStore`); ora dell'ultimo contatto riuscito
  in `localStorage`; `esitoDaStatus`, la regola dello status in un posto
  solo (anche `rifiutoDelServer` la usa).
- `sincronizza.ts`: ogni giro segna inizio e fine con il suo esito;
  `discesa.ts`: `ErroreRichiesta` porta lo status, `scaricaTutto`
  restituisce le tabelle non scaricate e il perché.
- `statoDaMostrare`, funzione pura: un solo stato per priorità
  (accantonate, sessione, errore, in corso, in attesa con da quando,
  sincronizzato) e il pallino (stati 1–3, il 3 dal secondo giro fallito).
  Rispetto all'analisi: "in corso" passa prima di "in attesa", e la voce
  di una scrittura appena fatta non fa comparire "in attesa" se l'ultimo
  giro era andato bene (altrimenti lampeggerebbe a ogni tap).
19 test nuovi in `statoSincronizzazione.test.ts` (priorità, e salita e
discesa vere col client finto); sei rotture di prova prese, una per
regola, ripristino dalla copia. 683 test verdi in 57 file. Documenti: PUNTO
§9.2 (nuova sottosezione "L'indicatore") e §11.

## 2026-10-10 — Sincronizzazione: un tempo massimo per ogni richiesta

Branch `sync-stato`. Secondo commit dell'indicatore, da solo perché cambia
la sync di tutta l'app. Difetto D2 dell'analisi: le richieste non avevano
un limite, e su iPhone una fetch rimasta appesa con l'app in background
teneva il giro "in corso" per sempre, con ogni giro nuovo prenotato dietro.
Ora ogni richiesta del client Supabase del browser viene **annullata**
dopo 30 secondi (`fetchConScadenza.ts`, nuovo, passato a `createClient`
con `global.fetch`): per la libreria è status 0, quindi rete assente e
nessun tentativo contato; in discesa la tabella non sposta il cursore.
Annullare e non solo abbandonare (osservazione di Davide): una richiesta
abbandonata può arrivare dopo una correzione e riscriverla col valore
vecchio, e le tabelle hanno solo il trigger `set_updated_at` (verificato
in produzione). Con un `AbortController` e non `AbortSignal.timeout()`:
quello annulla con "TimeoutError", e la libreria ripete da sola le letture
fallite che non sono un "AbortError". Come rete di sicurezza resta
`conTempoMassimo` (`src/lib/sync/tempoMassimo.ts`, 35 secondi), una corsa
contro un timer intorno a ogni richiesta della sync. Test: sette in
`fetchConScadenza.test.ts`, tre col client Supabase vero e una fetch
appesa (invio e lettura tornano status 0 senza ripetizioni; la sync non
consuma tentativi), più due in `sincronizza.test.ts` e uno in
`discesa.test.ts` per la rete di sicurezza. Rotture di prova prese
(client senza la fetch: 3 rossi; "TimeoutError" al posto di "AbortError":
4; segnale di chi chiama ignorato: 2; senza la corsa: 3; solo discesa: 1;
solo salita: 2), ripristino dalla copia. 664 test verdi in 56 file.
Documenti: PUNTO §9.2, §11 (il rischio residuo: una richiesta già partita
del tutto prima di bloccarsi può ancora arrivare tardi; e Dexie, che
risultava ancora a `version(6)`, è a 7).

## 2026-10-10 — Sincronizzazione: offline non si accantona più niente

Branch `sync-stato`. Primo commit dell'indicatore di sincronizzazione, da
solo perché cambia la sync di tutta l'app. Difetto trovato nell'analisi:
senza rete Supabase non lancia un'eccezione ma risponde `{ error }` con
status 0, e il giro lo contava come tentativo. Offline ogni scrittura fa
un giro, quindi dopo 5 scritture la prima voce in coda veniva accantonata
senza che il server l'avesse mai vista. Ora conta solo un rifiuto vero del
server, deciso dallo status HTTP (`rifiutoDelServer` in `sincronizza.ts`):
con 0 (rete) e 401 (sessione scaduta, decisione di Davide) la coda aspetta
il giro dopo senza contare tentativi, tenendo `ultimo_errore`.
Un'eccezione durante l'invio invece conta, come prima (decisione di
Davide): senza rete Supabase non lancia, quindi un'eccezione è più
probabilmente un guasto sulla riga, che non contando fermerebbe la coda
per sempre. Cinque test nuovi in `sincronizza.test.ts`; rotture di prova
prese (tutto contato: test offline e 401 rossi; solo il 401 contato: 1
rosso; eccezione come rete: test dell'eccezione rosso), ripristino dalla
copia. 654 test verdi in 55 file. Documenti: PUNTO §9.2 (la regola) e §3,
§11.

## 2026-10-10 — Pasti e orari, passo 5 unito a main

Provato il 10/10 (voce sotto) e unito a main con fast-forward da
`5766c89` a `6b99c32`, senza commit di merge: `d8f8830` (cambi
programmati, logica pura), `5739e1b` (colonna `eliminata_dal_cambio`,
migration e Dexie version(7)), `147c7b2` (scritture e Annulla), `c42b30f`
(la domanda "Da una data"), `4fa5146` (le schede per data), `6b99c32` (i
documenti, provato su iPhone il 10/10). Branch `pasti-date` cancellato, in
locale e su GitHub. Deploy di produzione riuscito. 649 test verdi in 55
file. Voce scritta con il primo commit del branch successivo
(`sync-stato`), per non fare un commit su main solo per il changelog.

## 2026-10-10 — Pasti e orari, passo 5 provato su iPhone

Branch `pasti-date`. Provato su iPhone il 10/10 in Safari, account di
prova, tutto verificato su Supabase (compreso il segno
`eliminata_dal_cambio`): rinomina programmata con orario e schede per
data; stessa data che modifica il cambio programmato; solo orario con
"Subito" e "Da una data"; aggiungi da una data ("nuovo" nella scheda);
elimina da una data con conferma (la voce cancellata a mano non torna,
quella eliminata dal cambio sì, con l'Annulla della scheda); Annulla della
barra; rinomina "da oggi" con orario (i giorni passati tengono l'ora
vecchia); limite della data al prossimo cambio programmato. Nessun bug
trovato. Documenti: PUNTO §3 (passo 5 non più "da provare") e §11.

## 2026-10-10 — Pasti e orari, passo 5e: le schede per data

Branch `pasti-date`. L'ultimo pezzo del passo 5.

- `SchedePerData`: "Oggi" e una pastiglia "Dal lun 12 ott" per ogni data
  con cambi, calcolate dalle righe (`dateProgrammate`). Con le schede,
  l'elenco di oggi ha il titolo "Oggi, sab 10 ott".
- `VistaDataFutura`: i pasti di quel giorno con "nuovo" / "nome nuovo" /
  "ora nuova" + "prima: …", "Non ci sarà più: …", e i cambi della data.
  `RigaCambio`: il cambio con il suo Annulla (`annullaCambioProgrammato`);
  per "non ci sarà più" le voci eliminate, lette dal vivo con
  `vociEliminateDalCambio` (nuova, in `modifichePasti.ts`, che condivide la
  ricerca col suo Annulla). Barra "Cambio annullato: … (tornano N voci)",
  senza un altro Annulla.
- La pagina usa `useGiornoCorrente` al posto di `oggiLocale()`: quando la
  data arriva la scheda sparisce, e si torna a "Oggi" (anche annullando
  l'ultimo cambio di una data).
- Limite lasciato aperto, scritto in PUNTO §11: il Salva dei campi
  controlla nome e ora con le regole "da oggi", quindi blocca un cambio
  che andrebbe bene solo "da una data" (verificato con un test
  temporaneo, poi cancellato).
- Documenti: PUNTO §3 e §11.
- Test: 5 nuovi nella pagina (schede assenti, contenuto della scheda,
  Annulla con le voci rimesse, Annulla in conflitto, data che arriva),
  provati a vuoto rompendo il codice da una copia (7 rotture, tutte prese).
  649 test verdi in 55 file.

## 2026-10-10 — Pasti e orari, passo 5d: la domanda "Da una data"

Branch `pasti-date`. L'interfaccia delle scritture del 5c, senza ancora
le schede per data.

- `SheetDaQuando`: un campo "Dal giorno" facoltativo, legato a una delle
  scelte e controllato dalla pagina (valore, errore sotto il campo che
  spegne il pulsante, una nota). Classi `.campo-data` e
  `overflow-x-hidden` come in Duplica (`campiData.test.ts`).
- Pasti e orari: "Da una data" per rinomina, aggiungi ed elimina; per il
  **solo orario** ora c'è la domanda "Subito" / "Da una data" (prima si
  scriveva subito, senza chiedere), salvo pasti senza giorni futuri da
  scegliere. Data proposta: il prossimo lunedì (`prossimoLunedi`,
  `dataProposta`); controllo della data e dei limiti
  (`erroreDataDaUnaData`, `eGiornoVero` in `dataGiorno.ts`). Spiegazioni
  che seguono la data, conferma di Elimina "dal lun 12 ott", barra
  "Programmato dal …" o "Cambio del … modificato".
- Documenti: PUNTO §3.
- Test: 10 nuovi (pagina, funzioni pure), uno riscritto (solo l'ora ora
  chiede), provati a vuoto rompendo il codice da una copia (13 rotture;
  una non partita al primo giro, ripetuta controllando con `diff`). 644
  test verdi in 55 file.

## 2026-10-10 — Pasti e orari, passo 5c: le scritture da una data

Branch `pasti-date`. Le scritture dei cambi programmati e i loro Annulla,
senza ancora interfaccia. Migration `voci_eliminata_dal_cambio` applicata
il 10/10 da Claude in Cowork prima di questo commit e verificata.

- `cambiaDal` (`modifichePasti.ts`): nome e/o ora da un giorno, oggi o una
  data. Taglia la riga del filo valida quel giorno e sposta le voci da lì
  in poi; la stessa data corregge il cambio già programmato. La riga
  vecchia tiene la sua ora (l'orario segue la data): **cambia la rinomina
  "da oggi" già su main**, che dava l'ora nuova anche alla riga vecchia.
  `rinominaDaOggi` ora la chiama con il giorno di oggi.
- `aggiungiPasto` con `dal` (da sempre, da oggi o da una data).
- `eliminaPasto` "da una data", e il taglio di tutto il filo anche per "da
  oggi" e "anche nei giorni passati" (`righeDaTagliare`,
  `regoleElimina`): **difetto latente chiuso**, un pasto con un cambio
  programmato sarebbe ricomparso il giorno del cambio. Le voci tagliate da
  un giorno prendono il segno `eliminata_dal_cambio`.
- Annulla della barra: ricrea anche le righe del filo tagliate (id v5) con
  le loro voci. `annullaOperazione` prende una mappa `pastiSostituiti` e
  ricrea le voci senza il segno.
- `annullaCambioProgrammato`, l'Annulla dalle schede: nuovo (non se ha
  voci), rinomina e orario (la vecchia riprende la fine della nuova),
  elimina (rimette le voci col segno cercandole in tutto il filo, anche
  quelle di una rinomina programmata tagliata).
- Documenti: PUNTO §3 e §4 (la migration non è più "in arrivo").
- Test: 24 nuovi e 2 riscritti (`modifichePasti`, `controlliPasti`,
  `vociDiario`), compreso il caso di Davide e quello del filo, provati a
  vuoto rompendo il codice da una copia (15 rotture). 634 test verdi in 55
  file.

## 2026-10-10 — Pasti e orari, passo 5b: la colonna del segno (migration da sola)

Branch `pasti-date`. Il segno sulle voci cancellate da "Elimina pasto da
una data", perché l'Annulla dalla scheda possa rimetterle (decisione di
Davide del 10/10).

- `supabase/migrations/voci_eliminata_dal_cambio.sql`: `alter table
  public.voci_diario add column eliminata_dal_cambio uuid;` più il
  commento della colonna. Solo additiva, nullable, senza default, vincoli
  né indici; RLS invariata. Primo file di migration nel repo (le
  precedenti esistono solo su Supabase). **Non ancora applicata**: serve
  l'ok di Davide, e va applicata prima del commit 5c.
- `tipi.ts`: `VoceDiario.eliminata_dal_cambio?: string | null`.
- Dexie `version(7)`, stessi indici della 6, senza `.upgrade()` (campo
  facoltativo). `aggiornamentoSchema.test.ts`: partenza anche dalla 6,
  voci vecchie senza la chiave, campo nuovo scritto e riletto, due schede
  alla 6 e alla 7. Provato a vuoto rompendo `database.ts` da una copia (3
  rotture). 610 test verdi in 55 file.
- Nessun codice scrive ancora la colonna: il commit è innocuo anche senza
  la migration.

## 2026-10-10 — Pasti e orari, passo 5a: i cambi programmati, logica pura

Branch `pasti-date`. Primo commit del passo 5 (date future e cambi
programmati in Pasti e orari): le regole per riconoscerli, senza ancora
scritture né interfaccia.

- `src/lib/pasti/cambiProgrammati.ts`: il filo di un pasto (stesso
  `ordine`), i cambi programmati riconosciuti dalle righe (rinomina, solo
  orario, elimina, nuovo), le date delle schede, il contenuto di una
  scheda ("nuovo", "nome nuovo", "ora nuova" + "prima: …", "Non ci sarà
  più"), i limiti della data di "Da una data" e l'id di un cambio (UUID v5
  da riga e data) per il segno sulle voci. `chiaveNome` ora esportata da
  `controlliPasti.ts`.
- Documenti: PUNTO §3 "Date future e cambi programmati" (decisioni del
  10/10, compresa "l'orario segue la data") e §4: `ordine` come filo,
  `voci_diario.eliminata_dal_cambio` in arrivo (migration non applicata).
- Test puri (19), provati a vuoto rompendo il codice da una copia (12
  rotture; una non presa al primo giro ha fatto correggere il test). 609
  test verdi in 55 file.

## 2026-10-10 — Diario fino a 7 giorni unito a main

Provato il 10/10 (voci 1–3 sotto, il giorno che cambia ancora da provare)
e unito a main con fast-forward da `11f1a2a` a `5766c89`, senza commit di
merge: `321abe0` (navigazione e inserimento fino a oggi + 7), `ea89571`
(Elimina e Rinomina "da oggi" con le voci future), `0ea9d7c`
(`useGiornoCorrente`, salto al nuovo oggi), `5766c89` (i documenti,
provato su iPhone il 10/10). Branch `diario-futuro` cancellato, in locale
e su GitHub. Deploy di produzione riuscito. 590 test verdi in 54 file.
Voce scritta con il primo commit del branch successivo, per non fare un
commit su main solo per il changelog.

## 2026-10-10 — Diario fino a 7 giorni, 3: il giorno che cambia

Branch `diario-futuro`. Quando il giorno del calendario cambia, Oggi va
sul nuovo oggi, qualunque giorno stesse mostrando (decisione del 10/10).

- `useGiornoCorrente` (nuovo hook): l'oggi del calendario che si aggiorna
  da solo con un timer fino alla mezzanotte locale (`msAllaMezzanotte` in
  `dataGiorno.ts`) e al ritorno in primo piano (`visibilitychange`: in
  background iOS sospende i timer). Prima l'app riaperta la mattina dal
  multitasking restava su ieri, con "Rimangono X kcal" e senza "Oggi".
- Un foglio aperto (sheet della voce, "Salva come pasto", menu, Sposta,
  Duplica) si chiude e il salto è subito: Sposta, Duplica ed "Elimina
  tutto il pasto" leggono il giorno mostrato alla conferma, e un foglio
  rimasto aperto sopra il giorno nuovo le farebbe agire sulle voci di un
  altro giorno. Solo un trascinamento in corso si lascia finire.
- Documenti: PUNTO §3 "Inserimento retroattivo".
- Test nuovi (4 sul hook con l'orologio finto, mezzanotte e ritorno in
  primo piano; 5 sulla pagina, compresi sheet, Sposta e menu aperti),
  provati a vuoto rompendo il codice da una copia. 590 test verdi in 54
  file.
- **Non ancora provato su iPhone**: va provato l'11/10 mattina sull'app
  installata (rientro il giorno dopo, con un foglio aperto che deve
  chiudersi). Le altre parti del branch sono provate il 10/10 (voci 1 e
  2 sotto).

## 2026-10-10 — Diario fino a 7 giorni, 2: Elimina e Rinomina "da oggi"

Branch `diario-futuro`. Con le voci nei giorni futuri, "da oggi" in Pasti
e orari vuol dire da oggi in poi.

- Rinomina "da oggi": passano al pasto nuovo anche le voci dei giorni
  futuri, non solo quelle di oggi; il suo Annulla le riporta tutte
  (`vociDaRiportare` ora ha `dal` invece di `data`: vive solo in memoria,
  nella barra, verificato prima di cambiarlo).
- Elimina "da oggi": cancella anche le voci future; conferma, barra e
  Annulla le contano e le ricreano, ciascuna nel suo giorno. Testi: "di
  oggi" se sono tutte di oggi, "da oggi in poi" se ce ne sono di future
  ("ha 3 voci in 3 giorni, da oggi in poi, per 156 kcal").
- Chiuso il difetto aperto dal commit 1 (PUNTO §11). Documenti: PUNTO §3
  "Pasti e orari" ed "Elimina pasto".
- Test nuovi (4 in `modifichePasti`, 2 nella pagina), provati a vuoto
  rompendo il codice da una copia. 581 test verdi in 53 file.
- Provato su iPhone il 10/10 (Safari, anteprima, account di prova),
  verificato da Claude su Supabase: Rinomina "da oggi" con e senza
  Annulla (voci di oggi e di lun 12 spostate sul pasto nuovo, quelle di
  ieri rimaste sul vecchio); Elimina "da oggi" con la conferma "in N
  giorni, da oggi in poi" e Annulla che ricrea il pasto e le voci future.

## 2026-10-10 — Diario fino a 7 giorni, 1: navigazione e inserimento

Branch `diario-futuro`. Decisione del 10/10: il diario accetta anche i
giorni futuri, fino a oggi + 7 incluso (chi prepara i pranzi in anticipo
li registra subito nel giorno giusto). Primo commit: il limite e dove si
applica.

- `GIORNI_FUTURI_DIARIO` e `ultimoGiornoDiario` in `dataGiorno.ts`, una
  costante sola; `dataScrivibile` arriva fino a lì invece che a oggi.
- Oggi: freccia avanti, swipe e calendario fino a oggi + 7; `?giorno=`
  accettato fino al limite. Aggiungi: `?giorno=` futuro accettato, propone
  il primo pasto vuoto (non l'ora) e lascia `consumato_alle` vuoto, come
  sui giorni passati. Duplica: `max` e controllo fino al limite, messaggio
  "Scegli un giorno fino a mar 13 ott.".
- Difetto corretto (c'era già): il calendario di Oggi accettava una data
  digitata oltre il `max`; aperto Aggiungi da lì, la voce finiva su oggi
  senza dirlo. Ora la data fuori limite si ignora.
- Lasciato aperto, per il prossimo commit dello stesso branch: Elimina e
  Rinomina "da oggi" toccano solo le voci di oggi, non quelle future
  (PUNTO §11, "Difetti e verifiche aperti").
- Documenti: PUNTO §3 "Inserimento retroattivo", Duplica, swipe.
- Test nuovi o riscritti (`dataGiorno`, `SheetDuplica`, `vociDiario`,
  pagine Oggi e Aggiungi), ciascuno provato a vuoto rompendo il codice da
  una copia. 575 test verdi in 53 file.
- Provato su iPhone il 10/10 (Safari, anteprima, account di prova),
  verificato da Claude su Supabase: navigazione fino a oggi + 7 (freccia,
  swipe, calendario); Aggiungi su un giorno futuro (primo pasto vuoto
  proposto, `consumato_alle` vuoto); Duplica fino a sab 17 ott e spento
  oltre.

## 2026-10-09 — Elimina pasto unito a main

Provato il 9/10 (voci sotto: un giro per volta, 4b, 4c) e unito a main con fast-forward da
`abcfcc1` a `11f1a2a`, senza commit di merge: `1af4a7b` (sincronizzazione
un giro per volta), `b498ba1` (regole, scritture e Annulla), `0e0fb86`
(la pagina), `11f1a2a` (i documenti, provato su iPhone il 9/10). Branch
`elimina-pasto` cancellato, in locale e su GitHub. Deploy di produzione
riuscito. 565 test verdi in 53 file. Voce scritta il 10/10 con il primo
commit del branch successivo, per non fare un commit su main solo per il
changelog.

## 2026-10-09 — Elimina pasto, passo 4c: la pagina

Branch `elimina-pasto`. Terzo commit del passo 4: l'interfaccia, sulla
logica del 4b.

- "Elimina pasto" in fondo allo sheet del pasto: spento con il motivo se
  è l'unico pasto. Domanda "da quando" (Da oggi già scelto; "Anche nei
  giorni passati" spento se lascerebbe un buco nel passato; nessuna
  domanda per un pasto nato oggi). Conferma solo se tocca voci, con voci,
  giorni e kcal, pulsante rosso, senza "Non si può annullare". Barra
  "Eliminato: …" con Annulla; un Annulla in conflitto dice perché.
- `SheetDaQuando`: il testo del pulsante può dipendere dalla scelta
  ("Continua" se segue la conferma, "Elimina pasto" se no).
- Difetto trovato da un test instabile (1 volta su 3) e corretto: appena
  aperto lo sheet, la lettura delle voci era per un attimo quella di
  prima ("nessuna voce"), e un tocco veloce su Elimina saltava la
  conferma (i dati erano salvi: la scrittura rispondeva "cambiate", ma
  compariva un avviso senza senso). Ora la lettura porta l'id del pasto e
  Elimina resta spento finché non è quella giusta; test deterministico.
- Documenti: PUNTO §3 "Elimina pasto", §9.2 il limite noto del seed
  chiuso, §11 con il rischio della riga riportata in vita da un altro
  telefono fra i difetti aperti.
- Test della pagina (7 nuovi), provati a vuoto da copia. 565 test verdi
  in 53 file.
- Provato su iPhone il 9/10 (Safari privato, anteprima, account di
  prova): da oggi senza voci (Spuntino pomeriggio) e con voci (Cena,
  conferma con 1 voce); pasti eliminati assenti da Aggiungi, Sposta,
  Duplica e trascinamento oggi e presenti ieri; "Anche nei giorni
  passati" su Pranzo (conferma con 13 voci) + Annulla; Colazione da oggi
  + Annulla; pasto nato oggi senza domanda + Annulla; tema scuro.
  Verificato su Supabase da Cowork: Pranzo ricreato con id v5 e le sue
  13 voci; prova offline su Spuntino mattina (eliminato e annullato in
  modalità aereo) arrivata corretta, pasto vecchio e voce cancellati,
  pasto ricreato vivo con la sua voce.

## 2026-10-09 — Elimina pasto, passo 4b: regole, scritture e Annulla

Branch `elimina-pasto`. Secondo commit del passo 4: solo `lib`, nessuna
schermata ancora.

- `controlliPasti.ts`: `periodoCoperto` (ogni giorno di un periodo ha
  almeno un altro pasto vivo) e `regoleElimina`: pulsante spento se da
  oggi qualche giorno resterebbe senza pasti ("È l'unico pasto…"),
  "Anche nei giorni passati" spento se resterebbe un buco nel passato,
  nessuna domanda per un pasto che comincia oggi o dopo
  (`iniziaOggiODopo`, ora usata anche dalla rinomina).
- `modifichePasti.ts`: `eliminaPasto` in una transazione. "Tutto":
  `deleted_at` sul pasto e su tutte le sue voci vive; "oggi": pasto chiuso
  ieri e voci vive di oggi cancellate; `giorni` intatta. Se le voci non
  sono più quelle confermate risponde "cambiate" senza scrivere.
  Riepilogo voci / giorni / kcal con `totaleVoce`.
- Annulla: "tutto" ricrea il pasto con id v5 dall'id vecchio e le voci
  su di lui (`annullaOperazione` con il nuovo `pastoSostituito`); "oggi"
  rimette la data di fine e ricrea le voci di oggi. Rifà i controlli di
  nome e ora: in conflitto non scrive niente e dice perché. Mai una riga
  rimessa in vita.
- Test permanenti, tutti provati a vuoto (13 rotture da copia): 558 test
  verdi in 53 file.
- Provato su iPhone il 9/10 con le prove del passo 4c: gli Annulla di
  Pranzo e di Spuntino mattina (anche offline) hanno ricreato sul server
  il pasto con id v5 e le sue voci.

## 2026-10-09 — Sincronizzazione: un giro per volta

Branch `elimina-pasto`. Primo commit del passo 4 di "Pasti e orari"
(Elimina pasto); da utente non cambia niente.

- Difetto trovato preparando il passo: ogni scrittura faceva partire un
  giro di sincronizzazione suo. Dentro una transazione i giri aspettavano
  tutti il commit e poi lavoravano in parallelo, ognuno con tutta la
  coda: 14 scritture (un pasto e 13 voci) = 196 invii invece di 14.
  Nessun dato perso, ma rete e batteria sprecate. Succedeva già con
  Duplica di un pasto intero.
- `sincronizzaOutbox`: se un giro è in corso, la chiamata ne prenota uno
  solo dopo, condiviso; chi aspetta (Esci) riceve la fine del giro che ha
  visto le sue voci. Vale anche per `online` e il ritorno in primo piano.
- Test permanente `sincronizzaUnaPerVolta.test.ts` (14 scritture = 14
  invii, mai due invii in parallelo, il giro prenotato manda le voci
  arrivate dopo, `online` in fila), provato a vuoto: togliendo la regola
  conta 196 invii. Anche dopo un giro fallito (eccezione imprevista o
  rete caduta) la chiamata dopo e il giro prenotato partono: togliendo il
  rilascio, il giro prenotato si richiama da solo e il processo muore.
  532 test verdi in 53 file.
- Provato su iPhone il 9/10 con le prove del passo 4c: Pranzo con 13
  voci e la prova offline arrivati al server corretti, coda vuota.

## 2026-10-09 — Pasti e orari unita a main

Provata il 9/10 (voci 3a–3c sotto) e unita a main con fast-forward da
`66c25f1` ad `abcfcc1`, senza commit di merge: `b99779c` (coda con i
genitori prima dei figli), `9d77429` (controlli, scritture e Annulla),
`a2e9b59` (la pagina), `abcfcc1` (i documenti). Branch `pagina-pasti`
cancellato, in locale e su GitHub. Deploy di produzione riuscito. 525
test verdi in 52 file.

## 2026-10-09 — Pasti e orari, passo 3c: la pagina

Branch `pagina-pasti`. Terzo commit del passo 3: la pagina
`/impostazioni/pasti`, che usa la logica del commit 3b.

- Riga "Pasti e orari · 5 pasti" in Impostazioni, fra Obiettivi e Peso;
  rotta in `PAGINE_APP` del service worker.
- Elenco dei pasti di oggi; `SheetPasto` (Nome, "Inizia alle", nessuna
  ora proposta per un pasto nuovo) e `SheetDaQuando` (Da oggi già
  scelto come nel mockup; una scelta che violerebbe i controlli è spenta
  con il motivo). Barra con Annulla dopo ogni scrittura.
- `RigaImpostazioni` accetta `onClick` (riga-pulsante). Campi ora con le
  stesse regole CSS dei campi data per Safari (`campiData.test.ts`).
- Aggiungi: prima di scrivere una voce ricontrolla che il pasto valga
  quel giorno (`pastoValidoAdesso`).
- Documenti: PUNTO §3 "Pasti e orari", §4 chiuso il dubbio sull'upsert
  senza chiavi (nessun client vecchio, la pagina scrive sempre le date),
  §11.
- Test della pagina (7) e della guardia, provati a vuoto. Corretto un
  test instabile scritto in questo commit: cercava "Annulla" mentre lo
  sheet era ancora aperto e a volte toccava quello dello sheet invece
  di quello della barra. L'app non aveva il problema. 525 test verdi in
  52 file.
- Provato su iPhone il 9/10 (Safari privato, anteprima, account di
  prova), tutte le 11 prove ok: riga in Impostazioni, solo ora, ora
  occupata, Correggi, Da oggi con voci e Annulla, pasto nato oggi senza
  domanda, Indietro, nomi, Aggiungi nei due modi e con il nome di un
  pasto chiuso, tema scuro. Prova offline (Cena → Cena 1 da oggi, poi
  ora cambiata, poi online) verificata su Supabase da Cowork: Cena
  chiusa all'8/10, Cena 1 dal 9/10 con la voce di oggi, coda vuota,
  nessuna voce accantonata.

## 2026-10-09 — Pasti e orari, passo 3b: controlli, scritture e Annulla

Branch `pagina-pasti`. Secondo commit del passo 3: solo `lib`, nessuna
schermata ancora.

- `controlliPasti.ts`: nome (spazi tolti, non vuoto, senza distinguere
  maiuscole) e ora (`HH:mm`) diversi da ogni altro pasto vivo con
  almeno un giorno in comune, non solo oggi. Se il pasto che occupa
  l'ora oggi non c'è, il messaggio lo dice ("iniziava già Merenda
  (fino all'8 ott)"). "Da quando" si chiede solo per un nome nuovo
  davvero, su un pasto nato prima di oggi.
- `modifichePasti.ts`: Correggi (anche la sola ora), rinomina da oggi
  in una transazione Dexie (riga vecchia chiusa ieri, riga nuova da
  oggi con lo stesso `ordine`, voci vive di oggi spostate), Aggiungi
  (da sempre o da oggi, `ordine` dopo tutte le righe). Ogni scrittura
  rifà i controlli e scrive le date in modo esplicito. L'ora si
  controlla solo se cambia: dati vecchi con due pasti alla stessa ora
  non bloccano la correzione del nome.
- Annulla con una fotografia, in una transazione, senza mai rimettere
  in vita una riga. Da oggi: riporta anche le voci aggiunte nel
  frattempo al pasto nuovo. Aggiungi: se il pasto ha già voci non
  cancella niente.
- Test permanenti (`controlliPasti.test.ts`, `modifichePasti.test.ts`),
  tutti provati a vuoto rompendo la regola che controllano. 515 test
  verdi in 51 file.

## 2026-10-09 — Coda di sincronizzazione: i genitori prima dei figli

Branch `pagina-pasti`. Primo commit del passo 3 di "Pasti e orari"; da
utente non cambia niente.

- Bug trovato preparando la pagina: la coda partiva in ordine di
  `creato_il`, ma riscrivere una riga già in coda le dà un `creato_il`
  nuovo. Un genitore corretto dopo i suoi figli (alimento creato offline,
  registrato, poi corretto; domani un pasto rinominato "da oggi" e poi
  ritoccato) partiva dopo di loro: il server rifiutava il figlio per la
  foreign key, la coda si fermava e dopo 5 giri il figlio veniva
  accantonato. Non verificabile dal server: le voci accantonate restano
  solo sul dispositivo (si vedono in Impostazioni > Sincronizzazione).
- `ordinaOutbox`: prima per livello della tabella (foreign key lette dal
  server il 9/10), poi `creato_il`, poi id.
- Le scritture del repository si possono fare dentro una transazione
  Dexie: la sync che fanno partire esce dalla transazione
  (`Dexie.ignoreTransaction`). Serve alla rinomina "da oggi".
- Test permanenti, provati anche a vuoto (falliscono togliendo la
  correzione): `sincronizza.test.ts` (server finto con la foreign key),
  `repository.transazione.test.ts`. 478 test verdi in 49 file.
- Nello stesso commit il mockup `docs/mockups/pasti-e-orari.html`.
- Provato su iPhone il 9/10 con la prova offline del passo 3c: pasto
  rinominato da oggi e poi ritoccato, voce di oggi arrivata sul server
  dopo il suo pasto, nessuna voce accantonata.

## 2026-10-09 — Validità dei pasti unita a main

Provata il 9/10 (voce 2b sotto) e unita a main con fast-forward da
`9f98e29` a `66c25f1`, senza commit di merge: `c0d5ac4` (schema),
`d3796d1` (i pasti del giorno in ogni schermata), `66c25f1` (i
documenti). Branch `validita-pasti` cancellato, in locale e su GitHub.
Deploy di produzione riuscito. 474 test verdi in 48 file.

## 2026-10-09 — Validità dei pasti, passo 2b: i pasti del giorno in ogni schermata

Branch `validita-pasti`. Secondo commit del passo 2. Da utente non cambia
niente finché nessuna riga ha le date.

- `validitaPasti.ts`: un pasto vale nel giorno D se non è cancellato e D
  sta nel suo periodo (confini inclusi). L'ordine segue l'orario
  (`ora_inizio` sui primi 5 caratteri), poi `ordine`, poi l'id.
- Ogni schermata usa i pasti del suo giorno: Oggi quello mostrato,
  Aggiungi quello in cui si registra, sheet e Sposta quello della voce,
  Duplica quello di destinazione (l'elenco cambia con la data; pasto
  d'origine assente quel giorno → "Scegli un pasto"). `duplicaNelPasto`
  rifiuta un pasto che quel giorno non esiste.
- Rete di sicurezza in Oggi: un pasto fuori periodo o cancellato con voci
  quel giorno si vede, con "Non più in uso", ma non riceve voci. Nello
  sheet della voce compare fra le opzioni, così il menu mostra sempre il
  pasto vero.
- Un giorno senza pasti validi mostra "Nessun pasto in questo giorno.",
  non più "Preparo i tuoi pasti…".
- Corretto un test instabile del passo 1 (`primoAvvioSenzaRete.test.tsx`):
  l'evento `online` partiva prima che la pagina lo ascoltasse. L'app non
  aveva il problema.
- 474 test verdi in 48 file.
- Provato su iPhone il 9/10 (Safari privato, anteprima, account di
  prova). Tutto come prima: Oggi (oggi e giorno passato), Aggiungi,
  sheet, Sposta, trascinamento, Duplica, offline. Pasto "Prova validità"
  con date scritte via SQL: con `valido_dal` = 9/10 compare oggi e non
  ieri, e in Duplica segue la data; spostato al 10/10 con una voce oggi,
  resta visibile con "Non più in uso", totali coerenti, non è
  destinazione di Sposta, Aggiungi, Duplica né trascinamento, il menu
  della voce dice "· non più in uso"; eliminata la voce, sparisce. Riga
  poi cancellata in modo logico.

## 2026-10-09 — Validità dei pasti, passo 2a: schema e prova degli aggiornamenti Dexie

Branch `validita-pasti`. Passo 2 di "Pasti e orari", primo commit: solo
schema, nessun cambiamento visibile.

- `pasti` ha due campi nuovi, `valido_dal` e `valido_al` (date, null = da
  sempre / per sempre). Su Dexie: `version(6)` con gli stessi indici e
  senza `.upgrade` (campi facoltativi nel tipo). Migration Supabase
  `pasti_validita` applicata il 9/10 (da Cowork): schema confrontato con
  `tipi.ts`, advisors invariati.
- Checklist B.7 eseguita davvero, con un test permanente
  (`aggiornamentoSchema.test.ts`): database alla `version(3)`, `(4)` e
  `(5)` con righe in tutte le tabelle, compresa la coda outbox, riaperto
  dall'app nuova. Righe identiche, indici funzionanti. Era rimandata dal
  26/9 per la 4 e la 5.
- Verificato nello stesso test: una seconda scheda rimasta alla versione
  vecchia non blocca la nuova e continua a funzionare (Dexie la chiude e
  la riapre da solo).

## 2026-10-09 — Seed dei pasti unito a main

Provato il 9/10 (voce sotto) e unito a main con fast-forward da `aae7ad5`
a `9f98e29`, senza commit di merge: `dde2bf9` (la correzione) e `9f98e29`
(i documenti). Branch `seed-pasti` cancellato, in locale e su GitHub.
Deploy di produzione riuscito. 440 test verdi in 45 file.

## 2026-10-07 — Seed dei pasti predefiniti solo con il server vuoto

Branch `seed-pasti`. Passo 1 di "Pasti e orari".

- I 5 pasti predefiniti si creano solo se la lettura dal server riesce e
  il server non ha nessuna riga in `pasti` per l'utente, nemmeno
  cancellata. Il conteggio non è incrementale (`contaRigheSulServer`):
  con il cursore già avanti la discesa riceve 0 righe anche a server pieno.
- Bug chiusi: un pasto cancellato che resuscitava (aperto dal 25/9) e un
  pasto rinominato che tornava al nome di fabbrica (trovato oggi). Tutti e
  due solo su un dispositivo vuoto con la lettura fallita.
- Costo: al primo avvio senza rete Oggi e Aggiungi mostrano "Serve la
  connessione" con "Riprova", e riprovano da sole quando torna la rete.
  Prima c'era "Preparo i tuoi pasti…" all'infinito.
- Limite noto, non gestito: un utente con sul server solo pasti cancellati
  resta su "Preparo i tuoi pasti…".
- 440 test verdi in 45 file.
- Provato su iPhone il 9/10, sull'anteprima del branch. Da computer, con
  l'account di prova: IndexedDB cancellato e rete spenta → "Serve la
  connessione"; con la rete accesa i pasti arrivano da soli; "Riprova"
  funziona in tutti e due i casi. Su iPhone (Safari privato con l'account
  di prova, app installata con l'account vero anche in modalità aereo,
  "Ricarica i dati") tutto come prima, il riquadro non compare mai.

## 2026-10-06 — Tieni premuto (passi A–E) provato su iPhone, unito a main

Giro di prove completo su iPhone, sull'anteprima del branch `duplica`,
che contiene tutti i passi A→E con le loro correzioni. Tutto ok:
- il gesto a due rami;
- menu ed Elimina con Annulla, anche dopo la sync;
- Sposta con i doppioni;
- trascinamento con scorrimento automatico;
- Duplica con "Vedi";
- e, nello stesso giro, inserimento, Impostazioni, tema scuro e offline.

Uniti a main con fast-forward da `e591e41`, senza commit di merge. Erano
8 commit, da `41d0ef1` (passo A) a `c79bdb6` (correzioni del passo E),
più questa voce. Branch `tieni-premuto`, `menu-elimina`, `sposta-menu`,
`trascina` e `duplica` cancellati, in locale e su GitHub. 432 test verdi
in 44 file.

## 2026-10-06 — Correzioni dopo le prove del passo E: barra e campo data

Branch `duplica`. Tre problemi visti su iPhone, con gli screenshot.

- **Nome che spariva nella barra** ("Duplicato:  in Pranzo di lun 5").
  - Il nome non era vuoto: nella pagina c'era. Il testo della barra stava
    su una riga che non andava mai a capo, e solo il nome poteva
    restringersi: con "Vedi" e "Annulla" accanto si riduceva a larghezza
    zero.
  - La stessa causa tagliava la coda, che finiva sotto i pulsanti (il
    problema 2).
  - In più le parti erano separate solo da spazio grafico: uno screen
    reader leggeva "Duplicato:Melain Pranzo".
  - Ora il testo è una frase con spazi veri, che va a capo. Il nome si
    accorcia con "…" solo se da solo è più lungo di una riga, e i
    pulsanti non si restringono mai.
  - Controllati tutti i messaggi di Sposta e Duplica, per alimento e per
    pasto intero: stessa causa, stessa correzione.
- **Foglio Duplica più largo dello schermo:** Safari dà al campo data una
  larghezza minima sua. Ora:
  - tutti i campi data hanno `min-width: 0` e `max-width: 100%`;
  - quelli a tutta larghezza (Duplica, cambio di obiettivo) tolgono anche
    il controllo nativo;
  - il foglio Duplica non scorre più in orizzontale.
  Gli altri campi data dell'app: la data di nascita in Profilo e il
  calendario nascosto di Oggi tengono il loro aspetto.
- **Test:**
  - la pagina Oggi controlla il testo intero della barra, nome compreso,
    in 5 casi: Elimina, Sposta di un alimento, Sposta di un pasto,
    Duplica di un alimento e di un pasto su ieri. Due test sono nuovi;
  - 3 test sulla disposizione della barra e 4 sui campi data, che
    controllano le regole perché jsdom non misura i pixel.
- **Verifica dei test:**
  - con la barra com'era falliscono 7 test;
  - con il nome tolto dal messaggio fallisce il test di Duplica;
  - con ognuna delle 4 regole dei campi data tolta fallisce il test
    corrispondente.
  - Un test della disposizione (pulsanti fuori dal testo e che non si
    restringono) passa anche col codice di prima: quella parte era già
    giusta, ed è lì per tenerla così.

## 2026-10-06 — Duplica, con giorno e pasto (passo E)

Branch `duplica`, partito da `trascina`. Il passo D, con lo scorrimento
automatico e i bordi, è stato provato su iPhone, tutto bene.

- **Menu:** voce "Duplica" fra Sposta ed Elimina; sul pasto solo se ha
  alimenti.
- **Foglio:**
  - giorno: campo data con massimo oggi, parte dal giorno guardato, e la
    data si ricontrolla nel codice contro `oggiLocale`, non UTC;
  - pasto: parte da quello d'origine;
  - Duplica resta spento finché manca uno dei due.
- **Regola nuova:** le righe che si duplicano non sono mai doppioni di se
  stesse. La Mela duplicata nel suo stesso pasto diventa una seconda riga,
  senza foglio dei doppioni. Il foglio si apre solo per un'ALTRA riga
  dello stesso alimento, e Somma o Scrivi quantità toccano quella, mai
  l'originale.
- **Copie:** stessi `alimento_id` e valori della voce originale; un
  `gruppo_id` nuovo per un pasto intero; `creato_il` adesso;
  `consumato_alle` come in /aggiungi. Il giorno di destinazione si
  classifica (`garantisciGiornoPerPrimaVoce`). Annulla toglie le copie e
  rimette com'erano le righe sommate o scritte a mano.
- **Messaggi:** "Duplicato: Mela in Pranzo", con "di lun 5 ott" se il
  giorno è diverso. Se tutto è escluso, "Nessuna copia: …", senza
  "Duplicato" e senza Annulla.
- **Barra:** un secondo tasto facoltativo, "Vedi", solo per un giorno
  diverso. Porta a quel giorno; la barra resta con Annulla per il tempo
  che le resta, e "Vedi" sparisce.
- **Test:**
  - 12 sul piano: l'originale mai toccato con nessuna delle 4 scelte; la
    stessa riga non è doppione di se stessa; com'è fatta la copia;
  - 4 su date e giorno corto (compresa mezzanotte passata);
  - 4 sul foglio (massimo dopo mezzanotte, data futura digitata a mano);
  - 4 sui messaggi;
  - 4 su Dexie (giorno classificato e Annulla che toglie solo le copie,
    stessa riga nello stesso pasto, Somma su un'altra riga, giorno futuro
    rifiutato);
  - 1 sulla pagina: Duplica su ieri, "Vedi", Annulla.
- **Verifica dei test:** 16 rotture apposta, tutte prese.
  - Fuso orario dei test fissato a `Europe/Rome` in `vitest.config.mts`:
    i test sulla mezzanotte ora dimostrano qualcosa su qualsiasi computer.
    Verificato con la shell in UTC: `dataScrivibile` in UTC viene preso.
    Senza il fuso fissato, la stessa rottura passava inosservata.
  - Contrasto di "Vedi" (`--testo-capsula` sul vetro, senza capsula)
    aggiunto a `contrasti.test.ts`: da 5,74:1 (verde, chiaro) in su, per
    tutti i colori in chiaro e in scuro.
  - Trovato strada facendo: il blocco dei click dopo un trascinamento
    restava acceso fra un test e l'altro e si mangiava il primo click del
    test dopo. I test di trascinamento ora aspettano che scada.

## 2026-10-06 — Trascinamento: scorrimento automatico e bordi dentro i pasti

Branch `trascina`. Due ritocchi dopo la prova del passo D su iPhone, che
funzionava.

- **Scorrimento automatico** durante il trascinamento. Cambia la decisione
  2 del 6/10: con molti pasti, quelli fuori schermo non si raggiungevano.
  - In alto e in basso nella lista visibile c'è una fascia di 64 px;
    quella in basso sta sopra "+ Aggiungi" e la pillola.
  - Più il dito è vicino al bordo, più si va veloci, fino a 800 px/s; ci
    si ferma fuori dalla fascia o a fine corsa.
  - Il pasto sotto il dito si ricalcola mentre la lista scorre, anche a
    dito fermo.
  - Vale anche con "Riduci movimento".
  - Un fotogramma lento (l'app che torna dal background) conta al massimo
    50 ms, così la lista non salta.
- **Bordi dei pasti bersaglio:** prima erano un outline appena fuori dal
  riquadro, e fra due pasti vicini si sovrapponevano (Colazione e Spuntino
  mattina). Ora sono un riquadro disegnato dietro al contenuto: in
  verticale sta dentro il pasto, a 4 px dal bordo; ai lati sporge di 8 px
  nel margine della lista, perché il testo arriva al bordo del pasto. Lo
  stesso per l'evidenziazione del pasto sotto il dito. Niente si sposta.
- **Test:**
  - 6 sulle funzioni pure dello scorrimento: fasce, velocità crescente e
    massima, fine corsa, fotogramma lento, bersaglio che cambia mentre la
    lista scorre;
  - 1 sulla pagina: dito fermo nella fascia bassa, la lista scorre, il
    pasto sotto il dito cambia e il rilascio sposta lo yogurt;
  - 2 sul CSS dei bordi (niente outline, riquadro che rientra in
    verticale), perché jsdom non disegna.
- **Verifica dei test:** 10 rotture apposta, tutte prese.

## 2026-10-06 — Trascinare un alimento o un pasto su un altro pasto (passo D)

Branch `trascina`, partito da `sposta-menu`. Il passo C è stato provato su
iPhone, tutto bene.

- **Copia che segue il dito**, non la riga vera. La lista dei pasti è un
  contenitore con `overflow-y: auto`, che taglia in ogni direzione; i
  riquadri dei pasti invece non tagliano niente. La copia sta in un
  portale su `document.body`, `position: fixed`, mossa con `transform`
  scritto sull'elemento. Per un pasto intero è compatta ("Pranzo · 3
  alimenti").
- **Durante il trascinamento:**
  - l'originale resta spento (la riga, oppure tutto il pasto);
  - gli altri pasti hanno il bordo tratteggiato, anche quelli chiusi;
  - quello sotto il dito è in accento;
  - lista ferma, swipe spento.
- **Rilascio:**
  - su un altro pasto: il flusso di Sposta (foglio dei doppioni, messaggio,
    Annulla);
  - altrove, sul pasto di partenza, sopra "+ Aggiungi" o la pillola,
    oppure gesto interrotto dal sistema: niente si scrive, e la copia
    torna indietro (con "Riduci movimento" sparisce subito);
  - dopo il rilascio un click fantasma viene fermato in tutta la pagina.
- **Riorganizzazione:**
  - l'hook del gesto passa da `onLasciato` (mai usato) a inizio /
    movimento / fine del trascinamento;
  - `movimentoRidotto()` è in un modulo suo, condiviso con lo swipe;
  - lo stato di uno spostamento è un tipo (`StatoSpostamento`), passato
    come parametro, così menu e trascinamento usano la stessa funzione.
- **Test:**
  - 6 sulle decisioni pure (pasto sotto il dito, partenza esclusa, fuori,
    sopra le barre, parte scorsa sotto la testata, confine fra due pasti);
  - 3 sulla pagina (rilascio su un doppione apre il foglio, rilascio
    fuori, gesto interrotto): nessuno dei tre deve scrivere niente.
- **Verifica dei test:** 9 rotture apposta, tutte prese. Una in principio
  passava lo stesso: il test controllava "nessun foglio" subito dopo il
  rilascio, ma un foglio aperto per errore arriva dopo una lettura da
  Dexie. Ora il test aspetta mezzo secondo prima di dirlo.

## 2026-10-06 — Sposta dal menu, con il foglio dei doppioni (passo C)

Branch `sposta-menu`, partito da `menu-elimina`. La correzione del menu
(tocco fuori) è stata provata su iPhone, tutto bene. Deciso oggi: niente
merge intermedi, i passi A–E arrivano su main tutti insieme alla fine.

- **Menu:** voce "Sposta" (alimento e pasto), sopra Elimina. Apre
  l'elenco dei pasti del giorno, escluso quello di partenza.
- **Doppioni:** stesso alimento del catalogo nel pasto di destinazione.
  - Una scelta per alimento, come nel mockup approvato il 5/10. Ogni
    alimento ha il suo blocco: quantità ("Pranzo 100 g · Cena 50 g"), la
    sua griglia 2×2 (Somma già scelta e col totale, Tieni separati, Scrivi
    quantità col campo, Non spostarlo) e la riga di esito ("→ Una riga da
    150 g"…).
  - "Per salvare mancano: …" sotto il bottone.
  - La prima versione aveva una scelta sola per tutto il foglio: era una
    mia interpretazione, corretta prima del commit.
  - Annulla o tocco fuori: niente scritto.
- **Alla conferma** si rileggono le righe da Dexie. Se nel frattempo i
  doppioni sono cambiati, non si scrive niente e il foglio si riapre con
  un avviso. Le scritture passano dalla fotografia del passo B: "Annulla"
  riporta anche i grammi sommati o scritti a mano.
- **Messaggi:** i 5 casi della specifica, mai "Spostato" se non si è mosso
  niente. Nella barra si accorciano con "…" i nomi degli alimenti (oltre
  22 caratteri, o troncati dalla barra) e dei pasti (oltre 16); verbo,
  parole di senso e numeri restano interi.
- **Test:**
  - 13 sul piano (le 8 regole e i dettagli) e 11 sui testi, comprese le
    righe di esito;
  - 2 sullo spostamento in Dexie: Somma poi Annulla, e doppioni cambiati
    prima della conferma;
  - 3 sulla pagina Oggi:
    - due doppioni con due scelte diverse (Somma e Non spostarlo), poi
      Annulla; fallisce se la stessa scelta si applica a tutti;
    - Scrivi quantità vuoto;
    - foglio chiuso senza scritture.
- **Verifica dei test:** ogni regola è stata rotta apposta (18 rotture).
  Una è passata lo stesso, perché il test dell'arrotondamento usava 80,1 +
  19,2, che in JavaScript fa esattamente 99,3; ora usa 10,1 + 20,2.

## 2026-10-06 — Correzione: dopo un tocco fuori dal menu la lista si bloccava

Branch `menu-elimina`. Le prove su iPhone del passo B sono ok (1–9),
tranne questo bug: tieni premuto, si apre il menu, tocco fuori per
chiuderlo. Da lì la lista non scorreva più e il tieni-premuto non
riapriva il menu, fino a ricaricare la pagina.

- **Causa:** il menu compare sotto il dito ancora appoggiato, e la fine di
  quel tocco può non arrivare alla lista. Il gesto restava "aperto": ogni
  `touchmove` bloccato, lista con `overflow-y: hidden`, ogni tocco nuovo
  scartato come "secondo dito". In jsdom, con la fine del tocco
  consegnata, tutto si chiudeva bene: il blocco nasce solo quando la fine
  manca. Resta non spiegato dal codice perché con "Elimina" non
  succedesse. L'unica differenza nostra era il fuoco che tornava sulla
  riga, tolto anche quello.
- **Correzione:**
  - il gesto finisce appena si decide il menu;
  - una sola chiusura del menu, `chiudiMenu`, rilascia anche il dito;
  - un nuovo dito primario chiude un gesto rimasto aperto, nel
    tieni-premuto e nello swipe;
  - il fuoco si sposta solo per un menu aperto da tastiera o tasto destro.
- **Secondo bug, trovato da un test che falliva a caso:** un timer
  scattato 0,2–0,3 ms prima della scadenza lasciava il gesto fermo, cioè
  la riga non si sollevava o il menu non si apriva finché il dito non si
  alzava. Ora il timer si riprogramma.
- **Test:**
  - 2 sulla pagina Oggi (tocco fuori, senza e con la fine del tocco): col
    codice di prima il primo fallisce;
  - 3 sull'hook, con orologio finto (gesto vecchio chiuso da un dito
    nuovo, secondo dito ignorato, timer in anticipo);
  - ognuno verificato rompendo apposta la correzione;
  - il file della pagina è passato 10 volte di fila senza errori.

## 2026-10-06 — Menu contestuale, Elimina e Annulla generale (passo B)

Branch `menu-elimina`, partito da `tieni-premuto`. I due branch arrivano su
main insieme. Il passo A è stato provato su iPhone il 6/10, tutto bene,
compreso lo scroll partendo da una riga con `touch-action: pan-y`.

- **Menu contestuale**: si apre sotto la riga o sopra, mai sotto
  "+ Aggiungi" e la pillola. Per ora ha solo "Elimina" ("Elimina tutto il
  pasto" sul pasto): Sposta e Duplica compaiono quando funzionano. Tolti i
  segnaposto "Prova gesto" del passo A; il trascinamento per ora non fa
  niente.
- **Elimina** con "Annulla": "Eliminato: Mela", "Eliminato: Pranzo (3
  alimenti)". Anche "Elimina" nello sheet quantità ora mostra la stessa
  barra con "Annulla"; prima cancellava senza modo di tornare indietro.
  Tolta la sua conferma "No / Sì, elimina": come dal menu, un tocco
  elimina e Annulla rimedia.
- **Annulla generale** (fotografia, scrittura solo in avanti): le righe
  cancellate si ricreano con un id nuovo, deterministico. Rimettere
  `deleted_at = null` le avrebbe fatte sparire di nuovo se la
  cancellazione era già sul server. "Aggiunto — Annulla" passa alla stessa
  fotografia, comportamento invariato (i suoi 4 test restano).
- Evitato in partenza: il click del dito che ha aperto il menu, alzandosi,
  poteva chiuderlo subito o eseguire "Elimina". Sfondo e voci rispondono
  solo a un tocco cominciato dopo l'apertura.
- Test nuovi: 7 sull'Annulla, 5 sulla posizione del menu, 1 sul testo, 1
  sulla pagina Oggi (Elimina dallo sheet → Annulla → voce identica).
  Ognuno verificato rompendo apposta la logica.

## 2026-10-06 — Tieni premuto in Oggi: il gesto a due rami (passo A)

Branch `tieni-premuto`. Primo dei cinque passi di "Tieni premuto: sposta,
duplica, elimina" (specifica e decisioni in `PUNTO_DI_PARTENZA.md`,
sezione 3). Arriva su main insieme al passo B (`menu-elimina`), perché qui
il menu è ancora un segnaposto.

- **Gesto** su alimento e nome del pasto (non sul pasto vuoto): 450 ms
  fermo solleva la riga, poi 160 ms decidono fra trascinamento (il dito si
  muove oltre 8 px) e menu (fermo, o rilasciato). Per ora i due rami
  mostrano solo un messaggio di prova nella barra.
- **Convivenza con lo swipe**: 8 px stanno sotto i 10 a cui lo swipe
  decide; dal sollevamento il dito è "rivendicato" e lo swipe lo lascia.
  `touch-action` resta `pan-y` (con `none` la lista non scorrerebbe dalle
  righe), da confermare su iPhone.
- **contextmenu** (tasto destro, tastiera, Android) apre il menu, ma non
  durante un gesto né nei 400 ms dopo: trovato rileggendo il codice che
  alcuni Chrome lo mandano a dito alzato, e il menu si sarebbe aperto due
  volte. Non provato su Android.
- Regole pure in `decisioneTieniPremuto.ts`, 20 test, verificati
  rompendo apposta la logica. Il vincolo "tolleranza sotto la soglia dello
  swipe" è un test, non un controllo nel codice dell'app.

## 2026-10-03 — Colore principale e barra provati su iPhone, uniti a main

I due commit del branch `accento` (`1f433a7` colore principale,
`c04eb6f` barra dei messaggi) sono stati provati su iPhone, tutto bene.
Uniti a main con fast-forward, senza commit di merge; branch `accento`
cancellato, in locale e su GitHub. Con questo la pagina Impostazioni è
completa (passi 1–6); Pasti e orari, Preferiti e pasti salvati e
l'indicatore di sincronizzazione restano lavori a sé.

## 2026-10-03 — Barra dei messaggi: durate più brevi, pausa che riprende

Branch `accento`. **Provato su iPhone il 3/10**: 3 s con Annulla, 2,5 s il
resto, pausa che riprende da dove era, tocchi ripetuti.

- **Durate** (`DURATE_BARRA`):
  - prima: 5 s con "Annulla", 4 s per le frasi, 2,5 s per le conferme;
  - ora: 3 s con "Annulla", 2,5 s per tutto il resto;
  - motivo: inserendo più alimenti di fila, 5 e 4 secondi erano troppi;
  - i messaggi non portano più una durata propria.
- **Pausa al tocco**: prima, dopo la pausa (dito o fuoco sulla barra),
  timer e linea ripartivano pieni. Un tocco per sbaglio allungava la barra
  e tocchi ripetuti la tenevano aperta.
  - Ora riprendono da quanto restava.
  - Il calcolo sta nelle funzioni pure di `tempoBarra.ts`, con test: pausa
    a metà, ripresa, più pause di fila. La barra resta visibile al massimo
    la durata più il tempo in pausa.
  - Timer e linea leggono lo stesso stato. La linea si ridisegna con un
    `animation-delay` negativo, quindi arriva a zero insieme al timer.
  - La pausa ora tiene conto di dito e fuoco insieme: riprende solo quando
    sono andati via tutti e due.

## 2026-10-03 — Impostazioni, passo 6: colore principale e grigio più scuro

Branch `accento`. **Provato su iPhone il 3/10**: quattro colori in chiaro
e scuro, riga Aspetto, grigio nuovo, avvio a freddo senza lampo verde,
offline, Safari privato.

- **Colore principale.** Aspetto ha un gruppo "Colore principale": Verde /
  Blu / Viola / Petrolio, applicato al tocco. La scelta è salvata in
  `localStorage` (`nutritrack:accento`); un valore sconosciuto vale verde.
- **Riga dell'elenco**: "Sistema · Verde".
- **Script del tema.** Lo stesso script in `<head>` scrive anche
  `data-accento`, con la nuova funzione autonoma `accentoEffettivo`. Il
  test esegue la stringa vera; senza script l'app è verde.
- **CSS.** Per ogni colore solo `--accento-chiaro` / `--accento-scuro`, una
  copia. Il blocco dei token vale anche su `[data-accento]`, così i derivati
  si ricalcolano sulle anteprime.
- **Grigio `--tenue`** in chiaro: `#78705f`, prima `#8a8271`.
- **Test.** Nuovo `contrasti.test.ts`, test permanente: calcola dal CSS
  vero i contrasti di ogni colore, in chiaro e in scuro, con soglia 4,5:1.
  Con il grigio vecchio diventa rosso. La lettura del CSS per i test è in
  `palettaCss.ts`.
- **offline.html** segue anche il colore; `CACHE_STATICI` passa a v5.
- **Colori fuori dalle variabili**: nessuno nell'app (Recharts non è
  ancora usato). Le icone e `manifest.json` non contengono il verde.
- **Mockup** `docs/mockups/colore-principale.html` aggiunto.

## 2026-10-03 — Tema provato su iPhone, unito a main

Il passo 5 di Impostazioni (`9500498`) è stato provato su iPhone, in Safari
e nell'app installata:
- Chiaro / Scuro / Sistema, e cambio dal Centro di controllo con "Sistema";
- avvio a freddo dell'app installata in tutti e due i versi, senza lampo;
- login in Scuro con i campi compilati in automatico, che chiude la verifica
  aperta in §11;
- offline con il tema scelto, Safari privato;
- sheet, date, tab bar e grafici.

Tutto bene. Unito a main con fast-forward, senza commit di merge; branch
`tema` cancellato, in locale e su GitHub.

## 2026-10-03 — Impostazioni, passo 5: la pagina Aspetto (tema)

Branch `tema`.

- Pagina `/impostazioni/aspetto`: Chiaro / Scuro / Sistema con tre
  anteprime come nel mockup, applicata subito al tocco (niente Salva né
  guardiano), con la nota sulla barra dell'ora nell'app installata.
  Elenco: riga Aspetto sopra Sincronizzazione, con la scelta a destra.
- Scelta in `localStorage` (`nutritrack:tema`, predefinito `sistema`),
  sempre in try/catch. Uno script in linea in `<head>` scrive
  `data-tema` su `<html>` prima del disegno e aggiorna `theme-color`; il
  suo testo è generato dalla funzione pura `temaEffettivo` (con test),
  quindi non c'è una seconda copia da tenere allineata. Regola: le due
  funzioni copiate restano autonome, niente import. Il test esegue proprio
  la stringa `SCRIPT_TEMA` in jsdom: con una funzione esterna in
  `temaEffettivo`, per prova, 4 casi diventano rossi.
- CSS: ogni colore scritto una volta con i due valori e gli interruttori
  `--se-chiaro` / `--se-scuro`; senza `data-tema` decide ancora il
  telefono. `color-scheme` segue il tema in uso. `temaScuro.test.ts`
  riscritto per la forma nuova.
- `offline.html` con gli stessi colori e la copia dello script, provata dal
  test sugli stessi casi dell'originale; `CACHE_STATICI` v4.
- Service worker: `/impostazioni/aspetto` in `PAGINE_APP`.
- Aggiunto `@types/jsdom` (solo tipi, dev): serve al test che fa girare lo
  script in una pagina finta.

**Bug trovato e corretto prima del commit:** lo script riscriveva il
`content` dei due `<meta name="theme-color">` della pagina; React, prendendo
in mano la pagina, non li riconosceva più e ne aggiungeva un terzo. Ora lo
script aggiunge un suo `<meta>` in testa e quelli della pagina restano
intatti.

## 2026-10-03 — Peso provato su iPhone, unito a main

Il passo 4 di Impostazioni (`edb1b83`) è stato provato su iPhone. Con
l'account di prova in Safari: riga e pagina senza pesate, "Vai a Peso",
pesata e sostituzione nello stesso giorno, Profilo senza "Registra peso",
offline. Con l'account vero nell'app installata: riga Peso corretta. Resta
da provare domani "stesso valore in un giorno nuovo" (già coperto dal
test), lasciato in §11. Unito a main con fast-forward, senza commit di
merge; branch `peso` cancellato, in locale e su GitHub.

## 2026-10-03 — Impostazioni, passo 4: la pagina Peso

Branch `peso`.

- Pagina `/impostazioni/peso`: in alto l'ultima pesata con la data
  ("85 kg · 2 ottobre", "Nessuna pesata registrata"), sotto "Registra
  peso", che salva subito. Niente storico: arriva con Statistiche. Il peso
  ha lo stesso formato ovunque: decimale solo se c'è.
- Profilo: tolto "Registra peso", restano i dati personali.
- Elenco: riga Peso sotto Obiettivi ("85 kg", "78,4 kg", "Da
  registrare"); come Obiettivi, vuota finché i dati non arrivano.
- Obiettivi: senza pesate, "Calcola proposta" rimanda a Peso ("Vai a
  Peso"), non più a Profilo.
- Testi da `testiPeso.ts` (`testoRigaPeso`, `testoUltimaPesata`), con il
  loro test (5 casi).
- Service worker: `/impostazioni/peso` in `PAGINE_APP`, commento datato
  in sw.js, test aggiornato.
- Nessun guardiano in Peso: non c'è un Salva, e un numero scritto e non
  registrato si riscrive in un attimo.

**Bug trovato e corretto:** registrare in un giorno nuovo lo stesso peso
dell'ultima pesata non scriveva niente, mentre il messaggio diceva
"Registrato … oggi", e una pesata stabile si perdeva (anche per il grafico
del peso). Veniva dal 6/9 (`4f11e08`), quando il peso partiva con ogni
"Salva obiettivo"; con "Registra peso" il motivo non c'è più. Regola
nuova: stesso giorno → sostituisce la pesata del giorno; giorno diverso →
si scrive sempre. `registraPesoSenzaDuplicati` ora rilegge Dexie invece di
ricevere l'elenco dalla pagina (stato React che può essere indietro), e
RegistraPeso non ha più la prop `misurazioniPeso`. Test nuovo
`misurazioni.test.ts` (4 casi); verificato che rimettendo la vecchia
regola fallisce proprio il caso "giorno diverso, stesso valore".

269 test. Aspetto controllato in Chrome a 390 px, chiaro e scuro, su una
pagina temporanea pubblica con dati finti, poi cancellata con la sua
eccezione nel middleware.

## 2026-10-03 — Obiettivi provato su iPhone, unito a main

Il passo 3 di Impostazioni è stato provato su iPhone. Con l'account di
prova in Safari: utente nuovo, interruttore senza profilo (da lì il
messaggio riscritto), cambio vero, "Calcola proposta", guardiano. Con
l'account vero nell'app installata. L'unica modifica dopo le prove è il
testo del messaggio sul livello di attività (`54cca62`). Unito a main con
fast-forward, senza commit di merge; branch `obiettivi` cancellato, in
locale e su GitHub.

## 2026-10-03 — Impostazioni, passo 3: la pagina Obiettivi

Branch `obiettivi`. Decisioni A, B, C (sezione 3, "Impostazioni").

- Pagina `/impostazioni/obiettivi`, dall'alto:
  - Obiettivo: tipo, peso obiettivo, "Calcola proposta", con il link a
    Profilo se mancano dati o la pesata;
  - Giorni di allenamento: l'interruttore e, se acceso, i cerchi L…D con
    la frase della decisione C;
  - target con i campi nella riga; con l'interruttore acceso, il
    selettore Normale | Allenamento con il pallino sulla scheda modificata.
- Profilo con i soli dati personali, l'email e la pesata, nello stile a
  gruppi; il sesso diventa un selettore a tre segmenti ("Non indicato" a
  schermo, la frase intera per lo screen reader).
- Elenco: gruppo "Alimentazione" con la riga Obiettivi ("2500 kcal",
  "2500 · 2950 kcal", "Da impostare"), calcolata da `testoRigaObiettivi`.
- Logica comune in `useModuloImpostazioni` (hook) e `SalvataggioModulo`
  (barra, "Salvato.", bivio); `salvaProfilo` invariato, ogni pagina passa
  tutto il modulo. Componenti nuovi: `RigaCampo`, `Interruttore`,
  `SelettoreSegmenti`, `CerchiGiorni`; tolti `SezioneProfilo` e
  `CampoTarget`, non più usati.
- `validaModulo`: se il Salva da Obiettivi deve creare il profilo senza
  livello di attività, il messaggio rimanda a Profilo (con link); la
  sezione "Giorni differenziati" si chiama "Giorni di allenamento".
- Token nuovo `--segmento-attivo`: al buio la scheda scelta era più scura
  della capsula intorno, ora è più chiara (`#4a433a`).
- Service worker: `/impostazioni/obiettivi` in `PAGINE_APP`, sw.js
  cambiato con un commento datato.

Test: nuovi `rigaObiettivi.test.ts` (6) e il test della pagina Obiettivi
(4: precompilazione dopo un refresh con l'utente in ritardo, bivio con
correzione e "Salvato.", interruttore e schede con la riga allenamento
scritta, "È un cambio vero" con una data: il periodo nuovo ha il normale
cambiato e l'allenamento copiato uguale, il vecchio resta com'era). Il
cambio vero non si prova su iPhone con i dati veri, per non creare un
secondo periodo in produzione: lo copre il test, verificato anche
togliendo per prova la copia dell'allenamento (il test fallisce). Il test
di Profilo resta, con l'etichetta "Altezza". 260 test in tutto. Aspetto controllato in Chrome a 390 px, chiaro e scuro, su una
pagina temporanea pubblica con dati finti, poi cancellata con la sua
eccezione nel middleware. Le prove con i dati veri restano da fare su
iPhone.

Dopo la prima prova con un utente nuovo (senza profilo): accendere
l'interruttore e salvare chiede il livello di attività, perché crea la
riga in `profili` e `livello_attivita` è `NOT NULL` su Supabase (bug del
6/9). Toglierlo vorrebbe dire cambiare lo schema: lasciato così, scritto in
PUNTO §4 e §3. Cambiato solo il testo: "Prima di salvare i giorni di
allenamento, completa il tuo profilo con il livello di attività.", con il
link "Vai a Profilo". In PUNTO §11 anche l'account di prova fisso (Safari),
da non cancellare.

## 2026-10-03 — Superficie bianca provata su iPhone, unita a main

Il passo 2 di Impostazioni (`6ae53d1`) è stato provato su iPhone, da
Safari e dall'app installata, in chiaro e in scuro, e funziona tutto.
Unito a main con fast-forward, senza commit di merge; branch `superficie`
cancellato, in locale e su GitHub.

## 2026-10-03 — Impostazioni, passo 2: superficie bianca in chiaro

Branch `superficie`. Decisione D (sezione 3, "Impostazioni"): in chiaro
`--superficie` passa da crema (uguale allo sfondo) a `#ffffff`, come nel
mockup. Cambiano pillola della tab bar e barra dei messaggi (vetro più
bianco), sheet, barra Salva di Profilo, gruppi e scheda dell'account di
Impostazioni. Il valore scuro non cambia.

Contrasti rimisurati in chiaro (sezione 7). Il testo accento sopra la
capsula faceva 4,2:1, e ridurre la capsula non bastava: token nuovo
`--testo-capsula` (accento con il 10% di nero, al buio l'accento), usato
dall'etichetta della tab attiva e da "Annulla": 4,9:1 nel caso peggiore.
Trovato e lasciato aperto: `--tenue` è sotto 4,5:1 già da prima (3,6:1 sul
crema, 3,8:1 sul bianco), da decidere al passo 6 nel mockup dei colori. I campi crema dentro gli
sheet bianchi restano così: si leggono come caselle da riempire.

`offline.html` non usa `--superficie` né la capsula: non cambia, quindi
`CACHE_STATICI` resta com'è. Il test dei token copre già il token nuovo
(che ha il suo valore scuro). Screenshot prima/dopo a 390 px su una pagina
temporanea pubblica, poi cancellata con la sua eccezione nel middleware: in
chiaro i cambi previsti, in scuro 0 pixel diversi.

## 2026-10-03 — Impostazioni passo 1 provato su iPhone, unito a main

Il passo 1 di Impostazioni (`e9f940f`) è stato provato su iPhone, da
Safari e dall'app installata, in chiaro e in scuro, e funziona tutto:
elenco e sotto-pagine, guardiano delle modifiche non salvate, redirect da
`/profilo`, offline in modalità aereo. Unito a main con fast-forward,
senza commit di merge; branch `impostazioni` cancellato, in locale e su
GitHub.

## 2026-10-03 — Impostazioni, passo 1: la tab Profilo diventa Impostazioni

Branch `impostazioni`. Primo dei sei passi decisi sull'analisi
(sezione 3, "Impostazioni", con le decisioni A–D).

- Tab "Impostazioni" con l'ingranaggio, al posto di "Profilo".
- Elenco `/impostazioni` come il mockup: scheda dell'account (iniziali,
  nome, peso · altezza), Sincronizzazione, Informazioni, Esci in arancio.
  Componenti nuovi: `GruppoImpostazioni`, `RigaImpostazioni`,
  `SchedaAccount`, `IntestazioneSottopagina`.
- Profilo spostato intero con `git mv` in `/impostazioni/profilo` (anche
  il suo test), con l'email in sola lettura; via Ricarica ed Esci.
- `/impostazioni/sincronizzazione` con "Ricarica i dati";
  `/impostazioni/informazioni` con versione e commit, scritti alla build
  da `env` in `next.config.ts` ("sviluppo" in locale).
- Guardiano delle modifiche non salvate (`GuardianoModifiche`,
  `LinkProtetto`), in `(app)/layout.tsx` perché avvolga anche la tab bar.
  Ricarica ed Esci non ricevono più `modificheModuloNonSalvate`.
- `/profilo` → `/impostazioni`, redirect 307.
- Service worker: `PAGINE_APP` con le pagine nuove, `pagineDaTogliere`
  per cancellare la copia di `/profilo` nel riscaldamento; `sw.js` con un
  commento datato, `CACHE_STATICI` invariata.

Test: 3 nuovi su `pagineDaTogliere`, aggiornati quelli che citavano
`/profilo`; 250 in tutto. Lint pulito, build riuscita. Redirect provato
con `next start`. Aspetto controllato in Chrome a 390 px, chiaro e scuro,
su una pagina temporanea pubblica con dati finti (poi cancellata, come
l'eccezione nel middleware). Le pagine vere stanno dietro il login: da
provare su iPhone, anche in modalità aereo.

## 2026-10-03 — Tema scuro provato su iPhone, unito a main

Il tema scuro passo 1 (`4086feb`) è stato provato su iPhone (Safari e app
installata), in chiaro e in scuro, e funziona: Oggi, sheet con il velo,
bottoni, menu nativi. Con `statusBarStyle: "default"` la barra
dell'orologio dell'app installata in scuro è in tinta con la pagina,
nessuno stacco. Non ancora guardati al buio: i campi compilati in
automatico. Unito a main con fast-forward, senza commit di merge; branch
`feature/tema-scuro` cancellato, in locale e su GitHub.

## 2026-10-03 — Tema scuro, passo 1: l'app segue il telefono

Branch `feature/tema-scuro`. Palette "Caldo" in un solo blocco
`@media (prefers-color-scheme: dark)` di `globals.css`. Il selettore in
Profilo è il passo 2.

Token nuovi:
- `--superficie`: pillola, barra dei messaggi, sheet, barra Salva;
- `--accento-pieno` e `--avviso-pieno`: bottoni con testo sopra;
- `--su-pieno`: il testo su quei bottoni;
- `--velo`: lo sfondo dietro gli sheet.

In chiaro valgono quanto prima. Altre modifiche:
- `themeColor` uno per tema;
- `theme_color` del manifest `#faf7f2`;
- `color-scheme: light dark`;
- `offline.html` con il blocco scuro, cache statici in `sw.js` passata
  a v3;
- `statusBarStyle` resta "default", corretto solo il commento.

Trovati nell'inventario e corretti prima che si vedessero:
- il testo dei bottoni era `text-background`, che al buio sarebbe stato
  quasi nero sul verde;
- il velo `bg-foreground/40` avrebbe sbiancato la pagina;
- il bianco sui bottoni arancio sarebbe stato a 2,4:1.

Test: 3 nuovi in `temaScuro.test.ts`. Ogni token chiaro ha il suo valore
scuro e `offline.html` ha gli stessi valori dell'app; ho verificato che il
test fallisce togliendo un token. 247 test in tutto.

Provato in Chrome con la modalità scura emulata, a 390 px, su login,
registrazione e `offline.html`. In chiaro: 0 pixel diversi da main.

Resta da provare sul telefono tutto ciò che sta dietro il login, e la
barra dell'orologio nell'app installata.

## 2026-10-02 — Swipe provato su iPhone, unito a main

Lo swipe per cambiare giorno (`ec8f4f0`) è stato provato su iPhone, da
Safari e dall'app installata, e funziona tutto: la lista non riparte in
verticale dopo un gesto orizzontale (il `touchmove` è registrato con
`passive: false`, quindi iOS rispetta il `preventDefault`). Unito a main
con fast-forward, senza commit di merge; branch `feature/swipe`
cancellato, in locale e su GitHub.

## 2026-10-02 — Swipe per cambiare giorno in Oggi

Branch `feature/swipe`. In Oggi un trascinamento orizzontale cambia giorno:
dito a sinistra giorno dopo, a destra giorno prima. Oltre oggi non si va,
con un elastico. Si muove il pannello del giorno (anello, macro, lista),
la testata resta ferma. Nessuna libreria: hook `useSwipeGiorno`
(`src/lib/swipeGiorno.ts`) con Pointer Events, decisioni pure in
`decisioneSwipe.ts` (soglie come costanti). A ogni cambio di giorno, anche
con freccette e "Oggi", la lista riparte dall'alto.

Test: 22 nuovi (swipe nei due sensi, sotto soglia, flick, diagonale,
bordi, oltre oggi, blocco del click una volta sola), 244 in tutto. Provato
in Chrome con tocchi simulati su una pagina temporanea, poi cancellata.
Trovato nella prova: Chrome headless consegna i movimenti ogni ~33 ms, e
il primo flick di prova era troppo lento per la soglia. Era un limite del
simulatore, le soglie non sono cambiate. Da verificare su iPhone: che lo
scroll verticale non riparta dopo che il gesto è stato deciso orizzontale
(in Chrome non succede nemmeno senza protezione, iOS non l'ho potuto
provare).

## 2026-10-02 — Barra "vetro" provata su iPhone, unita a main; durate più brevi

La barra dei messaggi "vetro" (`b85d310`) è stata provata su iPhone, da
Safari e dall'app installata, compreso "Salvato." in Profilo, e unita a
main con fast-forward, senza commit di merge. Il branch
`feature/barra-vetro` è cancellato, in locale e su GitHub.

Ritocco prima del merge: 8 secondi per tutto erano troppi. Ora le durate
sono costanti in un posto solo, `DURATE_BARRA` in `testiBarra.ts`:
- 5000 ms con "Annulla" (Aggiunto, Eliminato);
- 4000 ms per una frase intera (stella, avviso del pasto non ripristinato,
  errori);
- 2500 ms per una conferma breve (Salvato, Ripristinato, Annullato).

La barra sceglie da sola 5000 o 4000 ms, a seconda che ci sia un'azione; i
messaggi brevi portano `durataMs`. Nei componenti non resta nessun numero:
tolto il `durataMs={2500}` di Profilo. Pausa e linea del tempo invariate.
Test: le durate predefinite con e senza azione, e quelle dei messaggi
brevi. 222 test. Le durate nuove non sono ancora state viste sul telefono.

## 2026-10-02 — Barra dei messaggi "vetro" (opzione A)

Branch `feature/barra-vetro`. La BarraAnnulla passa dal nero pieno al
vetro della tab bar (`.vetro`, bordo, `--ombra-fluttuante`). È una pillola
larga quanto il contenuto, centrata, al massimo quanto lo schermo meno
32 px; se il testo va a capo diventa un rettangolo arrotondato.

- Icona in un cerchio, una sola prop nuova `icona` (predefinito `"info"`):
  spunta su accento (Aggiunto, Salvato, Ripristinato), ↶ (Annullato),
  cestino (Eliminato), "i" (avvisi, errori, stella), su `--linea`.
- Nome in medium (la §7 ammette solo regular e medium), troncato; verbo e
  dettaglio sempre visibili. I testi erano già a parti dal lavoro su
  "Annulla": `testiBarra.ts` ora aggiunge l'icona e `MESSAGGIO_SALVATO`.
- "Annulla" in una capsula `--capsula-attiva`, con un'area toccabile di
  44 px.
- Linea del tempo, solo CSS (`.linea-tempo`, durata in `--durata-barra`,
  colore `--linea-tempo`). In pausa si ferma; quando la pausa finisce
  riparte da piena insieme al timer, che già ripartiva da capo. Con
  `prefers-reduced-motion` non c'è.
- Bug trovato nella prova: con un nome lungo la pillola usciva dallo
  schermo (`w-fit` misura il testo intero prima di troncarlo). Limite
  corretto: `max-w-[min(28rem,100%)]`.
- Test: `BarraAnnulla.test.tsx` nuovo (chiusura dopo la durata; pausa che
  ferma timer e linea; ripartenza da capo; durata passata alla linea) e
  `testiBarra.test.ts` aggiornato con le icone. 220 test, tutti verdi.
- Aspetto controllato in `npm run dev` a 375 e 390 px, con gli 8 messaggi
  della barra su una pagina di prova e il CSS vero, senza login.

## 2026-10-02 — Tab bar fluttuante provata su iPhone, unita a main; "Salvato." in Profilo

La tab bar fluttuante (`8da5690`) è stata provata su iPhone, da Safari e
dall'app installata, e unita a main con fast-forward, senza commit di
merge. Il branch `feature/tab-bar-fluttuante` è cancellato, in locale e su
GitHub.

Aggiunto prima del merge, dopo la prova sul telefono: in Profilo, dopo un
salvataggio riuscito, "Salvato." per circa 2500 ms con una BarraAnnulla
senza azione, sopra la pillola, dove stava la barra Salva (che a quel punto
sparisce). Tolto il "Salvato." dentro la barra Salva, che non si vedeva
più. Il test della pagina Profilo controlla che compaia una volta sola dopo
il salvataggio, non dopo "Annulla modifiche", e che se ne vada da solo. Non
ancora visto sul telefono.

## 2026-10-02 — Tab bar fluttuante (opzione B)

Branch `feature/tab-bar-fluttuante`. La tab bar diventa una pillola
staccata dai bordi, con sfondo vetro (`backdrop-filter`, sfondo pieno dove
non è supportato), bordo, ombra leggera e capsula sulla voce attiva. Vale per
Oggi, Statistiche e Profilo.

- Oggi: sparita la fascia bassa. La pagina è alta lo schermo, la lista
  scorre fino in fondo sotto "+ Aggiungi" (ora fluttuante) e la pillola, con
  una sfumatura dietro. "Aggiunto — Annulla" sta sopra il bottone.
- Variabili in `globals.css`:
  - tolte `--altezza-tab-bar` e `--margine-sotto-tab-bar`;
  - nuove `--tab-bar-distanza` (`max(safe area − 12px, 12px)`),
    `--ingombro-tab-bar`, `--ingombro-oggi`, `--spazio-fra-barre`;
  - token `--capsula-attiva`, `--vetro`, `--ombra-fluttuante`, tutti con
    `color-mix` dai token di base.
- Lo spazio in fondo lo lascia ogni pagina, non più il layout di (app).
- Profilo: la barra Salva compare solo quando ci sono modifiche, con
  dissolvenza di 150 ms (nessuna con `prefers-reduced-motion`). Lo spazio
  resta sempre riservato. Il messaggio "Salvato" non si vede più.
- Test nuovo sulla pagina Profilo: la barra compare dopo una modifica e
  sparisce con "Annulla modifiche" e dopo il salvataggio. Nel file serviva
  `afterEach(cleanup)`: senza `globals` in Vitest la pulizia automatica di
  Testing Library non parte. 217 test, tutti verdi.
- Geometria misurata in `npm run dev` a 375 e 390 px, con il CSS vero su
  una pagina di prova e senza login: pillola a 16 px dai lati e 12 px dal
  fondo, alta 64 px; capsula di 50 px; "+ Aggiungi" 12 px sopra la pillola;
  l'ultima voce della lista arriva sopra il bottone; il documento non scorre.

## 2026-10-02 — "Aggiunto — Annulla" provato su iPhone, unito a main

Solo documenti. La barra "Aggiunto — Annulla" (`5a25f32`) è stata provata
su iPhone, da Safari e dall'app installata, e unita a main con
fast-forward, senza commit di merge. Il branch `feature/annulla-inserimento`
è cancellato, in locale e su GitHub.

- CLAUDE.md: nuova regola, il Supabase collegato è quello di produzione.
  Niente utenti creati, righe scritte o cancellate senza un ok esplicito;
  per le prove nel browser si chiede prima quale account usare. Allineata
  la regola sugli script di verifica. Nato dalla prova in `npm run dev`,
  che aveva creato e poi cancellato due utenti di prova senza chiedere.
- Trovato durante quella pulizia, lasciato aperto in PUNTO §11: cancellando
  un utente, `alimenti` resta con `user_id` null (`ON DELETE SET NULL`), e
  `giorni` / `obiettivi_target` (`NO ACTION`) bloccano la cancellazione.
  Da sistemare prima di "elimina account".

## 2026-10-02 — "Aggiunto — Annulla" dopo ogni inserimento

Branch `feature/annulla-inserimento`. Chiude il rimedio 10.2: dopo i tre
percorsi di inserimento (sheet, "+" rapido, pasto salvato) Oggi mostra
"Aggiunto: Pane" o "Aggiunto: Colazione tipo (3 alimenti)" con "Annulla".

- `annullaInserimento` (`src/lib/repository/vociDiario.ts`): cancellazione
  logica via repository delle voci di quell'inserimento, per id, rilette da
  Dexie. Per un pasto salvato si annullano tutte le voci del gruppo.
  L'outbox ha una voce sola per riga, quindi la cancellazione sostituisce
  l'inserimento non ancora partito (§10.6).
- La riga di `giorni` creata dalla prima voce resta: può contenere una
  scelta fatta con la pastiglia nel frattempo.
- `ultimoInserimento.ts` passa l'inserimento da /aggiungi a Oggi, in
  memoria. Oggi lo legge in un `useEffect`, non nel render (Strict Mode).
- Testi con il verbo prima del nome, nome troncato su una riga:
  "Eliminato: Mela" e "Ripristinato: Mela" anche in /aggiungi.
- 8 test nuovi (annullamento singolo e di un pasto salvato, outbox,
  ripetizione, testi). 216 test, tutti verdi.
- Provato in `npm run dev` con Chrome e un utente di prova temporaneo
  (cancellato): barra comparsa, Annulla, voce arrivata su Supabase con
  `deleted_at`.

## 2026-10-02 — Giorno del calendario provato su iPhone, unito a main

Solo documenti. L'abolizione del giorno logico (`f76ed1b`) è stata provata
su iPhone, sulla preview, e unita a main con fast-forward, senza commit di
merge. Il branch `feature/abolisci-giorno-logico` è cancellato, in locale e
su GitHub.

## 2026-10-02 — Abolito il giorno logico: il giorno è quello del calendario

Branch `feature/abolisci-giorno-logico`. Prima, un inserimento fatto prima
del primo pasto finiva nel giorno precedente: il 1/10 alle 05:57 tre voci
sono finite nella Cena del 30/9. Ora c'è un solo "oggi", `oggiLocale()`,
per Oggi, Aggiungi e Profilo. La pesata lo usava già.

- Tolte `giornoLogico` (dataGiorno.ts) e `oraInizioPrimoPasto`
  (propostaPasto.ts). Oggi parte subito dall'oggi del calendario, senza
  aspettare i pasti da Dexie. Il Profilo non legge più i pasti.
- `pastoPerOrario`: prima dell'inizio del primo pasto propone il primo
  pasto, non più la Cena. Bug trovato e corretto: con `ora_inizio`
  "HH:mm:ss" (come arriva da Postgres), all'ora esatta di inizio veniva
  proposto il pasto precedente.
- Test: tolti gli 8 di `giornoLogico` e i 3 di `oraInizioPrimoPasto`,
  riscritti e aggiunti i casi di `pastoPerOrario`. 208 test, tutti verdi.
- Nessuna modifica a schema Dexie o Supabase. I dati salvati non cambiano.
- PUNTO_DI_PARTENZA: §4 "Il giorno è quello del calendario" con la
  decisione ritirata, `giorni.data`, §3, §10.5 e §11.

## 2026-10-02 — Tab bar provata su iPhone, unita a main

Solo documenti. La tab bar nell'app installata (`4f61433`, `26b0545`) è
stata provata su iPhone, da Safari e dall'app sulla Home, e unita a main
con fast-forward, senza commit di merge. Il branch `fix/tab-bar-installata`
è cancellato (esisteva solo in locale).

## 2026-10-02 — Tab bar più alta nell'app installata

Branch `fix/tab-bar-installata`. Provata la correzione qui sotto: la tab
bar non finisce più sotto la barretta home, ma le voci restavano troppo in
basso. Nuova variabile `--margine-sotto-tab-bar` (0.75rem), sommata a
`--altezza-tab-bar` e al padding della tab bar, solo con
`@media (display-mode: standalone)`. In Safari non cambia nulla.

## 2026-10-02 — Tab bar sotto la barretta home nell'app installata

Branch `fix/tab-bar-installata`. Nell'app aperta dalla Home dell'iPhone la
tab bar finiva sotto la barretta home, in Safari no. Causa: senza
`viewport-fit=cover` iOS restituisce 0 per `env(safe-area-inset-bottom)`,
quindi `--altezza-tab-bar` e il padding in fondo perdevano lo spazio della
barretta. Correzione: `viewportFit: "cover"` nel viewport del layout
radice, nessun JavaScript. In alto non cambia nulla, perché con
`statusBarStyle: "default"` la pagina comincia sotto l'orologio. Da provare
su iPhone.

PUNTO_DI_PARTENZA allineato: §3 spiega la safe area; in §11 tolte le voci
chiuse (colore dei placeholder; service worker, provato sul telefono il
26/9) e aggiornata la data.

## 2026-09-26 — Limiti sui numeri del catalogo provati su iPhone, uniti a main

Solo documenti. I limiti sui numeri del catalogo e la somma dei macro sono
stati provati su iPhone e uniti a main (`4ea4f9a`, `6c0830c`),
fast-forward senza commit di merge. Il branch `limiti-alimenti` è
cancellato, in locale e su GitHub.

## 2026-09-26 — Somma dei macro per 100 g, con tolleranza di 1,5 g

Branch `limiti-alimenti`. Chiude le due questioni rimaste aperte nella
voce qui sotto.

- `validaValoriAlimento` blocca grassi + carboidrati + proteine oltre
  101,5 g. La tolleranza di 1,5 g copre il caso peggiore degli
  arrotondamenti in etichetta: 0,5 g per ciascuno dei tre valori (linee
  guida UE del 2012). Il messaggio sta sotto il gruppo "Valori per 100 g".
  La somma è arrotondata ai centesimi prima del confronto, perché
  50,1 + 32,2 + 19,2 in JavaScript fa 101,50000000000001.
- 3 test nuovi: 100,5 e 101,5 passano, 101,6 e 105 no; il caso della
  virgola mobile; nessun controllo se un macro manca o è già sbagliato.
- Deciso: zuccheri, fibre, saturi e sale non entrano nel form,
  arriveranno con l'OCR. Scritto in PUNTO_DI_PARTENZA.

## 2026-09-26 — Limiti sui numeri del catalogo (CreaAlimentoForm)

Branch `limiti-alimenti`. Chiude il difetto aperto "numeri del catalogo
senza limiti". Il form controllava solo "numero valido, ≥ 0" (porzione
"> 0"), ma in `alimenti` sono tutti `numeric(7,2)`.

- Nuova `leggiNumeroDecimale` in `src/lib/numeriDecimali.ts`: virgola,
  arrotondamento a due decimali, massimo 99999,99. `leggiGrammi` ora la
  usa, con gli stessi messaggi, e i suoi test restano verdi senza modifiche.
- Nuova `validaValoriAlimento` in `src/lib/inserimento/valoriAlimento.ts`,
  con i limiti fisici per 100 g: macro al massimo 100 g, kcal al massimo
  900, zuccheri non più dei carboidrati, saturi non più dei grassi. Ha 9
  test permanenti.
- Nel form (nuovo e modifica) il messaggio compare sotto il campo
  sbagliato, il pulsante resta spento finché c'è un errore, e i campi
  vuoti sono elencati sopra il pulsante. I valori salvati sono già
  arrotondati.
- Verificato su Supabase: nessuno dei 24 alimenti vivi supera i nuovi
  limiti (somma dei macro al massimo 93,10 g).
- Aperto: il controllo sulla somma grassi + carboidrati + proteine aspetta
  la decisione sulla tolleranza. Il form non mostra zuccheri, fibre, saturi
  e sale, quindi le due regole "parte-tutto" oggi non possono scattare.

## 2026-09-26 — Modifica di un pasto salvato provata su iPhone, unita a main

Solo documenti. La modifica di un pasto salvato e la correzione dei grammi
sono state provate su iPhone e unite a main (`89d25c0`, `4fe0943`),
fast-forward senza commit di merge. Il branch `modifica-pasto-salvato` è
cancellato, in locale e su GitHub. In PUNTO_DI_PARTENZA è chiuso il
difetto aperto "prova sul telefono non registrata".

## 2026-09-26 — Grammi validi: limiti di numeric(7,2) e due decimali

Branch `modifica-pasto-salvato`. `quantita_g` è `numeric(7,2)` su Supabase,
sia in `voci_diario` sia in `composizioni_voci` (verificato su
information_schema). Lo sheet quantità e la modifica del pasto salvato
controllavano solo "> 0", e ne venivano due bug. Un valore oltre 99999,99
si salvava in Dexie e poi faceva fallire la sync in silenzio. Con più di
due decimali, Dexie teneva 12,345 e il server 12,35.

- Nuova `leggiGrammi` in `src/lib/inserimento/grammi.ts`, usata da
  SheetQuantita e da `modificaPastoSalvato.ts`. Tiene il massimo 99999,99 e
  arrotonda a due decimali prima di scrivere; un valore che arrotondato fa
  0 non vale. Nello sheet, un campo scritto ma non valido mostra il motivo.
- 7 test permanenti nuovi (5 in `grammi.test.ts`, 2 nella modifica del
  pasto).
- Lasciato aperto: `CreaAlimentoForm` ha lo stesso problema su porzione e
  valori per 100 g.

## 2026-09-26 — Modifica di un pasto salvato: alimenti e grammi

Branch `modifica-pasto-salvato`. La matita su un pasto salvato in
Preferiti non apre più SheetNome, che permetteva solo di rinominare o
eliminare. Apre `ModificaPastoSalvato`, una schermata a tutta altezza
dentro Aggiungi con nome, alimenti con i grammi, aggiungi alimento ed
"Elimina pasto". Le regole sono in PUNTO_DI_PARTENZA, sezione 3.

- Logica senza React in `src/lib/inserimento/modificaPastoSalvato.ts`,
  con 16 test permanenti: cambio grammi, togliere o aggiungere, togliere
  tutto, alimento cancellato durante la modifica, Annulla, diario intatto,
  nome doppio, pasto cambiato o cancellato altrove, grammi non validi.
- `eliminaComposizione` ora rilegge le righe da Dexie invece di riceverle
  dalla pagina. Cambia anche la chiamata della stella in Oggi. Tolta
  `rinominaComposizione`, non più usata.
- Nuovo `SheetConferma`, sheet sì/no generico.
- Difetto lasciato aperto e documentato: due dispositivi offline che tolgono
  ciascuno un alimento diverso possono lasciare un pasto vivo senza righe
  (innocuo, invisibile). Non provato sul telefono.

## 2026-09-26 — CLAUDE.md: regola sulle voci scritte su un branch

Solo documenti. Nel paragrafo "Changelog" di CLAUDE.md c'è una regola
nuova: una voce scritta su un branch dice solo il nome del branch, mai
"non ancora su main". Il merge lo registra la sua voce. Motivo: due volte
in un giorno (`tastiera-ios`, `testata-oggi`) quella frase è diventata
falsa al merge e ha richiesto un commit solo per correggerla.

## 2026-09-26 — Testata di Oggi provata su iPhone, unita a main

Solo documenti. La testata "giorno sopra la data" è stata provata su
iPhone ed è unita a main (`e933631`, merge senza fondere i commit:
`4a6a71f` e `9a5b45e` restano nella storia). Il branch `testata-oggi` è
cancellato. Dalle tre voci qui sotto è tolto "non ancora su main".

## 2026-09-26 — Oggi: testata "giorno sopra la data"

Branch `testata-oggi`. È la terza versione della
testata, C, e sostituisce le due voci sotto: A (`4a6a71f`, pulsanti sulla
riga delle kcal) e B (`9a5b45e`, giorno abbreviato). Tutte e due sono state
scartate dopo i mockup. È un commit nuovo sopra le altre due, per non
riscrivere un branch già pubblicato.

- La data è un blocco centrato su due livelli: sopra il giorno intero,
  piccolo (11 px, maiuscolo, spaziato, tenue); sotto "25 set" in grande
  come prima. Tutto il blocco è il pulsante del calendario, e l'aria-label
  legge la data per esteso. A destra, sulla stessa riga, "Oggi" e la
  pastiglia con le regole di prima. La riga delle kcal è come su main.
  Nuove `formattaGiornoSettimana` e `formattaGiornoMese`; tolta
  `formattaDataTitolo`.
- **Perché C: la forma è sempre la stessa.** Con il giorno sopra, il blocco
  data è largo quanto "30 mag" (87 px) e la riga nel caso peggiore ("Oggi"
  e "Allenamento" insieme) arriva a 315 px. Resta un margine di 43 px a 390
  e di 28 px a 375. B invece a 390 px andava a capo proprio in quel caso
  (367 px su 358).
- `flex-wrap` resta come rete di sicurezza. Scatta solo a 320 px, dove
  mancano 27 px, o con un tipo di giorno dal nome più lungo di
  "Allenamento": "Oggi" e la pastiglia scendono insieme sulla riga sotto.
- La testata è più alta di circa 15 px: la scritta piccola con
  l'interlinea normale.
- Verificati `tsc`, lint (0 errori), 180 test verdi, build. La prova su
  iPhone manca.

## 2026-09-26 — Oggi: giorno abbreviato, testata su una riga (scartata)

Scartata dopo i mockup (versione B), sostituita dalla voce sopra.

Branch `testata-oggi`. Sostituisce la versione di
`4a6a71f` (voce sotto): la testata torna a una riga come su main, con
‹ data › e a destra "Oggi" e la pastiglia. La riga delle kcal torna com'era
su main. `4a6a71f` è stata scartata dopo aver visto i mockup; questo commit
la sostituisce senza riscrivere la storia del branch già pubblicato.

- Il giorno della settimana è abbreviato ("Ven 25 set",
  `formattaDataTitolo`) e la data ha `whitespace-nowrap`. L'aria-label
  resta per esteso ("Cambia data, venerdì 25 settembre",
  `formattaDataEstesa`). Tolta `formattaData`, che non usa più nessuno.
- **Perché la riga può andare a capo.** Misurata con i font veri al peso
  esatto: su un giorno passato con la differenziazione attiva, "Mer 20
  mag" + Oggi + pastiglia "Allenamento" fanno 367 px (374 con "Dom 20
  mag"). A 390 px lo spazio è 358, a 320 è 288: non ci stanno. Allora
  ‹ data › e il gruppo "Oggi" + pastiglia sono due blocchi in una riga
  `flex-wrap`: se il gruppo non entra, scende intero sulla riga sotto,
  allineato a destra (`ml-auto`). Solo CSS. Con uno solo dei due pulsanti
  la riga ci sta a 390 px.
- Verificati `tsc`, lint (0 errori), 180 test verdi, build. La prova su
  iPhone manca.

## 2026-09-26 — Oggi: la data non va più a capo (scartata)

Scartata dopo i mockup, sostituita dalla voce sopra.

Branch `testata-oggi`. Con un giorno dal nome lungo
("Venerdì 25 set") la data andava su due righe. Adesso sulla prima riga ci
sono solo ‹ data ›, con `whitespace-nowrap`. Il pulsante "Oggi" e la
pastiglia Normale/Allenamento sono scesi sulla riga delle calorie, a destra,
e compaiono nelle stesse condizioni di prima. Le altre fasce non cambiano.

- Misurato con i font veri (fontkit, script temporaneo fuori dal progetto)
  su uno schermo di 320 px. Per la data restano 224 px: la più larga
  possibile, "Mercoledì 20 mag", è 213 px anche al peso 800, più largo del
  grassetto usato. Seconda riga: 282 px su 288 su un giorno passato ("X di
  Y kcal" + Oggi + pastiglia), 272 sul giorno corrente ("... kcal oltre
  l'obiettivo" + pastiglia).
- Quando c'è una pillola, la riga delle calorie è alta 26 px invece di 20: la
  lista dei pasti perde 6 px.
- Verificati `tsc`, lint (0 errori), 180 test verdi, build. La prova su
  iPhone manca.

## 2026-09-26 — Tastiera iOS provata su iPhone, difetto chiuso

Solo documenti. Prova su iPhone superata: con un campo attivo, tab bar e
barra Salva non compaiono più sopra la tastiera e tornano quando la tastiera
si chiude. Branch `tastiera-ios` unito a main (`c5d59c0`) e cancellato. In
PUNTO_DI_PARTENZA (§11) il difetto è tolto da "Difetti e verifiche aperti",
c'è una riga in "Fatto", e il prossimo passo è la settimana d'uso vero.

## 2026-09-26 — Tastiera iOS: mentre scrivi, le barre si nascondono

Branch `tastiera-ios`. Provato su iPhone, `273bdbb`
(voce sotto) non basta: iOS a volte fa scorrere il documento, e allora le
barre restano coperte, a volte sposta la finestra, e allora la tab bar
compare sopra la tastiera. Il layout non basta a evitarlo. Cambio di strada,
sempre solo CSS: sui dispositivi touch (`hover: none` e `pointer: coarse`),
finché un campo che apre la tastiera o un selettore ha il fuoco, la tab bar e
la barra Salva di Profilo sono `visibility: hidden` e `pointer-events: none`.
Il selettore è `body:has(...:focus)` su tutti gli input tranne checkbox,
radio e bottoni, più textarea e select. Le barre sono segnate con
`data-nascondi-mentre-scrivi`. Il layout di `273bdbb` (documento che scorre,
tab bar `fixed`) resta.

- Si usa `visibility` e non `display: none`: la barra Salva occupa spazio
  nella pagina, toglierla la farebbe saltare.
- Gli sheet non cambiano. Sotto uno sheet con un campo a fuoco anche la tab
  bar si nasconde: accettato.
- La prova su iPhone manca.

## 2026-09-26 — Tastiera iOS: nelle pagine con la tab bar scorre il documento

Branch `tastiera-ios`. Il difetto: in Profilo, con un
campo in basso, iOS spostava la finestra e tab bar e barra Salva salivano
sopra la tastiera. Adesso è il documento a scorrere, non il `<div>` interno.
La tab bar è `fixed` in fondo e il contenuto lascia uno spazio pari a
`--altezza-tab-bar` (`globals.css`). La barra Salva è `sticky` sopra la tab
bar. Oggi ha altezza fissa (schermo meno tab bar) e le sue tre fasce non
cambiano. Solo CSS, nessun JavaScript.

- `interactiveWidget` passa da `resizes-content` a `resizes-visual`: su
  Android la tastiera ora copre il layout come su iOS, invece di accorciarlo
  e spingere su le barre fisse.
- Verificati `tsc`, lint (0 errori), 180 test verdi, build e CSS compilato.
  **La prova su iPhone manca.** Caso a rischio: l'ultimo campo del Profilo,
  se sotto di lui resta meno pagina dell'altezza della tastiera.
- Da tenere d'occhio: in Profilo, con uno sheet aperto, trascinare lo sfondo
  scuro può far scorrere la pagina dietro, perché ora il documento scorre.
  Lo sheet resta al suo posto.
- Esito della prova su iPhone: il layout funziona, ma il difetto resta. Le
  barre possono ancora salire sopra la tastiera (vedi voce sopra).

## 2026-09-26 — Documenti: decisioni sulle frasi dubbie, via NOTE_MODIFICHE

Branch `documenti`, secondo giro. Solo documentazione e commenti.

- PUNTO_DI_PARTENZA: intestazione riscritta (unica fonte, non una sintesi
  iniziale); "(non ancora costruito)" su "Scansiona etichetta", fasce dei
  pasti dal Profilo, modifica di `consumato_alle` (quest'ultima è descritta
  in §4, non in §3: segnata lì) e `SorgenteAlimento` (§5); §9.4, il livello
  2 della ricerca oggi non serve perché la discesa scarica tutto il
  catalogo condiviso, da riprendere se diventa troppo grande.
- §9.2, Tesseract: verificato nel codice di tesseract.js 7.0.0 e nella sua
  documentazione che worker, core e dati della lingua arrivano da jsDelivr
  (circa 6 MB per dispositivo con il modello LSTM predefinito). Per l'OCR
  offline andranno ospitati da noi.
- Scritte nel documento due regole che vivevano solo in `NOTE_MODIFICHE.md`:
  marca negli elenchi ("Nome · Marca", §4) e rinomina/elimina di un pasto
  salvato (§3).
- `NOTE_MODIFICHE.md` cancellato (lista "Da fare" vuota, il resto già nel
  CHANGELOG); i 9 commenti del codice che lo citavano ora puntano a §3, §4
  e §7. Le citazioni nelle voci vecchie del CHANGELOG restano: sono storia.
- `README.md`: quello di create-next-app sostituito da uno breve in
  italiano.
- Lint, `tsc` e 180 test verdi dopo la modifica dei commenti.

## 2026-09-26 — Documenti riallineati al codice

Branch `documenti`, solo documentazione.

- CHANGELOG: le voci dal 13 al 24 settembre **c'erano già** (tutti i 29
  commit del periodo coperti, scritte al momento). Integrate a posteriori
  quattro voci con fatti ricostruiti da diff e migration:
  `orchestratore.ts` e il cambio di nome `SincronizzaOutbox` →
  `Sincronizzazione`, la dipendenza `uuid` con `idEsplicito`,
  `giornoSettimanaDi`, le colonne di `profili` e le migration dei giorni
  differenziati. L'indice unico sui pasti, creato e rimosso il 20/9, è
  registrato senza motivazione: il perché della creazione non risulta da
  nessuna parte. Aggiunte le voci mancanti per `44e4c28`, `093f099`,
  `b72545e` e i commit della v0.
- PUNTO_DI_PARTENZA: sezione 11 riscritta sullo stato del 26/9 (era ferma
  al 4/9) con i prossimi passi nuovi; tema scuro dichiarato non costruito
  (§7); ordine Kcal → Grassi → Carboidrati → Proteine scritto (§3, §7);
  corrette le frasi rimaste indietro (grafico calorie "già così", OCR
  offline, cancellazione al logout senza il "rimandato", conteggio delle
  funzioni in 10.5 con lo stato dei test).

## 2026-09-26 — Service worker rifatto: l'app funziona offline

Branch `service-worker`. `public/sw.js` riscritto a mano (Serwist valutato e
scartato, motivi in PUNTO_DI_PARTENZA.md §9.2). Tre difetti della v1
corretti:
- le pagine non si salvavano mai: offline si vedeva `manifest.json` come
  testo. Ora le quattro schermate si salvano (prima la rete, copia se
  offline), più un riscaldamento dopo il login che le salva anche se mai
  aperte, e `offline.html` quando manca la copia;
- "prima la cache" su tutto, comprese le richieste RSC della tab bar: un'app
  rimasta aperta dopo un deploy riceveva le pagine vecchie. Ora le RSC vanno
  solo in rete; in cache "per sempre" solo i file con nome versionato;
- cache con nome fisso (`nutritrack-v1`): ora `-statici-v2` e `-pagine-v2`,
  la v1 si cancella da sola.

Esci svuota le pagine salvate. Middleware: esclusi `sw-strategia.js` e
`offline.html`, altrimenti il redirect al login rompeva l'installazione.

- Bug trovato e corretto: offline `useUtenteId` diventava `null` (`getUser()`
  fallisce per rete e sovrascriveva l'id), e con il token scaduto anche
  `getSession()` e `INITIAL_SESSION` danno null pur con la sessione ancora
  salvata. Ora l'id si legge dal cookie; solo SIGNED_OUT o un rifiuto vero
  del server portano a null. Test permanenti per questo e per la strategia
  del service worker.
- Da provare sul dispositivo: la sequenza completa (online → aereo → cambio
  scheda, ricarica, pasto) e l'arrivo della versione nuova dopo un secondo
  deploy. Provato qui solo in simulazione (sw.js vero con cache e rete
  finte, sulla build reale).
- Portato su `main` con un fast-forward (nessun commit di merge: `main` non
  aveva commit nuovi), branch `service-worker` cancellato in locale e su
  GitHub.

## 2026-09-26 — Annullata la correzione della tastiera su iPhone

Branch `profilo-rifacimento`. Tolto il codice di a648455 (`AreaContenuto`,
`useCampoSopraTastiera` e il loro uso nel layout con la tab bar): torna il
comportamento di prima. Provata su iPhone non funzionava: con il campo
molto in basso iOS spostava ancora la finestra, e in posizione intermedia
la pagina "ballava" (saliva e poi scendeva). È il limite di correggere iOS
DOPO che ha già spostato la finestra: si arriva sempre in ritardo di un
movimento.

- Aperto: il difetto originale resta (barre sopra o sotto la tastiera a
  seconda di dove sta il campo in Profilo). La soluzione vera, da fare a
  parte: far scorrere il documento invece del `<div>` interno, con tab bar
  e barra Salva `position: fixed` in fondo — così iOS porta il campo sopra
  la tastiera da solo e le barre restano coperte.

## 2026-09-26 — Tastiera su iPhone: barre in fondo sempre coperte

Branch `profilo-rifacimento`. Difetto trovato provando l'anteprima: in
Profilo, toccando un campo in basso, iOS spostava tutta la finestra e tab
bar + barra Salva salivano sopra la tastiera (del campo restava una
striscia); toccando un campo più in alto restavano coperte. Causa: l'area
che scorre è un `<div>` interno che non sa della tastiera, e l'unica mossa
che restava a iOS era spostare il visual viewport. Ora
`src/lib/campoSopraTastiera.ts` (usato da `AreaContenuto` nel layout con la
tab bar) riporta a zero lo spostamento e fa scorrere l'area fino a mostrare
il campo sopra la tastiera, con uno spazio in fondo alto quanto la tastiera.
Gli sheet (`role="dialog"`) e `/aggiungi` restano sopra la tastiera come
deciso il 24/09. Oggi non ha campi di testo, quindi nessun difetto lì.

- Aperto: provabile solo su iPhone vero, non verificato qui.

## 2026-09-26 — next dev non riscrive più CLAUDE.md

Branch `profilo-rifacimento`, commit e4aa380 (voce aggiunta qui perché
mancava). `agentRules: false` in `next.config.ts`: Next.js 16, quando `next
dev` lo lancia un agente AI, aggiungeva un blocco di regole in fondo a
`CLAUDE.md`, che poteva finire in un commit per sbaglio. `.impeccable/`
(stato locale del plugin di design) in `.gitignore`.

## 2026-09-26 — Profilo rifatto: un solo Salva, cambio vero o correzione, Esci

Branch `profilo-rifacimento`, da provare su iPhone (anteprima Vercel) prima
del merge. Un solo pulsante Salva per Dati personali, Obiettivo e Giorni
differenziati: scrive solo le tabelle delle sezioni cambiate, niente più
ordine obbligato né interruttore che salva da solo. Se cambia l'obiettivo o
un target, domanda "cambio vero" (periodo nuovo con data d'inizio
modificabile, dal giorno dopo l'inizio del periodo in corso a oggi) o
"avevo sbagliato" (aggiorna il periodo in corso). "Registra peso" con il
suo pulsante, intestazione con nome/peso/altezza, tasto Esci. Logica in
`src/lib/profilo/salvataggioProfilo.ts`, con test permanenti.

- Bug corretto: ogni "Salva obiettivo" apriva un periodo nuovo anche per un
  refuso, con uno stacco finto nello storico.
- Decisione cambiata (regola A): un giorno precedente a tutti i periodi
  prende il più vecchio, non più null.
- Bug corretti: `valido_dal` e la data delle pesate usavano il giorno UTC
  (fra mezzanotte e le 2 era "ieri"); il Profilo sceglieva il periodo
  corrente per `updated_at`, Oggi per `valido_dal` — ora c'è una sola
  definizione (`periodoInCorso`, sul giorno logico). `obiettivoValidoPer`
  confronta `updated_at` come istante (`millisecondiDi`, spostata in
  `src/lib/istanti.ts`), non come stringa.
- Le decisioni di scrittura (crea o aggiorna, quale periodo) si prendono
  rileggendo Dexie dentro `salvaProfilo`; se nel frattempo è cambiato il
  periodo in corso non salva niente e fa ripetere.
- Esci solo da questo dispositivo (`scope: "local"`), mai offline né "a
  metà"; i dati locali restano (§9.6 rimandata).
- Aperto: non provato a schermo né contro il Supabase vero; il cambio
  scheda dalla tab bar con modifiche non salvate le perde senza avviso
  (accettato); i due periodi reali del 20 e 21/09 non toccati.

## 2026-09-25 — "Ricarica i dati dal tuo account" in Profilo

Branch `ripristina-dati-locali`, da provare sull'anteprima Vercel prima del
merge. Via d'uscita generale per uno stato locale incoerente: sostituisce i
dati di questo dispositivo con quelli di Supabase, senza logout
(`src/lib/sync/ripristino.ts`, PUNTO_DI_PARTENZA.md §9.2). Prima scarica
tutto in memoria (una tabella fallita → niente toccato), poi sostituisce in
una transazione Dexie; chiede conferma se ci sono modifiche non inviate, in
attesa o accantonate; tocca solo i dati dell'utente corrente, il catalogo
condiviso si sovrascrive senza cancellarlo. `discesa.ts`: paginazione
estratta in `pagineDaSupabase`, elenco tabelle unico in `TABELLE_DISCESA`.
8 test permanenti.

- Correzione di un fatto: i 10 pasti a schermo che hanno motivato il
  pulsante NON si risolvono con lui — i doppioni con id casuale erano
  ancora sul server, con 8 voci del Pranzo sotto. Si correggono sul server.
- Segnalato, non corretto: il seed dei pasti predefiniti dopo una discesa
  fallita può resuscitare un pasto cancellato apposta.
- Aperto: non provato a schermo né contro il Supabase vero.

## 2026-09-25 — Alimenti cancellati: l'app non decide più in silenzio

Branch `alimenti-cancellati`, da provare su iPhone (anteprima Vercel) prima
del merge. Regola scritta in `PUNTO_DI_PARTENZA.md` ("Alimenti
cancellati"): cancellare ritira dal futuro, non dal passato. Quattro
comportamenti visibili:

- avviso nello sheet del nome quando un pasto contiene alimenti cancellati
  ("Verrà salvato 1 alimento su 2…"); il salvataggio rifiuta se gli esclusi
  sono cambiati nel frattempo;
- stella a confronto stretto (era già così: solo commento e test);
- contenuto valido già salvato → barra informativa al tocco della stella,
  non errore di nome duplicato;
- "Annulla" dopo la cancellazione di un alimento (`BarraAnnulla`), che
  ripristina solo ciò che quella cancellazione ha toccato.

Il controllo del nome doppio si è spostato dentro
`salvaPastoComeComposizione` (rilegge Dexie), che ora ha cinque esiti.
Test permanenti in `composizioni.test.ts`. `Claude outputs/` in
`.gitignore`. Aperto: non ancora provato a schermo (tastiera iOS).

## 2026-09-24 — Due fantasmi sfuggiti alla correzione precedente

Prova sui dati reali di Supabase dopo il fix di poco prima (voce precedente):
la cascata funziona (timestamp nell'ordine giusto: voce, composizione,
alimento), ma emersi due difetti nuovi/residui, entrambi nella stessa
famiglia.

- **Bug 1**: si poteva salvare un pasto contenente un alimento già
  cancellato dal catalogo. Le voci di diario sopravvivono alla
  cancellazione del loro alimento (conservano la copia dei valori
  nutrizionali, giusto), ma `salvaPastoComeComposizione` copiava comunque
  quella voce in una nuova composizione — un fantasma creato DOPO la
  correzione precedente, non un residuo vecchio (visto su Supabase:
  composizione `74a9b00f`). Corretto: la funzione rilegge da sola il
  catalogo (stesso motivo di `rimuoviAlimentoDaPastiSalvati`, non fidarsi
  di uno stato React potenzialmente vecchio) ed esclude le voci il cui
  alimento non c'è più. Se dopo il filtro non resta nessuna voce, non crea
  una composizione vuota: restituisce `false`, e in Oggi lo sheet resta
  aperto con un messaggio invece di richiudersi come se avesse salvato.
- **Bug 2**: `composizioniCorrispondenti` (la stella "già salvato" e il
  toggle per togliere dai preferiti) confrontava le voci grezze di
  `composizioni_voci`, senza escludere quelle con l'alimento cancellato,
  mentre `pastiSalvati()` le esclude già — la stessa composizione risultava
  di N alimenti per la stella e di N-1 nell'elenco (visto su Supabase:
  composizione `cbd1ae1a`). Era lo stesso difetto già corretto poco prima fra
  elenco e controllo del nome doppio, sfuggito a una delle tre viste.
  Corretto facendo passare anche questa funzione da
  `vociValidePerComposizione`, la stessa regola unica.
- Verificato che non resti nessun altro punto che legga `composizioni_voci`
  per decidere se una composizione "conta ancora" fuori da quella funzione:
  restano tre letture dirette in `composizioni.ts`
  (`eliminaComposizione` e le due dentro `rimuoviAlimentoDaPastiSalvati`),
  ma sono cancellazioni/bookkeeping della cascata stessa, non domande di
  visibilità — anzi `rimuoviAlimentoDaPastiSalvati` non PUÒ usare il
  catalogo per questo, perché nell'ordine deciso in precedenza (cascata
  prima, cancellazione dell'alimento dopo) il catalogo al momento in cui gira
  mostra ancora l'alimento come valido.
- Cinque test permanenti nuovi (due in `composizioni.test.ts`, tre in
  `pastiSalvati.test.ts`) per entrambi i bug. Nessun bug aperto noto.

## 2026-09-24 — Pasto salvato "fantasma" quando l'ultimo alimento sparisce dal catalogo

- Bug: un pasto salvato ("Colazione") con un solo alimento, poi cancellato
  dal catalogo, restava tecnicamente esistente (`deleted_at` ancora null) ma
  invisibile in Preferiti — `pastiSalvati()` lo nascondeva perché non gli
  restava nessun alimento, mentre `esisteComposizioneConNome` guardava tutte
  le composizioni senza lo stesso filtro. Risalvare un pasto con lo stesso
  nome diceva "esiste già" per un pasto che nell'elenco non c'era. La riga
  reale ("Colazione") è già stata cancellata a mano su Supabase il
  2026-09-22; restava da correggere il codice.
- Regola implementata in `src/lib/repository/composizioni.ts`
  (`rimuoviAlimentoDaPastiSalvati`, agganciata in
  `CreaAlimentoForm.handleElimina`): cancellare un alimento dal catalogo
  toglie anche la sua riga da ogni pasto salvato che lo conteneva; se era
  l'ultimo alimento rimasto, cancella (logicamente) anche il pasto. Nessun
  avviso — valutato e scartato. Non tocca la cancellazione di una voce di
  diario, che resta un'operazione indipendente (verificato con un test).
- `esisteComposizioneConNome` ora usa la stessa regola di visibilità di
  `pastiSalvati()` (nuova `pastoSalvatoVisibile`, unico punto che decide "un
  pasto salvato conta ancora"): le due parti non possono più divergere come
  in questo bug.
- Ordine deciso in `handleElimina`: prima si toglie l'alimento dai pasti
  salvati, POI si cancella l'alimento — al contrario, un fallimento a metà
  ricrea lo stesso fantasma ma invisibile (l'alimento già sparito, l'utente
  legge solo "errore" e non ha motivo di riprovare). In quest'ordine un
  guasto a metà lascia l'alimento ancora nel catalogo, visibile e
  rimediabile; il secondo tentativo converge comunque (entrambe le funzioni
  sono idempotenti). Valutata e scartata una transazione Dexie unica per le
  due scritture: `sincronizzaOutbox()` (lanciata da ogni scrittura del
  repository) fa vere chiamate di rete, incompatibili con la vita breve di
  una transazione IndexedDB.
- Tre test permanenti in `src/lib/repository/composizioni.test.ts` (ultimo
  alimento → pasto cancellato e nome riusabile; alimento fra altri → resta
  solo quella riga; voce di diario cancellata → pasto salvato invariato).
  Regola scritta anche in `PUNTO_DI_PARTENZA.md`, sezione sul modello dati.
  Nessun bug aperto noto.

## 2026-09-24 — Lezione: in Tailwind 4 alcune classi non falliscono, cambiano significato

Passando a Tailwind 4 (già in `package.json` da prima, scoperto lavorando
sugli sheet e sul focus qui sopra) sono emerse classi che **non danno errore,
non falliscono il build, non falliscono il lint — semplicemente non fanno più
quello che facevano in v3**, o non fanno niente:

- `ring-inset` (per l'anello di focus interno): in v3 combinato con `ring-*`
  disegnava l'anello dentro il bordo; in v4 non genera nessuna regola CSS
  per questo scopo — l'anello interno è un'utility a parte, `inset-ring-*`
  (`inset-ring-2`, `inset-ring-accent`, ecc.).
- `outline-none`: in v3 nascondeva il contorno di focus mantenendolo
  (trasparente) in modalità forced-colors/alto contrasto — l'opzione
  accessibile. In v4 lo stesso nome ora vuol dire `outline-style: none`
  secco, che lo toglie anche lì. Chi vuole il comportamento v3 deve scrivere
  `outline-hidden`.
- Preflight (gli stili di base, non le classi): il colore dei placeholder
  non è più un grigio fisso ma il colore corrente del testo al 50% di
  opacità — su testo quasi nero i placeholder sono più scuri di prima. E i
  `<button>` non hanno più `cursor: pointer` di default — da mouse sembrano
  non cliccabili.

**La lezione**: build e lint passano puliti in tutti questi casi, perché la
classe/lo stile esiste sintatticamente, produce solo CSS diverso (o nessuno).
L'unica verifica che vale è cercare la regola nel CSS generato dopo la build
(`.next/static/chunks/*.css`), non fidarsi del nome della classe né del fatto
che "compila". Dettagli e correzioni nelle voci sotto.

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
- *Integrato il 2026-09-26, ricostruito dal diff:* nuova
  `giornoSettimanaDi()` in `src/lib/dataGiorno.ts` (con test), per
  confrontare una data con `profili.giorni_allenamento_default` quando si
  propone il tipo del giorno.
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
- *Integrato il 2026-09-26, ricostruito da diff e migration:*
  - i due versi li mette insieme il nuovo `src/lib/sync/orchestratore.ts`
    (`sincronizzaBidirezionale`: prima `scaricaTutto`, poi
    `sincronizzaOutbox`; `avviaSincronizzazioneAutomatica` aggancia i tre
    inneschi). Il componente `SincronizzaOutbox` è diventato
    `Sincronizzazione`, perché ora fa partire entrambi i versi (`7fc7ff6`);
  - per l'UUID v5 è entrata la dipendenza `uuid`, e `repository.crea()` ha
    un parametro `idEsplicito` per i casi con id deterministico (`bda3971`);
  - l'indice `pasti_user_nome_idx` rimosso qui era stato **creato la
    stessa mattina** (migration `indice_unico_pasti_per_utente`, 20/9 ore
    8:48, rimosso alle 12:12 con `rimuovi_indice_unico_pasti_nome`). Perché
    fosse stato creato non risulta né dai commit né dal documento: lo
    registro senza motivazione.

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
  di creazione, corretto lato Supabase con la migration
  `grant_authenticated_obiettivi_target_giorni`), righe di un vecchio account di
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
- *Integrato il 2026-09-26, ricostruito da diff e migration:* le colonne
  nuove su `profili` sono `differenzia_giorni` (boolean, NOT NULL con
  default) e `giorni_allenamento_default` (elenco di giorni della
  settimana, tipo `GiornoSettimana`), dalla migration
  `profili_giorni_differenziati` del 19/9. Nessun bump Dexie: sul
  dispositivo il campo si legge sempre con `?? false` (commento in
  `tipi.ts`). Il `CHECK` tolto è la migration `allenta_check_tipo_giorno`.

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

## 2026-09-06 — Mockup di riferimento

Commit `44e4c28`, voce aggiunta a posteriori. In `docs/mockups/` le quattro
schermate di riferimento (Oggi, Aggiungi alimento, Statistiche, Profilo),
richiamate dalla sezione 3 di `PUNTO_DI_PARTENZA.md`. Solo immagini, nessun
codice.

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

## 2026-09-05 — Permessi di Claude Code dopo la ripulitura

Commit `093f099`, voce aggiunta a posteriori. `.claude/settings.json`:
aggiunti i permessi usati per la ripulitura del repo (commit, tag,
install/uninstall npm, cancellazione del codice v0). Nessun effetto
sull'app.

## 2026-09-05 — Leaked Password Protection: è a pagamento, resta spenta

Commit `b72545e`, voce aggiunta a posteriori. Corretta la nota in
`PUNTO_DI_PARTENZA.md`: l'avviso del linter Supabase su Leaked Password
Protection non si risolve gratis — verificato in dashboard, la funzione
c'è solo dal piano Pro (25$/mese). Resta disattivata per la regola "niente
servizi a pagamento senza avvisare"; da riconsiderare solo se l'app si
aprisse al pubblico.

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

## 2026-08-09 / 2026-09-04 — App v0 (codice superato)

Voce aggiunta a posteriori, per i commit precedenti a questo registro. È la
prima versione dell'app, poi ripulita (vedi "Livello dati local-first e
ripulitura repo" sopra): il suo codice non esiste più in `main`, resta
consultabile con il tag `v0-vecchia-app`.

- `4c84f2e` (08-09) progetto creato con Create Next App
- `2516f47` (08-09) login, registrazione, dashboard e middleware di auth
- `2d2a601` (08-09) dashboard, CRUD pasti manuali e storico filtrabile
- `1ff724d` (08-16) OCR delle etichette con Tesseract.js
- `5106f03` (08-16) scansione barcode + Open Food Facts, tema chiaro fisso
- `9a03927` (08-16) stima AI con Gemini (foto e testo), limite delle Server
  Actions, ridimensionamento immagini
- `2399add` (08-16) statistiche
- `441d9fc` (09-04) salvataggio dello stato v0 prima della ripulitura
