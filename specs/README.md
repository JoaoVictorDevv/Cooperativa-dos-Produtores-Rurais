# Desenvolvimento orientado por especificações

Este diretório é a fonte de verdade para mudanças de produto do Colheita.

Cada incremento deve ter:

1. uma especificação com objetivo, regras e critérios de aceite;
2. um plano técnico curto, incluindo dados, segurança e migração;
3. tarefas rastreáveis até os critérios de aceite;
4. testes que comprovem as regras de negócio antes da entrega.

O código pode explicar **como** algo funciona. As especificações devem explicar
**por que** a regra existe e **qual comportamento** o usuário pode esperar.

## Incrementos

- [`001-integridade-operacional`](./001-integridade-operacional/spec.md): endurecimento da fundação antes do primeiro piloto (ver adendo de 2026-09 sobre fechamento e testes seguros).
- [`008-recebimentos-faltas-fechamento`](./008-recebimentos-faltas-fechamento/spec.md): dois recebimentos (galpão e escola), complementos, faltas e fechamento. Regras confirmadas e testadas em memória; persistência bloqueada (Lucas).
- [`backlog.md`](./backlog.md): próximas especificações candidatas, ainda não aprovadas para implementação.

## Numeração

Os números 002 a 007 estão reservados pelos candidatos do [`backlog.md`](./backlog.md).
Um candidato promovido mantém o número do backlog; um assunto novo recebe o
próximo número livre depois deles (008 em diante).

## Regra vigente × regra substituída

Quando uma regra confirmada substitui outra, a spec nova traz a tabela
"Regras substituídas" (o que era, onde estava no código, alcance da troca e
transição do histórico). Nenhuma regra antiga é apagada do histórico; ela é
marcada como substituída para que nenhum agente encontre duas regras vigentes
incompatíveis.
