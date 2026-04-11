# VacinaCRM - Integração WhatsApp Meta Cloud API

## Visão Geral do Projeto

Este documento descreve a integração completa do VacinaCRM com a Meta WhatsApp Cloud API (WhatsApp Business API - WABA/COEX), substituindo a Evolution API anterior.

### Objetivos Implementados
1. ✅ Enviar/receber mensagens via API oficial da Meta
2. ✅ Implementar módulo de templates do WhatsApp
3. ✅ Agente de IA para responder automaticamente
4. ✅ Processamento de mídia (áudio, imagem, vídeo, documento)
5. ✅ Transcrição de áudio via IA
6. ✅ Análise de imagens via IA

---

## Stack Técnica

- **Frontend**: Next.js 16 App Router, React 19, Tailwind CSS v4
- **Backend**: Next.js API Routes (Serverless)
- **Banco**: Supabase (PostgreSQL + RLS)
- **WhatsApp API**: Meta Graph API v25.0
- **IA**: OpenAI/Anthropic/Google via SDK v6

---

## Estrutura de Arquivos

### API Routes (app/api/whatsapp/)

| Arquivo | Descrição |
|---------|-----------|
| `webhook/route.ts` | Recebe mensagens da Meta Cloud API |
| `instances/route.ts` | Gerencia instâncias WhatsApp |
| `instances/[id]/templates/route.ts` | Busca templates da Meta |
| `instances/[id]/ai-config/route.ts` | Configuração da IA |
| `conversations/[id]/send/route.ts` | Envia mensagens |
| `conversations/[id]/messages/route.ts` | Lista mensagens |
| `media/[id]/route.ts` | Proxy para baixar mídia |

### Bibliotecas (lib/)

| Arquivo | Descrição |
|---------|-----------|
| `lib/meta/client.ts` | Client da Meta Graph API |
| `lib/meta/helpers.ts` | Funções helper (credenciais) |
| `lib/meta/types.ts` | Tipos TypeScript |
| `lib/evolution/aiAgent.ts` | Agente de IA (suporta Meta e Evolution) |

### Componentes UI

| Arquivo | Descrição |
|---------|-----------|
| `features/whatsapp/components/MessageThread.tsx` | Thread de mensagens |
| `features/whatsapp/components/WhatsAppAISettings.tsx` | Configurações de IA |
| `features/settings/components/AIConfigSection.tsx` | Configuração de modelos IA |

---

## Configuração no Supabase

### Tabelas Principais

```sql
-- whatsapp_instances: instâncias WhatsApp
- id, name, phone_number_id, access_token_encrypted, 
- business_account_id, waba_id, ai_enabled

-- whatsapp_conversations: conversas
- id, phone, ai_active, unread_count, instance_id, organization_id

-- whatsapp_messages: mensagens
- id, meta_message_id, from_me, message_type, text_body,
- media_url, media_mime_type, media_caption, media_filename

-- whatsapp_ai_config: configuração da IA por instância
- id, instance_id, agent_name, system_prompt, greeting_message, etc.

-- whatsapp_templates: templates cacheados
- id, name, language, category, status, meta_template_id
```

### Políticas RLS

As tabelas `whatsapp_*` têm RLS habilitado. Para upserts via API, foi adicionada política:

```sql
-- whatsapp_templates
DROP POLICY IF EXISTS "whatsapp_templates_upsert" ON public.whatsapp_templates;
CREATE POLICY "whatsapp_templates_upsert" ON public.whatsapp_templates
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );
```

---

## Fluxo de Mensagens

### Recebimento (Celular → CRM)

```
1. Meta Cloud API → Webhook (POST /api/whatsapp/webhook)
2. handleIncomingMessage() → processIncomingMessage()
3. Se ai_enabled=true e ai_active=true:
   - Transcreve áudio (se necessário)
   - Analisa imagem (se necessário)
   - Gera resposta via IA
   - Envia via Meta Client
```

