-- Migration: 004_create_sharing_table
-- Description: Create sharing table for file/folder sharing between users
-- Date: 2026-04-13

BEGIN;

CREATE TABLE IF NOT EXISTS app_33d3cacbc5_sharing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('file', 'folder')),
  resource_id UUID NOT NULL,
  shared_by UUID REFERENCES auth.users NOT NULL,
  shared_with UUID REFERENCES auth.users NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(resource_type, resource_id, shared_with)
);

-- Indexes for sharing queries
CREATE INDEX IF NOT EXISTS idx_sharing_shared_with ON app_33d3cacbc5_sharing(shared_with);
CREATE INDEX IF NOT EXISTS idx_sharing_shared_by ON app_33d3cacbc5_sharing(shared_by);
CREATE INDEX IF NOT EXISTS idx_sharing_resource ON app_33d3cacbc5_sharing(resource_type, resource_id);

COMMIT;