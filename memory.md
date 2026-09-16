# Colheita — memória do progresso

## Pivô importante (2026-09-16)
O usuário substituiu a especificação inicial (leve, baseada só na
planilha) por uma especificação formal completa com critérios de aceite
(CA-*), regras absolutas numeradas e 10 testes mínimos obrigatórios.
**Essa especificação formal é agora a referência oficial**, e é bem mais
rigorosa: usuários reais com papéis (não senha única), pedido/entrega/
devolução sempre em tabelas separadas (nunca a mesma linha), histórico
de preços de verdade, auditoria, divisão entre produtores como etapa
própria, semanas nunca apagadas (com reabertura auditável).
Prioridade explícita do usuário: 1) integridade dos dados, 2) regras de
negócio, 3) separação pedido/entrega, 4) financeiro, 5) histórico,
6) PNAE, 7) validações, 8) auditoria, 9) usabilidade, 10) design —
**nessa ordem**. Não é para copiar visualmente a planilha.

## Feito
- Dados reais extraídos da planilha `.xlsx` (19 produtos, 191 escolas, 22
  produtores, 14 motivos, 62 entradas do mapa de produção) →
  `prisma/data/seed-data.json`.
- Projeto Next.js 16 + TypeScript, sem Tailwind (CSS customizado puro).
- **Schema Prisma reestruturado por completo** (`prisma/schema.prisma`)
  seguindo a especificação formal: `User` (Role ADMIN/OPERADOR/CONSULTA),
  `Product`, `School`, `Producer`, `ReturnReason`, `Price` (histórico de
  preço por produto, validFrom/validTo, nunca sobrescreve), `Settings`
  (dedução logística R$3,67), `ProductionMapEntry`, `Week`
  (status ABERTA/FECHADA + `WeekReopening` para reabertura auditável),
  `SchoolOrder`/`SchoolDelivery`/`SchoolReturn` (3 tabelas separadas),
  `ProducerAllocation` (divisão/planejamento) / `ProducerOrder` /
  `ProducerDelivery` / `ProducerReturn` (4 tabelas separadas — pedido,
  entrega e devolução do produtor NUNCA compartilham linha),
  `WeeklyCost`, `AuditLog` genérico (entityType/entityId/before/after).
  Toda linha de pedido/entrega grava `priceId` (rastreável) e, no caso do
  produtor, `logisticsDeductionSnapshot` — preços antigos nunca mudam
  retroativamente.
- Migração local aplicada (`20260916143624_restructure_formal_spec`) e
  seed adaptado (cria usuário ADMIN inicial a partir de
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` do `.env`, cria preço inicial por
  produto com `validFrom` em 2020-01-01).
- **`src/lib/calc.ts`**: todas as fórmulas da seção 55 como funções puras
  (schoolNetQty, schoolValue, treasuryTotal, producerNetQty, netPrice,
  producerPayment, producersTotal, grossMargin, weekBalance,
  balanceStatus, reconcile, pnaeUsage, pnaeCycleRange).
- **`src/lib/pnae.ts`**: `getProducerAnnualTotal`/`getProducerPnaeUsage`
  — soma o pagamento real de um produtor dentro do ciclo PNAE (out-set)
  direto do histórico de `ProducerDelivery`/`ProducerReturn`, sem nenhum
  campo "acumulado" gravado à parte.
- **Testes automatizados (vitest)** cobrindo os 10 testes obrigatórios da
  seção 56: `src/lib/calc.test.ts` (19 testes puros: pedido≠entrega,
  pagamento, prefeitura, margem, saldo, conferência, PNAE) e
  `src/lib/pnae.integration.test.ts` (4 testes contra Postgres real no db
  `colheita_test`: histórico/semana fechada, preço histórico, PNAE
  acumulando entre semanas, datas domingo/segunda/terça). **23/23
  passando.** Rodar com `npm test` (precisa de `.env.test` local — não
  commitado — apontando pro banco `colheita_test`; ver `.env.test` que
  foi criado localmente com
  `postgresql://postgres:colheita_dev@localhost:5432/colheita_test`).
- **Autenticação multiusuário real**: `src/lib/session.ts` (JWT via jose),
  `src/lib/dal.ts` (`verifySession()` — sempre confere no banco se o
  usuário ainda está ativo, não confia só no cookie — e `requireRole()`/
  `requireOperator()` para checagem de papel), `src/proxy.ts` (checagem
  otimista, redireciona pra `/login` sem cookie), `src/app/login/` (form +
  Server Action com bcrypt). **Testado de ponta a ponta com Playwright**:
  login correto entra, senha errada mostra erro, rota protegida sem
  sessão redireciona, `/login` já autenticado redireciona pra `/`.
- Design system portado do mockup para `src/app/globals.css` (paleta
  verde/terra/dourado, Fraunces + IBM Plex Sans/Mono via `next/font`).
- `src/app/page.tsx` hoje é só um placeholder provando que a autenticação
  funciona (mostra usuário logado + botão sair) — a dashboard de verdade
  (seção 43) ainda não foi construída.

## Ainda NÃO implementado (da especificação formal)
- Nenhuma tela de operação real ainda: pedido das escolas, divisão entre
  produtores, pedido/entrega/devolução dos produtores, motivos, mapa de
  produção, resumo, balanço, conferência, PNAE, histórico com filtros,
  dashboard, exportação.
- Nenhuma Server Action de mutação de domínio ainda (só login/logout).
- Auditoria (`AuditLog`) — modelo existe, mas nenhuma action ainda grava
  nele. Precisa ser wired em toda mutação crítica (CA-AUD-*).
- Fechamento/reabertura de semana (CA-SEM-04, CA-SEM-06) — não
  implementado ainda (só testado via Prisma direto no teste de
  integração, não existe fluxo de UI/action).
- Validações de quantidade negativa (CA-PED-ESC-03, CA-DEV-07) e de
  devolução maior que a quantidade correspondente (CA-DEV-08) — ainda
  não implementadas em nenhuma action (a lib de cálculo não valida
  entrada, isso é responsabilidade da action/schema zod).
- Importação assistida do Excel com conferência antes de confirmar
  (seção 53-54) — os dados já foram importados direto via seed script;
  não existe uma tela de importação com preview/validação de duplicidade
  como as CA-IMP-* pedem. Se isso for exigido como fluxo de UI (não só
  script), precisa ser construído.

## Próximo passo exato
Implementar o fluxo real de "Semana operacional" (seção 3-4): Server
Actions `createWeek()` (garante que só existe uma ABERTA por vez —
CA-SEM-01/02), `closeWeek()` (ADMIN ou OPERADOR autorizado, grava
`closedAt`+`closedById`, grava `AuditLog`) e `reopenWeek(reason)` (exige
motivo, grava `WeekReopening` + `AuditLog` — CA-SEM-06). Depois disso,
construir a tela de Pedido das Escolas (CA-PED-ESC-*), que é o primeiro
passo do ciclo operacional e depende de sempre haver uma semana ABERTA.
