/**
 * WhatsApp Send Template API
 * POST - Send a template message to a conversation
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getConversation, getInstance, insertMessage, updateConversation } from '@/lib/supabase/whatsapp';
import { getMetaCredentials } from '@/lib/meta/helpers';
import { createMetaClient } from '@/lib/meta/client';

const SendTemplateSchema = z.object({
  templateName: z.string().min(1),
  language: z.string().default('pt_BR'),
  components: z.array(z.object({
    type: z.string(),
    parameters: z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
    })).optional(),
  })).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
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

  const conversation = await getConversation(supabase, id);
  if (!conversation || conversation.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const instance = await getInstance(supabase, conversation.instance_id);
  if (!instance || instance.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  if (!instance.phone_number_id || !instance.access_token_encrypted) {
    return NextResponse.json({ error: 'Instance not configured for Meta API' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = SendTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { templateName, language, components } = parsed.data;

  try {
    const { accessToken, phoneNumberId } = await getMetaCredentials(
      supabase,
      profile.organization_id,
      instance.id
    );

    const metaClient = createMetaClient({ accessToken, phoneNumberId });
    const response = await metaClient.sendTemplate(
      conversation.phone,
      templateName,
      language,
      components as any
    );

    const metaMessageId = response.messages?.[0]?.id;

    const message = await insertMessage(supabase, {
      conversation_id: id,
      organization_id: conversation.organization_id,
      meta_message_id: metaMessageId,
      from_me: true,
      message_type: 'text',
      text_body: `[Template: ${templateName}]`,
      message_template_name: templateName,
      message_template_components: components ? JSON.stringify(components) : undefined,
      status: 'sent',
      sent_by: `user:${user.id}`,
      whatsapp_timestamp: new Date().toISOString(),
    });

    await updateConversation(supabase, id, {
      last_message_text: `[Template: ${templateName}]`,
      last_message_at: new Date().toISOString(),
      last_message_from_me: true,
      unread_count: 0,
    });

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (err) {
    console.error('[whatsapp-send-template] Error:', err);
    return NextResponse.json({ error: 'Failed to send template' }, { status: 502 });
  }
}