CREATE OR REPLACE FUNCTION public.can_read_storage_object_33d3cacbc5(uid UUID, object_name TEXT)
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

DROP POLICY IF EXISTS storage_select_own ON storage.objects;
CREATE POLICY storage_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'private_files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR can_read_storage_object_33d3cacbc5(auth.uid(), name)
      OR is_super_admin_33d3cacbc5(auth.uid())
    )
  );
