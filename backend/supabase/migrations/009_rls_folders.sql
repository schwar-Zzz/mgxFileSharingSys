-- Migration: 009_rls_folders
-- Description: Row Level Security policies for folders table
-- Date: 2026-04-13

BEGIN;

ALTER TABLE app_33d3cacbc5_folders ENABLE ROW LEVEL SECURITY;

-- Users can see their own folders, shared folders, or if super_admin
CREATE POLICY "folders_select" ON app_33d3cacbc5_folders
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR has_folder_access_33d3cacbc5(auth.uid(), id)
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

-- Users can create folders (owned by themselves)
CREATE POLICY "folders_insert" ON app_33d3cacbc5_folders
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Owners and super_admins can update folders
CREATE POLICY "folders_update" ON app_33d3cacbc5_folders
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

-- Owners and super_admins can delete folders
CREATE POLICY "folders_delete" ON app_33d3cacbc5_folders
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

COMMIT;