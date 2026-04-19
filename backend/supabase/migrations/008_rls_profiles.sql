-- Migration: 008_rls_profiles
-- Description: Row Level Security policies for profiles table
-- Date: 2026-04-13

BEGIN;

ALTER TABLE app_33d3cacbc5_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON app_33d3cacbc5_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admins can read user profiles, super admins can read everything
CREATE POLICY "profiles_select_admin_users" ON app_33d3cacbc5_profiles
  FOR SELECT TO authenticated
  USING (
    has_admin_access_33d3cacbc5(auth.uid())
    AND role = 'user'
  );

CREATE POLICY "profiles_select_super_admin" ON app_33d3cacbc5_profiles
  FOR SELECT TO authenticated
  USING (is_super_admin_33d3cacbc5(auth.uid()));

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON app_33d3cacbc5_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can update user profiles only
CREATE POLICY "profiles_update_admin_users" ON app_33d3cacbc5_profiles
  FOR UPDATE TO authenticated
  USING (
    has_admin_access_33d3cacbc5(auth.uid())
    AND role = 'user'
  )
  WITH CHECK (
    has_admin_access_33d3cacbc5(auth.uid())
    AND role = 'user'
  );

-- Super admins can update any profile
CREATE POLICY "profiles_update_admin" ON app_33d3cacbc5_profiles
  FOR UPDATE TO authenticated
  USING (is_super_admin_33d3cacbc5(auth.uid()))
  WITH CHECK (is_super_admin_33d3cacbc5(auth.uid()));

COMMIT;