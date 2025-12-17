-- migration: add servings to recipes
-- description: adds servings column to recipes table, updates recipe_details view and create_recipe_with_tags function
-- tables affected: recipes
-- views affected: recipe_details
-- functions affected: create_recipe_with_tags
-- note: implements optional servings field (1-99 or null)

-- add servings column to recipes table
-- type: smallint (range: -32768 to 32767, sufficient for 1-99)
-- nullable: yes (servings is optional)
-- constraint: must be null or between 1 and 99
alter table public.recipes
    add column if not exists servings smallint
    check (servings is null or (servings >= 1 and servings <= 99));

-- add comment for documentation
comment on column public.recipes.servings is 'number of servings the recipe yields (1-99 or null if not specified)';

-- update recipe_details view to include servings column
drop view if exists public.recipe_details;

create view public.recipe_details as
select
    -- recipe basic information
    r.id,
    r.user_id,
    r.name,
    r.description,
    r.image_path,
    r.ingredients,
    r.steps,
    r.servings,  -- NEW: servings column
    r.created_at,
    r.updated_at,
    r.deleted_at,
    r.visibility,

    -- full-text search vector for efficient searching
    r.search_vector,

    -- category information (null if no category assigned)
    r.category_id,
    c.name as category_name,

    -- aggregated tags as jsonb array
    -- format: [{"id": 1, "name": "Italian"}, {"id": 2, "name": "Pasta"}]
    coalesce(
        (
            select jsonb_agg(
                jsonb_build_object(
                    'id', t.id,
                    'name', t.name
                )
                order by t.name
            )
            from public.tags t
            inner join public.recipe_tags rt on rt.tag_id = t.id
            where rt.recipe_id = r.id
        ),
        '[]'::jsonb
    ) as tags,

    -- aggregated collections as jsonb array
    -- format: [{"id": 1, "name": "Favorites"}, {"id": 2, "name": "Quick Meals"}]
    coalesce(
        (
            select jsonb_agg(
                jsonb_build_object(
                    'id', col.id,
                    'name', col.name
                )
                order by col.name
            )
            from public.collections col
            inner join public.recipe_collections rc on rc.collection_id = col.id
            where rc.recipe_id = r.id
        ),
        '[]'::jsonb
    ) as collections,

    -- tag ids as array for easy filtering
    coalesce(
        (
            select array_agg(t.id order by t.name)
            from public.tags t
            inner join public.recipe_tags rt on rt.tag_id = t.id
            where rt.recipe_id = r.id
        ),
        array[]::bigint[]
    ) as tag_ids,

    -- collection ids as array for easy filtering
    coalesce(
        (
            select array_agg(col.id order by col.name)
            from public.collections col
            inner join public.recipe_collections rc on rc.collection_id = col.id
            where rc.recipe_id = r.id
        ),
        array[]::bigint[]
    ) as collection_ids

from public.recipes r
left join public.categories c on c.id = r.category_id
-- only include non-deleted recipes in the view
where r.deleted_at is null;

-- grant select permissions on the view
grant select on public.recipe_details to authenticated;

-- add comment for documentation
comment on view public.recipe_details is
    'comprehensive view of recipes with aggregated tags, collections, visibility, servings, and search_vector for full-text search';

-- update create_recipe_with_tags function to include servings parameter
create or replace function public.create_recipe_with_tags(
    p_user_id uuid,
    p_name text,
    p_description text,
    p_category_id bigint,
    p_ingredients_raw text,
    p_steps_raw text,
    p_tag_names text[],
    p_visibility public.recipe_visibility default 'PRIVATE',
    p_servings smallint default null  -- NEW: servings parameter
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
    v_recipe_id bigint;
    v_tag_name text;
    v_tag_id bigint;
    v_parsed_ingredients jsonb;
    v_parsed_steps jsonb;
begin
    -- validate category_id if provided
    if p_category_id is not null then
        if not exists (select 1 from public.categories where id = p_category_id) then
            raise exception 'Category with ID % does not exist', p_category_id
                using errcode = 'P0002'; -- no_data_found
        end if;
    end if;

    -- validate servings if provided (constraint will also check, but explicit validation provides better error message)
    if p_servings is not null and (p_servings < 1 or p_servings > 99) then
        raise exception 'Servings must be between 1 and 99 or null'
            using errcode = 'P0001'; -- raise_exception
    end if;

    -- parse ingredients and steps to jsonb using existing helper function
    v_parsed_ingredients := public.parse_text_to_jsonb(p_ingredients_raw);
    v_parsed_steps := public.parse_text_to_jsonb(p_steps_raw);

    -- validate that ingredients and steps are not empty after parsing
    if jsonb_array_length(v_parsed_ingredients) = 0 then
        raise exception 'Ingredients must contain at least one item'
            using errcode = 'P0001'; -- raise_exception
    end if;

    if jsonb_array_length(v_parsed_steps) = 0 then
        raise exception 'Steps must contain at least one item'
            using errcode = 'P0001'; -- raise_exception
    end if;

    -- insert the recipe
    insert into public.recipes (
        user_id,
        name,
        description,
        category_id,
        ingredients,
        steps,
        visibility,
        servings  -- NEW: servings column
    ) values (
        p_user_id,
        p_name,
        p_description,
        p_category_id,
        v_parsed_ingredients,
        v_parsed_steps,
        p_visibility,
        p_servings  -- NEW: servings value
    )
    returning id into v_recipe_id;

    -- process tags if provided
    if p_tag_names is not null and array_length(p_tag_names, 1) > 0 then
        foreach v_tag_name in array p_tag_names loop
            -- skip empty tag names
            if trim(v_tag_name) = '' then
                continue;
            end if;

            -- try to find existing tag (case-insensitive) for this user
            select id into v_tag_id
            from public.tags
            where user_id = p_user_id
              and lower(name) = lower(trim(v_tag_name));

            -- if tag doesn't exist, create it
            if v_tag_id is null then
                insert into public.tags (user_id, name)
                values (p_user_id, lower(trim(v_tag_name)))
                returning id into v_tag_id;
            end if;

            -- link tag to recipe (ignore if already linked)
            insert into public.recipe_tags (recipe_id, tag_id)
            values (v_recipe_id, v_tag_id)
            on conflict (recipe_id, tag_id) do nothing;
        end loop;
    end if;

    return v_recipe_id;
end;
$$;

-- add comment for documentation
comment on function public.create_recipe_with_tags(uuid, text, text, bigint, text, text, text[], recipe_visibility, smallint) is
    'Creates a new recipe with associated tags, visibility setting, and servings in a single atomic transaction. Returns the new recipe ID.';

-- grant execute permission to authenticated users
grant execute on function public.create_recipe_with_tags(uuid, text, text, bigint, text, text, text[], recipe_visibility, smallint) to authenticated;
