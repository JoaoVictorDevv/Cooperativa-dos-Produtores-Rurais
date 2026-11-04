# Pacote de aceitação — para a API Java (Lucas)

**Para que serve:** antes de qualquer tela passar a usar a API para
complementos, faltas, fechamento e valores, a API precisa produzir **os mesmos
resultados** que a implementação de referência do app, nos mesmos casos. Este
pacote é a lista desses casos em JSON, independente de linguagem.

Gerado de código testado (não editar à mão): `src/lib/cycleCore/acceptanceCases.ts`
(casos e expectativas), `commandSchema.ts` e `ledgerSchema.ts` (contrato).
Regerar: `npx tsx scripts/export-acceptance.ts`. O teste
`acceptanceCases.test.ts` falha se estes arquivos ficarem desatualizados e roda
todos os casos contra a implementação de referência.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `casos.json` | Versão 2: 17 cenários (estado inicial → comandos com resultado esperado → expectativas finais) e 5 cálculos isolados |
| `contrato-comandos.schema.json` | JSON Schema do comando, do resultado e do estado do ciclo |

**Versão 2 (27/09/2026):** o complemento passou a exigir `trip` (spec 008
RN-22):
- `MESMA_VIAGEM`: um romaneio só por escola e visita. A entrega inicial
  registra o total, e o complemento guarda só a origem e a quantidade. Ele
  não soma no entregue e não tem rejeição, perda, data ou recebedor
  próprios. As origens da mesma viagem não passam do total da entrega
  inicial.
- `OUTRA_VIAGEM`: romaneio próprio.

Os comandos de complemento da versão 1 correspondem a `OUTRA_VIAGEM`. Casos
novos: `complemento-mesma-viagem` e `mesma-viagem-limites`.

## Como executar um cenário

1. Carregar `inicial` (pedidos com preço congelado, recebimentos do galpão com
   preço e desconto congelados; `events`, `decisions` e `audit` vazios).
2. Para cada item de `passos`, executar `command` com o perfil `actor` (padrão:
   `{ "id": "u-operador", "role": "OPERADOR" }`), horário fixo
   `2026-09-29T10:00:00-03:00` e ids de evento gerados em ordem (`ev-1`,
   `ev-2`, …; só comandos aceitos que criam evento consomem id).
3. Conferir o resultado de cada passo com `expect`:
   - `ok`; se falhou, `code` (`CICLO_FECHADO`, `SEM_PERMISSAO`, `INVALIDO`,
     `CONFLITO`, `NAO_ENCONTRADO`); a mensagem em texto não é comparada;
   - se deu certo, `effect` (`APLICADO` ou `JA_REGISTRADO`) e trechos que
     precisam aparecer nos avisos (`warningsContain`).
4. Um passo recusado **não altera nada** (tudo ou nada).
5. Conferir as expectativas finais que o caso trouxer:
   - `linhas`: situação por escola × produto (aceito, falta, excedente,
     rejeição, perda, `receiptStatus`, `shortageStatus`, `attendance`,
     `readyToClose`);
   - `fechamento`: estado do ciclo, pode fechar, a cobrar, a pagar, resultado,
     bloqueios (texto exato), linhas a pagar e faltas encerradas;
   - `totaisPorUnidade` e `atendimentoPorUnidade` (kg e dz nunca somados;
     falta total só de linhas conferidas; `pendingLines` = linhas a conferir).

Dinheiro: cada linha arredondada a centavos (meio para cima) e o total é a soma
das linhas. Quantidades: até 2 casas.

## Cobertura (prompt v2 §17)

200/180/170 · encerrar sem reposição · complemento de outro produtor ·
complemento sem recebimento no galpão · complemento na mesma viagem (romaneio
único, cobra 200 e não 230) e seus limites · pedido 30 + complemento 20 com inicial
vazio · vazio × zero × pedido zero · ciclo vazio · rejeição corrigida para zero
e redução abaixo da rejeição · decisão incoerente após correção · reenvio e
segunda entrega inicial · perda antes da escola · excesso não compensa falta ·
kg × dz · perfil de consulta · ciclo fechado · cálculos de a pagar, a cobrar e
arredondamento (por linha × legado).

**Concorrência** (não cabe em JSON): além da checagem de `expectedVersion` e
`idempotencyKey`, a API precisa garantir que duas gravações simultâneas não
furem "devolução ≤ pedido/entrega" — o app usa uma trava de transação por
linha (`src/lib/locks.ts`; corrida reproduzida em
`src/lib/concurrency.integration.test.ts`). Ver `docs/propostas-pendentes.md` §11.6.
