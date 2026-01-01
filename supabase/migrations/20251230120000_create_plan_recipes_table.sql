-- Migration: Create plan_recipes table
-- Description: Persistent per-user "My Plan" list for recipes (max 50 items)

-- Create the plan_recipes table
create table if not exists public.plan_recipes (
    user_id uuid not null default auth.uid(),
    recipe_id bigint not null,
    added_at timestamptz not null default now(),
    
    -- Primary key enforces uniqueness (user_id, recipe_id)
    primary key (user_id, recipe_id),
    
    -- Foreign key to recipes table
    constraint fk_plan_recipes_recipe
        foreign key (recipe_id)
        references public.recipes(id)
        on delete cascade
);

-- Create indexes for performance
create index if not exists idx_plan_recipes_user_id_added_at 
    on public.plan_recipes (user_id, added_at desc);

create index if not exists idx_plan_recipes_recipe_id 
    on public.plan_recipes (recipe_id);

-- Enable Row Level Security
alter table public.plan_recipes enable row level security;

-- RLS Policies for plan_recipes

-- Policy: Users can view only their own plan items
create policy "Users can view their own plan items"
    on public.plan_recipes
    for select
    using (auth.uid() = user_id);

-- Policy: Users can insert only their own plan items
create policy "Users can insert their own plan items"
    on public.plan_recipes
    for insert
    with check (auth.uid() = user_id);

-- Policy: Users can delete only their own plan items
create policy "Users can delete their own plan items"
    on public.plan_recipes
    for delete
    using (auth.uid() = user_id);

-- Create function to enforce 50-item limit
-- This function is called as a trigger before insert to atomically check the limit
create or replace function public.check_plan_limit()
returns trigger
language plpgsql
security definer
as $$
declare
    plan_count int;
begin
    -- Count existing items for this user
    select count(*) into plan_count
    from public.plan_recipes
    where user_id = new.user_id;
    
    -- Enforce limit of 50 items
    if plan_count >= 50 then
        raise exception 'PLAN_LIMIT_EXCEEDED: Plan limit reached (50 recipes)'
            using hint = 'Remove some recipes before adding new ones';
    end if;
    
    return new;
end;
$$;

-- Create trigger to enforce limit before insert
create trigger enforce_plan_limit
    before insert on public.plan_recipes
    for each row
    execute function public.check_plan_limit();

-- Add comment to table
comment on table public.plan_recipes is 'Persistent per-user plan list (max 50 recipes). Users can add their own recipes or public recipes from other users.';
comment on column public.plan_recipes.user_id is 'User who added the recipe to their plan';
comment on column public.plan_recipes.recipe_id is 'Recipe added to the plan';
comment on column public.plan_recipes.added_at is 'Timestamp when recipe was added to plan (newest first for GET)';

