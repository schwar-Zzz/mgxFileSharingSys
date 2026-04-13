import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import FileManager from '@/components/FileManager';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
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
        setProfile(profileData);
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

  const sidebarItems: { id: SidebarTab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: 'my-files', label: 'My Files', icon: FolderOpen },
    { id: 'shared', label: 'Shared with Me', icon: Share2 },
    { id: 'admin', label: 'Admin Panel', icon: Shield, adminOnly: true },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-4 border-b flex items-center gap-3">
          <img
            src="https://mgx-backend-cdn.metadl.com/generate/images/868948/2026-04-12/8d11fb1c-6440-4013-98cd-2a764426327c.png"
            alt="Logo"
            className="w-8 h-8 rounded-lg"
          />
          <span className="font-bold text-lg text-gray-900">FileVault</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map(item => {
            if (item.adminOnly && profile?.role !== 'super_admin') return null;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Storage info */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <HardDrive className="w-4 h-4" />
            <span>Storage</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '15%' }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">Using available storage</p>
        </div>

        {/* User menu */}
        <div className="p-3 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
                  <p className="text-xs text-gray-400 capitalize">{profile?.role || 'user'}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled>
                <Users className="w-4 h-4 mr-2" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeTab === 'my-files' && (
          <FileManager userId={userId} userRole={profile?.role || 'user'} />
        )}
        {activeTab === 'shared' && (
          <SharedWithMeContent userId={userId} />
        )}
        {activeTab === 'admin' && profile?.role === 'super_admin' && (
          <AdminContent />
        )}
      </main>
    </div>
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

// Admin content (inline)
function AdminContent() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<Array<{ id: string; user_id: string; action: string; resource_type: string | null; details: Record<string, unknown>; created_at: string; user_name?: string }>>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'logs'>('users');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: profilesData } = await supabase.from(TABLES.profiles).select('*').order('created_at', { ascending: false });
      setUsers(profilesData || []);

      const { data: logsData } = await supabase.from(TABLES.audit_logs).select('*').order('created_at', { ascending: false }).limit(100);
      if (logsData) {
        const enriched = await Promise.all(logsData.map(async (log) => {
          const { data: profile } = await supabase.from(TABLES.profiles).select('full_name').eq('id', log.user_id).single();
          return { ...log, user_name: profile?.full_name || 'Unknown' };
        }));
        setLogs(enriched);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase.from(TABLES.profiles).update({ role: newRole }).eq('id', userId);
    if (error) {
      toast.error('Failed to update role');
    } else {
      toast.success('Role updated');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole as Profile['role'] } : u));
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    const { error } = await supabase.from(TABLES.profiles).update({ status: newStatus }).eq('id', userId);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Status updated');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus as Profile['status'] } : u));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Panel</h2>

      <div className="flex gap-2 mb-6">
        <Button
          variant={activeAdminTab === 'users' ? 'default' : 'outline'}
          onClick={() => setActiveAdminTab('users')}
        >
          <Users className="w-4 h-4 mr-2" /> Users
        </Button>
        <Button
          variant={activeAdminTab === 'logs' ? 'default' : 'outline'}
          onClick={() => setActiveAdminTab('logs')}
        >
          <Shield className="w-4 h-4 mr-2" /> Audit Logs
        </Button>
      </div>

      {activeAdminTab === 'users' ? (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                          {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.full_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.status}
                      onChange={(e) => handleStatusChange(user.id, e.target.value)}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="pending">Pending</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      user.status === 'active' ? 'bg-green-100 text-green-700' :
                      user.status === 'suspended' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{log.user_name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded-full font-medium">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 capitalize">{log.resource_type || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    {JSON.stringify(log.details)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No audit logs yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}