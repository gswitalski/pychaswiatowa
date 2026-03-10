-- migration: add marketing consent support to signup/profile creation
-- description:
-- 1) extends public.profiles with marketing consent fields
-- 2) adds helper function for backend validation/normalization
-- 3) refactors handle_new_user() to enforce transactional consistency

alter table public.profiles
    add column if not exists marketing_consent boolean not null default false,
    add column if not exists marketing_consent_updated_at timestamptz null,
    add column if not exists marketing_consent_text_version text null;

comment on column public.profiles.marketing_consent is
    'Current marketing consent state captured at signup.';
comment on column public.profiles.marketing_consent_updated_at is
    'Timestamp set by backend when marketing consent is accepted.';
comment on column public.profiles.marketing_consent_text_version is
    'Version identifier of the accepted marketing consent text.';

create or replace function public.supported_marketing_consent_text_versions()
returns text[]
language sql
immutable
as $$
    select array[
        'marketing-consent-pl-v1'::text
    ];
$$;

comment on function public.supported_marketing_consent_text_versions() is
    'Returns backend allowlist of accepted marketing consent text versions.';

create or replace function public.resolve_signup_marketing_consent(
    p_raw_user_meta_data jsonb
)
returns table (
    marketing_consent boolean,
    marketing_consent_updated_at timestamptz,
    marketing_consent_text_version text
)
language plpgsql
stable
set search_path = public
as $$
declare
    v_meta jsonb := coalesce(p_raw_user_meta_data, '{}'::jsonb);
    v_accepted_json jsonb := v_meta->'marketing_consent_accepted';
    v_accepted boolean;
    v_text_version text := nullif(trim(v_meta->>'marketing_consent_text_version'), '');
    v_supported_versions text[] := public.supported_marketing_consent_text_versions();
begin
    if v_accepted_json is null or jsonb_typeof(v_accepted_json) <> 'boolean' then
        raise exception 'INVALID_MARKETING_CONSENT: field marketing_consent_accepted must be a boolean'
            using errcode = '22023';
    end if;

    v_accepted := (v_meta->>'marketing_consent_accepted')::boolean;

    if v_accepted and v_text_version is null then
        raise exception 'INVALID_MARKETING_CONSENT: marketing_consent_text_version is required when accepted=true'
            using errcode = '22023';
    end if;

    if not v_accepted and v_text_version is not null then
        raise exception 'INVALID_MARKETING_CONSENT: marketing_consent_text_version must be null when accepted=false'
            using errcode = '22023';
    end if;

    if v_accepted and not (v_text_version = any(v_supported_versions)) then
        raise exception 'UNSUPPORTED_MARKETING_CONSENT_VERSION: unsupported marketing_consent_text_version'
            using errcode = '22023';
    end if;

    return query
    select
        v_accepted as marketing_consent,
        case
            when v_accepted then now()
            else null
        end as marketing_consent_updated_at,
        case
            when v_accepted then v_text_version
            else null
        end as marketing_consent_text_version;
end;
$$;

comment on function public.resolve_signup_marketing_consent(jsonb) is
    'Validates signup marketing consent metadata and returns normalized profile fields.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_username text := nullif(trim(new.raw_user_meta_data->>'username'), '');
    v_marketing_consent boolean;
    v_marketing_consent_updated_at timestamptz;
    v_marketing_consent_text_version text;
begin
    if v_username is null or char_length(v_username) < 3 or char_length(v_username) > 50 then
        raise exception 'INVALID_SIGNUP_USERNAME: username must contain between 3 and 50 characters'
            using errcode = '22023';
    end if;

    select
        r.marketing_consent,
        r.marketing_consent_updated_at,
        r.marketing_consent_text_version
    into
        v_marketing_consent,
        v_marketing_consent_updated_at,
        v_marketing_consent_text_version
    from public.resolve_signup_marketing_consent(new.raw_user_meta_data) as r;

    insert into public.profiles (
        id,
        username,
        marketing_consent,
        marketing_consent_updated_at,
        marketing_consent_text_version
    )
    values (
        new.id,
        v_username,
        v_marketing_consent,
        v_marketing_consent_updated_at,
        v_marketing_consent_text_version
    );

    return new;
end;
$$;

comment on function public.handle_new_user() is
    'Creates profile for new auth user and enforces signup metadata validation.';
