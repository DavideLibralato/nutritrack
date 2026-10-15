-- Migration `nomi_utente` (Amici, passo 2 del branch `amici`;
-- PUNTO_DI_PARTENZA.md §3 "Amici", §4 "Le tabelle di Amici", §9.6).
-- Testo esatto da passare ad apply_migration con questo nome: la versione
-- (timestamp) la assegna Supabase quando la si applica. apply_migration
-- esegue il file in una sola transazione: niente begin/commit qui.
--
-- Lo username di ogni utente, in una tabella sua e solo online: non entra
-- in Dexie, nella coda né nella discesa. Non sta in `profili` perché quella
-- riga non nasce alla registrazione (il 15/10: 6 utenti, 3 righe), passa
-- dalla coda, dove un vincolo unico violato la bloccherebbe, ed è privata
-- per costruzione, mentre lo username lo vedranno gli amici.
--
-- In questa migration NON c'è il trigger su auth.users (username e codice
-- di invito alla registrazione, §9.1): si applica dopo il merge di `amici`
-- e il deploy di produzione Ready, perché le anteprime usano questo stesso
-- database. Fino ad allora lo username si sceglie con imposta_username
-- (alla prima apertura di Amici, o da Profilo).
--
-- La tabella:
-- - username: solo `^[a-z][a-z0-9_]{2,19}$` (da 3 a 20 caratteri, prima
--   una lettera, poi lettere, cifre e `_`). Il formato ammette solo
--   minuscole, quindi l'indice unico su username è indifferente alle
--   maiuscole per costruzione, senza citext. L'app normalizza (spazi ai
--   bordi tolti, minuscolo) prima di inviare; le funzioni rifanno la
--   stessa normalizzazione, così "Marco" e "marco" danno la stessa
--   risposta anche se l'app sbagliasse;
-- - user_id unico: una riga per utente, cambiare nome = aggiornarla. Il
--   nome lasciato torna libero subito;
-- - le quattro colonne obbligatorie (CLAUDE.md): id con default lato
--   server (la tabella non è local-first, nessun client crea righe
--   offline), user_id ON DELETE CASCADE (Elimina il mio account la svuota
--   da sola, §9.6), updated_at con il trigger set_updated_at come le altre
--   tabelle, deleted_at che qui resta sempre null (nessuna cancellazione
--   logica: la riga si aggiorna, e sparisce solo con l'utente).
--
-- Sicurezza:
-- - RLS attiva nella stessa migration (A.6). Lettura: solo la propria
--   riga. La migration `amicizie` (passo 5) allargherà la lettura a chi
--   ha un'amicizia con te; prima di lei nessuno username altrui è
--   leggibile;
-- - nessuna policy di scrittura e nessun grant di scrittura: si scrive
--   solo da imposta_username. anon non ha nessun permesso sulla tabella;
-- - le due funzioni sono security definer con search_path = '' e nomi
--   completi, come elimina_mio_account (§9.6).
--
-- Permessi delle funzioni. In Postgres una funzione nuova è eseguibile da
-- PUBLIC; su Supabase riceve anche EXECUTE esplicito per anon e
-- authenticated (pg_default_acl, letto l'11/10). Quindi revoke da public,
-- anon e authenticated, poi i grant voluti:
-- - username_disponibile: anon e authenticated. La pagina Registrati non
--   ha ancora una sessione (decisione del 15/10, §9.6);
-- - imposta_username: solo authenticated.
--
-- Checklist A di CLAUDE.md:
-- - solo additiva: una tabella e due funzioni nuove, nessun oggetto
--   esistente toccato (A.1);
-- - RLS e policy nella stessa migration (A.6);
-- - dopo: get_advisors security e performance (A.7). Avvisi attesi e già
--   accettati il 15/10 (§9.6): authenticated_security_definer_function_
--   executable per tutte e due le funzioni, anon_security_definer_
--   function_executable per username_disponibile. Nessun altro avviso
--   nuovo: user_id ha il suo indice (unico), le policy usano
--   (select auth.uid());
-- - tipi.ts: tipo NomeUtente fuori da NomeTabella, confrontato con
--   information_schema.columns dopo l'applicazione (A.8).

create table public.nomi_utente (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z][a-z0-9_]{2,19}$'),
  creato_il timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.nomi_utente is
  'Username di ogni utente (Amici). Solo online, non sincronizzata. Si scrive solo da imposta_username.';

create unique index nomi_utente_username_key on public.nomi_utente (username);

create trigger set_updated_at
  before insert or update on public.nomi_utente
  for each row execute function public.set_updated_at();

alter table public.nomi_utente enable row level security;

create policy nomi_utente_select on public.nomi_utente
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.nomi_utente from anon, authenticated;
grant select on table public.nomi_utente to authenticated;

-- Sì o no: il nome, normalizzato, ha il formato giusto ed è libero? Non
-- dice a chi appartiene un nome preso, non accetta nomi parziali (nessun
-- LIKE): risponde solo sul nome esatto. Il proprio nome attuale risulta
-- preso: è l'app a non chiedere per quello.
create function public.username_disponibile(p_username text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nome text := lower(btrim(p_username));
begin
  if v_nome is null or v_nome !~ '^[a-z][a-z0-9_]{2,19}$' then
    return false;
  end if;

  return not exists (
    select 1 from public.nomi_utente where username = v_nome
  );
end;
$$;

comment on function public.username_disponibile(text) is
  'true se lo username (normalizzato) ha il formato giusto ed è libero. Solo sul nome esatto, chiamabile anche da anon.';

-- Sceglie o cambia lo username di chi la chiama. Risponde con un esito,
-- mai con un errore per i casi previsti:
-- - 'ok': salvato (anche se era già il suo nome: niente da cambiare);
-- - 'non_valido': formato sbagliato dopo la normalizzazione;
-- - 'occupato': il nome è di un altro utente. Lo decide l'indice unico,
--   non un controllo prima: due richieste insieme per lo stesso nome non
--   possono passare tutte e due.
-- Senza utente (auth.uid() null) → errore, come elimina_mio_account.
create function public.imposta_username(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := auth.uid();
  v_nome text := lower(btrim(p_username));
begin
  if v_utente is null then
    raise exception 'imposta_username: nessun utente autenticato';
  end if;

  if v_nome is null or v_nome !~ '^[a-z][a-z0-9_]{2,19}$' then
    return 'non_valido';
  end if;

  begin
    insert into public.nomi_utente (user_id, username)
    values (v_utente, v_nome)
    on conflict (user_id) do update
      set username = excluded.username
      where public.nomi_utente.username is distinct from excluded.username;
  exception
    when unique_violation then
      return 'occupato';
  end;

  return 'ok';
end;
$$;

comment on function public.imposta_username(text) is
  'Sceglie o cambia lo username di chi la chiama. Esiti: ok, non_valido, occupato.';

revoke all on function public.username_disponibile(text) from public, anon, authenticated;
grant execute on function public.username_disponibile(text) to anon, authenticated;

revoke all on function public.imposta_username(text) from public, anon, authenticated;
grant execute on function public.imposta_username(text) to authenticated;
