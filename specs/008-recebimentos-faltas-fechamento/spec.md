# Especificação 008 — Recebimentos, faltas e fechamento do ciclo

**Status:** regras confirmadas; regras de domínio implementadas e testadas em
memória (`src/lib/domain/cycle.ts`). **Persistência e telas bloqueadas** por
dependência de banco/API do Lucas — ver `plan.md`. Nada desta spec está em uso
nas telas ou no financeiro oficial ainda.

**Origem:** regras confirmadas com Seu Paulo e registradas no prompt
`docs/prompts/2026-09-24-prompt-v2-operacao-specs-develop.md` (§3–§10).

## Por que existe

O app hoje sabe o que a escola **pediu** e o que ela **devolveu**, e cobra a
prefeitura por `pedido − devolução`. Isso trata o pedido como se fosse
entregue. Na operação real há dois recebimentos com responsáveis diferentes:

- no **galpão**, a cooperativa confere o que o produtor trouxe;
- na **escola**, a merendeira/diretora confere o que a cooperativa levou.

Misturar os dois faz a cooperativa cobrar o que não entregou, ou descontar do
produtor uma perda que foi da cooperativa.

## Regras substituídas (histórico preservado)

| Regra antiga | Onde estava | Substituída por | Alcance |
|---|---|---|---|
| Cobrança = (pedido − devolução) × preço | `src/lib/calc.ts` (`schoolValue`, `treasuryTotal`), view `v_week_financial_summary` em `database/migrations/V003…` | RN-04 abaixo | **Novo fluxo**. O código antigo continua calculando assim até existir fonte persistida de entrega por escola/produto. Semanas antigas **não** são recalculadas. |
| Uma entrega (data) por escola/semana | `SchoolDelivery` (Prisma) / `school_deliveries` (SQL) | RN-06 (vários eventos por escola/produto) | Novo fluxo |
| Fechar = existe registro de entrega (spec 001, CA-03.1/03.2) | `src/lib/weekPolicy.ts`, `WeekJdbcAdapter.closingBlockers` | CA-008.5 | CA-03.* continuam como mínimo técnico até a troca |
| Carregar reposição pendente para a semana seguinte | proposta da Rodada 1 (`docs/propostas-pendentes.md` §2) | RN-09 | Proibido |

## Fluxo de quem opera (ciclo real)

1. Quarta/quinta: prefeitura envia o pedido por escola e produto (spec 009).
2. A cooperativa divide a demanda e emite pedidos aos produtores.
3. Domingo/segunda: produtores entregam no galpão; o administrador confere e
   rejeita o que estiver ruim.
4. Segunda/terça: a cooperativa entrega nas escolas; a escola confere e
   assina o romaneio (spec 004).
5. Quarta seguinte: o ciclo é conferido e encerrado (ação deliberada); a nota
   fiscal segue o processo atual da cooperativa (fora do app).

Pedido da quinta anterior, recebimento no domingo e entrega na segunda
pertencem ao **mesmo ciclo**, mesmo atravessando a semana do calendário.

## Regras de negócio confirmadas

- **RN-01 Quatro quantidades distintas**: pedido da prefeitura, pedido a cada
  produtor, aceito no galpão, aceito na escola. Nunca usar uma no lugar da
  outra.
- **RN-02 Galpão**: aceito do produtor = entrega bruta − rejeição no galpão.
  Base do valor **a pagar** ao produtor, com o preço e o desconto de logística
  congelados no lançamento. Produto não entregue não é pago e não é registrado
  como devolução.
- **RN-03 Escola**: aceito da escola = quantidade apresentada − rejeição da
  escola, somando entregas e complementos do ciclo.
- **RN-04 Cobrança**: a prefeitura paga pelo aceito na escola, com o preço
  congelado do pedido. Rejeição na escola é **perda da cooperativa**: não é
  descontada do produtor nem de motorista/funcionário (registra-se a
  ocorrência e o motivo conhecido, sem culpados inventados).
- **RN-05 Falta e excedente**: falta = máx(pedido − aceito, 0); excedente =
  máx(aceito − pedido, 0). Não compensar falta de uma escola/produto com
  excesso de outro; excedente fica visível e não é cortado.
- **RN-06 Complementos**: o gerente pode completar o atendimento no mesmo
  ciclo com outro produtor. Cada complemento é um evento novo, ligado à
  escola, produto, ciclo e pedido original, com o fornecedor de origem; não
  apaga a entrega inicial, suas rejeições nem horários. Correção de um
  lançamento errado é auditada e **não** é uma nova entrega.
- **RN-07 Perda antes da escola**: perda de transporte/manuseio registrada
  antes da apresentação é ocorrência distinta da rejeição escolar. As duas são
  posteriores ao aceite do galpão e não reduzem o pagamento ao produtor.
- **RN-08 Vazio × zero**: vazio = não informado (pendente); zero = conferência
  feita com resultado zero. Entregas nunca são preenchidas automaticamente a
  partir dos pedidos.
- **RN-09 Resolução das faltas**: antes de fechar, cada falta é resolvida por
  complemento (o total aceito comprova) ou **encerrada sem atendimento**, com
  motivo e responsável. "Resolvida" não é marcação manual. Falta encerrada fica
  no histórico e não vira pedido, cobrança ou pendência na semana seguinte.
- **RN-10 Fechamento**: três indicadores separados — recebimentos conferidos,
  valores calculados, pronto para fechar. Fechar é ação deliberada com prévia
  (totais, rejeições/perdas, faltas encerradas, a cobrar, a pagar). Não há
  reabertura ou alteração silenciosa de ciclo fechado.
