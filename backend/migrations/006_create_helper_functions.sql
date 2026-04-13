-- Migration: 006_create_helper_functions
-- Description: Create helper functions for RLS policies
-- Date: 2026-04-13

BEGIN;

-- Function to check if user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin_33d3cacbc5(uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM app_33d3cacbc5_profiles
    WHERE id = uid AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to a file via sharing
CREATE OR REPLACE FUNCTION has_file_access_33d3cacbc5(uid UUID, fid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM app_33d3cacbc5_sharing
    WHERE shared_with = uid AND resource_type = 'file' AND resource_id = fid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to a folder via sharing
CREATE OR REPLACE FUNCTION has_folder_access_33d3cacbc5(uid UUID, fid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM app_33d3cacbc5_sharing
    WHERE shared_with = uid AND resource_type = 'folder' AND resource_id = fid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;