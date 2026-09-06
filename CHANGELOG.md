# Changelog

Registro cronologico di cosa è stato fatto, più recente in alto. Per lo stato
attuale e le decisioni vedi `PUNTO_DI_PARTENZA.md` — qui c'è solo la storia.

---

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
