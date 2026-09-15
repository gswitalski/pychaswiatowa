-- Migration: Create AI credits model
-- Description: Adds lifetime and monthly AI credit balances per user
-- Dependencies: auth.users, public.handle_updated_at()

create type public.ai_credit_limit_type as enum ('lifetime', 'monthly');

create table public.user_ai_credits (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users(id) on delete cascade,
    draft_credits_total smallint not null default 3,
    draft_credits_used smallint not null default 0,
    image_credits_total smallint not null default 0,
    image_credits_used smallint not null default 0,
    limit_type public.ai_credit_limit_type not null default 'lifetime',
    next_reset_at timestamptz,
    credits_activated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint user_ai_credits_draft_total_nonnegative
        check (draft_credits_total >= 0),
    constraint user_ai_credits_draft_used_in_range
        check (
            draft_credits_used >= 0
            and draft_credits_used <= draft_credits_total
        ),
    constraint user_ai_credits_image_total_nonnegative
        check (image_credits_total >= 0),
    constraint user_ai_credits_image_used_in_range
        check (
            image_credits_used >= 0
            and image_credits_used <= image_credits_total
        ),
    constraint user_ai_credits_monthly_reset_required
        check (limit_type <> 'monthly' or next_reset_at is not null)
);

alter table public.user_ai_credits enable row level security;

create policy "Users can view their own AI credits"
    on public.user_ai_credits
    for select
    to authenticated
    using (auth.uid() = user_id);

-- No client write policies are defined. Mutations are restricted to the
-- service role, which bypasses RLS and is used only by Edge Functions.

create index idx_user_ai_credits_monthly_reset
    on public.user_ai_credits (next_reset_at)
    where limit_type = 'monthly' and next_reset_at is not null;

create trigger set_user_ai_credits_updated_at
    before update on public.user_ai_credits
    for each row
    execute function public.handle_updated_at();

comment on table public.user_ai_credits is
    'Stores lifetime or monthly AI credit balances for application users';
comment on column public.user_ai_credits.user_id is
    'Owner of the AI credit balance';
comment on column public.user_ai_credits.next_reset_at is
    'Next monthly reset timestamp; null for lifetime limits';
