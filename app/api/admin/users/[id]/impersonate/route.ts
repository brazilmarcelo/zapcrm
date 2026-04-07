import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

type Params = { params: Promise<{ id: string }> };

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function POST(req: Request, ctx: Params) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: me, error: meError } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single();

  if (meError || !me?.organization_id) return json({ error: 'Profile not found' }, 404);
  if (me.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const { id } = await ctx.params;
  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id, email, organization_id, status')
    .eq('id', id)
    .maybeSingle();

  if (targetError) return json({ error: targetError.message }, 500);
  if (!target?.email) return json({ error: 'User not found' }, 404);
  if (target.organization_id !== me.organization_id) return json({ error: 'Forbidden' }, 403);
  if (target.status === 'paused') return json({ error: 'Não é possível impersonar um usuário pausado' }, 400);

  const admin = createStaticAdminClient();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get('origin') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  const generateLink = (admin.auth.admin as any).generateLink;
  if (typeof generateLink !== 'function') {
    return json({ error: 'Impersonation not supported by current Supabase client' }, 501);
  }

  const { data, error } = await generateLink({
    type: 'magiclink',
    email: target.email,
    options: {
      redirectTo: `${appUrl.replace(/\/+$/, '')}/dashboard?impersonated=${target.id}`,
    },
  });

  const actionLink = data?.properties?.action_link || data?.action_link || null;
  if (error || !actionLink) {
    return json({ error: error?.message || 'Falha ao criar link de impersonação' }, 500);
  }

  const { error: impersonationLogError } = await admin.from('admin_impersonation_logs').insert({
    organization_id: me.organization_id,
    admin_user_id: user.id,
    target_user_id: target.id,
    target_email: target.email,
    metadata: {
      redirect_to: `${appUrl.replace(/\/+$/, '')}/dashboard?impersonated=${target.id}`,
    },
  });

  if (impersonationLogError) {
    console.error('[admin/users impersonate] insert log failed', impersonationLogError);
  }

  const { error: auditError } = await supabase.rpc('log_audit_event', {
    p_action: 'USER_IMPERSONATION_REQUESTED',
    p_resource_type: 'profile',
    p_resource_id: target.id,
    p_details: { target_email: target.email },
    p_severity: 'warning',
  });

  if (auditError) {
    console.error('[admin/users impersonate] audit log failed', auditError);
  }

  return json({ url: actionLink });
}
