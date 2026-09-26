# Plano técnico — Especificação 008

## Estado atual (conferido em 26/09/2026)

| Necessidade | Prisma (telas atuais) | SQL novo (`database/`, API Java) |
|---|---|---|
| Recebimento do produtor | `ProducerDelivery` — 1 por produtor/produto/semana, bruto | `producer_deliveries` — idem (UNIQUE) |
| Rejeição no galpão | `ProducerReturn` — 1 por produtor/produto/semana | `producer_returns` — idem |
| Entrega por escola/produto | **não existe** (`SchoolDelivery` só tem dia/data por escola) | **não existe** (`school_deliveries` só data por escola, UNIQUE por escola/semana) |
| Rejeição na escola | `SchoolReturn` — limitada ao **pedido** | `school_returns` — sem comparação com nada |
| Complementos (vários eventos) | não | não (UNIQUE impede segundo evento) |
| Data/hora real da entrega e quem recebeu | só data/dia por escola | `delivered_at` por escola, sem produto |
| Perda antes da escola | não | não |
| Decisão de falta (encerrada, motivo, responsável) | não | não |
| Vínculo ciclo ↔ datas operacionais | `Week` (datas + referência) | `weeks` |
| Cobrança | `calc.ts`: pedido − devolução | view `v_week_financial_summary`: pedido − devolução |

Conclusão: **o núcleo desta spec não cabe no banco atual** sem schema novo.
Pela regra da rodada, schema/migração/API são do Lucas. Não foi criado nenhum
substituto em Prisma nem armazenamento paralelo.

## O que foi feito nesta rodada (Claude)

- `src/lib/domain/cycle.ts`: regras puras (galpão, escola, eventos,
  falta/excedente, perda pré-escola, decisões, estados do ciclo, saldo a
  conferir, percentual de atendimento, valores a pagar/a cobrar).
- `src/lib/domain/cycle.test.ts`: 40 testes cobrindo CA-008.1 a CA-008.8 e
  CA-008.12 a CA-008.14 (unidades, situação por escola, prévia de fechamento).
- Essas funções **não estão ligadas** a nenhuma tela, PDF ou total oficial.

## Backend alvo e contrato necessário (para o Lucas)

O contrato de integração completo (autenticação, organização, IDs,
endpoints, histórico, divisão de trabalho) está em
`docs/propostas-pendentes.md` §7. Resumo dos dados que a persistência precisa
oferecer para esta spec:

1. **Evento de entrega à escola por produto** (`school_delivery_events` ou
   equivalente): organização, ciclo, escola, produto, tipo
   (`INICIAL`/`COMPLEMENTO`), quantidade apresentada (nulo = não informado),
   rejeição da escola + motivo, perda antes da escola + motivo, fornecedor de
   origem (produtor, opcional), data/hora real da entrega com fuso, quem
   recebeu/conferiu (texto do romaneio), horário de lançamento separado,
   referência ao evento corrigido (auditoria). No máximo um `INICIAL` por
   ciclo/escola/produto; vários `COMPLEMENTO`.
2. **Recebimento no galpão com eventos**: hoje é 1 linha por
   produtor/produto/ciclo. Um complemento de **outro** produtor já cabe (outra
   linha). Um segundo recebimento do **mesmo** produtor no mesmo ciclo não
   cabe — decidir com o Lucas se precisa (ex.: produtor que volta à tarde).
3. **Decisão de falta** por ciclo/escola/produto: tipo (`EM_RESOLUCAO` /
   `ENCERRADA_SEM_ATENDIMENTO`), quantidade faltante no momento da decisão,
   motivo, usuário, data. Recalculada/invalidada quando a falta muda.
4. **Validações no servidor** (não só na tela): rejeição no galpão ≤ bruto;
   rejeição escolar ≤ apresentado do mesmo evento; reduzir quantidade abaixo
   da rejeição já registrada é recusado com trava/versão para concorrência;
   preço e desconto congelados só na criação (o upsert atual da API
   sobrescreve `price_id` e `logistics_deduction_snapshot` — corrigir).
5. **Fechamento** usando os estados da spec (CA-008.5) em vez de "existe
   registro de entrega".
6. **Visão financeira nova** (a cobrar = aceito na escola × preço congelado;
   a pagar = aceito no galpão × (preço − desconto congelado)), sem alterar a
   view antiga para semanas antigas: marcar o ciclo com a metodologia usada
   (`LEGADO_PEDIDO_MENOS_DEVOLUCAO` × `ACEITE_ESCOLAR`).

## Arredondamento do total a cobrar — decidido em 26/09/2026

**Achado:** o pagamento aos produtores somava linhas já arredondadas, mas o
total a cobrar (`treasuryTotal`) somava sem arredondar e arredondava só no fim;
a soma das linhas exibidas podia diferir do total em centavos.

**Decisão do usuário:** somar as linhas já arredondadas a 2 casas (igual à
planilha), **só para ciclos novos**; ciclos antigos, fechados ou não, não são
recalculados.

**Implementado (modelo atual):** `src/lib/roundingPolicy.ts` decide pela data
de criação do ciclo — a partir de 27/09/2026 00:00 (Brasília), ajustável por
`TREASURY_PER_LINE_ROUNDING_FROM` — e `getWeekFinancialSummary` usa
`treasuryTotalPerLine` (novo) ou `treasuryTotal` (antigo). Telas de Resumo e
Balanço e o PDF do Balanço dizem qual método foi usado. Testes:
`src/lib/roundingPolicy.test.ts` e integração em banco descartável (ciclo
antigo fechado = R$ 9,95; ciclo novo = R$ 9,96 = soma das linhas).

**Para o Lucas:** a view `v_week_financial_summary` (database/V003) arredonda
por soma sem arredondar por linha; o banco novo deve seguir a mesma regra
(RN-15) para ciclos novos, sem recalcular os antigos.

## Transição do histórico

- Ciclos fechados antes da troca continuam com a metodologia antiga e são
  identificados assim em telas e PDFs. Nenhum valor passado é recalculado.
- A troca vale a partir de um ciclo aberto depois da migração, escolhido
  explicitamente.

## Riscos

- Trocar a fórmula de cobrança antes de existir a fonte de entrega real faria
  toda semana aberta cobrar zero ou um valor inventado — por isso a fórmula
  antiga permanece no código atual.
- Duas bases (Prisma e SQL novo) com regras diferentes: a regra deve morar no
  backend que for o definitivo; as funções puras aqui servem de especificação
  executável e de referência para os testes do Java.

## Estratégia de testes

- Unitários (feitos): `npx vitest run src/lib/domain`.
- Quando a persistência existir: testes de integração em banco descartável
  comprovado (CA-008.9, CA-008.10), incluindo duas transações concorrentes; e
  o fluxo ponta a ponta (CA-008.11) pela interface.
- A API Java deve reproduzir os mesmos casos (mesmos números) nos seus
  testes antes de as telas passarem a consumi-la.
