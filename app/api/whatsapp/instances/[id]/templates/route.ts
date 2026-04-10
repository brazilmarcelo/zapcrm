/**
 * WhatsApp Templates API
 * GET - List templates from Meta and cache in DB
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInstance } from '@/lib/supabase/whatsapp';
import { getMetaCredentials } from '@/lib/meta/helpers';
import { createMetaClient } from '@/lib/meta/client';
import type { WhatsAppTemplate } from '@/lib/meta/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id: instanceId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const instance = await getInstance(supabase, instanceId);
  if (!instance || instance.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  console.log('[templates] Instance:', { 
    phone_number_id: instance.phone_number_id, 
    access_token_encrypted: !!instance.access_token_encrypted,
    business_account_id: instance.business_account_id 
  });

  if (!instance.phone_number_id || !instance.access_token_encrypted) {
    return NextResponse.json({ error: 'Instance not configured for Meta API' }, { status: 400 });
  }

  try {
    const creds = await getMetaCredentials(supabase, profile.organization_id, instanceId);
    console.log('[templates] Credentials:', { 
      hasAccessToken: !!creds.accessToken, 
      businessAccountId: creds.businessAccountId,
      phoneNumberId: creds.phoneNumberId
    });
    const { accessToken, businessAccountId } = creds;

    if (!businessAccountId) {
      const { data: templates } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('status', 'APPROVED')
        .order('name');
      return NextResponse.json({ data: templates ?? [] });
    }

    const metaClient = createMetaClient({
      accessToken,
      phoneNumberId: instance.phone_number_id,
      businessAccountId,
    });

    const metaTemplates = await metaClient.getTemplates(businessAccountId);

    const templatesToUpsert = metaTemplates.map(t => ({
      organization_id: profile.organization_id,
      instance_id: instanceId,
      meta_template_id: t.id,
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      content: { components: t.components },
      components: t.components,
    }));

    if (templatesToUpsert.length > 0) {
      await supabase
        .from('whatsapp_templates')
        .upsert(templatesToUpsert, { onConflict: 'organization_id,meta_template_id' });
    }

    const { data: savedTemplates } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('instance_id', instanceId)
      .eq('status', 'APPROVED')
      .order('name');

    return NextResponse.json({ data: savedTemplates ?? [] });
  } catch (err) {
    console.error('[whatsapp-templates] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}