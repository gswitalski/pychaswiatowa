-- migration: seed categories
-- description: populates the categories table with predefined recipe categories
-- tables affected: categories
-- dependencies: categories table
-- note: uses insert with on conflict to make migration idempotent

-- insert predefined categories
-- using on conflict do nothing to make this migration idempotent (can be run multiple times safely)
insert into public.categories (name) values
    ('Śniadanie'),
    ('Drugie śniadanie'),
    ('Obiad'),
    ('Kolacja'),
    ('Deser'),
    ('Ciasto'),
    ('Przekąska'),
    ('Napój'),
    ('Sałatka'),
    ('Zupa'),
    ('Danie główne'),
    ('Przystawka'),
    ('Sos'),
    ('Dip'),
    ('Smoothie'),
    ('Koktajl'),
    ('Lody'),
    ('Wegańskie'),
    ('Wegetariańskie'),
    ('Bezglutenowe'),
    ('Niskokaloryczne'),
    ('Dietetyczne'),
    ('Fit'),
    ('Świąteczne'),
    ('Grillowanie'),
    ('Pieczenie'),
    ('Gotowanie na parze'),
    ('Smażenie'),
    ('Inne')
on conflict (name) do nothing;

-- add comment
comment on table public.categories is 
    'dictionary table with predefined recipe categories, seeded during migration';

