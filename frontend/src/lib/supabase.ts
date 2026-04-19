import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Table name prefix for this session
const SESSION_ID = '33d3cacbc5';
export const TABLES = {
  profiles: `app_${SESSION_ID}_profiles`,
  folders: `app_${SESSION_ID}_folders`,
  files: `app_${SESSION_ID}_files`,
  sharing: `app_${SESSION_ID}_sharing`,
  audit_logs: `app_${SESSION_ID}_audit_logs`,
  storage_settings: `app_${SESSION_ID}_storage_settings`,
} as const;

export const STORAGE_BUCKET = 'private_files';