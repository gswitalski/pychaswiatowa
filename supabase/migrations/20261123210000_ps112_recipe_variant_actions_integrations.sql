-- PS-112: variant-specific action state, plan availability and cleanup.

alter table public.shopping_list_items
    add column if not exists variant_name text null,
    add column if not exists active_variant_count integer null;

comment on column public.shopping_list_items.variant_name is
    'Snapshot of the recipe variant name at insertion time.';

create or replace function public.check_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    plan_count integer;
    recipe_accessible boolean;
    variants_allowed boolean := public.recipe_variants_allowed(false);
begin
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    select exists (
        select 1 from public.recipes r
        where r.id = new.recipe_id
          and r.deleted_at is null
          and (r.user_id = new.user_id or r.visibility = 'PUBLIC')
    ) into recipe_accessible;

    if not recipe_accessible then
        raise exception 'NOT_FOUND: Recipe not found or is not accessible';
    end if;

    select count(*) into plan_count
    from public.plan_recipes p
    join public.recipes r on r.id = p.recipe_id
    where p.user_id = new.user_id
      and (
          not variants_allowed
          or (r.deleted_at is null and (r.user_id = new.user_id or r.visibility = 'PUBLIC'))
      );

    if plan_count >= 50 then
        raise exception 'PLAN_LIMIT_EXCEEDED: Plan limit reached (50 recipes)';
    end if;
    return new;
end;
$$;

