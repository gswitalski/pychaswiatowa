-- migration: fix update_recipe_with_tags to allow setting category_id to null
-- description: adds p_update_category parameter to distinguish between "don't update" and "set to null"
-- functions affected: update_recipe_with_tags
-- bug fix: category_id cannot be cleared when explicitly set to null in the API request

/**
 * Aktualizuje funkcję update_recipe_with_tags, aby umożliwić wyzerowanie category_id.
 *
 * Problem:
 * Poprzednia implementacja nie rozróżniała między "nie aktualizuj category_id" (undefined w TypeScript)
 * a "ustaw category_id na null" (null w TypeScript). Oba przypadki były traktowane jako null w SQL,
 * co powodowało, że pole pozostawało bez zmian.
 *
 * Rozwiązanie:
 * Dodanie parametru p_update_category (boolean), który explicite wskazuje, czy category_id ma zostać zaktualizowane.
 * Analogicznie do istniejącego rozwiązania z p_update_tags.
 *
 * @param p_update_category - Boolean wskazujący, czy category_id powinno zostać zaktualizowane
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
    p_update_category boolean default false
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

    -- walidacja category_id jeśli flaga p_update_category jest ustawiona
    if p_update_category and p_category_id is not null and p_category_id > 0 then
        if not exists (select 1 from public.categories where id = p_category_id) then
            raise exception 'Category with ID % does not exist', p_category_id
                using errcode = 'P0002'; -- no_data_found
        end if;
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
comment on function public.update_recipe_with_tags(bigint, uuid, text, text, bigint, text, text, text[], boolean, recipe_visibility, text, boolean) is
    'Aktualizuje istniejący przepis wraz z powiązanymi tagami, ustawieniem widoczności, ścieżką zdjęcia i kategorią w jednej atomowej transakcji. Zwraca ID zaktualizowanego przepisu.';

-- przyznanie uprawnień do wykonania funkcji dla uwierzytelnionych użytkowników
grant execute on function public.update_recipe_with_tags(bigint, uuid, text, text, bigint, text, text, text[], boolean, recipe_visibility, text, boolean) to authenticated;
