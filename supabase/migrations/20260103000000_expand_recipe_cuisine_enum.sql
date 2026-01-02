-- migration: expand recipe_cuisine enum with additional world cuisines
-- description: adds more cuisine options to recipe_cuisine enum type
-- tables affected: recipes (indirectly via enum type)
-- note: PostgreSQL requires adding each enum value separately using ALTER TYPE

-- add new cuisine values to the recipe_cuisine enum
-- ordering: alphabetical by enum value name for consistency

alter type public.recipe_cuisine add value if not exists 'AFRICAN';
alter type public.recipe_cuisine add value if not exists 'AMERICAN';
alter type public.recipe_cuisine add value if not exists 'BALKAN';
alter type public.recipe_cuisine add value if not exists 'BRAZILIAN';
alter type public.recipe_cuisine add value if not exists 'BRITISH';
alter type public.recipe_cuisine add value if not exists 'CARIBBEAN';
alter type public.recipe_cuisine add value if not exists 'CHINESE';
alter type public.recipe_cuisine add value if not exists 'FRENCH';
alter type public.recipe_cuisine add value if not exists 'GERMAN';
alter type public.recipe_cuisine add value if not exists 'GREEK';
alter type public.recipe_cuisine add value if not exists 'INDIAN';
alter type public.recipe_cuisine add value if not exists 'ITALIAN';
alter type public.recipe_cuisine add value if not exists 'JAPANESE';
alter type public.recipe_cuisine add value if not exists 'KOREAN';
alter type public.recipe_cuisine add value if not exists 'MEDITERRANEAN';
alter type public.recipe_cuisine add value if not exists 'RUSSIAN';
alter type public.recipe_cuisine add value if not exists 'SCANDINAVIAN';
alter type public.recipe_cuisine add value if not exists 'SPANISH';
alter type public.recipe_cuisine add value if not exists 'THAI';
alter type public.recipe_cuisine add value if not exists 'TURKISH';
alter type public.recipe_cuisine add value if not exists 'VIETNAMESE';

-- update comment for documentation
comment on type public.recipe_cuisine is 'recipe cuisine classification: world cuisines (25 options total)';

