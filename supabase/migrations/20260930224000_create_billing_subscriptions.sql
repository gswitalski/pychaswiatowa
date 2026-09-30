-- Migration: Create billing subscriptions model
-- Description: Adds Stripe billing storage and transactional billing RPCs.
-- Dependencies: auth.users, public.handle_updated_at()

create table public.billing_customers (
    user_id uuid primary key references auth.users(id) on delete cascade,
    provider text not null default 'stripe',
    provider_customer_id text not null unique,
    created_at timestamptz not null default now(),

    constraint billing_customers_provider_check
        check (provider = 'stripe')
);

create table public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users(id) on delete cascade,
    plan_id text not null,
    status text not null,
    payment_method_type text not null,
    auto_renew boolean not null,
    provider_subscription_id text,
    started_at timestamptz not null,
    current_period_start timestamptz not null,
    current_period_end timestamptz not null,
    trial_ends_at timestamptz,
    canceled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint subscriptions_plan_id_check
        check (plan_id in ('premium_monthly', 'premium_yearly')),
    constraint subscriptions_status_check
        check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
    constraint subscriptions_payment_method_type_check
        check (payment_method_type in ('card', 'blik')),
    constraint subscriptions_period_check
        check (current_period_end > current_period_start),
    constraint subscriptions_provider_id_check
        check (
            (payment_method_type = 'card' and provider_subscription_id is not null)
            or payment_method_type = 'blik'
        )
);

create table public.subscription_payments (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    subscription_id uuid references public.subscriptions(id) on delete set null,
    plan_id text not null,
    payment_method_type text not null,
    amount_gross integer not null,
    currency text not null default 'PLN',
    status text not null,
    provider_session_id text not null,
    provider_payment_intent_id text,
    provider_invoice_id text,
    document_number text,
    document_url text,
    document_pdf_url text,
    terms_version text,
    terms_accepted_at timestamptz,
    confirmation_email_sent_at timestamptz,
    paid_at timestamptz,
    created_at timestamptz not null default now(),

    constraint subscription_payments_plan_id_check
        check (plan_id in ('premium_monthly', 'premium_yearly')),
    constraint subscription_payments_method_check
        check (payment_method_type in ('card', 'blik')),
    constraint subscription_payments_amount_check
        check (amount_gross >= 0),
    constraint subscription_payments_currency_check
        check (currency = 'PLN'),
    constraint subscription_payments_status_check
        check (status in ('paid', 'failed')),
    constraint subscription_payments_paid_at_check
        check (status <> 'paid' or paid_at is not null)
);

create table public.payment_webhook_events (
    event_id text primary key,
    type text not null,
    status text not null default 'received',
    error_message text,
    attempts integer not null default 1,
    livemode boolean not null,
    received_at timestamptz not null default now(),
    processed_at timestamptz,

    constraint payment_webhook_events_status_check
        check (status in ('received', 'processed', 'failed', 'ignored')),
    constraint payment_webhook_events_attempts_check
        check (attempts >= 1),
    constraint payment_webhook_events_error_length_check
        check (error_message is null or char_length(error_message) <= 500)
);

create index idx_subscriptions_status_period_end
    on public.subscriptions (status, current_period_end);

create unique index idx_subscriptions_provider_subscription_id
    on public.subscriptions (provider_subscription_id)
    where provider_subscription_id is not null;

create index idx_subscription_payments_user_paid_at
    on public.subscription_payments (user_id, paid_at desc);

create unique index idx_subscription_payments_payment_intent_unique
    on public.subscription_payments (provider_payment_intent_id)
    where provider_payment_intent_id is not null;

create unique index idx_subscription_payments_invoice_unique
    on public.subscription_payments (provider_invoice_id)
    where provider_invoice_id is not null;

create unique index idx_subscription_payments_failed_session_unique
    on public.subscription_payments (provider_session_id)
    where status = 'failed';

create trigger set_subscriptions_updated_at
    before update on public.subscriptions
    for each row
    execute function public.handle_updated_at();

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.payment_webhook_events enable row level security;

create policy "Users can view their own subscription"
    on public.subscriptions
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Users can view their own subscription payments"
    on public.subscription_payments
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

create or replace function public.billing_claim_webhook_event(
    p_event_id text,
    p_type text,
    p_livemode boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_status text;
    v_received_at timestamptz;
begin
    insert into public.payment_webhook_events (
        event_id,
        type,
        status,
        livemode,
        attempts,
        received_at
    )
    values (p_event_id, p_type, 'received', p_livemode, 1, now())
    on conflict (event_id) do nothing;

    if found then
        return 'claimed';
    end if;

    select pwe.status, pwe.received_at
    into v_status, v_received_at
    from public.payment_webhook_events pwe
    where pwe.event_id = p_event_id
    for update;

    if v_status in ('processed', 'ignored') then
        return 'duplicate_processed';
    end if;

    if v_status = 'received' and v_received_at > now() - interval '2 minutes' then
        return 'in_progress';
    end if;

    update public.payment_webhook_events pwe
    set status = 'received',
        attempts = pwe.attempts + 1,
        received_at = now(),
        processed_at = null,
        error_message = null
    where pwe.event_id = p_event_id;

    return 'claimed';
end;
$$;

create or replace function public.billing_activate_premium(
    p_user_id uuid,
    p_plan_id text,
    p_payment_method text,
    p_auto_renew boolean,
    p_period_start timestamptz,
    p_period_end timestamptz,
    p_provider_subscription_id text,
    p_payment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_subscription public.subscriptions%rowtype;
    v_subscription_id uuid;
    v_previous_role text;
    v_payment_id bigint;
    v_role_changed boolean := false;
    v_was_trialing boolean := false;
    v_role_skipped_admin boolean := false;
    v_existing_payment_id bigint;
    v_payment_intent_id text := nullif(p_payment ->> 'provider_payment_intent_id', '');
    v_invoice_id text := nullif(p_payment ->> 'provider_invoice_id', '');
begin
    if p_plan_id not in ('premium_monthly', 'premium_yearly')
        or p_payment_method not in ('card', 'blik')
        or p_period_end <= p_period_start
        or p_payment is null
    then
        raise exception 'VALIDATION_ERROR: Invalid billing activation payload';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('billing:' || p_user_id::text, 0));

    select coalesce(au.raw_app_meta_data ->> 'app_role', 'user')
    into v_previous_role
    from auth.users au
    where au.id = p_user_id
      and au.deleted_at is null;

    if not found then
        raise exception 'NOT_FOUND: User not found';
    end if;

    select sp.id
    into v_existing_payment_id
    from public.subscription_payments sp
    where (v_payment_intent_id is not null and sp.provider_payment_intent_id = v_payment_intent_id)
       or (v_invoice_id is not null and sp.provider_invoice_id = v_invoice_id)
    order by sp.id
    limit 1;

    if found then
        select s.id
        into v_subscription_id
        from public.subscriptions s
        where s.user_id = p_user_id;

        return jsonb_build_object(
            'result', 'already_processed',
            'role_changed', false,
            'was_trialing', false,
            'role_skipped_admin', v_previous_role = 'admin',
            'payment_id', v_existing_payment_id,
            'subscription_id', v_subscription_id
        );
    end if;

    select s.*
    into v_subscription
    from public.subscriptions s
    where s.user_id = p_user_id
    for update;

    if found then
        v_was_trialing := v_subscription.status = 'trialing';

        if v_subscription.status in ('active', 'past_due', 'canceled')
            and v_subscription.current_period_end > now()
        then
            return jsonb_build_object(
                'result', 'duplicate_active_subscription',
                'role_changed', false,
                'was_trialing', false,
                'role_skipped_admin', v_previous_role = 'admin'
            );
        end if;
    end if;

    insert into public.subscriptions (
        user_id,
        plan_id,
        status,
        payment_method_type,
        auto_renew,
        provider_subscription_id,
        started_at,
        current_period_start,
        current_period_end,
        trial_ends_at,
        canceled_at
    )
    values (
        p_user_id,
        p_plan_id,
        'active',
        p_payment_method,
        p_auto_renew,
        p_provider_subscription_id,
        p_period_start,
        p_period_start,
        p_period_end,
        null,
        null
    )
    on conflict (user_id) do update
    set plan_id = excluded.plan_id,
        status = excluded.status,
        payment_method_type = excluded.payment_method_type,
        auto_renew = excluded.auto_renew,
        provider_subscription_id = excluded.provider_subscription_id,
        started_at = excluded.started_at,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        trial_ends_at = null,
        canceled_at = null
    returning id into v_subscription_id;

    insert into public.subscription_payments (
        user_id,
        subscription_id,
        plan_id,
        payment_method_type,
        amount_gross,
        currency,
        status,
        provider_session_id,
        provider_payment_intent_id,
        provider_invoice_id,
        document_number,
        document_url,
        document_pdf_url,
        terms_version,
        terms_accepted_at,
        paid_at
    )
    values (
        p_user_id,
        v_subscription_id,
        p_plan_id,
        p_payment_method,
        (p_payment ->> 'amount_gross')::integer,
        coalesce(p_payment ->> 'currency', 'PLN'),
        'paid',
        p_payment ->> 'provider_session_id',
        v_payment_intent_id,
        v_invoice_id,
        nullif(p_payment ->> 'document_number', ''),
        nullif(p_payment ->> 'document_url', ''),
        nullif(p_payment ->> 'document_pdf_url', ''),
        nullif(p_payment ->> 'terms_version', ''),
        nullif(p_payment ->> 'terms_accepted_at', '')::timestamptz,
        (p_payment ->> 'paid_at')::timestamptz
    )
    returning id into v_payment_id;

    if v_previous_role = 'admin' then
        v_role_skipped_admin := true;
    else
        update auth.users au
        set raw_app_meta_data = jsonb_set(
                coalesce(au.raw_app_meta_data, '{}'::jsonb),
                '{app_role}',
                '"premium"'::jsonb
            ),
            updated_at = now()
        where au.id = p_user_id;

        v_role_changed := v_previous_role <> 'premium';
    end if;

    return jsonb_build_object(
        'result', 'activated',
        'role_changed', v_role_changed,
        'was_trialing', v_was_trialing,
        'role_skipped_admin', v_role_skipped_admin,
        'payment_id', v_payment_id,
        'subscription_id', v_subscription_id
    );
end;
$$;

create or replace function public.billing_renew_subscription(
    p_provider_subscription_id text,
    p_period_start timestamptz,
    p_period_end timestamptz,
    p_payment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_subscription public.subscriptions%rowtype;
    v_user_id uuid;
    v_previous_role text;
    v_payment_id bigint;
    v_role_changed boolean := false;
    v_payment_intent_id text := nullif(p_payment ->> 'provider_payment_intent_id', '');
    v_invoice_id text := nullif(p_payment ->> 'provider_invoice_id', '');
begin
    if nullif(p_provider_subscription_id, '') is null
        or p_period_end <= p_period_start
        or p_payment is null
    then
        raise exception 'VALIDATION_ERROR: Invalid billing renewal payload';
    end if;

    select s.user_id
    into v_user_id
    from public.subscriptions s
    where s.provider_subscription_id = p_provider_subscription_id;

    if not found then
        raise exception 'NOT_FOUND: Subscription not found';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('billing:' || v_user_id::text, 0));

    select s.*
    into v_subscription
    from public.subscriptions s
    where s.provider_subscription_id = p_provider_subscription_id
    for update;

    if not found then
        raise exception 'NOT_FOUND: Subscription not found';
    end if;

    if exists (
        select 1
        from public.subscription_payments sp
        where (v_payment_intent_id is not null and sp.provider_payment_intent_id = v_payment_intent_id)
           or (v_invoice_id is not null and sp.provider_invoice_id = v_invoice_id)
    ) then
        return jsonb_build_object(
            'result', 'already_processed',
            'role_changed', false
        );
    end if;

    update public.subscriptions s
    set status = 'active',
        current_period_start = p_period_start,
        current_period_end = p_period_end,
        canceled_at = null
    where s.id = v_subscription.id;

    insert into public.subscription_payments (
        user_id,
        subscription_id,
        plan_id,
        payment_method_type,
        amount_gross,
        currency,
        status,
        provider_session_id,
        provider_payment_intent_id,
        provider_invoice_id,
        document_number,
        document_url,
        document_pdf_url,
        paid_at
    )
    values (
        v_subscription.user_id,
        v_subscription.id,
        v_subscription.plan_id,
        v_subscription.payment_method_type,
        (p_payment ->> 'amount_gross')::integer,
        coalesce(p_payment ->> 'currency', 'PLN'),
        'paid',
        p_payment ->> 'provider_session_id',
        v_payment_intent_id,
        v_invoice_id,
        nullif(p_payment ->> 'document_number', ''),
        nullif(p_payment ->> 'document_url', ''),
        nullif(p_payment ->> 'document_pdf_url', ''),
        (p_payment ->> 'paid_at')::timestamptz
    )
    returning id into v_payment_id;

    select coalesce(au.raw_app_meta_data ->> 'app_role', 'user')
    into v_previous_role
    from auth.users au
    where au.id = v_subscription.user_id
      and au.deleted_at is null;

    if not found then
        raise exception 'NOT_FOUND: User not found';
    end if;

    if v_previous_role <> 'admin' and v_previous_role <> 'premium' then
        update auth.users au
        set raw_app_meta_data = jsonb_set(
                coalesce(au.raw_app_meta_data, '{}'::jsonb),
                '{app_role}',
                '"premium"'::jsonb
            ),
            updated_at = now()
        where au.id = v_subscription.user_id;

        v_role_changed := true;
    end if;

    return jsonb_build_object(
        'result', 'renewed',
        'role_changed', v_role_changed,
        'payment_id', v_payment_id,
        'subscription_id', v_subscription.id,
        'user_id', v_subscription.user_id
    );
end;
$$;

create or replace function public.billing_record_failed_payment(
    p_user_id uuid,
    p_payment jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_payment is null or nullif(p_payment ->> 'provider_session_id', '') is null then
        raise exception 'VALIDATION_ERROR: Invalid failed payment payload';
    end if;

    insert into public.subscription_payments (
        user_id,
        subscription_id,
        plan_id,
        payment_method_type,
        amount_gross,
        currency,
        status,
        provider_session_id,
        provider_payment_intent_id,
        provider_invoice_id,
        terms_version,
        terms_accepted_at,
        paid_at
    )
    values (
        p_user_id,
        null,
        p_payment ->> 'plan_id',
        p_payment ->> 'payment_method_type',
        coalesce((p_payment ->> 'amount_gross')::integer, 0),
        coalesce(p_payment ->> 'currency', 'PLN'),
        'failed',
        p_payment ->> 'provider_session_id',
        nullif(p_payment ->> 'provider_payment_intent_id', ''),
        nullif(p_payment ->> 'provider_invoice_id', ''),
        nullif(p_payment ->> 'terms_version', ''),
        nullif(p_payment ->> 'terms_accepted_at', '')::timestamptz,
        null
    )
    on conflict (provider_session_id) where status = 'failed'
    do nothing;

    return found;
end;
$$;

create or replace function public.billing_attach_invoice_document(
    p_provider_invoice_id text,
    p_number text,
    p_url text,
    p_pdf_url text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_updated integer;
begin
    update public.subscription_payments sp
    set document_number = p_number,
        document_url = p_url,
        document_pdf_url = p_pdf_url
    where sp.provider_invoice_id = p_provider_invoice_id
      and sp.document_url is null;

    get diagnostics v_updated = row_count;
    return v_updated;
end;
$$;

create or replace function public.billing_expire_subscriptions(
    p_grace_days integer default 3
)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
begin
    if p_grace_days is null or p_grace_days < 0 then
        raise exception 'VALIDATION_ERROR: Grace period cannot be negative';
    end if;

    for v_user_id in
        select s.user_id
        from public.subscriptions s
        where s.status = 'active'
          and s.current_period_end + make_interval(days => p_grace_days) < now()
        order by s.user_id
    loop
        perform pg_advisory_xact_lock(hashtextextended('billing:' || v_user_id::text, 0));

        update public.subscriptions s
        set status = 'expired'
        where s.user_id = v_user_id
          and s.status = 'active'
          and s.current_period_end + make_interval(days => p_grace_days) < now();

        if not found then
            continue;
        end if;

        update auth.users au
        set raw_app_meta_data = jsonb_set(
                coalesce(au.raw_app_meta_data, '{}'::jsonb),
                '{app_role}',
                '"user"'::jsonb
            ),
            updated_at = now()
        where au.id = v_user_id
          and au.deleted_at is null
          and coalesce(au.raw_app_meta_data ->> 'app_role', 'user') = 'premium';

        if found then
            user_id := v_user_id;
            return next;
        end if;
    end loop;
end;
$$;

revoke all on function public.billing_claim_webhook_event(text, text, boolean)
    from public, anon, authenticated;
revoke all on function public.billing_activate_premium(
    uuid, text, text, boolean, timestamptz, timestamptz, text, jsonb
) from public, anon, authenticated;
revoke all on function public.billing_renew_subscription(
    text, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;
revoke all on function public.billing_record_failed_payment(uuid, jsonb)
    from public, anon, authenticated;
revoke all on function public.billing_attach_invoice_document(text, text, text, text)
    from public, anon, authenticated;
revoke all on function public.billing_expire_subscriptions(integer)
    from public, anon, authenticated;

grant execute on function public.billing_claim_webhook_event(text, text, boolean)
    to service_role;
grant execute on function public.billing_activate_premium(
    uuid, text, text, boolean, timestamptz, timestamptz, text, jsonb
) to service_role;
grant execute on function public.billing_renew_subscription(
    text, timestamptz, timestamptz, jsonb
) to service_role;
grant execute on function public.billing_record_failed_payment(uuid, jsonb)
    to service_role;
grant execute on function public.billing_attach_invoice_document(text, text, text, text)
    to service_role;
grant execute on function public.billing_expire_subscriptions(integer)
    to service_role;

comment on table public.billing_customers is
    'Maps application users to Stripe customer identifiers';
comment on table public.subscriptions is
    'Stores the current Premium subscription state for each user';
comment on table public.subscription_payments is
    'Stores immutable Premium payment history and sales document links';
comment on table public.payment_webhook_events is
    'Tracks Stripe webhook processing attempts for idempotency';
