-- Migration: Add text length constraint to shopping_list_items
-- Description: Enforce 1-200 character limit for MANUAL items at DB level

-- Add constraint for text field length (defense in depth - primary validation is in backend)
alter table public.shopping_list_items
    add constraint check_manual_text_length
        check (
            kind != 'MANUAL' 
            or (kind = 'MANUAL' and char_length(text) between 1 and 200)
        );

-- Add comment explaining the constraint
comment on constraint check_manual_text_length on public.shopping_list_items is 
    'Ensures MANUAL shopping list items have text between 1 and 200 characters (defense in depth - primary validation in backend)';
