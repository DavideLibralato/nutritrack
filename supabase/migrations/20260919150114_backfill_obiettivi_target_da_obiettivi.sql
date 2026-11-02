insert into public.obiettivi_target
  (id, user_id, obiettivo_id, tipo_giorno, kcal, proteine_g, carboidrati_g, grassi_g, deleted_at)
select
  gen_random_uuid(), o.user_id, o.id, 'normale', o.kcal, o.proteine_g, o.carboidrati_g, o.grassi_g, o.deleted_at
from public.obiettivi o;
