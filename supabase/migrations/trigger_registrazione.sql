-- Migration `trigger_registrazione` (Amici, passo 8, su main dopo il merge
-- di `amici`; PUNTO_DI_PARTENZA.md §9.1 "Il codice di invito anche nel
-- database", §3 "Lo username"). Testo esatto da passare ad apply_migration
-- con questo nome: la versione (timestamp) la assegna Supabase quando la si
-- applica. apply_migration esegue il file in una sola transazione: niente
-- begin/commit qui.
--
-- PRIMA di applicarla deve esistere nel Vault il segreto `codice_invito`,
-- con lo stesso valore di CODICE_INVITO su Vercel (lo crea Davide dal SQL
-- Editor, §9.1 "La prima volta"). Senza, da qui in poi nessuno si registra.
--
-- Due trigger su auth.users, per OGNI riga nuova (dall'app, da una
-- chiamata diretta a signUp con la chiave pubblica, dalla dashboard di
-- Supabase): da qui in poi gli account nascono solo con il codice di
-- invito e uno username valido e libero.
-- - BEFORE INSERT (controlla_registrazione): il codice di invito dei
--   metadati deve essere uguale al segreto `codice_invito` del Vault.
--   Segreto assente o vuoto → rifiuta tutto (direzione sicura: mai
--   registrazione aperta per un dato mancante). Poi lo username: stessa
--   normalizzazione e stesso formato di imposta_username. Infine riscrive
--   i metadati: toglie `codice_invito` (il codice non resta salvato nella
--   riga dell'utente) e mette lo username già normalizzato;
-- - AFTER INSERT (crea_nome_utente_registrazione): la riga in nomi_utente.
--   Non può stare nel BEFORE: la riga in auth.users non esiste ancora e
--   la foreign key la rifiuterebbe. Nome già preso → errore, e la
--   registrazione si annulla tutta (stessa transazione di GoTrue). Il
--   controllo "libero" è l'indice unico, non una lettura prima: due
--   registrazioni nello stesso istante con lo stesso nome non passano
--   tutte e due.
--
-- Messaggi d'errore: tutti cominciano con "registrazione rifiutata:" e
-- dicono il motivo (codice di invito non configurato / non valido,
-- username non valido / già in uso). Non contengono mai il codice, né
-- quello scritto né quello giusto. GoTrue all'app risponde con un errore
-- generico ("Database error saving new user"): il motivo si legge nei log
-- di Postgres e Auth, il messaggio all'utente lo dà la Server Action, che
-- rifà gli stessi controlli prima di signUp.
--
-- Lo username resta nei metadati come "nome alla registrazione"
-- (normalizzato); l'app vale solo nomi_utente. Dopo il trigger la Server
-- Action continua a chiamare imposta_username dopo signUp: trova la riga
-- già fatta con lo stesso nome e risponde 'ok' senza cambiare niente.
--
-- Sicurezza delle funzioni: security definer (proprietario postgres, che
-- legge vault.decrypted_secrets e scrive nomi_utente; GoTrue entra come
-- supabase_auth_admin, che non può fare né l'una né l'altra cosa),
-- search_path = '' e nomi completi, come imposta_username. Non chiamabili
-- da nessuno: revoke da public, anon e authenticated (su Supabase una
-- funzione nuova riceve EXECUTE anche per anon e authenticated,
-- pg_default_acl). Il trigger le esegue lo stesso: Postgres controlla
-- EXECUTE sulla funzione solo a create trigger (lo fa postgres, il
-- proprietario), non quando il trigger scatta.
--
-- Il 16/10 su auth.users non c'è nessun altro trigger (letto da
-- pg_trigger): questi due non hanno un ordine da rispettare con altri.
--
-- In fondo: `codice_invito` tolto dai metadati degli account già esistenti
-- che ce l'hanno (il 16/10: 2 su 8, registrati dalla pagina Registrati
-- del passo 3 prima del trigger). Solo quella chiave, solo dove c'è; gli
-- altri campi dei metadati restano com'erano. updated_at di auth.users non
-- si tocca: è una colonna di GoTrue.
--
-- Checklist A di CLAUDE.md:
-- - solo additiva: due funzioni e due trigger nuovi, nessun DROP né
--   RENAME (A.1). L'unica modifica di dati è la rimozione della chiave
--   `codice_invito` dai metadati: un segreto che non doveva restare lì, non
--   un valore che cambia forma (A.2 non si applica);
-- - nessuna tabella nuova, quindi niente RLS nuova (A.6). nomi_utente ha
--   già RLS e non cambia;
-- - dopo: get_advisors security e performance (A.7). Avvisi attesi:
--   nessuno nuovo. Le due funzioni non sono eseguibili da anon né da
--   authenticated, quindi niente *_security_definer_function_executable;
--   search_path fissato, quindi niente function_search_path_mutable.
--   Restano quelli già accettati il 15/10 (§9.6) per username_disponibile,
--   imposta_username e le quattro funzioni di amicizie;
-- - tipi.ts: niente da cambiare, nessuna colonna nuova (A.8).

-- Prima del trigger: codice di invito e username. Riscrive i metadati
-- della riga che sta per nascere.
create function public.controlla_registrazione()
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

  if v_nome is null or v_nome !~ '^[a-z][a-z0-9_]{2,19}$' then
    raise exception 'registrazione rifiutata: username non valido';
  end if;

  new.raw_user_meta_data :=
    (new.raw_user_meta_data - 'codice_invito')
    || jsonb_build_object('username', v_nome);

  return new;
end;
$$;

comment on function public.controlla_registrazione() is
  'Trigger BEFORE INSERT su auth.users: codice di invito (segreto codice_invito del Vault) e formato dello username; toglie codice_invito dai metadati.';

-- Dopo il trigger: la riga in nomi_utente con lo username dei metadati,
-- già normalizzato e controllato da controlla_registrazione.
create function public.crea_nome_utente_registrazione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.nomi_utente (user_id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return null;
exception
  when unique_violation then
    raise exception 'registrazione rifiutata: username già in uso';
end;
$$;

comment on function public.crea_nome_utente_registrazione() is
  'Trigger AFTER INSERT su auth.users: crea la riga di nomi_utente. Nome già preso → errore, la registrazione si annulla.';

revoke all on function public.controlla_registrazione() from public, anon, authenticated;
revoke all on function public.crea_nome_utente_registrazione() from public, anon, authenticated;

create trigger controlla_registrazione
  before insert on auth.users
  for each row execute function public.controlla_registrazione();

create trigger crea_nome_utente_registrazione
  after insert on auth.users
  for each row execute function public.crea_nome_utente_registrazione();

update auth.users
set raw_user_meta_data = raw_user_meta_data - 'codice_invito'
where raw_user_meta_data ? 'codice_invito';
