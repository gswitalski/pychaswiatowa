-- Migration: Create private user notes on recipes
-- Dependencies: auth.users, public.recipes, public.handle_updated_at()

create table public.user_recipe_notes (
    user_id uuid not null references auth.users(id) on delete cascade,
    recipe_id bigint not null references public.recipes(id) on delete cascade,
    note text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint user_recipe_notes_pkey primary key (user_id, recipe_id),
    constraint user_recipe_notes_note_length check (char_length(note) between 1 and 2000)
);

create index idx_user_recipe_notes_recipe_id
    on public.user_recipe_notes (recipe_id);

create trigger set_user_recipe_notes_updated_at
    before update on public.user_recipe_notes
    for each row execute function public.handle_updated_at();

alter table public.user_recipe_notes enable row level security;
revoke all on table public.user_recipe_notes from anon;

create policy "Users can read their own recipe notes"
    on public.user_recipe_notes for select to authenticated
    using (auth.uid() = user_id);

create policy "Users can insert accessible recipe notes"
    on public.user_recipe_notes for insert to authenticated
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = user_recipe_notes.recipe_id
                and recipes.deleted_at is null
                and (recipes.user_id = auth.uid() or recipes.visibility = 'PUBLIC')
        )
    );

create policy "Users can update accessible recipe notes"
    on public.user_recipe_notes for update to authenticated
    using (auth.uid() = user_id)
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = user_recipe_notes.recipe_id
                and recipes.deleted_at is null
                and (recipes.user_id = auth.uid() or recipes.visibility = 'PUBLIC')
        )
    );

create policy "Users can delete their own recipe notes"
    on public.user_recipe_notes for delete to authenticated
    using (auth.uid() = user_id);

comment on table public.user_recipe_notes is 'Private notes belonging to users for accessible recipes.';
comment on column public.user_recipe_notes.note is 'Normalized note text, between 1 and 2000 characters.';

create or replace function public.set_recipe_note(
    p_recipe_id bigint,
    p_note text default null
)
returns table(out_recipe_id bigint, out_note text, out_updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_note text;
begin
    if v_user_id is null then
        raise exception 'Authentication required' using errcode = '42501';
    end if;

    -- btrim intentionally covers the API's common ASCII whitespace. The API
    -- additionally normalizes all JavaScript trim whitespace before this RPC.
    v_note := nullif(
        btrim(
            replace(replace(coalesce(p_note, ''), E'\r\n', E'\n'), E'\r', E'\n'),
            E' \t\n'
        ),
        ''
    );

    if v_note is not null and char_length(v_note) > 2000 then
        raise exception 'Recipe note is too long' using errcode = '22023';
    end if;

    if not exists (
        select 1
        from public.recipes
        where recipes.id = p_recipe_id
            and recipes.deleted_at is null
            and (recipes.user_id = v_user_id or recipes.visibility = 'PUBLIC')
    ) then
        raise exception 'Recipe not found' using errcode = 'P0002';
    end if;

    if v_note is null then
        delete from public.user_recipe_notes
        where user_id = v_user_id and recipe_id = p_recipe_id;
        return query select p_recipe_id, null::text, null::timestamptz;
        return;
    end if;

    insert into public.user_recipe_notes(user_id, recipe_id, note)
    values (v_user_id, p_recipe_id, v_note)
    on conflict (user_id, recipe_id) do update
        set note = excluded.note
        where public.user_recipe_notes.note is distinct from excluded.note;

    return query
        select recipe_id, note, updated_at
        from public.user_recipe_notes
        where user_id = v_user_id and recipe_id = p_recipe_id;
end;
$$;

revoke all on function public.set_recipe_note(bigint, text) from public, anon;
grant execute on function public.set_recipe_note(bigint, text) to authenticated;
comment on function public.set_recipe_note(bigint, text) is 'Idempotently sets or removes the authenticated user recipe note.';
