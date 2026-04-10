-- =============================================================================
-- SCHEMA COMPLETO - vaccineCRM
-- Execute tudo de uma vez no Supabase SQL Editor
-- =============================================================================

-- PARTE 1: EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================================================
-- PARTE 2: TABELAS PRINCIPAIS
-- =============================================================================

-- ORGANIZATIONS
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORGANIZATION_SETTINGS
CREATE TABLE IF NOT EXISTS public.organization_settings (
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE PRIMARY KEY,
    ai_provider text DEFAULT 'google',
    ai_model text DEFAULT 'gemini-2.5-flash',
    ai_google_key text,
    ai_openai_key text,
    ai_anthropic_key text,
    ai_enabled boolean NOT NULL DEFAULT true,
    evolution_api_url text,
    evolution_api_key text,
    meta_business_account_id text,
    meta_access_token_encrypted text,
    meta_webhook_verify_token text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    avatar TEXT,
    role TEXT DEFAULT 'user',
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    nickname TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LIFECYCLE_STAGES
CREATE TABLE IF NOT EXISTS public.lifecycle_stages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12,2),
    cost NUMERIC(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONTACTS
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    phone TEXT,
    stage TEXT DEFAULT 'new',
    status TEXT DEFAULT 'active',
    total_value NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    last_interaction TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEALS
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    value NUMERIC(12,2) DEFAULT 0,
    board_id TEXT,
    stage_id TEXT,
    priority TEXT DEFAULT 'medium',
    tags TEXT[],
    notes TEXT,
    won_at TIMESTAMPTZ,
    lost_at TIMESTAMPTZ,
    is_won BOOLEAN DEFAULT false,
    is_lost BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEAL NOTES
CREATE TABLE IF NOT EXISTS public.deal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- DEAL FILES
CREATE TABLE IF NOT EXISTS public.deal_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- BOARDS
CREATE TABLE IF NOT EXISTS public.boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOARD STAGES
CREATE TABLE IF NOT EXISTS public.board_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    is_won BOOLEAN DEFAULT false,
    is_lost BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONSENTS
CREATE TABLE IF NOT EXISTS public.consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    granted BOOLEAN DEFAULT false,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ACTIVITIES
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PARTE 3: WHATSAPP
-- =============================================================================

-- WHATSAPP INSTANCES
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    instance_id TEXT,
    instance_token TEXT,
    client_token TEXT,
    evolution_instance_name TEXT,
    waba_id TEXT,
    phone_number_id TEXT,
    phone_number TEXT,
    phone TEXT,
    access_token_encrypted TEXT,
    business_account_id TEXT,
    webhook_verify_token TEXT,
    webhook_url TEXT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'disconnected',
    ai_enabled BOOLEAN DEFAULT false,
    connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHATSAPP CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    last_message_text TEXT,
    last_message_at TIMESTAMPTZ,
    last_message_from_me BOOLEAN DEFAULT false,
    unread_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',
    ai_active BOOLEAN DEFAULT true,
    ai_paused_by UUID,
    ai_paused_at TIMESTAMPTZ,
    ai_pause_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHATSAPP MESSAGES
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    evolution_message_id TEXT,
    meta_message_id TEXT,
    context_message_id TEXT,
    from_me BOOLEAN DEFAULT false,
    sender_name TEXT,
    message_type TEXT DEFAULT 'text',
    text_body TEXT,
    media_url TEXT,
    media_mime_type TEXT,
    media_filename TEXT,
    media_caption TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    quoted_message_id TEXT,
    quoted_text TEXT,
    status TEXT DEFAULT 'pending',
    sent_by TEXT,
    whatsapp_timestamp TIMESTAMPTZ,
    message_template_name TEXT,
    message_template_components JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHATSAPP AI CONFIG
CREATE TABLE IF NOT EXISTS public.whatsapp_ai_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
    system_prompt TEXT,
    working_days INTEGER[] DEFAULT '{1,2,3,4,5}',
    working_hours_start TEXT,
    working_hours_end TEXT,
    tone TEXT DEFAULT 'professional',
    auto_reply BOOLEAN DEFAULT true,
    auto_create_deal BOOLEAN DEFAULT true,
    auto_create_contact BOOLEAN DEFAULT true,
    auto_assign_label TEXT,
    auto_summarize BOOLEAN DEFAULT true,
    summarize_interval_messages INTEGER DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHATSAPP AI LOGS
CREATE TABLE IF NOT EXISTS public.whatsapp_ai_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    triggered_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHATSAPP CHAT MEMORY
CREATE TABLE IF NOT EXISTS public.whatsapp_chat_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    context TEXT,
    confidence NUMERIC DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHATSAPP FOLLOW UPS
CREATE TABLE IF NOT EXISTS public.whatsapp_follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHATSAPP LABELS
CREATE TABLE IF NOT EXISTS public.whatsapp_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHATSAPP CONVERSATION LABELS
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    label_id UUID REFERENCES public.whatsapp_labels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHATSAPP LEAD SCORES
CREATE TABLE IF NOT EXISTS public.whatsapp_lead_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHATSAPP CONVERSATION SUMMARIES
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHATSAPP TEMPLATES
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
    meta_template_id TEXT NOT NULL,
    name TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'pt_BR',
    category TEXT NOT NULL CHECK (category IN ('UTILITY', 'MARKETING', 'AUTHENTICATION')),
    status TEXT DEFAULT 'PENDING',
    content JSONB DEFAULT '{}',
    components JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, meta_template_id)
);

-- =============================================================================
-- PARTE 4: RLS - POLICIES
-- =============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifecycle_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chat_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversation_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PARTE 5: ÍNICIOS (DATA SEED)
-- =============================================================================

-- Lifecycle Stages
INSERT INTO public.lifecycle_stages (id, name, color, "order", is_default) VALUES
('lead', 'Lead', '#64748b', 1, false),
('client', 'Cliente', '#22c55e', 2, false)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PRONTO!
-- =============================================================================