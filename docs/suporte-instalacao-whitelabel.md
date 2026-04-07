# Playbook de Suporte da Instalacao White-Label

Este documento serve como roteiro operacional para atender clientes durante o setup do CRM white-label. A ideia e reduzir dependencia de codigo, acelerar triagem e padronizar o que pedir ao cliente.

Use este material junto com:

- [Manual do comprador do white-label](./manual-do-comprador-whitelabel.md)
- [Guia de instalacao no GitHub e na Vercel](./instalacao-whitelabel-github-vercel.md)
- [README do projeto](../README.md)

## 1. Fluxo resumido que o suporte precisa ter na cabeca

O caminho padrao do cliente e:

1. Colocar o codigo em um repositorio proprio no GitHub.
2. Importar esse repositorio na Vercel.
3. Abrir `https://dominio-do-projeto/install/start`.
4. Preencher branding e admin.
5. Conectar Vercel e Supabase.
6. Rodar a instalacao assistida.
7. Fazer login e validar o ambiente.

No fluxo atual, o instalador:

- resolve chaves e conexao do Supabase;
- cria ou conecta o projeto Supabase;
- aplica o schema do CRM white-label;
- publica Edge Functions;
- cria o admin inicial;
- define `NEXT_PUBLIC_APP_URL` com o dominio atual do setup;
- gera `CRON_SECRET`;
- faz redeploy na Vercel;
- desabilita `INSTALLER_ENABLED` ao final.

## 2. O que pedir para o cliente logo no primeiro contato

Se o cliente disser apenas "deu erro", peca estes itens antes de investigar:

1. URL exata do projeto na Vercel.
2. Screenshot da tela atual do instalador.
3. Texto do erro exibido na tela.
4. Conteudo do botao `Copiar log` da instalacao.
5. Se ainda esta no mesmo navegador e na mesma maquina usados no setup.
6. Nome ou `project ref` do projeto no Supabase, se ja aparecer no painel deles.
7. Confirmacao se o deploy inicial na Vercel chegou a ficar online antes do setup.

Pacote minimo ideal para suporte:

- link do projeto na Vercel;
- log copiado da tela;
- screenshot;
- horario aproximado da falha;
- email do admin cadastrado;
- se o erro aconteceu antes ou depois do botao `Iniciar viagem`.

## 3. Onde olhar primeiro

### Na tela do instalador

Hoje o wizard mostra um bloco chamado `Log da instalacao`. Ele e a fonte primaria da triagem.

O suporte deve procurar:

- ultima etapa com sucesso;
- primeira etapa que falhou;
- se houve `Tentativa x/y`;
- se o erro aconteceu em `wait_project`, `migrations`, `bootstrap` ou `redeploy`.

### Na Vercel

Confira:

1. se o projeto existe;
2. se o deploy inicial ficou disponivel;
3. se houve redeploy disparado pelo wizard;
4. se as env vars principais existem.

