-- Migration: Meta WhatsApp Cloud API
-- Created: 2026-04-09
-- Purpose: Adicionar colunas para Meta Cloud API e criar tabela de templates
-- Executar: supabase db push ou aplicar via dashboard Supabase

BEGIN;

-- 1. Adicionar colunas Meta às tabelas existentes
ALTER TABLE public.whatsapp_instances 
  ADD COLUMN IF NOT EXISTS waba_id TEXT,
  ADD COLUMN IF NOT EXISTS phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS business_account_id TEXT,
  ADD COLUMN IF NOT EXISTS webhook_verify_token TEXT;

-- 2. Remover NOT NULL das colunas antigas (mantém compatibilidade)
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
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, meta_template_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_org ON public.whatsapp_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_instance ON public.whatsapp_templates(instance_id);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_templates_select" ON public.whatsapp_templates;
CREATE POLICY "whatsapp_templates_select" ON public.whatsapp_templates
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "whatsapp_templates_insert" ON public.whatsapp_templates;
CREATE POLICY "whatsapp_templates_insert" ON public.whatsapp_templates
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- 4. Adicionar campos Meta ao organization_settings
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS meta_business_account_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS meta_webhook_verify_token TEXT;

-- 5. Adicionar coluna para tracking de mensagens Meta
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS meta_message_id TEXT,
  ADD COLUMN IF NOT EXISTS context_message_id TEXT;

-- 6. Adicionar type de template às mensagens
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS message_template_name TEXT,
  ADD COLUMN IF NOT EXISTS message_template_components JSONB;

COMMIT;