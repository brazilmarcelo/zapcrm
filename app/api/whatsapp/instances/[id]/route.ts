import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInstance, updateInstance, deleteInstance } from '@/lib/supabase/whatsapp';
import { getEvolutionCredentials, getEvolutionGlobalConfig } from '@/lib/evolution/helpers';
import * as evolution from '@/lib/evolution/client';

type Params = { params: Promise<{ id: string }> };

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (error || !profile?.organization_id) {
    return { ok: false as const, response: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) };
  }

  return {
    ok: true as const,
    supabase,
    organizationId: profile.organization_id,
    role: profile.role,
  };
}

export async function GET(_request: Request, { params }: Params) {
  const ctx = await getContext();
  if (!ctx.ok) return ctx.response;

  const { id } = await params;
  const instance = await getInstance(ctx.supabase, id);
  if (!instance || instance.organization_id !== ctx.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let liveStatus: evolution.ConnectionState | null = null;
  try {
    const creds = await getEvolutionCredentials(ctx.supabase, instance);
    liveStatus = await evolution.getConnectionState(creds);
    const state = liveStatus?.instance?.state;
    const newStatus = state === 'open' ? 'connected' : 'disconnected';
    if (newStatus !== instance.status) {
      await updateInstance(ctx.supabase, id, { status: newStatus });
      instance.status = newStatus as typeof instance.status;
    }
  } catch {
    // keep stored status
  }

  return NextResponse.json({
    data: {
      ...instance,
      liveStatus,
    },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const ctx = await getContext();
  if (!ctx.ok) return ctx.response;
  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const instance = await getInstance(ctx.supabase, id);
  if (!instance || instance.organization_id !== ctx.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const allowedFields = ['name', 'instance_id', 'instance_token', 'ai_enabled'];
  const updates: Record<string, unknown> = {};

  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  const updated = await updateInstance(ctx.supabase, id, updates);
  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getContext();
  if (!ctx.ok) return ctx.response;
  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const instance = await getInstance(ctx.supabase, id);
  if (!instance || instance.organization_id !== ctx.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const instanceName = instance.evolution_instance_name || instance.instance_id;
    if (instanceName) {
      const { baseUrl, globalApiKey } = await getEvolutionGlobalConfig(ctx.supabase, instance.organization_id);
      await evolution.deleteEvolutionInstance(baseUrl, globalApiKey, instanceName);
    }
  } catch {
    // best effort
  }

  await deleteInstance(ctx.supabase, id);
  return NextResponse.json({ ok: true });
}
