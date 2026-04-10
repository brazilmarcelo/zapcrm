/**
 * Fetch WhatsApp Templates from Meta API
 * GET /api/whatsapp/templates/fetch
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const META_API_VERSION = 'v21.0';

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

  // Get Meta credentials
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('meta_business_account_id, meta_access_token_encrypted')
    .eq('organization_id', profile.organization_id)
    .single();

  if (!settings?.meta_business_account_id || !settings?.meta_access_token_encrypted) {
    return NextResponse.json({ error: 'Meta not configured' }, { status: 400 });
  }

  // Fetch templates from Meta
  const response = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${settings.meta_business_account_id}/message_templates`,
    {
      headers: {
        'Authorization': `Bearer ${settings.meta_access_token_encrypted}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error('[whatsapp-templates] Meta API error:', data);
    return NextResponse.json({ error: 'Failed to fetch templates', details: data }, { status: 400 });
  }

  const templates = data?.data || [];

  // Save approved templates to DB
  const instanceId = (await supabase
    .from('whatsapp_instances')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .limit(1)
    .single()
  ).data?.id;

  const templatesToUpsert = templates
    .filter((t: any) => t.status === 'APPROVED')
    .map((t: any) => ({
      organization_id: profile.organization_id,
      instance_id: instanceId || null,
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

  return NextResponse.json({ 
    ok: true, 
    count: templatesToUpsert.length,
    templates: templatesToUpsert.map((t: any) => ({ name: t.name, language: t.language, category: t.category }))
  });
}