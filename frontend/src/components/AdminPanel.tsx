import { useEffect, useMemo, useState } from 'react';
import { supabase, TABLES } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { toast } from 'sonner';
import { Plus, Shield, Users, Loader2 } from 'lucide-react';

type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  user_name?: string;
};

type StorageState = {
  total_storage_gb: number;
  allocated_storage_gb: number;
  available_storage_gb: number;
};

type CreateUserForm = {
  full_name: string;
  email: string;
  password: string;
  storage_quota_gb: string;
};

type PageItem = number | 'ellipsis';

const USERS_PER_PAGE = 6;
const LOGS_PER_PAGE = 10;

const buildPageItems = (currentPage: number, totalPages: number): PageItem[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);

  if (currentPage > 1) pages.add(currentPage - 1);
  if (currentPage < totalPages) pages.add(currentPage + 1);
  if (currentPage > 2) pages.add(currentPage - 2);
  if (currentPage < totalPages - 1) pages.add(currentPage + 2);

  const sortedPages = Array.from(pages)
    .filter(page => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);

  const items: PageItem[] = [];
  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];
    if (previousPage && page - previousPage > 1) {
      items.push('ellipsis');
    }
    items.push(page);
  });

  return items;
};

export default function AdminPanel({ viewerRole }: { viewerRole: Profile['role'] }) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  const [createOpen, setCreateOpen] = useState(false);
  const [storage, setStorage] = useState<StorageState>({
    total_storage_gb: 0,
    allocated_storage_gb: 0,
    available_storage_gb: 0,
  });
  const [totalStorageDraft, setTotalStorageDraft] = useState('');
  const [isEditingTotalStorage, setIsEditingTotalStorage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingTotalStorage, setSavingTotalStorage] = useState(false);
  const [quotaDrafts, setQuotaDrafts] = useState<Record<string, string>>({});
  const [userPage, setUserPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [form, setForm] = useState<CreateUserForm>({
    full_name: '',
    email: '',
    password: '',
    storage_quota_gb: '',
  });

  const canEditRoles = viewerRole === 'super_admin';
  const canViewAllUsers = viewerRole === 'super_admin';
  const canEditTotalStorage = viewerRole === 'super_admin';

  const filteredUsers = useMemo(() => {
    if (canViewAllUsers) return users;
    return users.filter(user => user.role === 'user');
  }, [canViewAllUsers, users]);

  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const logTotalPages = Math.max(1, Math.ceil(logs.length / LOGS_PER_PAGE));

  const pagedUsers = useMemo(() => {
    const startIndex = (userPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);
  }, [filteredUsers, userPage]);

  const pagedLogs = useMemo(() => {
    const startIndex = (logPage - 1) * LOGS_PER_PAGE;
    return logs.slice(startIndex, startIndex + LOGS_PER_PAGE);
  }, [logPage, logs]);

  useEffect(() => {
    setUserPage(currentPage => Math.min(currentPage, userTotalPages));
  }, [userTotalPages]);

  useEffect(() => {
    setLogPage(currentPage => Math.min(currentPage, logTotalPages));
  }, [logTotalPages]);

  const invokeManageUser = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Session expired. Please sign in again.');
    }

    return supabase.functions.invoke('manage-user', {
      body,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  };

  const loadStorage = async (profileRows: Profile[]) => {
    const { data, error } = await supabase
      .from(TABLES.storage_settings)
      .select('total_storage_gb')
      .eq('id', 1)
      .single();

    if (error) throw error;

    const totalStorageGb = Number(data?.total_storage_gb ?? 0);
    const allocatedStorageGb = profileRows.reduce((sum, row) => sum + Number(row.storage_quota_gb ?? 0), 0);
    const availableStorageGb = Math.max(totalStorageGb - allocatedStorageGb, 0);
    const nextStorage = {
      total_storage_gb: totalStorageGb,
      allocated_storage_gb: allocatedStorageGb,
      available_storage_gb: availableStorageGb,
    };

    setStorage(nextStorage);
    setTotalStorageDraft(String(totalStorageGb));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: profileRows }, { data: auditRows }] = await Promise.all([
        supabase.from('app_33d3cacbc5_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('app_33d3cacbc5_audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
      ]);

      const nextUsers = (profileRows || []) as Profile[];
      setUsers(nextUsers);
      setUserPage(1);

      const logsWithNames = await Promise.all((auditRows || []).map(async (row) => {
        if (!row.user_id) return row as AuditLogRow;
        const { data: profile } = await supabase
          .from('app_33d3cacbc5_profiles')
          .select('full_name')
          .eq('id', row.user_id)
          .single();
        return {
          ...(row as AuditLogRow),
          user_name: profile?.full_name || 'Unknown',
        };
      }));

      setLogs(logsWithNames);
      setLogPage(1);
      await loadStorage(nextUsers);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const remainingForUser = (user: Profile) => Math.max(Number(user.storage_quota_gb || 0) - Number(user.storage_used_gb || 0), 0);

  const handleRoleChange = async (userId: string, newRole: Profile['role']) => {
    if (!canEditRoles) return;
    const { error } = await supabase.from('app_33d3cacbc5_profiles').update({ role: newRole }).eq('id', userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Role updated');
    setUsers(prev => prev.map(user => user.id === userId ? { ...user, role: newRole } : user));
  };

  const handleStatusChange = async (userId: string, newStatus: Profile['status']) => {
    const { error } = await supabase.from('app_33d3cacbc5_profiles').update({ status: newStatus }).eq('id', userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Status updated');
    setUsers(prev => prev.map(user => user.id === userId ? { ...user, status: newStatus } : user));
  };

  const handleQuotaSave = async (userId: string) => {
    const value = Number(quotaDrafts[userId]);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Enter a valid quota in GB');
      return;
    }

    const { data, error } = await invokeManageUser({ action: 'update-quota', user_id: userId, storage_quota_gb: value });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data) {
      setStorage(prev => ({
        ...prev,
        available_storage_gb: Number((data as { available_storage_gb?: number }).available_storage_gb ?? prev.available_storage_gb),
      }));
    }

    toast.success('Storage quota updated');
    setUsers(prev => prev.map(user => user.id === userId ? { ...user, storage_quota_gb: value } : user));
  };

  const handleTotalStorageSave = async () => {
    if (!canEditTotalStorage) return;

    const value = Number(totalStorageDraft);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Enter a valid total storage amount in GB');
      return;
    }

    setSavingTotalStorage(true);
    try {
      const { error } = await supabase
        .from(TABLES.storage_settings)
        .upsert({ id: 1, total_storage_gb: value, updated_at: new Date().toISOString() });

      if (error) throw error;

      setStorage(prev => ({
        ...prev,
        total_storage_gb: value,
        available_storage_gb: Math.max(value - prev.allocated_storage_gb, 0),
      }));
      setTotalStorageDraft(String(value));
      setIsEditingTotalStorage(false);

      toast.success('Total storage updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update total storage');
    } finally {
      setSavingTotalStorage(false);
    }
  };

  const handleCreateUser = async () => {
    setSubmitting(true);
    try {
      const quota = Number(form.storage_quota_gb);
      if (!form.full_name.trim() || !form.email.trim() || !form.password.trim() || !Number.isFinite(quota)) {
        toast.error('Fill in all fields');
        return;
      }

      const { data, error } = await invokeManageUser({
        action: 'create-user',
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        storage_quota_gb: quota,
      });

      if (error) throw error;
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error: string }).error);
      }

      toast.success('User created');
      setCreateOpen(false);
      setForm({ full_name: '', email: '', password: '', storage_quota_gb: '' });
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-2rem)] p-6 space-y-6 flex flex-col">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
          <p className="text-sm text-gray-500">Manage users, quotas, and audit logs.</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          variant="outline"
          className="relative gap-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-700"
        >
          <Plus className="h-4 w-4" /> Create user
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm text-gray-500">Total storage</p>
            <p className="text-2xl font-bold">{storage.total_storage_gb.toFixed(2)} GB</p>
            {canEditTotalStorage ? (
              isEditingTotalStorage ? (
                <div className="space-y-2">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={totalStorageDraft}
                    onChange={(event) => setTotalStorageDraft(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleTotalStorageSave} disabled={savingTotalStorage}>
                      {savingTotalStorage ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTotalStorageDraft(String(storage.total_storage_gb));
                        setIsEditingTotalStorage(false);
                      }}
                      disabled={savingTotalStorage}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setIsEditingTotalStorage(true)}>
                  Change total storage
                </Button>
              )
            ) : (
              <p className="text-xs text-gray-500">Only super admins can change this value.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Allocated</p>
            <p className="text-2xl font-bold">{storage.allocated_storage_gb.toFixed(2)} GB</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Available</p>
            <p className="text-2xl font-bold">{storage.available_storage_gb.toFixed(2)} GB</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setActiveTab('users')}
          className={`relative gap-2 ${
            activeTab === 'users'
              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-700'
              : ''
          }`}
        >
          <Users className="h-4 w-4" /> Users
        </Button>
        <Button
          variant="outline"
          onClick={() => setActiveTab('logs')}
          className={`relative gap-2 ${
            activeTab === 'logs'
              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-700'
              : ''
          }`}
        >
          <Shield className="h-4 w-4" /> Audit logs
        </Button>
      </div>

      {activeTab === 'users' ? (
        <div className="flex flex-1 flex-col gap-4">
          <div className="overflow-x-auto rounded-xl border bg-white flex-1 sm:overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Storage</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagedUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                            {user.full_name?.split(' ').map(name => name[0]).join('').toUpperCase().slice(0, 2) || '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {canEditRoles ? (
                        <Select value={user.role} onValueChange={(value) => handleRoleChange(user.id, value as Profile['role'])}>
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Select value={user.status} onValueChange={(value) => handleStatusChange(user.id, value as Profile['status'])}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={quotaDrafts[user.id] ?? String(user.storage_quota_gb ?? 0)}
                          onChange={(event) => setQuotaDrafts(prev => ({ ...prev, [user.id]: event.target.value }))}
                          className="w-28"
                        />
                        <div className="text-xs text-gray-500">
                          <p>Allocated: {Number(user.storage_quota_gb || 0).toFixed(2)} GB</p>
                          <p>Used: {Number(user.storage_used_gb || 0).toFixed(2)} GB</p>
                          <p>Remaining: {remainingForUser(user).toFixed(2)} GB</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => handleQuotaSave(user.id)}>Save</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pagedUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {userTotalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setUserPage(currentPage => Math.max(currentPage - 1, 1));
                    }}
                    className={userPage === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {buildPageItems(userPage, userTotalPages).map((pageItem, index) => (
                  <PaginationItem key={`${pageItem}-${index}`}>
                    {pageItem === 'ellipsis' ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href="#"
                        isActive={pageItem === userPage}
                        onClick={(event) => {
                          event.preventDefault();
                          setUserPage(pageItem);
                        }}
                      >
                        {pageItem}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setUserPage(currentPage => Math.min(currentPage + 1, userTotalPages));
                    }}
                    className={userPage === userTotalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}

        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <div className="overflow-x-auto rounded-xl border bg-white flex-1 sm:overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{log.user_name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm"><Badge variant="secondary">{log.action}</Badge></td>
                    <td className="px-4 py-3 text-sm text-gray-500 capitalize">{log.resource_type || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{JSON.stringify(log.details)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {pagedLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400">No audit logs yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {logTotalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setLogPage(currentPage => Math.max(currentPage - 1, 1));
                    }}
                    className={logPage === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {buildPageItems(logPage, logTotalPages).map((pageItem, index) => (
                  <PaginationItem key={`${pageItem}-${index}`}>
                    {pageItem === 'ellipsis' ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href="#"
                        isActive={pageItem === logPage}
                        onClick={(event) => {
                          event.preventDefault();
                          setLogPage(pageItem);
                        }}
                      >
                        {pageItem}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setLogPage(currentPage => Math.min(currentPage + 1, logTotalPages));
                    }}
                    className={logPage === logTotalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}

        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>
              Admin-created accounts are created as regular users with a GB quota.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" value={form.full_name} onChange={(event) => setForm(prev => ({ ...prev, full_name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(event) => setForm(prev => ({ ...prev, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(event) => setForm(prev => ({ ...prev, password: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storage_quota_gb">Storage quota (GB)</Label>
              <Input
                id="storage_quota_gb"
                type="number"
                min="0"
                step="0.01"
                max={storage.available_storage_gb}
                value={form.storage_quota_gb}
                onChange={(event) => setForm(prev => ({ ...prev, storage_quota_gb: event.target.value }))}
              />
              <p className="text-xs text-gray-500">Available: {storage.available_storage_gb.toFixed(2)} GB</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}