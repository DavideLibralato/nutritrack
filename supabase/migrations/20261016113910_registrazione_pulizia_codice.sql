-- Migration `registrazione_pulizia_codice` (Amici, passo 8, su main;
-- PUNTO_DI_PARTENZA.md §9.1 "Il codice di invito anche nel database").
-- Testo esatto da passare ad apply_migration con questo nome: la versione
-- (timestamp) la assegna Supabase quando la si applica. apply_migration
-- esegue il file in una sola transazione: niente begin/commit qui.
--
-- Il difetto (trovato il 16/10 con la prima registrazione vera dopo
-- trigger_registrazione): il trigger BEFORE INSERT toglie `codice_invito`
-- dai metadati, ma circa 100 ms dopo GoTrue fa un UPDATE di
-- raw_user_meta_data (aggiunge sub, email, email_verified,
-- phone_verified) partendo dalla sua copia in memoria, che il codice lo
-- conteneva ancora. Il codice tornava così nella riga dell'utente.
--
-- Il rimedio: un terzo trigger, BEFORE UPDATE su auth.users, che toglie
-- `codice_invito` dai metadati ogni volta che ricompare. Scatta anche a
-- ogni accesso e aggiornamento di GoTrue, quindi NON deve mai dare
-- errore: nessun raise, e il `-` si applica solo a un oggetto JSON (su
-- null o su uno scalare non si tocca niente; `-` su uno scalare darebbe
-- errore). La clausola WHEN fa sì che la funzione parta solo quando la
-- chiave c'è: sugli aggiornamenti normali il costo è un controllo sul
-- JSON. Il BEFORE INSERT di trigger_registrazione resta com'è: è lui a
-- controllare il codice, e lo toglie già dalla riga che nasce.
--
-- Funzione security definer con search_path = '' come le altre due di
-- trigger_registrazione, non chiamabile da nessuno (revoke da public,
-- anon e authenticated: Postgres controlla EXECUTE solo a create
-- trigger, non quando scatta). Non legge né scrive altre tabelle.
--
-- In fondo: `codice_invito` tolto dagli account che lo hanno ancora (il
-- 16/10: uno, l'account di prova della registrazione vera). Solo quella
-- chiave; gli altri campi restano. Il trigger nuovo, creato prima, lo
-- toglierebbe comunque.
--
-- Checklist A di CLAUDE.md:
-- - solo additiva: una funzione e un trigger nuovi, nessun DROP né RENAME
--   (A.1). trigger_registrazione non si tocca;
-- - nessuna tabella nuova (A.6);
-- - dopo: get_advisors security e performance (A.7). Avvisi attesi:
--   nessuno nuovo (funzione non eseguibile da anon né da authenticated,
--   search_path fissato);
-- - tipi.ts: niente da cambiare (A.8).

-- Toglie `codice_invito` dai metadati di una riga aggiornata. Mai errori.
create function public.togli_codice_invito()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(new.raw_user_meta_data) = 'object' then
    new.raw_user_meta_data := new.raw_user_meta_data - 'codice_invito';
  end if;
  return new;
end;
$$;

comment on function public.togli_codice_invito() is
  'Trigger BEFORE UPDATE su auth.users: toglie codice_invito dai metadati quando GoTrue lo riscrive. Mai errori.';

revoke all on function public.togli_codice_invito() from public, anon, authenticated;

create trigger togli_codice_invito
  before update on auth.users
  for each row
  when (jsonb_typeof(new.raw_user_meta_data) = 'object'
        and new.raw_user_meta_data ? 'codice_invito')
  execute function public.togli_codice_invito();

update auth.users
set raw_user_meta_data = raw_user_meta_data - 'codice_invito'
where jsonb_typeof(raw_user_meta_data) = 'object'
  and raw_user_meta_data ? 'codice_invito';
