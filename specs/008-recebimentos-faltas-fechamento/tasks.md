# Tarefas — Especificação 008

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído · `[B]` bloqueado.
Toda tarefa pendente indica o **responsável**:
- **Lucas**: banco, API e infraestrutura;
- **Claude**: regras, telas, documentos e testes no Next;
- **Operação**: a cooperativa e um ADMIN com acesso ao sistema real.

A lista em ordem, com o que conta como "pronto" em cada item, está em
`docs/propostas-pendentes.md`, "Comece por aqui". Os itens L1 a L16 de lá
apontam para as tarefas abaixo.

- [x] T01 Registrar regras confirmadas, exemplos e critérios de aceite (spec.md).
- [x] T02 Levantar o suporte existente no Prisma e no SQL novo (plan.md, tabela "Estado do banco").
- [x] T03 Regras de domínio puras + testes para CA-008.1 a CA-008.8 (`src/lib/domain/cycle.ts`, 32 testes). *Não conclui a funcionalidade: não há persistência nem tela.*
- [x] T03b Etapa 2 (26/09/2026): totais e atendimento por unidade, situação por escola (entrega registrada × atendido) e prévia de fechamento com valores e motivos de bloqueio (CA-008.12 a CA-008.14) — `closingPreview`, `summarizeSchools` em `src/lib/domain/cycle.ts`; 40 testes. *Ainda sem persistência nem tela.*
- [x] T03c Arredondamento por linha (RN-15) aplicado ao total a cobrar do modelo atual só para ciclos criados a partir de 27/09/2026; ciclos antigos intocados; método exibido em telas e PDF (decisão do usuário, 26/09/2026). Evidência: `src/lib/roundingPolicy.test.ts` (4) + integração em banco descartável (ciclo antigo fechado 9,95; novo 9,96).
- [x] T03d Etapa 4 (26/09/2026) — complementos e encerramento de faltas **sem persistência**: comandos puros com validação, chave de envio, versão, auditoria e aviso de decisão incoerente (`src/lib/domain/cycleLedger.ts`, 23 testes; CA-008.15 a 008.20); porta `CycleCoreRepository` + repositório em memória (`src/lib/cycleCore/`, 3 testes de concorrência/duplo clique + cenário); componentes desacoplados (`src/components/cycle-core/`); tela de demonstração com dados fictícios (`/complementos-faltas`), testada pela interface. *Não conclui T05/T07/T08: nada é gravado.*
- [x] T03e RN-22 (27/09/2026) — complemento na mesma viagem com um romaneio só por escola e visita:
  - regra pura, comandos e correção da viagem;
  - romaneios e formulários;
  - contrato e pacote de aceitação versão 2 (CA-008.21, CA-008.22).
  - Evidência: 233 testes unitários passando, e os testes novos falham se a regra for desligada (checagem por mutação). Interface: entrega inicial 40 + complemento de 15 na mesma viagem → aceito 40 de 40, lançamento marcado "mesma viagem — incluído na entrega inicial", sem erros de página.
  - *Sem persistência, como T03d.*
