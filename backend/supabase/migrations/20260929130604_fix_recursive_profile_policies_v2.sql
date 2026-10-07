BEGIN;

CREATE OR REPLACE FUNCTION public.has_admin_profile_33d3cacbc5(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_33d3cacbc5_profiles AS profile
    WHERE profile.id = $1
      AND profile.role IN ('admin', 'super_admin')
  );
$$;

REVOKE ALL ON FUNCTION public.has_admin_profile_33d3cacbc5(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_admin_profile_33d3cacbc5(uuid) TO authenticated;

DROP POLICY IF EXISTS profiles_select_admin_users
  ON public.app_33d3cacbc5_profiles;
CREATE POLICY profiles_select_admin_users
  ON public.app_33d3cacbc5_profiles
  FOR SELECT TO authenticated
  USING (
    public.has_admin_profile_33d3cacbc5(auth.uid())
    AND role = 'user'
  );

DROP POLICY IF EXISTS profiles_update_admin_users
  ON public.app_33d3cacbc5_profiles;
CREATE POLICY profiles_update_admin_users
  ON public.app_33d3cacbc5_profiles
  FOR UPDATE TO authenticated
  USING (
    public.has_admin_profile_33d3cacbc5(auth.uid())
    AND role = 'user'
  )
  WITH CHECK (
    public.has_admin_profile_33d3cacbc5(auth.uid())
    AND role = 'user'
  );

DROP POLICY IF EXISTS audit_select_admin_users
  ON public.app_33d3cacbc5_audit_logs;
CREATE POLICY audit_select_admin_users
  ON public.app_33d3cacbc5_audit_logs
  FOR SELECT TO authenticated
  USING (
    public.has_admin_profile_33d3cacbc5(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.app_33d3cacbc5_profiles AS subject
      WHERE subject.id = app_33d3cacbc5_audit_logs.user_id
        AND subject.role = 'user'
    )
  );

COMMIT;