# Configuração CLAUDE.md para VacinaCRM

## Visão Geral

Este documento contém as instruções de configuração para usar o VacinaCRM com Claude Code (OpenCode).

## Configuração do Ambiente

### Variáveis de Ambiente Necessárias

Crie um arquivo `.env.local` com:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_SECRET_KEY=eyJ...

# Meta WhatsApp (configurar via UI ou SQL)
# O token deve ser armazenado no banco de dados, não aqui

# IA (uma ou mais)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Autenticação
NEXT_PUBLIC_PROXY_URL=/api/auth
```

## Estrutura do Projeto

```
vaccineCRM/
├── app/                        # Next.js App Router
│   ├── api/                    # API Routes
│   │   ├── whatsapp/           # WhatsApp (webhook, instances, conversations)
│   │   ├── ai/                 # Chat e ações de IA
│   │   └── settings/           # Configurações
│   └── (protected)/            # Páginas autenticadas
├── lib/                        # Bibliotecas
│   ├── supabase/               # Cliente Supabase
│   ├── meta/                   # Client Meta API
│   │   ├── client.ts           # MetaWhatsAppClient
│   │   ├── helpers.ts          # getMetaCredentials, etc.
│   │   └── types.ts            # Tipos TypeScript
│   ├── evolution/
│   │   ├── aiAgent.ts          # Agente de IA
│   │   ├── helpers.ts          # Credenciais Evolution
│   │   └── client.ts           # Client Evolution API
│   ├── query/                  # TanStack Query hooks
│   └── ai/                     # Tools de IA
├── features/                   # Componentes por feature
│   ├── whatsapp/               # UI do WhatsApp
│   ├── boards/                 # Pipeline/Deals
│   └── ...
└── supabase/
    ├── migrations/              # Migrações do banco
    └── schema_complete.sql     # Schema completo
```

## Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build produção
npm run build

# Lint (sem warnings)
npm run lint

# Typecheck
npm run typecheck

# Testes
npm test              # watch mode
npm run test:run      # single run
npx vitest path/file.test.ts  # arquivo específico
```

##Arquitetura WhatsApp

### Meta Cloud API (WABA/COEX)

O projeto suporta dois providers:
1. **Meta Cloud API** - API oficial do WhatsApp (recomendado)
2. **Evolution API** - API alternativa (legado)

### Fluxo de Mensagens

```
Celular → Meta API → Webhook (/api/whatsapp/webhook) 
         → AI Agent (lib/evolution/aiAgent.ts) 
         → Resposta via Meta Client
```

### Arquivos Principais

| Arquivo | Função |
|---------|--------|
| `app/api/whatsapp/webhook/route.ts` | Recebe mensagens |
| `lib/meta/client.ts` | Envia mensagens via Meta |
| `lib/evolution/aiAgent.ts` | Processa com IA |

### Configuração do Banco

```sql
-- Verificar instância
SELECT * FROM whatsapp_instances 
WHERE phone_number_id = '147762591744967';

-- Verificar AI config
SELECT * FROM whatsapp_ai_config 
WHERE instance_id = '37f9cd52-0090-43b8-b134-67674d52f9ed';

-- Atualizar token
UPDATE whatsapp_instances 
SET access_token_encrypted = 'NOVO_TOKEN'
WHERE id = '37f9cd52-0090-43b8-b134-67674d52f9ed';
```

## Configuração de Menu Lateral

O menu está em `components/Layout.tsx`:

```tsx
[
  { to: '/dashboard', label: 'Visão Geral' },
  { to: '/contacts', label: 'Contatos' },
  { to: '/boards', label: 'Pipeline' },
  { to: '/whatsapp', label: 'WhatsApp' },
  { to: '/inbox', label: 'Caixa de Entrada' },
  { to: '/settings', label: 'Configurações' },
]
```

## Debugging

### Verificar logs da Vercel
Acesse o dashboard da Vercel para ver logs de execução.

### Adicionar logs
Use `console.log()` com prefixo identificador:
- `[whatsapp-webhook]` - Webhook de entrada
- `[ai-agent]` - Agente de IA
- `[templates]` - Busca de templates
- `[Meta API]` - Client Meta

### Verificar banco
Use o SQL Editor do Supabase para consultar tabelas.

## Conventions de Código

- TypeScript 5.x strict, React 19
- Tailwind CSS v4
- Radix UI para componentes
- TanStack Query para estado
- Nomes: camelCase (variáveis), PascalCase (componentes)
- Tests: Vitest + React Testing Library

## AGENTS.md

O projeto tem um `AGENTS.md` com instruções específicas para agentes AI. Sempre leia antes de fazer mudanças significativas.