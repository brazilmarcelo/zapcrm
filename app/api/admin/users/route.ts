import { z } from 'zod';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

type AdminContext =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; organizationId: string; userId: string }
  | { ok: false; response: Response };

const CreateUserSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    password: z.string().min(6).max(200),
    role: z.enum(['admin', 'vendedor']).default('vendedor'),
  })
  .strict();

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, response: json({ error: 'Unauthorized' }, 401) };

  const { data: me, error } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single();

  if (error || !me?.organization_id) {
    return { ok: false, response: json({ error: 'Profile not found' }, 404) };
  }

  if (me.role !== 'admin') {
    return { ok: false, response: json({ error: 'Forbidden' }, 403) };
  }

  return {
    ok: true,
    supabase,
    organizationId: me.organization_id,
    userId: user.id,
  };
}

async function getAuthUsersById(ids: string[]) {
  const admin = createStaticAdminClient();
  const remaining = new Set(ids);
  const map = new Map<string, any>();

  let page = 1;
  const perPage = 200;

  while (remaining.size > 0 && page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;

    const users = data?.users || [];
    for (const authUser of users) {
      if (remaining.has(authUser.id)) {
        map.set(authUser.id, authUser);
        remaining.delete(authUser.id);
      }
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return map;
}

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx.ok) return ctx.response;

  const { data: profiles, error } = await ctx.supabase
    .from('profiles')
    .select('id, email, role, organization_id, created_at, status, paused_at, paused_reason')
    .eq('organization_id', ctx.organizationId)
    .limit(200)
    .order('created_at', { ascending: false });

  if (error) return json({ error: error.message }, 500);

  const authUsers = await getAuthUsersById((profiles || []).map((profile) => profile.id));

  const users = (profiles || []).map((profile) => {
    const authUser = authUsers.get(profile.id);
    return {
      ...profile,
      status: profile.status || 'active',
      confirmed_at: authUser?.email_confirmed_at || authUser?.confirmed_at || null,
      last_sign_in_at: authUser?.last_sign_in_at || null,
    };
  });

  return json({ users });
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const ctx = await getAdminContext();
  if (!ctx.ok) return ctx.response;

  const raw = await req.json().catch(() => null);
  const parsed = CreateUserSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const admin = createStaticAdminClient();
  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim().toLowerCase();
  const role = parsed.data.role;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      name,
      role,
      organization_id: ctx.organizationId,
    },
  });

  if (createError || !created?.user?.id) {
    return json({ error: createError?.message || 'Failed to create user' }, 400);
  }

  const userId = created.user.id;
  const firstName = name.split(' ')[0] || name;

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      name,
      first_name: firstName,
      organization_id: ctx.organizationId,
      role,
      status: 'active',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return json({ error: profileError.message }, 400);
  }

  const { error: auditError } = await ctx.supabase.rpc('log_audit_event', {
    p_action: 'USER_CREATED',
    p_resource_type: 'profile',
    p_resource_id: userId,
    p_details: { email, role },
    p_severity: 'info',
  });

  if (auditError) {
    console.error('[admin/users POST] audit log failed', auditError);
  }

  return json({
    user: {
      id: userId,
      email,
      role,
      organization_id: ctx.organizationId,
      created_at: created.user.created_at,
      status: 'active',
      confirmed_at: created.user.email_confirmed_at || null,
      last_sign_in_at: null,
    },
  }, 201);
}
