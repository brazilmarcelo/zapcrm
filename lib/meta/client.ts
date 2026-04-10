/**
 * Meta WhatsApp Cloud API Client
 * Graph API v21.0 - https://developers.facebook.com/docs/whatsapp
 */

import type {
  MetaCredentials,
  MetaSendMessageRequest,
  MetaSendMessageResponse,
  MetaTemplate,
} from './types';

const META_API_VERSION = 'v21.0';
const META_GRAPH_BASE_URL = 'https://graph.facebook.com';

export class MetaWhatsAppClient {
  private accessToken: string;
  private phoneNumberId: string;
  private baseUrl: string;

  constructor(credentials: MetaCredentials) {
    this.accessToken = credentials.accessToken;
    this.phoneNumberId = credentials.phoneNumberId;
    this.baseUrl = `${META_GRAPH_BASE_URL}/${META_API_VERSION}`;
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
      const errorMessage = error.error?.message || JSON.stringify(error);
      throw new Error(`Meta API error ${response.status}: ${errorMessage}`);
    }

    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  async sendMessage(message: MetaSendMessageRequest): Promise<MetaSendMessageResponse> {
    return this.request<MetaSendMessageResponse>(`/${this.phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  async sendText(
    to: string,
    text: string,
    contextMessageId?: string
  ): Promise<MetaSendMessageResponse> {
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

  async sendTemplate(
    to: string,
    templateName: string,
    language: string,
    components?: Array<{ type: string; parameters?: Array<{ type: string; text?: string }> }>
  ): Promise<MetaSendMessageResponse> {
    const payload: MetaSendMessageRequest = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: components as any,
      },
    };

    return this.sendMessage(payload);
  }

  async sendMedia(
    to: string,
    mediaType: 'image' | 'audio' | 'video' | 'document',
    media: { id?: string; link?: string },
    caption?: string,
    filename?: string
  ): Promise<MetaSendMessageResponse> {
    const mediaPayload = { ...media };
    if (caption) (mediaPayload as Record<string, unknown>).caption = caption;
    if (filename && mediaType === 'document') {
      (mediaPayload as Record<string, unknown>).filename = filename;
    }

    const payload: MetaSendMessageRequest = {
      messaging_product: 'whatsapp',
      to,
      type: mediaType,
      [mediaType]: mediaPayload,
    };

    return this.sendMessage(payload);
  }

  async getTemplates(businessAccountId: string): Promise<MetaTemplate[]> {
    const response = await this.request<{ data: MetaTemplate[] }>(
      `/${businessAccountId}/message_templates`
    );
    return response.data ?? [];
  }

  async getMediaUrl(mediaId: string): Promise<{ url: string }> {
    return this.request(`/${mediaId}`);
  }

  async uploadMedia(
    mediaUrl: string,
    type: 'image' | 'audio' | 'video' | 'document'
  ): Promise<{ id: string }> {
    const formData = new FormData();
    formData.append('file', mediaUrl);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', type);

    return this.request('/${this.phoneNumberId}/media', {
      method: 'POST',
      body: formData as unknown as string,
    });
  }
}

export function createMetaClient(credentials: MetaCredentials): MetaWhatsAppClient {
  if (!credentials.accessToken) {
    throw new Error('Access token is required');
  }
  if (!credentials.phoneNumberId) {
    throw new Error('Phone number ID is required');
  }
  return new MetaWhatsAppClient(credentials);
}