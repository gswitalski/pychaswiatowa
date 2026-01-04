-- migration: add grill flag to recipes
-- description: adds is_grill boolean column to recipes table for grill recipe classification
-- tables affected: recipes
-- note: field is non-nullable with default false (all existing recipes are non-grill by default)

-- add is_grill column to recipes table
-- nullable: no (boolean with default false)
-- default: false (recipes are not grill-specific by default)
alter table public.recipes
    add column if not exists is_grill boolean not null default false;

-- add comment for documentation
comment on column public.recipes.is_grill is 'flag indicating recipe is designed for grill/barbecue cooking (non-nullable, default false)';

