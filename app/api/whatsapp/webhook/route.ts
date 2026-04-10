/**
 * Meta WhatsApp Cloud API Webhook Handler
 * Handles incoming messages and status updates from Meta Graph API
 */

import { NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import {
  getOrCreateConversation,
  insertMessage,
  updateMessageStatus,
  updateConversation,
  getInstance,
} from '@/lib/supabase/whatsapp';
import { processIncomingMessage } from '@/lib/evolution/aiAgent';
import type { MetaWebhookPayload, MetaWebhookMessage, MetaWebhookStatus } from '@/lib/meta/types';

export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe') {
    // For now, accept any token - in production, verify against stored token
    if (token && token.length > 0) {
      console.log('[whatsapp-webhook] Webhook verified successfully');
      return new Response(challenge, { status: 200 });
    }

    console.warn('[whatsapp-webhook] Verification failed - no token provided');
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, service: 'whatsapp-webhook-meta' });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const supabase = createStaticAdminClient();

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error('[whatsapp-webhook] Invalid JSON body');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    for (const entry of payload.entry) {
      const changes = entry.changes ?? [];

      for (const change of changes) {
        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;

        if (!phoneNumberId) {
          console.warn('[whatsapp-webhook] No phone_number_id in metadata');
          continue;
        }

        const { data: instance } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('phone_number_id', phoneNumberId)
          .single();

        if (!instance) {
          console.warn('[whatsapp-webhook] No instance found for phone_number_id:', phoneNumberId);
          continue;
        }

        if (value.messages) {
          for (const msg of value.messages) {
            await handleIncomingMessage(supabase, instance, msg);
          }
        }

        if (value.statuses) {
          for (const status of value.statuses) {
            await handleStatusUpdate(supabase, status);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[whatsapp-webhook] Error processing webhook:', err);
    return NextResponse.json({ success: true });
  }
}

async function handleIncomingMessage(
  supabase: ReturnType<typeof createStaticAdminClient>,
  instance: Record<string, unknown>,
  msg: MetaWebhookMessage
) {
  const from = msg.from;
  const messageId = msg.id;
  const timestamp = msg.timestamp;

  if (!from || !messageId) {
    console.warn('[whatsapp-webhook] Skipping message - missing from or id');
    return;
  }

  if (instance.phone_number === from) {
    console.log('[whatsapp-webhook] Skipping message from self');
    return;
  }

  const organizationId = instance.organization_id as string;
  const instanceDbId = instance.id as string;

  let messageType = 'text';
  let textBody: string | undefined;
  let mediaUrl: string | undefined;
  let mediaMimeType: string | undefined;
  let mediaCaption: string | undefined;
  let mediaFilename: string | undefined;

  if (msg.text) {
    textBody = msg.text.body;
  } else if (msg.image) {
    messageType = 'image';
    mediaUrl = msg.image.id;
    mediaMimeType = msg.image.mime_type;
    mediaCaption = msg.image.caption;
  } else if (msg.audio) {
    messageType = 'audio';
    mediaUrl = msg.audio.id;
    mediaMimeType = msg.audio.mime_type;
  } else if (msg.video) {
    messageType = 'video';
    mediaUrl = msg.video.id;
    mediaMimeType = msg.video.mime_type;
    mediaCaption = msg.video.caption;
  } else if (msg.document) {
    messageType = 'document';
    mediaUrl = msg.document.id;
    mediaFilename = msg.document.filename;
    mediaMimeType = msg.document.mime_type;
  } else if (msg.button) {
    messageType = 'button_response';
    textBody = msg.button.text;
  } else if (msg.interactive) {
    if (msg.interactive.button_reply) {
      messageType = 'button_response';
      textBody = msg.interactive.button_reply.title;
    } else if (msg.interactive.list_reply) {
      messageType = 'list_response';
      textBody = msg.interactive.list_reply.title;
    }
  } else if (msg.system) {
    messageType = 'system';
    textBody = msg.system.body;
  }

  const conversation = await getOrCreateConversation(
    supabase,
    organizationId,
    instanceDbId,
    from,
    undefined,
    undefined,
    false
  );

  const whatsappTimestamp = timestamp
    ? new Date(parseInt(timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const insertedMessage = await insertMessage(supabase, {
    conversation_id: conversation.id,
    organization_id: organizationId,
    meta_message_id: messageId,
    from_me: false,
    message_type: messageType as any,
    text_body: textBody,
    media_url: mediaUrl,
    media_mime_type: mediaMimeType,
    media_filename: mediaFilename,
    media_caption: mediaCaption,
    context_message_id: msg.context?.id,
    status: 'received',
    whatsapp_timestamp: whatsappTimestamp,
  });

  const previewText = textBody || mediaCaption || `[${messageType}]`;
  await updateConversation(supabase, conversation.id, {
    last_message_text: previewText.slice(0, 255),
    last_message_at: whatsappTimestamp,
    last_message_from_me: false,
    unread_count: (conversation.unread_count ?? 0) + 1,
    status: 'open',
  });

  const aiEnabled = instance.ai_enabled as boolean;
  if (aiEnabled && conversation.ai_active) {
    try {
      await processIncomingMessage({
        supabase,
        conversation,
        instance: {
          id: instanceDbId,
          phone_number_id: instance.phone_number_id as string,
          access_token: instance.access_token_encrypted as string,
          organization_id: organizationId,
        },
        incomingMessage: insertedMessage,
      });
    } catch (err) {
      console.error('[whatsapp-ai] Error processing message:', err);
    }
  }
}

async function handleStatusUpdate(
  supabase: ReturnType<typeof createStaticAdminClient>,
  status: MetaWebhookStatus
) {
  const statusMap: Record<string, string> = {
    sent: 'sent',
    delivered: 'received',
    read: 'read',
    failed: 'failed',
    pending: 'pending',
  };

  const newStatus = statusMap[status.status];
  const messageId = status.id;

  if (newStatus && messageId) {
    console.log(`[whatsapp-webhook] Updating message ${messageId} status to ${newStatus}`);
    await updateMessageStatus(supabase, messageId, newStatus);
  }
}