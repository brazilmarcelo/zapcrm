/**
 * WhatsApp AI Agent v2 - Autonomous Intelligence
 *
 * This module orchestrates the complete AI agent pipeline:
 *
 * 1. Receive incoming WhatsApp message
 * 2. Check if AI should respond (active, working hours, etc.)
 * 3. Run Intelligence Engine (extract intents, memories, score, labels)
 * 4. Save extracted memories
 * 5. Update lead score
 * 6. Auto-assign labels
 * 7. Schedule smart follow-ups if needed
 * 8. Smart-pause if needed (customer wants human, negative sentiment)
 * 9. Build context from conversation history + CRM data + MEMORIES
 * 10. Generate AI response via configured provider
 * 11. Send response back via Evolution API
 * 12. Auto-create CRM contacts/deals if configured
 * 13. Generate conversation summary periodically
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { WhatsAppConversation, WhatsAppAIConfig, WhatsAppMessage, ChatMemory } from '@/types/whatsapp';
import {
  getMessages,
  insertMessage,
  insertAILog,
  getAIConfig,
  updateConversation,
} from '@/lib/supabase/whatsapp';
import {
  getMemories,
  saveExtractedMemories,
  upsertLeadScore,
  getLeadScore,
  assignLabelByName,
  ensureDefaultLabels,
  createFollowUp,
  cancelPendingFollowUps,
  insertSummary,
} from '@/lib/supabase/whatsappIntelligence';
import { analyzeMessage } from '@/lib/evolution/intelligence';
import * as evolution from '@/lib/evolution/client';
import { buildReservationSystemPrompt, buildReservationTools } from './reservationTools';
import { getOrganizationBrandRuntime } from '@/lib/branding/server';

interface AIAgentContext {
  supabase: SupabaseClient;
  conversation: WhatsAppConversation;
  instance: {
    id: string;
    organization_id: string;
    // Evolution (legacy)
    evolution_instance_name?: string;
    instance_token?: string;
    evolution_api_url?: string;
    // Meta Cloud API
    phone_number_id?: string;
    access_token?: string;
  };
  incomingMessage: WhatsAppMessage;
}

// =============================================================================
// WORKING HOURS
// =============================================================================

function isWithinWorkingHours(config: WhatsAppAIConfig): boolean {
  if (!config.working_hours_start || !config.working_hours_end) return true;

  // Use São Paulo timezone (UTC-3) — Vercel runs in UTC
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const day = now.getDay();

  if (!config.working_days.includes(day)) return false;

  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return currentTime >= config.working_hours_start && currentTime <= config.working_hours_end;
}

// =============================================================================
// CONTEXT BUILDERS
// =============================================================================

async function buildConversationContext(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 20,
): Promise<string> {
  const messages = await getMessages(supabase, conversationId, { limit });

  return messages
    .map((msg) => {
      const sender = msg.from_me ? 'Assistente' : 'Cliente';
      const content = msg.text_body || `[${msg.message_type}]`;
      return `${sender}: ${content}`;
    })
    .join('\n');
}

async function buildCRMContext(
  supabase: SupabaseClient,
  conversation: WhatsAppConversation,
): Promise<string> {
  const parts: string[] = [];

  if (conversation.contact_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('name, email, phone, status, stage, total_value, notes, last_interaction')
      .eq('id', conversation.contact_id)
      .single();

    if (contact) {
      parts.push(`CONTATO CRM: ${contact.name || 'Sem nome'}`);
      if (contact.email) parts.push(`Email: ${contact.email}`);
      if (contact.status) parts.push(`Status: ${contact.status}`);
      if (contact.total_value) parts.push(`Valor total: R$ ${contact.total_value}`);
      if (contact.notes) parts.push(`Notas: ${contact.notes}`);
    }

    const { data: deals } = await supabase
      .from('deals')
      .select('title, value, priority, tags, ai_summary, board_stages(label)')
      .eq('contact_id', conversation.contact_id)
      .eq('is_won', false)
      .eq('is_lost', false)
      .limit(5);

    if (deals && deals.length > 0) {
      parts.push('\nNEGOCIOS ABERTOS:');
      for (const deal of deals) {
        const stage = (deal.board_stages as { label?: string } | null)?.label ?? 'N/A';
        parts.push(`- ${deal.title} | R$ ${deal.value ?? 0} | Estagio: ${stage} | Prioridade: ${deal.priority ?? 'N/A'}`);
      }
    }
  }

  return parts.join('\n');
}

function buildMemoryContext(memories: ChatMemory[]): string {
  if (memories.length === 0) return '';

  const parts = ['\nMEMORIAS DO CONTATO (use estas informacoes na conversa):'];

  const grouped = new Map<string, ChatMemory[]>();
  for (const mem of memories) {
    const group = grouped.get(mem.memory_type) || [];
    group.push(mem);
    grouped.set(mem.memory_type, group);
  }

  const typeLabels: Record<string, string> = {
    family: 'Familia',
    preference: 'Preferencias',
    budget: 'Orcamento',
    interest: 'Interesses',
    timeline: 'Prazos/Datas',
    objection: 'Objecoes levantadas',
    personal: 'Info pessoal',
    fact: 'Fatos',
    interaction: 'Estilo de comunicacao',
  };

  for (const [type, mems] of grouped.entries()) {
    parts.push(`\n${typeLabels[type] || type}:`);
    for (const m of mems) {
      parts.push(`  - ${m.key}: ${m.value}`);
    }
  }

  return parts.join('\n');
}

// =============================================================================
// MEDIA PROCESSING (Audio transcription + Image analysis)
// =============================================================================

/**
 * Transcribe audio message using OpenAI Whisper API or Gemini.
 * Supports both Evolution API (base64) and Meta Cloud API (URL).
 */
