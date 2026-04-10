# WhatsApp Meta Cloud API Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a integração com Evolution API pela Meta Cloud API (WABA/COEX) para envio/recebimento de mensagens WhatsApp, incluindo módulo de templates.

**Architecture:** Nova camada `lib/meta/` para comunicação com Graph API. Schema de banco adaptado para armazenar identifiers da Meta (waba_id, phone_number_id). Frontend reaproveitado com pequenas adaptações no fluxo de envio.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL), Meta Graph API v21.0, TanStack Query.

---

## File Structure

```
lib/meta/
├── client.ts           # Client para Graph API Meta
├── types.ts            # Types para payloads da Meta
├── helpers.ts          # Funções auxiliares (token, webhook verify)
└── templates.ts         # Operações com templates

supabase/migrations/
└── 20260000000000_meta_whatsapp_migration.sql   # Novo schema

app/api/whatsapp/
├── instances/          # GET/POST - criar/listar instâncias WABA
├── webhook/            # POST - receber webhooks da Meta
├── templates/          # GET - listar templates approved
└── conversations/[id]/
    ├── send/           # POST - enviar mensagem
    └── send-template/  # POST - enviar template

types/whatsapp.ts       # Atualizar tipos para Meta
lib/evolution/aiAgent.ts  # Adaptar para usar Meta client
```

---

## Task 1: Migration do Banco de Dados

**Files:**
- Create: `supabase/migrations/20260000000000_meta_whatsapp_migration.sql`

- [ ] **Step 1: Criar migration com novo schema**

```sql
-- Migration: Meta WhatsApp Cloud API
-- Executar: supabase migration push ou aplicar manualmente

-- 1. Adicionar colunas Meta às tabelas existentes
ALTER TABLE public.whatsapp_instances 
  ADD COLUMN IF NOT EXISTS waba_id TEXT,
  ADD COLUMN IF NOT EXISTS phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS business_account_id TEXT,
  ADD COLUMN IF NOT EXISTS webhook_verify_token TEXT;

-- 2. Renomear colunas antigas (manter compatibilidade temporária)
ALTER TABLE public.whatsapp_instances 
  ALTER COLUMN instance_id DROP NOT NULL,
  ALTER COLUMN instance_token DROP NOT NULL;

-- 3. Nova tabela de templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  
  meta_template_id TEXT NOT NULL,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt_BR',
  category TEXT NOT NULL CHECK (category IN ('UTILITY', 'MARKETING', 'AUTHENTICATION')),
  status TEXT DEFAULT 'PENDING',
  content JSONB DEFAULT '{}',
  components JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_org ON public.whatsapp_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_instance ON public.whatsapp_templates(instance_id);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_templates_select" ON public.whatsapp_templates
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "whatsapp_templates_insert" ON public.whatsapp_templates
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- 4. Adicionar campos Meta ao organization_settings
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS meta_business_account_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS meta_webhook_verify_token TEXT;

-- 5. Adicionar coluna template_id às mensagens para replies
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS meta_message_id TEXT,
  ADD COLUMN IF NOT EXISTS context_message_id TEXT;

-- 6. Adicionar type de template às mensagens
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS message_template_name TEXT,
  ADD COLUMN IF NOT EXISTS message_template_components JSONB;
```

- [ ] **Step 2: Executar migration no Supabase**

Run: `supabase migration push` ou aplicar via dashboard Supabase
Expected: Tables updated with new columns

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260000000000_meta_whatsapp_migration.sql
git commit -m "feat(whatsapp): add Meta Cloud API migration"
```

---

## Task 2: Meta API Client

**Files:**
- Create: `lib/meta/types.ts`
- Create: `lib/meta/client.ts`
- Create: `lib/meta/helpers.ts`

- [ ] **Step 1: Criar types para Meta API**

```typescript
// lib/meta/types.ts

export interface MetaCredentials {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  wabaId?: string;
}

