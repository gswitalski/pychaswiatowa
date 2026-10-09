-- Migration: Create user_recipe_flags
-- Description: Personal per-user recipe flags ("favorite", "want to try")
-- Dependencies: auth.users, public.recipes, public.handle_updated_at()

create table public.user_recipe_flags (
    user_id uuid not null references auth.users(id) on delete cascade,
    recipe_id bigint not null references public.recipes(id) on delete cascade,
    is_favorite boolean not null default false,
    is_want_to_try boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint user_recipe_flags_pkey primary key (user_id, recipe_id),
    constraint user_recipe_flags_at_least_one_flag
        check (is_favorite or is_want_to_try)
);

create index idx_user_recipe_flags_recipe_id
    on public.user_recipe_flags (recipe_id);

create index idx_user_recipe_flags_user_favorite
    on public.user_recipe_flags (user_id, recipe_id)
    where is_favorite;

create trigger set_user_recipe_flags_updated_at
    before update on public.user_recipe_flags
    for each row
    execute function public.handle_updated_at();

alter table public.user_recipe_flags enable row level security;

revoke all on table public.user_recipe_flags from anon;

create policy "authenticated users can select own recipe flags"
    on public.user_recipe_flags
    for select
    to authenticated
    using (auth.uid() = user_id);

create policy "authenticated users can insert own recipe flags"
    on public.user_recipe_flags
    for insert
    to authenticated
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = user_recipe_flags.recipe_id
                and recipes.deleted_at is null
                and (
                    recipes.user_id = auth.uid()
                    or recipes.visibility = 'PUBLIC'
                )
        )
    );

create policy "authenticated users can update own recipe flags"
    on public.user_recipe_flags
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = user_recipe_flags.recipe_id
                and recipes.deleted_at is null
                and (
                    recipes.user_id = auth.uid()
                    or recipes.visibility = 'PUBLIC'
                )
        )
    );

create policy "authenticated users can delete own recipe flags"
    on public.user_recipe_flags
    for delete
    to authenticated
    using (auth.uid() = user_id);

comment on table public.user_recipe_flags is
    'Personal per-user recipe flags (favorite / want to try); visible only to the owner of the flag';
comment on column public.user_recipe_flags.is_favorite is
    'Recipe marked as favorite by the user (heart)';
comment on column public.user_recipe_flags.is_want_to_try is
    'Recipe marked by the user as "want to try"';

create or replace function public.set_recipe_flags(
    p_recipe_id bigint,
    p_is_favorite boolean default null,
    p_is_want_to_try boolean default null
)
returns table (
    out_recipe_id bigint,
    out_is_favorite boolean,
    out_is_want_to_try boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_current_favorite boolean;
    v_current_want_to_try boolean;
    v_next_favorite boolean;
    v_next_want_to_try boolean;
begin
    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    if p_is_favorite is null and p_is_want_to_try is null then
        raise exception 'At least one flag is required'
            using errcode = '22023';
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

    select f.is_favorite, f.is_want_to_try
    into v_current_favorite, v_current_want_to_try
    from public.user_recipe_flags f
    where f.user_id = v_user_id
        and f.recipe_id = p_recipe_id
    for update;

    if not found then
        v_current_favorite := false;
        v_current_want_to_try := false;
    end if;

    v_next_favorite := coalesce(p_is_favorite, v_current_favorite);
    v_next_want_to_try := coalesce(p_is_want_to_try, v_current_want_to_try);

    if not v_next_favorite and not v_next_want_to_try then
        delete from public.user_recipe_flags f
        where f.user_id = v_user_id
            and f.recipe_id = p_recipe_id;
    else
        insert into public.user_recipe_flags as f (
            user_id,
            recipe_id,
            is_favorite,
            is_want_to_try
        )
        values (
            v_user_id,
            p_recipe_id,
            v_next_favorite,
            v_next_want_to_try
        )
        on conflict (user_id, recipe_id) do update
            set is_favorite = excluded.is_favorite,
                is_want_to_try = excluded.is_want_to_try;
    end if;

    return query select p_recipe_id, v_next_favorite, v_next_want_to_try;
end;
$$;

revoke all on function public.set_recipe_flags(bigint, boolean, boolean) from public;
grant execute on function public.set_recipe_flags(bigint, boolean, boolean) to authenticated;

comment on function public.set_recipe_flags(bigint, boolean, boolean) is
    'Idempotent partial update of the caller''s personal recipe flags; deletes the row when both flags are false.';