async function transcribeAudio(
  supabase: SupabaseClient,
  organizationId: string,
  instance: AIAgentContext['instance'],
  message: { meta_message_id?: string; media_url?: string; media_mime_type?: string },
): Promise<string | null> {
  try {
    // Get API keys and provider preference
    const { data: orgSettings } = await supabase
      .from('organization_settings')
      .select('ai_provider, ai_openai_key, ai_google_key, ai_anthropic_key')
      .eq('organization_id', organizationId)
      .single();

    const provider = orgSettings?.ai_provider ?? 'openai';
    const hasOpenAI = !!orgSettings?.ai_openai_key;
    const hasGoogle = !!orgSettings?.ai_google_key;

    // Download audio content
    let audioData: { base64: string; mimetype: string } | null = null;

    // For Meta Cloud API - download from media URL
    if (message.media_url && (message.media_url.startsWith('http') || message.meta_message_id)) {
      const { createMetaClient } = await import('@/lib/meta/client');
      const { getMetaCredentials } = await import('@/lib/meta/helpers');
      
      try {
        // Get the actual media URL if we only have the ID
        let mediaUrl = message.media_url;
        if (message.meta_message_id && !message.media_url.startsWith('http')) {
          const creds = await getMetaCredentials(supabase, organizationId, instance.id);
          const metaClient = createMetaClient(creds);
          const mediaData = await metaClient.getMediaUrl(message.meta_message_id);
          mediaUrl = mediaData.url;
        }

        // Download the audio file
        const response = await fetch(mediaUrl, {
          headers: { Authorization: `Bearer ${(await getMetaCredentials(supabase, organizationId, instance.id)).accessToken}` }
        });
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          audioData = {
            base64,
            mimetype: message.media_mime_type || 'audio/ogg'
          };
        }
      } catch (err) {
        console.warn('[ai-agent] Failed to download audio from Meta:', err);
      }
    }

    // If we have audio data, transcribe it
    if (audioData) {
      // Use configured provider
      if (provider === 'openai' && hasOpenAI) {
        console.log('[ai-agent] Transcribing audio with OpenAI Whisper');
        const audioBuffer = Buffer.from(audioData.base64, 'base64');
        
        const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
        const ext = audioData.mimetype.includes('ogg') ? 'ogg' : 'mp3';
        const body = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${audioData.mimetype}\r\n\r\n`),
          audioBuffer,
          Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\npt\r\n--${boundary}--\r\n`),
        ]);

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${orgSettings!.ai_openai_key}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body,
        });

        if (response.ok) {
          const result = await response.json() as { text: string };
          console.log('[ai-agent] Audio transcribed:', result.text?.slice(0, 100));
          return result.text || null;
        }
        console.warn('[ai-agent] Whisper API failed:', response.status);
      }

      // Fallback: Use Gemini for audio understanding
      if (hasGoogle) {
        console.log('[ai-agent] Transcribing audio with Gemini');
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        const { generateText } = await import('ai');
        const google = createGoogleGenerativeAI({ apiKey: orgSettings!.ai_google_key! });

        const result = await generateText({
          model: google('gemini-2.5-flash'),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Transcreva este áudio em português. Retorne APENAS o texto falado, sem comentários.' },
                {
                  type: 'file',
                  data: audioData.base64,
                  mimeType: audioData.mimetype as any,
                } as any,
              ],
            },
          ],
        });

        console.log('[ai-agent] Audio transcribed via Gemini:', result.text?.slice(0, 100));
        return result.text || null;
      }
    }

    console.warn('[ai-agent] No audio data or API key available for transcription');
    return null;
  } catch (err) {
    console.error('[ai-agent] Audio transcription failed:', err);
    return null;
  }
}

/**
 * Analyze an image message using multimodal AI.
 * Supports both Meta Cloud API and Evolution API.
 * Uses configured AI provider (Google/OpenAI/Anthropic).
 */
async function analyzeImage(
  supabase: SupabaseClient,
  organizationId: string,
  instance: AIAgentContext['instance'],
  messageIdOrUrl?: string,
  caption?: string,
  conversationContext?: string,
): Promise<{ description: string; isRelevant: boolean } | null> {
  try {
    // Get API keys and provider preference
    const { data: orgSettings } = await supabase
      .from('organization_settings')
      .select('ai_provider, ai_google_key, ai_openai_key, ai_anthropic_key')
      .eq('organization_id', organizationId)
      .single();

    const provider = orgSettings?.ai_provider ?? 'openai';
    const hasOpenAI = !!orgSettings?.ai_openai_key;
    const hasGoogle = !!orgSettings?.ai_google_key;
    const hasAnthropic = !!orgSettings?.ai_anthropic_key;

    // Download image content
    let imageData: { base64: string; mimetype: string } | null = null;

    // For Meta Cloud API - download from media URL
    if (messageIdOrUrl && (messageIdOrUrl.startsWith('http') || messageIdOrUrl.startsWith('wamid'))) {
      const { createMetaClient } = await import('@/lib/meta/client');
      const { getMetaCredentials } = await import('@/lib/meta/helpers');
      
      try {
        // Get the actual media URL if we only have the ID
        let mediaUrl = messageIdOrUrl;
        if (messageIdOrUrl.startsWith('wamid')) {
          const creds = await getMetaCredentials(supabase, organizationId, instance.id);
          const metaClient = createMetaClient(creds);
          const mediaData = await metaClient.getMediaUrl(messageIdOrUrl);
          mediaUrl = mediaData.url;
        }

        // Download the image file
        const response = await fetch(mediaUrl, {
          headers: { Authorization: `Bearer ${(await getMetaCredentials(supabase, organizationId, instance.id)).accessToken}` }
        });
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          imageData = { base64, mimetype: contentType };
        }
      } catch (err) {
        console.warn('[ai-agent] Failed to download image from Meta:', err);
      }
    }

    // Try Evolution API if no Meta image data
    if (!imageData) {
      const inst = instance as any;
      if (inst.evolution_instance_name && inst.instance_token) {
        const creds: evolution.EvolutionCredentials = {
          baseUrl: inst.evolution_api_url || '',
          apiKey: inst.instance_token || '',
          instanceName: inst.evolution_instance_name || '',
        };

        if (messageIdOrUrl && !messageIdOrUrl.startsWith('http') && !messageIdOrUrl.startsWith('wamid')) {
          try {
            const media = await evolution.getBase64FromMedia(creds, messageIdOrUrl);
            if (media?.base64) {
              imageData = { base64: media.base64, mimetype: media.mimetype || 'image/jpeg' };
            }
          } catch (err) {
            console.warn('[ai-agent] Failed to download image from Evolution:', err);
          }
        }
      }
    }

    if (!imageData) {
      console.warn('[ai-agent] No image data available for analysis');
      return null;
    }

    // Get brand context for system prompt
    const brandRuntime = await getOrganizationBrandRuntime(supabase, organizationId);
    const clinicName = brandRuntime.assistantName || 'Clínica';
    
    const systemPrompt = `Você é a assistente virtual da ${clinicName}.
Analise esta imagem enviada por um cliente no WhatsApp.

Contexto da conversa: ${conversationContext || 'Início de conversa'}
${caption ? `Legenda da imagem: ${caption}` : ''}

Responda em JSON com:
- "description": breve descrição do que está na imagem (1-2 frases)
- "isRelevant": true se a imagem é relevante para o atendimento (comprovante de pagamento, foto do evento, print de reserva, documentos, etc), false se é irrelevante (meme, foto pessoal aleatória, etc)
- "response_suggestion": se relevante, sugira como responder. Se irrelevante, null.

Responda APENAS o JSON, sem markdown.`;

    // Use configured provider for image analysis
    if (provider === 'google' && hasGoogle) {
      console.log('[ai-agent] Analyzing image with Gemini');
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      const { generateText } = await import('ai');
      const google = createGoogleGenerativeAI({ apiKey: orgSettings!.ai_google_key! });

      const result = await generateText({
        model: google('gemini-2.5-flash'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: systemPrompt },
              {
                type: 'image',
                image: imageData.base64,
                mimeType: imageData.mimetype as any,
              } as any,
            ],
          },
        ],
      });

      try {
        const parsed = JSON.parse(result.text.replace(/```json\n?|\n?```/g, '').trim());
        return { description: parsed.description, isRelevant: parsed.isRelevant ?? false };
      } catch {
        return { description: result.text, isRelevant: true };
      }
    }

    // Fallback to OpenAI Vision
    if (hasOpenAI) {
      console.log('[ai-agent] Analyzing image with OpenAI Vision');
      const { createOpenAI } = await import('@ai-sdk/openai');
      const { generateText } = await import('ai');
      const openai = createOpenAI({ apiKey: orgSettings!.ai_openai_key! });

      const result = await generateText({
        model: openai('gpt-4o-mini'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: systemPrompt },
              {
                type: 'image',
                image: imageData.base64,
                mimeType: imageData.mimetype as any,
              } as any,
            ],
          },
        ],
      });

      try {
        const parsed = JSON.parse(result.text.replace(/```json\n?|\n?```/g, '').trim());
        return { description: parsed.description, isRelevant: parsed.isRelevant ?? false };
      } catch {
        return { description: result.text, isRelevant: true };
      }
    }

    console.warn('[ai-agent] No AI provider available for image analysis');
    return null;
  } catch (err) {
    console.error('[ai-agent] Image analysis failed:', err);
    return null;
  }
}

