-- Migration: 016_rls_edit_permissions_shared
-- Description: Allow users with sharing permission=edit to update/delete shared folders/files
-- Date: 2026-04-19

BEGIN;

-- Ensure helper functions support explicit edit checks
CREATE OR REPLACE FUNCTION has_file_edit_access_33d3cacbc5(uid UUID, fid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.app_33d3cacbc5_sharing
    WHERE shared_with = uid
      AND resource_type = 'file'
      AND resource_id = fid
      AND permission = 'edit'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_folder_edit_access_33d3cacbc5(uid UUID, fid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.app_33d3cacbc5_sharing
    WHERE shared_with = uid
      AND resource_type = 'folder'
      AND resource_id = fid
      AND permission = 'edit'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate folder policies so edit shares can modify/delete
DROP POLICY IF EXISTS "folders_update" ON app_33d3cacbc5_folders;
CREATE POLICY "folders_update" ON app_33d3cacbc5_folders
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR has_folder_edit_access_33d3cacbc5(auth.uid(), id)
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

DROP POLICY IF EXISTS "folders_delete" ON app_33d3cacbc5_folders;
CREATE POLICY "folders_delete" ON app_33d3cacbc5_folders
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR has_folder_edit_access_33d3cacbc5(auth.uid(), id)
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

-- Recreate file policies so edit shares can modify/delete
-- This includes inherited edit rights from folder shares.
DROP POLICY IF EXISTS "files_update" ON app_33d3cacbc5_files;
CREATE POLICY "files_update" ON app_33d3cacbc5_files
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR has_file_edit_access_33d3cacbc5(auth.uid(), id)
    OR has_folder_edit_access_33d3cacbc5(auth.uid(), folder_id)
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

DROP POLICY IF EXISTS "files_delete" ON app_33d3cacbc5_files;
CREATE POLICY "files_delete" ON app_33d3cacbc5_files
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR has_file_edit_access_33d3cacbc5(auth.uid(), id)
    OR has_folder_edit_access_33d3cacbc5(auth.uid(), folder_id)
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

COMMIT;
