alter table public.profili
  add column differenzia_giorni boolean not null default false,
  add column giorni_allenamento_default text[];

alter table public.profili
  add constraint profili_giorni_allenamento_default_check
  check (
    giorni_allenamento_default is null
    or giorni_allenamento_default <@ array['lunedi','martedi','mercoledi','giovedi','venerdi','sabato','domenica']::text[]
  );