- **RN-11 Recalcular decisões**: toda alteração posterior de entrega,
  rejeição ou complemento reavalia a situação; uma decisão de encerramento
  que deixou de bater com a falta atual vira "decisão incoerente" e bloqueia.
- **RN-12 Histórico**: semanas antigas sem entrega real registrada não ganham
  esse dado por suposição; continuam com a metodologia antiga, identificada
  como tal nos documentos.
- **RN-13 Termos financeiros**: usar "A pagar", "A cobrar" e "Resultado
  calculado" enquanto não houver registro de quitação.
- **RN-14 Unidades**: quantidades de unidades diferentes (kg, dz) nunca são
  somadas; totais e percentual de atendimento são por unidade.
- **RN-15 Arredondamento**: cada linha (escola × produto a cobrar; produtor ×
  produto a pagar) é arredondada a centavos; o total é a soma das linhas
  arredondadas, para que tela, PDF e total batam. **Decidido em 26/09/2026 e
  já aplicado ao modelo atual para ciclos criados a partir de 27/09/2026**
  (ver plan.md); ciclos anteriores não são recalculados.
- **RN-16 Duas dimensões por escola**: "entrega registrada" (conferência
  feita) e "pedido atendido" (sem falta) são mostradas separadamente:
  entrega = sem pedido / pendente de conferência / registrada / com erros;
  atendimento = sem pedido / a conferir / atendido / atendimento parcial /
  não atendido.

## Exemplo obrigatório (testado)

| Etapa | kg |
|---|---|
| Pedido da escola (alface) | 200 |
| Produtor entregou no galpão | 200 |
| Rejeitado no galpão | 20 |
| **Aceito no galpão → base para pagar o produtor** | **180** |
| Apresentado à escola | 180 |
| Rejeitado pela escola (perda da cooperativa) | 10 |
| **Aceito pela escola → base para cobrar a prefeitura** | **170** |
| Falta de atendimento | 30 |

A fórmula antiga daria 190 (`schoolNetQty(200, 10)`); a regra confirmada exige
170. Os 30 kg de falta **não** são perda; as rejeições não são subtraídas duas
vezes; o pagamento do produtor não cai para 170.

Com complemento de 30 kg aceitos de outro produtor: a escola totaliza 200, o
produtor original continua com 180, o novo tem seu próprio recebimento de 30,
a perda de 10 continua registrada, cobrança de 200 uma única vez.

## Critérios de aceite

- **CA-008.1** Exemplo 200/180/170 com pagamento 180, cobrança 170, falta 30,
  perda escolar 10, rejeição no galpão 20.
- **CA-008.2** Complemento de 30 de outro produtor: escola 200, fornecedor
  original 180, novo 30, perda 10 mantida, sem cobrança duplicada.
- **CA-008.3** Sem reposição: encerrar em 170 com falta final 30 e motivo; não
  gera pendência nem cobrança no ciclo seguinte.
- **CA-008.4** Vazio fica pendente; zero confirmado é conferência; pedido zero
  sem movimento não bloqueia; pedido 30 + complemento 20 + inicial vazio fica
  pendente, e confirmando inicial zero a falta é 10.
- **CA-008.5** Estados: ciclo vazio = "Aguardando pedido"; recebimento não
  conferido = "Em conferência"; conferido com falta sem decisão ou em resolução
  = "Aguardando decisões"; erro = "Com erros"; "Pronto para fechar" só com
  tudo conferido e todas as faltas decididas de forma coerente.
- **CA-008.6** Rejeição no galpão ≤ entrega bruta; rejeição na escola ≤
  quantidade apresentada (não o pedido).
- **CA-008.7** Perda antes da escola separada da rejeição escolar; saldo entre
  galpão e escolas aparece como "saldo a conferir", não como perda.
- **CA-008.8** Excedente de uma escola/produto não compensa falta de outra;
  percentual de atendimento limita cada linha ao próprio pedido e é "não
  aplicável" com demanda zero.
- **CA-008.12** Totais e percentual de atendimento separados por unidade
  (kg × dz).
- **CA-008.13** Situação por escola nas duas dimensões (RN-16); falta
  encerrada deixa a escola pronta para fechar, mas não "atendida".
- **CA-008.14** Prévia de fechamento com a cobrar (aceito na escola × preço
  congelado), a pagar (aceito no galpão × (preço − desconto) congelados),
  resultado calculado, rejeições e perdas por unidade, faltas encerradas com
  motivo, e motivos de bloqueio (sem conferência, falta sem decisão, preço não
  congelado, erro). Total igual à soma das linhas arredondadas.
- **CA-008.9** Correção de quantidade não altera preço/desconto histórico;
  tela, PDF e balanço mostram os mesmos valores. *(depende da persistência)*
- **CA-008.10** Tentativa de reduzir recebimento abaixo da rejeição já
  registrada é recusada, inclusive com duas pessoas editando ao mesmo tempo.
  *(depende da persistência)*
- **CA-008.11** Fluxo completo integrado: pedido → pedido aos produtores →
  galpão → rejeição → escola → rejeição → complemento/encerramento → resumo →
  diferenças → documentos → fechamento. *(depende da persistência e da
  integração)*

## Fora de escopo

- Emissão fiscal eletrônica.
- Upload de assinatura, geolocalização, comprovantes obrigatórios.
- Rateio automático de falta entre escolas (o gerente decide).
- Recalcular semanas antigas.
- Mapa de Montagem (etapa posterior ao núcleo).
