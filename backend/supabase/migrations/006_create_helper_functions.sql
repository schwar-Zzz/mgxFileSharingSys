-- Migration: 006_create_helper_functions
-- Description: Create helper functions for RLS policies
-- Date: 2026-04-13

BEGIN;

-- Function to check if user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin_33d3cacbc5(uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = uid
      AND COALESCE(is_super_admin, FALSE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has admin-level access
CREATE OR REPLACE FUNCTION has_admin_access_33d3cacbc5(uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = uid
      AND (
        COALESCE(is_super_admin, FALSE)
        OR COALESCE(raw_app_meta_data ->> 'role', '') IN ('admin', 'super_admin')
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to a file via sharing
CREATE OR REPLACE FUNCTION has_file_access_33d3cacbc5(uid UUID, fid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_33d3cacbc5_sharing
    WHERE shared_with = uid AND resource_type = 'file' AND resource_id = fid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to a folder via sharing
CREATE OR REPLACE FUNCTION has_folder_access_33d3cacbc5(uid UUID, fid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_33d3cacbc5_sharing
    WHERE shared_with = uid AND resource_type = 'folder' AND resource_id = fid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can read a storage object
CREATE OR REPLACE FUNCTION can_read_storage_object_33d3cacbc5(uid UUID, object_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    WITH RECURSIVE target_file AS (
      SELECT f.id, f.owner_id, f.folder_id
      FROM public.app_33d3cacbc5_files f
      WHERE f.storage_path = object_name
        AND f.is_deleted = false
      LIMIT 1
    ),
    folder_chain AS (
      SELECT f.id, f.owner_id, f.parent_id
      FROM public.app_33d3cacbc5_folders f
      WHERE EXISTS (SELECT 1 FROM target_file tf WHERE tf.folder_id = f.id)
      UNION ALL
      SELECT parent.id, parent.owner_id, parent.parent_id
      FROM public.app_33d3cacbc5_folders parent
      INNER JOIN folder_chain child ON child.parent_id = parent.id
    )
    SELECT 1
    FROM target_file tf
    WHERE tf.owner_id = uid
      OR EXISTS (
        SELECT 1
        FROM public.app_33d3cacbc5_sharing s
        WHERE s.shared_with = uid
          AND s.resource_type = 'file'
          AND s.resource_id = tf.id
      )
      OR EXISTS (
        SELECT 1
        FROM folder_chain fc
        WHERE fc.owner_id = uid
          OR EXISTS (
            SELECT 1
            FROM public.app_33d3cacbc5_sharing s
            WHERE s.shared_with = uid
              AND s.resource_type = 'folder'
              AND s.resource_id = fc.id
          )
      )
      OR is_super_admin_33d3cacbc5(uid)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;