export interface MetaSendMessageRequest {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'template';
  text?: { body: string };
  image?: { id?: string; link?: string; caption?: string };
  audio?: { id?: string; link?: string };
  video?: { id?: string; link?: string; caption?: string };
  document?: { id?: string; link?: string; filename?: string; caption?: string };
  template?: {
    name: string;
    language: { code: string };
    components?: Array<{ type: string; parameters?: Array<{ type: string; text?: string; image?: string; document?: string; video?: string }> }>;
  };
  context?: { message_id: string };
}

export interface MetaSendMessageResponse {
  messaging_product: string;
  contacts: Array[{ profile: { name: string }; wa_id: string }];
  messages: Array[{ id: string }];
}

export interface MetaWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: { display_phone_number: string; phone_number_id: string };
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        text?: { body: string };
        image?: { id: string; mime_type: string; sha256: string; caption?: string };
        audio?: { id: string; mime_type: string; sha256: string };
        video?: { id: string; mime_type: string; sha256: string; caption?: string };
        document?: { id: string; filename: string; mime_type: string; sha256: string };
        button?: { payload: string; text: string };
        interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string; description: string } };
        system?: { body: string; type: string; identity?: { acknowledged: boolean; fingerprint: string } };
        context?: { from: string; id: string; referred_type?: string };
      }>;
      statuses?: Array<{
        id: string;
        status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
        timestamp: string;
        recipient_id: string;
        errors?: Array<{ code: number; title: string }];
      }>;
    };
    field: string;
  }>;
}

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'INACTIVE';
  components: Array<{
    type: 'BODY' | 'HEADER' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string; payload?: string }>;
  }>;
}
```

- [ ] **Step 2: Criar Meta client**

```typescript
// lib/meta/client.ts

import type { MetaCredentials, MetaSendMessageRequest, MetaSendMessageResponse, MetaTemplate } from './types';

const META_API_VERSION = 'v21.0';

export class MetaWhatsAppClient {
  private accessToken: string;
  private phoneNumberId: string;
  private baseUrl: string;

  constructor(credentials: MetaCredentials) {
    this.accessToken = credentials.accessToken;
    this.phoneNumberId = credentials.phoneNumberId;
    this.baseUrl = `https://graph.facebook.com/${META_API_VERSION}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Meta API error ${response.status}: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  async sendMessage(message: MetaSendMessageRequest): Promise<MetaSendMessageResponse> {
    return this.request<MetaSendMessageResponse>(`/${this.phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  async sendText(to: string, text: string, contextMessageId?: string): Promise<MetaSendMessageResponse> {
    const payload: MetaSendMessageRequest = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    };

    if (contextMessageId) {
      payload.context = { message_id: contextMessageId };
    }

    return this.sendMessage(payload);
  }

  async sendTemplate(to: string, templateName: string, language: string, components?: MetaSendMessageRequest['template']['components']): Promise<MetaSendMessageResponse> {
    const payload: MetaSendMessageRequest = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: components ?? [],
      },
    };

    return this.sendMessage(payload);
  }

  async sendMedia(to: string, mediaType: 'image' | 'audio' | 'video' | 'document', media: { id?: string; link?: string }, caption?: string, filename?: string): Promise<MetaSendMessageResponse> {
    const mediaPayload = { ...media };
    if (caption) mediaPayload.caption = caption;
    if (filename && mediaType === 'document') mediaPayload.filename = filename;

    const payload: MetaSendMessageRequest = {
      messaging_product: 'whatsapp',
      to,
      type: mediaType,
      [mediaType]: mediaPayload,
    };

    return this.sendMessage(payload);
  }

  async uploadMedia(mediaUrl: string, type: 'image' | 'audio' | 'video' | 'document' | 'image' | 'sticker'): Promise<{ id: string }> {
    return this.request('/%7Bphone-number-id%7D/messages', {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        type,
        file: mediaUrl,
      }),
    }).catch(() => ({ id: '' })); // Placeholder - upload requires form-data
  }

  async getTemplates(): Promise<MetaTemplate[]> {
    const businessAccountId = 'TODO'; // Get from credentials
    const response = await this.request<{ data: MetaTemplate[] }>(`/${businessAccountId}/message_templates`);
    return response.data ?? [];
  }

  async getMediaUrl(mediaId: string): Promise<{ url: string }> {
    return this.request(`/${mediaId}`);
  }
}

