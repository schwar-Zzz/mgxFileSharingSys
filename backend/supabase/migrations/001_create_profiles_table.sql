-- Migration: 001_create_profiles_table
-- Description: Create profiles table linked to auth.users
-- Date: 2026-04-13

BEGIN;

CREATE TABLE IF NOT EXISTS app_33d3cacbc5_profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON app_33d3cacbc5_profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON app_33d3cacbc5_profiles(status);

COMMIT;