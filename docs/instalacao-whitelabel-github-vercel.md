# Guia de Instalação do White-Label no GitHub e na Vercel

Este documento foi pensado para a entrega comercial do CRM white-label. A ideia é que o comprador consiga subir o projeto, rodar o instalador e entrar no painel com a própria marca sem depender de ajustes manuais no código.

Se voce quiser um material mais simples para enviar direto ao cliente final, use tambem [`docs/manual-do-comprador-whitelabel.md`](./manual-do-comprador-whitelabel.md).

Para suporte operacional durante a instalação, use também o playbook em [`docs/suporte-instalacao-whitelabel.md`](./suporte-instalacao-whitelabel.md).

Fluxo recomendado:

1. Colocar o código em um repositório próprio no GitHub.
2. Importar o projeto na Vercel.
3. Abrir `https://SEU-DOMINIO/install/start`.
4. Concluir o wizard com Vercel + Supabase.
5. Fazer o primeiro login como admin.

## 1. O que é preciso antes de começar

| Item | Obrigatório | Onde obter | Observações |
| --- | --- | --- | --- |
| Conta no GitHub | Sim | [github.com](https://github.com) | Pode ser conta pessoal ou organização. |
| Conta na Vercel | Sim | [vercel.com](https://vercel.com) | É onde o projeto será publicado. |
| Conta no Supabase | Sim | [supabase.com](https://supabase.com) | O banco do CRM fica aqui. |
| Repositório do projeto na conta do cliente | Sim | GitHub | Pode ser `Fork`, `Import repository` ou repositório privado próprio. |
| Token da Vercel | Sim | Vercel -> Account Settings -> Tokens | Gere com permissão `Full Account`. |
| Token do Supabase | Sim | Supabase -> Account -> Access Tokens | O token começa com `sbp_`. |
| Nome da marca | Sim | Definido pelo cliente | Ex.: `Meu CRM`, `Acme CRM`. |
| Slug da marca | Sim | Definido pelo cliente | Ex.: `meu-crm`, `acme-crm`. |
| Logo da marca | Recomendado | URL pública da imagem | Pode ser ajustado depois no painel. |
| Nome, email e senha do admin | Sim | Definido pelo cliente | A senha precisa ter pelo menos 8 caracteres, com letras e números. |
| URL final da aplicação | Recomendado | Vercel ou domínio próprio | Necessária para webhooks do WhatsApp e links públicos. |

## 2. O que o instalador faz automaticamente

Depois que o projeto sobe na Vercel e o wizard é executado, o instalador:

- valida o token da Vercel e identifica o projeto atual;
- conecta o projeto ao Supabase;
- permite criar um novo projeto Supabase ou usar um já existente;
- resolve URL, chaves e conexão de banco do Supabase;
- aplica as migrations do banco;
- publica Edge Functions do Supabase quando existirem no repositório;
- cria o tenant white-label inicial;
- cria o usuário administrador inicial;
- grava branding inicial do white-label;
- define automaticamente `NEXT_PUBLIC_APP_URL` com o domínio atual usado no setup;
- gera automaticamente `CRON_SECRET` para rotas agendadas e follow-ups;
- dispara um redeploy na Vercel;
- desabilita o instalador ao final com `INSTALLER_ENABLED=false`.

Observação: o wizard salva progresso no navegador por até 1 hora. Se a instalação cair no meio, o ideal é continuar no mesmo navegador e na mesma máquina.

## 3. Passo 1: preparar o projeto no GitHub

O cliente precisa ter o código em um repositório próprio antes de conectar na Vercel.

### Opção A: fazer Fork

1. Abra o repositório base em [github.com/villelatypebot/zapcrm](https://github.com/villelatypebot/zapcrm).
2. Clique em `Fork`.
3. Escolha a conta ou organização do cliente.
4. Aguarde a criação da cópia.

### Opção B: importar para um repositório privado

1. No GitHub, crie um novo repositório vazio.
2. Importe o conteúdo do projeto ou envie o código manualmente.
3. Confirme que a branch principal está acessível.

Boas práticas:

- o cliente deve ser dono do próprio repositório;
- não use o repositório `villelatypebot/zapcrm` para operação de produção de vários compradores;
- se o repositório for privado, confirme que a Vercel tem permissão para acessá-lo.

## 4. Passo 2: publicar na Vercel

1. Acesse a Vercel e clique em `Add New Project`.
2. Conecte a conta do GitHub, se necessário.
3. Selecione o repositório do cliente.
4. Mantenha o preset em `Next.js`.
5. Faça o primeiro deploy sem mexer em variáveis de ambiente manuais.
6. Aguarde a URL inicial ser gerada, por exemplo `https://cliente-whitelabel.vercel.app`.

Notas importantes:

- o projeto precisa estar acessível na URL antes de abrir o instalador;
- a Vercel injeta variáveis internas como `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID` e `VERCEL_URL`, então normalmente não é necessário criá-las manualmente;
- o deploy inicial pode abrir a aplicação sem setup completo, o que é esperado antes do wizard.

## 5. Passo 3: rodar o instalador

Abra:

```text
https://SEU-DOMINIO/install/start
```

O fluxo é dividido em etapas.

### Etapa 1: identidade do white-label

Preencha:

- nome da marca;
- slug da marca;
- URL pública do logo;
- nome do administrador;
- email do administrador;
- senha do administrador.

Essa etapa cria a identidade inicial da operação.

### Etapa 2: conexão com a Vercel

Cole o token da Vercel.

O sistema vai:

- validar o token;
- detectar o projeto atual da Vercel;
- guardar os dados necessários para configurar o ambiente.

Se a instalação estiver protegida por `INSTALLER_TOKEN`, o wizard também vai pedir esse token.

### Etapa 3: conexão com o Supabase

Cole o token de acesso do Supabase (`sbp_...`).

Depois disso, o wizard pode:

- criar um projeto novo no Supabase;
- ou conectar um projeto Supabase já existente.

Se o cliente estiver no plano Free do Supabase, existe um limite de projetos ativos. O wizard já trata esse cenário e pode pedir para pausar um projeto antigo antes de continuar.

### Etapa 4: provisionamento final

Ao confirmar, o wizard executa o setup completo:

- configura as variáveis da Vercel;
- aguarda o Supabase ficar pronto;
- aplica migrations;
- publica funções;
- cria o admin;
- finaliza com redeploy na Vercel.

No fim, o cliente já deve conseguir acessar o login da aplicação com o email e a senha do admin definidos no início.

## 6. Variáveis de ambiente importantes na Vercel

Parte das variáveis é preenchida automaticamente pelo instalador. Outra parte deve ser revisada manualmente após a instalação.

### Variáveis configuradas automaticamente pelo wizard

Estas normalmente são preenchidas pelo próprio instalador:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INSTALLER_ENABLED=false`

Observação: algumas chaves legadas continuam sendo gravadas para compatibilidade.

### Variáveis que devem ser conferidas manualmente

| Variável | Obrigatória | Para que serve | Exemplo |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Revisar | URL pública usada em webhooks do WhatsApp, links e callbacks | `https://crm.suaempresa.com` |
| `CRON_SECRET` | Revisar | Protege chamadas automáticas e integrações agendadas | `uma-chave-longa-e-unica` |
| `INSTALLER_TOKEN` | Opcional | Protege o instalador enquanto o setup ainda não foi concluído | `token-interno-de-setup` |

Recomendação:

- o instalador já define `NEXT_PUBLIC_APP_URL` com o domínio atual, mas revise se depois você migrar para domínio próprio;
- o instalador já gera `CRON_SECRET`, mas revise se sua operação tiver política interna de rotação de segredos;
- mantenha `INSTALLER_ENABLED=false` depois do setup;
- não comite `.env.local`, tokens ou segredos no GitHub.

## 7. Checklist pós-instalação

Depois que o admin entrar pela primeira vez, revise estes pontos:

1. Abrir `Settings` e confirmar nome, slug e logo do white-label.
2. Criar os usuários internos que terão acesso ao CRM.
3. Ajustar pipeline, objetivos e automações do tenant.
4. Configurar o provedor de IA no painel de configurações.
5. Configurar a integração do WhatsApp e conectar a primeira instância.
6. Rodar a configuração de webhook do WhatsApp depois de garantir `NEXT_PUBLIC_APP_URL`.
7. Testar criação de contato, conversa manual e visualização do chat.
8. Validar se follow-ups e jobs protegidos têm `CRON_SECRET`.

Observação: integrações específicas como reservas e fluxos exclusivos da operação FullHouse não são necessárias para subir o white-label padrão. Elas devem ser habilitadas apenas em tenants internos que realmente usem esse perfil operacional.

## 8. Como funciona a rotina de deploy depois disso

Depois da instalação:

- cada `git push` no repositório do cliente pode gerar deploy automático na Vercel;
- branches secundárias geram previews, úteis para testes;
- o domínio principal deve apontar para produção;
- o setup principal continua no tenant já criado, sem precisar reinstalar o projeto.

## 9. Problemas comuns e como resolver

### Token da Vercel inválido

Sintoma:

- o wizard não consegue validar o projeto;
- aparece erro de permissão ou token inválido.

Como resolver:

1. Gere um novo token na Vercel.
2. Use um token com permissão `Full Account`.
3. Recomece em `/install/start`.

### Token do Supabase inválido

Sintoma:

- erro ao listar organizações ou projetos;
- erro de autorização no provisionamento.

Como resolver:

1. Gere um novo token em `Supabase -> Account -> Access Tokens`.
2. Confirme que o token começa com `sbp_`.
3. Tente novamente no wizard.

### Limite do plano Free do Supabase

Sintoma:

- o wizard informa que não há espaço para criar projeto.

Como resolver:

1. Pause um projeto antigo no Supabase.
2. Ou use um plano pago.
3. Volte ao wizard e continue.

### Erro ao configurar webhooks do WhatsApp

Sintoma:

- a configuração de webhook falha;
- o sistema reclama que `NEXT_PUBLIC_APP_URL` não está configurada.

Como resolver:

1. Vá em `Vercel -> Project -> Settings -> Environment Variables`.
2. Defina `NEXT_PUBLIC_APP_URL` com a URL pública final da aplicação.
3. Faça redeploy.
4. Tente configurar a instância novamente.

### Jobs automáticos retornando `Unauthorized`

Sintoma:

- follow-ups ou syncs agendados falham com erro 401.

Como resolver:

1. Defina `CRON_SECRET` na Vercel.
2. Use esse segredo nas chamadas autenticadas para rotas protegidas por cron.
3. Faça redeploy e teste novamente.

### O instalador foi desabilitado e preciso reabrir

Sintoma:

- depois da primeira instalação, o wizard não abre mais.

Como resolver:

1. Isso é esperado em produção.
2. Se realmente precisar reabrir o setup, ajuste temporariamente `INSTALLER_ENABLED=true` na Vercel e faça um novo deploy.
3. Ao terminar, volte para `INSTALLER_ENABLED=false`.

### A instalação caiu no meio

Sintoma:

- o processo travou durante migrations, provisionamento ou redeploy.

Como resolver:

1. Abra de novo a mesma URL no mesmo navegador.
2. O wizard tenta retomar o estado salvo localmente.
3. Se o estado estiver antigo demais, reinicie o fluxo do começo.

## 10. Checklist final para entrega ao cliente

Antes de considerar a instalação concluída, confirme:

- repositório do projeto está na conta do cliente;
- projeto da Vercel está publicado;
- projeto do Supabase está ativo;
- admin consegue fazer login;
- branding inicial aparece corretamente;
- `NEXT_PUBLIC_APP_URL` está definida;
- `CRON_SECRET` está definida se houver automações protegidas;
- ao menos uma instância de WhatsApp foi testada, se essa feature fizer parte da entrega;
- o instalador foi deixado desabilitado em produção.

Com isso, o white-label fica pronto para operação e para futuras atualizações via GitHub + Vercel.
