-- migration: create junction tables
-- description: creates many-to-many relationship tables for recipes-tags and recipes-collections
-- tables affected: recipe_tags, recipe_collections
-- dependencies: recipes, tags, collections
-- note: these tables enable many-to-many relationships with cascade delete

-- create recipe_tags junction table
-- links recipes with tags in a many-to-many relationship
create table if not exists public.recipe_tags (
    -- foreign key to recipes with cascade delete
    -- when recipe is deleted, all its tag associations are automatically removed
    recipe_id bigint not null references public.recipes(id) on delete cascade,
    
    -- foreign key to tags with cascade delete
    -- when tag is deleted, all its recipe associations are automatically removed
    tag_id bigint not null references public.tags(id) on delete cascade,
    
    -- composite primary key ensures each recipe-tag pair is unique
    primary key (recipe_id, tag_id)
);

-- create recipe_collections junction table
-- links recipes with collections in a many-to-many relationship
create table if not exists public.recipe_collections (
    -- foreign key to recipes with cascade delete
    -- when recipe is deleted, all its collection associations are automatically removed
    recipe_id bigint not null references public.recipes(id) on delete cascade,
    
    -- foreign key to collections with cascade delete
    -- when collection is deleted, all its recipe associations are automatically removed
    collection_id bigint not null references public.collections(id) on delete cascade,
    
    -- composite primary key ensures each recipe-collection pair is unique
    primary key (recipe_id, collection_id)
);

-- enable row level security on recipe_tags table
alter table public.recipe_tags enable row level security;

-- rls policy: authenticated users can select recipe_tags for their own recipes
-- checks ownership through the recipes table
create policy "authenticated users can select own recipe tags"
    on public.recipe_tags
    for select
    to authenticated
    using (
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_tags.recipe_id
            and recipes.user_id = auth.uid()
        )
    );

-- rls policy: authenticated users can insert recipe_tags for their own recipes and tags
-- ensures both recipe and tag belong to the authenticated user
create policy "authenticated users can insert own recipe tags"
    on public.recipe_tags
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_tags.recipe_id
            and recipes.user_id = auth.uid()
        )
        and exists (
            select 1 from public.tags
            where tags.id = recipe_tags.tag_id
            and tags.user_id = auth.uid()
        )
    );

-- rls policy: authenticated users can delete recipe_tags for their own recipes
-- checks ownership through the recipes table
create policy "authenticated users can delete own recipe tags"
    on public.recipe_tags
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_tags.recipe_id
            and recipes.user_id = auth.uid()
        )
    );

-- enable row level security on recipe_collections table
alter table public.recipe_collections enable row level security;

-- rls policy: authenticated users can select recipe_collections for their own recipes
-- checks ownership through the recipes table
create policy "authenticated users can select own recipe collections"
    on public.recipe_collections
    for select
    to authenticated
    using (
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_collections.recipe_id
            and recipes.user_id = auth.uid()
        )
    );

-- rls policy: authenticated users can insert recipe_collections for their own recipes and collections
-- ensures both recipe and collection belong to the authenticated user
create policy "authenticated users can insert own recipe collections"
    on public.recipe_collections
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_collections.recipe_id
            and recipes.user_id = auth.uid()
        )
        and exists (
            select 1 from public.collections
            where collections.id = recipe_collections.collection_id
            and collections.user_id = auth.uid()
        )
    );

-- rls policy: authenticated users can delete recipe_collections for their own recipes
-- checks ownership through the recipes table
create policy "authenticated users can delete own recipe collections"
    on public.recipe_collections
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_collections.recipe_id
            and recipes.user_id = auth.uid()
        )
    );

-- add comments to tables for documentation
comment on table public.recipe_tags is 'junction table for many-to-many relationship between recipes and tags';
comment on column public.recipe_tags.recipe_id is 'references recipes.id with cascade delete';
comment on column public.recipe_tags.tag_id is 'references tags.id with cascade delete';

comment on table public.recipe_collections is 'junction table for many-to-many relationship between recipes and collections';
comment on column public.recipe_collections.recipe_id is 'references recipes.id with cascade delete';
comment on column public.recipe_collections.collection_id is 'references collections.id with cascade delete';

