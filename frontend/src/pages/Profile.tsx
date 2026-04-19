import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, STORAGE_BUCKET, TABLES } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Camera, Loader2 } from 'lucide-react';

type AvatarSource = {
  path: string;
  signedUrl: string;
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarSource, setAvatarSource] = useState<AvatarSource | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      setUserId(user.id);
      setEmail(user.email || '');
      setAuthEmail(user.email || '');

      const { data: profileData } = await supabase
        .from(TABLES.profiles)
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFullName(profileData.full_name || '');
        setAvatarUrlInput(profileData.avatar_url || '');
        if (profileData.avatar_url) {
          if (profileData.avatar_url.startsWith('http')) {
            setAvatarSource({ path: profileData.avatar_url, signedUrl: profileData.avatar_url });
          } else {
            const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(profileData.avatar_url, 60 * 60);
            if (data?.signedUrl) {
              setAvatarSource({ path: profileData.avatar_url, signedUrl: data.signedUrl });
            }
          }
        }
      }

      setLoading(false);
    };

    init();
  }, [navigate]);

  const initials = useMemo(() => {
    return (fullName || profile?.full_name || 'User')
      .split(' ')
      .filter(Boolean)
      .map(name => name[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [fullName, profile?.full_name]);

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setAvatarFile(file);
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return avatarUrlInput.trim() || profile?.avatar_url || null;

    const extension = avatarFile.name.split('.').pop() || 'png';
    const storagePath = `${userId}/avatar-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, avatarFile, {
      upsert: true,
    });

    if (error) throw error;
    return storagePath;
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const avatarPath = await uploadAvatar();

      const { error: profileError } = await supabase
        .from(TABLES.profiles)
        .update({
          full_name: fullName.trim(),
          avatar_url: avatarPath,
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      if (newPassword.trim()) {
        if (!currentPassword.trim()) {
          toast.error('Enter your current password first');
          setSaving(false);
          return;
        }

        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: currentPassword,
        });

        if (reauthError) throw reauthError;

        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
        if (passwordError) throw passwordError;
      }

      if (email.trim() !== authEmail.trim()) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailError) throw emailError;
        setAuthEmail(email.trim());
      }

      if (avatarPath) {
        if (avatarPath.startsWith('http')) {
          setAvatarSource({ path: avatarPath, signedUrl: avatarPath });
        } else {
          const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(avatarPath, 60 * 60);
          if (data?.signedUrl) {
            setAvatarSource({ path: avatarPath, signedUrl: data.signedUrl });
          }
        }
      }

      toast.success('Profile updated');
      setCurrentPassword('');
      setNewPassword('');
      setAvatarFile(null);
      setProfile(prev => prev ? { ...prev, full_name: fullName.trim(), avatar_url: avatarPath || prev.avatar_url } : prev);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Button>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your name, email, password, and avatar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarSource?.signedUrl || undefined} alt={fullName || 'Avatar'} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Label htmlFor="avatarFile" className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm">
                  <Camera className="h-4 w-4" /> Upload avatar
                </Label>
                <Input id="avatarFile" type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                <p className="text-xs text-muted-foreground">You can also paste an avatar URL below.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input id="avatarUrl" value={avatarUrlInput} onChange={(e) => setAvatarUrlInput(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}