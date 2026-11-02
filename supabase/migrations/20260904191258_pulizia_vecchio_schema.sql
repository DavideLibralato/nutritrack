-- Rimuove le tabelle della vecchia applicazione (tutte a zero righe).
-- Lo schema auth di Supabase non viene toccato.
drop table if exists public.pasti cascade;
drop table if exists public.alimenti cascade;
drop table if exists public.profiles cascade;