// =============================================================================
// AI RESPONSE GENERATOR
// =============================================================================

async function generateAIResponse(
  supabase: SupabaseClient,
  organizationId: string,
  config: WhatsAppAIConfig,
  conversationHistory: string,
  crmContext: string,
  memoryContext: string,
  incomingText: string,
  customerInfo: { phone: string; name: string }
): Promise<string> {
  console.log('[ai-agent] generateAIResponse called');

  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('ai_provider, ai_model, ai_google_key, ai_openai_key, ai_anthropic_key')
    .eq('organization_id', organizationId)
    .single();

  console.log('[ai-agent] Org settings:', { provider: orgSettings?.ai_provider, model: orgSettings?.ai_model, hasOpenAI: !!orgSettings?.ai_openai_key });

  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('ai_provider, ai_model, ai_google_key, ai_openai_key, ai_anthropic_key')
    .eq('user_id', organizationId)
    .maybeSingle();

  const provider = orgSettings?.ai_provider ?? 'google';
  const model = orgSettings?.ai_model ?? 'gpt-4o-mini';

  let apiKey: string | undefined;
  if (provider === 'google') apiKey = orgSettings?.ai_google_key || userSettings?.ai_google_key;
  else if (provider === 'openai') apiKey = orgSettings?.ai_openai_key || userSettings?.ai_openai_key;
  else if (provider === 'anthropic') apiKey = orgSettings?.ai_anthropic_key || userSettings?.ai_anthropic_key;

  console.log('[ai-agent] API Key check:', { provider, model, hasApiKey: !!apiKey, keyPrefix: apiKey?.slice(0, 10) });

  if (!apiKey) {
    console.log('[ai-agent] NO API KEY - returning transfer message');
    return config.transfer_message || 'Um atendente humano ira continuar o atendimento.';
  }

  // Current date/time in São Paulo timezone
  const now = new Date();
  const spFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const currentDateTimeSP = spFormatter.format(now);
  const brandRuntime = await getOrganizationBrandRuntime(supabase, organizationId);
  const bookingLink = brandRuntime.reservationUrl.trim();

  const systemPrompt = [
    config.system_prompt,
    '',
    `Seu nome: ${config.agent_name}`,
    `Seu papel: ${config.agent_role || brandRuntime.assistantRole || 'Atendente virtual'}`,
    `Tom: ${config.agent_tone}`,
    `Data e hora atual: ${currentDateTimeSP} (horário de Brasília)`,
    `Ano atual: ${now.getFullYear()}`,
    '',
    'REGRAS:',
    '- Responda APENAS em texto simples (sem formatação, asteriscos ou emojis em excesso)',
    '- Seja conciso, mas divida bem o texto: QUEBRE sua resposta em 2 ou 3 parágrafos curtos. NUNCA envie um "blocão" único de texto',
    '- Se nao souber a resposta, informe que ira encaminhar para um atendente',
    '- Nunca invente informacoes sobre produtos ou precos',
    '- USE AS MEMORIAS DO CONTATO para personalizar a conversa',
    '- Se o cliente mencionou o nome de alguem (esposo, filha, etc), use o nome na conversa',
    '- Seja natural e humano, nao robotico',
    '- NUNCA colete dados de reserva (nome, data, horário, etc) pelo WhatsApp.',
    bookingLink
      ? `- Para reservas, SEMPRE direcione ao link oficial da operação: ${bookingLink}`
      : '- Para reservas, use as ferramentas para consultar disponibilidade e informe que o link oficial será enviado pela equipe.',
    '- Quando o assunto for reserva, use as ferramentas (tools) para consultar disponibilidade antes de orientar o cliente',
    crmContext ? `\nCONTEXTO CRM:\n${crmContext}` : '',
    memoryContext || '',
  ].filter(Boolean).join('\n');

  // Add reservation context if configured
  const reservationContext = await buildReservationSystemPrompt(supabase, organizationId);
  const fullSystemPrompt = reservationContext
    ? `${systemPrompt}\n\n${reservationContext}`
    : systemPrompt;

  const messages = [
    { role: 'system' as const, content: fullSystemPrompt },
    ...(conversationHistory
      ? conversationHistory.split('\n')
          .filter(line => line.trim().length > 0)
          .map((line) => {
            const isAssistant = line.startsWith('Assistente:');
            const content = line.replace(/^(Assistente|Cliente): /, '').trim();
            return {
              role: isAssistant ? ('assistant' as const) : ('user' as const),
              content: content || '...',
            };
          })
          .filter(msg => msg.content.length > 0)
      : []),
    ...(incomingText?.trim() ? [{ role: 'user' as const, content: incomingText.trim() }] : []),
  ];

  const { generateText } = await import('ai');

  let modelInstance;
  if (provider === 'google') {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    const google = createGoogleGenerativeAI({ apiKey });
    modelInstance = google(model);
  } else if (provider === 'openai') {
    const { createOpenAI } = await import('@ai-sdk/openai');
    const openai = createOpenAI({ apiKey });
    modelInstance = openai(model);
  } else {
    const { createAnthropic } = await import('@ai-sdk/anthropic');
    const anthropic = createAnthropic({ apiKey });
    modelInstance = anthropic(model);
  }

  const reservationTools = await buildReservationTools(supabase, organizationId, customerInfo);
  const hasTools = Object.keys(reservationTools).length > 0;

  console.log('[ai-agent] Calling generateText with provider:', provider, 'model:', model, 'hasTools:', hasTools);
  console.log('[ai-agent] Messages count:', messages.length);

  // Some preview models don't support tools well — try with tools first, fall back without
  let result;
  try {
    console.log('[ai-agent] Calling generateText (attempt 1 with tools)...');
    result = await generateText({
      model: modelInstance,
      messages,
      ...(hasTools ? { maxSteps: 5, tools: reservationTools } : {}),
    } as any);
    console.log('[ai-agent] generateText success');
  } catch (toolErr) {
    console.warn('[ai-agent] generateText with tools failed, retrying without tools:', toolErr instanceof Error ? toolErr.message : String(toolErr));
    // Retry without tools
    console.log('[ai-agent] Calling generateText (attempt 2 without tools)...');
    result = await generateText({
      model: modelInstance,
      messages,
    } as any);
    console.log('[ai-agent] generateText success (retry)');
  }

  console.log('[ai-agent] generateText result - text length:', result.text?.length ?? 0,
    'steps:', (result as any).steps?.length ?? 0,
    'toolCalls:', (result as any).toolCalls?.length ?? 0,
    'toolResults:', (result as any).toolResults?.length ?? 0);

  // If result.text is empty (e.g., model ended on a tool call without final text),
  // try to extract a meaningful response from the last step's text or tool results
  if (result.text) {
    return result.text;
  }

  // Check if there are step results with text
  const steps = (result as any).steps as Array<{ text?: string; toolResults?: Array<{ output: unknown; result: unknown }> }> | undefined;
  if (steps && steps.length > 0) {
    // Find the last step with text
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].text && (steps[i].text as string).trim().length > 0) {
        return steps[i].text as string;
      }
    }

    // If no text in any step, build a response from tool results
    // AI SDK v6 uses `output` field, older versions use `result`
    const lastToolResults = steps.flatMap(s => s.toolResults || []);
    if (lastToolResults.length > 0) {
      const lastEntry = lastToolResults[lastToolResults.length - 1];
      // AI SDK v6 stores tool output in `output`, fallback to `result` for compat
      const rawOutput = (lastEntry as any)?.output ?? lastEntry?.result;
      const lastResult: Record<string, unknown> | undefined =
        typeof rawOutput === 'string' ? JSON.parse(rawOutput) :
        typeof rawOutput === 'object' && rawOutput !== null ? rawOutput as Record<string, unknown> :
        undefined;

      if (!lastResult) {
        console.warn('[ai-agent] Tool result is undefined/empty');
      } else {
        console.log('[ai-agent] No text from model, using tool output:', JSON.stringify(lastResult).slice(0, 200));

        // Helper: format YYYY-MM-DD to dd/mm/yyyy
        const formatDate = (d: string) => {
          const parts = String(d).split('-');
          if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
          return d;
        };

        // Build a meaningful fallback from tool data
        if (lastResult.available === true) {
          const slots = (lastResult.available_time_slots as Array<{ time: string; available_pax_capacity: number }>) || [];
          const slotsText = slots.map(s => s.time).join(', ');
          const dateFormatted = formatDate(lastResult.date as string);
          if (typeof lastResult.booking_link === 'string' && lastResult.booking_link) {
            return `Temos disponibilidade na ${lastResult.unit_name} no dia ${dateFormatted}! Horários: ${slotsText}.\n\nPara fazer sua reserva, acesse:\n${lastResult.booking_link}`;
          }
          return `Temos disponibilidade na ${lastResult.unit_name} no dia ${dateFormatted}! Horários: ${slotsText}. Se quiser seguir com a reserva, a equipe pode te enviar o link oficial.`;
        } else if (lastResult.available === false) {
          return (lastResult.message as string) || 'Infelizmente não há disponibilidade nessa data. Gostaria de consultar outra data ou unidade?';
        } else if (lastResult.has_reservations === true) {
          const res = (lastResult.reservations as Array<{ date: string; time: string; unit_name: string }>) || [];
          const resText = res.map(r => `${formatDate(r.date)} às ${r.time} na ${r.unit_name}`).join('; ');
          return `Encontrei sua(s) reserva(s): ${resText}. Qualquer dúvida, estou aqui!`;
        }
      }
    }
  }

  console.warn('[ai-agent] generateText returned empty text, no usable steps. Full result keys:', Object.keys(result));
  return config.transfer_message || 'Desculpe, nao consegui processar sua mensagem.';
}

