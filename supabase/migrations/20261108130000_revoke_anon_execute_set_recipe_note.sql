-- Migration: Revoke anon EXECUTE on public.set_recipe_note (PS-31, hardening)
-- Dependencies: 20261108120000_create_user_recipe_notes.sql
--
-- Supabase nadaje domyslnie EXECUTE roli anon na nowych funkcjach schematu public;
-- `revoke ... from public` z poprzedniej migracji nie usuwa tego jawnego uprawnienia.
-- Notatki sa dostepne wylacznie dla zalogowanych uzytkownikow.

revoke all on function public.set_recipe_note(bigint, text) from anon;
revoke all on function public.set_recipe_note(bigint, text) from public;
grant execute on function public.set_recipe_note(bigint, text) to authenticated;
