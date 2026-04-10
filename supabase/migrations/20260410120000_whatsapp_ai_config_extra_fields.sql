-- Add missing columns to whatsapp_ai_config
ALTER TABLE public.whatsapp_ai_config 
ADD COLUMN IF NOT EXISTS agent_name TEXT,
ADD COLUMN IF NOT EXISTS agent_role TEXT,
ADD COLUMN IF NOT EXISTS agent_tone TEXT DEFAULT 'professional',
ADD COLUMN IF NOT EXISTS reply_delay_ms INTEGER DEFAULT 2000,
ADD COLUMN IF NOT EXISTS max_messages_per_conversation INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS greeting_message TEXT,
ADD COLUMN IF NOT EXISTS away_message TEXT,
ADD COLUMN IF NOT EXISTS transfer_message TEXT,
ADD COLUMN IF NOT EXISTS outside_hours_message TEXT,
ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS follow_up_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_label_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS lead_scoring_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS summary_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS smart_pause_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS follow_up_default_delay_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS follow_up_max_per_conversation INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS follow_up_sequence JSONB,
ADD COLUMN IF NOT EXISTS follow_up_quiet_hours_start TEXT,
ADD COLUMN IF NOT EXISTS follow_up_quiet_hours_end TEXT,
ADD COLUMN IF NOT EXISTS default_board_id UUID,
ADD COLUMN IF NOT EXISTS default_stage_id UUID,
ADD COLUMN IF NOT EXISTS default_tags TEXT[] DEFAULT '{}';

-- Also add business_account_id to whatsapp_instances if missing
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS business_account_id TEXT;

-- Add meta_business_account_id to organization_settings if missing
ALTER TABLE public.organization_settings 
ADD COLUMN IF NOT EXISTS meta_business_account_id TEXT,
ADD COLUMN IF NOT EXISTS meta_access_token_encrypted TEXT;