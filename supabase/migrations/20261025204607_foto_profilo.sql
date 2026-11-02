-- Migration `foto_profilo` (branch `foto-profilo`; PUNTO_DI_PARTENZA.md §3
-- "Profilo", "La foto profilo"; §4 "La foto profilo: solo online"; §9.6
-- "File in Storage"). Testo esatto da passare ad apply_migration con
-- questo nome: la versione (timestamp) la assegna Supabase quando la si
-- applica. apply_migration esegue il file in una sola transazione: niente
-- begin/commit qui.
--
-- Cosa crea:
-- 1. la tabella public.foto_profilo, solo online (come quelle di Amici):
--    una riga per utente con il percorso della sua foto nel bucket. Non sta
--    in `profili` perché la coda invia la riga intera di `profili`: un
--    telefono non ancora allineato che salva l'altezza riscriverebbe sul
--    server il percorso vecchio. E `profili` la legge solo il
--    proprietario, mentre la foto la vedono gli amici;
-- 2. la funzione imposta_foto_profilo(text), l'unico modo di scrivere la
--    tabella;
-- 3. il bucket privato `foto-profilo` (500 KB, solo image/jpeg);
-- 4. tre regole su storage.objects per quel bucket (aggiungere, leggere,
--    cancellare);
-- 5. elimina_mio_account sostituita (create or replace, stesso nome e
--    firma): in più rifiuta se nella cartella dell'utente c'è ancora un
--    file.
--
-- Il percorso di un file è sempre `<user_id>/<uuid>.jpg`, un solo livello,
-- con un nome nuovo a ogni cambio: un indirizzo nuovo non è mai in cache.
-- Lo controllano tre volte, in modo indipendente: la regola di inserimento
-- su storage.objects, il check della tabella, la funzione. Gli uuid sono
-- confrontati come testo minuscolo (crypto.randomUUID() li dà così), senza
-- conversioni a uuid che potrebbero fallire su un nome strano.
--
-- La tabella:
-- - user_id unico: una riga per utente, la crea la prima foto, cambiarla =
--   aggiornarla. percorso null = nessuna foto (dopo Elimina foto);
-- - le quattro colonne obbligatorie (CLAUDE.md): id con default lato
--   server (tabella non local-first, nessun client crea righe offline,
--   come nomi_utente), user_id ON DELETE CASCADE (Elimina il mio account
--   la svuota da sola), updated_at con il trigger set_updated_at,
--   deleted_at che qui resta sempre null (la riga si aggiorna, sparisce
--   solo con l'utente).
--
-- Chi legge (stessa regola per la riga e per il file): il proprietario e
-- chi ha con lui un'amicizia `accettata` non cancellata, chiunque dei due
-- l'abbia chiesta. Richieste in attesa, rifiutate e amicizie tolte non
-- bastano. La sottoquery su public.amicizie gira con la RLS di chi legge
-- (amicizie_select), che lascia vedere proprio le righe in cui c'è lui.
--
-- Perché le cancellazioni dei file non stanno in elimina_mio_account: su
-- storage.objects il trigger protect_objects_delete blocca i DELETE da SQL
-- (letto il 25/10), e togliere quelle righe a mano lascerebbe il file
-- orfano (documentazione Supabase, "Delete Objects"). I file li cancella
-- l'app con le API dello Storage, prima di chiamare la funzione; la
-- funzione controlla solo che la cartella sia vuota. Nessuna foreign key
-- lega storage.objects ad auth.users: senza questo controllo un account
-- cancellato potrebbe lasciare la sua foto sul server.
--
-- Permessi delle funzioni. In Postgres una funzione nuova è eseguibile da
-- PUBLIC; su Supabase riceve anche EXECUTE esplicito per anon e
-- authenticated (pg_default_acl, letto l'11/10). Quindi revoke da public e
-- anon, grant ad authenticated, come elimina_mio_account. Per
-- elimina_mio_account create or replace conserva i permessi che ha già
-- (mai drop e create: ridarebbe EXECUTE a PUBLIC, lezione del 23/10); i
-- revoke/grant del file originale si ripetono lo stesso, identici.
--
-- Checklist A di CLAUDE.md:
-- - solo additiva (A.1): tabella, funzione, bucket e regole nuove; una
--   funzione esistente sostituita con stesso nome, firma e permessi.
--   Nessuna tabella o colonna esistente toccata;
-- - RLS e policy della tabella nuova nella stessa migration (A.6);
-- - dopo: get_advisors security e performance (A.7). WARN atteso, dello
--   stesso tipo già accettato (§9.6): authenticated_security_definer_
--   function_executable per imposta_foto_profilo (scrive solo la riga di
--   chi la chiama). Nessun altro avviso nuovo: user_id ha il suo indice
--   (unico), le regole usano (select auth.uid()), amicizie ha già gli
--   indici su user_id e amico_id;
-- - tipi.ts: tipo FotoProfilo fuori da NomeTabella, da confrontare con
--   information_schema.columns dopo l'applicazione (A.8).
--
-- Prove: blocco annullato RESOCONTO in prove_foto_profilo.sql, nella
-- cartella del progetto, fuori da git.

-- 1. La tabella ------------------------------------------------------------

create table public.foto_profilo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  percorso text check (
    percorso is null
    or percorso ~ ('^' || user_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  ),
  creato_il timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.foto_profilo is
  'Percorso della foto profilo di ogni utente nel bucket foto-profilo. Solo online, non sincronizzata. Si scrive solo da imposta_foto_profilo.';

create trigger set_updated_at
  before insert or update on public.foto_profilo
  for each row execute function public.set_updated_at();

alter table public.foto_profilo enable row level security;

create policy foto_profilo_select on public.foto_profilo
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.amicizie a
      where a.stato = 'accettata'
        and a.deleted_at is null
        and (
          (a.user_id = (select auth.uid()) and a.amico_id = foto_profilo.user_id)
          or (a.amico_id = (select auth.uid()) and a.user_id = foto_profilo.user_id)
        )
    )
  );

revoke all on table public.foto_profilo from anon, authenticated;
grant select on table public.foto_profilo to authenticated;

-- 2. La funzione che scrive la tabella --------------------------------------

-- Imposta o toglie la foto di chi la chiama. Risponde con un esito, mai
-- con un errore per i casi previsti:
-- - 'ok': salvato (anche null: foto tolta, anche se non c'era);
-- - 'non_valido': il percorso non è `<il mio id>/<uuid>.jpg`;
-- - 'file_mancante': il file non c'è nel bucket (l'app lo carica prima).
-- Senza utente (auth.uid() null) → errore, come elimina_mio_account.
create function public.imposta_foto_profilo(p_percorso text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := auth.uid();
begin
  if v_utente is null then
    raise exception 'imposta_foto_profilo: nessun utente autenticato';
  end if;

  if p_percorso is null then
    update public.foto_profilo set percorso = null where user_id = v_utente;
    return 'ok';
  end if;

  if p_percorso !~ ('^' || v_utente::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$') then
    return 'non_valido';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'foto-profilo' and name = p_percorso
  ) then
    return 'file_mancante';
  end if;

  insert into public.foto_profilo (user_id, percorso)
  values (v_utente, p_percorso)
  on conflict (user_id) do update
    set percorso = excluded.percorso, deleted_at = null;
  return 'ok';
end;
$$;

comment on function public.imposta_foto_profilo(text) is
  'Imposta (percorso <mio id>/<uuid>.jpg, file già nel bucket) o toglie (null) la foto profilo di chi la chiama. Esiti: ok, non_valido, file_mancante.';

revoke all on function public.imposta_foto_profilo(text) from public, anon;
grant execute on function public.imposta_foto_profilo(text) to authenticated;

-- 3. Il bucket ---------------------------------------------------------------

-- Privato: nessun indirizzo pubblico, si legge solo con le regole qui
-- sotto (download dell'app o URL firmati). Limite e tipo li controlla il
-- server dello Storage al caricamento: una rete di sicurezza, il telefono
-- manda già JPEG da 25-60 KB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-profilo', 'foto-profilo', false, 512000, array['image/jpeg']);

-- 4. Le regole sui file ------------------------------------------------------

-- Aggiungere: solo `<il mio id>/<uuid>.jpg`. Nessuna regola di modifica:
-- un file non si sovrascrive mai, ogni cambio ha un nome nuovo.
create policy foto_profilo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'foto-profilo'
    and name ~ ('^' || (select auth.uid())::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  );

-- Leggere: il proprietario della cartella e i suoi amici accettati.
create policy foto_profilo_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'foto-profilo'
    and (
      split_part(objects.name, '/', 1) = (select auth.uid())::text
      or exists (
        select 1 from public.amicizie a
        where a.stato = 'accettata'
          and a.deleted_at is null
          and (
            (a.user_id = (select auth.uid())
              and a.amico_id::text = split_part(objects.name, '/', 1))
            or (a.amico_id = (select auth.uid())
              and a.user_id::text = split_part(objects.name, '/', 1))
          )
      )
    )
  );

-- Cancellare: solo nella propria cartella (Elimina foto, pulizia dopo un
-- cambio, Elimina account).
create policy foto_profilo_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'foto-profilo'
    and split_part(objects.name, '/', 1) = (select auth.uid())::text
  );

-- 5. elimina_mio_account, con il controllo dei file --------------------------

-- Come prima (versione 20261011155326), più un controllo: se nella
-- cartella dell'utente c'è ancora un file, errore e nessuna cancellazione
-- (la funzione gira in una transazione). L'app cancella i file prima di
-- chiamarla; il controllo copre il resto (una cancellazione fallita, un
-- altro telefono che carica una foto nel frattempo). Con zero file, come
-- per tutti fino all'arrivo del codice della foto, fa esattamente quello
-- che faceva prima.
create or replace function public.elimina_mio_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'elimina_mio_account: nessun utente autenticato';
  end if;

  if exists (
    select 1 from storage.objects
    where bucket_id = 'foto-profilo'
      and split_part(name, '/', 1) = auth.uid()::text
  ) then
    raise exception 'elimina_mio_account: la foto profilo non è ancora stata cancellata';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

comment on function public.elimina_mio_account() is
  'Cancella l''account di chi la chiama (auth.uid()) e, a cascata, tutti i suoi dati. Rifiuta se nel bucket foto-profilo resta un suo file. Senza parametri, idempotente.';

revoke all on function public.elimina_mio_account() from public, anon;
grant execute on function public.elimina_mio_account() to authenticated;
