-- migration: update parse_text_to_jsonb function
-- description: updates the parse_text_to_jsonb function to remove numbering and bullet points from steps
-- functions updated: parse_text_to_jsonb
-- dependencies: none
-- note: this migration enhances the parser to strip common numbering patterns (1., 2), etc.) and bullets (-, *, +, •)

-- drop the existing function first
drop function if exists public.parse_text_to_jsonb(text);

-- recreate the function with enhanced parsing logic
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
            -- for regular items, clean up numbering and bullet points
            cleaned_line := trimmed_line;

            -- remove leading bullets: -, *, +, •
            -- pattern: starts with bullet followed by optional space
            cleaned_line := regexp_replace(cleaned_line, '^[-*+•]\s*', '', 'g');

            -- remove leading numbering patterns:
            -- - "1." or "1)" (digit followed by dot or closing parenthesis)
            -- - "1.1." or "1.1)" (multi-level numbering)
            -- pattern explanation:
            --   ^\d+ matches one or more digits at the start
            --   (\.\d+)* matches optional sub-numbering like .1 .2
            --   [.)] matches either dot or closing parenthesis
            --   \s* matches optional whitespace after
            cleaned_line := regexp_replace(cleaned_line, '^\d+(\.\d+)*[.)]\s*', '', 'g');

            -- trim any remaining leading/trailing whitespace
            cleaned_line := trim(cleaned_line);

            -- only add non-empty items
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

-- add comment for documentation
comment on function public.parse_text_to_jsonb(text) is
    'Parses raw text into jsonb array with headers (##) and items. Automatically strips numbering (1., 2.), 1.1.) and bullets (-, *, +, •) from items.';


