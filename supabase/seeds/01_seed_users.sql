-- Seed: local users for role and AI-credit testing.
-- Password for every account: 12345678

insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
) values
    (
        '00000000-0000-0000-0000-000000000000',
        'c553b8d1-3dbb-488f-b610-97eb6f95d357',
        'authenticated',
        'authenticated',
        'simple@pychaswiatowa.pl',
        extensions.crypt('12345678', extensions.gen_salt('bf')),
        now(),
        '',
        '',
        '',
        '',
        '{"provider": "email", "providers": ["email"], "app_role": "user"}',
        '{"username": "Simple User", "email_verified": true, "marketing_consent_accepted": false}',
        now(),
        now(),
        false,
        false
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        '6e2596af-e62a-4be6-93fc-680f8b83dc06',
        'authenticated',
        'authenticated',
        'premium@pychaswiatowa.pl',
        extensions.crypt('12345678', extensions.gen_salt('bf')),
        now(),
        '',
        '',
        '',
        '',
        '{"provider": "email", "providers": ["email"], "app_role": "premium"}',
        '{"username": "Premium User", "email_verified": true, "marketing_consent_accepted": false}',
        now(),
        now(),
        false,
        false
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        'bda00f70-6f98-4a57-9da5-2f824ab9d302',
        'authenticated',
        'authenticated',
        'admin@pychaswiatowa.pl',
        extensions.crypt('12345678', extensions.gen_salt('bf')),
        now(),
        '',
        '',
        '',
        '',
        '{"provider": "email", "providers": ["email"], "app_role": "admin"}',
        '{"username": "Admin", "email_verified": true, "marketing_consent_accepted": false}',
        now(),
        now(),
        false,
        false
    );

insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
) values
    (
        'c553b8d1-3dbb-488f-b610-97eb6f95d357',
        'c553b8d1-3dbb-488f-b610-97eb6f95d357',
        '{"sub": "c553b8d1-3dbb-488f-b610-97eb6f95d357", "email": "simple@pychaswiatowa.pl", "email_verified": true, "phone_verified": false}',
        'email',
        now(),
        now(),
        now(),
        '1075e1d9-6ad1-45ea-a446-c0d93ec99c04'
    ),
    (
        '6e2596af-e62a-4be6-93fc-680f8b83dc06',
        '6e2596af-e62a-4be6-93fc-680f8b83dc06',
        '{"sub": "6e2596af-e62a-4be6-93fc-680f8b83dc06", "email": "premium@pychaswiatowa.pl", "email_verified": true, "phone_verified": false}',
        'email',
        now(),
        now(),
        now(),
        'fbfe74e7-2beb-4ca7-a7dc-ede263489b15'
    ),
    (
        'bda00f70-6f98-4a57-9da5-2f824ab9d302',
        'bda00f70-6f98-4a57-9da5-2f824ab9d302',
        '{"sub": "bda00f70-6f98-4a57-9da5-2f824ab9d302", "email": "admin@pychaswiatowa.pl", "email_verified": true, "phone_verified": false}',
        'email',
        now(),
        now(),
        now(),
        'd3a15371-9ac7-4f67-a26a-d967c99ad129'
    );

insert into public.user_ai_credits (
    user_id,
    draft_credits_total,
    draft_credits_used,
    image_credits_total,
    image_credits_used,
    limit_type,
    next_reset_at
) values
    (
        'c553b8d1-3dbb-488f-b610-97eb6f95d357',
        3,
        0,
        0,
        0,
        'lifetime',
        null
    ),
    (
        '6e2596af-e62a-4be6-93fc-680f8b83dc06',
        20,
        0,
        5,
        0,
        'monthly',
        now() + interval '1 month'
    );