// =============================================================================
// AUTO-CREATE CRM ENTITIES
// =============================================================================

async function autoCreateContact(
  supabase: SupabaseClient,
  conversation: WhatsAppConversation,
  config: WhatsAppAIConfig,
): Promise<string | null> {
  if (!config.auto_create_contact) return null;
  if (conversation.contact_id) return conversation.contact_id;

  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone', conversation.phone)
    .eq('organization_id', conversation.organization_id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('whatsapp_conversations')
      .update({ contact_id: existing.id })
      .eq('id', conversation.id);
    return existing.id;
  }

  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      name: conversation.contact_name || conversation.phone,
      phone: conversation.phone,
      organization_id: conversation.organization_id,
      source: 'whatsapp',
      status: 'ACTIVE',
    })
    .select('id')
    .single();

  if (error || !newContact) return null;

  await supabase
    .from('whatsapp_conversations')
    .update({ contact_id: newContact.id })
    .eq('id', conversation.id);

  await insertAILog(supabase, {
    conversation_id: conversation.id,
    organization_id: conversation.organization_id,
    action: 'contact_created',
    details: { contact_id: newContact.id, phone: conversation.phone },
    triggered_by: 'ai',
  });

  return newContact.id;
}

async function autoCreateDeal(
  supabase: SupabaseClient,
  conversation: WhatsAppConversation,
  contactId: string,
  config: WhatsAppAIConfig,
): Promise<void> {
  if (!config.auto_create_deal || !config.default_board_id) return;

  const { data: existingDeal } = await supabase
    .from('deals')
    .select('id')
    .eq('contact_id', contactId)
    .eq('board_id', config.default_board_id)
    .eq('is_won', false)
    .eq('is_lost', false)
    .maybeSingle();

  if (existingDeal) return;

  let stageId = config.default_stage_id;
  if (!stageId) {
    const { data: firstStage } = await supabase
      .from('board_stages')
      .select('id')
      .eq('board_id', config.default_board_id)
      .order('order', { ascending: true })
      .limit(1)
      .single();
    if (!firstStage) return;
    stageId = firstStage.id;
  }

  const { data: deal, error } = await supabase
    .from('deals')
    .insert({
      title: `WhatsApp - ${conversation.contact_name || conversation.phone}`,
      board_id: config.default_board_id,
      stage_id: stageId,
      contact_id: contactId,
      organization_id: conversation.organization_id,
      tags: config.default_tags ?? [],
      priority: 'medium',
    })
    .select('id')
    .single();

  if (error || !deal) return;

  await insertAILog(supabase, {
    conversation_id: conversation.id,
    organization_id: conversation.organization_id,
    action: 'deal_created',
    details: { deal_id: deal.id, board_id: config.default_board_id },
    triggered_by: 'ai',
  });
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

export async function processIncomingMessage(ctx: AIAgentContext): Promise<void> {
  const { supabase, conversation, instance, incomingMessage } = ctx;

  console.log('[ai-agent] processIncomingMessage called:', { conversationId: conversation.id, messageId: incomingMessage.id });

  const config = await getAIConfig(supabase, instance.id);
  console.log('[ai-agent] AI Config:', { configExists: !!config, config });

  if (!config) return;

  if (!conversation.ai_active) return;

  // -- DEBOUNCE via latest message ID --
  // We save the ID of the message that triggered THIS webhook.
  // After waiting, we check if a NEWER customer message arrived.
  // If so, that newer webhook will handle processing — we bail out.
  const triggerMessageId = incomingMessage.id;

  // Wait 5 seconds for message batching (short enough to stay within Vercel limits)
  console.log('[ai-agent] Waiting 5 seconds for batching...');
  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log('[ai-agent] Done waiting');

  // Re-fetch conversation to get latest state
  const { data: freshConv } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('id', conversation.id)
    .single();

  console.log('[ai-agent] Fresh conversation:', { freshConvExists: !!freshConv, aiActive: freshConv?.ai_active });

  if (!freshConv || !freshConv.ai_active) return;

  // Check if a newer customer message arrived after ours
  const { data: newerMessages } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('conversation_id', conversation.id)
    .eq('from_me', false)
    .gt('created_at', incomingMessage.created_at || new Date().toISOString())
    .limit(1);

  console.log('[ai-agent] Newer messages check:', { count: newerMessages?.length });

  if (newerMessages && newerMessages.length > 0) {
    console.log('[ai-agent] Newer message arrived, deferring to its webhook', conversation.id);
    return;
  }

  console.log('[ai-agent] Proceeding to execute AI for conversation:', conversation.id);
  try {
    await _executeAIAfterBatch(ctx, freshConv as WhatsAppConversation, config);
  } catch (e) {
    console.error('[ai-agent] Batch execution failed:', e);
    // Log error to DB so we can see it
    await insertAILog(supabase, {
      conversation_id: conversation.id,
      organization_id: instance.organization_id,
      action: 'error',
      details: { error: e instanceof Error ? e.message : String(e), phase: 'batch_execution' },
      triggered_by: 'ai',
    });
  }
}

async function _executeAIAfterBatch(ctx: AIAgentContext, conversation: WhatsAppConversation, config: WhatsAppAIConfig): Promise<void> {
  const { supabase, instance } = ctx;

  console.log('[ai-agent] _executeAIAfterBatch started');

  // Check working hours
  const workingHoursOk = isWithinWorkingHours(config);
  console.log('[ai-agent] Working hours check:', { ok: workingHoursOk, start: config.working_hours_start, end: config.working_hours_end });

  if (!workingHoursOk) {
    console.log('[ai-agent] Outside working hours, sending outside_hours_message if configured');
    if (config.outside_hours_message) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: existingMsg } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('conversation_id', conversation.id)
        .eq('from_me', true)
        .eq('text_body', config.outside_hours_message)
        .gte('created_at', `${today}T00:00:00`)
        .limit(1);

      if (!existingMsg || existingMsg.length === 0) {
        console.log('[ai-agent] Sending outside hours message');
        await sendAIReply(supabase, instance, conversation, config.outside_hours_message);
      }
    }
    return;
  }

  console.log('[ai-agent] Working hours OK, proceeding...');

  // Auto-create contact
  const contactId = await autoCreateContact(supabase, conversation, config);

  // Auto-create deal
  if (contactId) {
    await autoCreateDeal(supabase, conversation, contactId, config);

    // Sync existing lead score to newly linked contact
    const existingLeadScore = await getLeadScore(supabase, conversation.id);
    if (existingLeadScore && (!existingLeadScore.contact_id || existingLeadScore.contact_id !== contactId)) {
      await supabase
        .from('whatsapp_lead_scores')
        .update({ contact_id: contactId })
        .eq('conversation_id', conversation.id);

      await supabase
        .from('contacts')
        .update({
          temperature: existingLeadScore.temperature,
          lead_score: existingLeadScore.score,
          buying_stage: existingLeadScore.buying_stage,
        })
        .eq('id', contactId);
    }
  }

  // =========================================================================
  // INTELLIGENCE ENGINE - The magic happens here
  // =========================================================================

  // Fetch all unread messages from the customer to form the complete "incomingText"
  const { data: recentMsgs } = await supabase
    .from('whatsapp_messages')
    .select('id, text_body, message_type, media_url, media_caption, media_mime_type, meta_message_id, evolution_message_id')
    .eq('conversation_id', conversation.id)
    .eq('from_me', false)
    .order('created_at', { ascending: false })
    .limit(conversation.unread_count || 1);

  // Process media messages (audio/image) to extract text content
  const textParts: string[] = [];
  let imageAnalysisResult: { description: string; isRelevant: boolean } | null = null;

  if (recentMsgs) {
    for (const msg of recentMsgs.reverse()) {
      if (msg.text_body) {
        textParts.push(msg.text_body);
      } else if (msg.message_type === 'audio' && (msg.meta_message_id || msg.media_url)) {
        // Transcribe audio (supports both Meta and Evolution)
        const transcription = await transcribeAudio(
          supabase, instance.organization_id, instance, 
          { meta_message_id: msg.meta_message_id, media_url: msg.media_url, media_mime_type: msg.media_mime_type }
        );
        if (transcription) {
          textParts.push(transcription);
          // Update the message in DB with the transcription
          await supabase.from('whatsapp_messages')
            .update({ text_body: `[Áudio transcrito]: ${transcription}` })
            .eq('id', msg.id);
          console.log('[ai-agent] Audio transcribed and saved:', transcription.slice(0, 80));
        } else {
          textParts.push('[Cliente enviou um áudio que não pôde ser transcrito]');
        }
      } else if (msg.message_type === 'image' && (msg.meta_message_id || msg.media_url)) {
        // Analyze image (supports both Meta and Evolution)
        const conversationHistory = await buildConversationContext(supabase, conversation.id);
        imageAnalysisResult = await analyzeImage(
          supabase, instance.organization_id, instance,
          msg.meta_message_id || msg.media_url || undefined, msg.media_caption || undefined, conversationHistory,
        );
        if (imageAnalysisResult) {
          if (imageAnalysisResult.isRelevant) {
            textParts.push(`[Cliente enviou uma imagem: ${imageAnalysisResult.description}]`);
          } else {
            textParts.push(`[Cliente enviou uma imagem irrelevante: ${imageAnalysisResult.description}]`);
          }
          if (msg.media_caption) textParts.push(msg.media_caption);
          console.log('[ai-agent] Image analyzed:', imageAnalysisResult.description.slice(0, 80), 'relevant:', imageAnalysisResult.isRelevant);
        } else {
          textParts.push('[Cliente enviou uma imagem]');
          if (msg.media_caption) textParts.push(msg.media_caption);
        }
      } else if (msg.media_caption) {
        textParts.push(msg.media_caption);
      }
    }
  }

  // Group multiple messages safely into a single conceptual paragraph for the AI
  const incomingText = textParts.filter(Boolean).join('\n');

  // Run intelligence and generate response for any processed content
  if (incomingText) {
    const conversationHistory = await buildConversationContext(supabase, conversation.id);
    const existingMemories = await getMemories(supabase, conversation.id);

    const intelligence = await analyzeMessage(
      supabase,
      instance.organization_id,
      conversationHistory,
      incomingText,
      existingMemories,
      config,
    );

    // 1. Save extracted memories
    if (config.memory_enabled && intelligence.memories.length > 0) {
      await saveExtractedMemories(
        supabase,
        conversation.id,
        instance.organization_id,
        contactId ?? undefined,
        intelligence.memories,
        ctx.incomingMessage.id, // Fallback pointing to the trigger message
      );

      await insertAILog(supabase, {
        conversation_id: conversation.id,
        organization_id: instance.organization_id,
        action: 'memory_extracted',
        details: { count: intelligence.memories.length, keys: intelligence.memories.map((m) => m.key) },
        message_id: ctx.incomingMessage.id,
        triggered_by: 'ai',
      });
    }

    // 2. Update lead score
    if (config.lead_scoring_enabled && intelligence.lead_score_delta !== 0) {
      const score = await upsertLeadScore(
        supabase,
        conversation.id,
        instance.organization_id,
        contactId ?? undefined,
        intelligence.lead_score_delta,
        undefined,
        intelligence.buying_stage,
      );

      await insertAILog(supabase, {
        conversation_id: conversation.id,
        organization_id: instance.organization_id,
        action: 'lead_score_updated',
        details: {
          delta: intelligence.lead_score_delta,
          new_score: score.score,
          temperature: score.temperature,
        },
        triggered_by: 'ai',
      });
    }

    // 3. Auto-assign labels
    if (config.auto_label_enabled && intelligence.suggested_labels.length > 0) {
      await ensureDefaultLabels(supabase, instance.organization_id);

      for (const labelName of intelligence.suggested_labels) {
        const assigned = await assignLabelByName(
          supabase,
          conversation.id,
          instance.organization_id,
          labelName,
          'ai',
          `Intent: ${intelligence.intents.map((i) => i.intent).join(', ')}`,
        );

        if (assigned) {
          await insertAILog(supabase, {
            conversation_id: conversation.id,
            organization_id: instance.organization_id,
            action: 'label_assigned',
            details: { label: labelName },
            triggered_by: 'ai',
          });
        }
      }
    }

    // 4. Follow-ups are scheduled AFTER the AI reply (see below)

    // 5. Smart pause
    if (config.smart_pause_enabled && intelligence.should_pause) {
      await updateConversation(supabase, conversation.id, {
        ai_active: false,
        ai_pause_reason: intelligence.pause_reason || 'smart_pause',
      } as Parameters<typeof updateConversation>[2]);

      if (config.transfer_message) {
        await sendAIReply(supabase, instance, conversation, config.transfer_message);
      }

      await insertAILog(supabase, {
        conversation_id: conversation.id,
        organization_id: instance.organization_id,
        action: 'smart_paused',
        details: { reason: intelligence.pause_reason },
        triggered_by: 'ai',
      });

      return; // Don't send AI response, human will handle
    }
  }

  // =========================================================================
  // RESPONSE GENERATION
  // =========================================================================
  console.log('[ai-agent] Starting response generation');

  // Check message limit
  if (config.max_messages_per_conversation) {
    const { count } = await supabase
      .from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversation.id)
      .eq('sent_by', 'ai_agent');

    if (count && count >= config.max_messages_per_conversation) {
      await updateConversation(supabase, conversation.id, {
        ai_active: false,
        ai_pause_reason: 'message_limit_reached',
      } as Parameters<typeof updateConversation>[2]);

      if (config.transfer_message) {
        await sendAIReply(supabase, instance, conversation, config.transfer_message);
      }

      await insertAILog(supabase, {
        conversation_id: conversation.id,
        organization_id: instance.organization_id,
        action: 'escalated',
        details: { reason: 'message_limit_reached' },
        triggered_by: 'ai',
      });
      return;
    }
  }

  // Build context (with memories!)
  const conversationHistory = await buildConversationContext(supabase, conversation.id);
  const crmContext = await buildCRMContext(supabase, conversation);
  const memories = await getMemories(supabase, conversation.id);
  const memoryContext = buildMemoryContext(memories);

  // Check if greeting
  const { count: msgCount } = await supabase
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('from_me', false);

  console.log('[ai-agent] Message count:', msgCount, 'has greeting:', !!config.greeting_message);

  if (msgCount === 1 && config.greeting_message) {
    console.log('[ai-agent] Sending greeting message');
    await sendAIReply(supabase, instance, conversation, config.greeting_message);
    return;
  }

  // Generate AI response with FULL context (memories included!)
  const organizationId = instance.organization_id;
  const historyString = conversationHistory;
  const incomingMessage = ctx.incomingMessage;

  try {
    console.log('[ai-agent] Generating AI response for', conversation.phone, 'provider:', config.system_prompt ? 'has_prompt' : 'no_prompt');

    const aiResponse = await generateAIResponse(
      supabase,
      organizationId,
      config,
      historyString,
      crmContext,
      memoryContext,
      incomingText || (incomingMessage as any).text_body || '',
      { phone: conversation.phone, name: conversation.contact_name || 'Cliente WhatsApp' }
    );

    console.log('[ai-agent] AI response generated, length:', aiResponse.length, 'preview:', aiResponse.slice(0, 100));

    if (config.reply_delay_ms > 0) {
      console.log('[ai-agent] Waiting delay:', config.reply_delay_ms, 'ms');
      await new Promise((resolve) => setTimeout(resolve, config.reply_delay_ms));
    }

    console.log('[ai-agent] Calling sendAIReply to:', conversation.phone);
    const msg = await sendAIReply(supabase, instance, conversation, aiResponse);

    console.log('[ai-agent] Reply sent to', conversation.phone, 'msg_id:', msg?.id);

    await insertAILog(supabase, {
      conversation_id: conversation.id,
      organization_id: instance.organization_id,
      action: 'replied',
      details: { response_length: aiResponse.length },
      message_id: msg?.id,
      triggered_by: 'ai',
    });

    // =====================================================================
    // FOLLOW-UP: Schedule after EVERY AI reply.
    // If the customer doesn't respond within X minutes, follow up.
    // Cancel any existing follow-ups first (customer replied = reset timer).
    // =====================================================================
    if (config.follow_up_enabled) {
      await cancelPendingFollowUps(supabase, conversation.id);

      const sequence = Array.isArray(config.follow_up_sequence)
        ? config.follow_up_sequence as Array<{ delay_minutes: number; label: string }>
        : [];
      const maxFollowUps = sequence.length > 0
        ? Math.min(sequence.length, config.follow_up_max_per_conversation ?? 3)
        : 1;
      const delayMinutes = sequence[0]?.delay_minutes
        ?? config.follow_up_default_delay_minutes ?? 30;

      const triggerAt = new Date(Date.now() + delayMinutes * 60 * 1000);

      await createFollowUp(supabase, {
        conversation_id: conversation.id,
        organization_id: instance.organization_id,
        instance_id: instance.id,
        trigger_at: triggerAt.toISOString(),
        follow_up_type: 'smart',
        detected_intent: 'silence_follow_up',
        intent_confidence: 1.0,
        context: {
          customer_name: conversation.contact_name || '',
          context_for_message: incomingText || '',
          sequence_index: 0,
          total_steps: maxFollowUps,
        },
        original_customer_message: incomingText || '',
        original_message_id: ctx.incomingMessage.id,
      });

      await insertAILog(supabase, {
        conversation_id: conversation.id,
        organization_id: instance.organization_id,
        action: 'follow_up_scheduled',
        details: {
          trigger_at: triggerAt.toISOString(),
          delay_minutes: delayMinutes,
          sequence_step: 0,
          total_steps: maxFollowUps,
        },
        message_id: ctx.incomingMessage.id,
        triggered_by: 'ai',
      });
    }

    // Generate summary periodically (every 5 customer messages, or first time at 3+)
    if (config.summary_enabled && msgCount && (msgCount >= 3 && msgCount % 5 === 0 || msgCount === 3)) {
      generateAndSaveSummary(supabase, conversation, instance.organization_id, conversationHistory, memories).catch(
        (err) => console.error('[ai-agent] Summary generation failed:', err),
      );
    }
  } catch (err) {
    console.error('[ai-agent] generateAIResponse FAILED:', err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? (err.stack || '').slice(0, 300) : undefined;

    await insertAILog(supabase, {
      conversation_id: conversation.id,
      organization_id: instance.organization_id,
      action: 'error',
      details: { error: errorMsg, stack: errorStack },
      triggered_by: 'ai',
    });

    // Send a graceful fallback reply so the customer doesn't get silence
    try {
      const fallback = config.transfer_message || 'Oi! Estou com uma instabilidade no momento. Pode repetir sua mensagem em alguns segundos? 😊';
      await sendAIReply(supabase, instance, conversation, fallback);
    } catch { /* ignore send errors */ }
  }
}

