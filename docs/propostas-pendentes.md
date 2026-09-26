# Propostas pendentes — dependências de banco, API e decisões

**Atualizado na Rodada 2 (26/09/2026).** As regras de negócio que na Rodada 1
eram "decisões a tomar" foram **confirmadas com Seu Paulo** e estão em
[`specs/008-recebimentos-faltas-fechamento/spec.md`](../specs/008-recebimentos-faltas-fechamento/spec.md).
O que continua pendente aqui é a **implementação técnica** que depende do
Lucas (schema, migrações, API Java, infraestrutura) e o alinhamento de
integração. Nada deste documento foi implementado no banco ou na API.

Resumo em português simples do que o Lucas precisa fazer ou revisar: seção
[Para o Lucas](#para-o-lucas--resumo).

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
— não ligadas a telas nem totais.

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

**Infraestrutura, retenção e ensaio real de restauração: Lucas.**

## 6. Divisão → pedido aos produtores sem redigitar

Continua pendente. Há suporte no modelo atual (`ProducerAllocation` →
`ProducerOrder`). Proposta: ação "Gerar pedidos a partir da divisão" com prévia,
sem sobrescrever pedido já digitado diferente sem decisão explícita, sem tocar
em entregas. Pode ser feito pelo Claude numa próxima etapa sem depender de
schema.

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
- Gerar pedidos a partir da divisão (item 6), se feito no servidor.

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
- **Layout no celular:** em 390 px de largura, o menu lateral intercepta
  cliques sobre o conteúdo em algumas telas (visto no teste automatizado da
  importação). É do layout "Colheita 2.0" — não alterado aqui.

---

## Para o Lucas — resumo

1. **Banco/API para entrega real por escola/produto, complementos e decisão de
   falta** (item 1; `specs/008…/plan.md`). Aceite: `src/lib/domain/cycle.test.ts`.
2. **Corrigir na API:** preço/desconto congelados em correções, validação de
   devolução × entrega com concorrência, auditoria com antes/depois, fechamento
   pelos estados da spec 008 (item 7.5).
3. **Combinar o contrato de integração** (item 7) antes de qualquer tela
   passar a consumir a API.
4. **Desativar Ovos** no banco real (item 4).
5. **Backup:** infraestrutura e ensaio de restauração com verificação só de
   leitura — nunca com a suíte que apaga dados (item 5).
6. Avaliar a atualização do Prisma (alerta alto) e o menu lateral no celular
   (item 8).
