-- Migration: Create recipe_ratings
-- Description: Per-user recipe ratings (1-5) for PUBLIC recipes of other authors.

create table public.recipe_ratings (
    user_id uuid not null references auth.users(id) on delete cascade,
    recipe_id bigint not null references public.recipes(id) on delete cascade,
    rating smallint not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint recipe_ratings_pkey primary key (user_id, recipe_id),
    constraint recipe_ratings_rating_range check (rating between 1 and 5)
);

create index idx_recipe_ratings_recipe_id
    on public.recipe_ratings (recipe_id) include (rating);

create trigger set_recipe_ratings_updated_at
    before update on public.recipe_ratings
    for each row
    execute function public.handle_updated_at();

alter table public.recipe_ratings enable row level security;

revoke all on table public.recipe_ratings from anon;

create policy "authenticated users can select own recipe ratings"
    on public.recipe_ratings
    for select
    to authenticated
    using (auth.uid() = user_id);

create policy "authenticated users can insert own recipe ratings"
    on public.recipe_ratings
    for insert
    to authenticated
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = recipe_ratings.recipe_id
              and recipes.deleted_at is null
              and recipes.visibility = 'PUBLIC'
              and recipes.user_id <> auth.uid()
        )
    );

create policy "authenticated users can update own recipe ratings"
    on public.recipe_ratings
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = recipe_ratings.recipe_id
              and recipes.deleted_at is null
              and recipes.visibility = 'PUBLIC'
              and recipes.user_id <> auth.uid()
        )
    );

create policy "authenticated users can delete own recipe ratings"
    on public.recipe_ratings
    for delete
    to authenticated
    using (auth.uid() = user_id);

comment on table public.recipe_ratings is
    'Per-user rating (1-5) of a PUBLIC recipe of another author; individual rows are visible only to their owner.';
comment on column public.recipe_ratings.rating is
    'Star rating, integer 1-5.';

create or replace view public.recipe_details as
select
    r.id,
    r.user_id,
    r.name,
    r.description,
    r.image_path,
    r.ingredients,
    r.steps,
    r.tips,
    r.servings,
    r.prep_time_minutes,
    r.total_time_minutes,
    r.created_at,
    r.updated_at,
    r.deleted_at,
    r.visibility,
    r.is_termorobot,
    r.diet_type,
    r.cuisine,
    r.difficulty,
    r.is_grill,
    r.normalized_ingredients_status,
    r.normalized_ingredients_updated_at,
    r.search_vector,
    r.category_id,
    c.name as category_name,
    coalesce(
        (
            select jsonb_agg(
                jsonb_build_object('id', t.id, 'name', t.name)
                order by t.name
            )
            from public.tags t
            inner join public.recipe_tags rt on rt.tag_id = t.id
            where rt.recipe_id = r.id
        ),
        '[]'::jsonb
    ) as tags,
    coalesce(
        (
            select jsonb_agg(
                jsonb_build_object('id', col.id, 'name', col.name)
                order by col.name
            )
            from public.collections col
            inner join public.recipe_collections rc on rc.collection_id = col.id
            where rc.recipe_id = r.id
        ),
        '[]'::jsonb
    ) as collections,
    coalesce(
        (
            select array_agg(t.id order by t.name)
            from public.tags t
            inner join public.recipe_tags rt on rt.tag_id = t.id
            where rt.recipe_id = r.id
        ),
        array[]::bigint[]
    ) as tag_ids,
    coalesce(
        (
            select array_agg(col.id order by col.name)
            from public.collections col
            inner join public.recipe_collections rc on rc.collection_id = col.id
            where rc.recipe_id = r.id
        ),
        array[]::bigint[]
    ) as collection_ids,
    (
        select count(*)::integer
        from public.recipe_ratings rr
        where rr.recipe_id = r.id
    ) as ratings_count,
    (
        select round(avg(rr.rating)::numeric, 1)
        from public.recipe_ratings rr
        where rr.recipe_id = r.id
    ) as average_rating
from public.recipes r
left join public.categories c on c.id = r.category_id
where r.deleted_at is null;

grant select on public.recipe_details to authenticated;

comment on view public.recipe_details is
    'Comprehensive recipe view with aggregated tags, collections, normalized ingredients, and public rating aggregates.';

create or replace function public.set_recipe_rating(
    p_recipe_id bigint,
    p_rating smallint default null
)
returns table (
    out_recipe_id bigint,
    out_my_rating smallint,
    out_average_rating numeric,
    out_ratings_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_author_id uuid;
    v_visibility text;
begin
    if v_user_id is null then
        raise exception 'Authentication required' using errcode = '42501';
    end if;

    if p_rating is not null and (p_rating < 1 or p_rating > 5) then
        raise exception 'Rating must be between 1 and 5 or null' using errcode = '22023';
    end if;

    select r.user_id, r.visibility::text
    into v_author_id, v_visibility
    from public.recipes r
    where r.id = p_recipe_id
      and r.deleted_at is null;

    if not found then
        raise exception 'Recipe not found' using errcode = 'P0002';
    end if;

    if v_author_id = v_user_id then
        raise exception 'Authors cannot rate their own recipes' using errcode = 'P0403';
    end if;

    if v_visibility <> 'PUBLIC' then
        raise exception 'Recipe not found' using errcode = 'P0002';
    end if;

    if p_rating is null then
        delete from public.recipe_ratings rr
        where rr.user_id = v_user_id
          and rr.recipe_id = p_recipe_id;
    else
        insert into public.recipe_ratings as rr (user_id, recipe_id, rating)
        values (v_user_id, p_recipe_id, p_rating)
        on conflict (user_id, recipe_id) do update
            set rating = excluded.rating
            where rr.rating is distinct from excluded.rating;
    end if;

    return query
    select
        p_recipe_id,
        p_rating,
        round(avg(rr.rating)::numeric, 1),
        count(*)::integer
    from public.recipe_ratings rr
    where rr.recipe_id = p_recipe_id;
end;
$$;

revoke all on function public.set_recipe_rating(bigint, smallint) from public;
revoke all on function public.set_recipe_rating(bigint, smallint) from anon;
grant execute on function public.set_recipe_rating(bigint, smallint) to authenticated;

comment on function public.set_recipe_rating(bigint, smallint) is
    'Idempotently sets (1-5) or removes (null) the caller''s rating of a PUBLIC recipe by another author.';
