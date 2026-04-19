-- Migration: 012_rls_audit_logs
-- Description: Row Level Security policies for audit logs table
-- Date: 2026-04-13

BEGIN;

ALTER TABLE app_33d3cacbc5_audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own logs
CREATE POLICY "audit_select_own_user" ON app_33d3cacbc5_audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can see user logs
CREATE POLICY "audit_select_admin_users" ON app_33d3cacbc5_audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM app_33d3cacbc5_profiles viewer
      WHERE viewer.id = auth.uid()
        AND viewer.role IN ('admin', 'super_admin')
    )
    AND EXISTS (
      SELECT 1
      FROM app_33d3cacbc5_profiles subject
      WHERE subject.id = user_id
        AND subject.role = 'user'
    )
  );

-- Super admins can see all logs
CREATE POLICY "audit_select_super_admin" ON app_33d3cacbc5_audit_logs
  FOR SELECT TO authenticated
  USING (is_super_admin_33d3cacbc5(auth.uid()));

-- Users can see their own logs, super_admins can see all
-- Users can insert their own audit logs
CREATE POLICY "audit_insert" ON app_33d3cacbc5_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMIT;