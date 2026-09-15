-- Migration: Create atomic AI credit reservation RPCs
-- Description: Reserves credits before an AI call and refunds failed calls
-- Dependencies: public.user_ai_credits, public.ai_credit_limit_type

create or replace function public.reserve_ai_credit(
    p_user_id uuid,
    p_credit_type text,
    p_free_draft_credits integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_credits public.user_ai_credits%rowtype;
    v_credits_total integer;
    v_credits_used integer;
    v_next_reset_at timestamptz;
begin
    if p_user_id is null then
        raise exception 'VALIDATION_ERROR: p_user_id is required';
    end if;

    if p_credit_type not in ('draft', 'image') then
        raise exception 'VALIDATION_ERROR: unsupported credit type';
    end if;

    if p_free_draft_credits < 0 or p_free_draft_credits > 32767 then
        raise exception 'VALIDATION_ERROR: invalid free draft credit limit';
    end if;

    insert into public.user_ai_credits (
        user_id,
        draft_credits_total,
        image_credits_total,
        limit_type
    )
    values (
        p_user_id,
        p_free_draft_credits,
        0,
        'lifetime'
    )
    on conflict (user_id) do nothing;

    select *
    into v_credits
    from public.user_ai_credits
    where user_id = p_user_id
    for update;

    if v_credits.limit_type = 'monthly'
        and v_credits.next_reset_at <= now()
    then
        v_next_reset_at := v_credits.next_reset_at;

        while v_next_reset_at <= now() loop
            v_next_reset_at := v_next_reset_at + interval '1 month';
        end loop;

        update public.user_ai_credits
        set draft_credits_used = 0,
            image_credits_used = 0,
            next_reset_at = v_next_reset_at
        where user_id = p_user_id
        returning * into v_credits;
    end if;

    if p_credit_type = 'draft' then
        v_credits_total := v_credits.draft_credits_total;
        v_credits_used := v_credits.draft_credits_used;
    else
        v_credits_total := v_credits.image_credits_total;
        v_credits_used := v_credits.image_credits_used;
    end if;

    if v_credits_used >= v_credits_total then
        return jsonb_build_object(
            'allowed', false,
            'credits_used', v_credits_used,
            'credits_total', v_credits_total,
            'limit_type', v_credits.limit_type,
            'next_reset_at', v_credits.next_reset_at
        );
    end if;

    if p_credit_type = 'draft' then
        update public.user_ai_credits
        set draft_credits_used = draft_credits_used + 1
        where user_id = p_user_id
        returning draft_credits_used into v_credits_used;
    else
        update public.user_ai_credits
        set image_credits_used = image_credits_used + 1
        where user_id = p_user_id
        returning image_credits_used into v_credits_used;
    end if;

    return jsonb_build_object(
        'allowed', true,
        'credits_used', v_credits_used,
        'credits_total', v_credits_total,
        'limit_type', v_credits.limit_type,
        'next_reset_at', v_credits.next_reset_at
    );
end;
$$;

create or replace function public.refund_ai_credit(
    p_user_id uuid,
    p_credit_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_refunded_count integer;
begin
    if p_user_id is null then
        raise exception 'VALIDATION_ERROR: p_user_id is required';
    end if;

    if p_credit_type not in ('draft', 'image') then
        raise exception 'VALIDATION_ERROR: unsupported credit type';
    end if;

    if p_credit_type = 'draft' then
        update public.user_ai_credits
        set draft_credits_used = draft_credits_used - 1
        where user_id = p_user_id
            and draft_credits_used > 0;
    else
        update public.user_ai_credits
        set image_credits_used = image_credits_used - 1
        where user_id = p_user_id
            and image_credits_used > 0;
    end if;

    get diagnostics v_refunded_count = row_count;
    return v_refunded_count > 0;
end;
$$;

revoke all on function public.reserve_ai_credit(uuid, text, integer) from public;
revoke all on function public.refund_ai_credit(uuid, text) from public;
grant execute on function public.reserve_ai_credit(uuid, text, integer) to service_role;
grant execute on function public.refund_ai_credit(uuid, text) to service_role;

comment on function public.reserve_ai_credit(uuid, text, integer) is
    'Atomically initializes, resets, validates, and reserves one AI credit.';
comment on function public.refund_ai_credit(uuid, text) is
    'Returns one previously reserved AI credit after a failed AI operation.';
