-- Migration: 005_create_audit_logs_table
-- Description: Create audit logs table for tracking user actions
-- Date: 2026-04-13

BEGIN;

CREATE TABLE IF NOT EXISTS app_33d3cacbc5_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_user ON app_33d3cacbc5_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON app_33d3cacbc5_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON app_33d3cacbc5_audit_logs(created_at DESC);

COMMIT;