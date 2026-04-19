import { useCallback, useEffect, useState } from 'react';
import { supabase, STORAGE_BUCKET, TABLES } from '@/lib/supabase';
import type { BreadcrumbItem, FileRecord, Folder, Profile, Sharing } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PdfViewerDialog from '@/components/PdfViewerDialog';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  Edit,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Home,
  MoreVertical,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <FileIcon className="h-8 w-8 text-gray-400" />;
  if (mimeType.startsWith('image/')) return <FileImage className="h-8 w-8 text-green-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return <FileSpreadsheet className="h-8 w-8 text-emerald-500" />;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word')) return <FileText className="h-8 w-8 text-blue-500" />;
  return <FileIcon className="h-8 w-8 text-gray-400" />;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface FileManagerProps {
  userId: string;
  userRole: string;
  profile: Profile | null;
  onStorageUsageChange?: (usedGb: number) => void;
}

const BYTES_PER_GB = 1024 * 1024 * 1024;

export default function FileManager({ userId, userRole, profile, onStorageUsageChange }: FileManagerProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [folderSizes, setFolderSizes] = useState<Record<string, number>>({});
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'My Files' }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [shareQuery, setShareQuery] = useState('');
  const [shareSuggestions, setShareSuggestions] = useState<Profile[]>([]);
  const [selectedShareProfile, setSelectedShareProfile] = useState<Profile | null>(null);
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');
  const [shareLookupLoading, setShareLookupLoading] = useState(false);
  const [existingShares, setExistingShares] = useState<(Sharing & { profile?: Profile })[]>([]);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfViewerSrc, setPdfViewerSrc] = useState('');
  const [pdfViewerTitle, setPdfViewerTitle] = useState('');
  const [storageQuotaGb, setStorageQuotaGb] = useState(0);
  const [storageUsedGb, setStorageUsedGb] = useState(0);
  const [sharedFolderIds, setSharedFolderIds] = useState<string[]>([]);
  const [sharedFileIds, setSharedFileIds] = useState<string[]>([]);
  const [sharedFolderEditIds, setSharedFolderEditIds] = useState<string[]>([]);
  const [sharedFileEditIds, setSharedFileEditIds] = useState<string[]>([]);

  useEffect(() => {
    setStorageQuotaGb(Number(profile?.storage_quota_gb || 0));
    setStorageUsedGb(Number(profile?.storage_used_gb || 0));
  }, [profile]);

  const fetchContents = useCallback(async () => {
    setLoading(true);
    try {
      const { data: directSharedFileRows } = await supabase
        .from(TABLES.sharing)
        .select('resource_id, permission')
        .eq('shared_with', userId)
        .eq('resource_type', 'file');

      const directSharedFileIds = (directSharedFileRows || []).map(row => row.resource_id);
      const directSharedFileEditIds = (directSharedFileRows || [])
        .filter(row => row.permission === 'edit')
        .map(row => row.resource_id);

      const folderQuery = supabase.from(TABLES.folders).select('*').eq('is_deleted', false).order('name');
      if (currentFolderId) {
        folderQuery.eq('parent_id', currentFolderId);
      } else {
        folderQuery.is('parent_id', null);
      }

      const { data: folderData } = await folderQuery;
      setFolders(folderData || []);

      const fileQuery = supabase.from(TABLES.files).select('*').eq('is_deleted', false).order('name');
      if (currentFolderId) {
        fileQuery.eq('folder_id', currentFolderId);
      } else {
        fileQuery.is('folder_id', null);
      }

      const { data: fileData } = await fileQuery;
      let mergedFiles = fileData || [];

      // Include directly shared files at root even if they live in another user's folder tree.
      if (!currentFolderId && directSharedFileIds.length > 0) {
        const { data: directlySharedFiles } = await supabase
          .from(TABLES.files)
          .select('*')
          .eq('is_deleted', false)
          .in('id', directSharedFileIds)
          .order('name');

        if (directlySharedFiles && directlySharedFiles.length > 0) {
          const byId = new Map<string, FileRecord>();
          [...mergedFiles, ...directlySharedFiles].forEach(file => {
            byId.set(file.id, file as FileRecord);
          });
          mergedFiles = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
        }
      }

      setFiles(mergedFiles);

      const { data: folderShares } = await supabase
        .from(TABLES.sharing)
        .select('resource_id, permission')
        .eq('shared_with', userId)
        .eq('resource_type', 'folder');

      const { data: fileShares } = await supabase
        .from(TABLES.sharing)
        .select('resource_id, permission')
        .eq('shared_with', userId)
        .eq('resource_type', 'file');

      setSharedFolderIds((folderShares || []).map(share => share.resource_id));
      setSharedFolderEditIds((folderShares || []).filter(share => share.permission === 'edit').map(share => share.resource_id));
      setSharedFileIds(Array.from(new Set([...(fileShares || []).map(share => share.resource_id), ...directSharedFileIds])));
      setSharedFileEditIds(Array.from(new Set([
        ...(fileShares || []).filter(share => share.permission === 'edit').map(share => share.resource_id),
        ...directSharedFileEditIds,
      ])));

      const calculateFolderSize = async (folderId: string, visited: Set<string> = new Set()): Promise<number> => {
        if (visited.has(folderId)) return 0;
        visited.add(folderId);

        const [{ data: childFolders }, { data: childFiles }] = await Promise.all([
          supabase.from(TABLES.folders).select('id').eq('is_deleted', false).eq('parent_id', folderId),
          supabase.from(TABLES.files).select('size_bytes').eq('is_deleted', false).eq('folder_id', folderId),
        ]);

        const directSize = (childFiles || []).reduce((sum, file) => sum + Number(file.size_bytes || 0), 0);

        let nestedSize = 0;
        for (const childFolder of childFolders || []) {
          nestedSize += await calculateFolderSize(childFolder.id, visited);
        }

        return directSize + nestedSize;
      };

      const nextFolderSizes: Record<string, number> = {};
      await Promise.all((folderData || []).map(async (folder) => {
        nextFolderSizes[folder.id] = await calculateFolderSize(folder.id);
      }));
      setFolderSizes(nextFolderSizes);
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  const navigateToFolder = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const item = breadcrumbs[index];
    setCurrentFolderId(item.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const goBack = () => {
    if (breadcrumbs.length > 1) {
      navigateToBreadcrumb(breadcrumbs.length - 2);
    }
  };

  const logAction = async (action: string, resourceType?: string, resourceId?: string, details?: Record<string, unknown>) => {
    try {
      await supabase.from(TABLES.audit_logs).insert({
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details: details || {},
      });
    } catch {
      // ignore audit failures
    }
  };

  const syncStorageUsageFromDb = useCallback(async () => {
    const { data: activeFolders, error: foldersError } = await supabase
      .from(TABLES.folders)
      .select('id')
      .eq('owner_id', userId)
      .eq('is_deleted', false);

    if (foldersError) return;

    const activeFolderIds = new Set((activeFolders || []).map(folder => folder.id));

    const { data: ownedFiles, error: filesError } = await supabase
      .from(TABLES.files)
      .select('size_bytes,folder_id')
      .eq('owner_id', userId)
      .eq('is_deleted', false);

    if (filesError) return;

    const visibleFiles = (ownedFiles || []).filter(file => !file.folder_id || activeFolderIds.has(file.folder_id));
    const usedBytes = visibleFiles.reduce((sum, file) => sum + Number(file.size_bytes || 0), 0);
    const nextUsedGb = usedBytes / BYTES_PER_GB;

    setStorageUsedGb(nextUsedGb);
    onStorageUsageChange?.(nextUsedGb);

    await supabase
      .from(TABLES.profiles)
      .update({ storage_used_gb: nextUsedGb })
      .eq('id', userId);
  }, [userId, onStorageUsageChange]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const { error } = await supabase.from(TABLES.folders).insert({
        name: newFolderName.trim(),
        parent_id: currentFolderId,
        owner_id: userId,
      });
      if (error) throw error;
      toast.success('Folder created');
      setNewFolderOpen(false);
      setNewFolderName('');
      await logAction('create_folder', 'folder', undefined, { name: newFolderName.trim() });
      fetchContents();
    } catch {
      toast.error('Failed to create folder');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFiles = e.target.files;
    if (!uploadFiles || uploadFiles.length === 0) return;

    const selectedFiles = Array.from(uploadFiles);
    let remainingBytes = Math.max(storageQuotaGb - storageUsedGb, 0) * BYTES_PER_GB;
    let uploadedBytes = 0;

    for (const file of selectedFiles) {
      if (file.size > remainingBytes) {
        toast.error(`You don't have enough storage for ${file.name}`);
        continue;
      }

      try {
        const storagePath = `${userId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file);
        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase.from(TABLES.files).insert({
          name: file.name,
          folder_id: currentFolderId,
          owner_id: userId,
          storage_path: storagePath,
          mime_type: file.type,
          size_bytes: file.size,
          metadata: {},
        });
        if (dbError) throw dbError;

        await logAction('upload', 'file', undefined, { name: file.name, size: file.size });
        toast.success(`Uploaded: ${file.name}`);
        remainingBytes -= file.size;
        uploadedBytes += file.size;
      } catch {
        toast.error(`Failed to upload: ${file.name}`);
      }
    }

    if (uploadedBytes > 0) {
      await syncStorageUsageFromDb();
    }

    fetchContents();
    e.target.value = '';
  };

  const handleDownload = async (file: FileRecord) => {
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(file.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      await logAction('download', 'file', file.id, { name: file.name });
    } catch {
      toast.error('Failed to download file');
    }
  };

  const handleDelete = async (id: string, type: 'file' | 'folder', name: string) => {
    try {
      const folderRows = await supabase
        .from(TABLES.folders)
        .select('id,parent_id,owner_id')
        .eq('is_deleted', false);

      if (folderRows.error) throw folderRows.error;

      const allFolders = folderRows.data || [];

      const getDescendantFolderIds = (rootFolderId: string): string[] => {
        const childrenByParent = new Map<string | null, string[]>();
        allFolders.forEach(folder => {
          const key = folder.parent_id;
          const existing = childrenByParent.get(key) || [];
          existing.push(folder.id);
          childrenByParent.set(key, existing);
        });

        const result: string[] = [];
        const stack = [rootFolderId];
        const seen = new Set<string>();

        while (stack.length > 0) {
          const current = stack.pop();
          if (!current || seen.has(current)) continue;
          seen.add(current);
          result.push(current);
          const children = childrenByParent.get(current) || [];
          children.forEach(childId => stack.push(childId));
        }

        return result;
      };

      let reclaimedBytes = 0;
      let shouldUpdateOwnerUsage = false;
      let ownerFileToDelete: FileRecord | null = null;
      let deletedFilesCount = 0;
      let deletedFoldersCount = 0;
      let deletedSharesCount = 0;

      const isOwnerDelete = (() => {
        if (type === 'file') {
          const file = files.find(item => item.id === id);
          return !!file && file.owner_id === userId;
        }
        const folder = allFolders.find(item => item.id === id);
        return !!folder && folder.owner_id === userId;
      })();

      if (isOwnerDelete) {
        if (type === 'file') {
          const file = files.find(item => item.id === id);
          if (!file) throw new Error('File not found');

          const { error: storageDeleteError } = await supabase
            .storage
            .from(STORAGE_BUCKET)
            .remove([file.storage_path]);
          if (storageDeleteError) throw storageDeleteError;

          const { data: removedShares, error: shareDeleteError } = await supabase
            .from(TABLES.sharing)
            .delete()
            .eq('resource_type', 'file')
            .eq('resource_id', file.id)
            .select('id');
          if (shareDeleteError) throw shareDeleteError;
          deletedSharesCount += (removedShares || []).length;

          const { data: removedFiles, error: fileDeleteError } = await supabase
            .from(TABLES.files)
            .delete()
            .eq('id', file.id)
            .select('id,size_bytes,owner_id');
          if (fileDeleteError) throw fileDeleteError;
          deletedFilesCount = (removedFiles || []).length;

          reclaimedBytes = (removedFiles || [])
            .filter(row => row.owner_id === userId)
            .reduce((sum, row) => sum + Number(row.size_bytes || 0), 0);
          shouldUpdateOwnerUsage = reclaimedBytes > 0;
        } else {
          const folderIds = getDescendantFolderIds(id);
          if (folderIds.length === 0) throw new Error('Folder not found');

          const { data: filesInTree, error: filesQueryError } = await supabase
            .from(TABLES.files)
            .select('id,storage_path,size_bytes,owner_id')
            .in('folder_id', folderIds);
          if (filesQueryError) throw filesQueryError;

          const filesToDelete = filesInTree || [];
          const fileIds = filesToDelete.map(file => file.id);
          const storagePaths = filesToDelete.map(file => file.storage_path).filter(Boolean);

          if (storagePaths.length > 0) {
            const { error: storageDeleteError } = await supabase
              .storage
              .from(STORAGE_BUCKET)
              .remove(storagePaths);
            if (storageDeleteError) throw storageDeleteError;
          }

          if (fileIds.length > 0) {
            const { data: removedFileShares, error: fileShareDeleteError } = await supabase
              .from(TABLES.sharing)
              .delete()
              .eq('resource_type', 'file')
              .in('resource_id', fileIds)
              .select('id');
            if (fileShareDeleteError) throw fileShareDeleteError;
            deletedSharesCount += (removedFileShares || []).length;
          }

          const { data: removedFolderShares, error: folderShareDeleteError } = await supabase
            .from(TABLES.sharing)
            .delete()
            .eq('resource_type', 'folder')
            .in('resource_id', folderIds)
            .select('id');
          if (folderShareDeleteError) throw folderShareDeleteError;
          deletedSharesCount += (removedFolderShares || []).length;

          if (fileIds.length > 0) {
            const { data: removedFiles, error: fileDeleteError } = await supabase
              .from(TABLES.files)
              .delete()
              .in('id', fileIds)
              .select('id,size_bytes,owner_id');
            if (fileDeleteError) throw fileDeleteError;
            deletedFilesCount = (removedFiles || []).length;

            reclaimedBytes = (removedFiles || [])
              .filter(row => row.owner_id === userId)
              .reduce((sum, row) => sum + Number(row.size_bytes || 0), 0);
            shouldUpdateOwnerUsage = reclaimedBytes > 0;
          }

          const { data: removedFolders, error: folderDeleteError } = await supabase
            .from(TABLES.folders)
            .delete()
            .in('id', folderIds)
            .select('id');
          if (folderDeleteError) throw folderDeleteError;
          deletedFoldersCount = (removedFolders || []).length;
        }

        if (shouldUpdateOwnerUsage && reclaimedBytes > 0) {
          const previousUsedGb = storageUsedGb;
          const nextUsedGb = Math.max(previousUsedGb - (reclaimedBytes / BYTES_PER_GB), 0);

          setStorageUsedGb(nextUsedGb);
          onStorageUsageChange?.(nextUsedGb);

          const { error: usageError } = await supabase
            .from(TABLES.profiles)
            .update({ storage_used_gb: nextUsedGb })
            .eq('id', userId);

          if (usageError) {
            setStorageUsedGb(previousUsedGb);
            onStorageUsageChange?.(previousUsedGb);
          }
        }

        toast.success(`Deleted: ${name}`);
        await logAction('delete', type, id, {
          name,
          hard_delete: true,
          deleted_files: deletedFilesCount,
          deleted_folders: deletedFoldersCount,
          deleted_shares: deletedSharesCount,
          reclaimed_bytes: reclaimedBytes,
        });
        await syncStorageUsageFromDb();
        fetchContents();
        return;
      }

      // Non-owner delete path: keep soft delete behavior.
      if (type === 'file') {
        const file = files.find(item => item.id === id);
        ownerFileToDelete = file && file.owner_id === userId ? file : null;
        reclaimedBytes = Number(ownerFileToDelete?.size_bytes || 0);
        shouldUpdateOwnerUsage = !!ownerFileToDelete;

        // Owner deletes must be hard-deleted from storage bucket.
        if (ownerFileToDelete?.storage_path) {
          const { error: storageDeleteError } = await supabase
            .storage
            .from(STORAGE_BUCKET)
            .remove([ownerFileToDelete.storage_path]);

          if (storageDeleteError) {
            throw storageDeleteError;
          }
        }
      }

      const table = type === 'file' ? TABLES.files : TABLES.folders;
      const { error } = await supabase.from(table).update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;

      if (shouldUpdateOwnerUsage && reclaimedBytes > 0) {
        const previousUsedGb = storageUsedGb;
        const nextUsedGb = Math.max(previousUsedGb - (reclaimedBytes / BYTES_PER_GB), 0);

        // Update UI progress immediately for better feedback.
        setStorageUsedGb(nextUsedGb);
        onStorageUsageChange?.(nextUsedGb);

        const { error: usageError } = await supabase
          .from(TABLES.profiles)
          .update({ storage_used_gb: nextUsedGb })
          .eq('id', userId);

        if (usageError) {
          // Roll back optimistic progress update if DB persistence fails.
          setStorageUsedGb(previousUsedGb);
          onStorageUsageChange?.(previousUsedGb);
        }
      }

      toast.success(`Deleted: ${name}`);
      await logAction('delete', type, id, { name });
      await syncStorageUsageFromDb();
      fetchContents();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameTarget.name.trim()) return;
    try {
      const table = renameTarget.type === 'file' ? TABLES.files : TABLES.folders;
      const { error } = await supabase.from(table).update({ name: renameTarget.name.trim() }).eq('id', renameTarget.id);
      if (error) throw error;
      toast.success('Renamed successfully');
      setRenameOpen(false);
      setRenameTarget(null);
      fetchContents();
    } catch {
      toast.error('Failed to rename');
    }
  };

  const isPdfFile = (file: FileRecord) => (file.mime_type || '').includes('pdf') || file.name.toLowerCase().endsWith('.pdf');

  const handleOpenFile = async (file: FileRecord) => {
    if (!isPdfFile(file)) {
      await handleDownload(file);
      return;
    }

    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.storage_path, 60 * 30);
    if (error || !data?.signedUrl) {
      toast.error('Failed to open PDF');
      return;
    }

    setPdfViewerTitle(file.name);
    setPdfViewerSrc(data.signedUrl);
    console.log('Opening PDF with URL:', data.signedUrl);
    setPdfViewerOpen(true);
  };

  const openShareDialog = async (id: string, name: string, type: 'file' | 'folder') => {
    setShareTarget({ id, name, type });
    setShareQuery('');
    setShareSuggestions([]);
    setSelectedShareProfile(null);
    setSharePermission('view');
    setShareOpen(true);

    const { data } = await supabase.from(TABLES.sharing).select('*').eq('resource_type', type).eq('resource_id', id);
    if (data && data.length > 0) {
      const userIds = data.map(share => share.shared_with);
      const { data: profiles } = await supabase.from(TABLES.profiles).select('*').in('id', userIds);
      const sharesWithProfiles = data.map(share => ({
        ...share,
        profile: profiles?.find(profile => profile.id === share.shared_with),
      }));
      setExistingShares(sharesWithProfiles);
    } else {
      setExistingShares([]);
    }
  };

  const searchShareUsers = useCallback(async (query: string) => {
    setShareQuery(query);
    setSelectedShareProfile(null);

    const trimmed = query.trim();
    if (!trimmed) {
      setShareSuggestions([]);
      return;
    }

    setShareLookupLoading(true);
    try {
      const { data } = await supabase
        .from(TABLES.profiles)
        .select('*')
        .ilike('full_name', `%${trimmed}%`)
        .neq('id', userId)
        .order('full_name')
        .limit(5);

      setShareSuggestions((data || []) as Profile[]);
    } catch {
      setShareSuggestions([]);
    } finally {
      setShareLookupLoading(false);
    }
  }, [userId]);

  const handleShare = async () => {
    if (!shareTarget || !selectedShareProfile) {
      toast.error('Select a valid user from the list');
      return;
    }

    try {
      const { error } = await supabase.from(TABLES.sharing).upsert({
        resource_type: shareTarget.type,
        resource_id: shareTarget.id,
        shared_by: userId,
        shared_with: selectedShareProfile.id,
        permission: sharePermission,
      }, { onConflict: 'resource_type,resource_id,shared_with' });

      if (error) throw error;
      toast.success(`Shared with ${selectedShareProfile.full_name || 'user'}`);
      await logAction('share', shareTarget.type, shareTarget.id, {
        shared_with: selectedShareProfile.id,
        permission: sharePermission,
      });
      setShareOpen(false);
    } catch {
      toast.error('Failed to share');
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      const { error } = await supabase.from(TABLES.sharing).delete().eq('id', shareId);
      if (error) throw error;
      setExistingShares(prev => prev.filter(share => share.id !== shareId));
      toast.success('Share revoked');
    } catch {
      toast.error('Failed to revoke share');
    }
  };

  const filteredFolders = folders.filter(folder => folder.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = files.filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const isOwnerOrAdmin = (ownerId: string) => ownerId === userId || userRole === 'super_admin';
  const canAccessFolder = (folder: Folder) => isOwnerOrAdmin(folder.owner_id) || sharedFolderIds.includes(folder.id);
  const canAccessFile = (file: FileRecord) =>
    isOwnerOrAdmin(file.owner_id)
    || sharedFileIds.includes(file.id)
    || (!!file.folder_id && sharedFolderIds.includes(file.folder_id));
  const canEditFolder = (folder: Folder) => isOwnerOrAdmin(folder.owner_id) || sharedFolderEditIds.includes(folder.id);
  const canEditFile = (file: FileRecord) =>
    isOwnerOrAdmin(file.owner_id)
    || sharedFileEditIds.includes(file.id)
    || (!!file.folder_id && sharedFolderEditIds.includes(file.folder_id));
  const remainingGb = Math.max(storageQuotaGb - storageUsedGb, 0);
  const storageUsagePercent = storageQuotaGb > 0 ? Math.min((storageUsedGb / storageQuotaGb) * 100, 100) : 0;
  const formatStorageGb = (value: number) => (value > 0 && value < 1 ? value.toFixed(4) : value.toFixed(2));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b bg-white px-6 py-3">
        <Button variant="ghost" size="icon" onClick={goBack} disabled={breadcrumbs.length <= 1}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id ?? 'root'} className="flex shrink-0 items-center gap-1">
              {index > 0 && <ChevronRight className="h-3 w-3 text-gray-400" />}
              <button
                onClick={() => navigateToBreadcrumb(index)}
                className={`hover:text-blue-600 ${index === breadcrumbs.length - 1 ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
              >
                {index === 0 ? <Home className="h-4 w-4" /> : crumb.name}
              </button>
            </div>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-9 pl-9"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-gray-400" />
            </button>
          )}
        </div>

        <Button size="sm" variant="outline" onClick={() => setNewFolderOpen(true)}>
          <FolderPlus className="mr-2 h-4 w-4" /> New Folder
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="relative border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-700"
        >
          <Upload className="mr-2 h-4 w-4" /> Upload
          <input type="file" multiple onChange={handleUpload} className="absolute inset-0 cursor-pointer opacity-0" />
        </Button>
      </div>

      <div className="border-b bg-white px-6 py-3 text-sm text-gray-600">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-gray-900">Storage usage</p>
            <p>{formatStorageGb(storageUsedGb)} GB used of {formatStorageGb(storageQuotaGb)} GB</p>
          </div>
          <p className="text-xs font-medium text-gray-500">{`${storageUsagePercent.toFixed(0)}% used`}</p>
        </div>
        <Progress value={storageUsagePercent} className="mt-2 h-2 bg-blue-50" indicatorClassName="bg-blue-700" />
        <p className="mt-1 text-xs text-gray-400">{formatStorageGb(remainingGb)} GB remaining</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-gray-400">
            <img
              src="https://mgx-backend-cdn.metadl.com/generate/images/868948/2026-04-12/14f85d25-933a-4481-8078-61d6ffd6b006.png"
              alt="Empty"
              className="mb-4 h-32 w-32 opacity-60"
            />
            <p className="text-lg font-medium">No files or folders here</p>
            <p className="text-sm">Create a folder or upload files to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-white sm:overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Modified</th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredFolders.map(folder => (
                  <tr key={folder.id} className="group hover:bg-gray-50">
                    <td className="flex items-center gap-3 px-4 py-3">
                      <FolderIcon className="h-5 w-5 shrink-0 text-blue-400" />
                      <span className="truncate font-medium">{folder.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatSize(folderSizes[folder.id] || 0)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(folder.updated_at)}</td>
                    <td className="px-4 py-3">
                      {canAccessFolder(folder) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => navigateToFolder(folder)}>
                              <FolderIcon className="mr-2 h-4 w-4" /> Open
                            </DropdownMenuItem>
                            {canEditFolder(folder) && (
                              <>
                                <DropdownMenuItem onClick={() => { setRenameTarget({ id: folder.id, name: folder.name, type: 'folder' }); setRenameOpen(true); }}>
                                  <Edit className="mr-2 h-4 w-4" /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(folder.id, 'folder', folder.name)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </>
                            )}
                            {isOwnerOrAdmin(folder.owner_id) && (
                              <DropdownMenuItem onClick={() => openShareDialog(folder.id, folder.name, 'folder')}>
                                <Share2 className="mr-2 h-4 w-4" /> Share
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredFiles.map(file => (
                  <tr key={file.id} className="group hover:bg-gray-50">
                    <td className="flex items-center gap-3 px-4 py-3">
                      <div className="shrink-0">{getFileIcon(file.mime_type)}</div>
                      <div>
                        <p className="truncate font-medium">{file.name}</p>
                        <p className="text-xs text-gray-400">{file.mime_type || 'unknown type'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatSize(file.size_bytes)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(file.updated_at)}</td>
                    <td className="px-4 py-3">
                      {canAccessFile(file) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {isPdfFile(file) && (
                              <DropdownMenuItem onClick={() => handleOpenFile(file)}>
                                <FileText className="mr-2 h-4 w-4" /> Open
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDownload(file)}>
                              <Download className="mr-2 h-4 w-4" /> Download
                            </DropdownMenuItem>
                            {canEditFile(file) && (
                              <>
                                <DropdownMenuItem onClick={() => { setRenameTarget({ id: file.id, name: file.name, type: 'file' }); setRenameOpen(true); }}>
                                  <Edit className="mr-2 h-4 w-4" /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(file.id, 'file', file.name)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </>
                            )}
                            {isOwnerOrAdmin(file.owner_id) && (
                              <DropdownMenuItem onClick={() => openShareDialog(file.id, file.name, 'file')}>
                                <Share2 className="mr-2 h-4 w-4" /> Share
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renameTarget?.type}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTarget?.name || ''}
            onChange={(event) => setRenameTarget(prev => prev ? { ...prev, name: event.target.value } : null)}
            onKeyDown={(event) => event.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share &quot;{shareTarget?.name}&quot;</DialogTitle>
            <DialogDescription>Search by full name and select a user from the list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Type full name"
                  value={shareQuery}
                  onChange={(event) => searchShareUsers(event.target.value)}
                  className="flex-1"
                />
                <Select value={sharePermission} onValueChange={(value: 'view' | 'edit') => setSharePermission(value)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View</SelectItem>
                    <SelectItem value="edit">Edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {shareLookupLoading && <p className="text-xs text-gray-500">Searching users...</p>}

              {shareSuggestions.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border bg-white shadow-sm">
                  {shareSuggestions.map(profile => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => {
                        setSelectedShareProfile(profile);
                        setShareQuery(profile.full_name || '');
                        setShareSuggestions([]);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span>{profile.full_name || 'Unknown'}</span>
                      <span className="text-xs text-gray-400 capitalize">{profile.role}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedShareProfile && (
                <p className="text-xs text-gray-500">
                  Selected: <span className="font-medium text-gray-700">{selectedShareProfile.full_name}</span>
                </p>
              )}
            </div>

            <Button onClick={handleShare} className="w-full">Share</Button>

            {existingShares.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Shared with:</p>
                {existingShares.map(share => (
                  <div key={share.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{share.profile?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 capitalize">{share.permission}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRevokeShare(share.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PdfViewerDialog
        open={pdfViewerOpen}
        onOpenChange={setPdfViewerOpen}
        src={pdfViewerSrc}
        title={pdfViewerTitle}
      />
    </div>
  );
}
