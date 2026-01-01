-- migration: add time fields to recipes
-- description: adds prep_time_minutes and total_time_minutes columns to recipes table, updates recipe_details view and RPC functions
-- tables affected: recipes
-- views affected: recipe_details
-- functions affected: create_recipe_with_tags, update_recipe_with_tags, get_recipes_list
-- note: implements optional time fields (0-999 minutes) with cross-field validation

-- add prep_time_minutes column to recipes table
-- type: smallint (range: -32768 to 32767, sufficient for 0-999)
-- nullable: yes (time fields are optional)
-- constraint: must be null or between 0 and 999
alter table public.recipes
    add column if not exists prep_time_minutes smallint
    check (prep_time_minutes is null or (prep_time_minutes >= 0 and prep_time_minutes <= 999));

-- add total_time_minutes column to recipes table
-- type: smallint (range: -32768 to 32767, sufficient for 0-999)
-- nullable: yes (time fields are optional)
-- constraint: must be null or between 0 and 999
alter table public.recipes
    add column if not exists total_time_minutes smallint
    check (total_time_minutes is null or (total_time_minutes >= 0 and total_time_minutes <= 999));

-- add cross-field constraint: total_time_minutes >= prep_time_minutes (when both are set)
-- ensures data integrity at database level
alter table public.recipes
    add constraint check_total_time_gte_prep_time
    check (
        prep_time_minutes is null 
        or total_time_minutes is null 
        or total_time_minutes >= prep_time_minutes
    );

-- add comments for documentation
comment on column public.recipes.prep_time_minutes is 'preparation time in minutes (0-999 or null if not specified)';
comment on column public.recipes.total_time_minutes is 'total time in minutes (0-999 or null if not specified, must be >= prep_time_minutes when both set)';

-- update recipe_details view to include time columns
drop view if exists public.recipe_details;

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
    r.prep_time_minutes,      -- NEW: prep time column
    r.total_time_minutes,     -- NEW: total time column
    r.created_at,
    r.updated_at,
    r.deleted_at,
    r.visibility,
    r.is_termorobot,

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
    'comprehensive view of recipes with aggregated tags, collections, visibility, servings, time fields (prep_time_minutes, total_time_minutes), termorobot flag, and search_vector for full-text search';