Variaveis que normalmente precisam existir ao final:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`
- `INSTALLER_ENABLED=false`

### No Supabase

Confira:

1. se o projeto esta `ACTIVE`;
2. se o banco responde;
3. se o Storage existe;
4. se o usuario admin foi criado;
5. se o schema do CRM foi aplicado.

## 4. Como interpretar o log da instalacao

| Evento ou etapa | O que significa | O que fazer |
| --- | --- | --- |
| `Health check concluido` | O sistema analisou o que pode ser reaproveitado. | Ver quantas migrations ainda faltam e se etapas foram puladas. |
| `Etapas reaproveitadas` | Parte do setup ja existia. | Normal em reexecucao ou retomada. |
| `Conectando ao Supabase` | O instalador esta resolvendo chaves e banco. | Se falhar aqui, foco no token do Supabase ou permissao de acesso. |
| `Configurando variaveis na Vercel` | O wizard esta gravando env vars. | Se falhar aqui, foco em token da Vercel, projeto errado ou permissao. |
| `Aguardando Supabase ficar ativo` | O projeto Supabase ainda esta subindo. | Pode ser so tempo; se expirar, verificar status do projeto. |
| `Aguardando Storage do Supabase` | O projeto existe, mas o storage ainda nao terminou de provisionar. | Aguardar mais um pouco e tentar de novo. |
| `Aplicando estrutura do banco (migrations)` | O schema white-label esta sendo criado. | Se falhar, copie a migration citada no log e revise o banco. |
| `Configurando funcoes` ou `Publicando funcoes` | Segredos e Edge Functions estao sendo publicados. | Se falhar, revisar token do Supabase e se o projeto aceita deploy de functions. |
| `Criando usuario administrador` | O instalador esta criando ou validando o admin. | Se falhar, revisar email, senha e status do Auth no Supabase. |
| `Iniciando redeploy na Vercel` | O setup principal terminou e o Next precisa rebuildar com as env vars. | Se falhar, revisar Vercel Deployments. |
| `Aguardando redeploy na Vercel` | O deploy ja foi disparado, falta a Vercel marcar como `READY`. | Se demorar, aguardar no painel da Vercel ou usar o botao `Verificar de novo`. |

## 5. Diagnostico rapido por sintoma

### O instalador nem abre

Cheque nesta ordem:

1. Confirmar se a URL correta e `/install/start`.
2. Verificar se o projeto ja fez o deploy inicial na Vercel.
3. Conferir se `INSTALLER_ENABLED` foi deixado como `false`.

Acao:

- se o setup ainda nao foi feito, deixe `INSTALLER_ENABLED=true`, redeploy e tente novamente;
- se o setup ja foi feito, o bloqueio e esperado.

### Falha ao validar token da Vercel

Sintomas comuns:

- erro de permissao;
- projeto nao encontrado;
- wizard nao detecta o projeto atual.

Acao:

1. Gerar um novo token com `Full Account`.
2. Confirmar que o projeto importado e o mesmo aberto na URL.
3. Verificar se a Vercel tem acesso ao repositorio certo.

### Falha ao validar token do Supabase

Sintomas comuns:

- nao lista organizacoes;
- nao consegue criar projeto;
- nao resolve chaves ou banco.

Acao:

1. Gerar um novo token `sbp_...`.
2. Confirmar se o token pertence a conta que tem acesso ao projeto.
3. Tentar novamente no wizard.

### Projeto Supabase nao sai de espera

O log costuma parar em:

- `Aguardando Supabase ficar ativo`
- ou `Aguardando Storage do Supabase`

Acao:

1. Abrir o projeto no painel do Supabase.
2. Confirmar se o status esta `ACTIVE`.
3. Se estiver `COMING_UP`, `RESTORING` ou semelhante, aguardar e tentar novamente.
4. Se o plano Free estiver estrangulando o ambiente, considerar pausar projeto antigo ou migrar de plano.

### Falha em migrations

O log normalmente mostra a migration ou etapa.

Acao:

1. Copiar todo o log.
2. Confirmar se o banco e o projeto corretos foram usados.
3. Rodar o setup novamente no mesmo navegador, porque o health-check tende a reaproveitar o que ja foi aplicado.
4. Se continuar falhando sempre na mesma migration, escalar com o nome da migration e o erro exato.

Observacao importante:

- as tabelas do CRM white-label sao criadas automaticamente pelas migrations do instalador;
- isso nao depende so da chave do Supabase;
- depende do wizard conseguir conectar no banco e concluir a etapa `migrations`.

### Falha ao criar ou validar admin

O log costuma ficar em `Criando usuario administrador`.

Acao:

1. Confirmar email e senha digitados no inicio do setup.
2. Verificar se a senha atende a politica atual.
3. Rodar de novo: se o usuario ja existir e a senha estiver correta, o bootstrap vira no-op e segue.

### Redeploy da Vercel nao finaliza

O log costuma indicar algo como:

- `Redeploy iniciado`
- `Redeploy disparado, mas ainda nao finalizou na Vercel`

Acao:

1. Abrir `Vercel -> Deployments`.
2. Verificar se o deploy esta `Building`, `Queued` ou `Ready`.
3. Se ainda estiver em andamento, esperar.
4. Se a tela do wizard mostrar o botao `Verificar de novo (Vercel)`, usar esse botao.

### Cliente nao consegue logar mesmo com sucesso na instalacao

Acao:

1. Confirmar se o redeploy final ficou `READY`.
2. Garantir que o cliente esta entrando em `/login`.
3. Confirmar se o email usado no login e o mesmo do setup.
4. Se necessario, repetir o setup para a etapa de bootstrap validar o admin novamente.

## 6. Retomada segura da instalacao

Se a instalacao cair no meio:

1. Pedir para o cliente reabrir a mesma URL no mesmo navegador e na mesma maquina.
2. O wizard deve oferecer continuar a partir do estado salvo.
3. Se o estado local foi perdido, reiniciar o fluxo nao costuma ser problema: o health-check pula etapas ja concluidas quando possivel.

Nao oriente o cliente a limpar tudo de cara. Primeiro tente:

- retomar;
- verificar log;
- deixar o wizard reavaliar o ambiente.

## 7. Smoke test depois da instalacao

Antes de declarar o projeto pronto, o suporte deve confirmar:

1. Login do admin funcionando.
2. `Settings` abrindo com branding correto.
3. Tenant visivel e configuravel.
4. Pipeline/objetivos acessiveis.
5. Criacao de usuario funcionando, se isso fizer parte da entrega.
6. Se WhatsApp estiver incluso: conectar a primeira instancia, gerar QR, configurar webhook e listar chats.
7. Se automacoes estiverem inclusas: confirmar `CRON_SECRET` e testar pelo menos um endpoint protegido.

## 8. Quando escalar para analise tecnica

Escalone quando houver:

- falha repetida sempre na mesma migration;
- falha de Edge Function que nao melhora com novo token;
- bootstrap criando inconsistencias de login;
- redeploy com erro recorrente no build da Vercel;
- instalacao concluida, mas app quebrando logo no primeiro acesso.

Ao escalar, envie este pacote:

1. URL da Vercel.
2. Log copiado do instalador.
3. Screenshot da tela final.
4. `project ref` do Supabase.
5. Horario da tentativa.
6. Email do admin usado no setup.
7. Descricao do que ja foi tentado.

## 9. Resposta padrao para pedir dados ao cliente

Voce pode usar este texto:

```text
Para eu te ajudar mais rapido, me envie por favor:
1. A URL do seu projeto na Vercel
2. Um print da tela atual do instalador
3. O texto do erro
4. O log completo do botao "Copiar log"
5. Se voce ainda esta no mesmo navegador e na mesma maquina usados no setup
```

## 10. Resposta padrao para orientacao de retomada

Voce pode usar este texto:

```text
Vamos tentar pelo caminho mais seguro:
1. Abra novamente a mesma URL do projeto
2. Use o mesmo navegador e a mesma maquina do setup inicial
3. Se aparecer a opcao de continuar, escolha continuar
4. Se falhar de novo, me envie o log completo e um print da tela
```

## 11. Observacao sobre FullHouse e white-label

O instalador padrao foi pensado para o produto white-label. Por isso:

- o schema white-label do CRM e criado automaticamente;
- branding, admin, tenant e estrutura principal entram no setup padrao;
- integracoes e comportamentos especificos da FullHouse ficam fora do fluxo comercial padrao e devem ser habilitados apenas em tenants internos.
