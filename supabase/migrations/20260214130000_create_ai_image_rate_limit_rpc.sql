-- Migration: create DB-backed rate limit for AI image generation
-- Description:
-- 1) creates table public.ai_rate_limits for per-user, per-window counters
-- 2) exposes RPC public.ai_rate_limit_hit(...) used by Edge Functions

create table if not exists public.ai_rate_limits (
    user_id uuid not null references auth.users(id) on delete cascade,
    key text not null,
    window_start timestamptz not null,
    count integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ai_rate_limits_pkey primary key (user_id, key, window_start),
    constraint ai_rate_limits_count_check check (count >= 0)
);

create index if not exists ai_rate_limits_user_key_window_idx
    on public.ai_rate_limits(user_id, key, window_start desc);

alter table public.ai_rate_limits enable row level security;

drop policy if exists ai_rate_limits_owner_select on public.ai_rate_limits;
create policy ai_rate_limits_owner_select
    on public.ai_rate_limits
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists ai_rate_limits_owner_insert on public.ai_rate_limits;
create policy ai_rate_limits_owner_insert
    on public.ai_rate_limits
    for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists ai_rate_limits_owner_update on public.ai_rate_limits;
create policy ai_rate_limits_owner_update
    on public.ai_rate_limits
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create or replace function public.ai_rate_limit_hit(
    p_key text,
    p_window_seconds integer,
    p_limit integer,
    p_now timestamptz default now()
)
returns table (
    allowed boolean,
    retry_after_seconds integer,
    current_count integer,
    window_start timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_window_start timestamptz;
    v_next_window_start timestamptz;
    v_current_count integer;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'UNAUTHORIZED: Authentication required';
    end if;

    if p_key is null or btrim(p_key) = '' then
        raise exception 'VALIDATION_ERROR: p_key is required';
    end if;

    if p_window_seconds is null or p_window_seconds <= 0 then
        raise exception 'VALIDATION_ERROR: p_window_seconds must be positive';
    end if;

    if p_limit is null or p_limit <= 0 then
        raise exception 'VALIDATION_ERROR: p_limit must be positive';
    end if;

    v_window_start := to_timestamp(
        floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
    );
    v_next_window_start := v_window_start + make_interval(secs => p_window_seconds);

    insert into public.ai_rate_limits(user_id, key, window_start, count, updated_at)
    values (v_user_id, p_key, v_window_start, 1, now())
    on conflict (user_id, key, window_start)
    do update
       set count = public.ai_rate_limits.count + 1,
           updated_at = now()
    returning public.ai_rate_limits.count into v_current_count;

    if v_current_count > p_limit then
        return query
        select
            false as allowed,
            greatest(1, ceil(extract(epoch from (v_next_window_start - p_now)))::integer) as retry_after_seconds,
            v_current_count as current_count,
            v_window_start as window_start;
        return;
    end if;

    return query
    select
        true as allowed,
        0 as retry_after_seconds,
        v_current_count as current_count,
        v_window_start as window_start;
end;
$$;

grant execute on function public.ai_rate_limit_hit(text, integer, integer, timestamptz) to authenticated;

comment on table public.ai_rate_limits is
    'Per-user counters for fixed-window AI endpoint rate limiting.';

comment on function public.ai_rate_limit_hit(text, integer, integer, timestamptz) is
    'Increments user rate-limit counter and returns allowed + retry metadata for a fixed window.';
