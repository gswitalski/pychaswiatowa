-- Soft-delete musi ominąć politykę SELECT tabeli recipes, ponieważ zmieniony
-- rekord natychmiast przestaje spełniać deleted_at IS NULL. Ta wąska funkcja
-- nadal sprawdza właściciela na podstawie ID zalogowanego użytkownika.

create or replace function public.soft_delete_recipe(p_recipe_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_affected_rows integer;
begin
    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    update public.recipes
    set deleted_at = now()
    where id = p_recipe_id
      and user_id = v_user_id
      and deleted_at is null;

    get diagnostics v_affected_rows = row_count;

    return v_affected_rows = 1;
end;
$$;

revoke all on function public.soft_delete_recipe(bigint) from public;
grant execute on function public.soft_delete_recipe(bigint) to authenticated;

comment on function public.soft_delete_recipe(bigint) is
    'Wykonuje soft-delete jednego przepisu zalogowanego użytkownika; zwraca false, gdy nie znaleziono aktywnego własnego przepisu.';
