# VacinaCRM - Integração WhatsApp Meta Cloud API (WABA/COEX)

## Visão Geral do Projeto

Este documento descreve a integração do VacinaCRM com a Meta WhatsApp Cloud API (WhatsApp Business API - WABA/COEX), substituindo a Evolution API anterior.

### Objetivos
1. Enviar/receber mensagens via API oficial da Meta
2. Implementar módulo de templates do WhatsApp
3. Configurar janela de 24h (opt-in) para mensagens

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
| `conversations/[id]/send/route.ts` | Envia mensagens (Meta ou Evolution) |
| `conversations/[id]/send-template/route.ts` | Envia templates |

### Bibliotecas (lib/)

| Arquivo | Descrição |
|---------|-----------|
| `lib/meta/client.ts` | Client da Meta Graph API |
| `lib/meta/helpers.ts` | Funções helper (credenciais, formatação) |
| `lib/meta/types.ts` | Tipos TypeScript |
| `lib/evolution/aiAgent.ts` | Agente de IA (suporta Meta e Evolution) |

### Componentes UI

| Arquivo | Descrição |
|---------|-----------|
| `features/whatsapp/components/MessageThread.tsx` | Thread de mensagens + modal de templates |
| `features/whatsapp/components/WhatsAppAISettings.tsx` | Configurações de IA |

---

## Configuração no Supabase

### Tabelas Principais

```sql
-- whatsapp_instances: instâncias WhatsApp
- id, name, phone_number_id, access_token_encrypted, business_account_id, waba_id, ai_enabled

-- whatsapp_conversations: conversas
- id, phone, ai_active, unread_count, instance_id, organization_id

-- whatsapp_messages: mensagens
- id, meta_message_id, evolution_message_id, from_me, message_type, text_body

-- whatsapp_ai_config: configuração da IA por instância
- id, instance_id, agent_name, system_prompt, greeting_message, memory_enabled, etc.

-- whatsapp_templates: templates cacheados
- id, name, language, category, status, meta_template_id
```

### Políticas RLS

As tabelas `whatsapp_*` têm RLS habilitado. Para upserts via API, adicionar políticas de INSERT/UPDATE.

---

## Fluxo de Mensagens

### Recebimento (Celular → CRM)

```
1. Meta Cloud API → Webhook (POST /api/whatsapp/webhook)
2. handleIncomingMessage() → processIncomingMessage()
3. AI Agent executa → sendAIReply() → Meta Client sendText()
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
5. Atualizar token no banco quando expirar

---

## Configuração de Webhook na Meta

1. **URL**: `https://vacinalcrm.vercel.app/api/whatsapp/webhook`
2. **Verify Token**: `token123` (configurável)
3. **Campos Inscrever**:
   - `messages` - Mensagens recebidas
   - `statuses` - Status de entrega

---

## Troubleshooting

### Token Expirado
```
Error: Meta API error 401: Session has expired
```
**Solução**: Gerar novo token e atualizar no banco:
```sql
UPDATE whatsapp_instances 
SET access_token_encrypted = 'NOVO_TOKEN'
WHERE phone_number_id = 'SEU_PHONE_NUMBER_ID';
```

### Templates não aparecem
1. Verificar se `business_account_id` está preenchido na instância
2. Verificar se política RLS permite INSERT em `whatsapp_templates`
3. Verificar logs: `[templates] Upsert result`

### AI não responde
1. Verificar se `ai_enabled = true` na instância
2. Verificar se `ai_active = true` na conversa
3. Verificar se existe registro em `whatsapp_ai_config`
4. Consultar logs: `[ai-agent] Proceeding to execute AI`

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