// =============================================================================
// SEND REPLY
// =============================================================================

/**
 * Split text into chunks of max 2 paragraphs each.
 * A paragraph is separated by double newline (\n\n).
 */
function splitIntoParagraphChunks(text: string, maxParagraphsPerChunk = 2): string[] {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

  if (paragraphs.length <= maxParagraphsPerChunk) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  for (let i = 0; i < paragraphs.length; i += maxParagraphsPerChunk) {
    const chunk = paragraphs.slice(i, i + maxParagraphsPerChunk).join('\n\n');
    chunks.push(chunk.trim());
  }

  return chunks;
}

async function sendAIReply(
  supabase: SupabaseClient,
  instance: AIAgentContext['instance'],
  conversation: WhatsAppConversation,
  text: string,
): Promise<WhatsAppMessage | null> {
  console.log('[ai-agent] sendAIReply called:', { phone: conversation.phone, isMeta: !!(instance as any).phone_number_id && !!(instance as any).access_token });

  const isMeta = !!(instance as any).phone_number_id && !!(instance as any).access_token;

  let messageId: string | undefined;

  try {
    const chunks = splitIntoParagraphChunks(text, 2);
    let lastMsg: WhatsAppMessage | null = null;

    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      if (isMeta) {
        const { createMetaClient } = await import('@/lib/meta/client');
        const { getMetaCredentials } = await import('@/lib/meta/helpers');
        
        // Get credentials from database - this returns the token that was saved
        const creds = await getMetaCredentials(supabase, instance.organization_id, instance.id);
        console.log('[ai-agent] Meta credentials:', { hasToken: !!creds.accessToken, phoneNumberId: creds.phoneNumberId, businessAccountId: creds.businessAccountId });
        
        const metaClient = createMetaClient({
          accessToken: creds.accessToken,
          phoneNumberId: creds.phoneNumberId,
          businessAccountId: creds.businessAccountId,
        });
        
        console.log('[ai-agent] Sending via Meta to:', conversation.phone);
        const response = await metaClient.sendText(conversation.phone, chunks[i]);
        messageId = response.messages?.[0]?.id;
        console.log('[ai-agent] Meta response:', response);
      } else {
        const creds: evolution.EvolutionCredentials = {
          baseUrl: (instance as any).evolution_api_url,
          apiKey: (instance as any).instance_token,
          instanceName: (instance as any).evolution_instance_name,
        };

        const response = await evolution.sendText(creds, {
          number: conversation.phone,
          text: chunks[i],
        });
        messageId = response.key?.id;
      }

      const msg = await insertMessage(supabase, {
        conversation_id: conversation.id,
        organization_id: instance.organization_id,
        evolution_message_id: isMeta ? undefined : messageId,
        meta_message_id: isMeta ? messageId : undefined,
        from_me: true,
        message_type: 'text',
        text_body: chunks[i],
        status: 'sent',
        sent_by: 'ai_agent',
        whatsapp_timestamp: new Date().toISOString(),
      } as Parameters<typeof insertMessage>[1]);

      lastMsg = msg;
    }

    const lastChunk = chunks[chunks.length - 1] || text || '';
    await updateConversation(supabase, conversation.id, {
      last_message_text: lastChunk.slice(0, 255),
      last_message_at: new Date().toISOString(),
      last_message_from_me: true,
    } as Parameters<typeof updateConversation>[2]);

    return lastMsg;
  } catch (err) {
    console.error('[ai-agent] sendAIReply FAILED for', conversation.phone, ':', err);
    return null;
  }
}

