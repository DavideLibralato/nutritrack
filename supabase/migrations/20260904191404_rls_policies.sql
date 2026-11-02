-- =====================================================================
-- RLS su ogni tabella. Regola predefinita: user_id = auth.uid().
-- Eccezione: alimenti, catalogo condiviso in lettura.
-- =====================================================================

alter table public.profili           enable row level security;
alter table public.obiettivi         enable row level security;
alter table public.pasti             enable row level security;
alter table public.alimenti          enable row level security;
alter table public.voci_diario       enable row level security;
alter table public.composizioni      enable row level security;
alter table public.composizioni_voci enable row level security;
alter table public.misurazioni       enable row level security;
alter table public.preferiti         enable row level security;

-- ------------------------------------------------ tabelle strettamente private
create policy "profili_select" on public.profili for select to authenticated
  using (user_id = (select auth.uid()));
create policy "profili_insert" on public.profili for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "profili_update" on public.profili for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "profili_delete" on public.profili for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "obiettivi_select" on public.obiettivi for select to authenticated
  using (user_id = (select auth.uid()));
create policy "obiettivi_insert" on public.obiettivi for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "obiettivi_update" on public.obiettivi for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "obiettivi_delete" on public.obiettivi for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "pasti_select" on public.pasti for select to authenticated
  using (user_id = (select auth.uid()));
create policy "pasti_insert" on public.pasti for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "pasti_update" on public.pasti for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "pasti_delete" on public.pasti for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "voci_diario_select" on public.voci_diario for select to authenticated
  using (user_id = (select auth.uid()));
create policy "voci_diario_insert" on public.voci_diario for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "voci_diario_update" on public.voci_diario for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "voci_diario_delete" on public.voci_diario for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "composizioni_select" on public.composizioni for select to authenticated
  using (user_id = (select auth.uid()));
create policy "composizioni_insert" on public.composizioni for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "composizioni_update" on public.composizioni for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "composizioni_delete" on public.composizioni for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "composizioni_voci_select" on public.composizioni_voci for select to authenticated
  using (user_id = (select auth.uid()));
create policy "composizioni_voci_insert" on public.composizioni_voci for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "composizioni_voci_update" on public.composizioni_voci for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "composizioni_voci_delete" on public.composizioni_voci for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "misurazioni_select" on public.misurazioni for select to authenticated
  using (user_id = (select auth.uid()));
create policy "misurazioni_insert" on public.misurazioni for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "misurazioni_update" on public.misurazioni for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "misurazioni_delete" on public.misurazioni for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "preferiti_select" on public.preferiti for select to authenticated
  using (user_id = (select auth.uid()));
create policy "preferiti_insert" on public.preferiti for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "preferiti_update" on public.preferiti for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "preferiti_delete" on public.preferiti for delete to authenticated
  using (user_id = (select auth.uid()));

-- --------------------------------------------------------- alimenti (eccezione)
-- Lettura: il catalogo condiviso (user_id null) piu' i propri alimenti privati.
create policy "alimenti_select" on public.alimenti for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));

-- Inserimento: sempre a proprio nome e mai gia' verificato. Nessun utente puo'
-- creare direttamente righe del catalogo condiviso (user_id null).
create policy "alimenti_insert" on public.alimenti for insert to authenticated
  with check (user_id = (select auth.uid()) and verificato = false);

-- Modifica: solo i propri alimenti non verificati, e devono restare tali.
-- Le righe condivise (user_id null) e i verificati non sono modificabili da
-- nessuno: "per costruzione, non per attenzione" (sezione 10.8).
create policy "alimenti_update" on public.alimenti for update to authenticated
  using (user_id = (select auth.uid()) and verificato = false)
  with check (user_id = (select auth.uid()) and verificato = false);

create policy "alimenti_delete" on public.alimenti for delete to authenticated
  using (user_id = (select auth.uid()) and verificato = false);
