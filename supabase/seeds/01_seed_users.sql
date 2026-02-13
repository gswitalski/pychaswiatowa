
INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', 'c553b8d1-3dbb-488f-b610-97eb6f95d357', 'authenticated', 'authenticated', 'test@pychaswiatowa.pl', '$2a$10$F88Uc2wys8L9IaJ1Vy.cMeXPSF99QyjMMpBc1q3jEEzfSAF.uXbF.', '2025-12-07 13:18:26.791282+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-12-16 19:06:41.520529+00', '{"provider": "email", "providers": ["email"], "app_role": "admin"}', '{"username": "Grzegorz", "email_verified": true}', NULL, '2025-12-07 13:18:26.767435+00', '2025-12-16 19:06:41.52536+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '6e2596af-e62a-4be6-93fc-680f8b83dc06', 'authenticated', 'authenticated', 'test2@pychaswiatowa.pl', '$2a$10$hRHWYrP350VFHHMvB0xni.5b4yZc99xnvhUMwQr/Qaa42feFidTwi', '2025-12-16 19:20:57.373887+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-12-16 19:20:57.390239+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "6e2596af-e62a-4be6-93fc-680f8b83dc06", "email": "test2@pychaswiatowa.pl", "username": "Test2", "email_verified": true, "phone_verified": false}', NULL, '2025-12-16 19:20:57.338951+00', '2025-12-16 19:20:57.398849+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);
INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('c553b8d1-3dbb-488f-b610-97eb6f95d357', 'c553b8d1-3dbb-488f-b610-97eb6f95d357', '{"sub": "c553b8d1-3dbb-488f-b610-97eb6f95d357", "email": "test@pychaswiatowa.pl", "email_verified": false, "phone_verified": false}', 'email', '2025-12-07 13:18:26.783557+00', '2025-12-07 13:18:26.783704+00', '2025-12-07 13:18:26.783704+00', '1075e1d9-6ad1-45ea-a446-c0d93ec99c04'),
	('6e2596af-e62a-4be6-93fc-680f8b83dc06', '6e2596af-e62a-4be6-93fc-680f8b83dc06', '{"sub": "6e2596af-e62a-4be6-93fc-680f8b83dc06", "email": "test2@pychaswiatowa.pl", "username": "Test2", "email_verified": false, "phone_verified": false}', 'email', '2025-12-16 19:20:57.36733+00', '2025-12-16 19:20:57.367367+00', '2025-12-16 19:20:57.367367+00', 'fbfe74e7-2beb-4ca7-a7dc-ede263489b15');

-- Repair app_role after inserts to avoid accidental default-role override.
update auth.users
set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb),
    '{app_role}',
    '"admin"'::jsonb,
    true
)
where id = 'c553b8d1-3dbb-488f-b610-97eb6f95d357';
