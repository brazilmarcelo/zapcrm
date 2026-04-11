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

    // Find the instance for this conversation to get credentials
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select('instance_id, organization_id')
      .eq('id', message.conversation_id)
      .single();

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

    // Get credentials
    const creds = await getMetaCredentials(supabase, instance.organization_id, instance.id);
    const metaClient = createMetaClient(creds);

    let mediaUrl = message.media_url;
    let filename = message.media_filename || `${message.message_type}-${messageId}`;

    console.log('[media-proxy] Media check:', { 
      mediaUrl: mediaUrl?.slice(0, 80), 
      isLookaside: mediaUrl?.includes('lookaside.fbsbx.com'),
    });

    // If it's a lookaside URL, we need to get fresh URL with token
    if (mediaUrl.includes('lookaside.fbsbx.com')) {
      // Extract media ID from the lookaside URL
      const match = mediaUrl.match(/mid=([^&]+)/);
      if (match) {
        const mediaId = match[1];
        console.log('[media-proxy] Extracted mediaId:', mediaId);
        
        // Get fresh URL from Meta API
        const mediaData = await metaClient.getMediaUrl(mediaId);
        console.log('[media-proxy] Got fresh media URL');
        
        mediaUrl = mediaData.url;
      }
    }

    // Now download the media using Meta's API (which includes auth)
    console.log('[media-proxy] Downloading media from:', mediaUrl?.slice(0, 50));
    const mediaDownload = await metaClient.downloadMedia(mediaUrl);
    
    const buffer = Buffer.from(mediaDownload.data);
    console.log('[media-proxy] Downloaded, size:', buffer.length, 'type:', mediaDownload.contentType);

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', mediaDownload.contentType);
    headers.set('Content-Length', buffer.length.toString());
    headers.set('Content-Disposition', `inline; filename="${filename}"`);
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(buffer, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('[media-proxy] Error:', err);
    return NextResponse.json({ error: 'Internal error: ' + String(err) }, { status: 500 });
  }
}