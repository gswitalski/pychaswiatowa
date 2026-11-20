-- PS-108: recipe families and the initial "Podstawowa" variant.

create table if not exists public.recipe_families (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(name) > 0 and char_length(name) <= 150),
    visibility public.recipe_visibility not null default 'PRIVATE',
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, user_id)
);

create index if not exists recipe_families_user_id_idx
    on public.recipe_families(user_id);
create index if not exists recipe_families_public_active_idx
    on public.recipe_families(visibility)
    where deleted_at is null and visibility = 'PUBLIC';

alter table public.recipe_families enable row level security;

drop policy if exists "recipe families owner or public read" on public.recipe_families;
create policy "recipe families owner or public read"
    on public.recipe_families
    for select
    to anon, authenticated
    using (
        (auth.uid() = user_id)
        or (visibility = 'PUBLIC' and deleted_at is null)
    );

grant select on public.recipe_families to anon, authenticated;

alter table public.recipes
    add column if not exists recipe_family_id uuid,
    add column if not exists variant_name text,
    add column if not exists is_default boolean,
    add column if not exists sort_order integer;

-- Create a dedicated family for every existing recipe. A loop is intentional:
-- identical recipes must never be merged into one family.
do $$
declare
    v_recipe record;
    v_family_id uuid;
begin
    for v_recipe in
        select id, user_id, name, visibility, deleted_at, created_at, updated_at
        from public.recipes
        where recipe_family_id is null
    loop
        insert into public.recipe_families (user_id, name, visibility, deleted_at, created_at, updated_at)
        values (v_recipe.user_id, v_recipe.name, v_recipe.visibility, v_recipe.deleted_at,
                v_recipe.created_at, v_recipe.updated_at)
        returning id into v_family_id;

        update public.recipes
        set recipe_family_id = v_family_id, variant_name = 'Podstawowa',
            is_default = true, sort_order = 0
        where id = v_recipe.id;
    end loop;
end;
$$;

alter table public.recipes
    alter column recipe_family_id set not null,
    alter column variant_name set not null,
    alter column is_default set not null,
    alter column sort_order set not null;

alter table public.recipes
    add constraint recipes_family_owner_fk
    foreign key (recipe_family_id, user_id)
    references public.recipe_families (id, user_id);

create index if not exists recipes_recipe_family_id_idx
    on public.recipes(recipe_family_id);

create unique index if not exists recipes_active_variant_name_unique_idx
    on public.recipes(recipe_family_id, lower(variant_name))
    where deleted_at is null;

create unique index if not exists recipes_active_default_unique_idx
    on public.recipes(recipe_family_id)
    where deleted_at is null and is_default;

create or replace function public.recipe_family_sync_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

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
        deleted_at = new.deleted_at,
        updated_at = now()
    where recipe_family_id = new.id;
    return new;
end;
$$;

create or replace function public.recipe_family_guard_recipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_family public.recipe_families%rowtype;
    v_sync boolean := coalesce(current_setting('app.recipe_family_sync', true), 'off') = 'on';
begin
    if new.recipe_family_id is null then
        insert into public.recipe_families (user_id, name, visibility, deleted_at, created_at, updated_at)
        values (new.user_id, new.name, new.visibility, new.deleted_at, new.created_at, new.updated_at)
        returning * into v_family;
        new.recipe_family_id := v_family.id;
        new.variant_name := coalesce(new.variant_name, 'Podstawowa');
        new.is_default := coalesce(new.is_default, true);
        new.sort_order := coalesce(new.sort_order, 0);
    end if;

    select * into v_family
    from public.recipe_families
    where id = new.recipe_family_id
      and user_id = new.user_id
    for update;

    if not found then
        raise exception 'Recipe family does not belong to recipe owner'
            using errcode = '23503';
    end if;

    if not v_sync and (new.name is distinct from v_family.name
        or new.visibility is distinct from v_family.visibility) then
        raise exception 'Recipe name and visibility are managed by recipe family'
            using errcode = '23514';
    end if;

    new.name := v_family.name;
    new.visibility := v_family.visibility;
    if not v_sync then
        new.deleted_at := v_family.deleted_at;
    end if;
    return new;
