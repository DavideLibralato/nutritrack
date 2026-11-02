create unique index pasti_user_nome_idx
  on public.pasti (user_id, nome)
  where deleted_at is null;
