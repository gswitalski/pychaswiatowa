-- PS-109: owner-managed recipe variants.

create table if not exists public.feature_flags (
    name text primary key,
    mode text not null check (mode in ('disabled', 'admin', 'all')),
    updated_at timestamptz not null default now()
);

insert into public.feature_flags (name, mode)
values ('recipe_variants', 'disabled')
on conflict (name) do nothing;

alter table public.feature_flags enable row level security;
revoke all on public.feature_flags from public, anon, authenticated;

create or replace function public.recipe_variants_allowed(p_is_admin boolean)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.feature_flags
        where name = 'recipe_variants'
          and (mode = 'all' or (mode = 'admin' and p_is_admin))
    );
$$;

create or replace function public.recipe_variants_list(
    p_recipe_id bigint,
    p_user_id uuid,
    p_is_admin boolean default false
)
returns table (
    recipe_id bigint,
    variant_name text,
    is_default boolean,
    sort_order integer,
    image_path text,
    diet_type public.recipe_diet_type,
    is_termorobot boolean,
    is_grill boolean,
    difficulty public.recipe_difficulty,
    servings smallint
)
language plpgsql security definer set search_path = public
as $$
declare v_family_id uuid;
begin
    if not public.recipe_variants_allowed(p_is_admin) then
        raise exception 'Recipe variants feature is disabled' using errcode = 'P0003';
    end if;
    select recipe_family_id into v_family_id
    from public.recipes
    where id = p_recipe_id and user_id = p_user_id and deleted_at is null;
    if v_family_id is null then
        return;
    end if;
    return query
    select r.id, r.variant_name, r.is_default, r.sort_order, r.image_path,
           r.diet_type, r.is_termorobot, r.is_grill, r.difficulty, r.servings
    from public.recipes r
    where r.recipe_family_id = v_family_id and r.user_id = p_user_id
      and r.deleted_at is null
    order by r.sort_order, r.id;
end;
$$;

