-- NON eseguire dal SQL Editor: si applica con apply_migration; le prove sono nel file prove_registrazione_username_facoltativo.sql
--
-- Migration `registrazione_username_facoltativo` (branch
-- `username-dopo-accesso`; PUNTO_DI_PARTENZA.md §3 "Lo username dopo
-- l'accesso" e §9.1). Testo esatto da passare ad apply_migration con questo
-- nome: la versione (timestamp) la assegna Supabase quando la si applica.
-- apply_migration esegue il file in una sola transazione: niente
-- begin/commit qui.
--
-- Lo username non si chiede più in Registrati ma nell'onboarding, dopo
-- l'accesso. I due trigger di registrazione su auth.users lo rendono
-- facoltativo; il codice di invito resta obbligatorio e si controlla prima
-- di tutto, come oggi.
--   - username assente, null o vuoto (il client nuovo, che non lo manda):
--     nessuna riga in nomi_utente, e la chiave `username` si toglie dai
--     metadati insieme a `codice_invito`;
--   - username presente (il client di oggi, ancora in produzione fino al
--     deploy del branch): tutto come prima. Formato controllato, valore
--     normalizzato riscritto nei metadati, riga in nomi_utente, nome già
--     preso = registrazione rifiutata.
-- Per questo si applica PRIMA delle prove sull'anteprima: con i trigger di
-- oggi il client nuovo verrebbe rifiutato ("username non valido"), e
-- anteprima e produzione usano lo stesso database.
--
-- create or replace conserva proprietario (postgres), permessi (EXECUTE solo
-- a postgres, verificato il 23/10) e i trigger che chiamano le due funzioni:
-- nessun create trigger e nessun grant qui. Il terzo trigger,
-- togli_codice_invito (BEFORE UPDATE), non cambia.

create or replace function public.controlla_registrazione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_segreto text;
  v_codice text := new.raw_user_meta_data ->> 'codice_invito';
  v_nome text := lower(btrim(new.raw_user_meta_data ->> 'username'));
begin
  select decrypted_secret into v_segreto
  from vault.decrypted_secrets
  where name = 'codice_invito';

  if v_segreto is null or v_segreto = '' then
    raise exception 'registrazione rifiutata: codice di invito non configurato';
  end if;

  if v_codice is null or v_codice <> v_segreto then
    raise exception 'registrazione rifiutata: codice di invito non valido';
  end if;

  -- Senza username: l'account nasce senza, lo sceglie nell'onboarding.
  if v_nome is null or v_nome = '' then
    new.raw_user_meta_data := new.raw_user_meta_data - 'codice_invito' - 'username';
    return new;
  end if;

  if v_nome !~ '^[a-z][a-z0-9_]{2,19}$' then
    raise exception 'registrazione rifiutata: username non valido';
  end if;

  new.raw_user_meta_data :=
    (new.raw_user_meta_data - 'codice_invito')
    || jsonb_build_object('username', v_nome);

  return new;
end;
$$;

create or replace function public.crea_nome_utente_registrazione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Il BEFORE INSERT ha già tolto uno username vuoto: qui il controllo è
  -- solo una rete di sicurezza, nel caso la chiave arrivasse comunque.
  if coalesce(btrim(new.raw_user_meta_data ->> 'username'), '') = '' then
    return null;
  end if;

  insert into public.nomi_utente (user_id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return null;
exception
  when unique_violation then
    raise exception 'registrazione rifiutata: username già in uso';
end;
$$;
