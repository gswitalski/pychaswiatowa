-- Migration: Create and schedule the monthly AI credits reset
-- Description: Adds an atomic reset RPC and runs it daily at 02:00 UTC

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.run_ai_credits_monthly_reset()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_reset_count integer;
begin
    update public.user_ai_credits
    set draft_credits_used = 0,
        image_credits_used = 0,
        next_reset_at = next_reset_at + interval '1 month'
    where limit_type = 'monthly'
        and next_reset_at <= now();

    get diagnostics v_reset_count = row_count;
    return v_reset_count;
end;
$$;

revoke all on function public.run_ai_credits_monthly_reset() from public;
grant execute on function public.run_ai_credits_monthly_reset() to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'ai-credits-monthly-reset';

select cron.schedule(
    'ai-credits-monthly-reset',
    '0 2 * * *',
    'select public.run_ai_credits_monthly_reset();'
);

comment on function public.run_ai_credits_monthly_reset() is
    'Resets due monthly AI credit balances and returns the affected row count.';
