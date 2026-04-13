-- Migration: 012_rls_audit_logs
-- Description: Row Level Security policies for audit logs table
-- Date: 2026-04-13

BEGIN;

ALTER TABLE app_33d3cacbc5_audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own logs, super_admins can see all
CREATE POLICY "audit_select_own" ON app_33d3cacbc5_audit_logs
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_super_admin_33d3cacbc5(auth.uid())
  );

-- Users can insert their own audit logs
CREATE POLICY "audit_insert" ON app_33d3cacbc5_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMIT;