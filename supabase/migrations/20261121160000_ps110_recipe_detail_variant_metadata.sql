-- PS-110: expose active variant metadata additively in recipe_details.
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
    r.recipe_family_id,
    r.variant_name,
    r.is_default,
    r.sort_order,
    (
        select count(*)::integer
        from public.recipes rv
        where rv.recipe_family_id = r.recipe_family_id
          and rv.deleted_at is null
    ) as active_variant_count,
    coalesce(
        (
            select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name)
            from public.tags t
            inner join public.recipe_tags rt on rt.tag_id = t.id
            where rt.recipe_id = r.id
        ),
        '[]'::jsonb
    ) as tags,
    coalesce(
        (
            select jsonb_agg(jsonb_build_object('id', col.id, 'name', col.name) order by col.name)
            from public.collections col
            inner join public.recipe_collections rc on rc.collection_id = col.id
            where rc.recipe_id = r.id
        ),
        '[]'::jsonb
    ) as collections,
    coalesce(
        (select array_agg(t.id order by t.name)
         from public.tags t inner join public.recipe_tags rt on rt.tag_id = t.id
         where rt.recipe_id = r.id),
        array[]::bigint[]
    ) as tag_ids,
    coalesce(
        (select array_agg(col.id order by col.name)
         from public.collections col inner join public.recipe_collections rc on rc.collection_id = col.id
         where rc.recipe_id = r.id),
        array[]::bigint[]
    ) as collection_ids,
    (select count(*)::integer from public.recipe_ratings rr where rr.recipe_id = r.id) as ratings_count,
    (select round(avg(rr.rating)::numeric, 1) from public.recipe_ratings rr where rr.recipe_id = r.id) as average_rating
from public.recipes r
left join public.categories c on c.id = r.category_id
where r.deleted_at is null;

grant select on public.recipe_details to authenticated;

comment on view public.recipe_details is
    'Comprehensive recipe view with PS-110 variant metadata, tags, collections, normalized ingredients, and ratings.';
