-- migration: add tips column to recipes table
-- description: adds tips jsonb column to store structured recipe tips/hints
-- tables affected: recipes
-- note: tips defaults to empty array '[]'::jsonb

-- add tips column to recipes table
alter table public.recipes
add column tips jsonb not null default '[]'::jsonb;

-- add comment for documentation
comment on column public.recipes.tips is
    'Structured recipe tips/hints in JSONB format: [{"type": "header"|"item", "content": "text"}]. Can be empty array.';
