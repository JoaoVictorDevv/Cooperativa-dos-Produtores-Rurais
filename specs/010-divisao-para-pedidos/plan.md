# Plano técnico — Especificação 010

## Componentes

| Arquivo | Papel |
|---|---|
| `src/lib/producerOrdersFromAllocation.ts` | Regra pura: classifica cada linha, aplica decisões, lista o que gravar, resume por produto, gera a assinatura |
| `src/app/actions/producerOrdersFromAllocation.ts` | Server Actions: prévia (só leitura) e confirmação (recalcula, compara assinatura, grava em transação) |
| `src/app/(app)/produtores/GenerateOrdersFromAllocation.tsx` | Tela de prévia e confirmação |
| `src/app/(app)/produtores/page.tsx` | Mostra a ação só com ciclo aberto |
| `src/app/(app)/produtores/ProducerProductRow.tsx` | Pedido vira "rascunho": reflete o valor do servidor após a geração sem perder edição em andamento; indicação "só planejado / pedido emitido / pedido ≠ divisão" |
| `src/app/(app)/produtores/ProducerRow.tsx` | Linhas derivadas do servidor + produtos adicionados na tela |

A regra roda no navegador (prévia interativa) e no servidor (confirmação),
como na importação (spec 009). O servidor nunca confia no plano enviado:
recebe só as decisões ("substituir" por linha) e a assinatura esperada.

## Backend e dados

- Lê `ProducerAllocation`, `ProducerOrder`, `SchoolOrder` (soma por produto) e
  `Product`. Grava `ProducerOrder` e `AuditLog`. **Sem mudança de schema.**
- Criação: `getCurrentPrice(productId, week.referenceDate)` — preço congelado.
- Atualização: `updateMany` condicionado ao valor mostrado na prévia; se a
  contagem não for 1, a transação inteira é desfeita.
- Guarda de oferta repetida dentro da transação (produto desativado entre a
  prévia e a confirmação não gera pedido).
- Semana revalidada como editável dentro da transação.

## Segurança

- `requireOperator()` nas duas ações; papel CONSULTA não grava.
- Decisões saneadas: só chaves com valor `true` são aceitas.
- Mensagens de erro sem dados internos.

## Riscos e transição

- Ciclos fechados não são afetados (ação indisponível e recusada no servidor).
- Quando a spec 008 for persistida pela API Java, esta regra pura pode ser
  reaproveitada; só as Server Actions trocam de backend.
