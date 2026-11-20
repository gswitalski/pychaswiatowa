-- PS-108 follow-up: trigger records for recipes and families have different
-- column sets and therefore use separate trigger functions.

create or replace function public.recipe_family_check_recipe_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if exists (
        select 1 from public.recipe_families
        where id = case when tg_op = 'DELETE' then old.recipe_family_id else new.recipe_family_id end
          and deleted_at is null
    ) and not exists (
        select 1 from public.recipes
        where recipe_family_id = case when tg_op = 'DELETE' then old.recipe_family_id else new.recipe_family_id end
          and deleted_at is null
          and is_default
    ) then
        raise exception 'Active recipe family must have an active default variant'
            using errcode = '23514';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.recipe_family_check_family_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_family_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
begin
    if exists (
        select 1 from public.recipe_families
        where id = v_family_id and deleted_at is null
    ) and not exists (
        select 1 from public.recipes
        where recipe_family_id = v_family_id
          and deleted_at is null
          and is_default
    ) then
        raise exception 'Active recipe family must have an active default variant'
            using errcode = '23514';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists recipe_family_check_default on public.recipes;
create constraint trigger recipe_family_check_default
    after insert or update or delete on public.recipes
    deferrable initially deferred
    for each row execute function public.recipe_family_check_recipe_default();

drop trigger if exists recipe_family_check_default_on_family on public.recipe_families;
create constraint trigger recipe_family_check_default_on_family
    after insert or update or delete on public.recipe_families
    deferrable initially deferred
    for each row execute function public.recipe_family_check_family_default();
