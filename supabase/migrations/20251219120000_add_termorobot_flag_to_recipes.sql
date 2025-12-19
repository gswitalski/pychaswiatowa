-- migration: add is_termorobot flag to recipes
-- description: adds is_termorobot boolean column to recipes table and updates recipe_details view
-- tables affected: recipes
-- views affected: recipe_details
-- note: implements termorobot (Thermomix/Lidlomix) flag for recipes

-- ============================================================================
-- PART 1: Add is_termorobot column to recipes table
-- ============================================================================

-- add is_termorobot column to recipes table with default value false
alter table public.recipes
    add column if not exists is_termorobot boolean not null default false;

-- add comment for documentation
comment on column public.recipes.is_termorobot is 'flag indicating recipe is designed for Thermomix/Lidlomix (Termorobot)';

-- ============================================================================
-- PART 2: Update recipe_details view to include is_termorobot
-- ============================================================================

-- drop the existing view first (required because we're adding a new column)
drop view if exists public.recipe_details;

-- recreate the recipe_details view with is_termorobot column
create view public.recipe_details as
select
    -- recipe basic information
    r.id,
    r.user_id,
    r.name,
    r.description,
    r.image_path,
    r.ingredients,
    r.steps,
    r.servings,
    r.is_termorobot,  -- NEW: termorobot flag
    r.created_at,
    r.updated_at,
    r.deleted_at,
    r.visibility,

    -- full-text search vector for efficient searching
    r.search_vector,

    -- category information (null if no category assigned)
    r.category_id,
    c.name as category_name,

    -- aggregated tags as jsonb array
    -- format: [{"id": 1, "name": "Italian"}, {"id": 2, "name": "Pasta"}]
    coalesce(
        (
            select jsonb_agg(
                jsonb_build_object(
                    'id', t.id,
                    'name', t.name
                )
                order by t.name
            )
            from public.tags t
            inner join public.recipe_tags rt on rt.tag_id = t.id
            where rt.recipe_id = r.id
        ),
        '[]'::jsonb
    ) as tags,

    -- aggregated collections as jsonb array
    -- format: [{"id": 1, "name": "Favorites"}, {"id": 2, "name": "Quick Meals"}]
    coalesce(
        (
            select jsonb_agg(
                jsonb_build_object(
                    'id', col.id,
                    'name', col.name
                )
                order by col.name
            )
            from public.collections col
            inner join public.recipe_collections rc on rc.collection_id = col.id
            where rc.recipe_id = r.id
        ),
        '[]'::jsonb
    ) as collections,

    -- tag ids as array for easy filtering
    coalesce(
        (
            select array_agg(t.id order by t.name)
            from public.tags t
            inner join public.recipe_tags rt on rt.tag_id = t.id
            where rt.recipe_id = r.id
        ),
        array[]::bigint[]
    ) as tag_ids,

    -- collection ids as array for easy filtering
    coalesce(
        (
            select array_agg(col.id order by col.name)
            from public.collections col
            inner join public.recipe_collections rc on rc.collection_id = col.id
            where rc.recipe_id = r.id
        ),
        array[]::bigint[]
    ) as collection_ids

from public.recipes r
left join public.categories c on c.id = r.category_id
-- only include non-deleted recipes in the view
where r.deleted_at is null;

-- grant select permissions on the view
grant select on public.recipe_details to authenticated;

-- add comment for documentation
comment on view public.recipe_details is
    'comprehensive view of recipes with aggregated tags, collections, visibility, servings, termorobot flag, and search_vector for full-text search';
