-- Migration: 011_rls_sharing
-- Description: Row Level Security policies for sharing table
-- Date: 2026-04-13

BEGIN;

ALTER TABLE app_33d3cacbc5_sharing ENABLE ROW LEVEL SECURITY;

-- Users can see shares they created or received
CREATE POLICY "sharing_select" ON app_33d3cacbc5_sharing
  FOR SELECT TO authenticated
  USING (
    shared_by = auth.uid()
    OR shared_with = auth.uid()
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

-- Users can create shares
CREATE POLICY "sharing_insert" ON app_33d3cacbc5_sharing
  FOR INSERT TO authenticated
  WITH CHECK (shared_by = auth.uid());

-- Share creators and super_admins can update shares
CREATE POLICY "sharing_update" ON app_33d3cacbc5_sharing
  FOR UPDATE TO authenticated
  USING (
    shared_by = auth.uid()
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

-- Share creators and super_admins can delete shares
CREATE POLICY "sharing_delete" ON app_33d3cacbc5_sharing
  FOR DELETE TO authenticated
  USING (
    shared_by = auth.uid()
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

COMMIT;