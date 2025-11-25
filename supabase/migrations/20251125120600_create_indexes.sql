-- migration: create indexes
-- description: creates indexes for performance optimization of common queries
-- tables affected: recipes, tags, recipe_tags, collections, recipe_collections
-- dependencies: all main tables
-- note: improves query performance for sorting, filtering, and full-text search

-- indexes for recipes table
-- these optimize common query patterns: filtering by user, sorting by name/date, and text search

-- index on user_id for filtering recipes by owner (automatically created for foreign key)
-- explicitly creating for documentation purposes
create index if not exists idx_recipes_user_id
    on public.recipes(user_id);

-- index on category_id for filtering recipes by category
create index if not exists idx_recipes_category_id
    on public.recipes(category_id);

-- index on name for alphabetical sorting
-- supports queries like: order by name asc/desc
create index if not exists idx_recipes_name
    on public.recipes(name);

-- index on created_at for chronological sorting
-- supports queries like: order by created_at desc (newest first)
create index if not exists idx_recipes_created_at
    on public.recipes(created_at desc);

-- index on deleted_at for efficient filtering of non-deleted recipes
-- supports queries with: where deleted_at is null
create index if not exists idx_recipes_deleted_at
    on public.recipes(deleted_at)
    where deleted_at is null;

-- create tsvector column for full-text search on name and ingredients
-- this will store preprocessed text for fast searching
alter table public.recipes
    add column if not exists search_vector tsvector
    generated always as (
        setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(ingredients::text, '')), 'C')
    ) stored;

-- gin index on search_vector for fast full-text search
-- supports queries like: where search_vector @@ to_tsquery('simple', 'search term')
create index if not exists idx_recipes_search_vector
    on public.recipes using gin(search_vector);

-- indexes for tags table

-- unique index on (user_id, lower(name)) for case-insensitive uniqueness
-- this is already created by the unique constraint in the tags table
-- including here for documentation
-- create unique index if not exists idx_tags_user_id_name_lower
--     on public.tags(user_id, lower(name));

-- indexes for recipe_tags junction table

-- index on tag_id for finding all recipes with a specific tag
-- the primary key already indexes recipe_id, so we only need tag_id
create index if not exists idx_recipe_tags_tag_id
    on public.recipe_tags(tag_id);

-- indexes for collections table

-- unique index on (user_id, name) for uniqueness per user
-- this is already created by the unique constraint in the collections table
-- including here for documentation
-- create unique index if not exists idx_collections_user_id_name
--     on public.collections(user_id, name);

-- indexes for recipe_collections junction table

-- index on collection_id for finding all recipes in a specific collection
-- the primary key already indexes recipe_id, so we only need collection_id
create index if not exists idx_recipe_collections_collection_id
    on public.recipe_collections(collection_id);

-- add comments for documentation
comment on index public.idx_recipes_user_id is 'optimizes filtering recipes by owner';
comment on index public.idx_recipes_category_id is 'optimizes filtering recipes by category';
comment on index public.idx_recipes_name is 'optimizes alphabetical sorting of recipes';
comment on index public.idx_recipes_created_at is 'optimizes chronological sorting of recipes';
comment on index public.idx_recipes_deleted_at is 'optimizes filtering of non-deleted recipes';
comment on index public.idx_recipes_search_vector is 'enables fast full-text search on recipes';
comment on index public.idx_recipe_tags_tag_id is 'optimizes finding recipes by tag';
comment on index public.idx_recipe_collections_collection_id is 'optimizes finding recipes by collection';

