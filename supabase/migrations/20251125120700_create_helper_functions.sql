-- migration: create helper functions
-- description: creates postgresql functions for parsing text to jsonb and other utilities
-- functions created: parse_text_to_jsonb
-- dependencies: none
-- note: these functions help with data processing and transformation

-- function to parse raw text into structured jsonb format
-- converts text with headers (lines starting with ##) and items into json array
-- format: [{"type": "header", "content": "text"}, {"type": "item", "content": "text"}]
create or replace function public.parse_text_to_jsonb(input_text text)
returns jsonb
language plpgsql
immutable
as $$
declare
    result jsonb := '[]'::jsonb;
    line_text text;
    trimmed_line text;
    line_array text[];
begin
    -- return empty array if input is null or empty
    if input_text is null or trim(input_text) = '' then
        return result;
    end if;
    
    -- split input text into lines
    line_array := string_to_array(input_text, E'\n');
    
    -- process each line
    foreach line_text in array line_array loop
        trimmed_line := trim(line_text);
        
        -- skip empty lines
        if trimmed_line = '' then
            continue;
        end if;
        
        -- check if line starts with ## (header marker)
        if trimmed_line like '##%' then
            -- remove ## prefix and add as header
            result := result || jsonb_build_object(
                'type', 'header',
                'content', trim(substring(trimmed_line from 3))
            );
        else
            -- remove leading dash/hyphen if present and add as item
            if trimmed_line like '-%' then
                trimmed_line := trim(substring(trimmed_line from 2));
            end if;
            
            result := result || jsonb_build_object(
                'type', 'item',
                'content', trimmed_line
            );
        end if;
    end loop;
    
    return result;
end;
$$;

-- function to convert jsonb back to formatted text (for display or export)
create or replace function public.jsonb_to_text(input_jsonb jsonb)
returns text
language plpgsql
immutable
as $$
declare
    result text := '';
    item jsonb;
    item_type text;
    item_content text;
begin
    -- return empty string if input is null
    if input_jsonb is null then
        return result;
    end if;
    
    -- process each item in the jsonb array
    for item in select * from jsonb_array_elements(input_jsonb) loop
        item_type := item->>'type';
        item_content := item->>'content';
        
        if item_type = 'header' then
            -- add header with ## prefix
            result := result || E'## ' || item_content || E'\n';
        elsif item_type = 'item' then
            -- add item with - prefix
            result := result || E'- ' || item_content || E'\n';
        end if;
    end loop;
    
    return trim(result);
end;
$$;

-- add comments for documentation
comment on function public.parse_text_to_jsonb(text) is 
    'parses raw text into jsonb array with headers (##) and items (-)';
comment on function public.jsonb_to_text(jsonb) is 
    'converts jsonb array back to formatted text with headers and items';

