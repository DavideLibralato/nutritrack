-- NON eseguire dal SQL Editor: si applica con apply_migration; le prove sono nel file prove_alimenti_catalogo_id.sql
--
-- Migration `alimenti_catalogo_id` (branch `catalogo`; PUNTO_DI_PARTENZA.md
-- §10.1, "Il modello"). Testo esatto da passare ad apply_migration con
-- questo nome: la versione (timestamp) la assegna Supabase quando la si
-- applica. apply_migration esegue il file in una sola transazione: niente
-- begin/commit qui.
--
-- Cosa fa: aggiunge a public.alimenti la colonna catalogo_id, l'id
-- dell'alimento del catalogo precaricato da cui viene una copia
-- (`ciqual:<codice Ciqual>` per gli sfusi, `off:<codice a barre>` per
-- quelli di marca; src/lib/catalogo/catalogoPrecaricato.json). «Aggiungi»
-- nel catalogo crea un alimento dell'utente, una riga nuova a ogni
-- aggiunta: questa colonna dice da dove viene, così la riga del catalogo
-- resta «Nei tuoi» anche dopo una rinomina, e la scheda «I miei» scrive
-- «dal catalogo» sotto la copia. Null per tutti gli altri alimenti: scritti
-- a mano, da un codice a barre, arrivati da un amico.
--
-- Additiva (CLAUDE.md, checklist A):
-- - una colonna nuova, null ammesso, nessun default: le 139 righe di oggi
--   restano come sono, con catalogo_id null;
-- - nessun CHECK e nessun indice: un vincolo violato bloccherebbe in
--   silenzio la coda outbox (lo stesso motivo per cui il 20/09 è stato
--   tolto l'indice sui nomi dei pasti). Il valore lo scrive solo l'app,
--   e la lettura per catalogo_id si fa in memoria sul dispositivo;
-- - RLS e policy di alimenti non cambiano e valgono anche per la colonna
--   nuova; i permessi su alimenti sono dati a livello di tabella
--   (authenticated: select, insert, update, delete), quindi la colonna li
--   eredita senza grant nuovi.
--
-- Client: chi non conosce la colonna non rompe niente. La discesa legge
-- `select *` e la tiene nella riga di Dexie; un invio (upsert) senza la
-- chiave catalogo_id lascia il valore che c'è sul server. Al contrario, un
-- client che la scrive prima che esista sarebbe rifiutato dal server (la
-- colonna non c'è): per questo la migration si applica PRIMA del push del
-- commit che la scrive.
--
-- Le funzioni di Amici non cambiano: manda_alimenti e
-- rispondi_alimenti_condivisi elencano le colonne una per una, quindi la
-- copia che riceve un amico nasce con catalogo_id null (è un alimento suo,
-- non «dal catalogo»).

alter table public.alimenti
  add column catalogo_id text;

comment on column public.alimenti.catalogo_id is
  'Id dell''alimento del catalogo precaricato da cui viene la copia (ciqual:<codice> o off:<codice a barre>); null per gli altri alimenti. Lo scrive solo l''app, senza vincoli: PUNTO_DI_PARTENZA.md §10.1.';
