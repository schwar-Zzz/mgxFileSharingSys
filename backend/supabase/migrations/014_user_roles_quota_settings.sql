-- Migration: 014_user_roles_quota_settings
-- Description: Promote profile roles to enum and add storage quota/system settings
-- Date: 2026-04-13

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role_33d3cacbc5'
  ) THEN
    CREATE TYPE user_role_33d3cacbc5 AS ENUM ('user', 'admin', 'super_admin');
  END IF;
END
$$;

ALTER TABLE app_33d3cacbc5_profiles
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE app_33d3cacbc5_profiles
  DROP CONSTRAINT IF EXISTS app_33d3cacbc5_profiles_role_check;

DROP POLICY IF EXISTS profiles_select_own ON app_33d3cacbc5_profiles;
DROP POLICY IF EXISTS profiles_select_admin_users ON app_33d3cacbc5_profiles;
DROP POLICY IF EXISTS profiles_select_super_admin ON app_33d3cacbc5_profiles;
DROP POLICY IF EXISTS profiles_update_own ON app_33d3cacbc5_profiles;
DROP POLICY IF EXISTS profiles_update_admin_users ON app_33d3cacbc5_profiles;
DROP POLICY IF EXISTS profiles_update_admin ON app_33d3cacbc5_profiles;

DROP POLICY IF EXISTS audit_select_own_user ON app_33d3cacbc5_audit_logs;
DROP POLICY IF EXISTS audit_select_admin_users ON app_33d3cacbc5_audit_logs;
DROP POLICY IF EXISTS audit_select_super_admin ON app_33d3cacbc5_audit_logs;
DROP POLICY IF EXISTS audit_insert ON app_33d3cacbc5_audit_logs;

ALTER TABLE app_33d3cacbc5_profiles
  ALTER COLUMN role TYPE user_role_33d3cacbc5
  USING role::user_role_33d3cacbc5;

ALTER TABLE app_33d3cacbc5_profiles
  ALTER COLUMN role SET DEFAULT 'user';

ALTER TABLE app_33d3cacbc5_profiles
  ADD COLUMN IF NOT EXISTS storage_quota_gb NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE app_33d3cacbc5_profiles
  ADD COLUMN IF NOT EXISTS storage_used_gb NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE app_33d3cacbc5_profiles
  DROP CONSTRAINT IF EXISTS profiles_storage_quota_nonnegative;

ALTER TABLE app_33d3cacbc5_profiles
  ADD CONSTRAINT profiles_storage_quota_nonnegative
  CHECK (
    storage_quota_gb >= 0
    AND storage_used_gb >= 0
    AND storage_used_gb <= storage_quota_gb
  );

CREATE INDEX IF NOT EXISTS idx_profiles_storage_quota ON app_33d3cacbc5_profiles(storage_quota_gb);

ALTER TABLE app_33d3cacbc5_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON app_33d3cacbc5_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_select_admin_users ON app_33d3cacbc5_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM app_33d3cacbc5_profiles viewer
      WHERE viewer.id = auth.uid()
        AND viewer.role IN ('admin', 'super_admin')
    )
    AND role = 'user'
  );

CREATE POLICY profiles_select_super_admin ON app_33d3cacbc5_profiles
  FOR SELECT TO authenticated
  USING (is_super_admin_33d3cacbc5(auth.uid()));

CREATE POLICY profiles_update_own ON app_33d3cacbc5_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_admin_users ON app_33d3cacbc5_profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM app_33d3cacbc5_profiles viewer
      WHERE viewer.id = auth.uid()
        AND viewer.role IN ('admin', 'super_admin')
    )
    AND role = 'user'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app_33d3cacbc5_profiles viewer
      WHERE viewer.id = auth.uid()
        AND viewer.role IN ('admin', 'super_admin')
    )
    AND role = 'user'
  );

CREATE POLICY profiles_update_admin ON app_33d3cacbc5_profiles
  FOR UPDATE TO authenticated
  USING (is_super_admin_33d3cacbc5(auth.uid()))
  WITH CHECK (is_super_admin_33d3cacbc5(auth.uid()));

CREATE TABLE IF NOT EXISTS app_33d3cacbc5_storage_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  total_storage_gb NUMERIC(10, 2) NOT NULL DEFAULT 1000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

INSERT INTO app_33d3cacbc5_storage_settings (id, total_storage_gb)
VALUES (1, 1000)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_33d3cacbc5_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_select_own_user ON app_33d3cacbc5_audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY audit_select_admin_users ON app_33d3cacbc5_audit_logs
  FOR SELECT TO authenticated
  USING (
    has_admin_access_33d3cacbc5(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM app_33d3cacbc5_profiles subject
      WHERE subject.id = user_id
        AND subject.role = 'user'
    )
  );

CREATE POLICY audit_select_super_admin ON app_33d3cacbc5_audit_logs
  FOR SELECT TO authenticated
  USING (is_super_admin_33d3cacbc5(auth.uid()));

CREATE POLICY audit_insert ON app_33d3cacbc5_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMIT;