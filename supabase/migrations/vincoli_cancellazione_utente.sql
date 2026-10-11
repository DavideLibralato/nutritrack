-- Migration `vincoli_cancellazione_utente` (prima di "Elimina account",
-- PUNTO_DI_PARTENZA.md, "Difetti e verifiche aperti"). Testo esatto da
-- passare ad apply_migration con questo nome: la versione (timestamp) la
-- assegna Supabase quando la si applica. apply_migration esegue il file in
-- una sola transazione: niente begin/commit qui.
--
-- Cancellando un utente da auth.users:
-- - alimenti era SET NULL: le righe private restavano con user_id null e la
--   policy alimenti_select le mostrava a tutti come catalogo comune
--   (problema di privacy);
-- - giorni e obiettivi_target erano NO ACTION: la cancellazione falliva.
-- Tutti e quattro diventano CASCADE, come le altre tabelle.
--
-- Checklist A di CLAUDE.md:
-- - drop + add dello stesso vincolo, con lo stesso nome, nello stesso
--   ALTER TABLE: cambia solo l'azione ON DELETE, nessuna colonna e nessun
--   dato toccati (A.1);
-- - l'app non cancella mai fisicamente (deleted_at, sezione 9.2): il
--   comportamento cambia solo per DELETE da auth.users o da SQL Editor;
-- - verificato l'11/10: nessuna riga punta ad alimenti o obiettivi di un
--   altro utente, quindi il CASCADE non può toccare righe altrui;
-- - RLS e policy invariate (A.7: dopo, get_advisors security e performance).

alter table public.alimenti
  drop constraint alimenti_user_id_fkey,
  add constraint alimenti_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.giorni
  drop constraint giorni_user_id_fkey,
  add constraint giorni_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.obiettivi_target
  drop constraint obiettivi_target_user_id_fkey,
  add constraint obiettivi_target_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  drop constraint obiettivi_target_obiettivo_id_fkey,
  add constraint obiettivi_target_obiettivo_id_fkey
    foreign key (obiettivo_id) references obiettivi(id) on delete cascade;
