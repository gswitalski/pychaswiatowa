-- Domyślna nazwa wariantu „Wariant podstawowy” + pola wariantów w recipe_details.

update public.recipes
set variant_name = 'Wariant podstawowy'
where variant_name = 'Podstawowa';

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
        new.variant_name := coalesce(new.variant_name, 'Wariant podstawowy');
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

drop view if exists public.recipe_details;

create view public.recipe_details as
select
    r.id,
    r.user_id,
    r.name,
    r.description,
    r.image_path,
    r.ingredients,
    r.steps,
    r.tips,
    r.servings,
    r.prep_time_minutes,
    r.total_time_minutes,
    r.created_at,
    r.updated_at,
    r.deleted_at,
    r.visibility,
    r.is_termorobot,
    r.diet_type,
    r.cuisine,
    r.difficulty,
    r.is_grill,
    r.normalized_ingredients_status,
    r.normalized_ingredients_updated_at,
    r.search_vector,
    r.category_id,
    c.name as category_name,
    r.variant_name,
    (
        select count(*)::integer
        from public.recipes rv
        where rv.recipe_family_id = r.recipe_family_id
          and rv.deleted_at is null
    ) as active_variant_count,
    coalesce(
        (
            select jsonb_agg(
                jsonb_build_object('id', t.id, 'name', t.name)
                order by t.name
            )
            from public.tags t
            inner join public.recipe_tags rt on rt.tag_id = t.id
            where rt.recipe_id = r.id
        ),
        '[]'::jsonb
    ) as tags,
    coalesce(
        (
            select jsonb_agg(
                jsonb_build_object('id', col.id, 'name', col.name)
                order by col.name
            )
            from public.collections col
            inner join public.recipe_collections rc on rc.collection_id = col.id
            where rc.recipe_id = r.id
        ),
        '[]'::jsonb
    ) as collections,
    coalesce(
        (
            select array_agg(t.id order by t.name)
            from public.tags t
            inner join public.recipe_tags rt on rt.tag_id = t.id
            where rt.recipe_id = r.id
        ),
        array[]::bigint[]
    ) as tag_ids,
    coalesce(
        (
            select array_agg(col.id order by col.name)
            from public.collections col
            inner join public.recipe_collections rc on rc.collection_id = col.id
            where rc.recipe_id = r.id
        ),
        array[]::bigint[]
    ) as collection_ids,
    (
        select count(*)::integer
        from public.recipe_ratings rr
        where rr.recipe_id = r.id
    ) as ratings_count,
    (
        select round(avg(rr.rating)::numeric, 1)
        from public.recipe_ratings rr
        where rr.recipe_id = r.id
    ) as average_rating
from public.recipes r
left join public.categories c on c.id = r.category_id
where r.deleted_at is null;

grant select on public.recipe_details to authenticated;

comment on view public.recipe_details is
    'Comprehensive recipe view with variant fields, aggregated tags, collections, normalized ingredients, and public rating aggregates.';