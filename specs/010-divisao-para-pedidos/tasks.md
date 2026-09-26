# Tarefas — Especificação 010

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído · `[B]` bloqueado.

- [x] T01 Regra pura com os 5 tipos de linha, decisões por linha e resumo por produto (CA-010.1–010.5) — `producerOrdersFromAllocation.test.ts` (9 testes).
- [x] T02 Assinatura: plano recalculado precisa ser idêntico ao da prévia (CA-010.6) — teste "assinatura muda se o pedido atual mudar".
- [x] T03 Server Actions: prévia só leitura; confirmação com transação única, atualização condicionada, preço congelado, auditoria com motivo (CA-010.6, 010.7).
- [x] T04 Tela de prévia e confirmação em Produtores, só com ciclo aberto.
- [x] T05 Linha do produtor reflete o pedido gravado sem recarregar e sem perder digitação (CA-010.8).
- [x] T06 Teste de interface num banco descartável (abaixo).

## Evidências (26/09/2026)

- Unitários: `npx vitest run --exclude "**/*.integration.test.ts"` → 137 passando, 1 pulado (GZ opcional). `tsc`, `eslint` e `npm run build` limpos. `npm run test:integration` → 6 passando (banco descartável próprio, apagado no fim).
- Interface (Playwright, build de produção, banco **criado para o teste e apagado depois** `colheita_r2_descartavel_202609261742`, seed fictício):
  1. Prévia: Será criado 1, Diferente 1, Sem divisão 1, Fora da oferta 1, Igual 1.
  2. Resumo Alface: demanda 200 · divisão 180 · hoje 45 · depois 165; com "substituir" marcado, depois 180 e falta pedir 20.
  3. Pedido alterado por SQL depois da prévia → gravação recusada, nada gravado.
  4. Nova prévia e confirmação → "1 criado(s), 1 atualizado(s)". Banco: P01 Alface 120 (criado, preço congelado), P02 Alface 60 (substituído), P03 Couve 30 igual, P04 Couve 20 mantido (sem divisão), nenhum pedido de Ovos; 2 auditorias com o motivo.
  5. A linha do produtor mostra 120 / 120 com "pedido emitido" sem recarregar.
  6. Segunda prévia → "Nada a gerar". Nenhum erro de página.
