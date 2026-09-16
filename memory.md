# Colheita — memória do progresso

## Feito
- Dados reais extraídos da planilha `.xlsx` (19 produtos, 191 escolas, 22
  produtores, 14 motivos de devolução, 62 entradas do mapa de produção) →
  `prisma/data/seed-data.json`.
- Projeto Next.js 16 + TypeScript criado na raiz do repo.
- Prisma 6.19.3 + PostgreSQL configurados; Postgres local rodando (db
  `colheita`, user `postgres`/`colheita_dev`).
- Schema Prisma modelado (Product, School, Producer, ReturnReason,
  ProductionMapEntry, Settings, Week, SchoolOrder, ProducerOrder,
  WeeklyCost) com snapshot de preço/dedução por linha para não alterar
  semanas já fechadas. Migração inicial aplicada.
- Seed rodado com sucesso (`npx tsx prisma/seed.ts`) — banco populado.
- Decisões já tomadas com o usuário: stack Next.js+Postgres, deploy em
  Vercel+Neon, login por senha única (env `APP_PASSWORD` + cookie de
  sessão assinado com `jose`, JWT HS256, seguindo o guia oficial de auth
  do Next.js — usar `proxy.ts` no lugar de `middleware.ts`, pois o Next
  16 renomeou o arquivo).
- Mockup visual real (HTML) foi lido do artifact do usuário — paleta,
  tipografia (Fraunces + IBM Plex Sans/Mono) e componentes (sidebar,
  cards, tabelas, romaneio imprimível) confirmados.
- Commit feito e push tentado; push falhou (403 — falta instalar o
  Claude GitHub App no repo). Aguardando o usuário liberar acesso.

## Decisões de design ainda não implementadas (já definidas em conversa)
- Escolas: grid largo (191 linhas × 19 colunas de pedido, como a aba
  "Entrada de Dados"), com colunas de código/nome fixas (sticky) e busca.
  Devolução+motivo por um link que abre modal (não precisa das 19
  colunas). Clique na linha abre a ficha/romaneio imprimível.
- Produtores: lista com linha expansível (accordion) mostrando só os
  produtos daquele produtor (via Mapa de Produção), com pedido/entrega/
  devolução editáveis inline; permitir adicionar produto extra fora do
  plano. Ficha/romaneio por produtor mostra alerta de limite anual PNAE
  (R$40.000).
- Semana: sempre existe uma semana "OPEN"; fechar arquiva (status
  CLOSED + closedAt) e abre a próxima automaticamente. Histórico lista
  semanas fechadas e permite abrir qualquer uma em modo leitura.

## Próximo passo exato
Implementar a autenticação (senha única): `src/lib/session.ts` (jose,
encrypt/decrypt JWT), `src/lib/dal.ts` (verifySession com cache),
`src/proxy.ts` (redireciona para /login se sem sessão válida), e a tela
`app/(auth)/login/page.tsx` com Server Action que compara a senha ao
`process.env.APP_PASSWORD` e chama `createSession()`. Isso é a Task #4
da lista de tarefas e bloqueia todas as telas seguintes (dashboard,
escolas, produtores etc.), que ficam atrás do proxy protegido.