### Envio (CRM → Celular)

```
1. UI → API POST /api/whatsapp/conversations/[id]/send
2. Verifica se é Meta ou Evolution
3. Envia via client apropriado
4. Salva mensagem no banco
```

---

## Credenciais Meta

### Onde são armazenadas

1. **whatsapp_instances.access_token_encrypted** - Token por instância
2. **organization_settings.meta_access_token_encrypted** - Token global (fallback)
3. **organization_settings.meta_business_account_id** - Business Account ID

### Como obter

1. Criar app no [Meta for Developers](https://developers.facebook.com/)
2. Adicionar produto WhatsApp
3. Configurar Webhook (URL: `https://vacinalcrm.vercel.app/api/whatsapp/webhook`)
4. Gerar Temporary Access Token (validade ~24h)
5. Atualizar token no banco quando expirar:
```sql
UPDATE whatsapp_instances 
SET access_token_encrypted = 'NOVO_TOKEN'
WHERE phone_number_id = 'SEU_PHONE_NUMBER_ID';
```

---

## Configuração de Webhook na Meta

1. **URL**: `https://vacinalcrm.vercel.app/api/whatsapp/webhook`
2. **Verify Token**: `token123`
3. **Campos Inscrever**:
   - `messages` - Mensagens recebidas
   - `statuses` - Status de entrega

---

## Configuração da IA

### Modelos Disponíveis

**OpenAI:**
- GPT-5, GPT-5 Mini, GPT-4.1, GPT-4.1 Mini
- GPT-4o, GPT-4o Mini, GPT-4 Turbo
- o3, o4-mini

**Google Gemini:**
- Gemini 3.1 Pro/Flash/Flash-Lite, Gemini 3 Flash
- Gemini 2.5 Pro/Flash/Flash-Lite, Gemini 2.0 Flash
- Gemini 1.5 Pro/Flash

**Anthropic Claude:**
- Claude Opus 4.5, Sonnet 4.5, Haiku 4.5
- Claude 3.5 Sonnet, Claude 3 Opus

### Configurações por Instância

Na tabela `whatsapp_ai_config`:
- `ai_enabled` - Ativar/desativar IA
- `system_prompt` - Prompt do sistema
- `agent_name` - Nome do agente
- `agent_tone` - Tom da resposta (professional, friendly, etc.)
- `greeting_message` - Mensagem de boas-vindas
- `working_hours_start/end` - Horário de funcionamento
- `outside_hours_message` - Mensagem fora do horário

---

## Troubleshooting

### Token Expirado
```
Error: Meta API error 401: Session has expired
```
**Solução**: Gerar novo token e atualizar no banco.

### Número Não Permitido
```
Error: (#131030) Recipient phone number not in allowed list
```
**Solução**: Adicionar números na "Allowed Phone Numbers" no Meta for Developers.

### Mensagens Duplicadas
A IA agora verifica mensagens já processadas (marcadas com `[Áudio transcrito]:` ou `[Imagem analisada]:`) para evitar duplicatas.

### Áudio/Imagem Não Abre
O sistema usa proxy `/api/whatsapp/media/[id]` para baixar mídia do Facebook e servir ao navegador (resolve CORS).

---

## Comandos Úteis

```bash
# Verificar instâncias
SELECT * FROM whatsapp_instances;

# Verificar conversas
SELECT id, phone, ai_active FROM whatsapp_conversations;

# Verificar mensagens
SELECT * FROM whatsapp_messages ORDER BY created_at DESC LIMIT 10;

# Verificar AI config
SELECT * FROM whatsapp_ai_config;

# Verificar templates
SELECT * FROM whatsapp_templates;
```

---

## Referências

- [Meta WhatsApp Cloud API Documentation](https://developers.facebook.com/docs/whatsapp)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Meta App Dashboard](https://developers.facebook.com/apps/)