end;
$$;

create or replace function public.recipe_family_check_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_family_id uuid;
begin
    v_family_id := case
        when tg_table_name = 'recipe_families' and tg_op = 'DELETE' then old.id
        when tg_table_name = 'recipe_families' then new.id
        when tg_op = 'DELETE' then old.recipe_family_id
        else new.recipe_family_id
    end;
    if exists (
        select 1 from public.recipe_families f
        where f.id = v_family_id and f.deleted_at is null
    ) and not exists (
        select 1 from public.recipes r
        where r.recipe_family_id = v_family_id
          and r.deleted_at is null
          and r.is_default
    ) then
        raise exception 'Active recipe family must have an active default variant'
            using errcode = '23514';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists recipe_family_set_updated_at on public.recipe_families;
create trigger recipe_family_set_updated_at
    before update on public.recipe_families
    for each row execute function public.recipe_family_sync_updated_at();

drop trigger if exists recipe_family_sync_recipes on public.recipe_families;
create trigger recipe_family_sync_recipes
    after update of name, visibility, deleted_at on public.recipe_families
    for each row execute function public.recipe_family_sync_recipes();

drop trigger if exists recipe_family_guard_recipe on public.recipes;
create trigger recipe_family_guard_recipe
    before insert or update on public.recipes
    for each row execute function public.recipe_family_guard_recipe();

drop trigger if exists recipe_family_check_default on public.recipes;
create constraint trigger recipe_family_check_default
    after insert or update or delete on public.recipes
    deferrable initially deferred
    for each row execute function public.recipe_family_check_default();

drop trigger if exists recipe_family_check_default_on_family on public.recipe_families;
create constraint trigger recipe_family_check_default_on_family
    after insert or update or delete on public.recipe_families
    deferrable initially deferred
    for each row execute function public.recipe_family_check_default();

-- Keep the established argument lists while making family updates atomic.
alter function public.update_recipe_with_tags(
    bigint, uuid, text, text, bigint, text, text, text[], boolean, public.recipe_visibility,
    text, boolean, smallint, boolean, boolean, boolean, smallint, boolean,
    smallint, boolean, public.recipe_diet_type, boolean, public.recipe_cuisine,
    boolean, public.recipe_difficulty, boolean, boolean, boolean, text, boolean
) rename to update_recipe_with_tags_legacy;