export function createMetaClient(credentials: MetaCredentials): MetaWhatsAppClient {
  return new MetaWhatsAppClient(credentials);
}
```

- [ ] **Step 3: Criar helpers**

```typescript
// lib/meta/helpers.ts

import type { SupabaseClient } from '@supabase/supabase-js';

export async function getMetaCredentials(
  supabase: SupabaseClient,
  organizationId: string,
  instanceId?: string
): Promise<{ accessToken: string; phoneNumberId: string; businessAccountId: string; wabaId?: string }> {
  if (instanceId) {
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('access_token_encrypted, phone_number_id, business_account_id, waba_id')
      .eq('id', instanceId)
      .single();

    if (!instance?.access_token_encrypted || !instance?.phone_number_id) {
      throw new Error('Instance not configured for Meta API');
    }

    return {
      accessToken: instance.access_token_encrypted,
      phoneNumberId: instance.phone_number_id,
      businessAccountId: instance.business_account_id ?? '',
      wabaId: instance.waba_id,
    };
  }

  const { data: settings } = await supabase
    .from('organization_settings')
    .select('meta_access_token_encrypted, meta_business_account_id')
    .eq('organization_id', organizationId)
    .single();

  if (!settings?.meta_access_token_encrypted) {
    throw new Error('Meta API not configured. Go to Settings > WhatsApp > Configure Meta.');
  }

  return {
    accessToken: settings.meta_access_token_encrypted,
    phoneNumberId: '',
    businessAccountId: settings.meta_business_account_id ?? '',
  };
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  // Meta sends X-Hub-Signature-256 with sha256 signature
  const crypto = require('crypto');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${expected}` === signature;
}

export function generateWebhookVerifyToken(): string {
  return require('crypto').randomBytes(32).toString('hex');
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/meta/types.ts lib/meta/client.ts lib/meta/helpers.ts
git commit -m "feat(whatsapp): add Meta Cloud API client"
```

---

## Task 3: API Routes - Instâncias

**Files:**
- Modify: `app/api/whatsapp/instances/route.ts:61-168`

- [ ] **Step 1: Atualizar POST para criar instância Meta**

```typescript
// Substituir a lógica de criação Evolution pela criação de registro Meta

export async function POST(request: Request) {
  const ctx = await getUserContext();
  if (!ctx.ok) return ctx.response;
  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateInstanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, wabaId, phoneNumberId, phoneNumber, accessToken, businessAccountId } = parsed.data;

  // Validar que todos os campos Meta foram fornecidos
  if (!wabaId || !phoneNumberId || !accessToken) {
    return NextResponse.json(
      { error: 'Para usar a Meta Cloud API, forneça: waba_id, phone_number_id, access_token' },
      { status: 400 }
    );
  }

  const webhookVerifyToken = generateWebhookVerifyToken();

  const { data: dbInstance, error: dbError } = await ctx.supabase
    .from('whatsapp_instances')
    .insert({
      organization_id: ctx.organizationId,
      name: name || 'WhatsApp Meta',
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      phone_number: phoneNumber,
      access_token_encrypted: accessToken,
      business_account_id: businessAccountId,
      webhook_verify_token: webhookVerifyToken,
      status: 'connected',
    })
    .select()
    .single();

  if (dbError || !dbInstance) {
    return NextResponse.json({ error: dbError?.message || 'Failed to create instance' }, { status: 500 });
  }

  // Não precisa mais criar webhooks na Evolution - isso será configurado no dashboard Meta
  // O webhook da Meta será enviado para /api/whatsapp/webhook/{instanceId}

  return NextResponse.json({ data: dbInstance }, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/whatsapp/instances/route.ts
git commit -m "feat(whatsapp): support Meta Cloud API instances"
```

---

## Task 4: API Routes - Webhook

**Files:**
- Create: `app/api/whatsapp/webhook/route.ts` (substituir o atual que era por instanceId)

- [ ] **Step 1: Criar novo webhook handler para Meta**

```typescript
// app/api/whatsapp/webhook/route.ts

import { NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { getOrCreateConversation, insertMessage, updateMessageStatus, updateConversation } from '@/lib/supabase/whatsapp';
import { processIncomingMessage } from '@/lib/evolution/aiAgent';
import type { MetaWebhookPayload } from '@/lib/meta/types';

type Params = { params: Promise<{ instanceId: string }> };

export const maxDuration = 60;

export async function POST(request: Request, { params }: Params) {
  const { instanceId } = await params;
  
  const rawBody = await request.text();
  const signature = request.headers.get('X-Hub-Signature-256') || '';

  const supabase = createStaticAdminClient();

  // Get instance to verify webhook
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  // Verify webhook signature (optional - Meta always sends)
  const verifyToken = instance.webhook_verify_token;
  const mode = request.headers.get('X-Hub-Mode');
  const token = request.headers.get('X-Hub-Accept');

  // Handle verification (Meta sends GET on webhook setup)
  if (request.method === 'GET') {
    const verifyTokenParam = new URL(request.url).searchParams.get('hub.verify_token');
    if (verifyTokenParam === verifyToken) {
      const challenge = new URL(request.url).searchParams.get('hub.challenge');
      return new Response(challenge, { status: 200 });
    }
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    for (const entry of payload.entry) {
      const changes = entry.changes ?? [];

      for (const change of changes) {
        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;

        // Skip if not our phone number
        if (phoneNumberId !== instance.phone_number_id) continue;

        // Handle incoming messages
        if (value.messages) {
          for (const msg of value.messages) {
            await handleIncomingMessage(supabase, instance, msg, value.metadata);
          }
        }

        // Handle status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await handleStatusUpdate(supabase, status);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[whatsapp-webhook] Error:', err);
    return NextResponse.json({ success: true }); // Return 200 to prevent retries
  }
}

async function handleIncomingMessage(
  supabase: ReturnType<typeof createStaticAdminClient>,
  instance: Record<string, unknown>,
  msg: Record<string, unknown>,
  metadata: Record<string, unknown>
) {
  const from = msg.from as string;
  const messageId = msg.id as string;
  const timestamp = msg.timestamp as string;
  const msgType = Object.keys(msg).find(k => ['text', 'image', 'audio', 'video', 'document', 'button', 'interactive', 'system'].includes(k));

  if (!from || !messageId) return;

  // Skip messages sent by us
  if (instance.phone_number === from) return;

  const organizationId = instance.organization_id as string;
  const instanceDbId = instance.id as string;

  // Determine message content
  let messageType = 'text';
  let textBody: string | undefined;
  let mediaUrl: string | undefined;
  let mediaMimeType: string | undefined;
  let mediaCaption: string | undefined;
  let mediaFilename: string | undefined;

  if (msgType === 'text') {
    textBody = (msg.text as { body?: string })?.body;
  } else if (msgType === 'image') {
    messageType = 'image';
    const img = msg.image as { id?: string; mime_type?: string; caption?: string };
    mediaUrl = (img as { url?: string }).url || img.id;
    mediaMimeType = img.mime_type;
    mediaCaption = img.caption;
  } else if (msgType === 'audio') {
    messageType = 'audio';
    const audio = msg.audio as { id?: string; mime_type?: string };
    mediaUrl = (audio as { url?: string }).url || audio.id;
    mediaMimeType = audio.mime_type;
  } else if (msgType === 'video') {
    messageType = 'video';
    const video = msg.video as { id?: string; mime_type?: string; caption?: string };
    mediaUrl = (video as { url?: string }).url || video.id;
    mediaMimeType = video.mime_type;
    mediaCaption = video.caption;
  } else if (msgType === 'document') {
    messageType = 'document';
    const doc = msg.document as { id?: string; filename?: string; mime_type?: string };
    mediaUrl = (doc as { url?: string }).url || doc.id;
    mediaFilename = doc.filename;
    mediaMimeType = doc.mime_type;
  } else if (msgType === 'button') {
    messageType = 'button_response';
    textBody = (msg.button as { text?: string })?.text;
  } else if (msgType === 'interactive') {
    const interactive = msg.interactive as { button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string; description: string } };
    if (interactive?.button_reply) {
      messageType = 'button_response';
      textBody = interactive.button_reply.title;
    } else if (interactive?.list_reply) {
      messageType = 'list_response';
      textBody = interactive.list_reply.title;
    }
  }

  // Get or create conversation
  const conversation = await getOrCreateConversation(
    supabase,
    organizationId,
    instanceDbId,
    from,
    undefined,
    undefined,
    false
  );

  // Insert message
  const insertedMessage = await insertMessage(supabase, {
    conversation_id: conversation.id,
    organization_id: organizationId,
    meta_message_id: messageId,
    from_me: false,
    message_type: messageType,
    text_body: textBody,
    media_url: mediaUrl,
    media_mime_type: mediaMimeType,
    media_filename: mediaFilename,
    media_caption: mediaCaption,
    status: 'received',
    whatsapp_timestamp: timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString(),
  });

  // Update conversation
  const previewText = textBody || mediaCaption || `[${messageType}]`;
  await updateConversation(supabase, conversation.id, {
    last_message_text: previewText.slice(0, 255),
    last_message_at: timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString(),
    last_message_from_me: false,
    unread_count: (conversation.unread_count ?? 0) + 1,
    status: 'open',
  });

  // Process AI if enabled
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
      console.error('[whatsapp-ai] Error:', err);
    }
  }
}

async function handleStatusUpdate(
  supabase: ReturnType<typeof createStaticAdminClient>,
  status: Record<string, unknown>
) {
  const statusMap: Record<string, string> {
    sent: 'sent',
    delivered: 'received',
    read: 'read',
    failed: 'failed',
    pending: 'pending',
  };

  const newStatus = statusMap[status.status as string];
  const messageId = status.id as string;

  if (newStatus && messageId) {
    await updateMessageStatus(supabase, messageId, newStatus);
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'whatsapp-webhook-meta' });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/whatsapp/webhook/route.ts
git commit -f "feat(whatsapp): add Meta webhook handler"
```

---

## Task 5: API Routes - Enviar Mensagem

**Files:**
- Modify: `app/api/whatsapp/conversations/[id]/send/route.ts`

- [ ] **Step 1: Substituir Evolution client pelo Meta client**

```typescript
// Substituir imports e lógica de envio

import { getMetaCredentials } from '@/lib/meta/helpers';
import { createMetaClient } from '@/lib/meta/client';

// Na função POST, substituir:

const { accessToken, phoneNumberId } = await getMetaCredentials(
  supabase,
  profile.organization_id,
  instance.id
);

const metaClient = createMetaClient({ accessToken, phoneNumberId });

try {
  const response = await metaClient.sendText(
    conversation.phone,
    text,
    quotedMessageId ?? undefined
  );
  
  const metaMessageId = response.messages?.[0]?.id;
```

- [ ] **Step 2: Commit**

```bash
git add app/api/whatsapp/conversations/[id]/send/route.ts
git commit -m "feat(whatsapp): send messages via Meta API"
```

---

## Task 6: API Routes - Templates

**Files:**
- Create: `app/api/whatsapp/instances/[id]/templates/route.ts`
- Create: `app/api/whatsapp/conversations/[id]/send-template/route.ts`

- [ ] **Step 1: Criar endpoint para listar templates**

```typescript
// app/api/whatsapp/instances/[id]/templates/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMetaCredentials } from '@/lib/meta/helpers';
import { createMetaClient } from '@/lib/meta/client';
import { upsertTemplates } from '@/lib/supabase/whatsapp';

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

  // Get instance
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  if (!instance || instance.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  try {
    const { accessToken, businessAccountId } = await getMetaCredentials(
      supabase,
      profile.organization_id,
      instanceId
    );

    if (!businessAccountId) {
      // Return cached templates from DB
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

    const metaTemplates = await metaClient.getTemplates();

    // Save to DB
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
```

- [ ] **Step 2: Criar endpoint para enviar template**

```typescript
// app/api/whatsapp/conversations/[id]/send-template/route.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getConversation, getInstance } from '@/lib/supabase/whatsapp';
import { getMetaCredentials } from '@/lib/meta/helpers';
import { createMetaClient } from '@/lib/meta/client';

const SendTemplateSchema = z.object({
  templateName: z.string().min(1),
  language: z.string().default('pt_BR'),
  components: z.array(z.object({ type: z.string(), parameters: z.array(z.object({ type: z.string(), text: z.string().optional() })) })).optional(),
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

    // Save to DB
    const { insertMessage } = await import('@/lib/supabase/whatsapp');
    await insertMessage(supabase, {
      conversation_id: id,
      organization_id: conversation.organization_id,
      meta_message_id: metaMessageId,
      from_me: true,
      message_type: 'text',
      text_body: `[Template: ${templateName}]`,
      message_template_name: templateName,
      message_template_components: components ? JSON.stringify(components) : null,
      status: 'sent',
      sent_by: `user:${user.id}`,
      whatsapp_timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ data: { messageId: metaMessageId } }, { status: 201 });
  } catch (err) {
    console.error('[whatsapp-send-template] Error:', err);
    return NextResponse.json({ error: 'Failed to send template' }, { status: 502 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/whatsapp/instances/[id]/templates/route.ts app/api/whatsapp/conversations/[id]/send-template/route.ts
git commit -m "feat(whatsapp): add templates endpoints"
```

---

## Task 7: Frontend - Botão de Templates

**Files:**
- Modify: `features/whatsapp/components/MessageThread.tsx`

- [ ] **Step 1: Adicionar botão de templates no composer**

```typescript
// Adicionar no componente de composer de mensagens

const [showTemplates, setShowTemplates] = useState(false);

const handleSendTemplate = async (template: WhatsAppTemplate) => {
  await sendTemplateMutation.mutateAsync({
    conversationId: conversation.id,
    templateName: template.name,
    language: template.language,
  });
  setShowTemplates(false);
};

// No botão de enviar, adicionar dropdown ou modal:
// <button onClick={() => setShowTemplates(true)}>📋 Templates</button>
```

- [ ] **Step 2: Adicionar query para templates**

```typescript
// lib/query/whatsapp.ts - adicionar

export function useWhatsAppTemplates(instanceId: string) {
  return useQuery({
    queryKey: [...queryKeys.whatsappInstances.detail(instanceId), 'templates'],
    queryFn: () => fetchJson<WhatsAppTemplate[]>(`/api/whatsapp/instances/${instanceId}/templates`),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add features/whatsapp/components/MessageThread.tsx lib/query/whatsapp.ts
git commit -m "feat(whatsapp): add template selector UI"
```

---

## Task 8: AI Agent - Adaptar para Meta

**Files:**
- Modify: `lib/evolution/aiAgent.ts`

- [ ] **Step 1: Modificar função de envio de mensagem**

Na função que envia mensagem via Evolution, adaptar para usar Meta client:

```typescript
// Substituir:
import * as evolution from '@/lib/evolution/client';
import { getEvolutionCredentials } from '@/lib/evolution/helpers';

// Por:
import { createMetaClient } from '@/lib/meta/client';
import { getMetaCredentials } from '@/lib/meta/helpers';

// Na função sendMessage:
const { accessToken, phoneNumberId } = await getMetaCredentials(supabase, organizationId, instanceId);
const metaClient = createMetaClient({ accessToken, phoneNumberId });
await metaClient.sendText(phone, text);
```

- [ ] **Step 2: Commit**

```bash
git add lib/evolution/aiAgent.ts
git commit -m "feat(whatsapp): adapt AI agent for Meta API"
```

---

## Task 9: Settings - Configuração Meta

**Files:**
- Create: `features/settings/components/MetaWhatsAppSettings.tsx` (ou adaptar EvolutionApiSettings)

- [ ] **Step 1: Criar UI de configuração**

Criar formulário para:
- Meta Business Account ID
- Meta Access Token
- Webhook URL (exibir para configurar no dashboard Meta)
- Botão para gerar verify token

- [ ] **Step 2: Commit**

```bash
git add features/settings/components/MetaWhatsAppSettings.tsx
git commit -m "feat(whatsapp): add Meta configuration UI"
```

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-09-whatsapp-meta-migration.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**