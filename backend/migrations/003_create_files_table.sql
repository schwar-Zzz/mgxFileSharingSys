-- Migration: 003_create_files_table
-- Description: Create files table for file metadata storage
-- Date: 2026-04-13

BEGIN;

CREATE TABLE IF NOT EXISTS app_33d3cacbc5_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  folder_id UUID REFERENCES app_33d3cacbc5_folders(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for file queries
CREATE INDEX IF NOT EXISTS idx_files_owner ON app_33d3cacbc5_files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_folder ON app_33d3cacbc5_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_deleted ON app_33d3cacbc5_files(is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_mime ON app_33d3cacbc5_files(mime_type);

COMMIT;