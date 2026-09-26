# Tarefas — Especificação 008

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído · `[B]` bloqueado.

- [x] T01 Registrar regras confirmadas, exemplos e critérios de aceite (spec.md).
- [x] T02 Levantar o suporte existente no Prisma e no SQL novo (plan.md, tabela "Estado atual").
- [x] T03 Regras de domínio puras + testes para CA-008.1 a CA-008.8 (`src/lib/domain/cycle.ts`, 32 testes). *Não conclui a funcionalidade: não há persistência nem tela.*
- [x] T04 Documentar para o Lucas os dados e validações necessários (plan.md + `docs/propostas-pendentes.md` §7).
- [B] T05 Schema/API: eventos de entrega à escola por produto, decisão de falta, perda pré-escola, horário real — **Lucas**.
- [B] T06 API: congelar preço/desconto na criação; validar rejeição × recebimento no servidor com controle de concorrência — **Lucas** (CA-008.9, CA-008.10).
- [B] T07 Fechamento pelos estados da spec (CA-008.5) com prévia — depende de T05.
- [B] T08 Telas de conferência na escola (uma tela por escola, campos de ocorrência só quando necessários) e de complemento — depende de T05 e do contrato de integração.
- [B] T09 Trocar cobrança para aceito na escola, com marcação de metodologia por ciclo — depende de T05–T07.
- [B] T10 Visão de atendimento no Resumo/Diferença (pedido, aceito, falta/excedente, rejeições, situação) — depende de T05.
- [B] T11 Teste ponta a ponta CA-008.11 — depende de tudo acima.

Evidência T03: `npx vitest run src/lib/domain` → 32 testes passando (26/09/2026, ambiente local, sem banco).
