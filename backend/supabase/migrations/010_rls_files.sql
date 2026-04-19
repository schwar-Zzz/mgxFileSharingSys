-- Migration: 010_rls_files
-- Description: Row Level Security policies for files table
-- Date: 2026-04-13

BEGIN;

ALTER TABLE app_33d3cacbc5_files ENABLE ROW LEVEL SECURITY;

-- Users can see own files, shared files, files in shared folders, or if super_admin
CREATE POLICY "files_select" ON app_33d3cacbc5_files
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR has_file_access_33d3cacbc5(auth.uid(), id)
    OR has_folder_access_33d3cacbc5(auth.uid(), folder_id)
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

-- Users can upload files (owned by themselves)
CREATE POLICY "files_insert" ON app_33d3cacbc5_files
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Owners and super_admins can update files
CREATE POLICY "files_update" ON app_33d3cacbc5_files
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

-- Owners and super_admins can delete files
CREATE POLICY "files_delete" ON app_33d3cacbc5_files
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

COMMIT;