// =============================================================================
// SUMMARY GENERATOR
// =============================================================================

async function generateAndSaveSummary(
  supabase: SupabaseClient,
  conversation: WhatsAppConversation,
  organizationId: string,
  conversationHistory: string,
  memories: ChatMemory[],
): Promise<void> {
  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('ai_provider, ai_model, ai_google_key, ai_openai_key, ai_anthropic_key')
    .eq('organization_id', organizationId)
    .single();

  const provider = orgSettings?.ai_provider ?? 'google';
  const model = orgSettings?.ai_model ?? 'gpt-4o-mini';

  let apiKey: string | undefined;
  if (provider === 'google') apiKey = orgSettings?.ai_google_key;
  else if (provider === 'openai') apiKey = orgSettings?.ai_openai_key;
  else if (provider === 'anthropic') apiKey = orgSettings?.ai_anthropic_key;

  if (!apiKey) return;

  const prompt = `Resuma esta conversa de WhatsApp em 2-3 frases. Identifique pontos-chave e proximas acoes recomendadas.

MEMORIAS:
${memories.map((m) => `- ${m.key}: ${m.value}`).join('\n')}

CONVERSA:
${conversationHistory}

Responda em JSON:
{"summary":"...","key_points":["..."],"next_actions":["..."],"sentiment":"positive|neutral|negative"}`;

  try {
    const { generateText } = await import('ai');

    let modelInstance;
    if (provider === 'google') {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      modelInstance = createGoogleGenerativeAI({ apiKey })(model);
    } else if (provider === 'openai') {
      const { createOpenAI } = await import('@ai-sdk/openai');
      modelInstance = createOpenAI({ apiKey })(model);
    } else {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      modelInstance = createAnthropic({ apiKey })(model);
    }

    const result = await generateText({
      model: modelInstance,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 500,
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]);

    await insertSummary(supabase, {
      conversation_id: conversation.id,
      organization_id: organizationId,
      summary: parsed.summary || 'Sem resumo disponivel.',
      key_points: parsed.key_points || [],
      next_actions: parsed.next_actions || [],
      customer_sentiment: parsed.sentiment || 'neutral',
      trigger_reason: 'periodic',
    });
  } catch {
    // Summary is non-critical, ignore errors
  }
}
