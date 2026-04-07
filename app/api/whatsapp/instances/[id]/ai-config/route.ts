import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInstance, getAIConfig, upsertAIConfig } from '@/lib/supabase/whatsapp';

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

/** Get AI config for a WhatsApp instance */
export async function GET(_request: Request, { params }: Params) {
  const ctx = await getContext();
  if (!ctx.ok) return ctx.response;

  const { id } = await params;
  const instance = await getInstance(ctx.supabase, id);
  if (!instance || instance.organization_id !== ctx.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const config = await getAIConfig(ctx.supabase, id);
  return NextResponse.json({ data: config });
}

/** Update AI config */
export async function PUT(request: Request, { params }: Params) {
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

  const config = await upsertAIConfig(ctx.supabase, id, instance.organization_id, body);
  return NextResponse.json({ data: config });
}
