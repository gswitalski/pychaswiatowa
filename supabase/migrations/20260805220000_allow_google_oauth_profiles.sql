-- Allow Google OAuth accounts to complete their profile after authentication.
-- Email/password registration still requires a username and marketing consent metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_is_google_oauth boolean := new.raw_app_meta_data->>'provider' = 'google';
    v_username text := nullif(trim(new.raw_user_meta_data->>'username'), '');
    v_marketing_consent boolean := false;
    v_marketing_consent_updated_at timestamptz := null;
    v_marketing_consent_text_version text := null;
begin
    if not v_is_google_oauth then
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
    end if;

    insert into public.profiles (
        id,
        username,
        marketing_consent,
        marketing_consent_updated_at,
        marketing_consent_text_version
    )
    values (
        new.id,
        case when v_is_google_oauth then null else v_username end,
        v_marketing_consent,
        v_marketing_consent_updated_at,
        v_marketing_consent_text_version
    );

    return new;
end;
$$;

comment on function public.handle_new_user() is
    'Creates profiles for signup and Google OAuth users, deferring OAuth username completion.';
