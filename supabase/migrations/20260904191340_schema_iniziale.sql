-- =====================================================================
-- Schema iniziale nutritrack (sezione 4 di PUNTO_DI_PARTENZA.md)
-- Campi tecnici su ogni tabella: id uuid generato dal client, user_id,
-- updated_at (assegnato dal server), deleted_at (cancellazione logica).
-- =====================================================================

-- updated_at lo scrive sempre il server: l'orologio del dispositivo non e'
-- affidabile e il last-write-wins si basa su questo valore (sezione 10.6).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profili
create table public.profili (
  id            uuid primary key,
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  nome          text,
  sesso         text not null default 'non_indicato'
                check (sesso in ('maschio','femmina','non_indicato')),
  data_nascita  date,
  altezza_cm    numeric(5,1),
  livello_attivita text not null default 'sedentario'
                check (livello_attivita in ('sedentario','leggero','moderato','attivo','molto_attivo')),
  creato_il     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- --------------------------------------------------------------- obiettivi
-- Storico dei target: cambiare obiettivo INSERISCE una riga, non ne modifica
-- una esistente. Serve a disegnare la linea obiettivo corretta sul passato.
create table public.obiettivi (
  id             uuid primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  valido_dal     date not null,
  tipo           text not null check (tipo in ('dimagrire','mantenere','massa')),
  kcal           integer not null,
  proteine_g     integer not null,
  carboidrati_g  integer not null,
  grassi_g       integer not null,
  peso_obiettivo numeric(5,1),
  creato_il      timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index obiettivi_user_valido_idx on public.obiettivi (user_id, valido_dal desc);

-- ------------------------------------------------------------------- pasti
-- Le fasce della giornata. Solo ora_inizio: un pasto dura fino all'inizio
-- del successivo, cosi' per costruzione niente buchi e niente sovrapposizioni.
create table public.pasti (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  nome       text not null,
  ora_inizio time not null,
  ordine     integer not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index pasti_user_ordine_idx on public.pasti (user_id, ordine);

-- ---------------------------------------------------------------- alimenti
-- Unica tabella con user_id NULLABLE: null = catalogo condiviso.
create table public.alimenti (
  id                uuid primary key,
  user_id           uuid references auth.users(id) on delete set null,
  nome              text not null,
  marca             text,
  barcode           text,
  kcal_100g         numeric(7,2) not null,
  proteine_100g     numeric(7,2) not null default 0,
  carboidrati_100g  numeric(7,2) not null default 0,
  grassi_100g       numeric(7,2) not null default 0,
  -- previsti anche se non mostrati in V1
  zuccheri_100g     numeric(7,2),
  fibre_100g        numeric(7,2),
  saturi_100g       numeric(7,2),
  sale_100g         numeric(7,2),
  porzione_default_g numeric(7,2) not null default 100,
  fonte             text not null default 'manuale'
                    check (fonte in ('manuale','etichetta','barcode','off','ai','ricetta')),
  verificato        boolean not null default false,
  creato_il         timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index alimenti_nome_idx on public.alimenti (lower(nome));
create index alimenti_barcode_idx on public.alimenti (barcode) where barcode is not null;

-- ------------------------------------------------------------- voci_diario
-- data      = il giorno a cui il pasto appartiene (giorno logico, calcolato
--             una volta e memorizzato)
-- creato_il = quando l'hai scritto
-- consumato_alle = quando hai mangiato
-- I valori nutrizionali sono COPIATI qui: correggere un alimento nel catalogo
-- non deve riscrivere la storia passata.
create table public.voci_diario (
  id             uuid primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  alimento_id    uuid references public.alimenti(id) on delete set null,
  pasto_id       uuid references public.pasti(id) on delete set null,
  gruppo_id      uuid,
  data           date not null,
  quantita_g     numeric(7,2) not null,
  consumato_alle timestamptz,
  -- copia al momento dell'inserimento
  nome_alimento     text not null,
  kcal_100g         numeric(7,2) not null,
  proteine_100g     numeric(7,2) not null default 0,
  carboidrati_100g  numeric(7,2) not null default 0,
  grassi_100g       numeric(7,2) not null default 0,
  creato_il      timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index voci_diario_user_data_idx on public.voci_diario (user_id, data);
create index voci_diario_gruppo_idx on public.voci_diario (gruppo_id) where gruppo_id is not null;

-- ------------------------------------------------------------ composizioni
-- Una tabella sola per pasti salvati e ricette.
create table public.composizioni (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  nome       text not null,
  tipo       text not null check (tipo in ('pasto_salvato','ricetta')),
  -- valorizzato solo per tipo = 'ricetta': la riga in alimenti con fonte='ricetta'
  alimento_id uuid references public.alimenti(id) on delete set null,
  creato_il  timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index composizioni_user_idx on public.composizioni (user_id);

create table public.composizioni_voci (
  id             uuid primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  composizione_id uuid not null references public.composizioni(id) on delete cascade,
  alimento_id    uuid not null references public.alimenti(id) on delete cascade,
  quantita_g     numeric(7,2) not null,
  ordine         integer not null default 0,
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index composizioni_voci_comp_idx on public.composizioni_voci (composizione_id);

-- ------------------------------------------------------------- misurazioni
-- Righe, non colonne: aggiungere una misura in futuro e' un insert.
create table public.misurazioni (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  tipo       text not null,
  valore     numeric(7,2) not null,
  unita      text not null default 'kg',
  data       date not null,
  creato_il  timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index misurazioni_user_tipo_data_idx on public.misurazioni (user_id, tipo, data desc);

-- --------------------------------------------------------------- preferiti
create table public.preferiti (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  alimento_id uuid not null references public.alimenti(id) on delete cascade,
  creato_il   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (user_id, alimento_id)
);

-- ------------------------------------------------- trigger updated_at su tutte
create trigger set_updated_at before insert or update on public.profili
  for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.obiettivi
  for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.pasti
  for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.alimenti
  for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.voci_diario
  for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.composizioni
  for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.composizioni_voci
  for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.misurazioni
  for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.preferiti
  for each row execute function public.set_updated_at();
