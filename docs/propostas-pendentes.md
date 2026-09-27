# Propostas pendentes — dependências de banco, API e decisões

**Atualizado na Rodada 2 (26/09/2026).** As regras de negócio que na Rodada 1
eram "decisões a tomar" foram **confirmadas com Seu Paulo** e estão em
[`specs/008-recebimentos-faltas-fechamento/spec.md`](../specs/008-recebimentos-faltas-fechamento/spec.md).
O que continua pendente aqui é a **implementação técnica** que depende do
Lucas (schema, migrações, API Java, infraestrutura) e o alinhamento de
integração. Nada deste documento foi implementado no banco ou na API.

Tudo o que falta, agrupado por responsável (Lucas, Operação, Claude) e com a
tarefa correspondente de cada spec: seção
[Pendências por responsável](#pendências-por-responsável). O que já está
pronto, spec por spec: [`specs/README.md`](../specs/README.md), "Estado geral".

---

## 1. Entrega real por escola/produto, complementos e faltas (spec 008)

**Antes (Rodada 1):** proposta aberta, com a dúvida "cobrar pelo pedido ou
pelo entregue?".
**Agora:** decidido. A prefeitura paga pelo **aceito na escola**; o produtor
recebe pelo **aceito no galpão**; rejeição na escola é perda da cooperativa;
falta é resolvida por complemento no mesmo ciclo ou **encerrada sem
atendimento** antes do fechamento.

**O que falta (Lucas):** persistência. Tanto o Prisma atual quanto o SQL novo
guardam só a data de entrega por escola (uma por ciclo) e não têm quantidade
por produto, complemento, perda antes da escola nem decisão de falta. Dados e
validações necessários: [`specs/008…/plan.md`](../specs/008-recebimentos-faltas-fechamento/plan.md)
(itens 1 a 6).

**Testes de aceitação:** os casos de `src/lib/domain/cycle.test.ts` (exemplo
200/180/170, complemento de 30, falta encerrada em 170, vazio × zero, pedido 30
+ complemento 20 com inicial vazio, excesso × falta). A API deve reproduzir os
mesmos números.

**Já preparado (Claude):** regras puras e testadas em `src/lib/domain/cycle.ts`
— não ligadas a telas nem totais. Complementos e encerramento de faltas
(etapa 4): comandos, componentes e tela de demonstração prontos, sem gravação
— ver §9 para o que falta de persistência.

## 2. Cobrança e fechamento com faltas

Substituído pelas regras confirmadas (spec 008, RN-04, RN-09, RN-10). A antiga
proposta de **carregar reposições pendentes para a semana seguinte está
descartada**. Enquanto a persistência do item 1 não existir:
- a cobrança continua `pedido − devolução` no código (`src/lib/calc.ts`) e na
  view `v_week_financial_summary` — e agora isso está **escrito nas telas e
  no PDF do Balanço** ("Metodologia atual…");
- o fechamento continua bloqueando só por "registro de entrega existe"
  (spec 001, CA-03.*).

**Transição do histórico (Lucas + Claude):** ciclos fechados antes da troca
mantêm a metodologia antiga e são marcados assim; nada é recalculado. Sugestão:
um campo de metodologia por ciclo (`LEGADO_PEDIDO_MENOS_DEVOLUCAO` /
`ACEITE_ESCOLAR`).

## 3. Pedido do próximo ciclo sem fechar o atual

Sem mudança: continua proposta para o Lucas (status `PLANEJAMENTO` ou
equivalente). A regra "uma semana aberta" não foi removida. Detalhe: o ciclo
real atravessa semanas do calendário (pedido na quinta, entrega na segunda);
o identificador de ciclo e suas datas precisam cobrir isso sem reatribuir
registros antigos.

## 4. Ovos fora do fluxo ativo

**Feito no app (sem mexer no banco):** `src/lib/productPolicy.ts` marca Ovos
como retirado. Efeito: não aparece para novos pedidos (tela de escolas,
divisão/pedido de produtores), o servidor recusa **criar** novo lançamento de
Ovos, a importação lista a coluna como fora da oferta. O histórico continua
visível em ciclos que têm Ovos (tela, ficha, PDFs) — testado com Ovos
desativado num banco descartável.

**Falta (Lucas):** `UPDATE products SET active = false WHERE slug = 'ovos'` no
banco real (e o equivalente no banco novo). Depois disso a lista
`RETIRED_PRODUCT_SLUGS` pode ser esvaziada.

## 5. Backup e restauração (correção importante)

**Correção da Rodada 1:** o texto anterior sugeria rodar
`npm run test:integration` contra a cópia restaurada. **Não fazer isso**: essa
suíte chama `resetDb()` e **apaga** os dados restaurados. Verificação de uma
restauração deve ser **só leitura**:
- contagens por tabela (escolas, produtores, produtos, preços, ciclos, pedidos,
  entregas, devoluções, custos, auditoria) comparadas com a origem;
- relacionamentos (nenhum pedido/entrega sem ciclo, escola, produto ou preço);
- totais conhecidos de ciclos fechados (a cobrar, a pagar, custos) iguais aos
  PDFs/relatórios emitidos antes;
- um ciclo **aberto** incluído na cópia.

Testes destrutivos só em outro banco, criado para o teste e descartado depois
(como feito nesta rodada: `colheita_r2_descartavel_*`).

**Precisa ser recuperável:** ciclos e datas, pedidos das escolas, divisão e
pedidos aos produtores, recebimentos e rejeições no galpão, entregas/rejeições
nas escolas e complementos (quando existirem), decisões de falta, preços e
descontos históricos (`price_id`, snapshot de logística), custos, reaberturas e
auditoria. PDFs não substituem backup.

**Feito (etapa 6, 27/09/2026):** roteiro em
[`docs/backup-e-restauracao.md`](./backup-e-restauracao.md); verificação só
leitura `scripts/backup-verify.ts` (impressão digital por tabela com hash do
conteúdo, integridade e totais por ciclo; `--salvar` na origem, `--comparar`
na cópia); ensaio automatizado dump → banco novo → restauração → comparação em
bancos descartáveis (cópia idêntica; adulteração detectada; proteção de ciclo
fechado preservada na cópia).

**Infraestrutura, agendamento, retenção, criptografia e ensaio real de
restauração: Lucas** (sugestões no roteiro).

## 6. Divisão → pedido aos produtores sem redigitar

**FEITO (26/09/2026)** — spec [`010-divisao-para-pedidos`](../specs/010-divisao-para-pedidos/spec.md).
Em Produtores (ciclo aberto): "+ Gerar pedidos aos produtores a partir da
divisão" → prévia com demanda das escolas × divisão × pedidos → confirmação.
Pedido digitado diferente só muda com marcação explícita na linha; nada é
apagado; entregas não são tocadas; preço congelado na criação; auditoria com
motivo. Usa as tabelas atuais, sem mudança de schema. Quando a API do Lucas
assumir os pedidos, a regra pura (`src/lib/producerOrdersFromAllocation.ts`)
pode ser reaproveitada.

## 7. Contrato de integração Next.js ↔ API Java (proposta para alinhar)

**Situação:** as telas usam Prisma direto no banco antigo (IDs cuid, sem
organização). A API do Lucas (`api/`, Spring Boot) usa o banco novo
(`database/`, schema `colheita`, UUID, `organization_id`, JWT). Não estão
ligadas. **Integrar os commits no Git (feito) é diferente de conectar as telas
à API (não feito).** Trocar a URL do banco não resolve.

### 7.1 Backend de destino
- Fonte única de dados: a API Java sobre o banco novo.
- O Next vira cliente: Server Components/Actions chamam a API **no servidor**
  (nunca expor token ao navegador). Uma camada `src/lib/api/*` substitui as
  consultas Prisma tela a tela.
- Durante a transição, as duas bases não podem receber lançamentos ao mesmo
  tempo (evitar dois núcleos concorrentes). Corte por ciclo.

### 7.2 Autenticação e sessão
- Login no Next chama `POST /api/v1/auth/login`; o Next guarda access e refresh
  token em cookie `httpOnly`, `secure`, `sameSite=lax`; renova com
  `/auth/refresh` (rotação) e encerra com `/auth/logout`.
- Papéis ADMIN/OPERADOR/CONSULTA já coincidem. Permissões vêm do JWT; o Next
  só esconde botões — a autorização é da API.
- Organização: uma só (Cooperativa de Petrópolis) por enquanto; slug fixo em
  configuração.

### 7.3 IDs e dados históricos
- Migração dos dados do banco antigo para o novo (Lucas): tabela de
  correspondência cuid → UUID mantida; chaves naturais para conferir
  (código da escola, slug do produto, `internalId` do produtor, número da
  semana).
- Preservar em cada lançamento o `price_id` e o snapshot de logística
  originais; migrar reaberturas e auditoria.
- Conferência da migração por totais de cada ciclo (a cobrar, a pagar, custos)
  antes/depois — mesma lista do item 5.

### 7.4 Endpoints que faltam (além dos existentes)
- Eventos de entrega à escola por produto, complementos, perda antes da escola,
  decisão de falta (spec 008).
- Gravação em lote do pedido das escolas (importação), com as garantias da
  spec 009: transação única, atualização condicionada ao valor anterior (ou
  versão), auditoria com origem.
- Resumo por ciclo com a metodologia (spec 008, item 6 do plan) e dados dos
  documentos (spec 004) — ou listas paginadas suficientes para o Next montar os
  PDFs.
- Gerar pedidos a partir da divisão (item 6): já implementada no Next sobre as
  tabelas atuais (spec 010); se passar para a API, manter as mesmas garantias
  (prévia, transação única, atualização condicionada, preço congelado, auditoria).

### 7.5 Revisão técnica da API atual (para revisão conjunta)
Encontrado lendo `api/` e `database/` (sem executar):
1. `OperationJdbcAdapter.upsertProducerDelivery` sobrescreve `price_id` e
   `logistics_deduction_snapshot` no `ON CONFLICT DO UPDATE` com o que o
   cliente enviar — o histórico de preço/desconto precisa ser congelado no
   servidor (atualizar só quantidade/data em correções). Mesmo problema em
   `upsertSchoolOrder` e `upsertProducerOrder` (`price_id`).
2. Nenhuma validação de devolução × pedido/entrega (nem no serviço nem no SQL,
   que só impede negativos). Também não impede reduzir entrega abaixo da
   devolução já lançada. Precisa de checagem no servidor com controle de
   concorrência (trava de linha ou versão).
3. `OperationService.mutate` grava auditoria com `before`/`after` nulos —
   perde o valor anterior de correções.
4. Fechamento (`WeekJdbcAdapter.closingBlockers`) só verifica existência de
   registro de entrega — não representa aceite por produto, complementos nem
   decisão de falta (spec 008, CA-008.5).
5. `v_week_financial_summary` calcula a cobrança por pedido − devolução
   (metodologia antiga).
6. `UNIQUE (organization_id, week_id, school_id)` em `school_deliveries` e
   `UNIQUE (…, producer_id, product_id)` em `producer_deliveries` impedem
   complementos e segunda entrega.

### 7.6 Quem faz o quê (proposta)
| Parte | Responsável |
|---|---|
| Schema/migrações novas (spec 008), correções 1–6 acima | Lucas |
| Migração dos dados antigos + conferência por totais | Lucas (conferência junto) |
| Autenticação na API e política de tokens | Lucas |
| Cliente da API no Next (`src/lib/api`), troca tela a tela | Claude, depois do contrato fechado |
| Regras puras e casos de teste (spec 008) como referência para o Java | Claude (feito) |
| Leitura de Excel/PDF (spec 009) | Claude (feito; pode ficar no Next) |
| Backup e restauração | Lucas |

## 8. Outros achados para o Lucas

- **Arredondamento do total a cobrar — DECIDIDO (26/09/2026):** somar as
  linhas já arredondadas a 2 casas, só em ciclos novos. Já aplicado no app
  (ciclos criados a partir de 27/09/2026; ver spec 008, plan). **Lucas:**
  aplicar a mesma regra na view `v_week_financial_summary` do banco novo para
  ciclos novos, sem recalcular os antigos.
- **Dependência com alerta alto:** `npm audit` aponta `deepmerge-ts`
  (via `prisma`/`@prisma/config`) como alta severidade — a correção exige
  atualizar o Prisma, o que mexe na ferramenta de schema/migrações; fica para
  avaliação do Lucas. `uuid` (via exceljs) segue como moderada, já registrada
  na Rodada 1. A nova dependência `unpdf` não trouxe alertas.
- **Layout no celular — CORRIGIDO (26/09/2026):** em ≤ 860 px o menu lateral
  continuava visível e interceptava cliques em todas as telas autenticadas,
  porque a regra base `.sidebar` (e a camada "Colheita 2.0") vinha depois do
  `@media` que o escondia. Corrigido repetindo `.sidebar { display: none }` na
  media query de 860 px da camada 2.0 (`src/app/globals.css`). Verificado em
  13 telas: em 390 px sem menu lateral, sem rolagem lateral e com cliques
  funcionando; em 1400 px o layout é o mesmo (menu de 260 px).

## 9. Complementos e encerramento de faltas — o que falta de persistência (etapa 4)

**Situação (26/09/2026):** regras, testes, componentes e tela **prontos, mas
sem gravação**. A tela `/complementos-faltas` é uma **demonstração com dados
fictícios**: roda em memória no navegador e se perde ao recarregar. Não
alimenta nenhum valor oficial, PDF ou fechamento. Não foi criado nenhum
substituto em Prisma (seria um segundo núcleo, proibido pelo prompt v2).

### O que já existe (Claude)

| Peça | Arquivo | Estado |
|---|---|---|
| Regras dos comandos (entrega inicial, complemento, correção, falta em resolução, encerrar sem atendimento, revogar) | `src/lib/domain/cycleLedger.ts` | testado (23 testes) |
| Núcleo de quantidades e estados | `src/lib/domain/cycle.ts` | testado (40 testes) |
| Porta de persistência (contrato) | `src/lib/cycleCore/repository.ts` (`CycleCoreRepository`) | definida |
| Repositório em memória (testes e demonstração) | idem (`InMemoryCycleCoreRepository`) | testado (concorrência, duplo clique) |
| Componentes desacoplados | `src/components/cycle-core/*` | testados pela interface |
| Tela de demonstração | `src/app/(app)/complementos-faltas/` | testada pela interface (dados fictícios) |

As telas só falam com `CycleCoreRepository`. Quando existir a persistência,
basta um adaptador que implemente `load` e `execute` chamando a API — a tela
não muda.

### O que o banco/API precisa oferecer (Lucas)

1. **Evento de entrega à escola por produto** (`school_delivery_events` ou
   equivalente) com: `id`, organização, ciclo, escola, produto, `kind`
   (`INICIAL` | `COMPLEMENTO`), `presented_qty` (nulo = não informado),
   `rejected_qty` + `rejection_reason`, `loss_before_school_qty` +
   `loss_reason`, **origem** (`source_type` `PRODUTOR` | `SALDO_GALPAO` +
   `source_producer_id`), `delivered_at` (data/hora real, com fuso),
   `received_by` (texto do romaneio), `idempotency_key`, `version`,
   `created_by`, `created_at`.
   - **Viagem do complemento** (`trip`, RN-22, 27/09/2026):
     - `MESMA_VIAGEM` | `OUTRA_VIAGEM`, obrigatória no `COMPLEMENTO` e nula
       no `INICIAL`;
     - no `MESMA_VIAGEM`, rejeição e perda são zero e `delivered_at` e
       `received_by` são nulos;
     - esse evento não soma no entregue à escola, porque a entrega inicial já
       traz o total do romaneio.
   - Único: no máximo um `INICIAL` por ciclo/escola/produto; `COMPLEMENTO`
     sem limite. Único também em (ciclo, `idempotency_key`).
2. **Decisão de falta** por ciclo/escola/produto (uma vigente): `kind`
   (`EM_RESOLUCAO` | `ENCERRADA_SEM_ATENDIMENTO`), `reason`,
   `shortage_qty_at_decision` (só no encerramento), `decided_by`,
   `decided_at`, `version`. Revogação remove a vigente e fica na auditoria.
3. **Auditoria** na mesma transação de cada comando: ação, antes/depois só
   dos campos alterados, motivo, usuário, horário.
4. **Um endpoint de comando** (ou um por tipo) que receba exatamente o
   `CycleCommand` de `cycleLedger.ts` e responda como `CommandResult`
   (`APLICADO` | `JA_REGISTRADO` com avisos, ou erro `CICLO_FECHADO` |
   `SEM_PERMISSAO` | `INVALIDO` | `CONFLITO` | `NAO_ENCONTRADO`), e um de
   leitura que devolva o estado do ciclo (pedidos com preço congelado,
   recebimentos do galpão com preço/desconto congelados, eventos, decisões).

### Validações que o servidor precisa repetir (não confiar na tela)

- Ciclo fechado não aceita comando; perfil CONSULTA não altera.
- Complemento só com pedido original (> 0), origem explícita e quantidade
  > 0; não presumir que o produtor original repôs.
- Segunda entrega inicial é recusada: correção não é nova entrega.
- Rejeição ≤ entregue no mesmo evento; reduzir entregue abaixo da rejeição já
  registrada é recusado; rejeição e perda exigem motivo; até 2 casas decimais.
- Complemento sem viagem é recusado. No `MESMA_VIAGEM`, rejeição, perda,
  data/horário e recebedor próprios são recusados. As origens da mesma viagem
  não podem somar mais que o `presented_qty` da entrega inicial conferida:
  vale ao gravar o complemento, ao corrigir a entrega inicial e ao corrigir a
  viagem (RN-22).
- Correção exige motivo e a `version` aberta na tela (senão `CONFLITO`).
- Reenvio com a mesma `idempotency_key` e mesmos dados = `JA_REGISTRADO`;
  com dados diferentes = `CONFLITO`.
- Encerrar falta só com todas as entregas da linha conferidas (vazio não é
  zero), falta > 0, motivo, e a falta atual igual à mostrada na tela.
- Decisão usa `version` (duas pessoas decidindo ao mesmo tempo → a segunda
  recebe `CONFLITO`).
- Depois de qualquer mudança em entrega, rejeição ou complemento, a decisão
  de encerramento que não bate mais com a falta vira "decisão incoerente" e
  bloqueia o fechamento até ser revista (RN-11).
- Fechamento bloqueado também por complemento de produtor sem recebimento
  conferido desse produtor no galpão (ele não seria pago). Escolas com mais do
  que o galpão aceitou num produto é só **aviso** ("saldo a conferir").

### Decisões confirmadas (27/09/2026 — antes eram hipóteses)

- **Quem decide a falta:** ADMIN e OPERADOR (os mesmos que fecham a semana).
  Definitivo (spec 008 RN-19).
- **Origem "saldo do galpão":** aceita para complemento com produto já
  recebido e pago a quem entregou. Definitivo (RN-20). Sobra de outro ciclo não
  é modelada; excesso das escolas sobre o galpão é aviso, não bloqueio.
- **Motivo obrigatório** em rejeição e perda, com a opção "Motivo não
  identificado". Definitivo (RN-21).
- **Um romaneio por escola e visita** (27/09/2026, RN-22), como na planilha
  MODELO v22:
  - complemento na mesma viagem vai no romaneio da entrega inicial, com a
    origem registrada só internamente;
  - dois romaneios só quando for outra viagem.

Continua em aberto (depende do Lucas): **segundo recebimento do mesmo
produtor no mesmo ciclo** (ex.: volta à tarde) — hoje 1 linha por
produtor/produto no galpão.

### Aceite

Os casos de `docs/aceitacao/` (§11.7) — que cobrem `cycleLedger.test.ts` —
devem passar na API antes de a tela usá-la.

## 10. Telas e documentos pela lógica corrigida — o que falta de persistência (etapa 5)

**Situação (26/09/2026):** o conteúdo das telas e dos PDFs/ZIP pela lógica
corrigida está **pronto e testado a partir do registro do ciclo**
(`CycleLedger`), mas só é usado na **demonstração** (`/complementos-faltas`,
dados fictícios, faixa "DEMONSTRAÇÃO" em todas as páginas). As semanas reais
continuam nos documentos e telas do modelo atual (pedido − devolução),
identificados como tal. Nada foi recalculado.

### O que já existe (Claude)

| Peça | Arquivo | Estado |
|---|---|---|
| Conteúdo dos documentos (pedido, romaneios inicial e de complemento, galpão, entregas e atendimento, diferenças com saldo a conferir, balanço pelo aceito) | `src/lib/cycleCore/documents.ts` | testado (11) |
| PDFs desses documentos | `src/lib/pdf/cycleCoreReports.tsx`, `EventRomaneiosDocument.tsx`, `AcceptedBalanceDocument.tsx` | testado (render + texto extraído; volume 191 escolas opcional) |
| Ponto de troca por metodologia | `DOCUMENT_SOURCES` e `methodologyOfRealCycle()` em `documents.ts`, usado pelas rotas `/api/semanas/[id]/pdf/*` | todos os ciclos reais = modelo atual |
| Resumo de atendimento navegável (clique → detalhe da escola/produto) | `src/components/cycle-core/AttendanceSummaryTable.tsx` | testado pela interface |
| Documentos da demonstração (PDF e ZIP a partir do estado da tela) | `/api/demonstracao/documentos/*` (valida com zod, exige login, nada é gravado) | testado pela interface |

Os **sete tipos de documento continuam os mesmos** (mesmos nomes de arquivo);
só a fonte muda. "Pedidos aos Produtores" não muda de fonte. Mudanças de
conteúdo no novo modelo:
- **Romaneios:** um documento da entrega inicial por escola (em branco
  enquanto previsto; "cópia conforme registro" depois) e **um documento
  próprio para cada complemento** (`<ciclo>-<escola>-C1`, `-C2`…), com pedido
  original, aceito antes, entregue/rejeitado/aceito agora e origem — o
  romaneio inicial nunca é alterado. Data/horário real impressos quando
  registrados; linha manual em branco quando não.
- **Entregas às Escolas → Entregas e Atendimento:** pedido, entregue
  (inicial + complementos), rejeição da escola, perda antes da escola, aceito,
  falta, excedente e situação (pendente de conferência / falta sem decisão /
  em resolução / encerrada sem atendimento com motivo / atendido / com
  excedente); totais e percentual de atendimento por unidade.
- **Diferenças:** acrescenta "saldo a conferir" (aceito no galpão − entregue
  às escolas − perda antes da escola) e a falta das escolas à parte.
- **Balanço:** a cobrar pelo aceito na escola, a pagar pelo aceito no galpão,
  os três indicadores (conferido / calculado / pronto para fechar), motivos de
  bloqueio e faltas encerradas com motivo.
- **Regra de total de falta:** só linhas **conferidas** entram no total;
  linhas a conferir aparecem à parte (antes, uma falta parcial de linha
  pendente era somada como falta). Vale para o núcleo (`cycle.ts`), telas e
  PDFs.

### Validação contra ciclo fechado (27/09/2026)

Galpão (recebimento, rejeição, a pagar), custos e diferença: a lógica corrigida
bate com o modelo atual num ciclo fechado fictício, linha a linha; script só
leitura pronto para rodar num ciclo real por quem tem acesso
(`docs/validacao-ciclo-fechado.md`). **Ciclo real: não executado** (sem acesso
nesta sessão). **Cobrança escolar: não validável em nenhum ciclo** — não
existe entrega por escola/produto registrada (bloqueio de persistência, Lucas).
**Tela no app (27/09/2026):** `/semanas/<id>/validacao`, só leitura e só
ADMIN, com link na página de cada semana fechada — em produção, um ADMIN valida
um ciclo real sem acesso ao banco e sem rodar script.

### O que falta para ligar nas semanas reais (Lucas + integração)

1. Tudo do §9 (eventos de entrega por escola/produto, decisões de falta,
   auditoria, endpoint de comando e de leitura).
2. **Metodologia gravada por ciclo** (`LEGADO_PEDIDO_MENOS_DEVOLUCAO` ×
   `ACEITE_ESCOLAR`), escolhida explicitamente ao abrir um ciclo no novo
   modelo; ciclos antigos ficam no legado para sempre. Com isso,
   `methodologyOfRealCycle()` passa a ler o ciclo e as rotas de PDF escolhem a
   fonte por `DOCUMENT_SOURCES` sem outra mudança.
3. **Leitura do ciclo** com: pedidos com preço congelado, recebimentos do
   galpão com preço/desconto congelados, eventos, decisões e **custos reais**
   (`WeeklyCost`) — o balanço do novo modelo já aceita custos.
4. **Nomes do cadastro** (escolas, produtos, produtores) na mesma leitura, com
   código da escola; continua valendo o aviso de cadastro sem histórico.
5. Depois disso (Claude): adaptador da porta `CycleCoreRepository` para a API,
   builders reais na rota `/api/semanas/[id]/pdf/*` e troca das telas
   Resumo, Balanço, Diferença e página da semana para a nova fonte nos ciclos
   `ACEITE_ESCOLAR` (componentes prontos). Teste de volume real com 191 escolas.

---

## 11. Revisão noturna de segurança, código e testes (27/09/2026)

Revisão de todas as etapas (Rodada 1 e 2). Legenda: **Corrigido** = mudado e
testado nesta revisão; **Documentado** = precisa de decisão ou da área do Lucas.

### 11.1 Dependências (npm audit: 3 altos, 4 moderados)

| Pacote | Gravidade | Chega ao app em execução? | Situação |
|---|---|---|---|
| `deepmerge-ts` 7.1.5 (via `prisma` → `@prisma/config` 6.19.3) | alta (estouro de pilha ao mesclar objetos recursivos) | **Não**: só na ferramenta de linha de comando do Prisma (config local); não está no pacote do servidor (`.next/server`) | **Documentado.** Não há correção simples: 6.19.3 é a última 6.x e fixa essa versão; as saídas são voltar para 6.12 (regressão) ou migrar para Prisma 7 (versão principal, exige adaptadores de driver). Forçar `overrides` mudaria a ferramenta de migrações sem suporte do fabricante. **Lucas** decide junto com a migração para o Prisma 7. |
| `uuid` 8.3.2 (via `exceljs` 4.4.0) | moderada (sem checagem de limite quando `buf` é passado, v3/v5/v6) | Não explorável: o exceljs só usa `v4()` sem `buf` | Documentado; a "correção" do npm é voltar o exceljs para 3.4 (pior). |
| `vitest` 3.2.7 / `@vitest/mocker` | moderada (leitura de arquivo em mock) | Não: só roda nos testes | Documentado; correção exige vitest 4/5 (versão principal). |

### 11.2 Permissão e sessão

- **Corrigido — páginas sem checagem própria de sessão.** 13 de 15 páginas
  autenticadas dependiam só do layout. Pela documentação do Next (Autenticação,
  "Layouts and auth checks"), o layout não roda de novo na navegação; o proxy
  só confere a assinatura do cookie. Um usuário **desativado** com cookie
  válido podia continuar lendo dados ao navegar. Agora toda página chama
  `verifySession()` (que confere no banco se o usuário está ativo).
- **Corrigido — login revelava quais e-mails têm conta pelo tempo de
  resposta** (sem usuário, respondia sem rodar o bcrypt). Agora sempre compara
  (hash fictício quando não há usuário).
- **Documentado — sem limite de tentativas de login** (força bruta). Um
  limitador em memória não funciona com várias instâncias/serverless; precisa
  de armazenamento compartilhado (tabela ou Redis) — **Lucas**.
- **Documentado — sessão de 7 dias sem revogação no servidor.** Mitigado:
  toda leitura/ação confere no banco se o usuário está ativo e qual o papel
  atual. Sair apaga o cookie, mas um cookie copiado antes continua válido até
  expirar para quem não foi desativado. Revogação real exigiria lista de
  sessões no banco — **Lucas**.
- **Documentado — senha padrão de admin no seed** (`prisma/seed.ts`, usada
  quando `ADMIN_PASSWORD` não está definida fora de produção). Uma homologação
  ou preview sem a variável teria admin com senha conhecida (o código está no
  repositório). Sugestão: exigir `ADMIN_PASSWORD` sempre. Seed é área do **Lucas**.
- Conferido sem achado: todas as ações de servidor exigem sessão e papel
  (ADMIN para preços e reabertura; OPERADOR para lançamentos; CONSULTA só lê);
  todas as rotas de PDF/ZIP e da demonstração exigem login; cookie `httpOnly`,
  `sameSite=lax`, `secure` em produção; JWT HS256 com segredo ≥ 32 caracteres;
  nenhum `.env` real versionado (só `.env.example` com textos de exemplo).

### 11.3 Dados sensíveis em erro ou log

- **Corrigido — mensagens de erro cruas do banco iam para a tela.** 13 ações
  devolviam `err.message`; um erro do Prisma pode conter nome de tabela,
  coluna, valores ou trecho de consulta. Agora `src/lib/publicError.ts`: regra
  de negócio passa como está; gatilho de semana fechada vira texto amigável
  (sem o id); duplicidade/registro sumido viram orientação; o resto vira
  mensagem genérica e só o **código** técnico vai para o log do servidor.
- **Corrigido — erro de validação aparecia como JSON técnico** (o `.parse` do
  zod lança um erro cuja mensagem é o JSON das regras). Agora mostra só a
  primeira regra violada.
- Conferido sem achado: nenhum `console.log` no código do app; scripts de
  teste, validação e backup nunca imprimem a URL do banco (testado); o seed
  imprime só o e-mail do admin.

### 11.4 Validação só na tela

- **Corrigido — mais de 2 casas decimais era arredondado em silêncio pelo
  banco** (colunas `Decimal(10,2)`/`(12,2)`: 1,005 virava 1,01). Agora o
  servidor recusa com "Use no máximo 2 casas decimais".
- **Corrigido — sem teto de valor**: número acima da capacidade da coluna
  estourava no banco; agora mensagem clara.
- **Corrigido — categoria de custo** vinha do navegador sem checagem; agora só
  as 8 categorias do cadastro.
- **Corrigido — escola/produtor inativo** era escondido só na tela; o servidor
  aceitava pedido, divisão ou pedido ao produtor novo enviado direto. Agora
  recusa lançamento **novo** (corrigir o que já existe continua permitido). Não
  aplicado ao **recebimento no galpão** de propósito: entrega física de
  produtor desativado no meio do ciclo não deve ser impedida. **Confirmado em
  27/09/2026: mantém como está.**
- **Corrigido — observações da semana e motivo de reabertura sem limite de
  tamanho**; agora até 2.000 caracteres.
- Conferido sem achado: quantidades nunca negativas no servidor; devolução ≤
  pedido/entrega e motivo ativo checados no servidor; semana fechada recusada
  no servidor e por gatilho no banco; importação e divisão→pedido recalculam
  tudo no servidor e comparam assinatura; datas da semana validadas no
  servidor.

### 11.5 Testes-fantasma

Varredura de 205 testes (sem `expect`, retorno antecipado, `expect` dentro de
`if`/`catch`, pulados, tautologias):

- **Corrigido — `disposableDb.test.ts` "nenhuma mensagem expõe a senha"**: um
  "deveria ter recusado" lançado no `try` era engolido pelo próprio `catch`;
  se a proteção aceitasse um banco remoto, o teste continuava verde. Provado
  por mutação: com a recusa desligada, o teste antigo passaria; o novo falha.
- **Corrigido — `cycleLedger.test.ts` "falta encerrada não vira pedido no
  ciclo seguinte"**: montava o ciclo seguinte à mão e conferia que ele não
  tinha decisões (tautologia). Agora testa o que existe: decisão registrada
  só no ciclo, fechamento liberado, falta não cobrada.
- **Ajustado** — dois `if (!x.ok) return;` (já precedidos de
  `expect(ok).toBe(true)`, então não eram fantasma) viraram `throw`, explícitos.
- Conferido: os 2 testes pulados são opcionais e declarados (GZ real com
  `GZ_XLSX_PATH`; volume de PDFs com `PDF_VOLUME=1`); o único mock é o de
  `console.error` no teste do `publicError`.

### 11.8 Arrumação

- Teste de integração antigo (`pnae.integration.test.ts`) passou a usar o
  mesmo auxiliar de limpeza dos novos (`src/lib/testing/integrationDb.ts`:
  confere nome + marca do banco descartável antes de apagar).
- Demonstração (`/complementos-faltas`): roteiro de apresentação em 5 passos
  (uma regra por escola fictícia); auditoria em português legível ("rejeitado:
  10 → 0", "Lançamento corrigido") em vez de códigos e JSON; texto do que falta
  para funcionar de verdade sem jargão técnico.
- Tela de validação: o "não validado" mostra o valor em reais e o método de
  arredondamento por extenso (antes: `1358.73`, `TOTAL_LEGADO`).

### 11.7 Pacote de aceitação para o Lucas (27/09/2026)

`docs/aceitacao/`: 15 cenários (spec 008, galpão, fechamento, permissões,
reenvio, correções, unidades) e 5 cálculos em JSON (versão 2, de
27/09/2026: 17 cenários, com o complemento na mesma viagem), mais o **contrato dos
comandos em JSON Schema**, gerados do código testado — o teste falha se o JSON
ficar desatualizado, e cada caso roda contra a implementação de referência. A
API Java deve passar nos mesmos casos antes de qualquer tela usá-la. Instruções
em `docs/aceitacao/README.md`.

### 11.6 Carga leve e condições de corrida

Teste novo `src/lib/concurrency.integration.test.ts`: roda as **ações de
servidor reais** (transação, validação, auditoria) em paralelo no banco
descartável; só a sessão é trocada por um usuário de teste. (Para isso foi
criado `vitest.config.ts`, que só acrescenta o atalho `@/` do tsconfig.)

- **Corrigido — devolução podia ficar maior que o pedido ou a entrega.**
  Reproduzido **40 em 40** rodadas: uma pessoa reduz o pedido (20 → 5)
  enquanto outra lança devolução de 10; as duas passavam (a devolução lia o
  pedido **fora** da transação e o pedido lia a devolução em outra). O mesmo no
  galpão (entrega × devolução ao produtor). O código já tinha um comentário
  reconhecendo a janela. Corrigido sem schema: trava de transação do Postgres
  (`pg_advisory_xact_lock`) por ciclo × escola/produtor × produto, usada pelas
  duas ações do par; a leitura do pedido/entrega passou para dentro da
  transação, depois da trava (`src/lib/locks.ts`). Depois: **0 em 40**, em 3
  execuções seguidas.
- **Corrigido — importação da prefeitura** também podia reduzir um pedido
  enquanto alguém lançava devolução; agora trava (em ordem fixa, sem impasse)
  só as linhas em que o pedido diminui, antes de ler as devoluções.
- **Documentado para o Lucas:** a regra "devolução ≤ pedido/entrega" continua
  só no app (agora sem corrida). Uma checagem no próprio banco protegeria
  também gravações feitas por fora do app — e **a API Java precisa da mesma
  trava** (ou da checagem no banco), senão a corrida volta por ela.
- **Documentado — armadilha de código:** `saveProducerAllocation(semana,
  produto, produtor, qtd)` recebe produto antes do produtor, ao contrário das
  outras ações de produtor; como os dois são texto, o compilador não acusa a
  troca. A tela chama na ordem certa (conferido). Não alterado para não mexer
  nas chamadas existentes; sugestão: passar um objeto com nomes.
- Conferido sem achado (e agora coberto por teste):
  - 1.910 pedidos (191 escolas × 10 produtos) gravados em paralelo, de 25 em 25: nenhuma linha perdida ou duplicada, auditoria de cada um, total certo;
  - a mesma escola/produto gravada 10 vezes ao mesmo tempo: uma linha, valor final de uma das gravações, auditoria só das que deram certo, erro sem detalhe interno;
  - fechar a semana no meio de 100 gravações: cada linha fica com o valor de quem conseguiu gravar, nada é gravado nem auditado depois do fechamento;
  - três pessoas criando semana ao mesmo tempo: uma única semana aberta;
  - duas confirmações simultâneas da divisão → pedido: nenhum pedido duplicado, auditoria única.
- Repetição: suíte unitária 3× (197 passando, 2 opcionais), integração 3×
  (21 passando), volume de PDFs 1× (191 escolas: 69 + 211 + 57 páginas em
  cerca de 17 s). Nenhuma instabilidade.

---

## 12. Planilha MODELO v22 × app (27/09/2026)

A MODELO v22 é a **referência oficial** da planilha. Substitui a v20, e a v35
foi retirada do repositório. O arquivo, vazio, está em
`docs/referencia-planilha/controle_escolas_produtores_2026_MODELO_v22.xlsx`.
Os únicos números digitados nele são preços, códigos de motivo, a ordem das
paradas e as capacidades do mapa de produção. Planilha com pedido real ou
simulação não é versionada.

### O que mudou da v20 para a v22

A comparação foi célula por célula, nas 225 abas. **A lógica financeira não
mudou.**

- **Fichas de produtor** (as 22 abas "PROD - …"):
  - entrou a coluna **Aceito (kg) = Entrega − Devolução**;
  - as colunas passaram a ser Pedido, Entrega, Devolução, Aceito, Preço
    líquido (`preço − 3,67`), Valor a pagar (`Aceito × Preço líquido`),
    Cód. motivo e Motivo, estes dois ocultos na impressão;
  - Pedido e Entrega vêm da Entrada de Dados; **só a Devolução é digitada
    na ficha**;
  - área de impressão `A1:I31`, colunas mais largas e campo "Horário" ao lado
    da data do recebimento.
- **Resumo e Balanço:** acompanharam a troca de colunas (código do motivo na
  coluna H, total a pagar em `G25`).
- **Índice:**
  - o passo 2 foi corrigido: a Entrega se digita no bloco ENTREGA PRODUTORES
    e só a Devolução na ficha. A v20 mandava digitar as duas na ficha;
  - as orientações "Onde registrar cada rejeição" e "Complemento: primeira
    carga ou outra viagem" ficaram visíveis na impressão, com o mesmo texto.
- **Complementos:** o comprovante de entrega à escola diz "já pago no
  recebimento no galpão".
- **Fichas de escola:** só o cabeçalho da tabela ficou mais alto na
  impressão.

### v22 × app — situação de cada ponto

- **Bate com o app:**
  - aceito no galpão = entrega − devolução;
  - valor a pagar = aceito × (preço − 3,67);
  - complemento em outra viagem com comprovante próprio;
  - falta "encerrada sem atendimento" sem passar para a semana seguinte.
- **Centavos — Documentado, já decidido:**
  - a planilha não arredonda cada linha do produtor; o app arredonda cada
    linha e soma as linhas (RN-15, decisão de 26/09/2026);
  - o total de um produtor pode diferir em centavos quando kg × preço tem
    mais de 2 casas. Vale a regra do app.
- **Desconto de logística — Documentado:**
  - a planilha tem 3,67 fixo na fórmula; o app guarda uma cópia congelada em
    cada lançamento (RN-02);
  - só diverge se o desconto mudar: a planilha recalcularia semanas antigas,
    o app não.
- **Ficha impressa do produtor — Corrigido (27/09/2026):**
  - `/produtores/[código]` passou a mostrar as colunas "Aceito" e "Preço
    líquido" e os campos em branco de data e horário do recebimento, como na
    v22 (spec 004 RD-15, T12);
  - antes a ficha mostrava só Pedido, Entrega, Devolução e Valor;
  - a tabela rola dentro da ficha no celular.
- **Complemento na mesma viagem — Decidido e implementado (27/09/2026):**
  - sai um romaneio só por escola e visita, como na planilha (spec 008
    RN-22, CA-008.21 e CA-008.22; spec 004 RD-12);
  - a entrega inicial registra o total do romaneio (170 + 30 = 200);
  - o complemento da mesma viagem guarda só a origem (produtor ou saldo do
    galpão) e a quantidade, para o pagamento e a auditoria, sem documento
    próprio;
  - dois romaneios só quando for outra viagem;
  - antes, o núcleo novo sempre gerava um romaneio próprio para o
    complemento;
  - contrato e pacote de aceitação atualizados (`docs/aceitacao/`, versão 2);
  - persistência: campo `trip` no evento de entrega (§9, Lucas).
- **Onde se digita:**
  - na planilha, a entrega é digitada na Entrada de Dados e a devolução na
    ficha do produtor;
  - no app, as duas ficam na mesma linha de "Divisão / Pedido / Entrega";
  - é o mesmo dado, sem efeito no cálculo.
- **Motivo da devolução no galpão:** a planilha tem as colunas, mas ocultas na
  impressão. O app pede o motivo na tela e, no modelo novo, o torna
  obrigatório (RN-21, com "Motivo não identificado").

### Regras que vieram de versões anteriores da planilha (v27 → v35)

Todas já estão no app:
- o teto PNAE de R$ 40.000 por produtor por ano é calculado do histórico
  semanal, sem controle manual;
- Ovos é vendido por dúzia e nunca entra em total de kg (RN-14);
- a devolução nunca passa do pedido (escola) nem da entrega (produtor), com
  trava contra salvamentos simultâneos (§11.6);
- a Diferença do galpão por produto tem situação FALTA / SOBRA / OK.

O Mapa de Montagem (18 rotas fixas) está descrito em `specs/backlog.md`,
Etapa 7.

---

## Pendências por responsável

Cada item aponta a tarefa da spec onde está o critério de pronto. Tudo o que
depende do Lucas é de banco, API ou infraestrutura: a área reservada a ele
(pastas `api/` e `database/`, schema, migrações, seed, conexão, credenciais).

### Lucas (banco, API, infraestrutura) — o que destrava o resto

1. **Gravar a entrega real por escola/produto**: eventos inicial e
   complemento, com origem, **viagem do complemento** (RN-22), rejeição,
   perda antes da escola, data/hora real e quem recebeu (§9, item 1). Spec 008
   T05.
2. **Gravar a decisão de falta** (em resolução ou encerrada sem atendimento),
   com versão (§9, item 2). Spec 008 T05.
3. **Auditoria** na mesma transação de cada comando: antes/depois, motivo,
   usuário (§9, item 3). Spec 008 T05.
4. **Endpoint de comando e endpoint de leitura do ciclo** no formato de
   `src/lib/domain/cycleLedger.ts`, com pedidos, recebimentos, eventos,
   decisões, custos reais e nomes do cadastro (§9, item 4; §10, itens 3 e 4).
   Contrato: `docs/aceitacao/contrato-comandos.schema.json`. Spec 008 T05.
5. **Metodologia gravada por ciclo** (`LEGADO_PEDIDO_MENOS_DEVOLUCAO` ×
   `ACEITE_ESCOLAR`). Os ciclos antigos ficam no legado para sempre (§10,
   item 2). Spec 008 T09.
6. **A API passar no pacote de aceitação** `docs/aceitacao/` (versão 2: 17
   cenários, 5 cálculos) antes de qualquer tela consumi-la (§11.7). A
   referência executável das mesmas regras está em
   `src/lib/domain/cycle.test.ts` e `src/lib/domain/cycleLedger.test.ts`.
   Spec 008 T12.
7. **Correções na API atual:**
   - preço e desconto congelados também nas correções;
   - devolução ≤ entrega com trava contra corrida (a mesma de
     `src/lib/locks.ts`, §11.6);
   - auditoria com antes/depois;
   - fechamento pelos estados da spec 008 (§7.5).

   Spec 008 T06 e T07.
8. **Combinar o contrato Next ↔ API** (autenticação, IDs, dados históricos)
   antes de qualquer tela passar a consumir a API (§7). Spec 008 T08.
9. **Arredondamento por linha** na view `v_week_financial_summary`, só para
   ciclos novos (§8). Spec 008 T14.
10. **Segurança** (§11), spec 001 T11–T14:
    - limite de tentativas de login e revogação de sessão (precisam de
      armazenamento);
    - `ADMIN_PASSWORD` obrigatória sempre no seed;
    - decidir a migração para o Prisma 7 (alerta alto em `deepmerge-ts`, só
      na ferramenta de linha de comando).
11. **Backup em produção**: infraestrutura, agendamento, retenção e ensaio
    real de restauração. A verificação só leitura e o roteiro estão prontos:
    `docs/backup-e-restauracao.md` (§5). Spec 001 T15.
12. **Desativar Ovos** no banco real (§4). Spec 001 T16.
13. Arquivamento imutável dos PDFs emitidos (spec 004 T10); associações
    persistidas entre importações e OCR, se a operação precisar (spec 009 T11
    e T12).

### Operação (cooperativa, ADMIN com acesso ao sistema real) e prefeitura

- **Pedido oficial da prefeitura** (Excel e/ou PDF), para validar a
  importação com o arquivo de verdade. Spec 009 T10.
- **Validar um ciclo real fechado**, só leitura: um ADMIN abre "Validar este
  ciclo fechado" na página da semana (`docs/validacao-ciclo-fechado.md`).
  Galpão, custos e diferença podem ser conferidos hoje. A cobrança por escola
  não pode ser validada com nenhum ciclo antigo, porque não há entrega por
  escola registrada. Spec 008 T13.
- Confirmar a desativação de Ovos junto com o Lucas. Spec 001 T16.

### Claude (Next), quando as dependências acima chegarem

1. Adaptador da porta `CycleCoreRepository` para a API (as telas de
   `src/components/cycle-core/` não mudam) e `/complementos-faltas` gravando
   de verdade. Spec 008 T08.
2. Trocar a fonte dos PDFs e das telas Resumo, Balanço, Diferença e página da
   semana nos ciclos `ACEITE_ESCOLAR` (`DOCUMENT_SOURCES`,
   `methodologyOfRealCycle()`). Spec 008 T09 e T10; spec 004 T09.
3. Tela de fechamento pelos estados da spec 008. Spec 008 T07.
4. Teste ponta a ponta e de volume com 191 escolas. Spec 008 T11.
5. Importar o pedido oficial em banco descartável e ajustar ao layout. Spec
   009 T10.
6. Só depois do núcleo persistido e validado, a Etapa 7 (Mapa de Montagem),
   em `specs/backlog.md`.

Nada fica pendente só do lado do Claude: o que dava para fazer sem banco,
API ou arquivo oficial está feito e testado.
