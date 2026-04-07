import { z } from 'zod';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

type Params = { params: Promise<{ id: string }> };

const UpdateUserSchema = z
  .object({
    role: z.enum(['admin', 'vendedor']).optional(),
    status: z.enum(['active', 'paused']).optional(),
    pausedReason: z.string().max(300).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: 'At least one field must be updated',
  });

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, response: json({ error: 'Unauthorized' }, 401) };

  const { data: me, error } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single();

  if (error || !me?.organization_id) {
    return { ok: false as const, response: json({ error: 'Profile not found' }, 404) };
  }

  if (me.role !== 'admin') {
    return { ok: false as const, response: json({ error: 'Forbidden' }, 403) };
  }

  return {
    ok: true as const,
    supabase,
    userId: user.id,
    organizationId: me.organization_id,
  };
}

async function countAdmins(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('role', 'admin');

  return count || 0;
}

export async function PATCH(req: Request, ctx: Params) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const adminCtx = await getAdminContext();
  if (!adminCtx.ok) return adminCtx.response;

  const { id } = await ctx.params;
  const raw = await req.json().catch(() => null);
  const parsed = UpdateUserSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const { data: target, error: targetError } = await adminCtx.supabase
    .from('profiles')
    .select('id, email, role, organization_id, status')
    .eq('id', id)
    .maybeSingle();

  if (targetError) return json({ error: targetError.message }, 500);
  if (!target) return json({ error: 'User not found' }, 404);
  if (target.organization_id !== adminCtx.organizationId) return json({ error: 'Forbidden' }, 403);

  if (id === adminCtx.userId && parsed.data.status === 'paused') {
    return json({ error: 'Você não pode pausar sua própria conta' }, 400);
  }

  if (target.role === 'admin' && parsed.data.role === 'vendedor') {
    const admins = await countAdmins(adminCtx.supabase, adminCtx.organizationId);
    if (admins <= 1) {
      return json({ error: 'Deve existir pelo menos um administrador ativo' }, 400);
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.role) updates.role = parsed.data.role;

  if (parsed.data.status) {
    updates.status = parsed.data.status;
    updates.paused_at = parsed.data.status === 'paused' ? new Date().toISOString() : null;
    updates.paused_reason = parsed.data.status === 'paused'
      ? parsed.data.pausedReason?.trim() || null
      : null;
  }

  const { data: updated, error: updateError } = await adminCtx.supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('id, email, role, organization_id, created_at, status, paused_at, paused_reason')
    .single();

  if (updateError) return json({ error: updateError.message }, 500);

  if (parsed.data.role) {
    const admin = createStaticAdminClient();
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(id, {
      user_metadata: {
        role: parsed.data.role,
        organization_id: adminCtx.organizationId,
      },
    });

    if (authUpdateError) {
      console.error('[admin/users PATCH] auth metadata update failed', authUpdateError);
    }
  }

  const { error: auditError } = await adminCtx.supabase.rpc('log_audit_event', {
    p_action: parsed.data.status === 'paused'
      ? 'USER_PAUSED'
      : parsed.data.status === 'active'
        ? 'USER_REACTIVATED'
        : 'USER_UPDATED',
    p_resource_type: 'profile',
    p_resource_id: id,
    p_details: {
      role: parsed.data.role,
      status: parsed.data.status,
      paused_reason: parsed.data.pausedReason || null,
    },
    p_severity: 'info',
  });

  if (auditError) {
    console.error('[admin/users PATCH] audit log failed', auditError);
  }

  return json({ user: updated });
}

export async function DELETE(req: Request, ctx: Params) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const adminCtx = await getAdminContext();
  if (!adminCtx.ok) return adminCtx.response;

  const { id } = await ctx.params;
  if (id === adminCtx.userId) return json({ error: 'Você não pode remover a si mesmo' }, 400);

  const { data: target, error: targetError } = await adminCtx.supabase
    .from('profiles')
    .select('id, email, role, organization_id')
    .eq('id', id)
    .maybeSingle();

  if (targetError) return json({ error: targetError.message }, 500);
  if (!target) return json({ error: 'User not found' }, 404);
  if (target.organization_id !== adminCtx.organizationId) return json({ error: 'Forbidden' }, 403);

  if (target.role === 'admin') {
    const admins = await countAdmins(adminCtx.supabase, adminCtx.organizationId);
    if (admins <= 1) {
      return json({ error: 'Deve existir pelo menos um administrador ativo' }, 400);
    }
  }

  const admin = createStaticAdminClient();
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(id);
  if (authDeleteError) return json({ error: authDeleteError.message }, 500);

  await adminCtx.supabase.from('profiles').delete().eq('id', id);

  const { error: auditError } = await adminCtx.supabase.rpc('log_audit_event', {
    p_action: 'USER_DELETED',
    p_resource_type: 'profile',
    p_resource_id: id,
    p_details: { email: target.email, role: target.role },
    p_severity: 'warning',
  });

  if (auditError) {
    console.error('[admin/users DELETE] audit log failed', auditError);
  }

  return json({ ok: true });
}
