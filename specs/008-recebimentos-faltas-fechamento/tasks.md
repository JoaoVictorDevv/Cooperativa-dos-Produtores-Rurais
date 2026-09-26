# Tarefas — Especificação 008

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído · `[B]` bloqueado.

- [x] T01 Registrar regras confirmadas, exemplos e critérios de aceite (spec.md).
- [x] T02 Levantar o suporte existente no Prisma e no SQL novo (plan.md, tabela "Estado atual").
- [x] T03 Regras de domínio puras + testes para CA-008.1 a CA-008.8 (`src/lib/domain/cycle.ts`, 32 testes). *Não conclui a funcionalidade: não há persistência nem tela.*
- [x] T03b Etapa 2 (26/09/2026): totais e atendimento por unidade, situação por escola (entrega registrada × atendido) e prévia de fechamento com valores e motivos de bloqueio (CA-008.12 a CA-008.14) — `closingPreview`, `summarizeSchools` em `src/lib/domain/cycle.ts`; 40 testes. *Ainda sem persistência nem tela.*
- [x] T03c Arredondamento por linha (RN-15) aplicado ao total a cobrar do modelo atual só para ciclos criados a partir de 27/09/2026; ciclos antigos intocados; método exibido em telas e PDF (decisão do usuário, 26/09/2026). Evidência: `src/lib/roundingPolicy.test.ts` (4) + integração em banco descartável (ciclo antigo fechado 9,95; novo 9,96).
- [x] T03d Etapa 4 (26/09/2026) — complementos e encerramento de faltas **sem persistência**: comandos puros com validação, chave de envio, versão, auditoria e aviso de decisão incoerente (`src/lib/domain/cycleLedger.ts`, 23 testes; CA-008.15 a 008.20); porta `CycleCoreRepository` + repositório em memória (`src/lib/cycleCore/`, 3 testes de concorrência/duplo clique + cenário); componentes desacoplados (`src/components/cycle-core/`); tela de demonstração com dados fictícios (`/complementos-faltas`), testada pela interface. *Não conclui T05/T07/T08: nada é gravado.*
- [x] T04 Documentar para o Lucas os dados e validações necessários (plan.md + `docs/propostas-pendentes.md` §7).
- [B] T05 Schema/API: eventos de entrega à escola por produto, decisão de falta, perda pré-escola, horário real — **Lucas**.
- [B] T06 API: congelar preço/desconto na criação; validar rejeição × recebimento no servidor com controle de concorrência — **Lucas** (CA-008.9, CA-008.10).
- [B] T07 Fechamento pelos estados da spec (CA-008.5) com prévia — depende de T05.
- [B] T08 Telas de conferência na escola e de complemento **ligadas ao banco** — componentes e tela prontos em modo demonstração (T03d); falta o adaptador da porta `CycleCoreRepository` para a API (depende de T05 e do contrato de integração, `docs/propostas-pendentes.md` §9).
- [B] T09 Trocar cobrança para aceito na escola, com marcação de metodologia por ciclo — depende de T05–T07.
- [B] T10 Visão de atendimento no Resumo/Diferença (pedido, aceito, falta/excedente, rejeições, situação) — depende de T05.
- [B] T11 Teste ponta a ponta CA-008.11 — depende de tudo acima.

Evidência T03/T03b: `npx vitest run src/lib/domain` → 40 testes passando (26/09/2026, ambiente local, sem banco).

Evidência T03d (26/09/2026): `npx vitest run src/lib/domain src/lib/cycleCore` → 67 testes passando. Interface (Playwright, build de produção; banco descartável `colheita_r2_descartavel_202609261823` usado **só para o login**, apagado depois — a demonstração não grava nada): (1) abre "Em conferência" com 2 itens sem conferência e 1 falta sem decisão; (2) complemento de 30 do Produtor 2 com duplo clique → 1 registro, aceito 200/200; (3) reduzir a entrega para 5 com 10 rejeitados → mensagem "Corrija a rejeição primeiro" e botão desabilitado; (4) inicial 0 confirmado + encerrar falta de 10 com motivo; (5) entrega inicial com duplo clique → 1 lançamento; (6) "Pronto para fechar" com os três indicadores separados; (7) correção posterior do complemento 20→25 → aviso "decisão… ficou incoerente: a falta agora é 5" e estado "Aguardando decisões"; (8) revogar e reencerrar 5 → pronto; (9) auditoria com 10 registros; (10) 390 px sem rolagem lateral; (11) link na página da semana. Nenhum erro de página.
