import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ManageUserRequest =
  | { action: 'available-storage' }
  | {
      action: 'update-total-storage';
      total_storage_gb: number;
    }
  | {
      action: 'create-user';
      full_name: string;
      email: string;
      password: string;
      role?: 'user';
      storage_quota_gb: number;
    }
  | {
      action: 'update-quota';
      user_id: string;
      storage_quota_gb: number;
    };

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getCurrentUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const { data, error } = await serviceClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function getRequesterProfile(userId: string) {
  const { data, error } = await serviceClient
    .from('app_33d3cacbc5_profiles')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as { id: string; role: 'user' | 'admin' | 'super_admin' };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const requesterProfile = await getRequesterProfile(currentUser.id);
    if (!requesterProfile || (requesterProfile.role !== 'admin' && requesterProfile.role !== 'super_admin')) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const body = (await request.json()) as ManageUserRequest;

    if (body.action === 'available-storage') {
      const { data: settings } = await serviceClient
        .from('app_33d3cacbc5_storage_settings')
        .select('total_storage_gb')
        .eq('id', 1)
        .single();

      const { data: allocations } = await serviceClient
        .from('app_33d3cacbc5_profiles')
        .select('storage_quota_gb')
        .gte('storage_quota_gb', 0);

      const totalStorageGb = Number(settings?.total_storage_gb ?? 0);
      const allocatedGb = (allocations ?? []).reduce((sum, row) => sum + Number(row.storage_quota_gb ?? 0), 0);
      const availableGb = Math.max(totalStorageGb - allocatedGb, 0);

      return jsonResponse({
        total_storage_gb: totalStorageGb,
        allocated_storage_gb: allocatedGb,
        available_storage_gb: availableGb,
      });
    }

    if (body.action === 'update-total-storage') {
      if (requesterProfile.role !== 'super_admin') {
        return jsonResponse({ error: 'Only super admins can update total storage' }, 403);
      }

      const totalStorageGb = Number(body.total_storage_gb);
      if (!Number.isFinite(totalStorageGb) || totalStorageGb < 0) {
        return jsonResponse({ error: 'Invalid payload' }, 400);
      }

      const { data: allocations } = await serviceClient
        .from('app_33d3cacbc5_profiles')
        .select('storage_quota_gb')
        .gte('storage_quota_gb', 0);

      const allocatedGb = (allocations ?? []).reduce((sum, row) => sum + Number(row.storage_quota_gb ?? 0), 0);
      if (totalStorageGb < allocatedGb) {
        return jsonResponse({ error: 'Total storage cannot be less than allocated storage' }, 400);
      }

      const { error: updateError } = await serviceClient
        .from('app_33d3cacbc5_storage_settings')
        .upsert({ id: 1, total_storage_gb: totalStorageGb, updated_at: new Date().toISOString() });

      if (updateError) {
        return jsonResponse({ error: updateError.message }, 400);
      }

      return jsonResponse({
        total_storage_gb: totalStorageGb,
        allocated_storage_gb: allocatedGb,
        available_storage_gb: Math.max(totalStorageGb - allocatedGb, 0),
      });
    }

    if (body.action === 'create-user') {
      const fullName = body.full_name.trim();
      const email = body.email.trim().toLowerCase();
      const password = body.password;
      const quota = Number(body.storage_quota_gb);

      if (!fullName || !email || !password || !Number.isFinite(quota) || quota < 0) {
        return jsonResponse({ error: 'Invalid payload' }, 400);
      }

      const { data: settings } = await serviceClient
        .from('app_33d3cacbc5_storage_settings')
        .select('total_storage_gb')
        .eq('id', 1)
        .single();

      const { data: allocations } = await serviceClient
        .from('app_33d3cacbc5_profiles')
        .select('storage_quota_gb')
        .gte('storage_quota_gb', 0);

      const totalStorageGb = Number(settings?.total_storage_gb ?? 0);
      const allocatedGb = (allocations ?? []).reduce((sum, row) => sum + Number(row.storage_quota_gb ?? 0), 0);
      const availableGb = Math.max(totalStorageGb - allocatedGb, 0);

      if (quota > availableGb) {
        return jsonResponse({ error: 'Requested quota exceeds available storage' }, 400);
      }

      const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createUserError || !createdUser.user) {
        return jsonResponse({ error: createUserError?.message ?? 'Failed to create user' }, 400);
      }

      const role: 'user' = 'user';

      const { error: profileError } = await serviceClient.from('app_33d3cacbc5_profiles').upsert({
        id: createdUser.user.id,
        full_name: fullName,
        role,
        status: 'active',
        avatar_url: null,
        storage_quota_gb: quota,
        storage_used_gb: 0,
      });

      if (profileError) {
        return jsonResponse({ error: profileError.message }, 400);
      }

      return jsonResponse({
        user: {
          id: createdUser.user.id,
          full_name: fullName,
          email,
          role,
          storage_quota_gb: quota,
          storage_used_gb: 0,
        },
        available_storage_gb: availableGb - quota,
      });
    }

    if (body.action === 'update-quota') {
      const targetUserId = body.user_id;
      const requestedQuota = Number(body.storage_quota_gb);

      if (!targetUserId || !Number.isFinite(requestedQuota) || requestedQuota < 0) {
        return jsonResponse({ error: 'Invalid payload' }, 400);
      }

      const { data: targetProfile, error: targetError } = await serviceClient
        .from('app_33d3cacbc5_profiles')
        .select('id, role, storage_quota_gb')
        .eq('id', targetUserId)
        .single();

      if (targetError || !targetProfile) {
        return jsonResponse({ error: 'User not found' }, 404);
      }

      if (requesterProfile.role === 'admin' && targetProfile.role !== 'user') {
        return jsonResponse({ error: 'Admins can only edit user accounts' }, 403);
      }

      const { data: settings } = await serviceClient
        .from('app_33d3cacbc5_storage_settings')
        .select('total_storage_gb')
        .eq('id', 1)
        .single();

      const { data: allocations } = await serviceClient
        .from('app_33d3cacbc5_profiles')
        .select('id, storage_quota_gb');

      const totalStorageGb = Number(settings?.total_storage_gb ?? 0);
      const currentTargetQuota = Number(targetProfile.storage_quota_gb ?? 0);
      const allocatedWithoutTarget = (allocations ?? []).reduce((sum, row) => {
        if (row.id === targetUserId) return sum;
        return sum + Number(row.storage_quota_gb ?? 0);
      }, 0);
      const availableForTarget = Math.max(totalStorageGb - allocatedWithoutTarget, 0);

      if (requestedQuota > availableForTarget) {
        return jsonResponse({ error: 'Requested quota exceeds available storage' }, 400);
      }

      const { error: updateError } = await serviceClient
        .from('app_33d3cacbc5_profiles')
        .update({ storage_quota_gb: requestedQuota })
        .eq('id', targetUserId);

      if (updateError) {
        return jsonResponse({ error: updateError.message }, 400);
      }

      return jsonResponse({
        user_id: targetUserId,
        old_quota_gb: currentTargetQuota,
        storage_quota_gb: requestedQuota,
        available_storage_gb: availableForTarget - requestedQuota,
      });
    }

    return jsonResponse({ error: 'Unsupported action' }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});