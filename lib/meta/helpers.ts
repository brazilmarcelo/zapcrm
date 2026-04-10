/**
 * Meta WhatsApp Cloud API Helpers
 */

import { createHmac, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface MetaCredentialsOutput {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  wabaId?: string;
}

export async function getMetaCredentials(
  supabase: SupabaseClient,
  organizationId: string,
  instanceId?: string
): Promise<MetaCredentialsOutput> {
  if (instanceId) {
    const { data: instance, error } = await supabase
      .from('whatsapp_instances')
      .select(
        'access_token_encrypted, phone_number_id, business_account_id, waba_id'
      )
      .eq('id', instanceId)
      .single();

    if (!error && instance?.access_token_encrypted && instance?.phone_number_id) {
      return {
        accessToken: instance.access_token_encrypted,
        phoneNumberId: instance.phone_number_id,
        businessAccountId: instance.business_account_id ?? '',
        wabaId: instance.waba_id ?? undefined,
      };
    }
  }

  const { data: settings, error } = await supabase
    .from('organization_settings')
    .select('meta_access_token_encrypted, meta_business_account_id')
    .eq('organization_id', organizationId)
    .single();

  if (error) throw error;

  if (!settings?.meta_access_token_encrypted) {
    throw new Error(
      'Meta API not configured. Go to Settings > WhatsApp > Configure Meta Business Account.'
    );
  }

  return {
    accessToken: settings.meta_access_token_encrypted,
    phoneNumberId: '',
    businessAccountId: settings.meta_business_account_id ?? '',
  };
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `sha256=${expected}` === signature;
}

export function generateWebhookVerifyToken(): string {
  return randomBytes(32).toString('hex');
}

export function formatPhoneForWhatsApp(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    return cleaned.slice(1);
  }
  if (!cleaned.startsWith('55')) {
    return `55${cleaned}`;
  }
  return cleaned;
}

export function parseWhatsAppPhone(remoteJid: string): string {
  return remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '');
}