create function public.update_recipe_with_tags(
    p_recipe_id bigint, p_user_id uuid, p_name text default null,
    p_description text default null, p_category_id bigint default null,
    p_ingredients_raw text default null, p_steps_raw text default null,
    p_tag_names text[] default null, p_update_tags boolean default false,
    p_visibility public.recipe_visibility default null, p_image_path text default null,
    p_update_category boolean default false, p_servings smallint default null,
    p_update_servings boolean default false, p_is_termorobot boolean default null,
    p_update_is_termorobot boolean default false, p_prep_time_minutes smallint default null,
    p_update_prep_time boolean default false, p_total_time_minutes smallint default null,
    p_update_total_time boolean default false, p_diet_type public.recipe_diet_type default null,
    p_update_diet_type boolean default false, p_cuisine public.recipe_cuisine default null,
    p_update_cuisine boolean default false, p_difficulty public.recipe_difficulty default null,
    p_update_difficulty boolean default false, p_is_grill boolean default null,
    p_update_is_grill boolean default false, p_tips_raw text default null,
    p_update_tips boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
    v_family_id uuid;
    v_result bigint;
begin
    select recipe_family_id into v_family_id
    from public.recipes
    where id = p_recipe_id and user_id = p_user_id and deleted_at is null
    for update;

    if v_family_id is null then
        raise exception 'Recipe with ID % not found or access denied', p_recipe_id
            using errcode = 'P0002';
    end if;

    perform set_config('app.recipe_family_sync', 'on', true);
    if p_name is not null or p_visibility is not null then
        update public.recipe_families
        set name = coalesce(p_name, name),
            visibility = coalesce(p_visibility, visibility),
            updated_at = now()
        where id = v_family_id and user_id = p_user_id;
    end if;

    v_result := public.update_recipe_with_tags_legacy(
        p_recipe_id, p_user_id, p_name, p_description, p_category_id,
        p_ingredients_raw, p_steps_raw, p_tag_names, p_update_tags, p_visibility,
        p_image_path, p_update_category, p_servings, p_update_servings,
        p_is_termorobot, p_update_is_termorobot, p_prep_time_minutes,
        p_update_prep_time, p_total_time_minutes, p_update_total_time,
        p_diet_type, p_update_diet_type, p_cuisine, p_update_cuisine,
        p_difficulty, p_update_difficulty, p_is_grill, p_update_is_grill,
        p_tips_raw, p_update_tips
    );
    perform set_config('app.recipe_family_sync', 'off', true);
    return v_result;
end;
$$;

alter function public.soft_delete_recipe(bigint) rename to soft_delete_recipe_legacy;
create function public.soft_delete_recipe(p_recipe_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_family_id uuid;
begin
    if v_user_id is null then
        raise exception 'Authentication required' using errcode = '42501';
    end if;
    select recipe_family_id into v_family_id
    from public.recipes
    where id = p_recipe_id and user_id = v_user_id and deleted_at is null
    for update;
    if v_family_id is null then
        return false;
    end if;
    perform set_config('app.recipe_family_sync', 'on', true);
    update public.recipe_families
    set deleted_at = now(), updated_at = now()
    where id = v_family_id and user_id = v_user_id;
    perform set_config('app.recipe_family_sync', 'off', true);
    return true;
end;
$$;

-- RPCs remain callable by the authenticated application, but not by anon/public.
revoke all on function public.soft_delete_recipe(bigint) from public, anon;
grant execute on function public.soft_delete_recipe(bigint) to authenticated;

revoke all on function public.create_recipe_with_tags(
    uuid, text, text, bigint, text, text, text[], public.recipe_visibility,
    smallint, boolean, smallint, smallint, public.recipe_diet_type,
    public.recipe_cuisine, public.recipe_difficulty, boolean, text
) from public, anon;
grant execute on function public.create_recipe_with_tags(
    uuid, text, text, bigint, text, text, text[], public.recipe_visibility,
    smallint, boolean, smallint, smallint, public.recipe_diet_type,
    public.recipe_cuisine, public.recipe_difficulty, boolean, text
) to authenticated;

revoke all on function public.update_recipe_with_tags_legacy(
    bigint, uuid, text, text, bigint, text, text, text[], boolean, public.recipe_visibility,
    text, boolean, smallint, boolean, boolean, boolean, smallint, boolean,
    smallint, boolean, public.recipe_diet_type, boolean, public.recipe_cuisine,
    boolean, public.recipe_difficulty, boolean, boolean, boolean, text, boolean
) from public, anon, authenticated;
revoke all on function public.soft_delete_recipe_legacy(bigint) from public, anon, authenticated;

revoke all on function public.update_recipe_with_tags(
    bigint, uuid, text, text, bigint, text, text, text[], boolean, public.recipe_visibility,
    text, boolean, smallint, boolean, boolean, boolean, smallint, boolean,
    smallint, boolean, public.recipe_diet_type, boolean, public.recipe_cuisine,
    boolean, public.recipe_difficulty, boolean, boolean, boolean, text, boolean
) from public, anon;
grant execute on function public.update_recipe_with_tags(
    bigint, uuid, text, text, bigint, text, text, text[], boolean, public.recipe_visibility,
    text, boolean, smallint, boolean, boolean, boolean, smallint, boolean,
    smallint, boolean, public.recipe_diet_type, boolean, public.recipe_cuisine,
    boolean, public.recipe_difficulty, boolean, boolean, boolean, text, boolean
) to authenticated;

do $$
begin
    if has_function_privilege('anon', 'public.soft_delete_recipe(bigint)', 'execute')
        or has_function_privilege('public', 'public.soft_delete_recipe(bigint)', 'execute') then
        raise exception 'soft_delete_recipe must not be executable by anon/public';
    end if;
end;
$$;