create or replace function public.add_recipe_to_plan_and_update_shopping_list(
    p_recipe_id bigint
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_user_id uuid := auth.uid();
    v_recipe public.recipes%rowtype;
    v_items jsonb;
    v_item jsonb;
    v_name text;
begin
    if v_user_id is null then
        raise exception 'UNAUTHORIZED: Authentication required';
    end if;
    select * into v_recipe from public.recipes where id = p_recipe_id for update;
    if not found or v_recipe.deleted_at is not null then
        raise exception 'NOT_FOUND: Recipe not found';
    end if;
    if v_recipe.user_id <> v_user_id and v_recipe.visibility <> 'PUBLIC' then
        raise exception 'FORBIDDEN: Access denied';
    end if;
    insert into public.plan_recipes(user_id, recipe_id) values (v_user_id, p_recipe_id);

    if v_recipe.normalized_ingredients_status = 'READY' then
        select items into v_items from public.recipe_normalized_ingredients
        where recipe_id = p_recipe_id;
        if jsonb_typeof(v_items) = 'array' then
            for v_item in select * from jsonb_array_elements(v_items) loop
                v_name := nullif(btrim(v_item->>'name'), '');
                continue when v_name is null;
                insert into public.shopping_list_items(
                    user_id, kind, recipe_id, recipe_name, variant_name,
                    active_variant_count, name, amount, unit, is_owned
                )
                values (
                    v_user_id, 'RECIPE', p_recipe_id, v_recipe.name, v_recipe.variant_name,
                    (select count(*)::integer from public.recipes r2
                     where r2.recipe_family_id = v_recipe.recipe_family_id
                       and r2.deleted_at is null),
                    v_name, nullif(v_item->>'amount', '')::numeric,
                    nullif(btrim(v_item->>'unit'), ''), false
                );
            end loop;
        end if;
    end if;
    return jsonb_build_object('success', true, 'recipe_id', p_recipe_id);
exception
    when unique_violation then
        raise exception 'CONFLICT: Recipe already in plan';
end;
$$;

create or replace function public.cleanup_recipe_operational_data(
    p_recipe_id bigint,
    p_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_plan integer := 0;
    v_collections integer := 0;
    v_shopping integer := 0;
    v_contributions integer := 0;
    v_jobs integer := 0;
begin
    delete from public.plan_recipes where recipe_id = p_recipe_id and user_id = p_user_id;
    get diagnostics v_plan = row_count;
    delete from public.recipe_collections c using public.collections x
      where c.collection_id = x.id and c.recipe_id = p_recipe_id and x.user_id = p_user_id;
    get diagnostics v_collections = row_count;
    delete from public.shopping_list_items
      where user_id = p_user_id and kind = 'RECIPE' and recipe_id = p_recipe_id;
    get diagnostics v_shopping = row_count;
    delete from public.shopping_list_recipe_contributions
      where user_id = p_user_id and recipe_id = p_recipe_id;
    get diagnostics v_contributions = row_count;
    delete from public.normalized_ingredients_jobs
      where recipe_id = p_recipe_id;
    get diagnostics v_jobs = row_count;
    return jsonb_build_object(
        'plan', v_plan, 'collections', v_collections, 'shopping_list', v_shopping,
        'contributions', v_contributions, 'jobs', v_jobs
    );
end;
$$;

create or replace function public.recipe_variant_usage(
    p_recipe_id bigint, p_user_id uuid, p_is_admin boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_plan bigint;
    v_collections bigint;
    v_shopping bigint;
begin
    if not public.recipe_variants_allowed(p_is_admin) then
        raise exception 'Recipe variants feature is disabled' using errcode = 'P0003';
    end if;
    if not exists (select 1 from public.recipes where id = p_recipe_id and user_id = p_user_id and deleted_at is null) then
        raise exception 'Recipe not found' using errcode = 'P0002';
    end if;
    select count(*) into v_plan from public.plan_recipes where user_id = p_user_id and recipe_id = p_recipe_id;
    select count(*) into v_collections from public.recipe_collections c
      join public.collections x on x.id = c.collection_id
      where c.recipe_id = p_recipe_id and x.user_id = p_user_id;
    select count(*) into v_shopping from public.shopping_list_items
      where user_id = p_user_id and kind = 'RECIPE' and recipe_id = p_recipe_id;
    return jsonb_build_object('plan', v_plan, 'collections', v_collections, 'shopping_list', v_shopping);
end;
$$;

create or replace function public.delete_recipe_variant(
    p_recipe_id bigint, p_user_id uuid, p_is_admin boolean default false
) returns boolean language plpgsql security definer set search_path = public as $$
declare
    v_family_id uuid;
    v_count integer;
    v_default boolean;
begin
    if not public.recipe_variants_allowed(p_is_admin) then
        raise exception 'Recipe variants feature is disabled' using errcode = 'P0003';
    end if;
    select recipe_family_id, is_default into v_family_id, v_default
    from public.recipes where id = p_recipe_id and user_id = p_user_id and deleted_at is null for update;
    if not found then raise exception 'Recipe not found' using errcode = 'P0002'; end if;
    select count(*) into v_count from public.recipes where recipe_family_id = v_family_id and deleted_at is null;
    if v_count < 2 then raise exception 'Cannot delete the last variant' using errcode = 'P0009'; end if;
    perform set_config('app.recipe_family_sync', 'on', true);
    update public.recipes set deleted_at = now(), is_default = false where id = p_recipe_id;
    if v_default then
        update public.recipes set is_default = true
        where id = (select id from public.recipes where recipe_family_id = v_family_id
                    and deleted_at is null order by sort_order, id limit 1);
    end if;
    perform set_config('app.recipe_family_sync', 'off', true);
    perform public.cleanup_recipe_operational_data(p_recipe_id, p_user_id);
    return true;
end;
$$;

create or replace function public.delete_recipe_family(
    p_recipe_id bigint, p_user_id uuid, p_is_admin boolean default false
) returns boolean language plpgsql security definer set search_path = public as $$
declare
    v_family_id uuid;
    v_recipe_id bigint;
begin
    if not public.recipe_variants_allowed(p_is_admin) then
        raise exception 'Recipe variants feature is disabled' using errcode = 'P0003';
    end if;
    select recipe_family_id into v_family_id from public.recipes
      where id = p_recipe_id and user_id = p_user_id and deleted_at is null for update;
    if not found then raise exception 'Recipe not found' using errcode = 'P0002'; end if;
    for v_recipe_id in select id from public.recipes where recipe_family_id = v_family_id and deleted_at is null loop
        perform public.cleanup_recipe_operational_data(v_recipe_id, p_user_id);
    end loop;
    perform set_config('app.recipe_family_sync', 'on', true);
    update public.recipe_families set deleted_at = now(), updated_at = now()
      where id = v_family_id and user_id = p_user_id;
    perform set_config('app.recipe_family_sync', 'off', true);
    return true;
end;
$$;

do $$
declare v_name text; v_args text;
begin
    for v_name, v_args in
        select p.proname, pg_get_function_identity_arguments(p.oid)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in (
            'check_plan_limit', 'add_recipe_to_plan_and_update_shopping_list',
            'cleanup_recipe_operational_data', 'recipe_variant_usage',
            'delete_recipe_variant', 'delete_recipe_family'
        )
    loop
        execute format('revoke all on function public.%I(%s) from public, anon, authenticated', v_name, v_args);
    end loop;
end;
$$;

grant execute on function public.add_recipe_to_plan_and_update_shopping_list(bigint) to authenticated;
grant execute on function public.cleanup_recipe_operational_data(bigint, uuid) to service_role;
grant execute on function public.recipe_variant_usage(bigint, uuid, boolean) to service_role;
grant execute on function public.delete_recipe_variant(bigint, uuid, boolean) to service_role;
grant execute on function public.delete_recipe_family(bigint, uuid, boolean) to service_role;

do $$
begin
    if has_function_privilege('anon', 'public.cleanup_recipe_operational_data(bigint,uuid)', 'execute')
       or has_function_privilege('authenticated', 'public.cleanup_recipe_operational_data(bigint,uuid)', 'execute')
       or has_function_privilege('anon', 'public.delete_recipe_variant(bigint,uuid,boolean)', 'execute')
       or has_function_privilege('authenticated', 'public.delete_recipe_variant(bigint,uuid,boolean)', 'execute')
    then raise exception 'PS-112 RPC privilege hardening failed';
    end if;
end;
$$;

create or replace function public.admin_get_recipes_page_v2(
    p_page_number bigint default 1,
    p_page_size integer default 25,
    p_sort_by text default 'created_at',
    p_sort_dir text default 'desc',
    p_recipe_id bigint default null,
    p_name text default null,
    p_author text default null,
    p_category_ids bigint[] default null,
    p_include_uncategorized boolean default false,
    p_created_from date default null,
    p_created_to date default null,
    p_rating_min numeric default null,
    p_rating_max numeric default null,
    p_ratings_count_min bigint default null,
    p_ratings_count_max bigint default null,
    p_is_grill boolean default false,
    p_is_termorobot boolean default false
) returns table (
    id bigint, name text, variant_name text, active_variant_count integer,
    author_id uuid, author_username text, author_email text, category_name text,
    created_at timestamptz, average_rating numeric, ratings_count bigint,
    is_grill boolean, is_termorobot boolean, total_items bigint
) language sql security definer set search_path = public set row_security = off as $$
    with rows as (
        select r.id, r.name, r.variant_name,
            (select count(*)::integer from public.recipes rv
             where rv.recipe_family_id = r.recipe_family_id and rv.deleted_at is null) active_variant_count,
            r.user_id author_id, p.username author_username, au.email::text author_email,
            c.name category_name, r.created_at,
            (select round(avg(rr.rating)::numeric, 1) from public.recipe_ratings rr where rr.recipe_id = r.id) average_rating,
            (select count(*)::bigint from public.recipe_ratings rr where rr.recipe_id = r.id) ratings_count,
            r.is_grill, r.is_termorobot
        from public.recipes r
        left join public.profiles p on p.id = r.user_id
        left join auth.users au on au.id = r.user_id
        left join public.categories c on c.id = r.category_id
        where r.visibility = 'PUBLIC' and r.deleted_at is null
          and (p_recipe_id is null or r.id = p_recipe_id)
          and (p_name is null or r.name ilike '%' || p_name || '%')
          and (p_author is null or coalesce(p.username, '') ilike '%' || p_author || '%'
               or coalesce(au.email::text, '') ilike '%' || p_author || '%')
          and (p_category_ids is null and not p_include_uncategorized
               or r.category_id = any(p_category_ids)
               or (p_include_uncategorized and r.category_id is null))
          and (p_created_from is null or r.created_at >= p_created_from::timestamp)
          and (p_created_to is null or r.created_at < (p_created_to + 1)::timestamp)
          and (not p_is_grill or r.is_grill)
          and (not p_is_termorobot or r.is_termorobot)
        order by
            case when lower(coalesce(p_sort_by, 'created_at')) = 'name' and lower(coalesce(p_sort_dir, 'desc')) = 'asc' then r.name end asc,
            case when lower(coalesce(p_sort_by, 'created_at')) = 'name' and lower(coalesce(p_sort_dir, 'desc')) <> 'asc' then r.name end desc,
            case when lower(coalesce(p_sort_by, 'created_at')) <> 'name' and lower(coalesce(p_sort_dir, 'desc')) = 'asc' then r.created_at end asc,
            case when lower(coalesce(p_sort_by, 'created_at')) <> 'name' and lower(coalesce(p_sort_dir, 'desc')) <> 'asc' then r.created_at end desc,
            r.id asc
    ), counted as (
        select rows.*, count(*) over()::bigint total_items from rows
    )
    select * from counted
    offset greatest(coalesce(p_page_number, 1) - 1, 0) * least(greatest(coalesce(p_page_size, 25), 1), 100)
    limit least(greatest(coalesce(p_page_size, 25), 1), 100);
$$;

create or replace function public.admin_get_users_page_v2(
    p_page_number integer default 1,
    p_page_size integer default 25,
    p_sort_by text default 'created_at',
    p_sort_dir text default 'desc'
) returns table (
    id uuid, login text, username text, role text, created_at timestamptz,
    last_sign_in_at timestamptz, recipes_count bigint, variants_count bigint, total_items bigint
) language sql security definer set search_path = public set row_security = off as $$
    with counts as (
        select r.user_id, count(distinct r.recipe_family_id)::bigint recipes_count,
            count(*)::bigint variants_count
        from public.recipes r where r.deleted_at is null group by r.user_id
    ), rows as (
        select u.id, u.email::text login, p.username,
            coalesce(u.raw_app_meta_data ->> 'app_role', 'user') role,
            u.created_at, u.last_sign_in_at, coalesce(c.recipes_count, 0) recipes_count,
            coalesce(c.variants_count, 0) variants_count
        from auth.users u
        left join public.profiles p on p.id = u.id
        left join counts c on c.user_id = u.id
        order by u.created_at desc, u.id
    ), counted as (
        select rows.*, count(*) over()::bigint total_items from rows
    )
    select * from counted
    offset greatest(coalesce(p_page_number, 1) - 1, 0) * least(greatest(coalesce(p_page_size, 25), 1), 100)
    limit least(greatest(coalesce(p_page_size, 25), 1), 100);
$$;

revoke all on function public.admin_get_recipes_page_v2(
    bigint, integer, text, text, bigint, text, text, bigint[], boolean, date, date,
    numeric, numeric, bigint, bigint, boolean, boolean
)
    from public, anon, authenticated;
grant execute on function public.admin_get_recipes_page_v2(
    bigint, integer, text, text, bigint, text, text, bigint[], boolean, date, date,
    numeric, numeric, bigint, bigint, boolean, boolean
) to service_role;
revoke all on function public.admin_get_users_page_v2(integer, integer, text, text)
    from public, anon, authenticated;
grant execute on function public.admin_get_users_page_v2(integer, integer, text, text) to service_role;

do $$
begin
    if has_function_privilege('anon', 'public.admin_get_recipes_page_v2(bigint,integer,text,text,bigint,text,text,bigint[],boolean,date,date,numeric,numeric,bigint,bigint,boolean,boolean)', 'execute')
       or has_function_privilege('authenticated', 'public.admin_get_recipes_page_v2(bigint,integer,text,text,bigint,text,text,bigint[],boolean,date,date,numeric,numeric,bigint,bigint,boolean,boolean)', 'execute')
       or not has_function_privilege('service_role', 'public.admin_get_recipes_page_v2(bigint,integer,text,text,bigint,text,text,bigint[],boolean,date,date,numeric,numeric,bigint,bigint,boolean,boolean)', 'execute')
       or has_function_privilege('anon', 'public.admin_get_users_page_v2(integer,integer,text,text)', 'execute')
       or has_function_privilege('authenticated', 'public.admin_get_users_page_v2(integer,integer,text,text)', 'execute')
       or not has_function_privilege('service_role', 'public.admin_get_users_page_v2(integer,integer,text,text)', 'execute')
    then raise exception 'PS-112 admin RPC privilege hardening failed';
    end if;
end;
$$;
