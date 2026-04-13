# FileVault - Database Migrations

## Overview
These migration files define the complete database schema, functions, triggers, RLS policies, and storage configuration for the FileVault enterprise file-sharing platform.

## Migration Order
Run these migrations in order:

| # | File | Description |
|---|------|-------------|
| 001 | `001_create_profiles_table.sql` | User profiles linked to auth.users |
| 002 | `002_create_folders_table.sql` | Hierarchical folder structure |
| 003 | `003_create_files_table.sql` | File metadata storage |
| 004 | `004_create_sharing_table.sql` | File/folder sharing between users |
| 005 | `005_create_audit_logs_table.sql` | User action audit trail |
| 006 | `006_create_helper_functions.sql` | Helper functions for RLS (is_super_admin, has_file_access, has_folder_access) |
| 007 | `007_create_trigger_new_user_profile.sql` | Auto-create profile on user signup |
| 008 | `008_rls_profiles.sql` | RLS policies for profiles table |
| 009 | `009_rls_folders.sql` | RLS policies for folders table |
| 010 | `010_rls_files.sql` | RLS policies for files table |
| 011 | `011_rls_sharing.sql` | RLS policies for sharing table |
| 012 | `012_rls_audit_logs.sql` | RLS policies for audit logs table |
| 013 | `013_storage_bucket.sql` | Private file storage bucket with RLS |

## Tables
- **app_33d3cacbc5_profiles** - User profiles (role, status, avatar)
- **app_33d3cacbc5_folders** - Folder hierarchy with soft delete
- **app_33d3cacbc5_files** - File metadata with soft delete
- **app_33d3cacbc5_sharing** - Sharing permissions (view/edit)
- **app_33d3cacbc5_audit_logs** - Action audit trail

## Functions
- `is_super_admin_33d3cacbc5(uid)` - Check if user is super_admin
- `has_file_access_33d3cacbc5(uid, fid)` - Check file sharing access
- `has_folder_access_33d3cacbc5(uid, fid)` - Check folder sharing access
- `handle_new_user_33d3cacbc5()` - Trigger function for auto-creating profiles

## Storage
- **Bucket**: `private_files` (private, 50MB limit)
- Files stored under `{user_uuid}/{timestamp}_{filename}` path