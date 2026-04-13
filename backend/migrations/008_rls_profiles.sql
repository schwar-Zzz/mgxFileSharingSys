-- Migration: 008_rls_profiles
-- Description: Row Level Security policies for profiles table
-- Date: 2026-04-13

BEGIN;

ALTER TABLE app_33d3cacbc5_profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all profiles (needed for sharing user lookup)
CREATE POLICY "profiles_select_for_sharing" ON app_33d3cacbc5_profiles
  FOR SELECT TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON app_33d3cacbc5_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Super admins can update any profile
CREATE POLICY "profiles_update_admin" ON app_33d3cacbc5_profiles
  FOR UPDATE TO authenticated
  USING (is_super_admin_33d3cacbc5(auth.uid()))
  WITH CHECK (is_super_admin_33d3cacbc5(auth.uid()));

COMMIT;