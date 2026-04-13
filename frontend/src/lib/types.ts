export interface Profile {
  id: string;
  full_name: string | null;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'suspended' | 'pending';
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  owner_id: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileRecord {
  id: string;
  name: string;
  folder_id: string | null;
  owner_id: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  metadata: Record<string, unknown>;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sharing {
  id: string;
  resource_type: 'file' | 'folder';
  resource_id: string;
  shared_by: string;
  shared_with: string;
  permission: 'view' | 'edit';
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export type ViewMode = 'grid' | 'list';

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}