/**
 * WhatsApp Media Proxy
 * Downloads media from Meta/Facebook and serves to the browser
 * This bypasses CORS restrictions on Facebook's CDN
 */

import { NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { getMetaCredentials } from '@/lib/meta/helpers';
import { createMetaClient } from '@/lib/meta/client';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id: messageId } = await params;
  const supabase = createStaticAdminClient();

  try {
    // Get the message with media
    const { data: message, error } = await supabase
      .from('whatsapp_messages')
      .select('id, conversation_id, media_url, media_mime_type, media_filename, message_type')
      .eq('id', messageId)
      .single();

    if (error || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (!message.media_url) {
      return NextResponse.json({ error: 'No media URL' }, { status: 400 });
    }

    // If media_url is not an HTTP URL (it's a Meta ID), fetch the actual URL
    let mediaUrl = message.media_url;
    let mimeType = message.media_mime_type || 'application/octet-stream';
    let filename = message.media_filename || `${message.message_type}-${messageId}`;

    console.log('[media-proxy] Media check:', { 
      mediaUrl: mediaUrl?.slice(0, 50), 
      isHttp: mediaUrl?.startsWith('http'),
      mimeType 
    });

    if (!mediaUrl.startsWith('http')) {
      // It's a Meta media ID - get the actual URL
      // Find the instance for this conversation
      const { data: conversation, error: convError } = await supabase
        .from('whatsapp_conversations')
        .select('instance_id, organization_id')
        .eq('id', message.conversation_id)
        .single();

      console.log('[media-proxy] Conversation lookup:', { conversationId: message.conversation_id, convError, conversation });

      if (convError || !conversation?.instance_id) {
        console.error('[media-proxy] Conversation error:', convError);
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('id, organization_id')
        .eq('id', conversation.instance_id)
        .single();

      if (!instance) {
        return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
      }

      const creds = await getMetaCredentials(supabase, instance.organization_id, instance.id);
      const metaClient = createMetaClient(creds);
      const mediaData = await metaClient.getMediaUrl(mediaUrl);
      
      mediaUrl = mediaData.url;
      if (mediaData.mime_type) {
        mimeType = mediaData.mime_type;
      }
    }

    // Download the file from the source
    const response = await fetch(mediaUrl, {
      headers: {
        // Some sources require user-agent
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error('[media-proxy] Failed to download:', response.status, response.statusText);
      return NextResponse.json({ error: 'Failed to download media' }, { status: 500 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine content type
    const contentType = getContentType(mimeType, mediaUrl, message.message_type);

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', buffer.length.toString());
    headers.set('Content-Disposition', `inline; filename="${filename}"`);
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(buffer, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('[media-proxy] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function getContentType(mimeType: string, url: string, messageType: string): string {
  // If we have a valid mime type, use it
  if (mimeType && mimeType !== 'application/octet-stream') {
    return mimeType;
  }

  // Try to determine from URL
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'image/jpeg';
  if (urlLower.includes('.png')) return 'image/png';
  if (urlLower.includes('.gif')) return 'image/gif';
  if (urlLower.includes('.webp')) return 'image/webp';
  if (urlLower.includes('.mp4') || urlLower.includes('.3gp')) return 'video/mp4';
  if (urlLower.includes('.mp3') || urlLower.includes('.mpeg')) return 'audio/mpeg';
  if (urlLower.includes('.ogg')) return 'audio/ogg';
  if (urlLower.includes('.pdf')) return 'application/pdf';
  
  // Fallback based on message type
  if (messageType === 'image') return 'image/jpeg';
  if (messageType === 'audio') return 'audio/ogg';
  if (messageType === 'video') return 'video/mp4';
  if (messageType === 'document') return 'application/octet-stream';
  
  return 'application/octet-stream';
}