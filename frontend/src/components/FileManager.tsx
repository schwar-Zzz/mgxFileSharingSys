import { useState, useEffect, useCallback } from 'react';
import { supabase, TABLES, STORAGE_BUCKET } from '@/lib/supabase';
import type { FileRecord, Folder, Profile, Sharing, ViewMode, BreadcrumbItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  FolderPlus, Upload, Grid3X3, List, MoreVertical, Folder as FolderIcon,
  FileText, FileImage, FileSpreadsheet, File as FileIcon, Download,
  Trash2, Share2, Edit, ChevronRight, Home, ArrowLeft, Search, X,
} from 'lucide-react';

// File icon helper
function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <FileIcon className="w-8 h-8 text-gray-400" />;
  if (mimeType.startsWith('image/')) return <FileImage className="w-8 h-8 text-green-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
    return <FileSpreadsheet className="w-8 h-8 text-emerald-500" />;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word'))
    return <FileText className="w-8 h-8 text-blue-500" />;
  return <FileIcon className="w-8 h-8 text-gray-400" />;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

interface FileManagerProps {
  userId: string;
  userRole: string;
}

export default function FileManager({ userId, userRole }: FileManagerProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'My Files' }]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');
  const [existingShares, setExistingShares] = useState<(Sharing & { profile?: Profile })[]>([]);

  const fetchContents = useCallback(async () => {
    setLoading(true);
    try {
      const folderQuery = supabase
        .from(TABLES.folders)
        .select('*')
        .eq('is_deleted', false)
        .order('name');

      if (currentFolderId) {
        folderQuery.eq('parent_id', currentFolderId);
      } else {
        folderQuery.is('parent_id', null);
      }

      const { data: folderData } = await folderQuery;
      setFolders(folderData || []);

      const fileQuery = supabase
        .from(TABLES.files)
        .select('*')
        .eq('is_deleted', false)
        .order('name');

      if (currentFolderId) {
        fileQuery.eq('folder_id', currentFolderId);
      } else {
        fileQuery.is('folder_id', null);
      }

      const { data: fileData } = await fileQuery;
      setFiles(fileData || []);
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  // Navigate into folder
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

  // Create folder
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

  // Upload file
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFiles = e.target.files;
    if (!uploadFiles || uploadFiles.length === 0) return;

    for (const file of Array.from(uploadFiles)) {
      try {
        const storagePath = `${userId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, file);
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
      } catch {
        toast.error(`Failed to upload: ${file.name}`);
      }
    }
    fetchContents();
    e.target.value = '';
  };

  // Download file
  const handleDownload = async (file: FileRecord) => {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(file.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      await logAction('download', 'file', file.id, { name: file.name });
    } catch {
      toast.error('Failed to download file');
    }
  };

  // Delete (soft)
  const handleDelete = async (id: string, type: 'file' | 'folder', name: string) => {
    try {
      const table = type === 'file' ? TABLES.files : TABLES.folders;
      const { error } = await supabase
        .from(table)
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success(`Deleted: ${name}`);
      await logAction('delete', type, id, { name });
      fetchContents();
    } catch {
      toast.error('Failed to delete');
    }
  };

  // Rename
  const handleRename = async () => {
    if (!renameTarget || !renameTarget.name.trim()) return;
    try {
      const table = renameTarget.type === 'file' ? TABLES.files : TABLES.folders;
      const { error } = await supabase
        .from(table)
        .update({ name: renameTarget.name.trim() })
        .eq('id', renameTarget.id);
      if (error) throw error;
      toast.success('Renamed successfully');
      setRenameOpen(false);
      setRenameTarget(null);
      fetchContents();
    } catch {
      toast.error('Failed to rename');
    }
  };

  // Share
  const openShareDialog = async (id: string, name: string, type: 'file' | 'folder') => {
    setShareTarget({ id, name, type });
    setShareEmail('');
    setSharePermission('view');
    setShareOpen(true);

    // Load existing shares
    const { data } = await supabase
      .from(TABLES.sharing)
      .select('*')
      .eq('resource_type', type)
      .eq('resource_id', id);

    if (data && data.length > 0) {
      const userIds = data.map(s => s.shared_with);
      const { data: profiles } = await supabase
        .from(TABLES.profiles)
        .select('*')
        .in('id', userIds);

      const sharesWithProfiles = data.map(s => ({
        ...s,
        profile: profiles?.find(p => p.id === s.shared_with),
      }));
      setExistingShares(sharesWithProfiles);
    } else {
      setExistingShares([]);
    }
  };

  const handleShare = async () => {
    if (!shareTarget || !shareEmail.trim()) return;
    try {
      // Find user by email - look up in auth via profiles
      const { data: profiles } = await supabase
        .from(TABLES.profiles)
        .select('id, full_name')
        .limit(100);

      // We need to find the user - since we can't query auth.users directly,
      // we'll use the profile's full_name or try matching
      // For simplicity, we search profiles and match
      if (!profiles || profiles.length === 0) {
        toast.error('No users found to share with');
        return;
      }

      // Try to find user - in a real app we'd have email in profiles
      // For now, share with the first matching profile that isn't the current user
      const targetProfile = profiles.find(p =>
        p.full_name?.toLowerCase().includes(shareEmail.toLowerCase()) ||
        p.id !== userId
      );

      if (!targetProfile) {
        toast.error('User not found');
        return;
      }

      const { error } = await supabase.from(TABLES.sharing).upsert({
        resource_type: shareTarget.type,
        resource_id: shareTarget.id,
        shared_by: userId,
        shared_with: targetProfile.id,
        permission: sharePermission,
      }, { onConflict: 'resource_type,resource_id,shared_with' });

      if (error) throw error;
      toast.success(`Shared with ${targetProfile.full_name || 'user'}`);
      await logAction('share', shareTarget.type, shareTarget.id, {
        shared_with: targetProfile.id,
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
      setExistingShares(prev => prev.filter(s => s.id !== shareId));
      toast.success('Share revoked');
    } catch {
      toast.error('Failed to revoke share');
    }
  };

  // Audit log helper
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
      // Silent fail for audit logs
    }
  };

  // Filter by search
  const filteredFolders = folders.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isOwnerOrAdmin = (ownerId: string) => ownerId === userId || userRole === 'super_admin';

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b bg-white px-6 py-3 flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={goBack} disabled={breadcrumbs.length <= 1}>
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm flex-1 min-w-0 overflow-x-auto">
          {breadcrumbs.map((crumb, i) => (
            <div key={crumb.id ?? 'root'} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight className="w-3 h-3 text-gray-400" />}
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className={`hover:text-blue-600 ${i === breadcrumbs.length - 1 ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
              >
                {i === 0 ? <Home className="w-4 h-4" /> : crumb.name}
              </button>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-r-none"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-l-none"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>

        {/* Actions */}
        <Button size="sm" variant="outline" onClick={() => setNewFolderOpen(true)}>
          <FolderPlus className="w-4 h-4 mr-2" /> New Folder
        </Button>
        <Button size="sm" className="relative">
          <Upload className="w-4 h-4 mr-2" /> Upload
          <input
            type="file"
            multiple
            onChange={handleUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <img
              src="https://mgx-backend-cdn.metadl.com/generate/images/868948/2026-04-12/14f85d25-933a-4481-8078-61d6ffd6b006.png"
              alt="Empty"
              className="w-32 h-32 mb-4 opacity-60"
            />
            <p className="text-lg font-medium">No files or folders here</p>
            <p className="text-sm">Create a folder or upload files to get started</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredFolders.map(folder => (
              <div
                key={folder.id}
                className="group relative bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onDoubleClick={() => navigateToFolder(folder)}
              >
                <div className="flex flex-col items-center gap-2">
                  <FolderIcon className="w-12 h-12 text-blue-400" />
                  <span className="text-sm font-medium text-center truncate w-full">{folder.name}</span>
                </div>
                {isOwnerOrAdmin(folder.owner_id) && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => navigateToFolder(folder)}>
                          <FolderIcon className="w-4 h-4 mr-2" /> Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setRenameTarget({ id: folder.id, name: folder.name, type: 'folder' }); setRenameOpen(true); }}>
                          <Edit className="w-4 h-4 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openShareDialog(folder.id, folder.name, 'folder')}>
                          <Share2 className="w-4 h-4 mr-2" /> Share
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(folder.id, 'folder', folder.name)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            ))}
            {filteredFiles.map(file => (
              <div
                key={file.id}
                className="group relative bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onDoubleClick={() => handleDownload(file)}
              >
                <div className="flex flex-col items-center gap-2">
                  {getFileIcon(file.mime_type)}
                  <span className="text-sm font-medium text-center truncate w-full">{file.name}</span>
                  <span className="text-xs text-gray-400">{formatSize(file.size_bytes)}</span>
                </div>
                {isOwnerOrAdmin(file.owner_id) && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleDownload(file)}>
                          <Download className="w-4 h-4 mr-2" /> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setRenameTarget({ id: file.id, name: file.name, type: 'file' }); setRenameOpen(true); }}>
                          <Edit className="w-4 h-4 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openShareDialog(file.id, file.name, 'file')}>
                          <Share2 className="w-4 h-4 mr-2" /> Share
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(file.id, 'file', file.name)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* List view */
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Modified</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredFolders.map(folder => (
                  <tr
                    key={folder.id}
                    className="hover:bg-gray-50 cursor-pointer group"
                    onDoubleClick={() => navigateToFolder(folder)}
                  >
                    <td className="px-4 py-3 flex items-center gap-3">
                      <FolderIcon className="w-5 h-5 text-blue-400 shrink-0" />
                      <span className="font-medium truncate">{folder.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">—</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(folder.updated_at)}</td>
                    <td className="px-4 py-3">
                      {isOwnerOrAdmin(folder.owner_id) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => { setRenameTarget({ id: folder.id, name: folder.name, type: 'folder' }); setRenameOpen(true); }}>
                              <Edit className="w-4 h-4 mr-2" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openShareDialog(folder.id, folder.name, 'folder')}>
                              <Share2 className="w-4 h-4 mr-2" /> Share
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(folder.id, 'folder', folder.name)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredFiles.map(file => (
                  <tr
                    key={file.id}
                    className="hover:bg-gray-50 cursor-pointer group"
                    onDoubleClick={() => handleDownload(file)}
                  >
                    <td className="px-4 py-3 flex items-center gap-3">
                      <div className="shrink-0">{getFileIcon(file.mime_type)}</div>
                      <span className="font-medium truncate">{file.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatSize(file.size_bytes)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(file.updated_at)}</td>
                    <td className="px-4 py-3">
                      {isOwnerOrAdmin(file.owner_id) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleDownload(file)}>
                              <Download className="w-4 h-4 mr-2" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setRenameTarget({ id: file.id, name: file.name, type: 'file' }); setRenameOpen(true); }}>
                              <Edit className="w-4 h-4 mr-2" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openShareDialog(file.id, file.name, 'file')}>
                              <Share2 className="w-4 h-4 mr-2" /> Share
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(file.id, 'file', file.name)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
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

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renameTarget?.type}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTarget?.name || ''}
            onChange={(e) => setRenameTarget(prev => prev ? { ...prev, name: e.target.value } : null)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share &quot;{shareTarget?.name}&quot;</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="User name or email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={sharePermission} onValueChange={(v: 'view' | 'edit') => setSharePermission(v)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleShare} className="w-full">Share</Button>

            {existingShares.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Shared with:</p>
                {existingShares.map(share => (
                  <div key={share.id} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{share.profile?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 capitalize">{share.permission}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRevokeShare(share.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}