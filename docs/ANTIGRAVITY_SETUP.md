# Configuração do Antigravity com VacinaCRM

## Visão Geral

Antigravity é um framework de agent AI que pode ser integrado ao VacinaCRM para automação avançada de fluxos de trabalho.

## Pré-requisitos

1. Node.js 18+
2. Acceso ao projeto VacinaCRM
3. Credenciais da API (OpenAI, Anthropic, Google)

## Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-repo/vacinaCRM.git
cd vaccineCRM

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env.local
```

## Configuração de Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role

# Meta WhatsApp
META_ACCESS_TOKEN=seu-token-meta
META_PHONE_NUMBER_ID=seu-phone-number-id
META_BUSINESS_ACCOUNT_ID=seu-business-account-id

# IA (escolha uma)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant...
GOOGLE_AI_API_KEY=...
```

## Integração com WhatsApp

### Fluxo Atual

O VacinaCRM já possui integração com Meta Cloud API através de:

1. **Webhook** (`/api/whatsapp/webhook`) - Recebe mensagens
2. **API de Envio** (`/api/whatsapp/conversations/[id]/send`) - Envia mensagens
3. **Templates** (`/api/whatsapp/instances/[id]/templates`) - Gerencia templates

### Como o Antigravity pode ajudar

1. **Automação de follow-ups** - Agendar mensagens pós-atendimento
2. **Classificação de mensagens** - Usar IA para categorizar mensagens recebidas
3. **Geração de respostas** - Respostas automáticas mais sofisticadas

## Estrutura do Projeto

```
vaccineCRM/
├── app/
│   ├── api/
│   │   ├── whatsapp/          # Endpoints WhatsApp
│   │   └── ai/                # Endpoints IA
│   └── (protected)/           # Páginas autenticadas
├── lib/
│   ├── meta/                  # Client Meta API
│   ├── evolution/             # Agente IA
│   └── supabase/              # Banco de dados
├── features/
│   └── whatsapp/              # Componentes UI
└── docs/
    └── WHATSMETA_INTEGRATION.md
```

## Comandos de Desenvolvimento

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Lint
npm run lint

# Testes
npm test
```

## Deploy

O projeto está configurado para deploy na Vercel:

1. Conecte o repositório GitHub à Vercel
2. Configure as variáveis de ambiente
3. Deploy automático em push para main

## Troubleshooting

### Problema: Token Meta expirado
**Solução**: Atualize o token no Supabase:
```sql
UPDATE whatsapp_instances 
SET access_token_encrypted = 'NOVO_TOKEN'
WHERE phone_number_id = '147762591744967';
```

### Problema: AI não responde
**Verificações**:
1. `ai_enabled = true` na instância
2. `ai_active = true` na conversa
3. Registro em `whatsapp_ai_config` existe

### Problema: Mensagens não aparecem
**Verificações**:
1. Webhook está configurado na Meta
2. Telefone da instância está correto
3. RLS permite INSERT nas tabelas

## Próximos Passos

1. Testar recebimento de mensagens do celular
2. Implementar opt-in de 24h
3. Adicionar mais templates
4. Melhorar resposta da IA

## Contato

Para dúvidas sobre esta configuração, consulte a documentação principal em `docs/WHATSAPP_META_INTEGRATION.md`.