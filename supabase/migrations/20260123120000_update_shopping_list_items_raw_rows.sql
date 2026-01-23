-- Migration: Update shopping_list_items for raw recipe rows
-- Description: Store per-recipe rows with recipe_id and recipe_name snapshot

alter table public.shopping_list_items
    add column if not exists recipe_id bigint null,
    add column if not exists recipe_name text null;

-- Drop merge-key unique index (no longer aggregating recipe items)
drop index if exists public.idx_shopping_list_items_recipe_merge_key;

-- Recreate recipe/manual field constraint to include recipe snapshot fields
alter table public.shopping_list_items
    drop constraint if exists check_recipe_kind_fields;

alter table public.shopping_list_items
    add constraint check_recipe_kind_fields
        check (
            (
                kind = 'RECIPE'
                and name is not null
                and text is null
                and recipe_id is not null
                and recipe_name is not null
            )
            or (
                kind = 'MANUAL'
                and text is not null
                and name is null
                and unit is null
                and amount is null
                and recipe_id is null
                and recipe_name is null
            )
        );

-- Indexes for efficient removal by recipe_id
create index if not exists idx_shopping_list_items_user_recipe
    on public.shopping_list_items (user_id, recipe_id)
    where kind = 'RECIPE';

comment on table public.shopping_list_items is 'User-visible shopping list items (raw RECIPE rows + manual free-text items)';
comment on column public.shopping_list_items.recipe_id is 'Recipe ID that contributed this row (RECIPE kind only)';
comment on column public.shopping_list_items.recipe_name is 'Snapshot of recipe name at time of insertion (RECIPE kind only)';
comment on column public.shopping_list_items.name is 'Ingredient name (RECIPE kind only, normalized singular nominative)';
comment on column public.shopping_list_items.amount is 'Raw amount from normalized ingredient (nullable)';
comment on column public.shopping_list_items.unit is 'Raw unit from normalized ingredient (nullable)';
