-- Variant soft delete was overwritten by recipe_family_guard_recipe, which
-- copies recipe_families.deleted_at onto the recipe unless app.recipe_family_sync is on.

create or replace function public.delete_recipe_variant(
    p_recipe_id bigint, p_user_id uuid, p_is_admin boolean default false
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_family_id uuid; v_count integer; v_was_default boolean;
begin
    if not public.recipe_variants_allowed(p_is_admin) then raise exception 'Recipe variants feature is disabled' using errcode = 'P0003'; end if;
    select recipe_family_id, is_default into v_family_id, v_was_default from public.recipes where id=p_recipe_id and user_id=p_user_id and deleted_at is null for update;
    if v_family_id is null then raise exception 'Recipe not found' using errcode = 'P0002'; end if;
    select count(*) into v_count from public.recipes where recipe_family_id=v_family_id and deleted_at is null;
    if v_count < 2 then raise exception 'Cannot delete the last variant' using errcode = 'P0009'; end if;
    perform set_config('app.recipe_family_sync', 'on', true);
    update public.recipes set deleted_at=now(), is_default=false where id=p_recipe_id;
    if v_was_default then
        update public.recipes set is_default=true where id=(select id from public.recipes where recipe_family_id=v_family_id and deleted_at is null order by sort_order,id limit 1);
    end if;
    perform set_config('app.recipe_family_sync', 'off', true);
    delete from public.recipe_collections c using public.collections x where c.collection_id=x.id and c.recipe_id=p_recipe_id and x.user_id=p_user_id;
    delete from public.plan_recipes where recipe_id=p_recipe_id and user_id=p_user_id;
    delete from public.shopping_list_recipe_contributions where recipe_id=p_recipe_id and user_id=p_user_id;
    return true;
end;
$$;

revoke all on function public.delete_recipe_variant(bigint, uuid, boolean) from public, anon, authenticated;
grant execute on function public.delete_recipe_variant(bigint, uuid, boolean) to service_role;

do $$
begin
    if has_function_privilege('anon', 'public.delete_recipe_variant(bigint, uuid, boolean)', 'execute')
        or has_function_privilege('authenticated', 'public.delete_recipe_variant(bigint, uuid, boolean)', 'execute')
    then
        raise exception 'delete_recipe_variant privilege hardening failed';
    end if;
end;
$$;
