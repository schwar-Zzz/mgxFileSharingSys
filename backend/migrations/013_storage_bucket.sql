-- Migration: 013_storage_bucket
-- Description: Create private_files storage bucket with RLS policies
-- Date: 2026-04-13

BEGIN;

-- Create private storage bucket for file uploads
-- Max file size: 50MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private_files',
  'private_files',
  false,
  52428800,
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
    'application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain','text/csv',
    'application/zip','application/x-rar-compressed',
    'video/mp4','audio/mpeg','audio/wav'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder (folder name = user UUID)
CREATE POLICY "storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'private_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own files, super_admins can read all
CREATE POLICY "storage_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'private_files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_super_admin_33d3cacbc5(auth.uid())
    )
  );

-- Users can update their own files, super_admins can update all
CREATE POLICY "storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'private_files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_super_admin_33d3cacbc5(auth.uid())
    )
  );

-- Users can delete their own files, super_admins can delete all
CREATE POLICY "storage_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'private_files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_super_admin_33d3cacbc5(auth.uid())
    )
  );

COMMIT;