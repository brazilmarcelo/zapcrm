# Manual do Comprador do CRM White-Label

Este material foi feito para quem comprou o CRM white-label e quer colocar a propria marca no ar com seguranca, sem precisar entender o codigo do projeto.

Se voce quiser o material tecnico detalhado, use tambem:

- [Guia de instalacao no GitHub e na Vercel](./instalacao-whitelabel-github-vercel.md)
- [Playbook de suporte da instalacao](./suporte-instalacao-whitelabel.md)

## 1. O que voce esta recebendo

Voce esta recebendo uma base de CRM white-label pronta para ser publicada com:

- sua marca;
- seu login administrador;
- seu banco no Supabase;
- seu deploy na Vercel;
- estrutura inicial de CRM pronta para uso.

Depois da instalacao, voce pode ajustar:

- nome e logo da operacao;
- usuarios internos;
- pipeline e objetivos;
- configuracoes de IA;
- integracoes de WhatsApp.

## 2. O que voce precisa ter antes de comecar

Antes do setup, tenha em maos:

1. Uma conta no GitHub.
2. Uma conta na Vercel.
3. Uma conta no Supabase.
4. Um repositorio proprio para guardar o codigo.
5. Um token da Vercel.
6. Um token do Supabase.
7. O nome da sua marca.
8. O logo da sua marca em URL publica.
9. O nome, email e senha do administrador principal.

## 3. O caminho mais simples

O processo padrao funciona assim:

1. Coloque o codigo em um repositorio seu no GitHub.
2. Importe esse repositorio na Vercel.
3. Espere a primeira URL da Vercel ficar online.
4. Abra `https://seu-dominio/install/start`.
5. Preencha os dados da sua marca e do administrador.
6. Cole o token da Vercel.
7. Cole o token do Supabase.
8. Clique para iniciar a instalacao.
9. Espere a barra de progresso terminar.
10. Entre no sistema com o admin criado.

Resumo curto:

`GitHub -> Vercel -> /install/start -> wizard -> login`

## 4. Passo a passo do comprador

### Passo 1: colocar o projeto no seu GitHub

Voce pode fazer isso de dois jeitos:

- criar um `Fork` do repositorio base `villelatypebot/zapcrm`;
- ou colocar o codigo em um repositorio privado seu.

O importante e que o projeto final fique dentro da sua conta ou da sua empresa no GitHub.

### Passo 2: publicar na Vercel

Na Vercel:

1. Clique em `Add New Project`.
2. Escolha o repositorio do CRM.
3. Mantenha o preset em `Next.js`.
4. Rode o primeiro deploy.
5. Aguarde a URL ficar pronta.

Voce ainda nao precisa configurar tudo manualmente nessa etapa. O wizard cuida da maior parte do setup.

### Passo 3: abrir o instalador

Depois do primeiro deploy, abra:

```text
https://SEU-DOMINIO/install/start
```

Ali comeca o setup guiado.

### Passo 4: preencher a identidade da sua operacao

O instalador vai pedir:

- nome da marca;
- slug da marca;
- URL do logo;
- nome do administrador;
- email do administrador;
- senha do administrador.

Esses dados formam a base do seu white-label.

### Passo 5: conectar a Vercel

O sistema vai pedir o token da Vercel para:

- identificar o projeto atual;
- gravar variaveis de ambiente;
- disparar o redeploy final.

### Passo 6: conectar o Supabase

Depois disso, o sistema vai pedir o token do Supabase para:

- criar ou conectar o banco;
- resolver as chaves do projeto;
- aplicar o schema do CRM;
- preparar o ambiente para login.

### Passo 7: acompanhar a instalacao

Ao iniciar a instalacao, voce vai ver:

- progresso visual;
- nome da etapa atual;
- log com historico do que esta acontecendo;
- mensagens de erro, se algo falhar;
- opcao de copiar o log para suporte.

Se houver queda ou travamento, tente reabrir o mesmo projeto no mesmo navegador. O instalador consegue retomar parte do processo.

### Passo 8: entrar no sistema

No final, clique no botao para seguir ao login e use o email e a senha definidos no inicio do setup.

## 5. O que o sistema faz sozinho

Durante o setup, o instalador faz automaticamente:

- conexao entre Vercel e Supabase;
- configuracao das variaveis principais;
- criacao da estrutura de banco do CRM white-label;
- criacao do usuario administrador;
- configuracao inicial do tenant;
- geracao do `CRON_SECRET`;
- definicao da `NEXT_PUBLIC_APP_URL` com o dominio atual;
- redeploy final na Vercel;
- desligamento automatico do instalador em producao.

## 6. O que voce deve revisar depois do primeiro login

Assim que entrar no sistema, revise estes pontos:

1. Nome e logo da marca.
2. Pipeline e objetivos.
3. Usuarios que vao acessar o CRM.
4. Configuracoes de IA.
5. Primeira conexao de WhatsApp, se fizer parte da sua entrega.
6. Webhook do WhatsApp, se essa integracao estiver ativa.

## 7. O que nao precisa assustar voce

Algumas coisas sao normais no primeiro setup:

- o primeiro deploy da Vercel pode abrir um projeto ainda sem configuracao completa;
- o Supabase pode levar alguns minutos para ficar pronto;
- o wizard pode reaproveitar etapas se voce tentar de novo;
- o instalador sera desabilitado automaticamente ao final, e isso e esperado.

## 8. Perguntas comuns

### Preciso saber programar?

Nao. O fluxo foi desenhado para ser feito com GitHub, Vercel, Supabase e o wizard do proprio sistema.

### Preciso criar as tabelas do banco manualmente?

Nao. A estrutura principal do CRM white-label e criada automaticamente durante a etapa de migrations do instalador.

### A chave do Supabase sozinha faz tudo?

Nao. O token do Supabase permite acesso. Quem realmente cria a estrutura do sistema e o instalador, quando ele executa as migrations no banco.

### Posso trocar o dominio depois?

Sim. Se trocar o dominio, revise a variavel `NEXT_PUBLIC_APP_URL` na Vercel e faca um novo deploy.

### Se a instalacao cair no meio, perdi tudo?

Normalmente nao. Reabra a mesma URL no mesmo navegador e tente continuar. O sistema foi preparado para retomar e reaproveitar o que ja foi concluido.

### O projeto vai continuar funcionando depois?

Sim. Depois da instalacao, o uso normal passa a ser:

- atualizar o codigo pelo GitHub;
- deixar a Vercel publicar novos deploys;
- administrar usuarios e configuracoes dentro do proprio CRM.

## 9. Checklist final do comprador

Antes de considerar o projeto pronto, confirme:

1. A URL do projeto abre normalmente.
2. O login do administrador funciona.
3. A marca aparece corretamente no sistema.
4. O pipeline esta acessivel.
5. Os usuarios internos podem ser criados.
6. O WhatsApp foi testado, se isso estiver incluso.
7. O instalador nao ficou exposto em producao.

## 10. Quando chamar suporte

Peca ajuda se acontecer qualquer um destes casos:

- o instalador nao abre;
- o token da Vercel ou do Supabase nao valida;
- a instalacao para sempre na mesma etapa;
- o login do admin nao funciona ao final;
- o redeploy da Vercel nao conclui;
- o WhatsApp nao conecta depois do setup.

Quando for pedir suporte, envie:

1. A URL do projeto.
2. Um print da tela.
3. O erro exibido.
4. O log completo copiado pelo botao `Copiar log`.

Com isso, o time consegue ajudar muito mais rapido.