create or replace function public.create_recipe_variant(
    p_recipe_id bigint,
    p_user_id uuid,
    p_variant_name text,
    p_source_recipe_id bigint default null,
    p_is_admin boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_family public.recipe_families%rowtype;
    v_source public.recipes%rowtype;
    v_recipe_id bigint;
    v_name text := btrim(p_variant_name);
begin
    if not public.recipe_variants_allowed(p_is_admin) then
        raise exception 'Recipe variants feature is disabled' using errcode = 'P0003';
    end if;
    if char_length(v_name) < 1 or char_length(v_name) > 150 then
        raise exception 'Variant name must contain 1 to 150 characters' using errcode = '22023';
    end if;
    select f.* into v_family
    from public.recipe_families f
    join public.recipes r on r.recipe_family_id = f.id
    where r.id = p_recipe_id and r.user_id = p_user_id and r.deleted_at is null
    for update;
    if not found then
        raise exception 'Recipe not found' using errcode = 'P0002';
    end if;
    if (select count(*) from public.recipes where recipe_family_id = v_family.id and deleted_at is null) >= 10 then
        raise exception 'Variant limit reached' using errcode = 'P0009';
    end if;
    if exists (
        select 1 from public.recipes
        where recipe_family_id = v_family.id and deleted_at is null
          and lower(variant_name) = lower(v_name)
    ) then
        raise exception 'Variant name already exists' using errcode = '23505';
    end if;
    if p_source_recipe_id is not null then
        select * into v_source
        from public.recipes
        where id = p_source_recipe_id and recipe_family_id = v_family.id
          and user_id = p_user_id and deleted_at is null;
        if not found then
            raise exception 'Source recipe not found' using errcode = 'P0002';
        end if;
    else
        select r.* into v_source from public.recipes r
        where r.id = p_recipe_id;
    end if;
    insert into public.recipes (
        user_id, name, description, category_id, ingredients, steps, tips,
        image_path, servings, is_termorobot, prep_time_minutes, total_time_minutes,
        diet_type, cuisine, difficulty, is_grill, visibility, recipe_family_id,
        variant_name, is_default, sort_order
    )
    values (
        p_user_id, v_family.name,
        case when p_source_recipe_id is null then null else v_source.description end,
        case when p_source_recipe_id is null then null else v_source.category_id end,
        case when p_source_recipe_id is null then '[]'::jsonb else v_source.ingredients end,
        case when p_source_recipe_id is null then '[]'::jsonb else v_source.steps end,
        case when p_source_recipe_id is null then '[]'::jsonb else v_source.tips end,
        null,
        case when p_source_recipe_id is null then null else v_source.servings end,
        case when p_source_recipe_id is null then false else v_source.is_termorobot end,
        case when p_source_recipe_id is null then null else v_source.prep_time_minutes end,
        case when p_source_recipe_id is null then null else v_source.total_time_minutes end,
        case when p_source_recipe_id is null then null else v_source.diet_type end,
        case when p_source_recipe_id is null then null else v_source.cuisine end,
        case when p_source_recipe_id is null then null else v_source.difficulty end,
        case when p_source_recipe_id is null then false else v_source.is_grill end,
        v_family.visibility, v_family.id, v_name, false,
        coalesce((select max(sort_order) + 1 from public.recipes
                  where recipe_family_id = v_family.id and deleted_at is null), 0)
    )
    returning id into v_recipe_id;
    if p_source_recipe_id is not null then
        insert into public.recipe_tags (recipe_id, tag_id)
        select v_recipe_id, tag_id from public.recipe_tags where recipe_id = p_source_recipe_id;
    end if;
    return jsonb_build_object(
        'recipe_id', v_recipe_id,
        'source_image_path', case when p_source_recipe_id is not null then v_source.image_path else null end,
        'image_warning', null
    );
end;
$$;

create or replace function public.rename_recipe_variant(
    p_recipe_id bigint, p_user_id uuid, p_variant_name text, p_is_admin boolean default false
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(p_variant_name);
begin
    if not public.recipe_variants_allowed(p_is_admin) then raise exception 'Recipe variants feature is disabled' using errcode = 'P0003'; end if;
    if char_length(v_name) < 1 or char_length(v_name) > 150 then raise exception 'Invalid variant name' using errcode = '22023'; end if;
    if exists (select 1 from public.recipes a join public.recipes b on b.recipe_family_id = a.recipe_family_id
        where a.id = p_recipe_id and a.user_id = p_user_id and a.deleted_at is null and b.deleted_at is null
        and b.id <> a.id and lower(b.variant_name) = lower(v_name)) then
        raise exception 'Variant name already exists' using errcode = '23505';
    end if;
    update public.recipes set variant_name = v_name
    where id = p_recipe_id and user_id = p_user_id and deleted_at is null;
    if not found then raise exception 'Recipe not found' using errcode = 'P0002'; end if;
    return true;
end;
$$;

create or replace function public.update_recipe_family(
    p_recipe_id bigint, p_user_id uuid, p_name text default null,
    p_visibility public.recipe_visibility default null, p_is_admin boolean default false
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_family_id uuid; v_name text := nullif(btrim(p_name), '');
begin
    if not public.recipe_variants_allowed(p_is_admin) then raise exception 'Recipe variants feature is disabled' using errcode = 'P0003'; end if;
    select recipe_family_id into v_family_id from public.recipes
    where id = p_recipe_id and user_id = p_user_id and deleted_at is null for update;
    if v_family_id is null then raise exception 'Recipe not found' using errcode = 'P0002'; end if;
    if v_name is not null and char_length(v_name) > 150 then raise exception 'Invalid family name' using errcode = '22023'; end if;
    update public.recipe_families set name = coalesce(v_name, name), visibility = coalesce(p_visibility, visibility)
    where id = v_family_id and user_id = p_user_id;
    return true;
end;
$$;

create or replace function public.set_default_recipe_variant(
    p_recipe_id bigint, p_user_id uuid, p_is_admin boolean default false
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_family_id uuid;
begin
    if not public.recipe_variants_allowed(p_is_admin) then raise exception 'Recipe variants feature is disabled' using errcode = 'P0003'; end if;
    select recipe_family_id into v_family_id from public.recipes
    where id = p_recipe_id and user_id = p_user_id and deleted_at is null for update;
    if v_family_id is null then raise exception 'Recipe not found' using errcode = 'P0002'; end if;
    update public.recipes set is_default = false where recipe_family_id = v_family_id and deleted_at is null;
    update public.recipes set is_default = true where id = p_recipe_id;
    return true;
end;
$$;

create or replace function public.reorder_recipe_variants(
    p_recipe_id bigint, p_user_id uuid, p_recipe_ids bigint[], p_is_admin boolean default false
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_family_id uuid; v_count integer;
begin
    if not public.recipe_variants_allowed(p_is_admin) then raise exception 'Recipe variants feature is disabled' using errcode = 'P0003'; end if;
    select recipe_family_id into v_family_id from public.recipes where id = p_recipe_id and user_id = p_user_id and deleted_at is null for update;
    if v_family_id is null then raise exception 'Recipe not found' using errcode = 'P0002'; end if;
    select count(*) into v_count from public.recipes where recipe_family_id = v_family_id and deleted_at is null;
    if coalesce(array_length(p_recipe_ids, 1), 0) <> v_count
       or (select count(distinct x) from unnest(p_recipe_ids) x) <> v_count
       or exists (select 1 from public.recipes where recipe_family_id = v_family_id and deleted_at is null and id <> all(p_recipe_ids))
       or exists (select 1 from unnest(p_recipe_ids) x left join public.recipes r on r.id=x and r.recipe_family_id=v_family_id and r.deleted_at is null where r.id is null)
    then raise exception 'Invalid variant order' using errcode = '22023'; end if;
    update public.recipes r set sort_order = x.ord - 1
    from unnest(p_recipe_ids) with ordinality x(id, ord)
    where r.id = x.id;
    return true;
end;
$$;

create or replace function public.recipe_variant_usage(
    p_recipe_id bigint, p_user_id uuid, p_is_admin boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_family_id uuid; v_plan bigint; v_collections bigint; v_shopping bigint;
begin
    if not public.recipe_variants_allowed(p_is_admin) then raise exception 'Recipe variants feature is disabled' using errcode = 'P0003'; end if;
    select recipe_family_id into v_family_id from public.recipes where id=p_recipe_id and user_id=p_user_id and deleted_at is null;
    if v_family_id is null then raise exception 'Recipe not found' using errcode = 'P0002'; end if;
    select count(*) into v_plan from public.plan_recipes p join public.recipes r on r.id=p.recipe_id where p.user_id=p_user_id and r.recipe_family_id=v_family_id and r.deleted_at is null;
    select count(*) into v_collections from public.recipe_collections c join public.collections x on x.id=c.collection_id join public.recipes r on r.id=c.recipe_id where x.user_id=p_user_id and r.recipe_family_id=v_family_id and r.deleted_at is null;
    select count(*) into v_shopping from public.shopping_list_recipe_contributions s join public.recipes r on r.id=s.recipe_id where s.user_id=p_user_id and r.recipe_family_id=v_family_id and r.deleted_at is null;
    return jsonb_build_object('plan', v_plan, 'collections', v_collections, 'shopping_list', v_shopping);
end;
$$;

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
    update public.recipes set deleted_at=now(), is_default=false where id=p_recipe_id;
    if v_was_default then
        update public.recipes set is_default=true where id=(select id from public.recipes where recipe_family_id=v_family_id and deleted_at is null order by sort_order,id limit 1);
    end if;
    delete from public.recipe_collections c using public.collections x where c.collection_id=x.id and c.recipe_id=p_recipe_id and x.user_id=p_user_id;
    delete from public.plan_recipes where recipe_id=p_recipe_id and user_id=p_user_id;
    delete from public.shopping_list_recipe_contributions where recipe_id=p_recipe_id and user_id=p_user_id;
    return true;
end;
$$;

create or replace function public.delete_recipe_family(
    p_recipe_id bigint, p_user_id uuid, p_is_admin boolean default false
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_family_id uuid;
begin
    if not public.recipe_variants_allowed(p_is_admin) then raise exception 'Recipe variants feature is disabled' using errcode = 'P0003'; end if;
    select recipe_family_id into v_family_id from public.recipes where id=p_recipe_id and user_id=p_user_id and deleted_at is null for update;
    if v_family_id is null then raise exception 'Recipe not found' using errcode = 'P0002'; end if;
    update public.recipe_families set deleted_at=now() where id=v_family_id and user_id=p_user_id;
    return true;
end;
$$;

-- The edge function verifies the JWT and passes its subject explicitly.
revoke all on function public.create_recipe_with_tags(
    uuid, text, text, bigint, text, text, text[], public.recipe_visibility,
    smallint, boolean, smallint, smallint, public.recipe_diet_type,
    public.recipe_cuisine, public.recipe_difficulty, boolean, text
) from public, anon, authenticated;
grant execute on function public.create_recipe_with_tags(
    uuid, text, text, bigint, text, text, text[], public.recipe_visibility,
    smallint, boolean, smallint, smallint, public.recipe_diet_type,
    public.recipe_cuisine, public.recipe_difficulty, boolean, text
) to service_role;

revoke all on function public.update_recipe_with_tags(
    bigint, uuid, text, text, bigint, text, text, text[], boolean,
    public.recipe_visibility, text, boolean, smallint, boolean, boolean, boolean,
    smallint, boolean, smallint, boolean, public.recipe_diet_type, boolean,
    public.recipe_cuisine, boolean, public.recipe_difficulty, boolean, boolean,
    boolean, text, boolean
) from public, anon, authenticated;
grant execute on function public.update_recipe_with_tags(
    bigint, uuid, text, text, bigint, text, text, text[], boolean,
    public.recipe_visibility, text, boolean, smallint, boolean, boolean, boolean,
    smallint, boolean, smallint, boolean, public.recipe_diet_type, boolean,
    public.recipe_cuisine, boolean, public.recipe_difficulty, boolean, boolean,
    boolean, text, boolean
) to service_role;

create or replace function public.soft_delete_recipe(p_recipe_id bigint, p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_family_id uuid;
begin
    select recipe_family_id into v_family_id
    from public.recipes
    where id = p_recipe_id and user_id = p_user_id and deleted_at is null
    for update;
    if v_family_id is null then return false; end if;
    perform set_config('app.recipe_family_sync', 'on', true);
    update public.recipe_families set deleted_at = now(), updated_at = now()
    where id = v_family_id and user_id = p_user_id;
    perform set_config('app.recipe_family_sync', 'off', true);
    return true;
end;
$$;
revoke all on function public.soft_delete_recipe(bigint, uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_recipe(bigint, uuid) to service_role;
revoke all on function public.soft_delete_recipe(bigint) from public, anon, authenticated;

do $$
declare v_name text; v_args text;
begin
    for v_name, v_args in
        select p.proname, pg_get_function_identity_arguments(p.oid)
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname in (
            'recipe_variants_list','create_recipe_variant','rename_recipe_variant',
            'update_recipe_family','set_default_recipe_variant','reorder_recipe_variants',
            'recipe_variant_usage','delete_recipe_variant','delete_recipe_family'
        )
    loop
        execute format('revoke all on function public.%I(%s) from public, anon, authenticated', v_name, v_args);
        execute format('grant execute on function public.%I(%s) to service_role', v_name, v_args);
    end loop;
end;
$$;

do $$
begin
    if has_function_privilege('anon', 'public.soft_delete_recipe(bigint, uuid)', 'execute')
        or has_function_privilege('authenticated', 'public.soft_delete_recipe(bigint, uuid)', 'execute')
        or has_function_privilege('anon', 'public.create_recipe_with_tags(uuid,text,text,bigint,text,text,text[],public.recipe_visibility,smallint,boolean,smallint,smallint,public.recipe_diet_type,public.recipe_cuisine,public.recipe_difficulty,boolean,text)', 'execute')
        or has_function_privilege('authenticated', 'public.create_recipe_with_tags(uuid,text,text,bigint,text,text,text[],public.recipe_visibility,smallint,boolean,smallint,smallint,public.recipe_diet_type,public.recipe_cuisine,public.recipe_difficulty,boolean,text)', 'execute')
    then
        raise exception 'PS-109 RPC privilege hardening failed';
    end if;
end;
$$;