- [x] T04 Documentar para o Lucas os dados e validações necessários (plan.md + `docs/propostas-pendentes.md` §7 e §9).
- [B] T05 Schema/API: eventos de entrega à escola por produto, com viagem do complemento (RN-22), decisão de falta, perda antes da escola, horário real e auditoria na mesma transação — **Responsável: Lucas**. Detalhes: plan.md "Backend alvo" e `docs/propostas-pendentes.md` §9.
- [B] T06 API: congelar preço/desconto na criação e nas correções; validar rejeição × recebimento no servidor com trava contra corrida (a mesma de `src/lib/locks.ts`) — **Responsável: Lucas** (CA-008.9, CA-008.10; propostas §7.5 e §11.6).
- [B] T07 Fechamento pelos estados da spec (CA-008.5) com prévia — **Responsável: Lucas** (regra no servidor) **e Claude** (tela, com componentes prontos). Depende de T05.
- [B] T08 Telas de conferência na escola e de complemento **ligadas ao banco** — componentes e tela prontos em modo demonstração (T03d). Falta o adaptador da porta `CycleCoreRepository` para a API, e `/complementos-faltas` passar a gravar — **Responsável: Claude**, depois de T05 e do contrato de integração (propostas §7).
- [B] T09 Metodologia gravada por ciclo (`LEGADO_PEDIDO_MENOS_DEVOLUCAO` × `ACEITE_ESCOLAR`), escolhida ao abrir o ciclo; os ciclos antigos ficam no legado para sempre — **Responsável: Lucas**. Depois disso, trocar a cobrança para o aceito na escola nesses ciclos (`methodologyOfRealCycle()`, `DOCUMENT_SOURCES`) — **Responsável: Claude**. Depende de T05–T07.
- [B] T10 Visão de atendimento no Resumo, Balanço, Diferença e página da semana (pedido, aceito, falta/excedente, rejeições, situação) — **componente e documentos prontos** (etapa 5: `AttendanceSummaryTable`, `documents.ts`, PDFs; usados na demonstração). Falta ligar à fonte persistida — **Responsável: Claude**, depois de T05 e T09 (propostas §10).
- [x] T10b Total de falta só com linhas conferidas (linhas a conferir à parte) no núcleo, telas e PDFs — `cycle.test.ts` ("total de falta só com linhas conferidas").
- [B] T11 Teste ponta a ponta CA-008.11 e teste de volume com 191 escolas no banco real de homologação — **Responsável: Claude**, com a operação acompanhando. Depende de T05–T10.
- [B] T12 A API passar no pacote de aceitação `docs/aceitacao/` (versão 2: 17 cenários, 5 cálculos, contrato dos comandos em JSON Schema) antes de qualquer tela consumi-la — **Responsável: Lucas**.
- [B] T13 Validar um ciclo real já fechado (galpão, custos e diferença; só leitura) — **Responsável: Operação**: um ADMIN abre "Validar este ciclo fechado" na página da semana, ou alguém com acesso roda `scripts/validate-closed-cycle.ts` (`docs/validacao-ciclo-fechado.md`). A cobrança por escola não é validável com nenhum ciclo antigo, porque não há entrega por escola registrada.
- [B] T15 Migrar os dados do banco antigo (Prisma, IDs cuid) para o banco novo (UUID, organização): tabela de correspondência de IDs; preço, desconto, reaberturas e auditoria preservados; conferência por totais de cada ciclo (a cobrar, a pagar, custos) antes e depois — **Responsável: Lucas**, com a conferência feita junto (propostas §7.3 e §5).
- [B] T14 Arredondamento por linha (RN-15) também na view `v_week_financial_summary` do banco novo, só para ciclos novos — **Responsável: Lucas** (plan.md, "Arredondamento").

Evidência T03/T03b: `npx vitest run src/lib/domain` → 40 testes passando (26/09/2026, ambiente local, sem banco).

Evidência T03d (26/09/2026): `npx vitest run src/lib/domain src/lib/cycleCore` → 67 testes passando. Interface (Playwright, build de produção; banco descartável `colheita_r2_descartavel_202609261823` usado **só para o login**, apagado depois — a demonstração não grava nada): (1) abre "Em conferência" com 2 itens sem conferência e 1 falta sem decisão; (2) complemento de 30 do Produtor 2 com duplo clique → 1 registro, aceito 200/200; (3) reduzir a entrega para 5 com 10 rejeitados → mensagem "Corrija a rejeição primeiro" e botão desabilitado; (4) inicial 0 confirmado + encerrar falta de 10 com motivo; (5) entrega inicial com duplo clique → 1 lançamento; (6) "Pronto para fechar" com os três indicadores separados; (7) correção posterior do complemento 20→25 → aviso "decisão… ficou incoerente: a falta agora é 5" e estado "Aguardando decisões"; (8) revogar e reencerrar 5 → pronto; (9) auditoria com 10 registros; (10) 390 px sem rolagem lateral; (11) link na página da semana. Nenhum erro de página.
