-- obiettivi_target: i target per tipo di giorno, storicizzati insieme a obiettivi
create table public.obiettivi_target (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  obiettivo_id uuid not null references public.obiettivi(id),
  tipo_giorno text not null check (tipo_giorno in ('normale', 'allenamento')),
  kcal integer not null,
  proteine_g integer not null,
  carboidrati_g integer not null,
  grassi_g integer not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index obiettivi_target_obiettivo_tipo_idx
  on public.obiettivi_target (obiettivo_id, tipo_giorno)
  where deleted_at is null;

alter table public.obiettivi_target enable row level security;

create policy obiettivi_target_select on public.obiettivi_target
  for select using (user_id = (select auth.uid()));
create policy obiettivi_target_insert on public.obiettivi_target
  for insert with check (user_id = (select auth.uid()));
create policy obiettivi_target_update on public.obiettivi_target
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy obiettivi_target_delete on public.obiettivi_target
  for delete using (user_id = (select auth.uid()));

create trigger set_updated_at
  before insert or update on public.obiettivi_target
  for each row execute function public.set_updated_at();

-- giorni: tabella sparsa, una riga solo se il tipo del giorno e' stato deciso
create table public.giorni (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  data date not null,
  tipo_giorno text not null check (tipo_giorno in ('normale', 'allenamento')),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index giorni_user_data_idx
  on public.giorni (user_id, data)
  where deleted_at is null;

alter table public.giorni enable row level security;

create policy giorni_select on public.giorni
  for select using (user_id = (select auth.uid()));
create policy giorni_insert on public.giorni
  for insert with check (user_id = (select auth.uid()));
create policy giorni_update on public.giorni
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy giorni_delete on public.giorni
  for delete using (user_id = (select auth.uid()));

create trigger set_updated_at
  before insert or update on public.giorni
  for each row execute function public.set_updated_at();
