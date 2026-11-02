-- La funzione handle_new_user() e' pensata per essere chiamata SOLO dal
-- trigger su auth.users (crea la riga di profilo alla registrazione).
-- Di default Postgres la rende comunque chiamabile "a mano" via API
-- REST (/rpc/handle_new_user) da chiunque, anche non loggato: togliamo
-- questo permesso, che non serve a nessuno. Il trigger continua a
-- funzionare perche' l'esecuzione via trigger non passa da questo
-- permesso.
revoke execute on function public.handle_new_user() from public;

-- Difesa in profondita' sulla update di profiles: la policy esistente
-- controllava gia' che si potesse aggiornare solo la propria riga (USING),
-- ma non c'era un controllo esplicito (WITH CHECK) su come deve essere
-- fatta la riga DOPO la modifica. Aggiungerlo blocca in modo esplicito
-- ogni tentativo di modificare la colonna "id" per "spostare" la riga
-- su un altro utente.
drop policy if exists "Utenti modificano solo il proprio profilo" on public.profiles;
create policy "Utenti modificano solo il proprio profilo"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
