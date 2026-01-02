-- migration: add classification fields to recipes
-- description: adds diet_type, cuisine, and difficulty columns with enum types to recipes table
-- tables affected: recipes
-- note: all fields are nullable and optional for recipe classification

-- create enum type for diet_type
create type public.recipe_diet_type as enum ('MEAT', 'VEGETARIAN', 'VEGAN');

-- create enum type for cuisine
create type public.recipe_cuisine as enum ('POLISH', 'ASIAN', 'MEXICAN', 'MIDDLE_EASTERN');

-- create enum type for difficulty
create type public.recipe_difficulty as enum ('EASY', 'MEDIUM', 'HARD');

-- add diet_type column to recipes table
-- nullable: yes (classification is optional)
alter table public.recipes
    add column if not exists diet_type public.recipe_diet_type;

-- add cuisine column to recipes table
-- nullable: yes (classification is optional)
alter table public.recipes
    add column if not exists cuisine public.recipe_cuisine;

-- add difficulty column to recipes table
-- nullable: yes (classification is optional)
alter table public.recipes
    add column if not exists difficulty public.recipe_difficulty;

-- add comments for documentation
comment on column public.recipes.diet_type is 'recipe diet classification: MEAT, VEGETARIAN, or VEGAN (nullable)';
comment on column public.recipes.cuisine is 'recipe cuisine classification: 25 world cuisines available (AFRICAN, AMERICAN, ASIAN, BALKAN, BRAZILIAN, BRITISH, CARIBBEAN, CHINESE, FRENCH, GERMAN, GREEK, INDIAN, ITALIAN, JAPANESE, KOREAN, MEDITERRANEAN, MEXICAN, MIDDLE_EASTERN, POLISH, RUSSIAN, SCANDINAVIAN, SPANISH, THAI, TURKISH, VIETNAMESE) - nullable';
comment on column public.recipes.difficulty is 'recipe difficulty level: EASY, MEDIUM, or HARD (nullable)';

