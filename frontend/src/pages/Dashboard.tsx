import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import FileManager from '../components/FileManager';
import AdminPanel from '../components/AdminPanel';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { toast } from 'sonner';
import {
  FolderOpen, Users, Shield, LogOut, ChevronDown,
  HardDrive, Share2,
} from 'lucide-react';

type SidebarTab = 'my-files' | 'shared' | 'admin';

export default function Dashboard() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarSrc, setAvatarSrc] = useState('');
  const [activeTab, setActiveTab] = useState<SidebarTab>('my-files');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUserId(user.id);

      const { data: profileData } = await supabase
        .from(TABLES.profiles)
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        const { data: activeFolders } = await supabase
          .from(TABLES.folders)
          .select('id')
          .eq('owner_id', user.id)
          .eq('is_deleted', false);

        const activeFolderIds = new Set((activeFolders || []).map(folder => folder.id));

        const { data: userFiles } = await supabase
          .from(TABLES.files)
          .select('size_bytes,folder_id')
          .eq('owner_id', user.id)
          .eq('is_deleted', false);

        const visibleFiles = (userFiles || []).filter(file => !file.folder_id || activeFolderIds.has(file.folder_id));
        const usedBytes = visibleFiles.reduce((sum, file) => sum + Number(file.size_bytes || 0), 0);
        const usedGb = usedBytes / (1024 * 1024 * 1024);

        await supabase
          .from(TABLES.profiles)
          .update({ storage_used_gb: usedGb })
          .eq('id', user.id);

        setProfile({
          ...profileData,
          storage_used_gb: usedGb,
        });

        if (profileData.avatar_url) {
          if (profileData.avatar_url.startsWith('http')) {
            setAvatarSrc(profileData.avatar_url);
          } else {
            const { data } = await supabase.storage
              .from('private_files')
              .createSignedUrl(profileData.avatar_url, 60 * 60);
            setAvatarSrc(data?.signedUrl || '');
          }
        } else {
          setAvatarSrc('');
        }
      }
      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const usedStorageGb = Number(profile?.storage_used_gb || 0);
  const totalStorageGb = Number(profile?.storage_quota_gb || 0);
  const remainingStorageGb = Math.max(totalStorageGb - usedStorageGb, 0);
  const storageUsagePercent = totalStorageGb > 0 ? Math.min((usedStorageGb / totalStorageGb) * 100, 100) : 0;
  const storageUsageLabel = `${storageUsagePercent < 0.01 ? '0' : storageUsagePercent.toFixed(0)}% used`;
  const formatStorageGb = (value: number) => (value > 0 && value < 1 ? value.toFixed(4) : value.toFixed(2));

  const handleStorageUsageChange = (nextUsedGb: number) => {
    setProfile(prev => prev ? { ...prev, storage_used_gb: nextUsedGb } : prev);
  };

  const sidebarItems: { id: SidebarTab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: 'my-files', label: 'My Files', icon: FolderOpen },
    { id: 'shared', label: 'Shared with Me', icon: Share2 },
    { id: 'admin', label: 'Admin Panel', icon: Shield, adminOnly: true },
  ];
  const activeTabLabel = sidebarItems.find(item => item.id === activeTab)?.label || 'Menu';

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-gray-50">
        <Sidebar collapsible="icon" className="border-r border-gray-200 bg-white">
          <SidebarHeader className="gap-3 border-b border-gray-200 px-4 py-4">
            <div className="flex items-center gap-3">
              <img
                src="/EGCTU.png"
                alt="Logo"
                className="h-12 group-data-[collapsible=icon]:hidden"
              />
              <span className="font-bold text-lg text-gray-900 group-data-[collapsible=icon]:hidden">FileVault</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 group-data-[collapsible=icon]:hidden">Navigation</span>
              <SidebarTrigger className="text-gray-500 hover:bg-blue-50 hover:text-blue-700" />
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-3">
            <SidebarMenu className="gap-1">
              {sidebarItems.map(item => {
                if (item.adminOnly && profile?.role === 'user') return null;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={activeTab === item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={activeTab === item.id
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-700 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center'
                      }
                    >
                      <Icon className="h-5 w-5" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarSeparator />

          <SidebarFooter className="gap-4 px-4 py-4 group-data-[collapsible=icon]:px-2">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  <span className="group-data-[collapsible=icon]:hidden">Storage</span>
                </div>
                <span className="text-xs font-medium text-gray-500 group-data-[collapsible=icon]:hidden">{storageUsageLabel}</span>
              </div>
              <Progress value={storageUsagePercent} className="h-2 bg-blue-50" indicatorClassName="bg-blue-700" />
              <p className="mt-1 text-xs text-gray-400 group-data-[collapsible=icon]:hidden">
                {formatStorageGb(usedStorageGb)} GB used of {formatStorageGb(totalStorageGb)} GB
              </p>
              <p className="text-xs text-gray-400 group-data-[collapsible=icon]:hidden">{formatStorageGb(remainingStorageGb)} GB remaining</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
                  <Avatar className="h-8 w-8 group-data-[collapsible=icon]:hidden">
                    <AvatarImage src={avatarSrc || undefined} alt={profile?.full_name || 'Avatar'} />
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-medium">{profile?.full_name || 'User'}</p>
                    <p className="text-xs capitalize text-gray-400">{profile?.role || 'user'}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => navigate('/profile')}>
                  <Users className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col min-w-0">
          <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-4 py-2 backdrop-blur md:hidden">
            <SidebarTrigger className="text-gray-600 hover:bg-blue-50 hover:text-blue-700" />
            <span className="text-sm font-semibold text-gray-900">{activeTabLabel}</span>
          </div>
          {activeTab === 'my-files' && (
            <FileManager
              userId={userId}
              userRole={profile?.role || 'user'}
              profile={profile}
              onStorageUsageChange={handleStorageUsageChange}
            />
          )}
          {activeTab === 'shared' && (
            <SharedWithMeContent userId={userId} />
          )}
          {activeTab === 'admin' && profile?.role !== 'user' && (
            <AdminPanel viewerRole={profile?.role || 'user'} />
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

// Shared with me content (inline)
function SharedWithMeContent({ userId }: { userId: string }) {
  const [shares, setShares] = useState<Array<{
    id: string;
    resource_type: string;
    resource_id: string;
    permission: string;
    shared_by: string;
    created_at: string;
    resource_name?: string;
    sharer_name?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShares = async () => {
      const { data } = await supabase
        .from(TABLES.sharing)
        .select('*')
        .eq('shared_with', userId);

      if (data) {
        const enriched = await Promise.all(data.map(async (share) => {
          let resourceName = 'Unknown';
          if (share.resource_type === 'file') {
            const { data: file } = await supabase.from(TABLES.files).select('name').eq('id', share.resource_id).single();
            resourceName = file?.name || 'Unknown File';
          } else {
            const { data: folder } = await supabase.from(TABLES.folders).select('name').eq('id', share.resource_id).single();
            resourceName = folder?.name || 'Unknown Folder';
          }
          const { data: profile } = await supabase.from(TABLES.profiles).select('full_name').eq('id', share.shared_by).single();
          return { ...share, resource_name: resourceName, sharer_name: profile?.full_name || 'Unknown' };
        }));
        setShares(enriched);
      }
      setLoading(false);
    };
    fetchShares();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Shared with Me</h2>
      {shares.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Share2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Nothing shared yet</p>
          <p className="text-sm">Files and folders shared with you will appear here</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Shared By</th>
                <th className="px-4 py-3">Permission</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shares.map(share => (
                <tr key={share.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 flex items-center gap-3">
                    {share.resource_type === 'folder' ? (
                      <FolderOpen className="w-5 h-5 text-blue-400" />
                    ) : (
                      <FolderOpen className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="font-medium">{share.resource_name}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 capitalize">{share.resource_type}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{share.sharer_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      share.permission === 'edit' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {share.permission}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(share.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}