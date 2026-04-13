-- Migration: 007_create_trigger_new_user_profile
-- Description: Auto-create profile when a new user signs up
-- Date: 2026-04-13

BEGIN;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user_33d3cacbc5()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO app_33d3cacbc5_profiles (id, full_name, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user',
    'active'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created_33d3cacbc5 ON auth.users;
CREATE TRIGGER on_auth_user_created_33d3cacbc5
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_33d3cacbc5();

COMMIT;