/**
 * Meta WhatsApp Cloud API Client
 * Graph API v25.0 - https://developers.facebook.com/docs/whatsapp
 */

import type {
  MetaCredentials,
  MetaSendMessageRequest,
  MetaSendMessageResponse,
  MetaTemplate,
} from './types';

const META_API_VERSION = 'v25.0';
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
    language: string = 'pt_BR',
    components?: Array<{ type: string; parameters?: Array<{ type: string; text: string }> }>
  ): Promise<MetaSendMessageResponse> {
    const payload: MetaSendMessageRequest = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        ...(components && { components }),
      },
    };

    return this.sendMessage(payload);
  }

  async sendMedia(
    to: string,
    mediaType: 'image' | 'audio' | 'video' | 'document',
    mediaId: string,
    caption?: string
  ): Promise<MetaSendMessageResponse> {
    const payload: MetaSendMessageRequest = {
      messaging_product: 'whatsapp',
      to,
      type: mediaType,
      [mediaType]: { id: mediaId, ...(caption && { caption }) },
    };

    return this.sendMessage(payload);
  }

  async getTemplates(businessAccountId: string): Promise<MetaTemplate[]> {
    const response = await this.request<{ data: MetaTemplate[] }>(
      `/${businessAccountId}/message_templates`
    );
    return response.data ?? [];
  }

  async getMediaUrl(mediaId: string): Promise<{ url: string; mime_type?: string }> {
    // Include phone_number_id for media ID lookup
    const response = await this.request<{ url: string; mime_type: string }>(`/${mediaId}?phone_number_id=${this.phoneNumberId}`);
    return response;
  }

  /**
   * Download media directly from Meta's media URL
   * The media URL from getMediaUrl expires after ~5 minutes, so we need to fetch fresh URL
   */
  async downloadMedia(mediaUrl: string): Promise<{ data: ArrayBuffer; contentType: string }> {
    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status} ${response.statusText}`);
    }

    return {
      data: await response.arrayBuffer(),
      contentType: response.headers.get('content-type') || 'application/octet-stream',
    };
  }

  async uploadMedia(
    mediaUrl: string,
    type: 'image' | 'audio' | 'video' | 'document'
  ): Promise<{ id: string }> {
    const formData = new FormData();
    formData.append('file', mediaUrl);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', type);

    const response = await this.request<{ id: string }>(`/${this.phoneNumberId}/media`, {
      method: 'POST',
      body: formData as any,
    });

    return response;
  }
}

export function createMetaClient(credentials: MetaCredentials): MetaWhatsAppClient {
  return new MetaWhatsAppClient(credentials);
}