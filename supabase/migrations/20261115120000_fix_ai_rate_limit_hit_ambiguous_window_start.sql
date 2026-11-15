-- Fix: RETURNS TABLE output column window_start shadows ai_rate_limits.window_start (42702 ambiguous)

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
#variable_conflict use_column
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
    on conflict on constraint ai_rate_limits_pkey
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

comment on function public.ai_rate_limit_hit(text, integer, integer, timestamptz) is
    'Increments user rate-limit counter and returns allowed + retry metadata for a fixed window.';