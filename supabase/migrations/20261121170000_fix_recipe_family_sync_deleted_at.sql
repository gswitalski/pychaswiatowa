-- Regresja: update_recipe_with_tags aktualizuje recipe_families (name/visibility),
-- a trigger recipe_family_sync_recipes nie może przywracać deleted_at na wariantach
-- już soft-deleted przez delete_recipe_variant.

create or replace function public.recipe_family_sync_recipes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.recipes
    set name = new.name,
        visibility = new.visibility,
        updated_at = now()
    where recipe_family_id = new.id
      and deleted_at is null;

    if new.deleted_at is not null then
        update public.recipes
        set deleted_at = new.deleted_at,
            updated_at = now()
        where recipe_family_id = new.id
          and deleted_at is null;
    end if;

    return new;
end;
$$;