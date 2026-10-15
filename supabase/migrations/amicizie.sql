-- Migration `amicizie` (Amici, passo 5 del branch `amici`;
-- PUNTO_DI_PARTENZA.md §3 "Amici", "Le amicizie"; §4 "Le tabelle di
-- Amici"; §9.6). Testo esatto da passare ad apply_migration con questo
-- nome: la versione (timestamp) la assegna Supabase quando la si applica.
-- apply_migration esegue il file in una sola transazione: niente
-- begin/commit qui.
--
-- Le richieste di amicizia e le amicizie: una riga per coppia di utenti,
-- con user_id = chi ha chiesto e amico_id = chi riceve. Solo online: non
-- entra in Dexie, nella coda né nella discesa. In più allarga la lettura di
-- nomi_utente: lo username di un altro si legge solo se c'è una riga di
-- amicizie fra voi che puoi vedere.
--
-- La tabella:
-- - stato: in_attesa → accettata, oppure in_attesa → rifiutata. Mai al
--   contrario: una riga finita (annullata, rimossa, o rifiutata e superata
--   da una richiesta nuova) prende deleted_at, e per ricominciare nasce
--   una riga nuova;
-- - risposta_il: quando chi riceve ha accettato o rifiutato. Serve alla
--   regola dei 7 giorni: chi è stato rifiutato può richiedere alla stessa
--   persona solo quando risposta_il è più vecchio di 7×24 ore;
-- - rifiuto_visto: chi ha chiesto ha toccato Ok su "Non accettata". Da lì
--   la riga non la vede più, ma resta viva: i 7 giorni valgono ancora;
-- - un indice unico sulla coppia in qualunque ordine, solo sulle righe
--   vive: fra due persone c'è al massimo una riga viva, chiunque abbia
--   chiesto;
-- - le quattro colonne obbligatorie (CLAUDE.md): id con default lato
--   server (la tabella non è local-first), user_id ON DELETE CASCADE (e
--   così amico_id: Elimina il mio account toglie le righe di tutti e due i
--   lati, §9.6), updated_at con il trigger set_updated_at, deleted_at per
--   le righe finite.
--
-- Indici: oltre a quello sulla coppia, uno su user_id e uno su amico_id.
-- Quello sulla coppia comincia da least(...), un'espressione, quindi non
-- copre le due foreign key: senza i due indici semplici get_advisors
-- segnalerebbe "unindexed foreign keys", e la cascata alla cancellazione
-- di un utente dovrebbe scorrere tutta la tabella.
--
-- Sicurezza:
-- - RLS attiva nella stessa migration (A.6). Una sola policy, di lettura:
--   chi ha chiesto vede la riga viva, salvo un rifiuto già chiuso con Ok;
--   chi riceve vede la riga viva, salvo quella che ha rifiutato. Un
--   estraneo non vede niente;
-- - nessuna policy e nessun grant di scrittura: si scrive solo dalle
--   quattro funzioni, che controllano chi chiama e lo stato della riga.
--   anon non ha nessun permesso sulla tabella;
-- - le funzioni sono security definer con search_path = '' e nomi
--   completi, come imposta_username. Il proprietario (postgres) ignora la
--   RLS: dentro le funzioni ogni filtro su chi chiama è scritto a mano;
-- - ogni funzione risponde solo con un esito di testo, mai con un id, un
--   nome o altri dati. Senza utente autenticato → errore, come
--   imposta_username.
--
-- La lettura di nomi_utente (alter policy, non drop/create): la propria
-- riga, oppure quella di un utente con cui esiste una riga di amicizie che
-- POSSO LEGGERE. La sottoquery su amicizie è soggetta alla sua RLS, ed è
-- quello che vogliamo: "posso leggere la riga di amicizie" significa già
-- "sono uno dei due, la riga è viva, e non è un rifiuto nascosto a me".
-- Quindi lo username di A si legge da B mentre la richiesta è in attesa o
-- l'amicizia è accettata; da chi è stato rifiutato fino al suo Ok; mai da
-- chi ha rifiutato, mai da un estraneo, mai dopo la rimozione. Una regola
-- sola, scritta una volta nella policy di amicizie: se cambia lì, cambia
-- anche chi legge gli username. Nessuna ricorsione: la policy di amicizie
-- non legge nomi_utente.
--
-- Concorrenza in chiedi_amicizia: due persone che si chiedono l'amicizia
-- nello stesso istante. Tutte e due non trovano righe vive e provano a
-- inserire; la seconda insert aspetta la prima sull'indice unico della
-- coppia e, quando la prima transazione finisce, fallisce con
-- unique_violation. La funzione la intercetta e rilegge la riga che ora
-- c'è (in Read Committed ogni istruzione vede ciò che è già confermato):
-- se l'ha chiesta l'altro diventa accettata ('accettata'), se l'ho chiesta
-- io è 'gia_chiesta'. Al massimo tre giri, poi l'errore vero: non succede
-- se non con un guasto, e ripetere all'infinito nasconderebbe il guasto.
-- La riga trovata si legge con FOR UPDATE: chi arriva secondo su una riga
-- già esistente aspetta la prima risposta invece di decidere su uno stato
-- vecchio.
--
-- Alimenti in attesa alla rimozione di un amico: oggi
-- annulla_o_rimuovi_amicizia tocca solo amicizie, perché
-- alimenti_condivisi non esiste ancora. La migration alimenti_condivisi
-- (branch `condivisione-alimenti`) la ridefinirà con create or replace per
-- segnare `annullato` gli alimenti ancora in attesa fra i due.
--
-- Permessi delle funzioni: revoke da public, anon e authenticated (su
-- Supabase una funzione nuova riceve EXECUTE anche per anon e
-- authenticated, pg_default_acl), poi grant solo ad authenticated.
--
-- Checklist A di CLAUDE.md:
-- - solo additiva: una tabella e quattro funzioni nuove; su nomi_utente
--   cambia solo la condizione della policy di lettura (alter policy), nessun
--   DROP né RENAME (A.1);
-- - RLS e policy nella stessa migration (A.6);
-- - dopo: get_advisors security e performance (A.7). Avvisi attesi e già
--   accettati il 15/10 (§9.6): authenticated_security_definer_function_
--   executable per le quattro funzioni nuove. Nessun avviso nuovo di
--   performance: le foreign key hanno i loro indici, le policy usano
--   (select auth.uid());
-- - tipi.ts: tipo Amicizia fuori da NomeTabella, dopo l'applicazione,
--   confrontato con information_schema.columns (A.8).

create table public.amicizie (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amico_id uuid not null references auth.users(id) on delete cascade,
  stato text not null default 'in_attesa'
    check (stato in ('in_attesa', 'accettata', 'rifiutata')),
  risposta_il timestamptz,
  rifiuto_visto boolean not null default false,
  creato_il timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (user_id <> amico_id)
);

comment on table public.amicizie is
  'Richieste di amicizia e amicizie (Amici): una riga viva per coppia, user_id = chi chiede. Solo online. Si scrive solo dalle funzioni.';

create unique index amicizie_coppia_key on public.amicizie
  (least(user_id, amico_id), greatest(user_id, amico_id))
  where deleted_at is null;
create index amicizie_user_id_idx on public.amicizie (user_id);
create index amicizie_amico_id_idx on public.amicizie (amico_id);

create trigger set_updated_at
  before insert or update on public.amicizie
  for each row execute function public.set_updated_at();

alter table public.amicizie enable row level security;

create policy amicizie_select on public.amicizie
  for select to authenticated
  using (
    (user_id = (select auth.uid())
      and deleted_at is null
      and not (stato = 'rifiutata' and rifiuto_visto))
    or (amico_id = (select auth.uid())
      and deleted_at is null
      and stato <> 'rifiutata')
  );

revoke all on table public.amicizie from anon, authenticated;
grant select on table public.amicizie to authenticated;

alter policy nomi_utente_select on public.nomi_utente
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.amicizie a
      where a.user_id = nomi_utente.user_id
         or a.amico_id = nomi_utente.user_id
    )
  );

