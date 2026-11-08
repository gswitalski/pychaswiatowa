-- Migration: Create user_recipe_notes (PS-31)
-- Dependencies: auth.users, public.recipes, public.handle_updated_at()

create table public.user_recipe_notes (
    user_id uuid not null references auth.users(id) on delete cascade,
    recipe_id bigint not null references public.recipes(id) on delete cascade,
    note text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint user_recipe_notes_pkey primary key (user_id, recipe_id),
    constraint user_recipe_notes_note_length check (char_length(note) <= 2000),
    constraint user_recipe_notes_note_not_blank check (char_length(btrim(note)) > 0)
);

create index idx_user_recipe_notes_recipe_id
    on public.user_recipe_notes (recipe_id);

create trigger set_user_recipe_notes_updated_at
    before update on public.user_recipe_notes
    for each row
    execute function public.handle_updated_at();

alter table public.user_recipe_notes enable row level security;
revoke all on table public.user_recipe_notes from anon;

create policy "authenticated users can select own recipe notes"
    on public.user_recipe_notes
    for select
    to authenticated
    using (auth.uid() = user_id);

create policy "authenticated users can insert own recipe notes"
    on public.user_recipe_notes
    for insert
    to authenticated
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = user_recipe_notes.recipe_id
                and recipes.deleted_at is null
                and (
                    recipes.user_id = auth.uid()
                    or recipes.visibility = 'PUBLIC'
                )
        )
    );

create policy "authenticated users can update own recipe notes"
    on public.user_recipe_notes
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = user_recipe_notes.recipe_id
                and recipes.deleted_at is null
                and (
                    recipes.user_id = auth.uid()
                    or recipes.visibility = 'PUBLIC'
                )
        )
    );

create policy "authenticated users can delete own recipe notes"
    on public.user_recipe_notes
    for delete
    to authenticated
    using (auth.uid() = user_id);

comment on table public.user_recipe_notes is
    'Private per-user recipe notes; visible only to the note owner';

create or replace function public.set_recipe_note(
    p_recipe_id bigint,
    p_note text
)
returns table (
    out_recipe_id bigint,
    out_my_note text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_trimmed text;
begin
    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    if not exists (
        select 1
        from public.recipes r
        where r.id = p_recipe_id
            and r.deleted_at is null
            and (r.user_id = v_user_id or r.visibility = 'PUBLIC')
    ) then
        raise exception 'Recipe not found'
            using errcode = 'P0002';
    end if;

    v_trimmed := btrim(coalesce(p_note, ''));

    if v_trimmed = '' then
        delete from public.user_recipe_notes n
        where n.user_id = v_user_id
            and n.recipe_id = p_recipe_id;

        return query select p_recipe_id, null::text;
        return;
    end if;

    if char_length(v_trimmed) > 2000 then
        raise exception 'Note too long'
            using errcode = '22023';
    end if;

    insert into public.user_recipe_notes as n (
        user_id,
        recipe_id,
        note
    )
    values (
        v_user_id,
        p_recipe_id,
        v_trimmed
    )
    on conflict (user_id, recipe_id) do update
        set note = excluded.note;

    return query select p_recipe_id, v_trimmed;
end;
$$;

revoke all on function public.set_recipe_note(bigint, text) from public;
grant execute on function public.set_recipe_note(bigint, text) to authenticated;

comment on function public.set_recipe_note(bigint, text) is
    'Upserts or deletes the caller''s private note for an accessible recipe (owner or PUBLIC).';
