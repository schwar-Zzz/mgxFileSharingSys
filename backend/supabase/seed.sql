-- Seed: SuperAdmin bootstrap

DO $$
DECLARE
  bootstrap_instance_id UUID := '00000000-0000-0000-0000-000000000000';
  bootstrap_user_id UUID;
  bootstrap_email TEXT := 'SyperAdmin@Root.dz';
  bootstrap_password TEXT := 'SuperAdmin123';
BEGIN
  DELETE FROM auth.identities
  WHERE email = bootstrap_email;

  DELETE FROM auth.users
  WHERE email = bootstrap_email;

  bootstrap_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    email_change_confirm_status,
    is_anonymous
  ) VALUES (
    bootstrap_instance_id,
    bootstrap_user_id,
    'authenticated',
    'authenticated',
    bootstrap_email,
    crypt(bootstrap_password, gen_salt('bf')),
    NOW(),
    NOW(),
    '',
    NOW(),
    '',
    NOW(),
    '',
    '',
    NOW(),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', 'SuperAdmin'),
    TRUE,
    NOW(),
    NOW(),
    0,
    FALSE
  );

  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
  )
  VALUES (
    bootstrap_email,
    bootstrap_user_id,
    jsonb_build_object(
      'sub', bootstrap_user_id::text,
      'email', bootstrap_email,
      'email_verified', TRUE,
      'full_name', 'SuperAdmin'
    ),
    'email',
    NOW(),
    NOW(),
    NOW(),
    bootstrap_user_id
  );

  INSERT INTO public.app_33d3cacbc5_profiles (
    id,
    full_name,
    role,
    status,
    avatar_url,
    storage_quota_gb,
    storage_used_gb
  )
  VALUES (
    bootstrap_user_id,
    'SuperAdmin',
    'super_admin',
    'active',
    NULL,
    0,
    0
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        avatar_url = EXCLUDED.avatar_url,
        storage_quota_gb = EXCLUDED.storage_quota_gb,
        storage_used_gb = EXCLUDED.storage_used_gb;
END
$$;