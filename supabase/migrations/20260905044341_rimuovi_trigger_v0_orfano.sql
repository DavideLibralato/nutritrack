-- Trigger e funzione rimasti dalla v0: dopo il drop di public.profiles
-- (migration pulizia_vecchio_schema) inserivano in una tabella che non
-- esiste più, facendo fallire ogni nuova registrazione con
-- "Database error saving new user". Andavano rimossi nella stessa
-- migration di pulizia, se n'era perso uno.
--
-- Nella nuova architettura la creazione della riga in `profili` (e dei
-- pasti predefiniti) non avviene qui: è compito della fase 1/3
-- dell'app, non di un trigger nascosto sul database.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
