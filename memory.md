# Colheita — memória do progresso

## Estado atual: sistema funcional de ponta a ponta
O ciclo operacional completo da especificação formal está implementado e
foi testado manualmente com Playwright, rodando de ponta a ponta contra
Postgres real: login → criar semana → pedido de escola → devolução com
motivo → produtor (divisão/pedido/entrega) → resumo → balanço com custo
→ saldo calculado corretamente (validei a matemática à mão: bateu exato,
R$ 808,55). Histórico, motivos, preços e mapa de produção também
carregam sem erro.

**Isso não significa "pronto"** — falta cobertura de casos de borda,
telas de exportação, e testes automatizados das actions (só a lib de
cálculo pura e o acumulado PNAE têm testes; as Server Actions foram
validadas manualmente via Playwright, não por teste automatizado ainda).

## Arquitetura (recapitulando o pivô para a spec formal)
- `prisma/schema.prisma`: User(role), Product, School, Producer,
  ReturnReason, Price (histórico), Settings, ProductionMapEntry, Week
  (+ WeekReopening), SchoolOrder/SchoolDelivery/SchoolReturn,
  ProducerAllocation/ProducerOrder/ProducerDelivery/ProducerReturn,
  WeeklyCost, AuditLog. Pedido/entrega/devolução SEMPRE em tabelas
  separadas, nunca a mesma linha.
- `src/lib/calc.ts`: fórmulas puras (regra absoluta seção 55).
- `src/lib/pnae.ts`: acumulado anual PNAE direto do histórico real.
- `src/lib/week.ts`: getOpenWeek, assertWeekEditable (bloqueia edição em
  semana FECHADA), getCurrentPrice (resolve pelo `referenceDate` da
  semana, não por "agora" — assim toda edição na mesma semana usa o
  mesmo preço), getSettings.
- `src/lib/audit.ts`: writeAudit() genérico — toda action de mutação
  grava antes/depois no AuditLog.
- `src/lib/weekSummary.ts`: getTreasuryLines, getProducerPaymentLines,
  getWeekFinancialSummary (margem/saldo/conferência), getPendingProducerDeliveries.
- `src/lib/dal.ts`: verifySession() (confere no banco, não só no cookie)
  + requireRole/requireOperator.
- `src/app/actions/*.ts`: uma Server Action por tabela de mutação
  (weeks, schoolOrders, schoolReturns, schoolDeliveries,
  producerAllocations, producerOrders, producerDeliveries,
  producerReturns, weeklyCosts, returnReasons, prices) — todas exigem
  requireOperator()/requireRole(), checam `assertWeekEditable`, e
  gravam AuditLog.
- `src/app/(app)/`: todas as telas autenticadas (sidebar via
  `src/components/Sidebar.tsx`), fora do grupo: `src/app/login/`.
  Telas: `/` (dashboard + alertas PNAE), `/semanas` + `/semanas/[weekId]`
  (criar/fechar/reabrir), `/escolas` (grid 191×19 com busca e autosave
  por célula) + `/escolas/[code]` (ficha: devolução+motivo, entrega
  segunda/terça/excepcional, impressão), `/produtores` (linha
  expansível por produtor, mostra só os produtos do Mapa de Produção +
  permite adicionar produto fora do plano) + `/produtores/[internalId]`
  (ficha + barra de alerta PNAE), `/resumo` e `/balanco` (aceitam
  `?week=<id>` para ver qualquer semana do histórico), `/historico`
  (lista com filtro por status), `/motivos`, `/precos` (agenda troca de
  preço sem sobrescrever o histórico), `/mapa-producao` (só consulta).

## Ainda faltando (sendo direto)
- **Exportação** (seção 45-46): nenhuma tela/rota de exportação (CSV/PDF)
  existe ainda para nenhum relatório.
- **Importação assistida do Excel com preview/conferência** (seção
  53-54, CA-IMP-*): os dados vieram via script de seed direto; não há
  uma tela de upload+validação+confirmação. Se isso for exigido como
  fluxo de usuário (não só script único de migração inicial), precisa
  ser construído.
- **Gestão de usuários pela UI** (CA-USR-04: ADMIN gerencia usuários) —
  hoje só existe o usuário admin criado pelo seed; não há tela para
  criar/editar outros usuários (OPERADOR/CONSULTA) pelo app.
- **Tela de auditoria** — o AuditLog é gravado por toda mutação, mas não
  existe nenhuma tela para consultá-lo ainda.
- Nenhum teste automatizado cobre as Server Actions diretamente (só
  validação manual via Playwright) — os 23 testes automatizados cobrem
  a lib de cálculo pura + PNAE/histórico/preço histórico via Prisma
  direto, não as actions HTTP-like em si.
- Não testado em mobile real (só desktop via Playwright headless).

## Próximo passo exato
1. Rodar `npm run build` (build de produção) para pegar qualquer erro
   que só apareça em build otimizado (o dev server com Turbopack pode
   mascarar alguns).
2. Decidir com o usuário: exportação e importação assistida via UI são
   realmente necessárias agora, ou podem ficar para depois do primeiro
   uso real do sistema?
3. Configurar o deploy (Vercel + Neon Postgres) — variáveis de ambiente
   `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` —
   e rodar `prisma migrate deploy` + seed no banco de produção.
