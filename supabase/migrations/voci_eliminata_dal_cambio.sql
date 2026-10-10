-- Migration `voci_eliminata_dal_cambio` (passo 5 di Pasti e orari,
-- PUNTO_DI_PARTENZA.md, sezione 4, `voci_diario`). Testo esatto da passare
-- ad apply_migration con questo nome: la versione (timestamp) la assegna
-- Supabase quando la si applica.
--
-- Il SEGNO di una voce cancellata da "Elimina pasto da una data" (o "da
-- oggi"): l'id del cambio, UUID v5 calcolato dall'app da riga di `pasti`
-- chiusa e data. L'Annulla dalla scheda "Non ci sarà più" ritrova le voci
-- con quel segno e le ricrea. Null per tutte le righe esistenti e per ogni
-- voce cancellata in altro modo, a mano compresa: quelle non tornano mai.
--
-- Checklist A di CLAUDE.md:
-- - solo additiva: nessun DROP, nessun RENAME (A.1);
-- - nullable, senza NOT NULL e senza default (A.4): le righe esistenti
--   restano con null, che è già il significato giusto, quindi niente
--   backfill (A.2);
-- - nessun vincolo, nessuna foreign key, nessun indice: un vincolo violato
--   bloccherebbe in silenzio la coda outbox (lo stesso motivo di `pasti`),
--   e la ricerca per segno si fa sul dispositivo;
-- - RLS invariata: le policy di voci_diario filtrano per user_id e coprono
--   già ogni colonna (A.6/A.7: dopo, get_advisors security e performance).

alter table public.voci_diario
  add column eliminata_dal_cambio uuid;

comment on column public.voci_diario.eliminata_dal_cambio is
  'Id del cambio programmato (Elimina pasto da una data) che ha cancellato la voce; null se viva o cancellata in altro modo.';
