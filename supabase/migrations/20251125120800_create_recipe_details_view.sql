-- migration: create recipe_details view
-- description: creates a comprehensive view that joins recipes with related data
-- views created: recipe_details
-- dependencies: recipes, categories, tags, collections, recipe_tags, recipe_collections
-- note: this view simplifies queries and avoids n+1 problems by aggregating related data

-- create recipe_details view that combines recipe data with categories, tags, and collections
-- this view eliminates the need for multiple queries and joins on the client side
create or replace view public.recipe_details as
select
    -- recipe basic information
    r.id,
    r.user_id,
    r.name,
    r.description,
    r.image_path,
    r.ingredients,
    r.steps,
    r.created_at,
    r.updated_at,
    r.deleted_at,
    
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
-- rls policies from the underlying recipes table will still apply
grant select on public.recipe_details to authenticated;

-- add comment for documentation
comment on view public.recipe_details is 
    'comprehensive view of recipes with aggregated tags and collections, excludes soft-deleted recipes';

