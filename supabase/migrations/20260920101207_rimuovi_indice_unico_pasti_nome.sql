-- Con id deterministico (UUID v5 da utente + nome canonico) per i 5 pasti
-- predefiniti, due dispositivi non possono più produrre due righe diverse
-- per lo stesso pasto: upsert() le tratta come la stessa riga. L'indice
-- unico su (user_id, nome) protegge solo l'estetica (niente due pasti con
-- lo stesso nome a schermo) — nessun'altra tabella usa pasti.nome come
-- chiave, voci_diario punta a pasto_id. Il suo modo di fallire (violazione
-- vincolo -> voce outbox accantonata dopo 5 tentativi, in silenzio finché
-- non si ispeziona la coda) costava più di quanto il vincolo prevenisse.
drop index if exists public.pasti_user_nome_idx;
