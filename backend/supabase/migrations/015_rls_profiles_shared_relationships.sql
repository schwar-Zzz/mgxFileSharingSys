-- Migration: 015_rls_profiles_shared_relationships
-- Description: Allow users to read profile names involved in sharing relationships
-- Date: 2026-04-16

BEGIN;

CREATE POLICY "profiles_select_shared_relationships" ON app_33d3cacbc5_profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.app_33d3cacbc5_sharing s
      WHERE (
        s.shared_with = auth.uid()
        AND s.shared_by = app_33d3cacbc5_profiles.id
      )
      OR (
        s.shared_by = auth.uid()
        AND s.shared_with = app_33d3cacbc5_profiles.id
      )
    )
  );

COMMIT;