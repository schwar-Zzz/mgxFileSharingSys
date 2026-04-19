-- Migration: 002_create_folders_table
-- Description: Create folders table for hierarchical folder structure
-- Date: 2026-04-13

BEGIN;

CREATE TABLE IF NOT EXISTS app_33d3cacbc5_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES app_33d3cacbc5_folders(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for folder queries
CREATE INDEX IF NOT EXISTS idx_folders_owner ON app_33d3cacbc5_folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON app_33d3cacbc5_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_deleted ON app_33d3cacbc5_folders(is_deleted);

COMMIT;