-- migration: fix update_recipe_with_tags missing parameters
-- description: naprawia funkcję update_recipe_with_tags - dodaje brakujące parametry p_image_path i p_update_category
-- functions affected: update_recipe_with_tags
-- bug fix: migracja servings pominęła parametry image_path i update_category z poprzednich migracji

/**
 * Naprawia funkcję update_recipe_with_tags.
 *
 * Problem:
 * Migracja 20251217120100_update_rpc_functions_for_servings.sql została przygotowana
 * bazując na starszej wersji funkcji i nie uwzględniła zmian z migracji:
 * - 20251213150000_add_image_path_to_update_recipe.sql (p_image_path)
 * - 20251214200000_fix_update_recipe_category_null.sql (p_update_category)
 *
 * W efekcie wywołanie RPC z parametrami p_image_path i p_update_category kończy się błędem 500.
 *
 * Rozwiązanie:
 * Ta migracja dropuje wadliwą wersję funkcji i tworzy poprawną z wszystkimi parametrami.
 */

-- drop existing broken function (signature from servings migration)
drop function if exists public.update_recipe_with_tags(bigint, uuid, text, text, bigint, text, text, text[], boolean, recipe_visibility, smallint, boolean);

/**
 * Updates an existing recipe with associated tags in a single atomic transaction.
 *
 * This function:
 * 1. Verifies the recipe exists and belongs to the user (soft-delete aware)
 * 2. Validates that the category exists (if provided)
 * 3. Updates only the fields that are not NULL (or based on update flags)
 * 4. Parses raw ingredients and steps text to JSONB format (if provided)
 * 5. Manages tags: removes old associations and creates/links new ones (if provided)
 * 6. Updates category if p_update_category flag is set (allows setting to null)
 * 7. Updates servings if p_update_servings flag is set (allows setting to null)
 * 8. Returns the updated recipe ID
 *
 * @param p_recipe_id - The ID of the recipe to update
 * @param p_user_id - The UUID of the authenticated user (must be the owner)
 * @param p_name - Optional new name of the recipe (1-150 characters)
 * @param p_description - Optional new description (pass empty string to clear)
 * @param p_category_id - Optional new category ID (null to clear if p_update_category is true)
 * @param p_ingredients_raw - Optional new raw text of ingredients (will be parsed to JSONB)
 * @param p_steps_raw - Optional new raw text of steps (will be parsed to JSONB)
 * @param p_tag_names - Optional array of tag names to associate (replaces all existing tags)
 * @param p_update_tags - Boolean flag indicating whether to update tags
 * @param p_visibility - Optional new visibility setting
 * @param p_image_path - Optional new image path (null to clear)
 * @param p_update_category - Boolean flag indicating whether to update category (allows setting to null)
 * @param p_servings - Optional new servings value (1-99 or null to clear)
 * @param p_update_servings - Boolean flag indicating whether to update servings (allows setting to null)
 *
 * @returns The ID of the updated recipe
 * @throws exception if recipe not found or not owned by user
 * @throws exception if category_id is invalid
 * @throws exception if servings is out of range
 * @throws exception if ingredients/steps are empty after parsing
 */
