# Desenvolvimento orientado por especificações

Este diretório é a fonte de verdade para mudanças de produto do Colheita.

Cada incremento deve ter:

1. uma especificação com objetivo, regras e critérios de aceite;
2. um plano técnico curto, incluindo dados, segurança e migração;
3. tarefas rastreáveis até os critérios de aceite;
4. testes que comprovem as regras de negócio antes da entrega.

O código pode explicar **como** algo funciona. As especificações devem explicar
**por que** a regra existe e **qual comportamento** o usuário pode esperar.

## Estado geral (27/09/2026)

- **O app em uso continua no modelo antigo.** A cobrança é
  `(pedido − devolução) × preço`, sobre as tabelas atuais do Prisma.
- **O modelo novo (spec 008) está pronto só em memória.** Isso inclui entrega
  real por escola, complementos, faltas e cobrança pelo aceito na escola. O
  que falta é banco e API (Lucas).
- As pastas `api/` e `database/` não foram tocadas, e nenhum banco real foi
  consultado ou alterado.
- A referência operacional da planilha é a **MODELO v22**
  ([`docs/referencia-planilha/`](../docs/referencia-planilha/atualizacao_v20_para_v22.md)).

### Funciona hoje, no app atual

| O quê | Onde ver | Evidência |
|---|---|---|
| Importar o pedido da prefeitura (Excel com várias abas e PDF com texto), com conferência antes de gravar | Pedido das Escolas → "+ Importar pedido da prefeitura" | spec 009 `tasks.md`; testes em `src/lib/import/` |
| Gerar os pedidos aos produtores a partir da divisão, com prévia e sem sobrescrever em silêncio | Produtores → "+ Gerar pedidos…" | spec 010 `tasks.md` |
| PDFs da semana, ZIP, romaneio com data/horário real e 4 vias | Semana → Documentos | spec 004 `tasks.md` |
| Ficha do produtor como na v22 (Aceito, Preço líquido, data e horário) | Produtores → nome do produtor | spec 004 T12 |
| Total a cobrar = soma das linhas arredondadas (só ciclos novos) | Resumo, Balanço | `src/lib/roundingPolicy.test.ts` |
| Trava contra salvamentos simultâneos (ex.: devolução maior que a entrega) | telas de lançamento | `src/lib/concurrency.integration.test.ts` (antes 40 de 40 corridas davam erro; agora 0 de 40) |
| Revisão de segurança: cada página confere a sessão, erros sem dado sensível, validação repetida no servidor | todo o app | `docs/propostas-pendentes.md` §11 |
| "Validar este ciclo fechado" (só leitura, só ADMIN) | Semana fechada → link no fim da página | `docs/validacao-ciclo-fechado.md` |
| Verificação de backup só leitura (conta linhas e compara conteúdo antes e depois de restaurar) | `scripts/backup-verify.ts` | `docs/backup-e-restauracao.md` |

### Pronto, mas só com dado fictício (espera banco e API)

| O quê | Onde está | Estado |
|---|---|---|
| Regras do ciclo novo: aceito no galpão e na escola, falta, excedente, fechamento, complemento na mesma viagem | `src/lib/domain/cycle.ts` | testado |
| Comandos: entrega inicial, complemento (mesma viagem ou outra viagem), correção, falta em resolução, encerrar sem atendimento, revogar | `src/lib/domain/cycleLedger.ts` | testado (duplo clique, conflito de versão, ciclo fechado) |
| Porta onde a API vai se ligar | `src/lib/cycleCore/repository.ts` (`CycleCoreRepository`) | só a versão em memória |
| Telas de complementos e faltas | `/complementos-faltas` (demonstração, nada é gravado) | testadas pela interface |
| PDFs e ZIP pelo modelo novo (romaneio por escola e visita) | demonstração, na mesma tela | testados |
| Pacote de aceitação para a API Java: 17 cenários e 5 cálculos em JSON, mais o contrato dos comandos em JSON Schema | `docs/aceitacao/` | gerado pelo código (`scripts/export-acceptance.ts`) |

### O que falta e de quem depende

Cada spec lista as tarefas pendentes com o responsável (Lucas, Operação ou
Claude) no seu `tasks.md`. A visão agrupada por responsável fica em
[`docs/propostas-pendentes.md`](../docs/propostas-pendentes.md#pendências-por-responsável).

## Incrementos

- [`001-integridade-operacional`](./001-integridade-operacional/spec.md): endurecimento da fundação antes do primeiro piloto (ver adendo de 2026-09 sobre fechamento e testes seguros). Pendências de segurança e infraestrutura da revisão de 27/09/2026 com responsável (Lucas) em `tasks.md`.
- [`004-relatorios-exportacoes`](./004-relatorios-exportacoes/spec.md): documentos do ciclo em PDF/ZIP e romaneio escolar (data/horário real, 4 vias). Implementada no modelo atual; conteúdos de aceite real dependem da 008.
- [`008-recebimentos-faltas-fechamento`](./008-recebimentos-faltas-fechamento/spec.md): dois recebimentos (galpão e escola), complementos (um romaneio por escola e visita, RN-22), faltas e fechamento. Regras confirmadas e testadas em memória; persistência bloqueada (Lucas).
- [`009-importacao-pedido-prefeitura`](./009-importacao-pedido-prefeitura/spec.md): importação do pedido da prefeitura (Excel com várias abas e PDF com texto), com conferência e gravação atômica. Implementada e testada; falta validar com arquivo oficial da prefeitura.
- [`010-divisao-para-pedidos`](./010-divisao-para-pedidos/spec.md): gerar pedidos aos produtores a partir da divisão, com prévia e confirmação, sem apagar nem sobrescrever em silêncio. Implementada e testada (tabelas atuais, sem mudança de schema).
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
