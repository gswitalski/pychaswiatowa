-- migration: fix parse_text_to_jsonb header marker
-- description: zmienia marker nagłówka z ## na # zgodnie z dokumentacją PRD
-- problem: funkcja rozpoznawała ## jako nagłówek, ale użytkownicy wpisują # (pojedynczy hash)
-- fix: zmiana wzorca z '##%' na '#%' oraz usuwanie jednego znaku zamiast dwóch
-- dependencies: 20251212120000_update_parse_text_to_jsonb_function.sql

-- usuń istniejącą funkcję
drop function if exists public.parse_text_to_jsonb(text);

-- odtwórz funkcję z poprawionym markerem nagłówka (# zamiast ##)
create or replace function public.parse_text_to_jsonb(input_text text)
returns jsonb
language plpgsql
immutable
as $$
declare
    result jsonb := '[]'::jsonb;
    line_text text;
    trimmed_line text;
    cleaned_line text;
    line_array text[];
begin
    -- zwróć pustą tablicę jeśli wejście jest null lub puste
    if input_text is null or trim(input_text) = '' then
        return result;
    end if;

    -- podziel tekst wejściowy na linie
    line_array := string_to_array(input_text, E'\n');

    -- przetwórz każdą linię
    foreach line_text in array line_array loop
        trimmed_line := trim(line_text);

        -- pomiń puste linie
        if trimmed_line = '' then
            continue;
        end if;

        -- sprawdź czy linia zaczyna się od # (marker nagłówka)
        -- zgodnie z PRD: "Linie rozpoczynające się od znaku # są interpretowane jako nagłówki sekcji"
        if trimmed_line like '#%' then
            -- usuń prefiks # i dodaj jako nagłówek
            -- usuń wszystkie wiodące znaki # i spację po nich
            cleaned_line := regexp_replace(trimmed_line, '^#+\s*', '', 'g');
            
            -- dodaj tylko jeśli po usunięciu # zostało coś
            if cleaned_line != '' then
                result := result || jsonb_build_object(
                    'type', 'header',
                    'content', cleaned_line
                );
            end if;
        else
            -- dla zwykłych elementów, wyczyść numerację i punktory
            cleaned_line := trimmed_line;

            -- usuń wiodące punktory: -, *, +, •
            cleaned_line := regexp_replace(cleaned_line, '^[-*+•]\s*', '', 'g');

            -- usuń wiodące wzorce numeracji:
            -- - "1." lub "1)" (cyfra i kropka lub nawias zamykający)
            -- - "1.1." lub "1.1)" (wielopoziomowa numeracja)
            cleaned_line := regexp_replace(cleaned_line, '^\d+(\.\d+)*[.)]\s*', '', 'g');

            -- przytnij pozostałe białe znaki
            cleaned_line := trim(cleaned_line);

            -- dodaj tylko niepuste elementy
            if cleaned_line != '' then
                result := result || jsonb_build_object(
                    'type', 'item',
                    'content', cleaned_line
                );
            end if;
        end if;
    end loop;

    return result;
end;
$$;

-- dodaj komentarz dokumentacyjny
comment on function public.parse_text_to_jsonb(text) is
    'Parsuje surowy tekst do tablicy JSONB z nagłówkami (#) i elementami. Automatycznie usuwa numerację (1., 2.), 1.1.) oraz punktory (-, *, +, •) z elementów.';

-- ========================================
-- NAPRAWA ISTNIEJĄCYCH DANYCH
-- ========================================
-- Aktualizuj istniejące przepisy, których składniki lub kroki
-- zawierają elementy z content zaczynającym się od '#' ale mają type='item'
-- Te elementy powinny mieć type='header'

-- Funkcja pomocnicza do naprawy tablicy JSONB z elementami przepisu
create or replace function public._fix_recipe_content_headers(content_array jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
    result jsonb := '[]'::jsonb;
    item jsonb;
    item_type text;
    item_content text;
    cleaned_content text;
begin
    if content_array is null or jsonb_array_length(content_array) = 0 then
        return content_array;
    end if;
    
    for item in select * from jsonb_array_elements(content_array) loop
        item_type := item->>'type';
        item_content := item->>'content';
        
        -- sprawdź czy content zaczyna się od # ale type to 'item'
        if item_type = 'item' and item_content like '#%' then
            -- to powinien być header - napraw
            cleaned_content := regexp_replace(item_content, '^#+\s*', '', 'g');
            result := result || jsonb_build_object(
                'type', 'header',
                'content', cleaned_content
            );
        else
            -- pozostaw bez zmian
            result := result || item;
        end if;
    end loop;
    
    return result;
end;
$$;

-- Napraw składniki w istniejących przepisach
update public.recipes
set ingredients = public._fix_recipe_content_headers(ingredients)
where ingredients is not null
  and deleted_at is null
  and exists (
    select 1
    from jsonb_array_elements(ingredients) as elem
    where elem->>'type' = 'item'
      and elem->>'content' like '#%'
  );

-- Napraw kroki w istniejących przepisach
update public.recipes
set steps = public._fix_recipe_content_headers(steps)
where steps is not null
  and deleted_at is null
  and exists (
    select 1
    from jsonb_array_elements(steps) as elem
    where elem->>'type' = 'item'
      and elem->>'content' like '#%'
  );

-- Usuń funkcję pomocniczą (nie jest już potrzebna)
drop function if exists public._fix_recipe_content_headers(jsonb);

