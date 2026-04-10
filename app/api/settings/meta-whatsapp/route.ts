/**
 * Meta WhatsApp Settings API
 * GET/POST - Manage Meta Cloud API credentials
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const UpdateSettingsSchema = z.object({
  businessAccountId: z.string().optional(),
  accessToken: z.string().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: settings } = await supabase
    .from('organization_settings')
    .select('meta_business_account_id, meta_access_token_encrypted')
    .eq('organization_id', profile.organization_id)
    .single();

  return NextResponse.json({
    businessAccountId: settings?.meta_business_account_id ?? '',
    hasAccessToken: !!settings?.meta_access_token_encrypted,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { businessAccountId, accessToken } = parsed.data;

  const updates: Record<string, string> = {};
  if (businessAccountId !== undefined) {
    updates.meta_business_account_id = businessAccountId;
  }
  if (accessToken !== undefined) {
    updates.meta_access_token_encrypted = accessToken;
  }

  const { error } = await supabase
    .from('organization_settings')
    .update(updates)
    .eq('organization_id', profile.organization_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}