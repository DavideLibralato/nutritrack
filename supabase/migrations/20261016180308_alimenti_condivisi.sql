-- ⚠ NON eseguire dal SQL Editor. Questo file è la migration vera: la
-- applica Cowork con apply_migration, dopo l'"ok migration" di Davide.
-- Le prove stanno in un file a parte (blocco annullato).
--
-- Migration `alimenti_condivisi` (branch `condivisione-alimenti`, passo 2;
-- PUNTO_DI_PARTENZA.md §3 "Amici", "Condividere un alimento"; §4 "Le
-- tabelle di Amici"; §9.6). Testo esatto da passare ad apply_migration con
-- questo nome: la versione (timestamp) la assegna Supabase quando la si
-- applica. apply_migration esegue il file in una sola transazione: niente
-- begin/commit qui.
--
-- Gli alimenti mandati a un amico: una riga per alimento × destinatario,
-- con user_id = chi manda. Solo online: non entra in Dexie, nella coda né
-- nella discesa. Dentro c'è la COPIA dei valori presa dal telefono di chi
-- manda al momento dell'invio (le stesse colonne di `alimenti`, con gli
-- stessi tipi): se poi il mittente modifica o elimina il suo alimento, la
-- copia in attesa non cambia.
--
-- La tabella:
-- - alimento_origine_id: l'id dell'alimento del mittente, SENZA foreign
--   key (il mittente può cancellarlo). Serve solo a riconoscere lo stesso
--   alimento mandato di nuovo alla stessa persona;
-- - stato, sette valori:
--     in_attesa     → da decidere (l'unico che il destinatario vede);
--     aggiunto      → Aggiungi: la copia è nata in `alimenti`;
--     rifiutato     → Rifiuta / Tieni i miei;
--     uguale        → Ok su "Hai già questo alimento, con gli stessi valori";
--     valori_usati  → "Usa questi valori": il destinatario ha aggiornato il
--                     SUO alimento (dal telefono, con la coda); qui si
--                     chiude solo la condivisione. L'unico stato che si
--                     riapre (l'Annulla);
--     sostituito    → chiusa da un secondo invio dello stesso alimento
--                     alla stessa persona, prima della risposta;
--     annullato     → l'amicizia è finita con la condivisione in attesa;
-- - risposta_il: quando la riga è uscita da in_attesa;
-- - un indice unico parziale (mittente, destinatario, alimento d'origine)
--   sulle righe in attesa: chi riceve ne vede al massimo una per alimento,
--   la più recente. È la garanzia del "il secondo invio sostituisce il
--   primo", scritta nel database;
-- - le quattro colonne obbligatorie (CLAUDE.md). id senza default: lo
--   calcola manda_alimenti (sotto). deleted_at c'è perché è obbligatorio,
--   ma non si usa: lo stato basta.
--
-- Indici: quello unico parziale; (destinatario_id, stato) per la lettura
-- delle righe in attesa e per la foreign key; (user_id) per l'altra
-- foreign key (un indice parziale non conta per l'avviso "unindexed
-- foreign keys", e la cascata alla cancellazione di un utente scorrerebbe
-- la tabella).
--
-- Sicurezza:
-- - RLS attiva nella stessa migration (A.6). Una sola policy, di lettura:
--   il destinatario vede le righe in attesa. Chi manda non vede niente,
--   nemmeno i suoi invii: non sa se l'alimento è stato aggiunto o
--   rifiutato (decisione del 15/10);
-- - nessuna policy e nessun grant di scrittura: si scrive solo dalle
--   funzioni (decisione del 16/10: niente insert diretto, perché il
--   secondo invio deve chiudere la riga vecchia e l'invio a più amici è
--   tutto o niente). anon non ha nessun permesso sulla tabella;
-- - lo username di chi manda il destinatario lo legge con la policy di
--   nomi_utente che c'è già: una riga in attesa esiste solo con
--   un'amicizia accettata (la rimozione la porta ad `annullato`, sotto);
-- - le funzioni sono security definer con search_path = '' e nomi
--   completi, come quelle di amicizie. Il proprietario (postgres) ignora
--   la RLS: dentro le funzioni ogni filtro su chi chiama è scritto a mano;
-- - ogni funzione risponde solo con un esito di testo, mai con un id, un
--   nome o altri dati. Senza utente autenticato → errore.
--
-- Gli id calcolati (UUID v5, uuid-ossp è già installata nello schema
-- extensions):
-- - la riga di alimenti_condivisi: v5(NAMESPACE_CONDIVISIONI, "invio:
--   origine:destinatario"), dove `invio` è un uuid che il telefono genera
--   a ogni tocco su "Manda" e ripete nei tentativi. Un tentativo dopo una
--   risposta persa ricalcola gli stessi id, trova le righe già fatte e non
--   ne crea altre;
-- - la copia in `alimenti`: v5(NAMESPACE_COPIE, id della condivisione).
--   Aggiungi ripetuto dopo una risposta persa ricalcola lo stesso id, e
--   `on conflict (id) do nothing` non crea una seconda copia. Nessuna
--   foreign key da `alimenti` verso la condivisione: la copia è
--   indipendente da tutto.
-- I due namespace sono costanti di questo file, diversi da quelli usati
-- dall'app (giorni, pasti): servono solo qui.
--
-- Concorrenza:
-- - due invii dello stesso mittente insieme (due telefoni): un advisory
--   lock per mittente li mette in fila, così il secondo vede la riga del
--   primo e la sostituisce;
-- - invio e rimozione dell'amicizia insieme: manda_alimenti legge le
--   amicizie con FOR SHARE, annulla_o_rimuovi_amicizia la blocca con FOR
--   UPDATE. Se vince la rimozione, l'invio trova l'amicizia cancellata e
--   risponde non_amici; se vince l'invio, la rimozione trova le righe
--   nuove e le porta ad annullato;
-- - due risposte insieme sulla stessa riga: FOR UPDATE, la seconda decide
--   sullo stato lasciato dalla prima.
--
-- Checklist A di CLAUDE.md:
-- - solo additiva: una tabella, quattro funzioni nuove e una ridefinita
--   (annulla_o_rimuovi_amicizia, create or replace con la stessa firma: i
--   permessi restano), nessun DROP né RENAME (A.1);
-- - RLS e policy nella stessa migration (A.6);
-- - dopo: get_advisors security e performance (A.7). Avvisi attesi, del
--   tipo già accettato il 15/10 (§9.6): authenticated_security_definer_
--   function_executable per manda_alimenti, rispondi_alimenti_condivisi e
--   riapri_alimento_condiviso. Nessun avviso di performance nuovo: le
--   foreign key hanno i loro indici, la policy usa (select auth.uid());
-- - tipi.ts: tipo AlimentoCondiviso fuori da NomeTabella, dopo
--   l'applicazione, confrontato con information_schema.columns (A.8).

create table public.alimenti_condivisi (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  destinatario_id uuid not null references auth.users(id) on delete cascade,
  alimento_origine_id uuid not null,
  nome text not null check (char_length(btrim(nome)) between 1 and 200),
  marca text check (marca is null or char_length(marca) <= 200),
  barcode text check (barcode is null or char_length(barcode) <= 100),
  kcal_100g numeric(7,2) not null check (kcal_100g >= 0),
  proteine_100g numeric(7,2) not null check (proteine_100g >= 0),
  carboidrati_100g numeric(7,2) not null check (carboidrati_100g >= 0),
  grassi_100g numeric(7,2) not null check (grassi_100g >= 0),
  zuccheri_100g numeric(7,2) check (zuccheri_100g >= 0),
  fibre_100g numeric(7,2) check (fibre_100g >= 0),
  saturi_100g numeric(7,2) check (saturi_100g >= 0),
  sale_100g numeric(7,2) check (sale_100g >= 0),
  porzione_default_g numeric(7,2) not null check (porzione_default_g > 0),
  fonte text not null
    check (fonte in ('manuale', 'etichetta', 'barcode', 'off', 'ai', 'ricetta')),
  stato text not null default 'in_attesa'
    check (stato in ('in_attesa', 'aggiunto', 'rifiutato', 'uguale',
                     'valori_usati', 'sostituito', 'annullato')),
  risposta_il timestamptz,
  creato_il timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (user_id <> destinatario_id)
);

comment on table public.alimenti_condivisi is
  'Alimenti mandati a un amico (Amici): copia dei valori presa all''invio, una riga per alimento × destinatario, user_id = chi manda. Solo online. Si scrive solo dalle funzioni.';
comment on column public.alimenti_condivisi.alimento_origine_id is
  'Id dell''alimento del mittente, senza foreign key: riconosce lo stesso alimento mandato di nuovo.';

create unique index alimenti_condivisi_in_attesa_key on public.alimenti_condivisi
  (user_id, destinatario_id, alimento_origine_id)
  where stato = 'in_attesa' and deleted_at is null;
create index alimenti_condivisi_destinatario_idx on public.alimenti_condivisi
  (destinatario_id, stato);
create index alimenti_condivisi_user_id_idx on public.alimenti_condivisi (user_id);

create trigger set_updated_at
  before insert or update on public.alimenti_condivisi
  for each row execute function public.set_updated_at();

alter table public.alimenti_condivisi enable row level security;

create policy alimenti_condivisi_select on public.alimenti_condivisi
  for select to authenticated
  using (
    destinatario_id = (select auth.uid())
    and stato = 'in_attesa'
    and deleted_at is null
  );

revoke all on table public.alimenti_condivisi from anon, authenticated;
grant select on table public.alimenti_condivisi to authenticated;

-- Un valore numerico della copia, come arriva nel JSON di manda_alimenti:
-- un numero fra 0 e 99999.99 (il massimo di numeric(7,2)) dopo
-- l'arrotondamento a due decimali, oppure assente/null se il campo è
-- facoltativo. `p_positivo`: deve essere > 0 (la porzione). Il CASE
-- garantisce l'ordine dei controlli: il cast a numeric parte solo su un
-- numero JSON. Non è security definer, non legge tabelle, e nessuno la
-- chiama da fuori.
create function public.valore_condiviso_valido(
  p_valore jsonb,
  p_obbligatorio boolean,
  p_positivo boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_valore is null or jsonb_typeof(p_valore) = 'null' then not p_obbligatorio
    when jsonb_typeof(p_valore) <> 'number' then false
    when p_positivo then round(p_valore::text::numeric, 2) > 0
                         and round(p_valore::text::numeric, 2) <= 99999.99
    else round(p_valore::text::numeric, 2) >= 0
         and round(p_valore::text::numeric, 2) <= 99999.99
  end;
$$;

comment on function public.valore_condiviso_valido(jsonb, boolean, boolean) is
  'Controllo di un valore numerico per manda_alimenti: numero fra 0 e 99999.99 dopo l''arrotondamento, o null se facoltativo.';

-- Manda uno o più alimenti a uno o più amici, in una chiamata, tutto o
-- niente.
--
-- p_invio: uuid generato dal telefono a ogni tocco su "Manda", uguale nei
-- tentativi. p_destinatari: gli id degli amici. p_alimenti: un array JSON
-- di oggetti con la copia presa da Dexie: id (l'id dell'alimento del
-- mittente), nome, marca, barcode, kcal_100g, proteine_100g,
-- carboidrati_100g, grassi_100g, zuccheri_100g, fibre_100g, saturi_100g,
-- sale_100g, porzione_default_g, fonte.
--
-- Esiti, solo testo:
-- - 'non_valido': array vuoti o troppo lunghi (50 destinatari, 200
--   alimenti), un destinatario ripetuto o uguale a chi manda, lo stesso
--   alimento due volte, un campo mancante o fuori dai limiti;
-- - 'non_amici': almeno un destinatario non ha con chi manda un'amicizia
--   accettata. Non parte niente;
-- - 'ok'.
--
-- Per ogni coppia (destinatario, alimento): se la riga con l'id calcolato
-- esiste già (tentativo ripetuto) si salta; altrimenti la riga in attesa
-- dello stesso alimento per lo stesso destinatario, se c'è, diventa
-- `sostituito`, e nasce quella nuova. Una riga già risposta non si tocca:
-- il nuovo invio diventa una riga in attesa, che chi riceve vedrà come
-- doppione del suo alimento.
create function public.manda_alimenti(
  p_invio uuid,
  p_destinatari uuid[],
  p_alimenti jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  NAMESPACE_CONDIVISIONI constant uuid := 'ca3057c5-75f3-49b8-9a47-4eb8f08dc6f8';
  v_io uuid := auth.uid();
  v_n_destinatari int;
  v_n_alimenti int;
  v_errati int;
  v_amici int;
  v_dest uuid;
  v_e jsonb;
  v_origine uuid;
  v_id uuid;
begin
  if v_io is null then
    raise exception 'manda_alimenti: nessun utente autenticato';
  end if;

  -- --- Forma della richiesta ---
  if p_invio is null or p_destinatari is null or p_alimenti is null
     or jsonb_typeof(p_alimenti) <> 'array' then
    return 'non_valido';
  end if;

  v_n_destinatari := coalesce(cardinality(p_destinatari), 0);
  v_n_alimenti := jsonb_array_length(p_alimenti);
  if v_n_destinatari = 0 or v_n_destinatari > 50
     or v_n_alimenti = 0 or v_n_alimenti > 200 then
    return 'non_valido';
  end if;

  if array_position(p_destinatari, null) is not null
     or v_io = any(p_destinatari)
     or (select count(distinct d) from unnest(p_destinatari) d) <> v_n_destinatari then
    return 'non_valido';
  end if;

  -- Ogni alimento: un oggetto con tutti i campi giusti. I CASE fanno
  -- partire i cast solo su valori del tipo giusto.
  select count(*) into v_errati
  from jsonb_array_elements(p_alimenti) e
  where not coalesce(
    case when jsonb_typeof(e) <> 'object' then false else
      case when jsonb_typeof(e -> 'id') = 'string'
                and (e ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then true else false end
      and case when jsonb_typeof(e -> 'nome') = 'string'
               then char_length(btrim(e ->> 'nome')) between 1 and 200
               else false end
      and case when e -> 'marca' is null or jsonb_typeof(e -> 'marca') = 'null' then true
               when jsonb_typeof(e -> 'marca') = 'string' then char_length(e ->> 'marca') <= 200
               else false end
      and case when e -> 'barcode' is null or jsonb_typeof(e -> 'barcode') = 'null' then true
               when jsonb_typeof(e -> 'barcode') = 'string' then char_length(e ->> 'barcode') <= 100
               else false end
      and public.valore_condiviso_valido(e -> 'kcal_100g', true, false)
      and public.valore_condiviso_valido(e -> 'proteine_100g', true, false)
      and public.valore_condiviso_valido(e -> 'carboidrati_100g', true, false)
      and public.valore_condiviso_valido(e -> 'grassi_100g', true, false)
      and public.valore_condiviso_valido(e -> 'zuccheri_100g', false, false)
      and public.valore_condiviso_valido(e -> 'fibre_100g', false, false)
      and public.valore_condiviso_valido(e -> 'saturi_100g', false, false)
      and public.valore_condiviso_valido(e -> 'sale_100g', false, false)
      and public.valore_condiviso_valido(e -> 'porzione_default_g', true, true)
      and case when jsonb_typeof(e -> 'fonte') = 'string'
               then (e ->> 'fonte') in ('manuale', 'etichetta', 'barcode', 'off', 'ai', 'ricetta')
               else false end
    end,
    false);
  if v_errati > 0 then
    return 'non_valido';
  end if;

  if (select count(distinct lower(e ->> 'id')) from jsonb_array_elements(p_alimenti) e)
     <> v_n_alimenti then
    return 'non_valido';
  end if;

  -- --- In fila con gli altri invii dello stesso mittente ---
  perform pg_advisory_xact_lock(hashtextextended('manda_alimenti:' || v_io::text, 0));

  -- --- Tutti i destinatari devono essere amici (amicizia accettata) ---
  -- FOR SHARE: una rimozione in corso aspetta la fine di questo invio, e
  -- un invio che arriva dopo la rimozione non trova la riga.
  select count(*) into v_amici
  from (
    select 1
    from public.amicizie a
    where a.deleted_at is null
      and a.stato = 'accettata'
      and ((a.user_id = v_io and a.amico_id = any(p_destinatari))
        or (a.amico_id = v_io and a.user_id = any(p_destinatari)))
    for share
  ) s;
  if v_amici <> v_n_destinatari then
    return 'non_amici';
  end if;

  -- --- Le righe ---
  foreach v_dest in array p_destinatari loop
    for v_e in select value from jsonb_array_elements(p_alimenti) loop
      v_origine := (v_e ->> 'id')::uuid;
      v_id := extensions.uuid_generate_v5(
        NAMESPACE_CONDIVISIONI,
        p_invio::text || ':' || v_origine::text || ':' || v_dest::text
      );

      -- Tentativo ripetuto dopo una risposta persa: la riga c'è già.
      if exists (
        select 1 from public.alimenti_condivisi where id = v_id and user_id = v_io
      ) then
        continue;
      end if;

      update public.alimenti_condivisi
      set stato = 'sostituito', risposta_il = now()
      where user_id = v_io
        and destinatario_id = v_dest
        and alimento_origine_id = v_origine
        and stato = 'in_attesa'
        and deleted_at is null;

      insert into public.alimenti_condivisi (
        id, user_id, destinatario_id, alimento_origine_id,
        nome, marca, barcode,
        kcal_100g, proteine_100g, carboidrati_100g, grassi_100g,
        zuccheri_100g, fibre_100g, saturi_100g, sale_100g,
        porzione_default_g, fonte
      ) values (
        v_id, v_io, v_dest, v_origine,
        v_e ->> 'nome', nullif(v_e ->> 'marca', ''), nullif(v_e ->> 'barcode', ''),
        (v_e ->> 'kcal_100g')::numeric(7,2),
        (v_e ->> 'proteine_100g')::numeric(7,2),
        (v_e ->> 'carboidrati_100g')::numeric(7,2),
        (v_e ->> 'grassi_100g')::numeric(7,2),
        (v_e ->> 'zuccheri_100g')::numeric(7,2),
        (v_e ->> 'fibre_100g')::numeric(7,2),
        (v_e ->> 'saturi_100g')::numeric(7,2),
        (v_e ->> 'sale_100g')::numeric(7,2),
        (v_e ->> 'porzione_default_g')::numeric(7,2),
        v_e ->> 'fonte'
      );
    end loop;
  end loop;

  return 'ok';
end;
$$;

comment on function public.manda_alimenti(uuid, uuid[], jsonb) is
  'Manda uno o più alimenti a uno o più amici, tutto o niente; il secondo invio dello stesso alimento sostituisce il primo. Esiti: ok, non_amici, non_valido.';

-- Risponde a uno o più alimenti ricevuti, tutto o niente. p_risposta:
-- 'aggiungi' → aggiunto (la copia nasce in alimenti), 'rifiuta' →
-- rifiutato (Rifiuta e Tieni i miei), 'uguale' → uguale (Ok sui valori
-- identici), 'valori_usati' → valori_usati (il destinatario ha già
-- aggiornato il suo alimento dal telefono).
--
-- Esiti, solo testo:
-- - 'non_valido': risposta sconosciuta, elenco vuoto, più di 500 id o un
--   id null;
-- - 'non_trovata': almeno un id non è una riga ricevuta da chi chiama, o
--   è già chiusa in un altro modo (rifiutata, sostituita, annullata per
--   un'amicizia finita, ...). Non si scrive niente: la pagina rilegge
--   l'elenco;
-- - 'ok'. Una riga già nello stato che questa stessa risposta chiede
--   conta come fatta: si può ripetere dopo una risposta persa.
--
-- Aggiungi: la copia in alimenti con id v5 dalla condivisione, user_id di
-- chi accetta, verificato false, fonte del mittente (`ricetta` diventa
-- `manuale`: senza la sua composizione non sarebbe una ricetta). On
-- conflict (id) do nothing: mai una seconda copia. Il doppione con il
-- catalogo lo controlla l'app prima di chiamare (la regola sta in
-- doppioniAlimenti.ts, non sul server: PUNTO §3 "Mai due alimenti
-- uguali").
create function public.rispondi_alimenti_condivisi(p_ids uuid[], p_risposta text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  NAMESPACE_COPIE constant uuid := 'ddcf23e4-fa67-4c09-82be-7c390b58019d';
  v_io uuid := auth.uid();
  v_stato text;
  v_ids uuid[];
  v_buone int;
begin
  if v_io is null then
    raise exception 'rispondi_alimenti_condivisi: nessun utente autenticato';
  end if;

  v_stato := case p_risposta
    when 'aggiungi' then 'aggiunto'
    when 'rifiuta' then 'rifiutato'
    when 'uguale' then 'uguale'
    when 'valori_usati' then 'valori_usati'
  end;
  if v_stato is null or p_ids is null or coalesce(cardinality(p_ids), 0) = 0
     or cardinality(p_ids) > 500 or array_position(p_ids, null) is not null then
    return 'non_valido';
  end if;

  select array_agg(distinct i) into v_ids from unnest(p_ids) i;

  -- Le righe si bloccano tutte, in ordine di id (due risposte incrociate
  -- non si aspettano a vicenda all'infinito), e si controllano prima di
  -- scrivere: tutto o niente.
  perform 1
  from public.alimenti_condivisi
  where id = any(v_ids) and destinatario_id = v_io
  order by id
  for update;

  select count(*) into v_buone
  from public.alimenti_condivisi
  where id = any(v_ids)
    and destinatario_id = v_io
    and deleted_at is null
    and stato in ('in_attesa', v_stato);
  if v_buone <> cardinality(v_ids) then
    return 'non_trovata';
  end if;

  if v_stato = 'aggiunto' then
    insert into public.alimenti (
      id, user_id, nome, marca, barcode,
      kcal_100g, proteine_100g, carboidrati_100g, grassi_100g,
      zuccheri_100g, fibre_100g, saturi_100g, sale_100g,
      porzione_default_g, fonte, verificato
    )
    select
      extensions.uuid_generate_v5(NAMESPACE_COPIE, c.id::text), v_io, c.nome, c.marca, c.barcode,
      c.kcal_100g, c.proteine_100g, c.carboidrati_100g, c.grassi_100g,
      c.zuccheri_100g, c.fibre_100g, c.saturi_100g, c.sale_100g,
      c.porzione_default_g,
      case when c.fonte = 'ricetta' then 'manuale' else c.fonte end,
      false
    from public.alimenti_condivisi c
    where c.id = any(v_ids) and c.destinatario_id = v_io and c.stato = 'in_attesa'
    on conflict (id) do nothing;
  end if;

  update public.alimenti_condivisi
  set stato = v_stato, risposta_il = now()
  where id = any(v_ids) and destinatario_id = v_io and stato = 'in_attesa';

  return 'ok';
end;
$$;

comment on function public.rispondi_alimenti_condivisi(uuid[], text) is
  'Risponde a uno o più alimenti ricevuti, tutto o niente (aggiungi, rifiuta, uguale, valori_usati). Esiti: ok, non_trovata, non_valido.';

-- L'Annulla dopo "Usa questi valori": riporta in attesa una condivisione
-- chiusa con valori_usati. Solo il destinatario.
--
-- Esiti, solo testo:
-- - 'ok': riaperta; oppure era già in attesa (ripetizione dopo una
--   risposta persa); oppure nel frattempo lo stesso alimento è arrivato di
--   nuovo dallo stesso amico (c'è già una riga in attesa, più recente:
--   questa resta chiusa, e chi riceve ritrova l'alimento in arrivo);
-- - 'non_trovata': la riga non c'è, non è sua, è chiusa in un altro modo,
--   oppure l'amicizia non c'è più (riaprirla lascerebbe una condivisione
--   in attesa da un mittente di cui non si legge il nome).
create function public.riapri_alimento_condiviso(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_io uuid := auth.uid();
  v_riga public.alimenti_condivisi%rowtype;
begin
  if v_io is null then
    raise exception 'riapri_alimento_condiviso: nessun utente autenticato';
  end if;

  select * into v_riga
  from public.alimenti_condivisi
  where id = p_id and destinatario_id = v_io and deleted_at is null
  for update;

  if not found then
    return 'non_trovata';
  end if;
  if v_riga.stato = 'in_attesa' then
    return 'ok';
  end if;
  if v_riga.stato <> 'valori_usati' then
    return 'non_trovata';
  end if;

  perform 1
  from public.amicizie a
  where a.deleted_at is null
    and a.stato = 'accettata'
    and least(a.user_id, a.amico_id) = least(v_riga.user_id, v_io)
    and greatest(a.user_id, a.amico_id) = greatest(v_riga.user_id, v_io)
  for share;
  if not found then
    return 'non_trovata';
  end if;

  if exists (
    select 1 from public.alimenti_condivisi
    where user_id = v_riga.user_id
      and destinatario_id = v_io
      and alimento_origine_id = v_riga.alimento_origine_id
      and stato = 'in_attesa'
      and deleted_at is null
  ) then
    return 'ok';
  end if;

  update public.alimenti_condivisi
  set stato = 'in_attesa', risposta_il = null
  where id = v_riga.id;
  return 'ok';
end;
$$;

comment on function public.riapri_alimento_condiviso(uuid) is
  'Annulla di "Usa questi valori": riporta in attesa una condivisione chiusa con valori_usati. Solo il destinatario. Esiti: ok, non_trovata.';

-- annulla_o_rimuovi_amicizia, ridefinita (stessa firma, stessi permessi).
-- Uguale a quella della migration `amicizie`, più una cosa: quando
-- l'amicizia finisce, gli alimenti ancora in attesa fra i due, in tutte e
-- due le direzioni, diventano `annullato`. Le copie già aggiunte restano.
-- Su una richiesta ancora in attesa non c'è niente da annullare (senza
-- amicizia accettata non nascono condivisioni), ma l'update gira lo
-- stesso: costa un indice.
create or replace function public.annulla_o_rimuovi_amicizia(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_io uuid := auth.uid();
  v_id uuid;
  v_a uuid;
  v_b uuid;
begin
  if v_io is null then
    raise exception 'annulla_o_rimuovi_amicizia: nessun utente autenticato';
  end if;

  select id, user_id, amico_id into v_id, v_a, v_b
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

  update public.alimenti_condivisi
  set stato = 'annullato', risposta_il = now()
  where stato = 'in_attesa'
    and deleted_at is null
    and ((user_id = v_a and destinatario_id = v_b)
      or (user_id = v_b and destinatario_id = v_a));

  return 'ok';
end;
$$;

comment on function public.annulla_o_rimuovi_amicizia(uuid) is
  'Annulla una richiesta mandata o rimuove un''amicizia; gli alimenti in attesa fra i due diventano annullato. Esiti: ok, non_trovata. Non vale su una riga rifiutata.';

-- Permessi: revoke da public, anon e authenticated (su Supabase una
-- funzione nuova riceve EXECUTE anche per anon e authenticated,
-- pg_default_acl), poi grant solo ad authenticated. valore_condiviso_valido
-- non la chiama nessuno da fuori: niente grant. annulla_o_rimuovi_amicizia
-- tiene i permessi che aveva (create or replace non li cambia).
revoke all on function public.valore_condiviso_valido(jsonb, boolean, boolean)
  from public, anon, authenticated;

revoke all on function public.manda_alimenti(uuid, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.manda_alimenti(uuid, uuid[], jsonb) to authenticated;

revoke all on function public.rispondi_alimenti_condivisi(uuid[], text) from public, anon, authenticated;
grant execute on function public.rispondi_alimenti_condivisi(uuid[], text) to authenticated;

revoke all on function public.riapri_alimento_condiviso(uuid) from public, anon, authenticated;
grant execute on function public.riapri_alimento_condiviso(uuid) to authenticated;