-- Chiede l'amicizia a chi ha lo username esatto. Esiti, solo testo:
-- 'senza_username' (chi chiama non ha ancora uno username), 'non_trovato'
-- (formato sbagliato o nome inesistente: non si distingue), 'sei_tu',
-- 'gia_amici', 'gia_chiesta', 'accettata' (l'altro ti aveva già chiesto:
-- ora siete amici), 'troppo_presto' (ti ha rifiutato meno di 7×24 ore fa),
-- 'inviata'.
create function public.chiedi_amicizia(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_io uuid := auth.uid();
  v_nome text := lower(btrim(p_username));
  v_altro uuid;
  v_riga public.amicizie%rowtype;
  v_giri int := 0;
begin
  if v_io is null then
    raise exception 'chiedi_amicizia: nessun utente autenticato';
  end if;

  if not exists (select 1 from public.nomi_utente where user_id = v_io) then
    return 'senza_username';
  end if;

  if v_nome is null or v_nome !~ '^[a-z][a-z0-9_]{2,19}$' then
    return 'non_trovato';
  end if;

  select user_id into v_altro from public.nomi_utente where username = v_nome;
  if v_altro is null then
    return 'non_trovato';
  end if;
  if v_altro = v_io then
    return 'sei_tu';
  end if;

  loop
    v_giri := v_giri + 1;

    select * into v_riga
    from public.amicizie
    where deleted_at is null
      and least(user_id, amico_id) = least(v_io, v_altro)
      and greatest(user_id, amico_id) = greatest(v_io, v_altro)
    for update;

    if found then
      if v_riga.stato = 'accettata' then
        return 'gia_amici';
      end if;

      if v_riga.stato = 'in_attesa' then
        if v_riga.user_id = v_io then
          return 'gia_chiesta';
        end if;
        update public.amicizie
        set stato = 'accettata', risposta_il = now()
        where id = v_riga.id;
        return 'accettata';
      end if;

      -- rifiutata. Chiesta da me: i 7 giorni dal rifiuto. Chiesta
      -- dall'altro (io l'avevo rifiutata): posso chiedere quando voglio.
      if v_riga.user_id = v_io
         and coalesce(v_riga.risposta_il, v_riga.updated_at) > now() - interval '7 days' then
        return 'troppo_presto';
      end if;
      update public.amicizie set deleted_at = now() where id = v_riga.id;
    end if;

    begin
      insert into public.amicizie (user_id, amico_id) values (v_io, v_altro);
      return 'inviata';
    exception
      when unique_violation then
        -- Una riga viva per la coppia è nata nel frattempo (l'altro mi ha
        -- chiesto l'amicizia nello stesso istante): si rilegge e si decide
        -- su quella.
        if v_giri >= 3 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

comment on function public.chiedi_amicizia(text) is
  'Chiede l''amicizia allo username esatto. Esiti: senza_username, non_trovato, sei_tu, gia_amici, gia_chiesta, accettata, troppo_presto, inviata.';

-- Risponde a una richiesta ricevuta. Esiti: 'ok', 'non_trovata',
-- 'senza_username' (accettare vuole uno username; rifiutare no). Solo chi
-- riceve, solo su una riga in_attesa. Se la riga è già nello stato che
-- questa stessa risposta chiede, 'ok': si può ripetere dopo una risposta
-- persa. Altrimenti 'non_trovata' (per esempio annullata nel frattempo).
create function public.rispondi_amicizia(p_id uuid, p_accetta boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_io uuid := auth.uid();
  v_riga public.amicizie%rowtype;
begin
  if v_io is null then
    raise exception 'rispondi_amicizia: nessun utente autenticato';
  end if;

  select * into v_riga
  from public.amicizie
  where id = p_id and amico_id = v_io and deleted_at is null
  for update;

  if not found then
    return 'non_trovata';
  end if;

  if v_riga.stato = 'in_attesa' then
    if p_accetta and not exists (select 1 from public.nomi_utente where user_id = v_io) then
      return 'senza_username';
    end if;
    update public.amicizie
    set stato = case when p_accetta then 'accettata' else 'rifiutata' end,
        risposta_il = now()
    where id = v_riga.id;
    return 'ok';
  end if;

  if (p_accetta and v_riga.stato = 'accettata')
     or (not p_accetta and v_riga.stato = 'rifiutata') then
    return 'ok';
  end if;

  return 'non_trovata';
end;
$$;

comment on function public.rispondi_amicizia(uuid, boolean) is
  'Accetta o rifiuta una richiesta ricevuta. Esiti: ok, non_trovata, senza_username.';

-- Annulla una richiesta mandata (chi ha chiesto, riga in_attesa) o rimuove
-- un'amicizia (uno dei due, riga accettata): deleted_at. Esiti: 'ok',
-- 'non_trovata'. Non vale su una riga rifiutata: chi è stato rifiutato la
-- cancellerebbe e aggirerebbe i 7 giorni. Oggi tocca solo amicizie: la
-- migration alimenti_condivisi la ridefinirà (create or replace) per
-- segnare `annullato` gli alimenti ancora in attesa fra i due.
create function public.annulla_o_rimuovi_amicizia(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_io uuid := auth.uid();
  v_id uuid;
begin
  if v_io is null then
    raise exception 'annulla_o_rimuovi_amicizia: nessun utente autenticato';
  end if;

  select id into v_id
  from public.amicizie
  where id = p_id
    and deleted_at is null
    and ((stato = 'in_attesa' and user_id = v_io)
      or (stato = 'accettata' and v_io in (user_id, amico_id)))
  for update;

  if v_id is null then
    return 'non_trovata';
  end if;

  update public.amicizie set deleted_at = now() where id = v_id;
  return 'ok';
end;
$$;

comment on function public.annulla_o_rimuovi_amicizia(uuid) is
  'Annulla una richiesta mandata o rimuove un''amicizia. Esiti: ok, non_trovata. Non vale su una riga rifiutata.';

-- L'Ok su "Non accettata": solo chi ha chiesto, solo su una riga
-- rifiutata. Mette rifiuto_visto e nient'altro: la riga resta viva per la
-- regola dei 7 giorni, ma da qui chi ha chiesto non la vede più. Esiti:
-- 'ok' (anche ripetuto), 'non_trovata'.
create function public.chiudi_rifiuto(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_io uuid := auth.uid();
begin
  if v_io is null then
    raise exception 'chiudi_rifiuto: nessun utente autenticato';
  end if;

  update public.amicizie
  set rifiuto_visto = true
  where id = p_id
    and user_id = v_io
    and stato = 'rifiutata'
    and deleted_at is null;

  if not found then
    return 'non_trovata';
  end if;
  return 'ok';
end;
$$;

comment on function public.chiudi_rifiuto(uuid) is
  'Ok su "Non accettata": chi ha chiesto non vede più il rifiuto, la regola dei 7 giorni resta. Esiti: ok, non_trovata.';

revoke all on function public.chiedi_amicizia(text) from public, anon, authenticated;
grant execute on function public.chiedi_amicizia(text) to authenticated;

revoke all on function public.rispondi_amicizia(uuid, boolean) from public, anon, authenticated;
grant execute on function public.rispondi_amicizia(uuid, boolean) to authenticated;

revoke all on function public.annulla_o_rimuovi_amicizia(uuid) from public, anon, authenticated;
grant execute on function public.annulla_o_rimuovi_amicizia(uuid) to authenticated;

revoke all on function public.chiudi_rifiuto(uuid) from public, anon, authenticated;
grant execute on function public.chiudi_rifiuto(uuid) to authenticated;
