-- NON eseguire dal SQL Editor: si applica con apply_migration; le prove sono nel file prove_check_quantita_e_valori.sql
--
-- Migration `check_quantita_e_valori` (branch `check-quantita`;
-- PUNTO_DI_PARTENZA.md §4, "Vincoli sui numeri", e §11). Testo esatto da
-- passare ad apply_migration con questo nome: la versione (timestamp) la
-- assegna Supabase quando la si applica. apply_migration esegue il file in
-- una sola transazione: niente begin/commit qui.
--
-- Rete di sicurezza contro un bug futuro del client: i tipi numeric e
-- integer accettano 0 e i negativi, e oggi li ferma solo l'app. Si
-- aggiungono CHECK solo sui valori impossibili: quantità, porzione, altezza
-- e pesi maggiori di zero; valori nutrizionali e target zero o più. Il
-- massimo no: numeric(7,2) e numeric(5,1) lo impediscono già. I limiti
-- "fisici" dell'app (900 kcal per 100 g, 100 g di macro, 500 kg, 280 cm)
-- restano solo nel client: sono regole di inserimento, non dati impossibili.
--
-- Prima di scriverla (25/10):
-- - nessuna riga viola, comprese quelle cancellate (contano anche loro: una
--   cancellazione rimanda la riga intera);
-- - nessun percorso del client scrive 0, un negativo o un campo vuoto
--   diventato 0 in queste colonne (analisi del branch, PUNTO §11). I due
--   difetti trovati nel frattempo (peso obiettivo senza massimo, riga
--   "allenamento" con NaN) sono corretti nei commit 2 e 3, e non toccano
--   questi vincoli;
-- - alimenti_condivisi ha già gli stessi CHECK sui valori e sulla
--   porzione: alimenti si allinea, così i numeri passano da una tabella
--   all'altra (condividi, Aggiungi, Usa questi valori) con le stesse regole.
--
-- Una riga rifiutata da questi vincoli (errore 23514, status 400) conta
-- come rifiuto del server: dopo 5 giri la sync la accantona, senza perderla
-- (src/lib/sync/sincronizza.ts).
--
-- Additiva (CLAUDE.md, sezione A): nessuna colonna né dato toccato. ADD
-- CONSTRAINT semplice, senza NOT VALID: tabelle piccole (al 25/10 al massimo
-- 374 righe), il controllo delle righe esistenti dura millisecondi, e se una
-- riga non lo rispettasse la migration fallirebbe tutta senza cambiare
-- niente. Un ALTER per tabella: ogni tabella si legge una volta sola.
-- Nomi <tabella>_<colonna>_check, come quelli che Postgres ha dato ai CHECK
-- di alimenti_condivisi. Sulle colonne che ammettono null basta "> 0" o
-- ">= 0": un null passa il CHECK. Nessun cambio a Dexie: non cambiano né la
-- forma delle righe né gli indici.

alter table public.voci_diario
  add constraint voci_diario_quantita_g_check check (quantita_g > 0),
  add constraint voci_diario_kcal_100g_check check (kcal_100g >= 0),
  add constraint voci_diario_proteine_100g_check check (proteine_100g >= 0),
  add constraint voci_diario_carboidrati_100g_check check (carboidrati_100g >= 0),
  add constraint voci_diario_grassi_100g_check check (grassi_100g >= 0);

alter table public.composizioni_voci
  add constraint composizioni_voci_quantita_g_check check (quantita_g > 0);

alter table public.alimenti
  add constraint alimenti_kcal_100g_check check (kcal_100g >= 0),
  add constraint alimenti_proteine_100g_check check (proteine_100g >= 0),
  add constraint alimenti_carboidrati_100g_check check (carboidrati_100g >= 0),
  add constraint alimenti_grassi_100g_check check (grassi_100g >= 0),
  add constraint alimenti_zuccheri_100g_check check (zuccheri_100g >= 0),
  add constraint alimenti_fibre_100g_check check (fibre_100g >= 0),
  add constraint alimenti_saturi_100g_check check (saturi_100g >= 0),
  add constraint alimenti_sale_100g_check check (sale_100g >= 0),
  add constraint alimenti_porzione_default_g_check check (porzione_default_g > 0);

alter table public.profili
  add constraint profili_altezza_cm_check check (altezza_cm > 0);

alter table public.obiettivi
  add constraint obiettivi_peso_obiettivo_check check (peso_obiettivo > 0),
  add constraint obiettivi_kcal_check check (kcal >= 0),
  add constraint obiettivi_proteine_g_check check (proteine_g >= 0),
  add constraint obiettivi_carboidrati_g_check check (carboidrati_g >= 0),
  add constraint obiettivi_grassi_g_check check (grassi_g >= 0);

alter table public.obiettivi_target
  add constraint obiettivi_target_kcal_check check (kcal >= 0),
  add constraint obiettivi_target_proteine_g_check check (proteine_g >= 0),
  add constraint obiettivi_target_carboidrati_g_check check (carboidrati_g >= 0),
  add constraint obiettivi_target_grassi_g_check check (grassi_g >= 0);

alter table public.misurazioni
  add constraint misurazioni_valore_check check (valore > 0);