create or replace function public.update_recipe_with_tags(
    p_recipe_id bigint,
    p_user_id uuid,
    p_name text default null,
    p_description text default null,
    p_category_id bigint default null,
    p_ingredients_raw text default null,
    p_steps_raw text default null,
    p_tag_names text[] default null,
    p_update_tags boolean default false,
    p_visibility public.recipe_visibility default null,
    p_image_path text default null,
    p_update_category boolean default false,
    p_servings smallint default null,
    p_update_servings boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
    v_existing_recipe_id bigint;
    v_tag_name text;
    v_tag_id bigint;
    v_parsed_ingredients jsonb;
    v_parsed_steps jsonb;
begin
    -- weryfikacja, czy przepis istnieje, należy do użytkownika i nie jest usunięty
    select id into v_existing_recipe_id
    from public.recipes
    where id = p_recipe_id
      and user_id = p_user_id
      and deleted_at is null;

    if v_existing_recipe_id is null then
        raise exception 'Recipe with ID % not found or access denied', p_recipe_id
            using errcode = 'P0002'; -- no_data_found
    end if;

    -- walidacja category_id jeśli flaga p_update_category jest ustawiona i wartość nie jest null
    if p_update_category and p_category_id is not null then
        if not exists (select 1 from public.categories where id = p_category_id) then
            raise exception 'Category with ID % does not exist', p_category_id
                using errcode = 'P0002'; -- no_data_found
        end if;
    end if;

    -- walidacja servings jeśli flaga p_update_servings jest ustawiona
    if p_update_servings and p_servings is not null and (p_servings < 1 or p_servings > 99) then
        raise exception 'Servings must be between 1 and 99 or null'
            using errcode = 'P0001'; -- raise_exception
    end if;

    -- parsowanie i walidacja składników jeśli zostały przekazane
    if p_ingredients_raw is not null then
        v_parsed_ingredients := public.parse_text_to_jsonb(p_ingredients_raw);

        if jsonb_array_length(v_parsed_ingredients) = 0 then
            raise exception 'Ingredients must contain at least one item'
                using errcode = 'P0001'; -- raise_exception
        end if;
    end if;

    -- parsowanie i walidacja kroków jeśli zostały przekazane
    if p_steps_raw is not null then
        v_parsed_steps := public.parse_text_to_jsonb(p_steps_raw);

        if jsonb_array_length(v_parsed_steps) = 0 then
            raise exception 'Steps must contain at least one item'
                using errcode = 'P0001'; -- raise_exception
        end if;
    end if;

    -- aktualizacja przepisu z uwzględnieniem tylko przekazanych pól
    update public.recipes
    set
        name = coalesce(p_name, name),
        description = case
            when p_description is not null then nullif(p_description, '')
            else description
        end,
        category_id = case
            when p_update_category then p_category_id
            else category_id
        end,
        ingredients = coalesce(v_parsed_ingredients, ingredients),
        steps = coalesce(v_parsed_steps, steps),
        visibility = coalesce(p_visibility, visibility),
        image_path = coalesce(p_image_path, image_path),
        servings = case
            when p_update_servings then p_servings
            else servings
        end,
        updated_at = now()
    where id = p_recipe_id
      and user_id = p_user_id
      and deleted_at is null;

    -- przetwarzanie tagów jeśli flaga p_update_tags jest ustawiona
    if p_update_tags then
        -- usunięcie wszystkich istniejących powiązań tagów dla tego przepisu
        delete from public.recipe_tags
        where recipe_id = p_recipe_id;

        -- dodanie nowych tagów jeśli zostały przekazane
        if p_tag_names is not null and array_length(p_tag_names, 1) > 0 then
            foreach v_tag_name in array p_tag_names loop
                -- pomijanie pustych nazw tagów
                if trim(v_tag_name) = '' then
                    continue;
                end if;

                -- próba znalezienia istniejącego tagu (bez uwzględniania wielkości liter)
                select id into v_tag_id
                from public.tags
                where user_id = p_user_id
                  and lower(name) = lower(trim(v_tag_name));

                -- jeśli tag nie istnieje, utwórz go
                if v_tag_id is null then
                    insert into public.tags (user_id, name)
                    values (p_user_id, lower(trim(v_tag_name)))
                    returning id into v_tag_id;
                end if;

                -- połączenie tagu z przepisem (ignorowanie jeśli już istnieje)
                insert into public.recipe_tags (recipe_id, tag_id)
                values (p_recipe_id, v_tag_id)
                on conflict (recipe_id, tag_id) do nothing;
            end loop;
        end if;
    end if;

    return p_recipe_id;
end;
$$;

-- dodanie komentarza do dokumentacji
comment on function public.update_recipe_with_tags(bigint, uuid, text, text, bigint, text, text, text[], boolean, recipe_visibility, text, boolean, smallint, boolean) is
    'Aktualizuje istniejący przepis wraz z powiązanymi tagami, widocznością, ścieżką zdjęcia, kategorią i liczbą porcji w jednej atomowej transakcji. Zwraca ID zaktualizowanego przepisu.';

-- przyznanie uprawnień do wykonania funkcji dla uwierzytelnionych użytkowników
grant execute on function public.update_recipe_with_tags(bigint, uuid, text, text, bigint, text, text, text[], boolean, recipe_visibility, text, boolean, smallint, boolean) to authenticated;
