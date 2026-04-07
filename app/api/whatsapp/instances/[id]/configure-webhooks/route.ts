import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEvolutionCredentials } from '@/lib/evolution/helpers';
import * as evolution from '@/lib/evolution/client';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/whatsapp/instances/[id]/configure-webhooks
 *
 * Manually (re-)configure Evolution API webhooks for an instance.
 */
export async function POST(_request: Request, { params }: Params) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  // Get the instance
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!rawAppUrl) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL não configurada. Adicione nas variáveis de ambiente do Vercel.' },
      { status: 500 },
    );
  }

  const appUrl = rawAppUrl.replace(/\/+$/, '');
  const creds = await getEvolutionCredentials(supabase, instance);
  const baseWebhookUrl = `${appUrl}/api/whatsapp/webhook/${instance.id}`;

  try {
    await evolution.setWebhook(creds, {
      enabled: true,
      url: baseWebhookUrl,
      webhookByEvents: false,
      webhookBase64: true,
      events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED', 'SEND_MESSAGE'],
    });

    await evolution.setWebSocket(creds, {
      enabled: true,
      events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED', 'SEND_MESSAGE'],
    }).catch(err => console.error('[configure-webhooks] WebSocket config failed:', err));

    return NextResponse.json({
      ok: true,
      webhookUrl: baseWebhookUrl,
      message: 'Webhooks configurados com sucesso!',
    });
  } catch (err) {
    console.error('[configure-webhooks] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha ao configurar webhooks' },
      { status: 500 },
    );
  }
}
