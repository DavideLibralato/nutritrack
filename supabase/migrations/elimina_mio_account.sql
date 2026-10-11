-- Migration `elimina_mio_account` ("Elimina il mio account",
-- PUNTO_DI_PARTENZA.md §9.6). Testo esatto da passare ad apply_migration
-- con questo nome: la versione (timestamp) la assegna Supabase quando la
-- si applica. apply_migration esegue il file in una sola transazione:
-- niente begin/commit qui.
--
-- La funzione che l'app chiama (supabase.rpc) per cancellare l'account di
-- chi la chiama: DELETE da auth.users della riga con id = auth.uid(). Il
-- resto lo fanno le foreign key: dall'11/10 tutte quelle verso auth.users
-- sono ON DELETE CASCADE (migration vincoli_cancellazione_utente), e nello
-- schema auth identità, sessioni, refresh token e fattori MFA sono già
-- CASCADE (letto in pg_constraint l'11/10). Nessun trigger su auth.users.
--
-- Perché una funzione e non un route handler con auth.admin.deleteUser:
-- così la chiave di servizio, che può cancellare chiunque, non serve né su
-- Vercel (anteprime comprese, che usano il Supabase di produzione) né in
-- .env.local.
--
-- - security definer: gira con i permessi del proprietario (postgres, che
--   può cancellare da auth.users), non di chi la chiama;
-- - search_path = '' e nomi completi (auth.users, auth.uid()): nessuno può
--   far trovare alla funzione una tabella o una funzione sua con lo stesso
--   nome;
-- - nessun parametro: cancella solo l'utente del token con cui è chiamata,
--   quindi nessuno può cancellare un altro;
-- - auth.uid() null (chiamata senza utente) → errore, non "0 righe";
-- - idempotente: se l'utente non c'è più cancella 0 righe e non dà
--   errore. L'app può ritentare dopo una risposta persa senza danni (il
--   token resta valido fino alla scadenza anche a utente cancellato).
--
-- Permessi. In Postgres una funzione nuova è eseguibile da PUBLIC (cioè da
-- tutti); su Supabase, creata da supabase_admin, riceverebbe anche EXECUTE
-- esplicito per anon (pg_default_acl letto l'11/10). Quindi revoke da
-- public e da anon, e grant esplicito ad authenticated, che senza PUBLIC
-- resterebbe senza. Da verificare dopo l'applicazione con
-- has_function_privilege per anon (false) e authenticated (true).
--
-- Checklist A di CLAUDE.md:
-- - solo additiva: una funzione nuova, nessuna tabella o colonna toccata
--   (A.1);
-- - nessuna tabella nuova, quindi niente RLS da aggiungere (A.6);
-- - dopo: get_advisors security e performance (A.7). WARN atteso e già
--   accettato l'11/10 (PUNTO §9.6): funzione security definer eseguibile
--   da authenticated. È voluto: cancella solo l'utente che la chiama,
--   senza parametri;
-- - tipi.ts non cambia: nessuna tabella toccata (A.8).
--
-- File in Storage: oggi zero. Quando ci saranno file dell'utente (la foto
-- profilo), questa funzione o il flusso che la chiama dovrà cancellare
-- anche quelli: le foreign key non toccano i file.

create function public.elimina_mio_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'elimina_mio_account: nessun utente autenticato';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

comment on function public.elimina_mio_account() is
  'Cancella l''account di chi la chiama (auth.uid()) e, a cascata, tutti i suoi dati. Senza parametri, idempotente.';

revoke all on function public.elimina_mio_account() from public, anon;
grant execute on function public.elimina_mio_account() to authenticated;
