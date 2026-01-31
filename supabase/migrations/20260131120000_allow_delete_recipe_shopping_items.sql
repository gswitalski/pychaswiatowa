-- Migration: Allow deleting recipe-derived shopping list items
-- Description: Enable DELETE for RECIPE items owned by user (needed for group removal)

-- Replace restrictive delete policy (manual-only) with a user-owned policy
drop policy if exists "Users can delete their own manual shopping list items"
    on public.shopping_list_items;

create policy "Users can delete their own shopping list items"
    on public.shopping_list_items
    for delete
    using (auth.uid() = user_id);
