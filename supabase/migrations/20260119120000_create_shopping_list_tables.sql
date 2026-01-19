-- Migration: Create shopping list tables
-- Description: Shopping list feature with recipe-derived and manual items

-- =============================================================================
-- Table 1: shopping_list_items (user-visible aggregated items)
-- =============================================================================

create table if not exists public.shopping_list_items (
    id bigserial primary key,
    user_id uuid not null default auth.uid(),
    kind text not null check (kind in ('RECIPE', 'MANUAL')),

    -- Fields for RECIPE kind (aggregated from recipe contributions)
    name text null,
    amount numeric null,
    unit text null,

    -- Fields for MANUAL kind (user free-text)
    text text null,

    -- Ownership flag (user marked item as owned/purchased)
    is_owned boolean not null default false,

    -- Timestamps
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- Consistency constraints: ensure correct fields per kind
    constraint check_recipe_kind_fields
        check (
            (kind = 'RECIPE' and name is not null and text is null)
            or (kind = 'MANUAL' and text is not null and name is null and unit is null and amount is null)
        )
);

-- Create unique index for RECIPE items (merge key: user_id, name, unit)
-- Uses coalesce to handle null units (name-only items get separate row)
create unique index if not exists idx_shopping_list_items_recipe_merge_key
    on public.shopping_list_items (user_id, name, coalesce(unit, ''))
    where kind = 'RECIPE';

-- Create indexes for common queries
create index if not exists idx_shopping_list_items_user_id_kind
    on public.shopping_list_items (user_id, kind);

create index if not exists idx_shopping_list_items_user_id_is_owned
    on public.shopping_list_items (user_id, is_owned);

-- Enable Row Level Security
alter table public.shopping_list_items enable row level security;

-- RLS Policies for shopping_list_items

-- Policy: Users can view only their own shopping list items
create policy "Users can view their own shopping list items"
    on public.shopping_list_items
    for select
    using (auth.uid() = user_id);

-- Policy: Users can insert only their own shopping list items
create policy "Users can insert their own shopping list items"
    on public.shopping_list_items
    for insert
    with check (auth.uid() = user_id);

-- Policy: Users can update only their own shopping list items
create policy "Users can update their own shopping list items"
    on public.shopping_list_items
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Policy: Users can delete only their own MANUAL items (RECIPE items managed by system)
create policy "Users can delete their own manual shopping list items"
    on public.shopping_list_items
    for delete
    using (auth.uid() = user_id and kind = 'MANUAL');

-- Trigger: Auto-update updated_at timestamp
create trigger set_updated_at_shopping_list_items
    before update on public.shopping_list_items
    for each row
    execute function public.update_updated_at();

-- =============================================================================
-- Table 2: shopping_list_recipe_contributions (recipe ingredient contributions)
-- =============================================================================

create table if not exists public.shopping_list_recipe_contributions (
    user_id uuid not null default auth.uid(),
    recipe_id bigint not null,
    name text not null,
    unit text null,
    amount numeric null,
    created_at timestamptz not null default now(),

    -- Composite primary key: user_id, recipe_id, name, unit
    -- This ensures one contribution record per ingredient per recipe per user
    primary key (user_id, recipe_id, name, coalesce(unit, '')),

    -- Foreign key to recipes table
    constraint fk_shopping_list_contributions_recipe
        foreign key (recipe_id)
        references public.recipes(id)
        on delete cascade
);

-- Create index for efficient lookups by user and recipe
create index if not exists idx_shopping_list_contributions_user_recipe
    on public.shopping_list_recipe_contributions (user_id, recipe_id);

-- Enable Row Level Security
alter table public.shopping_list_recipe_contributions enable row level security;

-- RLS Policies for shopping_list_recipe_contributions

-- Policy: Users can view only their own contributions
create policy "Users can view their own recipe contributions"
    on public.shopping_list_recipe_contributions
    for select
    using (auth.uid() = user_id);

-- Policy: Users can insert only their own contributions
create policy "Users can insert their own recipe contributions"
    on public.shopping_list_recipe_contributions
    for insert
    with check (auth.uid() = user_id);

-- Policy: Users can delete only their own contributions
create policy "Users can delete their own recipe contributions"
    on public.shopping_list_recipe_contributions
    for delete
    using (auth.uid() = user_id);

-- Add comments to tables
comment on table public.shopping_list_items is 'User-visible shopping list items (aggregated RECIPE items + manual free-text items)';
comment on column public.shopping_list_items.kind is 'Item source: RECIPE (from normalized ingredients) or MANUAL (user free-text)';
comment on column public.shopping_list_items.name is 'Ingredient name (RECIPE kind only, normalized singular nominative)';
comment on column public.shopping_list_items.amount is 'Aggregated amount (RECIPE kind, sum of contributions, null for unit=null)';
comment on column public.shopping_list_items.unit is 'Ingredient unit (RECIPE kind, null for name-only items)';
comment on column public.shopping_list_items.text is 'Free-text item (MANUAL kind only)';
comment on column public.shopping_list_items.is_owned is 'User marked item as owned/purchased';

comment on table public.shopping_list_recipe_contributions is 'Tracks individual recipe contributions to shopping list (enables correct subtraction on recipe removal)';
comment on column public.shopping_list_recipe_contributions.recipe_id is 'Recipe that contributed this ingredient';
comment on column public.shopping_list_recipe_contributions.name is 'Ingredient name (matches shopping_list_items.name)';
comment on column public.shopping_list_recipe_contributions.unit is 'Ingredient unit (matches shopping_list_items.unit, null for name-only)';
comment on column public.shopping_list_recipe_contributions.amount is 'Amount contributed by this recipe (null for name-only items)';
