/**
 * Meta WhatsApp Cloud API Type Definitions
 */

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
    components?: Array<{
      type: string;
      parameters?: Array<{
        type: string;
        text?: string;
        image?: string;
        document?: string;
        video?: string;
      }>;
    }>;
  };
  context?: { message_id: string };
}

export interface MetaSendMessageResponse {
  messaging_product: string;
  contacts: Array<{ profile: { name: string }; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string; sha256: string };
  video?: { id: string; mime_type: string; sha256: string; caption?: string };
  document?: { id: string; filename: string; mime_type: string; sha256: string };
  button?: { payload: string; text: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description: string };
  };
  system?: { body: string; type: string; identity?: { acknowledged: boolean; fingerprint: string } };
  context?: { from: string; id: string; referred_type?: string };
}

export interface MetaWebhookStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

export interface MetaWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: { display_phone_number: string; phone_number_id: string };
      messages?: MetaWebhookMessage[];
      statuses?: MetaWebhookStatus[];
    };
    field: string;
  }>;
}

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

export interface MetaTemplateComponent {
  type: 'BODY' | 'HEADER' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
    payload?: string;
  }>;
}

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'INACTIVE';
  components: MetaTemplateComponent[];
}

export interface WhatsAppTemplate {
  id: string;
  organization_id: string;
  instance_id?: string;
  meta_template_id: string;
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  status: string;
  content: Record<string, unknown>;
  components: MetaTemplateComponent[];
}